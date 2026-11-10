import type { ScheduleDataset, WorkerScheduleRow } from './types.js';

export const FIXED_CSV_HEADERS = [
  'MATRICULA',
  'Nome',
  'SETOR',
  'FUNÇÃO',
  'SABADO',
  'DOMINGO',
  'ESCALA',
  'ENTR',
  'INI INTER',
  'RET INTER',
  'ESCALA',
  ' SAI',
  'TOTAL INTERVALO',
  'TOTAL LOGADO',
] as const;

export const FIXED_COLUMN_COUNT = FIXED_CSV_HEADERS.length; // 14

/**
 * Decodes a raw CSV byte buffer into a clean UTF-8 string, automatically
 * detecting UTF-8 vs Windows-1252 (Latin-1) exported by Portuguese Excel.
 */
export function decodeCsvBuffer(input: Uint8Array | Buffer | string): string {
  if (typeof input === 'string') {
    return repairReplacementChars(stripBom(input));
  }

  let bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  // Strip UTF-8 BOM if present
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    bytes = bytes.subarray(3);
  }

  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    const decoded = utf8Decoder.decode(bytes);
    return repairReplacementChars(decoded);
  } catch {
    // Fallback to Windows-1252 (standard Brazilian Excel ANSI export encoding)
    const win1252Decoder = new TextDecoder('windows-1252');
    return win1252Decoder.decode(bytes);
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Repairs common Portuguese words if a file was previously saved with U+FFFD replacement chars.
 */
function repairReplacementChars(text: string): string {
  if (!text.includes('\uFFFD')) return text;
  return text
    .replace(/MANH\uFFFD/g, 'MANHÃ')
    .replace(/NEG\uFFFDCIO/g, 'NEGÓCIO')
    .replace(/FUN\uFFFD\uFFFDO/g, 'FUNÇÃO')
    .replace(/FUN\uFFFDO/g, 'FUNÇÃO')
    .replace(/F\uFFFDRIAS/g, 'FÉRIAS');
}

/**
 * Normalizes a cell value (e.g. `8:48` -> `08:48`, trims spaces, uppercases known status keywords).
 */
export function normalizeShiftCellValue(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';

  // Match H:MM -> 0H:MM
  if (/^\d:\d{2}$/.test(trimmed)) {
    return `0${trimmed}`;
  }

  const upper = trimmed.toUpperCase();
  if (upper === 'FERIAS' || upper === 'F\uFFFDRIAS') {
    return 'FÉRIAS';
  }
  if (upper === 'FOLGA') {
    return 'FOLGA';
  }
  return trimmed;
}

/**
 * Parses semicolon-delimited `escala.csv` content into a structured ScheduleDataset.
 */
export function parseEscalaCsv(rawInput: Uint8Array | Buffer | string): ScheduleDataset {
  const content = decodeCsvBuffer(rawInput);
  const rawLines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (rawLines.length === 0) {
    throw new Error('O arquivo escala.csv está vazio.');
  }

  const headerCells = splitSemicolonLine(rawLines[0]);
  if (headerCells.length < FIXED_COLUMN_COUNT) {
    throw new Error(
      `Cabeçalho inválido no escala.csv: esperadas pelo menos ${FIXED_COLUMN_COUNT} colunas fixas, encontradas ${headerCells.length}.`
    );
  }

  const firstHeader = headerCells[0].trim().toUpperCase();
  if (firstHeader !== 'MATRICULA' && firstHeader !== 'MATRÍCULA') {
    throw new Error(
      `Cabeçalho inválido no escala.csv: primeira coluna deve ser "MATRICULA", encontrado "${headerCells[0]}".`
    );
  }

  // Extract dynamic date headers from column 14 onwards (ignoring blank trailing columns)
  const dateColumns: { index: number; date: string }[] = [];
  for (let i = FIXED_COLUMN_COUNT; i < headerCells.length; i++) {
    const colHeader = headerCells[i].trim();
    if (colHeader.length > 0) {
      dateColumns.push({ index: i, date: colHeader });
    }
  }

  const dates = dateColumns.map((d) => d.date);
  const workers: WorkerScheduleRow[] = [];
  const sectorSet = new Set<string>();
  const roleSet = new Set<string>();

  for (let lineIdx = 1; lineIdx < rawLines.length; lineIdx++) {
    const line = rawLines[lineIdx];
    const cells = splitSemicolonLine(line);

    const matricula = (cells[0] ?? '').trim();
    const nome = (cells[1] ?? '').trim();

    // Skip trailing blank rows exported by Excel (`;;;;;...`)
    if (!matricula && !nome) {
      continue;
    }

    const setor = (cells[2] ?? '').trim();
    const funcao = (cells[3] ?? '').trim().toUpperCase();
    const sabado = ((cells[4] ?? '').trim() || 'S').toUpperCase();
    const domingo = ((cells[5] ?? '').trim() || 'S').toUpperCase();
    const escalaSemanal = normalizeShiftCellValue(cells[6] ?? '');
    const entrada = normalizeShiftCellValue(cells[7] ?? '');
    const inicioIntervalo = normalizeShiftCellValue(cells[8] ?? '');
    const retornoIntervalo = normalizeShiftCellValue(cells[9] ?? '');
    const escalaFimDeSemana = normalizeShiftCellValue(cells[10] ?? '');
    const saida = normalizeShiftCellValue(cells[11] ?? '');
    const totalIntervalo = normalizeShiftCellValue(cells[12] ?? '');
    const totalLogado = normalizeShiftCellValue(cells[13] ?? '');

    const days: Record<string, string> = {};
    for (const { index, date } of dateColumns) {
      days[date] = normalizeShiftCellValue(cells[index] ?? '');
    }

    if (setor) sectorSet.add(setor);
    if (funcao) roleSet.add(funcao);

    workers.push({
      matricula,
      nome,
      setor,
      funcao,
      sabado,
      domingo,
      escalaSemanal,
      entrada,
      inicioIntervalo,
      retornoIntervalo,
      escalaFimDeSemana,
      saida,
      totalIntervalo,
      totalLogado,
      days,
    });
  }

  return {
    dates,
    workers,
    sectors: Array.from(sectorSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    roles: Array.from(roleSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}

/**
 * Serializes a ScheduleDataset back to the semicolon-delimited Excel CSV format.
 */
export function serializeEscalaCsv(dataset: ScheduleDataset): string {
  const headerRow = [...FIXED_CSV_HEADERS, ...dataset.dates].join(';');
  const rows: string[] = [headerRow];

  for (const w of dataset.workers) {
    if (!w.matricula.trim() && !w.nome.trim()) continue;

    const fixedCols = [
      sanitizeCsvField(w.matricula),
      sanitizeCsvField(w.nome),
      sanitizeCsvField(w.setor),
      sanitizeCsvField(w.funcao),
      sanitizeCsvField(w.sabado.toUpperCase()),
      sanitizeCsvField(w.domingo.toUpperCase()),
      sanitizeCsvField(normalizeShiftCellValue(w.escalaSemanal)),
      sanitizeCsvField(normalizeShiftCellValue(w.entrada)),
      sanitizeCsvField(normalizeShiftCellValue(w.inicioIntervalo)),
      sanitizeCsvField(normalizeShiftCellValue(w.retornoIntervalo)),
      sanitizeCsvField(normalizeShiftCellValue(w.escalaFimDeSemana)),
      sanitizeCsvField(normalizeShiftCellValue(w.saida)),
      sanitizeCsvField(normalizeShiftCellValue(w.totalIntervalo)),
      sanitizeCsvField(normalizeShiftCellValue(w.totalLogado)),
    ];

    const dateCols = dataset.dates.map((date) =>
      sanitizeCsvField(normalizeShiftCellValue(w.days[date] ?? ''))
    );

    rows.push([...fixedCols, ...dateCols].join(';'));
  }

  return rows.join('\r\n') + '\r\n';
}

function splitSemicolonLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ';' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function sanitizeCsvField(value: string): string {
  const cleaned = (value ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (cleaned.includes(';') || cleaned.includes('"')) {
    return `"${cleaned.replace(/"/g, '""')}"`;
  }
  return cleaned;
}

