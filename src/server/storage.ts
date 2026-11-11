import fs from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from './config.ts';
import { parseEscalaCsv, serializeEscalaCsv } from './csv.ts';
import type { ScheduleDataset, ServerSyncStatus, SyncStateCode } from './types.ts';

export class ScheduleStorageService {
  private config: AppConfig;
  private supabase: SupabaseClient | null = null;
  private dataset: ScheduleDataset | null = null;
  private rawCsvCache: string | null = null;
  private state: SyncStateCode = 'INITIALIZING';
  private statusMessage = 'Inicializando sincronização com o Supabase Storage...';
  private lastSyncedAt: string | null = null;

  constructor(config: AppConfig) {
    this.config = config;
    if (config.isConfigured) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } else {
      this.state = 'ERROR_CONFIG';
      this.statusMessage = `Variáveis de ambiente obrigatórias ausentes: ${config.missingVars.join(', ')}. Configure o acesso ao Supabase para iniciar o sistema.`;
    }
  }

  getStatus(): ServerSyncStatus {
    return {
      state: this.state,
      message: this.statusMessage,
      lastSyncedAt: this.lastSyncedAt,
      bucket: this.config.supabaseBucket,
      filePath: this.config.supabaseFilePath,
      workerCount: this.dataset?.workers.length ?? 0,
      dateCount: this.dataset?.dates.length ?? 0,
    };
  }

  isReady(): boolean {
    return this.state === 'READY' && this.dataset !== null;
  }

  getDataset(): ScheduleDataset {
    if (!this.isReady() || !this.dataset) {
      throw new Error(this.statusMessage);
    }
    return this.dataset;
  }

  getRawCsv(): string {
    if (!this.isReady() || !this.rawCsvCache) {
      throw new Error(this.statusMessage);
    }
    return this.rawCsvCache;
  }

  /**
   * Startup synchronization:
   * Downloads `escala.csv` from the Supabase Storage bucket and stores it in the
   * ephemeral runtime cache (`./.cache/escala.csv` + memory).
   * If `escala.csv` is not present in the bucket, marks state as `ERROR_MISSING_CSV`
   * and aborts main schedule functionality.
   */
  async syncFromSupabase(): Promise<ServerSyncStatus> {
    if (!this.config.isConfigured || !this.supabase) {
      this.state = 'ERROR_CONFIG';
      this.dataset = null;
      this.rawCsvCache = null;
      this.statusMessage = `Configuração do Supabase ausente (${this.config.missingVars.join(', ')}). Funcionalidade principal abortada.`;
      console.error(`[StorageSync] ABORTED: ${this.statusMessage}`);
      return this.getStatus();
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(this.config.supabaseBucket)
        .download(this.config.supabaseFilePath);

      if (error || !data) {
        this.state = 'ERROR_MISSING_CSV';
        this.dataset = null;
        this.rawCsvCache = null;
        const errDetail = error?.message || 'Arquivo não encontrado no bucket';
        this.statusMessage = `O arquivo "${this.config.supabaseFilePath}" não foi encontrado no bucket "${this.config.supabaseBucket}" do Supabase (${errDetail}). Faça o upload manual do escala.csv no bucket do Supabase para habilitar o sistema.`;
        console.error(`[StorageSync] ABORTED: ${this.statusMessage}`);
        await this.clearEphemeralCacheFile();
        return this.getStatus();
      }

      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const parsed = parseEscalaCsv(buffer);
      const normalizedCsv = serializeEscalaCsv(parsed);

      // Persist in ephemeral runtime cache while Render instance is running
      await fs.mkdir(this.config.cacheDir, { recursive: true });
      await fs.writeFile(this.config.cacheFilePath, normalizedCsv, 'utf8');

      this.dataset = parsed;
      this.rawCsvCache = normalizedCsv;
      this.state = 'READY';
      this.lastSyncedAt = new Date().toISOString();
      this.statusMessage = `Sincronizado com sucesso a partir do Supabase (${parsed.workers.length} colaboradores, ${parsed.dates.length} datas).`;

      console.log(`[StorageSync] READY: ${this.statusMessage}`);
      return this.getStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.state = 'ERROR_MISSING_CSV';
      this.dataset = null;
      this.rawCsvCache = null;
      this.statusMessage = `Falha ao carregar ou validar "${this.config.supabaseFilePath}" do bucket "${this.config.supabaseBucket}": ${message}. Funcionalidade principal abortada.`;
      console.error(`[StorageSync] ABORTED: ${this.statusMessage}`);
      await this.clearEphemeralCacheFile();
      return this.getStatus();
    }
  }

  /**
   * Updates the schedule dataset, writes to the ephemeral runtime cache,
   * and immediately pushes the updated `escala.csv` to the Supabase Storage bucket.
   */
  async updateAndPushDataset(newDataset: ScheduleDataset): Promise<ServerSyncStatus> {
    if (!this.config.isConfigured || !this.supabase) {
      throw new Error('Supabase não configurado.');
    }

    const csvText = serializeEscalaCsv(newDataset);
    // Re-parse to ensure canonical normalization and validation
    const validatedDataset = parseEscalaCsv(csvText);
    const canonicalCsv = serializeEscalaCsv(validatedDataset);

    const csvBuffer = Buffer.from(canonicalCsv, 'utf8');

    const { error } = await this.supabase.storage
      .from(this.config.supabaseBucket)
      .upload(this.config.supabaseFilePath, csvBuffer, {
        upsert: true,
        contentType: 'text/csv; charset=utf-8',
      });

    if (error) {
      throw new Error(
        `Falha ao enviar "${this.config.supabaseFilePath}" para o bucket "${this.config.supabaseBucket}" no Supabase: ${error.message}`
      );
    }

    await fs.mkdir(this.config.cacheDir, { recursive: true });
    await fs.writeFile(this.config.cacheFilePath, canonicalCsv, 'utf8');

    this.dataset = validatedDataset;
    this.rawCsvCache = canonicalCsv;
    this.state = 'READY';
    this.lastSyncedAt = new Date().toISOString();
    this.statusMessage = `Escala atualizada e sincronizada com o Supabase (${validatedDataset.workers.length} colaboradores, ${validatedDataset.dates.length} datas).`;

    return this.getStatus();
  }

  /**
   * Accepts a newly uploaded raw CSV buffer/string, parses & normalizes it,
   * pushes it to the Supabase Storage bucket, and updates the local runtime cache.
   */
  async uploadRawCsvAndPush(rawInput: Uint8Array | Buffer | string): Promise<ServerSyncStatus> {
    const parsed = parseEscalaCsv(rawInput);
    return this.updateAndPushDataset(parsed);
  }

  private async clearEphemeralCacheFile(): Promise<void> {
    try {
      await fs.rm(this.config.cacheFilePath, { force: true });
    } catch {
      // Ignore if file doesn't exist
    }
  }
}

