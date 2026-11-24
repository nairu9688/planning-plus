import type { DateKey } from "./time";

/** Période de vacances : dates civiles incluses (premier et dernier jour sans cours). */
export interface HolidayPeriod {
  name: string;
  start: DateKey;
  end: DateKey;
}

/** Vacances scolaires zone C (académie de Versailles), 2026-2027. */
export const DEFAULT_HOLIDAYS_2026_2027: HolidayPeriod[] = [
  { name: "Toussaint", start: "2026-10-17", end: "2026-11-01" },
  { name: "Noël", start: "2026-12-19", end: "2027-01-03" },
  { name: "Hiver", start: "2027-02-06", end: "2027-02-21" },
  { name: "Printemps", start: "2027-04-03", end: "2027-04-18" },
  { name: "Pont de l'Ascension", start: "2027-05-06", end: "2027-05-09" },
  { name: "Été", start: "2027-07-03", end: "2027-08-31" },
];

export function isHoliday(key: DateKey, holidays: HolidayPeriod[]): boolean {
  return holidays.some((h) => key >= h.start && key <= h.end);
}
