// Feriados nacionais do Brasil via BrasilAPI (https://brasilapi.com.br/api/feriados/v1/{ano}).
// Respostas ficam em cache por 24h. Se a API estiver indisponível, usa a lista embutida
// (apenas para os anos listados em FALLBACK_HOLIDAYS), para que a tag +100% continue aparecendo.

export interface NationalHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  type: string;
}

export interface NationalHolidaysResult {
  year: number;
  source: 'brasilapi' | 'fallback' | 'unavailable';
  holidays: NationalHoliday[];
}

const BRASILAPI_URL = 'https://brasilapi.com.br/api/feriados/v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

// Lista de contingência (BrasilAPI, 2026). Atualizar ao virar o ano.
const FALLBACK_HOLIDAYS: Record<number, NationalHoliday[]> = {
  2026: [
    { date: '2026-01-01', name: 'Confraternização mundial', type: 'national' },
    { date: '2026-02-16', name: 'Carnaval', type: 'national' },
    { date: '2026-02-17', name: 'Carnaval', type: 'national' },
    { date: '2026-04-03', name: 'Sexta-feira Santa', type: 'national' },
    { date: '2026-04-05', name: 'Páscoa', type: 'national' },
    { date: '2026-04-21', name: 'Tiradentes', type: 'national' },
    { date: '2026-05-01', name: 'Dia do trabalho', type: 'national' },
    { date: '2026-06-04', name: 'Corpus Christi', type: 'national' },
    { date: '2026-09-07', name: 'Independência do Brasil', type: 'national' },
    { date: '2026-10-12', name: 'Nossa Senhora Aparecida', type: 'national' },
    { date: '2026-11-02', name: 'Finados', type: 'national' },
    { date: '2026-11-15', name: 'Proclamação da República', type: 'national' },
    { date: '2026-11-20', name: 'Dia da consciência negra', type: 'national' },
    { date: '2026-12-25', name: 'Natal', type: 'national' },
  ],
};

interface CacheEntry {
  loadedAt: number;
  result: NationalHolidaysResult;
}

const cache = new Map<number, CacheEntry>();

async function fetchFromBrasilApi(year: number): Promise<NationalHoliday[]> {
  const res = await fetch(`${BRASILAPI_URL}/${year}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`BrasilAPI respondeu ${res.status}`);
  const body = (await res.json()) as Array<{ date?: unknown; name?: unknown; type?: unknown }>;
  return body
    .filter((h) => typeof h.date === 'string' && typeof h.name === 'string')
    .map((h) => ({
      date: h.date as string,
      name: h.name as string,
      type: typeof h.type === 'string' ? h.type : 'national',
    }));
}

/** Feriados nacionais de um ano (cache de 24h; contingência embutida se a API falhar). */
export async function getNationalHolidays(year: number): Promise<NationalHolidaysResult> {
  const cached = cache.get(year);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.result;

  let result: NationalHolidaysResult;
  try {
    result = { year, source: 'brasilapi', holidays: await fetchFromBrasilApi(year) };
  } catch (err) {
    const fallback = FALLBACK_HOLIDAYS[year];
    console.warn(`[feriados] BrasilAPI indisponível para ${year}: ${(err as Error).message}`);
    result = fallback
      ? { year, source: 'fallback', holidays: fallback }
      : { year, source: 'unavailable', holidays: [] };
  }

  // Não guarda a contingência por 24h: tenta a API de novo na próxima consulta
  if (result.source === 'brasilapi') cache.set(year, { loadedAt: Date.now(), result });
  return result;
}
