import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Coffee,
  Edit3,
  User,
  Users,
  Check,
  X,
} from 'lucide-react';
import {
  classifyShiftValue,
  getShiftBadgeClasses,
  parseBrDate,
  QUICK_SHIFT_VALUES,
  type ParsedDateInfo,
  type WorkerScheduleRow,
} from '../types.js';

interface CalendarViewProps {
  workers: WorkerScheduleRow[];
  dates: string[];
  editMode: boolean;
  onCellEdit: (matricula: string, date: string, newValue: string) => void;
}

const WEEKDAYS_HEADER = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CalendarView({
  workers,
  dates,
  editMode,
  onCellEdit,
}: CalendarViewProps) {
  const [calendarSubMode, setCalendarSubMode] = useState<'team' | 'worker'>('team');
  const [selectedWorkerMatricula, setSelectedWorkerMatricula] = useState<string>(
    workers[0]?.matricula || ''
  );
  const [workerSortBy, setWorkerSortBy] = useState<'nome' | 'setor' | 'funcao' | 'entrada'>('nome');

  // Parse all dates and group by month (YYYY-MM)
  const parsedDates = useMemo(() => dates.map(parseBrDate), [dates]);

  const months = useMemo(() => {
    const map = new Map<string, { key: string; label: string; dates: ParsedDateInfo[] }>();
    for (const d of parsedDates) {
      const existing = map.get(d.monthKey);
      if (existing) {
        existing.dates.push(d);
      } else {
        map.set(d.monthKey, { key: d.monthKey, label: d.monthLabel, dates: [d] });
      }
    }
    return Array.from(map.values());
  }, [parsedDates]);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(
    () => months[0]?.key || ''
  );

  const activeMonth = useMemo(() => {
    return months.find((m) => m.key === selectedMonthKey) || months[0] || null;
  }, [months, selectedMonthKey]);

  const [selectedDateRaw, setSelectedDateRaw] = useState<string>(
    () => activeMonth?.dates[0]?.raw || dates[0] || ''
  );

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{
    matricula: string;
    date: string;
    value: string;
  } | null>(null);

  const collator = useMemo(
    () => new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' }),
    []
  );

  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      if (workerSortBy === 'nome') return collator.compare(a.nome, b.nome);
      if (workerSortBy === 'setor') {
        const cmp = collator.compare(a.setor, b.setor);
        return cmp !== 0 ? cmp : collator.compare(a.nome, b.nome);
      }
      if (workerSortBy === 'funcao') {
        const cmp = collator.compare(a.funcao, b.funcao);
        return cmp !== 0 ? cmp : collator.compare(a.nome, b.nome);
      }
      const cmp = collator.compare(a.entrada, b.entrada);
      return cmp !== 0 ? cmp : collator.compare(a.nome, b.nome);
    });
  }, [workers, workerSortBy, collator]);

  const activeWorker = useMemo(() => {
    return (
      sortedWorkers.find((w) => w.matricula === selectedWorkerMatricula) ||
      sortedWorkers[0] ||
      null
    );
  }, [sortedWorkers, selectedWorkerMatricula]);

  // Build calendar cells for the active month with leading blank weekday slots
  const calendarGridCells = useMemo(() => {
    if (!activeMonth || activeMonth.dates.length === 0) return [];
    const firstWeekday = activeMonth.dates[0].weekdayIndex;
    const blanks: Array<ParsedDateInfo | null> = Array(firstWeekday).fill(null);
    return [...blanks, ...activeMonth.dates];
  }, [activeMonth]);

  // Stats for activeWorker in activeMonth
  const workerMonthStats = useMemo(() => {
    if (!activeWorker || !activeMonth) {
      return { work: 0, folga: 0, ferias: 0, other: 0 };
    }
    let work = 0;
    let folga = 0;
    let ferias = 0;
    let other = 0;
    for (const d of activeMonth.dates) {
      const cat = classifyShiftValue(activeWorker.days[d.raw]);
      if (cat === 'work') work++;
      else if (cat === 'folga') folga++;
      else if (cat === 'ferias') ferias++;
      else if (cat !== 'empty') other++;
    }
    return { work, folga, ferias, other };
  }, [activeWorker, activeMonth]);

  const commitInlineEdit = (matricula: string, date: string, newValue: string) => {
    onCellEdit(matricula, date, newValue.trim());
    setEditingCell(null);
  };

  if (!activeMonth) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
        Nenhuma data disponível na escala atual.
      </div>
    );
  }

  const effectiveSelectedDate =
    activeMonth.dates.some((d) => d.raw === selectedDateRaw)
      ? selectedDateRaw
      : activeMonth.dates[0]?.raw || '';

  return (
    <div className="space-y-4">
      {/* Calendar Top Sub-Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/90 bg-slate-900/75 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCalendarSubMode('team')}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              calendarSubMode === 'team'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            Calendário da Equipe
          </button>
          <button
            type="button"
            onClick={() => setCalendarSubMode('worker')}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              calendarSubMode === 'worker'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <User className="h-4 w-4" aria-hidden="true" />
            Por Colaborador
          </button>
        </div>

        {/* Month Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 mr-1 font-medium">Mês:</span>
          {months.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setSelectedMonthKey(m.key);
                if (m.dates[0]) setSelectedDateRaw(m.dates[0].raw);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                activeMonth.key === m.key
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="calendar-worker-sort" className="text-xs text-slate-400">
            Ordenar por:
          </label>
          <select
            id="calendar-worker-sort"
            value={workerSortBy}
            onChange={(e) =>
              setWorkerSortBy(e.target.value as 'nome' | 'setor' | 'funcao' | 'entrada')
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="nome">Nome (A–Z)</option>
            <option value="setor">Setor</option>
            <option value="funcao">Função (N1–N3)</option>
            <option value="entrada">Horário de Entrada</option>
          </select>
        </div>
      </div>

      {calendarSubMode === 'team' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Team Monthly Calendar Grid (8 cols) */}
          <div className="lg:col-span-8 rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 isolated-section">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                Visão Mensal — {activeMonth.label}
              </h2>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Trabalhando
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> Folga
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-sky-400" /> Férias
                </span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center mb-1.5">
              {WEEKDAYS_HEADER.map((w, idx) => (
                <div
                  key={w}
                  className={`py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg ${
                    idx === 0 || idx === 6
                      ? 'bg-indigo-950/40 text-indigo-300'
                      : 'bg-slate-800/50 text-slate-400'
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarGridCells.map((cellDate, idx) => {
                if (!cellDate) {
                  return (
                    <div
                      key={`blank-${idx}`}
                      className="min-h-[96px] rounded-xl border border-slate-800/30 bg-slate-950/30"
                    />
                  );
                }

                let workCount = 0;
                let folgaCount = 0;
                let feriasCount = 0;

                for (const w of sortedWorkers) {
                  const cat = classifyShiftValue(w.days[cellDate.raw]);
                  if (cat === 'work') workCount++;
                  else if (cat === 'folga') folgaCount++;
                  else if (cat === 'ferias') feriasCount++;
                }

                const isSelected = cellDate.raw === effectiveSelectedDate;

                return (
                  <button
                    key={cellDate.raw}
                    type="button"
                    onClick={() => setSelectedDateRaw(cellDate.raw)}
                    className={`min-h-[96px] rounded-xl border p-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/15 ring-2 ring-indigo-500/30'
                        : cellDate.isWeekend
                        ? 'border-slate-800/90 bg-slate-950/75 hover:border-slate-700'
                        : 'border-slate-800/80 bg-slate-900/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${
                          isSelected
                            ? 'bg-indigo-500 text-white'
                            : cellDate.isWeekend
                            ? 'text-indigo-300 bg-indigo-500/10'
                            : 'text-slate-200'
                        }`}
                      >
                        {String(cellDate.day).padStart(2, '0')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {cellDate.raw.slice(0, 5)}
                      </span>
                    </div>

                    <div className="space-y-1 mt-2 w-full">
                      <div className="flex items-center justify-between rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[11px] text-emerald-300">
                        <span>Ativos</span>
                        <span className="font-mono font-semibold">{workCount}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1 text-[10px]">
                        <span className="flex-1 rounded bg-amber-500/15 px-1 py-0.5 text-amber-300 text-center font-mono">
                          F: {folgaCount}
                        </span>
                        {feriasCount > 0 && (
                          <span className="flex-1 rounded bg-sky-500/15 px-1 py-0.5 text-sky-300 text-center font-mono">
                            Fér: {feriasCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Roster & Inline Editor (4 cols) */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 flex flex-col max-h-[680px]">
            <div className="border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Escala do Dia — {effectiveSelectedDate}
                </h3>
                <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-indigo-300">
                  {parseBrDate(effectiveSelectedDate).weekdayShort}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {editMode
                  ? 'Modo Edição ativo: clique no status de qualquer colaborador para editar inline.'
                  : 'Clique em uma data no calendário para inspecionar horários e folgas.'}
              </p>
            </div>

            <div className="overflow-y-auto space-y-2 pr-1 flex-1">
              {sortedWorkers.map((w) => {
                const rawVal = w.days[effectiveSelectedDate] ?? '';
                const cat = classifyShiftValue(rawVal);
                const isEditingThis =
                  editingCell?.matricula === w.matricula &&
                  editingCell?.date === effectiveSelectedDate;

                return (
                  <div
                    key={w.matricula}
                    className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-2.5 transition-colors hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {w.nome}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300 font-medium">
                            {w.setor}
                          </span>
                          <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-indigo-300 font-mono">
                            {w.funcao}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono text-slate-400">
                            <Clock className="h-3 w-3 text-slate-500" aria-hidden="true" />
                            {w.entrada}–{w.saida}
                          </span>
                        </div>
                      </div>

                      {!isEditingThis ? (
                        <button
                          type="button"
                          disabled={!editMode}
                          onClick={() => {
                            if (!editMode) return;
                            setEditingCell({
                              matricula: w.matricula,
                              date: effectiveSelectedDate,
                              value: rawVal,
                            });
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-mono font-semibold shrink-0 ${getShiftBadgeClasses(
                            cat
                          )} ${
                            editMode
                              ? 'cursor-pointer hover:ring-2 hover:ring-indigo-500/50'
                              : 'cursor-default'
                          }`}
                          title={editMode ? 'Clique para editar inline' : undefined}
                        >
                          {rawVal || '—'}
                          {editMode && <Edit3 className="h-3 w-3 opacity-70" aria-hidden="true" />}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editingCell.value}
                            onChange={(e) =>
                              setEditingCell({ ...editingCell, value: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                commitInlineEdit(
                                  w.matricula,
                                  effectiveSelectedDate,
                                  editingCell.value
                                );
                              } else if (e.key === 'Escape') {
                                setEditingCell(null);
                              }
                            }}
                            autoFocus
                            className="w-20 rounded-lg border border-indigo-500 bg-slate-900 px-2 py-1 text-xs font-mono text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              commitInlineEdit(
                                w.matricula,
                                effectiveSelectedDate,
                                editingCell.value
                              )
                            }
                            className="rounded-lg bg-emerald-600 p-1 text-white hover:bg-emerald-500"
                            aria-label="Confirmar edição"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCell(null)}
                            className="rounded-lg bg-slate-800 p-1 text-slate-300 hover:bg-slate-700"
                            aria-label="Cancelar edição"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditingThis && (
                      <div className="mt-2 flex flex-wrap gap-1 pt-2 border-t border-slate-800/80">
                        {QUICK_SHIFT_VALUES.map((q) => (
                          <button
                            key={q.value}
                            type="button"
                            onClick={() =>
                              commitInlineEdit(w.matricula, effectiveSelectedDate, q.value)
                            }
                            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-mono text-slate-200 hover:border-indigo-500 hover:text-indigo-300 cursor-pointer"
                          >
                            {q.value}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Per-Worker Individual Calendar View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Worker List Sidebar (4 cols) */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-800/90 bg-slate-900/70 p-3.5 max-h-[680px] flex flex-col">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 px-1">
              Colaboradores ({sortedWorkers.length})
            </h3>
            <div className="overflow-y-auto space-y-1.5 pr-1 flex-1">
              {sortedWorkers.map((w) => {
                const isSelected = activeWorker?.matricula === w.matricula;
                return (
                  <button
                    key={w.matricula}
                    type="button"
                    onClick={() => setSelectedWorkerMatricula(w.matricula)}
                    className={`w-full rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/15 text-white'
                        : 'border-slate-800/70 bg-slate-950/50 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold truncate">{w.nome}</span>
                      <span className="font-mono text-[11px] text-slate-400">#{w.matricula}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                      <span>
                        {w.setor} · <strong className="text-indigo-300">{w.funcao}</strong>
                      </span>
                      <span className="font-mono">
                        {w.entrada}–{w.saida}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Individual Worker Calendar & Shift Details (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {activeWorker ? (
              <>
                {/* Worker Shift Profile Card */}
                <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-base font-bold text-white">{activeWorker.nome}</h2>
                        <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-300">
                          Matrícula {activeWorker.matricula}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-300">
                        <span className="rounded-lg bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-0.5 text-indigo-300 font-medium">
                          {activeWorker.setor}
                        </span>
                        <span className="rounded-lg bg-slate-800 px-2.5 py-0.5 font-mono">
                          Função: {activeWorker.funcao}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-0.5 font-mono">
                          <Clock className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                          Turno: {activeWorker.entrada} às {activeWorker.saida}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-0.5 font-mono">
                          <Coffee className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                          Intervalo: {activeWorker.inicioIntervalo}–{activeWorker.retornoIntervalo}{' '}
                          ({activeWorker.totalIntervalo})
                        </span>
                      </div>
                    </div>

                    {/* Monthly Summary Counters */}
                    <div className="flex items-center gap-2">
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-center">
                        <div className="text-base font-bold font-mono text-emerald-300">
                          {workerMonthStats.work}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-emerald-200/80">
                          Dias Trab.
                        </div>
                      </div>
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-center">
                        <div className="text-base font-bold font-mono text-amber-300">
                          {workerMonthStats.folga}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-amber-200/80">
                          Folgas
                        </div>
                      </div>
                      <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-center">
                        <div className="text-base font-bold font-mono text-sky-300">
                          {workerMonthStats.ferias}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-sky-200/80">
                          Férias
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Worker Monthly Calendar Grid */}
                <div className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4">
                  <div className="grid grid-cols-7 gap-1.5 text-center mb-1.5">
                    {WEEKDAYS_HEADER.map((w, idx) => (
                      <div
                        key={w}
                        className={`py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg ${
                          idx === 0 || idx === 6
                            ? 'bg-indigo-950/40 text-indigo-300'
                            : 'bg-slate-800/50 text-slate-400'
                        }`}
                      >
                        {w}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {calendarGridCells.map((cellDate, idx) => {
                      if (!cellDate) {
                        return (
                          <div
                            key={`worker-blank-${idx}`}
                            className="min-h-[92px] rounded-xl border border-slate-800/30 bg-slate-950/30"
                          />
                        );
                      }

                      const val = activeWorker.days[cellDate.raw] ?? '';
                      const cat = classifyShiftValue(val);
                      const isEditingThis =
                        editingCell?.matricula === activeWorker.matricula &&
                        editingCell?.date === cellDate.raw;

                      return (
                        <div
                          key={cellDate.raw}
                          onClick={() => {
                            if (!editMode || isEditingThis) return;
                            setEditingCell({
                              matricula: activeWorker.matricula,
                              date: cellDate.raw,
                              value: val,
                            });
                          }}
                          className={`min-h-[92px] rounded-xl border p-2 flex flex-col justify-between transition-all ${
                            cellDate.isWeekend
                              ? 'border-slate-800/90 bg-slate-950/75'
                              : 'border-slate-800/80 bg-slate-900/90'
                          } ${
                            editMode
                              ? 'cursor-pointer hover:border-indigo-500/70'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">
                              {String(cellDate.day).padStart(2, '0')}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {cellDate.weekdayShort}
                            </span>
                          </div>

                          {!isEditingThis ? (
                            <div className="mt-2">
                              <div
                                className={`w-full rounded-lg border px-2 py-1 text-center text-xs font-mono font-semibold ${getShiftBadgeClasses(
                                  cat
                                )}`}
                              >
                                {val || '—'}
                              </div>
                              {cat === 'work' && (
                                <div className="mt-1 text-center text-[10px] font-mono text-slate-400">
                                  {activeWorker.entrada}–{activeWorker.saida}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              className="mt-1 space-y-1"
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
                                    commitInlineEdit(
                                      activeWorker.matricula,
                                      cellDate.raw,
                                      editingCell.value
                                    );
                                  } else if (e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                }}
                                autoFocus
                                className="w-full rounded border border-indigo-500 bg-slate-950 px-1.5 py-0.5 text-center text-xs font-mono text-white"
                              />
                              <div className="flex flex-wrap gap-0.5 justify-center">
                                {['08:48', '07:20', 'FOLGA', 'FÉRIAS'].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() =>
                                      commitInlineEdit(
                                        activeWorker.matricula,
                                        cellDate.raw,
                                        preset
                                      )
                                    }
                                    className="rounded bg-slate-800 px-1 py-0.5 text-[9px] font-mono text-slate-200 hover:bg-indigo-600 cursor-pointer"
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

