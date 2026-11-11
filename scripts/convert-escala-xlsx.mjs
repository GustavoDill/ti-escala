// Converte a planilha ESCALA (xlsx) para o escala.csv (separado por ";"), mantendo
// o cabeçalho e a ordem de colunas do arquivo atual no bucket.
// Uso: node scripts/convert-escala-xlsx.mjs "<entrada.xlsx>" "<saida.csv>" [sheet=ESCALA]
import fs from 'node:fs';
import ExcelJS from 'exceljs';

const [, , inputPath, outputPath, sheetName = 'ESCALA'] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Uso: node scripts/convert-escala-xlsx.mjs "<entrada.xlsx>" "<saida.csv>" [sheet]');
  process.exit(1);
}

const pad = (n) => String(n).padStart(2, '0');

function cellToText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && !(value instanceof Date)) {
    if ('result' in value) return cellToText(value.result); // fórmula: usa o resultado
    if ('text' in value) return String(value.text).trim();
    if ('richText' in value) return value.richText.map((t) => t.text).join('').trim();
    return '';
  }
  if (value instanceof Date) {
    // Horários do Excel são gravados como 1899-12-30; datas de cabeçalho usam o ano real
    if (value.getUTCFullYear() === 1899) return `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
    return `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()}`;
  }
  return String(value).trim();
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(inputPath);
const ws = wb.getWorksheet(sheetName);
if (!ws) throw new Error(`Aba "${sheetName}" não encontrada. Abas: ${wb.worksheets.map((w) => w.name).join(', ')}`);

const colCount = ws.getRow(1).cellCount;
const lines = [];
for (let r = 1; r <= ws.rowCount; r++) {
  const row = ws.getRow(r);
  const cells = [];
  for (let c = 1; c <= colCount; c++) cells.push(cellToText(row.getCell(c).value));
  // Ignora linhas vazias (sem matrícula nem nome)
  if (r > 1 && !cells[0] && !cells[1]) continue;
  lines.push(cells.join(';'));
}

fs.writeFileSync(outputPath, lines.join('\r\n') + '\r\n', 'utf8');
console.log(`OK: ${lines.length - 1} colaboradores, ${colCount} colunas -> ${outputPath}`);
