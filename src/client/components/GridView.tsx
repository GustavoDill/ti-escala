import React, { useMemo, useState } from 'react';
import { useCurrentMonthKey } from '../monthSync.js';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarPlus,
  Columns,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  classifyShiftValue,
  getShiftBadgeClasses,
  parseBrDate,
  QUICK_SHIFT_VALUES,
  type WorkerMetadata,
  type WorkerScheduleRow,
} from '../types.js';

interface GridViewProps {
  workers: WorkerScheduleRow[];
  dates: string[];
  editMode: boolean;
  onCellEdit: (matricula: string, date: string, newValue: string) => void;
  onMetadataEdit: (matricula: string, field: keyof WorkerMetadata, newValue: string) => void;
  onAddWorker: (newWorker: WorkerScheduleRow) => void;
  onDeleteWorker: (matricula: string) => void;
  onAddDateColumn: (newDate: string) => void;
}

type SortColumnKey = 'matricula' | 'nome' | 'setor' | 'funcao' | 'entrada' | 'saida';

interface MetaColumnDef {
  key: keyof WorkerMetadata;
  label: string;
  compact: boolean;
  sortable?: boolean;
  widthClass: string;
}

const META_COLUMNS: MetaColumnDef[] = [
  { key: 'matricula', label: 'MATRICULA', compact: true, sortable: true, widthClass: 'min-w-[84px]' },
  { key: 'nome', label: 'Nome', compact: true, sortable: true, widthClass: 'min-w-[220px]' },
  { key: 'setor', label: 'SETOR', compact: true, sortable: true, widthClass: 'min-w-[140px]' },
  { key: 'funcao', label: 'FUNÇÃO', compact: true, sortable: true, widthClass: 'min-w-[82px]' },
  { key: 'sabado', label: 'SABADO', compact: false, widthClass: 'min-w-[74px]' },
  { key: 'domingo', label: 'DOMINGO', compact: false, widthClass: 'min-w-[78px]' },
  { key: 'escalaSemanal', label: 'ESCALA', compact: false, widthClass: 'min-w-[78px]' },
  { key: 'entrada', label: 'ENTR', compact: true, sortable: true, widthClass: 'min-w-[78px]' },
  { key: 'inicioIntervalo', label: 'INI INTER', compact: false, widthClass: 'min-w-[84px]' },
  { key: 'retornoIntervalo', label: 'RET INTER', compact: false, widthClass: 'min-w-[84px]' },
  { key: 'escalaFimDeSemana', label: 'ESCALA (2)', compact: false, widthClass: 'min-w-[88px]' },
  { key: 'saida', label: 'SAI', compact: true, sortable: true, widthClass: 'min-w-[78px]' },
  { key: 'totalIntervalo', label: 'TOTAL INTERV.', compact: false, widthClass: 'min-w-[104px]' },
  { key: 'totalLogado', label: 'TOTAL LOGADO', compact: false, widthClass: 'min-w-[104px]' },
];

