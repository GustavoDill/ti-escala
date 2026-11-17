// Feriados nacionais, carregados da API do servidor (/api/feriados/:ano).
// Dias marcados aqui recebem a tag "+100%" (bônus), mesmo quando são folga.
// Os dados são carregados antes da primeira renderização (ver App.tsx), então
// getNationalHoliday pode ser usada direto nos componentes.

interface NationalHolidayDto {
  date: string; // YYYY-MM-DD
  name: string;
}

interface HolidaysResponse {
  year: number;
  source: 'brasilapi' | 'fallback' | 'unavailable';
  holidays: NationalHolidayDto[];
}

const holidayNameByDate = new Map<string, string>();
const loadedYears = new Set<number>();

/** Carrega os feriados dos anos informados. Falhas são silenciosas: a tela continua sem tags. */
export async function loadNationalHolidays(years: number[]): Promise<boolean> {
  const missingYears = years.filter((year) => !loadedYears.has(year));
  if (missingYears.length === 0) return false;

  let loadedAny = false;
  await Promise.all(
    missingYears.map(async (year) => {
      loadedYears.add(year);
      try {
        const res = await fetch(`/api/feriados/${year}`);
        if (!res.ok) return;
        const body = (await res.json()) as HolidaysResponse;
        for (const holiday of body.holidays) holidayNameByDate.set(holiday.date, holiday.name);
        if (body.holidays.length > 0) loadedAny = true;
      } catch {
        // Sem rede: as tags de feriado não aparecem, o resto do app funciona normalmente.
      }
    })
  );
  return loadedAny;
}

/** Returns the holiday name for an ISO date (YYYY-MM-DD), or null when it is not a holiday. */
export function getNationalHoliday(isoDate: string): string | null {
  return holidayNameByDate.get(isoDate) ?? null;
}
