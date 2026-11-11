// Mês selecionado por padrão: o mês atual (ou o mais próximo anterior disponível na escala).
// O mês é reavaliado a cada minuto, então a tela muda sozinha quando o mês vira.
import { useEffect, useState } from 'react';

/** Chave do mês (YYYY-MM) de uma data. */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** O mês desejado se existir na escala; senão o anterior mais próximo; senão o primeiro. */
export function pickMonthKey(keys: string[], wanted: string): string {
  if (keys.includes(wanted)) return wanted;
  const earlier = keys.filter((k) => k < wanted).sort();
  return earlier[earlier.length - 1] ?? keys[0] ?? '';
}

/** Estado do mês selecionado, iniciando e mantendo no mês atual. */
export function useCurrentMonthKey(keys: string[]) {
  const available = keys.join(',');
  const [clockMonth, setClockMonth] = useState<string>(() => currentMonthKey());
  const [selected, setSelected] = useState<string>(() => pickMonthKey(keys, currentMonthKey()));

  useEffect(() => {
    const timer = window.setInterval(() => setClockMonth(currentMonthKey()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelected(pickMonthKey(available.split(',').filter(Boolean), clockMonth));
  }, [available, clockMonth]);

  return [selected, setSelected] as const;
}
