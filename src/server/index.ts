import fs from 'node:fs/promises';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AuthService } from './auth.js';
import { loadConfig } from './config.js';
import { createApiRoutes } from './routes.js';
import { ScheduleStorageService } from './storage.js';

export async function createApp() {
  const config = loadConfig();
  const storage = new ScheduleStorageService(config);
  const auth = new AuthService(config);

  // Perform initial startup download of escala.csv from Supabase Storage Bucket
  await storage.syncFromSupabase();

  const app = new Hono();

  app.use('*', cors());

  // Render healthcheck endpoint
  app.get('/healthz', (c) => {
    const syncStatus = storage.getStatus();
    return c.json({
      ok: true,
      service: 'ti-escala',
      syncState: syncStatus.state,
      lastSyncedAt: syncStatus.lastSyncedAt,
    });
  });

  // Mount API routes
  const apiRoutes = createApiRoutes(storage, auth);
  app.route('/api', apiRoutes);

  // Serve static built frontend in production (from dist/client)
  const clientDistDir = path.resolve(process.cwd(), 'dist/client');
  try {
    await fs.access(clientDistDir);
    app.use('/*', serveStatic({ root: './dist/client' }));
    app.get('*', async (c) => {
      const indexHtml = await fs.readFile(path.join(clientDistDir, 'index.html'), 'utf8');
      return c.html(indexHtml);
    });
  } catch {
    // In development mode, Vite serves the frontend on port 5173
    app.get('/', (c) =>
      c.json({
        service: 'ti-escala API server',
        status: storage.getStatus(),
        hint: 'Run `npm run dev` to start both Hono backend and Vite frontend.',
      })
    );
  }

  return { app, config, storage, auth };
}

// Start server if invoked directly
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));

if (isMain) {
  createApp()
    .then(({ app, config, storage }) => {
      serve(
        {
          fetch: app.fetch,
          port: config.port,
        },
        (info) => {
          console.log(`[ti-escala] Hono server listening on http://localhost:${info.port}`);
          console.log(`[ti-escala] Sync state: ${storage.getStatus().state} — ${storage.getStatus().message}`);
        }
      );
    })
    .catch((err) => {
      console.error('[ti-escala] Fatal startup error:', err);
      process.exit(1);
    });
}

