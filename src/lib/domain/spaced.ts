import { addDays, diffDays, type DateKey } from "./time";

/** Intervalles (jours) après chaque passage : J+1, J+3, J+7, puis J+21 indéfiniment. */
export const REVIEW_INTERVALS = [1, 3, 7, 21];

/** Prochaine révision d'un chapitre à partir des jours où il a été travaillé. */
export function nextReview(workedDates: DateKey[]): { date: DateKey; step: number } | null {
  const dates = [...new Set(workedDates)].sort();
  if (!dates.length) return null;
  const step = Math.min(dates.length, REVIEW_INTERVALS.length);
  return { date: addDays(dates[dates.length - 1], REVIEW_INTERVALS[step - 1]), step };
}

export interface DueReview {
  id: string;
  date: DateKey;
  step: number;
  /** > 0 : en retard ; 0 : aujourd'hui ; < 0 : à venir (avec horizon). */
  overdueDays: number;
}

/** Révisions dues au plus tard `today + horizonDays`, triées par retard décroissant. */
export function dueReviews(items: { id: string; workedDates: DateKey[] }[], today: DateKey, horizonDays = 0): DueReview[] {
  const limit = addDays(today, horizonDays);
  return items
    .map((i) => {
      const n = nextReview(i.workedDates);
      return n && { id: i.id, date: n.date, step: n.step, overdueDays: diffDays(today, n.date) };
    })
    .filter((r): r is DueReview => !!r && r.date <= limit)
    .sort((a, b) => b.overdueDays - a.overdueDays || a.id.localeCompare(b.id));
}
