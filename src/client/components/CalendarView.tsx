import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Coffee,
  Edit3,
  User,
  Users,
  Check,
  X,
  ChevronLeft,
} from 'lucide-react';
import { getNationalHoliday } from '../holidays.js';
import { currentMonthKey, pickMonthKey } from '../monthSync.js';
import {
  classifyShiftValue,
  getShiftBadgeClasses,
  parseBrDate,
  QUICK_SHIFT_VALUES,
  type ParsedDateInfo,
  type ShiftCategory,
  type WorkerScheduleRow,
} from '../types.js';

// Today's date as DD/MM/YYYY (the format of dataset dates) and as a YYYY-MM month key
function todayBrDate(now: Date = new Date()): string {
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

interface CalendarViewProps {
  workers: WorkerScheduleRow[];
  dates: string[];
  editMode: boolean;
  onCellEdit: (matricula: string, date: string, newValue: string) => void;
  whoami?: string | null;
  onWhoamiChange?: (matricula: string) => void;
}

// Drawer roster: grouped by função (N1, N2, N3), each group ordered by shift period and start time
interface RosterGroup {
  funcao: string;
  count: number; // staff working that day
  workers: WorkerScheduleRow[];
}

const PERIOD_LABELS = ['Manhã', 'Tarde', 'Noite', 'Madrugada', '—'] as const;

// 0 manhã (06–11h), 1 tarde (12–17h), 2 noite (18–23h), 3 madrugada (00–05h), 4 unknown
function periodIndex(entrada: string): number {
  const hour = parseInt(entrada.split(':')[0] ?? '', 10);
  if (Number.isNaN(hour)) return 4;
  if (hour >= 6 && hour < 12) return 0;
  if (hour >= 12 && hour < 18) return 1;
  if (hour >= 18) return 2;
  return 3;
}

// Outline colour per função, matching the N1 / N2 / N3 counts in the team grid
const ROSTER_GROUP_STYLE: Record<string, { border: string; text: string }> = {
  N1: { border: 'border-amber-500/60 bg-amber-500/5', text: 'text-amber-300' },
  N2: { border: 'border-cyan-500/60 bg-cyan-500/5', text: 'text-cyan-300' },
  N3: { border: 'border-rose-500/60 bg-rose-500/5', text: 'text-rose-300' },
};
const DEFAULT_GROUP_STYLE = { border: 'border-slate-700 bg-slate-950/40', text: 'text-slate-300' };

function rosterGroupStyle(funcao: string) {
  return ROSTER_GROUP_STYLE[funcao] ?? DEFAULT_GROUP_STYLE;
}

function buildRosterGroups(workers: WorkerScheduleRow[], date: string): RosterGroup[] {
  const byFuncao = new Map<string, WorkerScheduleRow[]>();
  for (const w of workers) {
    const key = w.funcao || '—';
    byFuncao.set(key, [...(byFuncao.get(key) ?? []), w]);
  }
  const roleRank = (funcao: string) => (/^Nd$/.test(funcao) ? Number(funcao.slice(1)) : 99);
  const funcoes = [...byFuncao.keys()].sort((a, b) => roleRank(a) - roleRank(b) || a.localeCompare(b, 'pt-BR'));
  return funcoes.map((funcao) => {
    const members = byFuncao.get(funcao) ?? [];
    const working = members
      .filter((w) => classifyShiftValue(w.days[date]) === 'work')
      .sort(
        (a, b) =>
          periodIndex(a.entrada) - periodIndex(b.entrada) ||
          a.entrada.localeCompare(b.entrada) ||
          a.nome.localeCompare(b.nome, 'pt-BR')
      );
    const off = members
      .filter((w) => classifyShiftValue(w.days[date]) !== 'work')
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return { funcao, count: working.length, workers: [...working, ...off] };
  });
}

// Day of the previous or next month shown only to complete the grid (no schedule data)
// Per-worker day cell: the status fills the whole square (folga blue, férias purple, work neutral)
function workerCellClasses(cat: ShiftCategory, isWeekend: boolean, isToday: boolean): string {
  if (isToday) return 'border-orange-400 ring-2 ring-orange-400 bg-orange-500/10 text-slate-100';
  switch (cat) {
    case 'folga':
      return 'border-blue-500/60 bg-blue-500/25 text-blue-100';
    case 'ferias':
      return 'border-purple-500/60 bg-purple-500/25 text-purple-100';
    case 'atestado':
      return 'border-rose-500/60 bg-rose-500/20 text-rose-100';
    case 'feriado':
      return 'border-emerald-500/60 bg-emerald-500/20 text-emerald-100';
    case 'work':
      return isWeekend
        ? 'border-slate-800/90 bg-slate-950/75 text-slate-300'
        : 'border-slate-800/80 bg-slate-900/90 text-slate-300';
    default:
      return 'border-slate-800/60 bg-slate-950/60 text-slate-500';
  }
}

interface OutsideDay {
  outsideDay: number;
}

type GridCell = ParsedDateInfo | OutsideDay;

// Holiday tag: paid at +100%, shown even when the day is a folga
function HolidayTag({ isoDate }: { isoDate: string }) {
  if (!getNationalHoliday(isoDate)) return null;
  return (
    <span className="rounded bg-emerald-500 px-0.5 text-[8px] font-bold leading-4 text-emerald-950 sm:px-1 sm:text-[9px]">
      +100%
    </span>
  );
}

const WEEKDAYS_HEADER = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CalendarView({
  workers,
  dates,
  editMode,
  onCellEdit,
  whoami,
  onWhoamiChange,
}: CalendarViewProps) {
  const [calendarSubMode, setCalendarSubMode] = useState<'team' | 'worker'>('worker');
  const [selectedWorkerMatricula, setSelectedWorkerMatricula] = useState<string>(
    () => workers.find((w) => w.matricula === whoami)?.matricula || workers[0]?.matricula || ''
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // The calendar always opens on the current month (or the closest one in the schedule)
  const availableMonthKeys = months.map((m) => m.key).join(',');
  const [clockMonth, setClockMonth] = useState<string>(() => currentMonthKey());
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() =>
    pickMonthKey(months.map((m) => m.key), currentMonthKey())
  );

  const activeMonth = useMemo(() => {
    return months.find((m) => m.key === selectedMonthKey) || months[0] || null;
  }, [months, selectedMonthKey]);

  const [selectedDateRaw, setSelectedDateRaw] = useState<string>(() =>
    dates.includes(todayBrDate()) ? todayBrDate() : activeMonth?.dates[0]?.raw || dates[0] || ''
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
      sortedWorkers.find((w) => w.matricula === (whoami ?? selectedWorkerMatricula)) ||
      sortedWorkers[0] ||
      null
    );
  }, [sortedWorkers, selectedWorkerMatricula, whoami]);

  // Grid cells for the active month, padded with grayed days from the previous and next month
  const calendarGridCells = useMemo<GridCell[]>(() => {
    if (!activeMonth || activeMonth.dates.length === 0) return [];
    const first = activeMonth.dates[0];
    const leadingCount = first.weekdayIndex;
    const previousMonthLastDay = new Date(first.year, first.month - 1, 0).getDate();
    const leading: GridCell[] = Array.from({ length: leadingCount }, (_, i) => ({
      outsideDay: previousMonthLastDay - leadingCount + 1 + i,
    }));
    const trailingCount = (7 - ((leadingCount + activeMonth.dates.length) % 7)) % 7;
    const trailing: GridCell[] = Array.from({ length: trailingCount }, (_, i) => ({
      outsideDay: i + 1,
    }));
    return [...leading, ...activeMonth.dates, ...trailing];
  }, [activeMonth]);

  // Today's date in DD/MM/YYYY, to highlight it in the grid
  const todayRaw = useMemo(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }, []);

  // Keep the calendar on the current month: re-check every minute, so it also moves on at midnight
  useEffect(() => {
    const timer = window.setInterval(() => setClockMonth(currentMonthKey()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedMonthKey(pickMonthKey(availableMonthKeys.split(',').filter(Boolean), clockMonth));
    if (dates.includes(todayBrDate())) setSelectedDateRaw(todayBrDate());
    // availableMonthKeys / clockMonth change only when the schedule's months or the calendar month change
  }, [availableMonthKeys, clockMonth]);

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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/90 bg-slate-900/75 p-2.5">
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
          <div className="lg:col-span-12 rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 isolated-section">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                Visão Mensal — {activeMonth.label}
              </h2>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full border border-slate-500" /> Trabalho
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-400" /> Folga
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-purple-400" /> Férias
                </span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
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

            <div className="grid grid-cols-7 gap-1">
              {calendarGridCells.map((cellDate, idx) => {
                if ('outsideDay' in cellDate) {
                  return (
                    <div
                      key={`outside-${idx}`}
                      className="min-h-[56px] p-1.5 text-sm font-medium text-slate-600"
                    >
                      {cellDate.outsideDay}
                    </div>
                  );
                }

                // Working staff per função (N1 / N2 / N3) on this day
                const roleCounts = { N1: 0, N2: 0, N3: 0 };

                for (const w of sortedWorkers) {
                  if (classifyShiftValue(w.days[cellDate.raw]) !== 'work') continue;
                  if (w.funcao in roleCounts) roleCounts[w.funcao as keyof typeof roleCounts]++;
                }

                const isSelected = cellDate.raw === effectiveSelectedDate;

                return (
                  <button
                    key={cellDate.raw}
                    type="button"
                    onClick={() => {
                      setSelectedDateRaw(cellDate.raw);
                      setDrawerOpen(true);
                    }}
                    className={`group relative min-h-[56px] rounded-xl border p-1.5 text-left transition-all flex flex-col justify-between cursor-pointer ${
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
                          cellDate.raw === todayRaw
                            ? 'rounded-full bg-orange-400 text-slate-950'
                            : isSelected
                            ? 'bg-indigo-500 text-white'
                            : cellDate.isWeekend
                            ? 'text-indigo-300 bg-indigo-500/10'
                            : 'text-slate-200'
                        }`}
                      >
                        {String(cellDate.day).padStart(2, '0')}
                      </span>
                      <span className="flex items-center gap-1">
                        <HolidayTag isoDate={cellDate.isoDate} />
                        <span className="hidden text-[10px] font-mono text-slate-500 sm:inline">
                          {cellDate.raw.slice(0, 5)}
                        </span>
                      </span>
                    </div>

                    <div className="mt-1 flex w-full items-center justify-between pr-0 font-mono text-[11px] font-bold sm:pr-3">
                      <span className="text-amber-300" title="N1" aria-label={`N1: ${roleCounts.N1}`}><span className="hidden sm:inline">N1 </span>{roleCounts.N1}</span>
                      <span className="text-cyan-300" title="N2" aria-label={`N2: ${roleCounts.N2}`}><span className="hidden sm:inline">N2 </span>{roleCounts.N2}</span>
                      <span className="text-rose-300" title="N3" aria-label={`N3: ${roleCounts.N3}`}><span className="hidden sm:inline">N3 </span>{roleCounts.N3}</span>
                    </div>
                    <ChevronLeft
                      className="pointer-events-none absolute bottom-1 right-1 hidden h-4 w-4 text-slate-300 sm:block transition-transform group-hover:-translate-x-0.5 group-hover:text-indigo-300"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Roster & Inline Editor (4 cols) */}
          {drawerOpen && (
            <>
              <div className="animate-backdrop-in fixed inset-0 z-40 bg-slate-950/60" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
              <aside
                role="dialog"
                aria-modal="true"
                aria-label={`Escala do dia ${effectiveSelectedDate}`}
                className="animate-drawer-in fixed inset-y-0 right-0 z-50 flex w-[400px] max-w-full flex-col border-l border-slate-800 bg-slate-900 p-4 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Fechar painel do dia"
                  className="absolute right-3 top-3 rounded-lg border border-slate-700 px-2 py-0.5 text-sm text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  ×
                </button>
            <div className="border-b border-slate-800 pb-3 mb-3 pr-8">
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
              {buildRosterGroups(sortedWorkers, effectiveSelectedDate).map((group) => (
              <section
                key={group.funcao}
                aria-label={`${group.funcao}: ${group.count} trabalhando`}
                className={`space-y-2 rounded-xl border-2 p-2 ${rosterGroupStyle(group.funcao).border}`}
              >
                <header className="flex items-center justify-between px-1 text-xs">
                  <span className={`font-bold ${rosterGroupStyle(group.funcao).text}`}>{group.funcao}</span>
                  <span className="text-slate-400">{group.count} trabalhando</span>
                </header>
                {group.workers.map((w) => {
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
                            <span className="text-slate-500">· {PERIOD_LABELS[periodIndex(w.entrada)]}</span>
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
              </section>
            ))}
            </div>
              </aside>
            </>
          )}
        </div>
      ) : (
        /* Per-Worker Individual Calendar View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Individual Worker Calendar & Shift Details (8 cols) */}
          <div className="lg:col-span-12 space-y-2">
            {activeWorker ? (
              <>
                {/* Worker Shift Profile Card */}
                <div className="rounded-xl border border-slate-800/90 bg-slate-900/75 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
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
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-center">
                        <div className="text-base font-bold font-mono text-emerald-300">
                          {workerMonthStats.work}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-emerald-200/80">
                          Dias Trab.
                        </div>
                      </div>
                      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-center">
                        <div className="text-base font-bold font-mono text-blue-300">
                          {workerMonthStats.folga}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-blue-200/80">
                          Folgas
                        </div>
                      </div>
                      <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-center">
                        <div className="text-base font-bold font-mono text-purple-300">
                          {workerMonthStats.ferias}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-purple-200/80">
                          Férias
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Worker Monthly Calendar Grid */}
                <div className="flex min-h-[240px] h-[calc(100vh-18rem)] flex-col rounded-xl border border-slate-800/90 bg-slate-900/70 p-2">
                  <div className="mb-1 grid grid-cols-7 gap-1 text-center">
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

                  <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[repeat(6,minmax(36px,1fr))] gap-1">
                    {calendarGridCells.map((cellDate, idx) => {
                      if ('outsideDay' in cellDate) {
                        return (
                          <div
                            key={`worker-outside-${idx}`}
                            className="min-h-[56px] p-1.5 text-sm font-medium text-slate-600"
                          >
                            {cellDate.outsideDay}
                          </div>
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
                          className={`relative flex min-h-[36px] flex-col overflow-hidden rounded-xl border transition-all ${workerCellClasses(cat, cellDate.isWeekend, cellDate.raw === todayRaw)} ${
                            editMode ? 'cursor-pointer hover:brightness-125' : ''
                          }`}
                        >
                          {/* Day number and holiday / weekday sit on top of the status fill */}
                          <div className="pointer-events-none absolute inset-x-1 top-0.5 z-10 flex h-4 items-center justify-between leading-4">
                            <span
                              className={
                                cellDate.raw === todayRaw
                                  ? 'inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-400 px-1 text-[10px] font-extrabold leading-none text-slate-950'
                                  : 'text-xs font-bold text-slate-100'
                              }
                            >
                              {String(cellDate.day).padStart(2, '0')}
                            </span>
                            {getNationalHoliday(cellDate.isoDate) ? (
                              <HolidayTag isoDate={cellDate.isoDate} />
                            ) : (
                              <span
                                className={`hidden truncate text-[10px] font-mono sm:inline ${
                                  cellDate.raw === todayRaw ? 'font-bold text-orange-300' : 'opacity-70'
                                }`}
                              >
                                {cellDate.raw === todayRaw ? 'Hoje' : cellDate.weekdayShort}
                              </span>
                            )}
                          </div>

                          {!isEditingThis ? (
                            <div className="flex flex-1 items-center justify-center px-0.5 pt-4 font-mono text-[10px] font-bold sm:px-1 sm:text-sm">
                              {val || '—'}
                            </div>
                          ) : (
                            <div
                              className="flex flex-1 flex-col justify-center gap-1 px-1 pt-5 pb-1"
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

