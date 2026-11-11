// Helper: valida um escala.csv corrigido e envia para o bucket do Supabase (SUPABASE_* do .env).
// Antes de sobrescrever, salva uma cópia do arquivo atual do bucket.
//
// Uso:
//   node scripts/upload-escala-csv.ts "<novo-escala.csv>" "<pasta-de-backup>" --yes
//
// Sem --yes o script só valida e mostra o resumo (não envia nada).
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadConfig } from '../src/server/config.ts';
import { parseEscalaCsv, serializeEscalaCsv } from '../src/server/csv.ts';

const [, , csvPath, backupDir, ...flags] = process.argv;
const confirmed = flags.includes('--yes');

if (!csvPath || !backupDir) {
  console.error('Uso: node scripts/upload-escala-csv.ts "<novo-escala.csv>" "<pasta-de-backup>" [--yes]');
  process.exit(1);
}

process.loadEnvFile('.env');
const config = loadConfig();
const supabase = createClient(config.supabaseUrl, config.supabaseKey);
const bucket = supabase.storage.from(config.supabaseBucket);

// 1. Valida o arquivo novo com o mesmo parser usado pelo servidor
const newBuffer = await fs.readFile(csvPath);
const dataset = parseEscalaCsv(newBuffer);
const corruptCells = (serializeEscalaCsv(dataset).match(/�/g) || []).length;
console.log(`Novo arquivo: ${dataset.workers.length} colaboradores, ${dataset.dates.length} datas`);
console.log(`Caracteres inválidas (U+FFFD) no novo arquivo: ${corruptCells}`);
if (corruptCells > 0) {
  console.error('Abortado: o arquivo novo ainda contém caracteres corrompidos.');
  process.exit(1);
}

// 2. Baixa e guarda o arquivo atual do bucket
const current = await bucket.download(config.supabaseFilePath);
if (current.error) {
  console.error(`Não foi possível baixar o arquivo atual: ${current.error.message}`);
  process.exit(1);
}
await fs.mkdir(backupDir, { recursive: true });
const backupPath = path.join(backupDir, `escala-bucket-backup-${Date.now()}.csv`);
await fs.writeFile(backupPath, Buffer.from(await current.data.arrayBuffer()));
console.log(`Backup do arquivo atual: ${backupPath}`);

if (!confirmed) {
  console.log('Nada enviado. Rode novamente com --yes para enviar ao bucket.');
  process.exit(0);
}

// 3. Envia a versão canônica (UTF-8) para o bucket, sobrescrevendo o arquivo
const canonical = Buffer.from(serializeEscalaCsv(dataset), 'utf8');
// cacheControl '0': sem isso o download comum pode servir a versão antiga por até 1h (cache do CDN do Supabase)
const upload = await bucket.upload(config.supabaseFilePath, canonical, {
  upsert: true,
  cacheControl: '0',
  contentType: 'text/csv; charset=utf-8',
});
if (upload.error) {
  console.error(`Falha no envio: ${upload.error.message}`);
  process.exit(1);
}
console.log(`Enviado para ${config.supabaseBucket}/${config.supabaseFilePath}`);
