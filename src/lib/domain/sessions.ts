import { addDays, parisDateTime, weekdayOf, type DateKey } from "./time";
import { isHoliday, type HolidayPeriod } from "./holidays";
import type { EventKind } from "./classify";

export type SessionKind = "etude" | "maison" | "suggestion" | "bibliotheque" | "sport" | "libre";
export type SessionStatus = "suggeree" | "prevue" | "ignoree" | "bilan_fait";
export type GenerationRule = "soir_etude" | "apres_cours" | "dimanche_sport" | "dimanche_biblio";

export interface TimeRange {
  start: string; // "HH:MM"
  end: string;
}

export interface SessionRules {
  etude: TimeRange;
  maison: TimeRange;
  suggestion: TimeRange;
  sundaySport: TimeRange;
  sundayLibrary: TimeRange;
}

export const DEFAULT_SESSION_RULES: SessionRules = {
  etude: { start: "20:00", end: "21:50" },
  maison: { start: "21:00", end: "23:00" },
  suggestion: { start: "17:20", end: "19:00" },
  sundaySport: { start: "09:00", end: "10:00" },
  sundayLibrary: { start: "10:00", end: "19:00" },
};

export interface BusyEvent {
  kind: EventKind;
  startAt: Date;
  endAt: Date;
}

export interface ExistingGenerated {
  date: DateKey;
  rule: GenerationRule | string;
}

export interface GeneratedSession {
  date: DateKey;
  rule: GenerationRule;
  kind: SessionKind;
  status: SessionStatus;
  startAt: Date;
  endAt: Date;
}

const BLOCKING_KINDS: EventKind[] = ["cours", "ds", "kholle"];

function overlaps(a0: Date, a1: Date, b0: Date, b1: Date) {
  return a0.getTime() < b1.getTime() && b0.getTime() < a1.getTime();
}

/**
 * Génère les sessions automatiques manquantes sur `days` jours à partir de `from`.
 * Idempotent : une session déjà générée (date + règle), quel que soit son statut, n'est jamais recréée.
 */
export function generateSessions(input: {
  from: DateKey;
  days: number;
  rules: SessionRules;
  holidays: HolidayPeriod[];
  events: BusyEvent[];
  existing: ExistingGenerated[];
}): GeneratedSession[] {
  const { from, days, rules, holidays, events, existing } = input;
  const done = new Set(existing.map((e) => `${e.date}|${e.rule}`));
  const out: GeneratedSession[] = [];

  const push = (date: DateKey, rule: GenerationRule, kind: SessionKind, status: SessionStatus, r: TimeRange) => {
    if (done.has(`${date}|${rule}`)) return;
    out.push({ date, rule, kind, status, startAt: parisDateTime(date, r.start), endAt: parisDateTime(date, r.end) });
  };

  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    if (isHoliday(date, holidays)) continue;
    const wd = weekdayOf(date);

    if (wd >= 1 && wd <= 5) {
      push(date, "soir_etude", "etude", "prevue", rules.etude);
      const s0 = parisDateTime(date, rules.suggestion.start);
      const s1 = parisDateTime(date, rules.suggestion.end);
      const busy = events.some((e) => BLOCKING_KINDS.includes(e.kind) && overlaps(s0, s1, e.startAt, e.endAt));
      if (!busy) push(date, "apres_cours", "suggestion", "suggeree", rules.suggestion);
    } else if (wd === 0) {
      push(date, "dimanche_sport", "sport", "suggeree", rules.sundaySport);
      push(date, "dimanche_biblio", "bibliotheque", "suggeree", rules.sundayLibrary);
    }
  }
  return out;
}

/** Nouveaux horaires lors de l'interrupteur étude / maison (les éléments sont conservés). */
export function maisonToggle(date: DateKey, mode: "etude" | "maison", rules: SessionRules) {
  const r = mode === "maison" ? rules.maison : rules.etude;
  return { kind: mode, startAt: parisDateTime(date, r.start), endAt: parisDateTime(date, r.end) } as const;
}

export const SESSION_KIND_LABEL: Record<SessionKind, string> = {
  etude: "étude",
  maison: "maison",
  suggestion: "suggestion",
  bibliotheque: "bibliothèque",
  sport: "sport",
  libre: "libre",
};
