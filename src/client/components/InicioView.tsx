import React, { useMemo } from 'react';
import { getNationalHoliday } from '../holidays.js';
import { classifyShiftValue, type WorkerScheduleRow } from '../types.js';

interface InicioViewProps {
  worker: WorkerScheduleRow | null;
}

interface UpcomingDay {
  raw: string; // DD/MM/YYYY (chave de dataset.dates)
  iso: string; // YYYY-MM-DD (chave de feriados)
  weekday: string;
  dayNumber: number;
  isToday: boolean;
}

const UPCOMING_DAYS = 14;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function buildUpcomingDays(start: Date): UpcomingDay[] {
  const days: UpcomingDay[] = [];
  for (let i = 0; i < UPCOMING_DAYS; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push({
      raw: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
      iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      weekday: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      dayNumber: d.getDate(),
      isToday: i === 0,
    });
  }
  return days;
}

type ShiftTone = 'work' | 'folga' | 'ferias' | 'muted';

function describeShift(worker: WorkerScheduleRow, value: string | undefined): {
  label: string;
  tone: ShiftTone;
} {
  const cat = classifyShiftValue(value);
  if (cat === 'work') {
    const range = worker.entrada && worker.saida ? `${worker.entrada} – ${worker.saida}` : value!;
    return { label: range, tone: 'work' };
  }
  if (cat === 'folga') return { label: 'Folga', tone: 'folga' };
  if (cat === 'ferias') return { label: 'Férias', tone: 'ferias' };
  if (cat === 'atestado') return { label: 'Atestado', tone: 'muted' };
  if (cat === 'feriado') return { label: 'Feriado', tone: 'muted' };
  return { label: 'Sem escala', tone: 'muted' };
}

const TONE_CLASS: Record<ShiftTone, string> = {
  work: 'text-slate-100',
  folga: 'text-blue-300',
  ferias: 'text-purple-300',
  muted: 'text-slate-500',
};

export function InicioView({ worker }: InicioViewProps) {
  const today = useMemo(() => new Date(), []);
  const upcoming = useMemo(() => buildUpcomingDays(today), [today]);

  if (!worker) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
        Selecione um colaborador para ver a sua escala.
      </div>
    );
  }

  const todayLabel = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  // Só a primeira letra em maiúscula (CSS capitalize deixaria "De" maiúsculo)
  const todayLongLabel = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);
  const todayShift = describeShift(worker, worker.days[upcoming[0].raw]);
  const firstName = worker.nome.split(' ')[0];
  const showBreak = todayShift.tone === 'work' && worker.inicioIntervalo && worker.retornoIntervalo;

  return (
    <div className="space-y-3">
      {/* Greeting + today's shift on one line */}
      <section className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-slate-800/90 bg-slate-900/75 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-white">Olá, {firstName}</h2>
          <p className="text-xs text-slate-400">{todayLongLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-slate-400">Hoje</span>
          <span className={`font-bold ${TONE_CLASS[todayShift.tone]}`}>{todayShift.label}</span>
          {showBreak && (
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] text-slate-300">
              Intervalo {worker.inicioIntervalo} – {worker.retornoIntervalo}
            </span>
          )}
        </div>
      </section>

      {/* Next 2 weeks: 2 rows of 7 on wide screens, so the page fits without scrolling */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Próximas 2 semanas
        </h3>
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
          {upcoming.map((day) => {
            const shift = describeShift(worker, worker.days[day.raw]);
            const holiday = getNationalHoliday(day.iso);
            return (
              <li
                key={day.raw}
                className={`flex min-w-0 flex-col gap-1 rounded-xl bg-slate-900/80 p-2.5 ${
                  day.isToday ? 'shadow-[inset_0_3px_0_#fb923c]' : ''
                }`}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-lg font-bold leading-none text-white">{day.dayNumber}</span>
                  <span className="text-[10px] capitalize text-slate-400">
                    {day.isToday ? 'hoje' : day.weekday}
                  </span>
                </div>
                <div className={`truncate text-xs font-medium ${TONE_CLASS[shift.tone]}`}>
                  {shift.label}
                </div>
                {holiday && (
                  <div className="flex items-center gap-1">
                    <span className="rounded bg-emerald-500 px-1 text-[9px] font-bold leading-4 text-emerald-950">
                      +100%
                    </span>
                    <span className="truncate text-[10px] text-slate-400">{holiday}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
