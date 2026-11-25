import { addDays, type DateKey } from "./time";

/**
 * Série 🔥 : nombre de jours consécutifs avec du travail réel.
 * Aujourd'hui compte s'il y a déjà du travail ; sinon la série jusqu'à hier reste affichée.
 */
export function workStreak(workedDates: DateKey[], today: DateKey) {
  const set = new Set(workedDates);
  const includesToday = set.has(today);
  let days = 0;
  for (let k = includesToday ? today : addDays(today, -1); set.has(k); k = addDays(k, -1)) days++;
  return { days, includesToday };
}
