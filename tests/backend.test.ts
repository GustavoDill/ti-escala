import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthService, hashPasswordSha512, safeCompareHexHashes } from '../src/server/auth.js';
import type { AppConfig } from '../src/server/config.js';
import { decodeCsvBuffer, parseEscalaCsv, serializeEscalaCsv } from '../src/server/csv.js';
import { createApiRoutes } from '../src/server/routes.js';
import { ScheduleStorageService } from '../src/server/storage.js';

const SAMPLE_CSV = [
  'MATRICULA;Nome;SETOR;FUNÇÃO;SABADO;DOMINGO;ESCALA;ENTR;INI INTER;RET INTER;ESCALA; SAI;TOTAL INTERVALO;TOTAL LOGADO;28/09/2026;29/09/2026;30/09/2026',
  '74308;Adison Borges dos Santos;TI MANHÃ;N3;S;S;08:48;08:00;12:30;13:42;08:48;18:00;01:12;10:00;8:48;FOLGA;ferias',
  '39136;Alessandra Rosemara;NEGÓCIOS NOITE;N1;s;n;08:48;10:00;13:30;14:42;07:20;20:00;01:12;10:00;08:48;08:48;FOLGA',
  ';;;;;;;;;;;;;;;;',
  ';;;;   ;;;;;;;;;;;;',
].join('\r\n');

test('CSV Parser parses semicolon-delimited Excel CSV, normalizes times, and ignores blank rows', () => {
  const dataset = parseEscalaCsv(SAMPLE_CSV);

  assert.equal(dataset.workers.length, 2);
  assert.deepEqual(dataset.dates, ['28/09/2026', '29/09/2026', '30/09/2026']);
  assert.deepEqual(dataset.sectors, ['NEGÓCIOS NOITE', 'TI MANHÃ']);
  assert.deepEqual(dataset.roles, ['N1', 'N3']);

  const first = dataset.workers[0];
  assert.equal(first.matricula, '74308');
  assert.equal(first.escalaSemanal, '08:48');
  assert.equal(first.escalaFimDeSemana, '08:48');
  assert.equal(first.days['28/09/2026'], '08:48'); // normalized from 8:48
  assert.equal(first.days['29/09/2026'], 'FOLGA');
  assert.equal(first.days['30/09/2026'], 'FÉRIAS'); // normalized from ferias

  const second = dataset.workers[1];
  assert.equal(second.sabado, 'S');
  assert.equal(second.domingo, 'N');
  assert.equal(second.escalaFimDeSemana, '07:20');

  // Round-trip serialization preserves duplicate ESCALA and leading-space ' SAI' headers
  const serialized = serializeEscalaCsv(dataset);
  assert.ok(
    serialized.startsWith(
      'MATRICULA;Nome;SETOR;FUNÇÃO;SABADO;DOMINGO;ESCALA;ENTR;INI INTER;RET INTER;ESCALA; SAI;TOTAL INTERVALO;TOTAL LOGADO;28/09/2026;29/09/2026;30/09/2026'
    )
  );

  const reparsed = parseEscalaCsv(serialized);
  assert.equal(reparsed.workers.length, 2);
  assert.equal(reparsed.workers[1].escalaFimDeSemana, '07:20');
});

test('decodeCsvBuffer handles Windows-1252 / Latin-1 bytes cleanly', () => {
  const latin1Bytes = Buffer.from('TI MANHÃ;NEGÓCIOS;FUNÇÃO;FÉRIAS', 'latin1');
  const decoded = decodeCsvBuffer(latin1Bytes);
  assert.equal(decoded, 'TI MANHÃ;NEGÓCIOS;FUNÇÃO;FÉRIAS');
});

test('SHA-512 password hashing and constant-time comparison work accurately', () => {
  const hash1 = hashPasswordSha512('MySecretAdminPass!2026');
  const hash2 = hashPasswordSha512('MySecretAdminPass!2026');
  const wrongHash = hashPasswordSha512('OtherPassword');

  assert.equal(hash1.length, 128);
  assert.equal(safeCompareHexHashes(hash1, hash2), true);
  assert.equal(safeCompareHexHashes(hash1, hash2.toUpperCase()), true);
  assert.equal(safeCompareHexHashes(hash1, wrongHash), false);
  assert.equal(safeCompareHexHashes(hash1, 'invalid-short-hash'), false);
});

test('API aborts main functionality with 503 when escala.csv is not available in Supabase', async () => {
  const unconfiguredConfig: AppConfig = {
    port: 3000,
    nodeEnv: 'test',
    supabaseUrl: '',
    supabaseKey: '',
    supabaseBucket: 'escala',
    supabaseFilePath: 'escala.csv',
    supabaseAuthTable: 'escala_auth',
    cacheDir: '.cache-test',
    cacheFilePath: '.cache-test/escala.csv',
    isConfigured: false,
    missingVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  };

  const storage = new ScheduleStorageService(unconfiguredConfig);
  const auth = new AuthService(unconfiguredConfig);
  await storage.syncFromSupabase();

  const api = createApiRoutes(storage, auth);

  const res = await api.request('/escala');
  assert.equal(res.status, 503);
  const body = (await res.json()) as { aborted: boolean; error: string };
  assert.equal(body.aborted, true);
  assert.ok(body.error.includes('Funcionalidade principal abortada'));
});
