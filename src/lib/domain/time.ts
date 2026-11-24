import { TZDate } from "@date-fns/tz";

export const TZ = "Europe/Paris";

/** "YYYY-MM-DD" (date civile à Paris). */
export type DateKey = string;

/** Instant correspondant à une date + heure civiles à Paris. */
export function parisDateTime(date: DateKey, time = "00:00"): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, TZ).getTime());
}

export function toParis(d: Date | string | number): TZDate {
  return new TZDate(new Date(d).getTime(), TZ);
}

/** Date civile à Paris d'un instant. */
export function dateKey(d: Date | string | number): DateKey {
  const p = toParis(d);
  return `${p.getFullYear()}-${pad(p.getMonth() + 1)}-${pad(p.getDate())}`;
}

/** "HH:MM" à Paris. */
export function timeKey(d: Date | string | number): string {
  const p = toParis(d);
  return `${pad(p.getHours())}:${pad(p.getMinutes())}`;
}

/** 0 = dimanche … 6 = samedi, à Paris. */
export function weekdayOf(key: DateKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(key: DateKey, n: number): DateKey {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function diffDays(a: DateKey, b: DateKey): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(pa[0], pa[1] - 1, pa[2]) - Date.UTC(pb[0], pb[1] - 1, pb[2])) / 86_400_000,
  );
}

/** Lundi de la semaine ISO contenant la date. */
export function mondayOf(key: DateKey): DateKey {
  const wd = weekdayOf(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

/** Semaine A/B par parité de semaines depuis la semaine de référence (A). */
export function weekLetter(key: DateKey, weekAReference: DateKey): "A" | "B" {
  const weeks = Math.round(diffDays(mondayOf(key), mondayOf(weekAReference)) / 7);
  return Math.abs(weeks) % 2 === 0 ? "A" : "B";
}

export function minutesBetween(a: Date | string, b: Date | string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
