export interface CalendarDayInfo {
  raw: string; // DD/MM/YYYY
  day: number;
  month: number; // 1..12
  year: number;
  monthKey: string; // YYYY-MM
  monthLabel: string; // Dezembro 2026
  weekdayIndex: number; // 0 (Dom) .. 6 (Sáb)
  weekdayShort: string; // Dom, Seg, Ter...
  isWeekend: boolean;
  isoDate: string; // YYYY-MM-DD
}

export interface OutsideMonthCell {
  outsideDay: number;
}

export type CalendarGridCell = CalendarDayInfo | OutsideMonthCell;

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

export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year, month };
}

export function formatMonthLabel(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  const name = MONTH_NAMES_PT[month - 1] || `Mês ${month}`;
  return `${name} ${year}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const { year, month } = parseMonthKey(monthKey);
  const shifted = new Date(year, month - 1 + delta, 1, 12, 0, 0);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

export function buildMonthDays(monthKey: string): CalendarDayInfo[] {
  const { year, month } = parseMonthKey(monthKey);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthLabel = formatMonthLabel(monthKey);
  const normalizedKey = `${year}-${String(month).padStart(2, '0')}`;

  const days: CalendarDayInfo[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day, 12, 0, 0);
    const weekdayIndex = d.getDay();
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    days.push({
      raw: `${dd}/${mm}/${year}`,
      day,
      month,
      year,
      monthKey: normalizedKey,
      monthLabel,
      weekdayIndex,
      weekdayShort: WEEKDAY_SHORT_PT[weekdayIndex] || '',
      isWeekend: weekdayIndex === 0 || weekdayIndex === 6,
      isoDate: `${year}-${mm}-${dd}`,
    });
  }
  return days;
}

export function buildCalendarCells(monthKey: string): CalendarGridCell[] {
  const monthDays = buildMonthDays(monthKey);
  if (monthDays.length === 0) return [];
  const first = monthDays[0];
  const leadingCount = first.weekdayIndex;
  const previousMonthLastDay = new Date(first.year, first.month - 1, 0).getDate();

  const leading: CalendarGridCell[] = Array.from({ length: leadingCount }, (_, i) => ({
    outsideDay: previousMonthLastDay - leadingCount + 1 + i,
  }));
  const trailingCount = (7 - ((leadingCount + monthDays.length) % 7)) % 7;
  const trailing: CalendarGridCell[] = Array.from({ length: trailingCount }, (_, i) => ({
    outsideDay: i + 1,
  }));
  return [...leading, ...monthDays, ...trailing];
}

export function brDateSortKey(raw: string): string {
  const parts = raw.trim().split('/');
  const dd = (parts[0] ?? '01').padStart(2, '0');
  const mm = (parts[1] ?? '01').padStart(2, '0');
  const yyyy = (parts[2] ?? '0000').padStart(4, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function insertDateChronologically(dates: string[], newDate: string): string[] {
  const trimmed = newDate.trim();
  if (!trimmed || dates.includes(trimmed)) return dates;
  return [...dates, trimmed].sort((a, b) => brDateSortKey(a).localeCompare(brDateSortKey(b)));
}
