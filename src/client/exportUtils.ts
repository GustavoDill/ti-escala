import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { classifyShiftValue, parseBrDate, type WorkerScheduleRow } from './types.js';

const FIXED_HEADERS = [
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
];

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Exports semicolon-delimited CSV compatible with Microsoft Excel (with UTF-8 BOM).
 */
export function exportToCsv(
  workers: WorkerScheduleRow[],
  dates: string[],
  filename = 'escala.csv'
): void {
  const headerLine = [...FIXED_HEADERS, ...dates].join(';');
  const lines: string[] = [headerLine];

  for (const w of workers) {
    const fixed = [
      w.matricula,
      w.nome,
      w.setor,
      w.funcao,
      w.sabado,
      w.domingo,
      w.escalaSemanal,
      w.entrada,
      w.inicioIntervalo,
      w.retornoIntervalo,
      w.escalaFimDeSemana,
      w.saida,
      w.totalIntervalo,
      w.totalLogado,
    ];
    const dayValues = dates.map((d) => w.days[d] ?? '');
    lines.push([...fixed, ...dayValues].join(';'));
  }

  // Include UTF-8 BOM (\uFEFF) so Excel on Windows recognizes UTF-8 accents immediately
  const csvContent = '\uFEFF' + lines.join('\r\n') + '\r\n';
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, filename);
}

/**
 * Exports a formatted, color-coded Excel (.xlsx) workbook with frozen headers.
 */
export async function exportToXlsx(
  workers: WorkerScheduleRow[],
  dates: string[],
  filename = 'escala.xlsx'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TI Escala';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Escala de Trabalho', {
    views: [{ state: 'frozen', xSplit: 4, ySplit: 2 }],
  });

  // Row 1: Weekday labels above dates
  const weekdayRowValues = [
    ...Array(FIXED_HEADERS.length).fill(''),
    ...dates.map((d) => parseBrDate(d).weekdayShort.toUpperCase()),
  ];
  const weekdayRow = sheet.addRow(weekdayRowValues);
  weekdayRow.font = { bold: true, size: 9, color: { argb: 'FF94A3B8' } };
  weekdayRow.alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 2: Main column headers
  const headerRow = sheet.addRow([...FIXED_HEADERS, ...dates]);
  headerRow.height = 24;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colNumber <= FIXED_HEADERS.length ? 'FF1E293B' : 'FF312E81' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF475569' } },
      bottom: { style: 'thin', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } },
    };
  });

  // Data rows
  for (const w of workers) {
    const rowValues = [
      w.matricula,
      w.nome,
      w.setor,
      w.funcao,
      w.sabado,
      w.domingo,
      w.escalaSemanal,
      w.entrada,
      w.inicioIntervalo,
      w.retornoIntervalo,
      w.escalaFimDeSemana,
      w.saida,
      w.totalIntervalo,
      w.totalLogado,
      ...dates.map((d) => w.days[d] ?? ''),
    ];

    const row = sheet.addRow(rowValues);
    row.height = 20;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (colNumber <= FIXED_HEADERS.length) {
        cell.font = { size: 9, bold: colNumber <= 2, color: { argb: 'FF0F172A' } };
        cell.alignment = {
          horizontal: colNumber === 2 || colNumber === 3 ? 'left' : 'center',
          vertical: 'middle',
        };
      } else {
        const val = String(cell.value ?? '');
        const cat = classifyShiftValue(val);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { size: 9, bold: cat !== 'work' };

        if (cat === 'folga') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          cell.font = { size: 9, bold: true, color: { argb: 'FF92400E' } };
        } else if (cat === 'ferias') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
          cell.font = { size: 9, bold: true, color: { argb: 'FF075985' } };
        } else if (cat === 'atestado') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
          cell.font = { size: 9, bold: true, color: { argb: 'FF9F1239' } };
        } else if (cat === 'feriado') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
          cell.font = { size: 9, bold: true, color: { argb: 'FF6B21A8' } };
        } else if (cat === 'work') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
          cell.font = { size: 9, bold: false, color: { argb: 'FF065F46' } };
        }
      }
    });
  }

  // Column widths
  const widths = [12, 32, 18, 9, 9, 9, 10, 9, 10, 10, 10, 9, 14, 13];
  sheet.columns.forEach((col, idx) => {
    col.width = idx < widths.length ? widths[idx] : 12;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, filename);
}

/**
 * Exports a printable landscape PDF of the filtered schedule.
 */
export function exportToPdf(
  workers: WorkerScheduleRow[],
  dates: string[],
  subtitle: string,
  filename = 'escala.pdf'
): void {
  // Split dates into chunks of up to 16 days per page so columns remain readable in landscape A4
  const CHUNK_SIZE = 15;
  const dateChunks: string[][] = [];
  for (let i = 0; i < dates.length; i += CHUNK_SIZE) {
    dateChunks.push(dates.slice(i, i + CHUNK_SIZE));
  }
  if (dateChunks.length === 0) {
    dateChunks.push([]);
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  dateChunks.forEach((chunk, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage();
    }

    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Escala de Trabalho — TI & Negócios', 10, 11);

    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const rangeLabel =
      chunk.length > 0 ? `Período: ${chunk[0]} a ${chunk[chunk.length - 1]}` : 'Sem datas';
    doc.text(
      `${subtitle} | ${rangeLabel} (Página ${pageIndex + 1}/${dateChunks.length})`,
      10,
      16
    );

    const head = [
      [
        'Matrícula',
        'Colaborador',
        'Setor',
        'Função',
        'Horário',
        ...chunk.map((d) => {
          const info = parseBrDate(d);
          return `${d.slice(0, 5)}\n${info.weekdayShort}`;
        }),
      ],
    ];

    const body = workers.map((w) => [
      w.matricula,
      w.nome,
      w.setor,
      w.funcao,
      `${w.entrada}-${w.saida}`,
      ...chunk.map((d) => w.days[d] ?? ''),
    ]);

    autoTable(doc, {
      startY: 19,
      margin: { left: 8, right: 8, bottom: 10 },
      head,
      body,
      styles: {
        fontSize: 6.5,
        cellPadding: 1.4,
        valign: 'middle',
        halign: 'center',
        lineColor: [203, 213, 225],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { halign: 'left', cellWidth: 38 },
        2: { halign: 'left', cellWidth: 24 },
        3: { halign: 'center', cellWidth: 11 },
        4: { halign: 'center', cellWidth: 18 },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index >= 5) {
          const val = String(data.cell.raw ?? '');
          const cat = classifyShiftValue(val);
          if (cat === 'folga') {
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.textColor = [146, 64, 14];
            data.cell.styles.fontStyle = 'bold';
          } else if (cat === 'ferias') {
            data.cell.styles.fillColor = [224, 242, 254];
            data.cell.styles.textColor = [7, 89, 133];
            data.cell.styles.fontStyle = 'bold';
          } else if (cat === 'atestado') {
            data.cell.styles.fillColor = [255, 228, 230];
            data.cell.styles.textColor = [159, 18, 57];
            data.cell.styles.fontStyle = 'bold';
          } else if (cat === 'work') {
            data.cell.styles.fillColor = [236, 253, 245];
            data.cell.styles.textColor = [6, 95, 70];
          }
        }
      },
    });
  });

  doc.save(filename);
}