export function GridView({
  workers,
  dates,
  editMode,
  onCellEdit,
  onMetadataEdit,
  onAddWorker,
  onDeleteWorker,
  onAddDateColumn,
}: GridViewProps) {
  const [showAllExcelColumns, setShowAllExcelColumns] = useState(true);
  const [sortCol, setSortCol] = useState<SortColumnKey>('nome');
  const [sortDir, setSortDir] = useState<'ascending' | 'descending'>('ascending');
  const [sortStatusText, setSortStatusText] = useState('');

  // Inline editing state (either a metadata cell or a date cell)
  const [activeEdit, setActiveEdit] = useState<{
    matricula: string;
    kind: 'date' | 'meta';
    targetKey: string;
    value: string;
  } | null>(null);

  // New date column input state
  const [newDateInput, setNewDateInput] = useState('');
  const [showAddDateBar, setShowAddDateBar] = useState(false);

  const collator = useMemo(
    () => new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' }),
    []
  );

  const parsedDates = useMemo(() => dates.map(parseBrDate), [dates]);

  const months = useMemo(() => {
    const map = new Map<string, { key: string; label: string; rawDates: string[] }>();
    for (const d of parsedDates) {
      const existing = map.get(d.monthKey);
      if (existing) {
        existing.rawDates.push(d.raw);
      } else {
        map.set(d.monthKey, { key: d.monthKey, label: d.monthLabel, rawDates: [d.raw] });
      }
    }
    return Array.from(map.values());
  }, [parsedDates]);

  // Starts on the current month; 'ALL' is still available from the picker
  const [selectedMonthKey, setSelectedMonthKey] = useCurrentMonthKey(months.map((m) => m.key));

  const visibleDates = useMemo(() => {
    if (selectedMonthKey === 'ALL') return dates;
    const found = months.find((m) => m.key === selectedMonthKey);
    return found ? found.rawDates : dates;
  }, [dates, months, selectedMonthKey]);

  const visibleMetaColumns = useMemo(() => {
    return showAllExcelColumns ? META_COLUMNS : META_COLUMNS.filter((c) => c.compact);
  }, [showAllExcelColumns]);

  const sortedWorkers = useMemo(() => {
    const factor = sortDir === 'ascending' ? 1 : -1;
    return [...workers].sort((a, b) => {
      const valA = a[sortCol] ?? '';
      const valB = b[sortCol] ?? '';
      return factor * collator.compare(valA, valB);
    });
  }, [workers, sortCol, sortDir, collator]);

  const handleSortHeaderClick = (colKey: SortColumnKey, label: string) => {
    let nextDir: 'ascending' | 'descending' = 'ascending';
    if (sortCol === colKey) {
      nextDir = sortDir === 'ascending' ? 'descending' : 'ascending';
    }
    setSortCol(colKey);
    setSortDir(nextDir);
    setSortStatusText(
      `Ordenado por ${label}, ${nextDir === 'ascending' ? 'crescente' : 'decrescente'}, ${sortedWorkers.length} linhas`
    );
  };

  const commitInlineEdit = () => {
    if (!activeEdit) return;
    if (activeEdit.kind === 'date') {
      onCellEdit(activeEdit.matricula, activeEdit.targetKey, activeEdit.value.trim());
    } else {
      onMetadataEdit(
        activeEdit.matricula,
        activeEdit.targetKey as keyof WorkerMetadata,
        activeEdit.value.trim()
      );
    }
    setActiveEdit(null);
  };

  const handleCreateNewWorker = () => {
    const randomId = String(Math.floor(100000 + Math.random() * 900000));
    const days: Record<string, string> = {};
    for (const d of dates) {
      days[d] = '08:48';
    }
    onAddWorker({
      matricula: randomId,
      nome: 'Novo Colaborador',
      setor: 'TI MANHÃ',
      funcao: 'N1',
      sabado: 'S',
      domingo: 'S',
      escalaSemanal: '08:48',
      entrada: '08:00',
      inicioIntervalo: '12:00',
      retornoIntervalo: '13:12',
      escalaFimDeSemana: '07:20',
      saida: '18:00',
      totalIntervalo: '01:12',
      totalLogado: '10:00',
      days,
    });
  };

  const handleAddDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDateInput.trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return;
    }
    onAddDateColumn(trimmed);
    setNewDateInput('');
    setShowAddDateBar(false);
  };

  return (
    <div className="space-y-3">
      {/* Screen reader status for table sorting (modern-web-guidance: sortable-table) */}
      <div role="status" className="sr-status">
        {sortStatusText}
      </div>

      {/* Spreadsheet Sub-Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/90 bg-slate-900/75 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedMonthKey('ALL')}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
              selectedMonthKey === 'ALL'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Todas as Datas ({dates.length})
          </button>
          {months.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setSelectedMonthKey(m.key)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                selectedMonthKey === m.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.label} ({m.rawDates.length})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAllExcelColumns((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <Columns className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
            {showAllExcelColumns
              ? 'Compactar Colunas Fixas'
              : 'Mostrar Todas as 14 Colunas Fixas'}
          </button>

          {editMode && (
            <>
              <button
                type="button"
                onClick={handleCreateNewWorker}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Novo Colaborador
              </button>
              <button
                type="button"
                onClick={() => setShowAddDateBar((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/25 cursor-pointer"
              >
                <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                Nova Coluna de Data
              </button>
            </>
          )}
        </div>
      </div>

      {editMode && showAddDateBar && (
        <form
          onSubmit={handleAddDateSubmit}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-950/30 p-3 text-xs"
        >
          <label htmlFor="new-date-col-input" className="font-medium text-indigo-200">
            Adicionar data no formato DD/MM/AAAA:
          </label>
          <input
            id="new-date-col-input"
            type="text"
            value={newDateInput}
            onChange={(e) => setNewDateInput(e.target.value)}
            placeholder="Ex: 03/12/2026"
            pattern="\d{2}/\d{2}/\d{4}"
            required
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-white focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500 cursor-pointer"
          >
            Adicionar Coluna
          </button>
        </form>
      )}

      {/* Excel-like Sticky Data Table */}
      <div className="rounded-xl border border-slate-800/90 bg-slate-900/75 overflow-auto max-h-[calc(100vh-13.5rem)]">
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="excel-grid-caption"
          className="table-wrapper"
        >
          <table className="schedule-table text-xs">
            <caption id="excel-grid-caption" className="sr-only">
              Planilha completa da Escala de Trabalho ({sortedWorkers.length} colaboradores)
            </caption>
            <thead>
              {/* Row 1: Weekday labels above dates */}
              <tr className="bg-slate-950 text-[10px] text-slate-400">
                {visibleMetaColumns.map((col, idx) => (
                  <th
                    key={`wk-meta-${col.key}`}
                    scope="col"
                    className={`border-b border-r border-slate-800/80 px-2 py-1 text-center font-semibold uppercase tracking-wider bg-slate-950 ${
                      idx === 0 ? 'sticky-col-1' : idx === 1 ? 'sticky-col-2' : ''
                    }`}
                  >
                    {idx < 4 ? 'FIXO' : 'HORÁRIO'}
                  </th>
                ))}
                {editMode && (
                  <th
                    scope="col"
                    className="border-b border-r border-slate-800/80 px-2 py-1 text-center bg-slate-950"
                  >
                    AÇÃO
                  </th>
                )}
                {visibleDates.map((d) => {
                  const info = parseBrDate(d);
                  return (
                    <th
                      key={`wk-${d}`}
                      scope="col"
                      className={`border-b border-r border-slate-800/80 px-1.5 py-1 text-center font-bold uppercase tracking-wider ${
                        info.isWeekend
                          ? 'bg-indigo-950/80 text-indigo-300'
                          : 'bg-slate-950 text-slate-400'
                      }`}
                    >
                      {info.weekdayShort}
                    </th>
                  );
                })}
              </tr>

              {/* Row 2: Main Excel Header Row */}
              <tr className="bg-slate-900 text-slate-200">
                {visibleMetaColumns.map((col, idx) => {
                  const isSorted = col.sortable && sortCol === col.key;
                  const stickyClass =
                    idx === 0
                      ? 'sticky-col-1 bg-slate-900'
                      : idx === 1
                      ? 'sticky-col-2 bg-slate-900'
                      : 'bg-slate-900';

                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={isSorted ? sortDir : undefined}
                      className={`${stickyClass} ${col.widthClass} border-b border-r border-slate-800 font-semibold whitespace-nowrap ${
                        col.sortable ? '' : 'px-2.5 py-2 text-center'
                      }`}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          className="sort-btn"
                          onClick={() =>
                            handleSortHeaderClick(col.key as SortColumnKey, col.label)
                          }
                        >
                          <span>{col.label}</span>
                          {isSorted ? (
                            sortDir === 'ascending' ? (
                              <ArrowUp className="h-3.5 w-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-500 shrink-0" aria-hidden="true" />
                          )}
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  );
                })}

                {editMode && (
                  <th
                    scope="col"
                    className="bg-slate-900 border-b border-r border-slate-800 px-2 py-2 text-center font-semibold min-w-[54px]"
                  >
                    Excluir
                  </th>
                )}

                {visibleDates.map((d) => {
                  const info = parseBrDate(d);
                  return (
                    <th
                      key={d}
                      scope="col"
                      className={`border-b border-r border-slate-800 px-2 py-2 text-center font-mono font-semibold whitespace-nowrap min-w-[82px] ${
                        info.isWeekend
                          ? 'bg-indigo-950/60 text-indigo-200'
                          : 'bg-slate-900 text-slate-200'
                      }`}
                    >
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {sortedWorkers.map((w) => (
                <tr
                  key={w.matricula}
                  className="hover:bg-slate-800/40 transition-colors group"
                >
                  {visibleMetaColumns.map((col, idx) => {
                    const val = w[col.key] ?? '';
                    const isEditingThis =
                      activeEdit?.matricula === w.matricula &&
                      activeEdit?.kind === 'meta' &&
                      activeEdit?.targetKey === col.key;

                    const cellContent = !isEditingThis ? (
                      <span
                        className={`block truncate ${
                          col.key === 'nome'
                            ? 'font-medium text-slate-100 max-w-[215px]'
                            : col.key === 'setor'
                            ? 'text-indigo-300 font-medium'
                            : 'font-mono text-slate-300'
                        }`}
                      >
                        {val}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={activeEdit.value}
                        onChange={(e) =>
                          setActiveEdit({ ...activeEdit, value: e.target.value })
                        }
                        onBlur={commitInlineEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitInlineEdit();
                          else if (e.key === 'Escape') setActiveEdit(null);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded border border-indigo-500 bg-slate-950 px-1.5 py-0.5 text-xs text-white focus:outline-none"
                      />
                    );

                    if (idx === 0) {
                      return (
                        <th
                          key={col.key}
                          scope="row"
                          onClick={() => {
                            if (!editMode || isEditingThis) return;
                            setActiveEdit({
                              matricula: w.matricula,
                              kind: 'meta',
                              targetKey: col.key,
                              value: val,
                            });
                          }}
                          className={`sticky-col-1 bg-slate-950 group-hover:bg-slate-900 border-b border-r border-slate-800/80 px-2.5 py-1.5 text-left font-mono text-slate-300 ${
                            editMode ? 'cursor-pointer hover:bg-indigo-500/10' : ''
                          }`}
                        >
                          {cellContent}
                        </th>
                      );
                    }

                    return (
                      <td
                        key={col.key}
                        onClick={() => {
                          if (!editMode || isEditingThis) return;
                          setActiveEdit({
                            matricula: w.matricula,
                            kind: 'meta',
                            targetKey: col.key,
                            value: val,
                          });
                        }}
                        className={`${
                          idx === 1
                            ? 'sticky-col-2 bg-slate-950 group-hover:bg-slate-900'
                            : ''
                        } border-b border-r border-slate-800/70 px-2.5 py-1.5 ${
                          col.key === 'nome' || col.key === 'setor'
                            ? 'text-left'
                            : 'text-center'
                        } ${editMode ? 'cursor-pointer hover:bg-indigo-500/10' : ''}`}
                      >
                        {cellContent}
                      </td>
                    );
                  })}

                  {editMode && (
                    <td className="border-b border-r border-slate-800/70 px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => onDeleteWorker(w.matricula)}
                        aria-label={`Remover colaborador ${w.nome}`}
                        className="rounded-lg p-1 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  )}

                  {visibleDates.map((d) => {
                    const val = w.days[d] ?? '';
                    const cat = classifyShiftValue(val);
                    const info = parseBrDate(d);
                    const isEditingThis =
                      activeEdit?.matricula === w.matricula &&
                      activeEdit?.kind === 'date' &&
                      activeEdit?.targetKey === d;

                    return (
                      <td
                        key={d}
                        onClick={() => {
                          if (!editMode || isEditingThis) return;
                          setActiveEdit({
                            matricula: w.matricula,
                            kind: 'date',
                            targetKey: d,
                            value: val,
                          });
                        }}
                        className={`border-b border-r border-slate-800/60 px-1.5 py-1 text-center ${
                          info.isWeekend ? 'bg-slate-950/65' : ''
                        } ${
                          editMode
                            ? 'cursor-pointer hover:ring-1 hover:ring-inset hover:ring-indigo-500/60'
                            : ''
                        }`}
                      >
                        {!isEditingThis ? (
                          <span
                            className={`inline-block w-full rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${getShiftBadgeClasses(
                              cat
                            )}`}
                          >
                            {val || '—'}
                          </span>
                        ) : (
                          <div
                            className="space-y-1 min-w-[96px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={activeEdit.value}
                              onChange={(e) =>
                                setActiveEdit({ ...activeEdit, value: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitInlineEdit();
                                else if (e.key === 'Escape') setActiveEdit(null);
                              }}
                              autoFocus
                              className="w-full rounded border border-indigo-500 bg-slate-950 px-1.5 py-0.5 text-center font-mono text-xs text-white focus:outline-none"
                            />
                            <div className="flex flex-wrap gap-0.5 justify-center">
                              {QUICK_SHIFT_VALUES.map((q) => (
                                <button
                                  key={q.value}
                                  type="button"
                                  onClick={() => {
                                    onCellEdit(w.matricula, d, q.value);
                                    setActiveEdit(null);
                                  }}
                                  className="rounded bg-slate-800 px-1 py-0.5 text-[9px] font-mono text-slate-200 hover:bg-indigo-600 cursor-pointer"
                                >
                                  {q.value}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

