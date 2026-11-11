import type {
  AuthRole,
  ScheduleDataset,
  ServerSyncStatus,
  WorkerMetadata,
  WorkerScheduleRow,
} from '../server/types.js';

export type {
  AuthRole,
  ScheduleDataset,
  ServerSyncStatus,
  WorkerMetadata,
  WorkerScheduleRow,
};

export type ViewMode = 'home' | 'calendar' | 'compare' | 'grid';

export type ShiftCategory =
  | 'work'
  | 'folga'
  | 'ferias'
  | 'atestado'
  | 'feriado'
  | 'empty';

export interface ParsedDateInfo {
  raw: string; // DD/MM/YYYY
  day: number;
  month: number; // 1..12
  year: number;
  monthKey: string; // YYYY-MM
  monthLabel: string; // Outubro 2026
  weekdayIndex: number; // 0 (Dom) .. 6 (Sáb)
  weekdayShort: string; // Dom, Seg, Ter...
  isWeekend: boolean;
  isoDate: string; // YYYY-MM-DD
}

const WEEKDAY_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const dateCache = new Map<string, ParsedDateInfo>();

export function parseBrDate(raw: string): ParsedDateInfo {
  const cached = dateCache.get(raw);
  if (cached) return cached;

  const parts = raw.trim().split('/');
  const day = Number(parts[0] || 1);
  const month = Number(parts[1] || 1);
  const year = Number(parts[2] || 2026);

  const d = new Date(year, month - 1, day, 12, 0, 0);
  const weekdayIndex = d.getDay();
  const weekdayShort = WEEKDAY_SHORT_PT[weekdayIndex] || '';
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const monthName = MONTH_NAMES_PT[month - 1] || `Mês ${month}`;
  const monthLabel = `${monthName} ${year}`;
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const info: ParsedDateInfo = {
    raw,
    day,
    month,
    year,
    monthKey,
    monthLabel,
    weekdayIndex,
    weekdayShort,
    isWeekend: weekdayIndex === 0 || weekdayIndex === 6,
    isoDate,
  };

  dateCache.set(raw, info);
  return info;
}

export function classifyShiftValue(val: string | undefined): ShiftCategory {
  const clean = (val ?? '').trim().toUpperCase();
  if (!clean) return 'empty';
  if (clean === 'FOLGA') return 'folga';
  if (clean === 'FÉRIAS' || clean === 'FERIAS') return 'ferias';
  if (clean === 'ATESTADO' || clean === 'LICENÇA' || clean === 'LICENCA') return 'atestado';
  if (clean === 'FERIADO') return 'feriado';
  return 'work';
}

export function getShiftBadgeClasses(category: ShiftCategory): string {
  switch (category) {
    case 'work':
      return 'bg-transparent text-slate-300 border-slate-700/60';
    case 'folga':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    case 'ferias':
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    case 'atestado':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    case 'feriado':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    default:
      return 'bg-slate-800/60 text-slate-400 border-slate-700/50';
  }
}

export const QUICK_SHIFT_VALUES = [
  { label: '08:48 (Semana)', value: '08:48', category: 'work' as const },
  { label: '07:20 (Escala)', value: '07:20', category: 'work' as const },
  { label: 'FOLGA', value: 'FOLGA', category: 'folga' as const },
  { label: 'FÉRIAS', value: 'FÉRIAS', category: 'ferias' as const },
  { label: 'ATESTADO', value: 'ATESTADO', category: 'atestado' as const },
  { label: 'FERIADO', value: 'FERIADO', category: 'feriado' as const },
];

