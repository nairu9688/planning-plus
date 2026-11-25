import { dateKey, parisDateTime } from "./time";

export interface KholleInfo {
  /** Heure de préparation "HH:MM", ou null. */
  prep: string | null;
  start: string | null;
  end: string | null;
  noPrep: boolean;
  week: string | null;
}

function hhmm(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${(m[2] ?? "00").padStart(2, "0")}`;
}

/** Lit « Préparation : 17h10 — Début de la khôlle : 17h30 — Fin : 18h30 (semaine S4) ». */
export function parseKholleInfo(description: string | null | undefined): KholleInfo {
  const d = description ?? "";
  const grab = (re: RegExp) => hhmm(d.match(re)?.[1]);
  return {
    prep: grab(/pr[ée]paration\s*:\s*([0-9][0-9 h:]*)/i),
    start: grab(/d[ée]but(?: de la kh[ôo]lle)?\s*:\s*([0-9][0-9 h:]*)/i),
    end: grab(/fin\s*:\s*([0-9][0-9 h:]*)/i),
    noPrep: /pas de pr[ée]paration/i.test(d),
    week: d.match(/semaine\s+(S\d+)/i)?.[1] ?? null,
  };
}

/** Moment du rappel : `minutesBefore` avant la préparation, sinon avant le début de la khôlle. */
export function kholleReminderAt(eventStart: Date, description: string | null | undefined, minutesBefore = 30): Date {
  const info = parseKholleInfo(description);
  const day = dateKey(eventStart);
  const anchor = info.prep ? parisDateTime(day, info.prep) : info.start ? parisDateTime(day, info.start) : eventStart;
  return new Date(anchor.getTime() - minutesBefore * 60_000);
}
