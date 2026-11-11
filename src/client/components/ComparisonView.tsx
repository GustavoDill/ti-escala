import React, { useMemo, useState } from 'react';
import { useCurrentMonthKey } from '../monthSync.js';
import {
  CheckSquare,
  Clock,
  GitCompare,
  Square,
  Users,
} from 'lucide-react';
import {
  classifyShiftValue,
  getShiftBadgeClasses,
  parseBrDate,
  QUICK_SHIFT_VALUES,
  type WorkerScheduleRow,
} from '../types.js';

interface ComparisonViewProps {
  workers: WorkerScheduleRow[];
  dates: string[];
  editMode: boolean;
  onCellEdit: (matricula: string, date: string, newValue: string) => void;
}

export function ComparisonView({
  workers,
  dates,
  editMode,
  onCellEdit,
}: ComparisonViewProps) {
  const [selectedMatriculas, setSelectedMatriculas] = useState<string[]>(() =>
    workers.slice(0, 5).map((w) => w.matricula)
  );
  const [editingCell, setEditingCell] = useState<{
    matricula: string;
    date: string;
    value: string;
  } | null>(null);

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

  const comparedWorkers = useMemo(() => {
    const set = new Set(selectedMatriculas);
    return workers.filter((w) => set.has(w.matricula));
  }, [workers, selectedMatriculas]);

  const toggleWorker = (matricula: string) => {
    setSelectedMatriculas((prev) =>
      prev.includes(matricula)
        ? prev.filter((m) => m !== matricula)
        : [...prev, matricula]
    );
  };

  const selectAllFiltered = () => {
    setSelectedMatriculas(workers.map((w) => w.matricula));
  };

  const clearSelection = () => {
    setSelectedMatriculas([]);
  };

  const commitInlineEdit = (matricula: string, date: string, newValue: string) => {
    onCellEdit(matricula, date, newValue.trim());
    setEditingCell(null);
  };

  return (
    <div className="space-y-4">
      {/* Worker Selection Panel */}
      <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-indigo-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-white">
              Comparar Colaboradores ({comparedWorkers.length} selecionados)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 mr-2">
              <button
                type="button"
                onClick={() => setSelectedMonthKey('ALL')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  selectedMonthKey === 'ALL'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Todo o Período
              </button>
              {months.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelectedMonthKey(m.key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium cursor-pointer ${
                    selectedMonthKey === m.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={selectAllFiltered}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              Selecionar Todos ({workers.length})
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Limpar Seleção
            </button>
          </div>
        </div>

        {/* Selectable Worker Chips */}
        <div className="flex flex-wrap gap-1 max-h-[4.5rem] overflow-y-auto pr-1">
          {workers.map((w) => {
            const isChecked = selectedMatriculas.includes(w.matricula);
            return (
              <button
                key={w.matricula}
                type="button"
                onClick={() => toggleWorker(w.matricula)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition-all cursor-pointer ${
                  isChecked
                    ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-200 font-medium'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {isChecked ? (
                  <CheckSquare className="h-3.5 w-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-slate-600 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate max-w-[180px]">{w.nome}</span>
                <span className="rounded bg-slate-800/90 px-1 text-[10px] font-mono text-slate-400">
                  {w.funcao}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side Comparison Matrix */}
      {comparedWorkers.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-400">
          <Users className="h-8 w-8 mx-auto mb-2 text-slate-500" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-300">
            Selecione pelo menos 1 colaborador acima para comparar as escalas lado a lado.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/75 overflow-auto max-h-[calc(100vh-19rem)]">
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="comparison-table-caption"
            className="table-wrapper"
          >
            <table className="schedule-table text-xs">
              <caption id="comparison-table-caption" className="sr-only">
                Comparação de escala entre colaboradores selecionados
              </caption>
              <thead>
                <tr className="bg-slate-900 text-slate-300">
                  <th
                    scope="col"
                    className="sticky-col-1 bg-slate-900 border-b border-r border-slate-800 px-3 py-2.5 text-left font-semibold min-w-[84px]"
                  >
                    Matrícula
                  </th>
                  <th
                    scope="col"
                    className="sticky-col-2 bg-slate-900 border-b border-r border-slate-800 px-3 py-2.5 text-left font-semibold min-w-[230px]"
                  >
                    Colaborador / Turno
                  </th>
                  {visibleDates.map((d) => {
                    const info = parseBrDate(d);
                    return (
                      <th
                        key={d}
                        scope="col"
                        className={`border-b border-r border-slate-800/80 px-2 py-2 text-center min-w-[78px] ${
                          info.isWeekend
                            ? 'bg-indigo-950/60 text-indigo-300'
                            : 'bg-slate-900 text-slate-300'
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-wider opacity-75">
                          {info.weekdayShort}
                        </div>
                        <div className="font-mono font-bold text-xs">{d.slice(0, 5)}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {comparedWorkers.map((w) => (
                  <tr
                    key={w.matricula}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    <th
                      scope="row"
                      className="sticky-col-1 bg-slate-950 group-hover:bg-slate-900 border-b border-r border-slate-800/80 px-3 py-2.5 font-mono text-slate-400 text-left"
                    >
                      {w.matricula}
                    </th>
                    <td className="sticky-col-2 bg-slate-950 group-hover:bg-slate-900 border-b border-r border-slate-800/80 px-3 py-2">
                      <div className="font-semibold text-slate-100 truncate max-w-[215px]">
                        {w.nome}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                        <span className="text-indigo-300 font-medium">{w.setor}</span>
                        <span>·</span>
                        <span className="font-mono">{w.funcao}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-0.5 font-mono">
                          <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                          {w.entrada}–{w.saida}
                        </span>
                      </div>
                    </td>

                    {visibleDates.map((d) => {
                      const val = w.days[d] ?? '';
                      const cat = classifyShiftValue(val);
                      const info = parseBrDate(d);
                      const isEditingThis =
                        editingCell?.matricula === w.matricula && editingCell?.date === d;

                      return (
                        <td
                          key={d}
                          onClick={() => {
                            if (!editMode || isEditingThis) return;
                            setEditingCell({ matricula: w.matricula, date: d, value: val });
                          }}
                          className={`border-b border-r border-slate-800/60 px-1.5 py-1.5 text-center ${
                            info.isWeekend ? 'bg-slate-950/65' : ''
                          } ${editMode ? 'cursor-pointer hover:bg-indigo-500/10' : ''}`}
                        >
                          {!isEditingThis ? (
                            <span
                              className={`inline-block w-full rounded-md border px-1.5 py-1 font-mono text-[11px] font-semibold ${getShiftBadgeClasses(
                                cat
                              )}`}
                            >
                              {val || '—'}
                            </span>
                          ) : (
                            <div
                              className="space-y-1 min-w-[92px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editingCell.value}
                                onChange={(e) =>
                                  setEditingCell({ ...editingCell, value: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    commitInlineEdit(w.matricula, d, editingCell.value);
                                  } else if (e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                }}
                                autoFocus
                                className="w-full rounded border border-indigo-500 bg-slate-950 px-1 py-0.5 text-center font-mono text-xs text-white"
                              />
                              <div className="flex flex-wrap gap-0.5 justify-center">
                                {QUICK_SHIFT_VALUES.slice(0, 4).map((q) => (
                                  <button
                                    key={q.value}
                                    type="button"
                                    onClick={() => commitInlineEdit(w.matricula, d, q.value)}
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

                {/* Coverage Summary Row */}
                <tr className="bg-slate-900/95 font-semibold">
                  <th
                    scope="row"
                    className="sticky-col-1 bg-slate-900 border-t-2 border-r border-slate-700 px-3 py-2.5 text-left text-indigo-300"
                  >
                    Cobertura
                  </th>
                  <td className="sticky-col-2 bg-slate-900 border-t-2 border-r border-slate-700 px-3 py-2.5 text-slate-300">
                    Trabalhando / Selecionados ({comparedWorkers.length})
                  </td>
                  {visibleDates.map((d) => {
                    let activeCount = 0;
                    let folgaCount = 0;
                    for (const w of comparedWorkers) {
                      const cat = classifyShiftValue(w.days[d]);
                      if (cat === 'work') activeCount++;
                      else if (cat === 'folga') folgaCount++;
                    }
                    const ratio =
                      comparedWorkers.length > 0 ? activeCount / comparedWorkers.length : 0;

                    return (
                      <td
                        key={d}
                        className="border-t-2 border-r border-slate-700 px-1.5 py-2 text-center font-mono"
                      >
                        <div
                          className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold ${
                            ratio <= 0.35
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : ratio <= 0.65
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {activeCount}/{comparedWorkers.length}
                        </div>
                        {folgaCount > 0 && (
                          <div className="text-[10px] text-amber-400/90 mt-0.5">
                            {folgaCount} folga{folgaCount > 1 ? 's' : ''}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

