import type { SubjectKey } from "./subjects";

export type EventKind = "cours" | "ds" | "kholle" | "autre";

export interface GoogleEventLike {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  status?: string;
  eventType?: string;
  /** Présent sur les événements générés par Google Tasks. */
  taskId?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export interface Override {
  subjectKey?: SubjectKey | null;
  kind?: EventKind | null;
}

export interface Classification {
  kind: EventKind;
  subjectKey: SubjectKey | null;
  dsNumber: number | null;
  isCB: boolean;
  teacher: string | null;
}

export interface ClassifyContext {
  khollesCalendarId: string | null;
  planningCalendarId: string | null;
}

/** Repli par colorId Google (10 → philo par défaut). */
const COLOR_FALLBACK: Record<string, SubjectKey> = {
  "11": "maths",
  "5": "eco",
  "9": "droit",
  "3": "management",
  "7": "anglais",
  "6": "espagnol",
  "10": "philo",
};

function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Règles de mots-clés, dans l'ordre (section 4 de la spec). */
const KEYWORD_RULES: Array<[RegExp, SubjectKey]> = [
  [/\(cervellon\)/, "philo"],
  [/\bgay\b/, "lettres"],
  [/\bphilo/, "philo"],
  [/\blettres\b/, "lettres"],
  [/\bmath/, "maths"],
  // Épreuves de concours sans nom de matière.
  [/\betude de cas\b/, "management"],
  [/\bsynthese\b/, "droit"],
  [/\beco(?:n\w*)?\b/, "eco"],
  [/\besh\b/, "eco"],
  [/\bdroit\b/, "droit"],
  [/\bmanagement\b/, "management"],
  [/\bgest/, "management"],
  [/\banglais\b/, "anglais"],
  [/\blv1\b/, "anglais"],
  [/\bespagnol\b/, "espagnol"],
  [/\blv2\b/, "espagnol"],
  // En dernier recours : le nom du prof (« PMI Annualisation (Le Mintier) »).
  [/\ble ?mintier\b/, "maths"],
  [/\bjacquier\b/, "eco"],
  [/\bhuguet\b/, "droit"],
  [/\(jacques\)/, "management"],
  [/\bdefrance\b/, "anglais"],
  [/\bmayoral\b/, "espagnol"],
];

export function matchSubject(
  title: string,
  colorId: string | undefined,
  override?: Override,
): SubjectKey | null {
  if (override && override.subjectKey !== undefined) return override.subjectKey;
  const t = normalize(title);
  for (const [re, key] of KEYWORD_RULES) if (re.test(t)) return key;
  if (colorId && COLOR_FALLBACK[colorId]) return COLOR_FALLBACK[colorId];
  return null;
}

export function parseDsTitle(title: string): { number: number | null; isCB: boolean } {
  const m = title.match(/n\s*°\s*(\d+)/i);
  return { number: m ? Number(m[1]) : null, isCB: /\bCB\b/.test(title) };
}

/**
 * DS : titre commençant par « DS », ou épreuve numérotée « N°x »
 * (« Synthèse N°2 », « Etude de cas ECT1 N°3 ») — les cours ne sont jamais numérotés.
 */
export function isDsTitle(title: string): boolean {
  return /^\s*DS\b/.test(title) || /\bn\s*°\s*\d+/i.test(title) || /devoir surveill|concours blanc/i.test(title);
}

function extractTeacher(title: string): string | null {
  const m = title.match(/\(([^)]+)\)\s*$/) ?? title.match(/\(([^)]+)\)/);
  return m ? m[1].trim() : null;
}

/**
 * Classe un événement Google. Retourne `null` s'il doit être ignoré
 * (annulé, tâche Google Tasks, événement de notre calendrier « Planning+ »).
 */
export function classifyEvent(
  calendarId: string,
  event: GoogleEventLike,
  ctx: ClassifyContext,
  override?: Override,
): Classification | null {
  if (event.status === "cancelled") return null;
  if (ctx.planningCalendarId && calendarId === ctx.planningCalendarId) return null;
  if (event.taskId) return null; // FOCUS_TIME issu de Google Tasks = le devoir lui-même

  const title = event.summary ?? "";
  const subjectKey = matchSubject(title, event.colorId, override);

  let kind: EventKind;
  let dsNumber: number | null = null;
  let isCB = false;
  let teacher: string | null = null;

  if (ctx.khollesCalendarId && calendarId === ctx.khollesCalendarId) {
    kind = "kholle";
    teacher = extractTeacher(title);
  } else if (isDsTitle(title)) {
    kind = "ds";
    ({ number: dsNumber, isCB } = parseDsTitle(title));
  } else {
    // « Titre de cours connu » = reconnu par mot-clé (ou matière forcée à la main).
    // Une matière déduite de la seule couleur reste un événement « autre ».
    const byTitle = matchSubject(title, undefined) !== null || !!override?.subjectKey;
    kind = subjectKey && byTitle ? "cours" : "autre";
  }

  if (override?.kind) kind = override.kind;
  if (kind === "ds" && dsNumber === null) ({ number: dsNumber, isCB } = parseDsTitle(title));

  return { kind, subjectKey, dsNumber, isCB, teacher };
}
