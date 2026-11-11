import 'dotenv/config';
import path from 'node:path';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  supabaseUrl: string;
  supabaseKey: string;
  supabaseBucket: string;
  supabaseFilePath: string;
  supabaseAuthTable: string;
  cacheDir: string;
  cacheFilePath: string;
  isConfigured: boolean;
  missingVars: string[];
}

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT || 35001);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();
  const supabaseBucket = (process.env.SUPABASE_BUCKET || 'escala').trim();
  const supabaseFilePath = (process.env.SUPABASE_FILE_PATH || 'escala.csv').trim();
  const supabaseAuthTable = (process.env.SUPABASE_AUTH_TABLE || 'escala_auth').trim();
  const cacheDir = path.resolve(process.cwd(), process.env.CACHE_DIR || '.cache');
  const cacheFilePath = path.join(cacheDir, 'escala.csv');

  const missingVars: string[] = [];
  if (!supabaseUrl) missingVars.push('SUPABASE_URL');
  if (!supabaseKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');

  return {
    port,
    nodeEnv,
    supabaseUrl,
    supabaseKey,
    supabaseBucket,
    supabaseFilePath,
    supabaseAuthTable,
    cacheDir,
    cacheFilePath,
    isConfigured: missingVars.length === 0,
    missingVars,
  };
}

