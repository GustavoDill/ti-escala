import { Hono } from 'hono';
import type { AuthService } from './auth.ts';
import { getNationalHolidays } from './holidays.ts';
import type { ScheduleStorageService } from './storage.ts';
import type { AuthRole, ScheduleDataset, WorkerMetadata } from './types.ts';

type Variables = {
  authRole: AuthRole;
};

export function createApiRoutes(
  storage: ScheduleStorageService,
  auth: AuthService
): Hono<{ Variables: Variables }> {
  const api = new Hono<{ Variables: Variables }>();

  // 1. Server & Sync Status (always returns 200 with detailed state)
  api.get('/status', (c) => {
    return c.json({
      status: storage.getStatus(),
    });
  });

  // 1b. National holidays for a year (BrasilAPI, cached; bundled fallback if unavailable)
  api.get('/feriados/:year', async (c) => {
    const year = Number(c.req.param('year'));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return c.json({ error: 'Ano inválido. Use um ano entre 2000 e 2100.' }, 400);
    }
    return c.json(await getNationalHolidays(year));
  });

  // 2. Read-Only Schedule Data (aborts with 503 if escala.csv is missing from bucket)
  api.get('/escala', (c) => {
    if (!storage.isReady()) {
      const status = storage.getStatus();
      return c.json(
        {
          error: status.message,
          aborted: true,
          status,
        },
        503
      );
    }

    return c.json({
      status: storage.getStatus(),
      data: storage.getDataset(),
    });
  });

  // 3. Raw CSV Download
  api.get('/escala/raw', (c) => {
    if (!storage.isReady()) {
      const status = storage.getStatus();
      return c.json({ error: status.message, aborted: true, status }, 503);
    }

    const csv = storage.getRawCsv();
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="escala.csv"',
      },
    });
  });

  // 4. Verify Password (SHA-512 check against public.escala_auth in Supabase)
  api.post('/auth/verify', async (c) => {
    try {
      const body = await c.req.json<{ password?: string }>();
      const password = body?.password ?? '';
      const result = await auth.verifyPassword(password);

      if (!result.valid || !result.role) {
        return c.json(
          {
            valid: false,
            error: result.error || 'Senha inválida.',
          },
          401
        );
      }

      return c.json({
        valid: true,
        role: result.role,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Requisição inválida.';
      return c.json({ valid: false, error: msg }, 400);
    }
  });

  // 5. Retry / Force Sync from Supabase Bucket
  api.post('/escala/sync', async (c) => {
    // If already READY, require admin/system password to force overwrite local cache;
    // if in ERROR_MISSING_CSV, allow retrying startup sync after manual upload.
    if (storage.isReady()) {
      const password =
        c.req.header('x-escala-password') ||
        (c.req.header('authorization')?.startsWith('Bearer ')
          ? c.req.header('authorization')!.slice(7).trim()
          : '');
      const check = await auth.verifyPassword(password);
      if (!check.valid) {
        return c.json({ error: check.error || 'Não autorizado.' }, 403);
      }
    }

    const status = await storage.syncFromSupabase();
    if (!storage.isReady()) {
      return c.json({ error: status.message, aborted: true, status }, 503);
    }

    return c.json({
      status,
      data: storage.getDataset(),
    });
  });

  // =========================================================================
  // Protected Edit-Mode Endpoints (Require 'administrator' or 'system' SHA-512 password)
  // =========================================================================

  // 6. Full Dataset Update & Push to Supabase
  api.put('/escala', auth.middleware(), async (c) => {
    if (!storage.isReady()) {
      const status = storage.getStatus();
      return c.json({ error: status.message, aborted: true, status }, 503);
    }

    try {
      const body = await c.req.json<{ data?: ScheduleDataset }>();
      if (!body?.data || !Array.isArray(body.data.workers) || !Array.isArray(body.data.dates)) {
        return c.json({ error: 'Formato de dados da escala inválido.' }, 400);
      }

      const status = await storage.updateAndPushDataset(body.data);
      return c.json({
        status,
        data: storage.getDataset(),
        updatedBy: c.get('authRole'),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar a escala.';
      return c.json({ error: msg }, 500);
    }
  });

  // 7. Inline Cell / Metadata Batch Patch & Push to Supabase
  api.patch('/escala/cells', auth.middleware(), async (c) => {
    if (!storage.isReady()) {
      const status = storage.getStatus();
      return c.json({ error: status.message, aborted: true, status }, 503);
    }

    try {
      const body = await c.req.json<{
        edits: Array<{
          matricula: string;
          date?: string;
          field?: keyof WorkerMetadata;
          value: string;
        }>;
      }>();

      if (!body?.edits || !Array.isArray(body.edits) || body.edits.length === 0) {
        return c.json({ error: 'Nenhuma edição informada.' }, 400);
      }

      const current = storage.getDataset();
      const clonedWorkers = current.workers.map((w) => ({
        ...w,
        days: { ...w.days },
      }));

      for (const edit of body.edits) {
        const target = clonedWorkers.find((w) => w.matricula === edit.matricula);
        if (!target) continue;

        if (edit.date) {
          target.days[edit.date] = edit.value;
        } else if (edit.field && edit.field in target) {
          target[edit.field] = edit.value;
        }
      }

      const status = await storage.updateAndPushDataset({
        ...current,
        workers: clonedWorkers,
      });

      return c.json({
        status,
        data: storage.getDataset(),
        updatedBy: c.get('authRole'),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar edição inline.';
      return c.json({ error: msg }, 500);
    }
  });

  // 8. Upload & Replace CSV in Supabase Bucket
  api.post('/escala/upload', auth.middleware(), async (c) => {
    try {
      const contentType = c.req.header('content-type') || '';
      let rawInput: Buffer | string;

      if (contentType.includes('multipart/form-data')) {
        const formData = await c.req.formData();
        const file = formData.get('file');
        if (!file || !(file instanceof File)) {
          return c.json({ error: 'Arquivo CSV não enviado no campo "file".' }, 400);
        }
        const arrayBuf = await file.arrayBuffer();
        rawInput = Buffer.from(arrayBuf);
      } else {
        const body = await c.req.json<{ csvContent?: string }>();
        if (!body?.csvContent) {
          return c.json({ error: 'Conteúdo CSV não informado.' }, 400);
        }
        rawInput = body.csvContent;
      }

      const status = await storage.uploadRawCsvAndPush(rawInput);
      return c.json({
        status,
        data: storage.getDataset(),
        updatedBy: c.get('authRole'),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar upload do CSV.';
      return c.json({ error: msg }, 400);
    }
  });

  return api;
}

