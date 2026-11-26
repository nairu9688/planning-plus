/**
 * Focus libre : à quelle session rattacher le travail ? Le Focus libre ne crée pas une session
 * de plus quand il y en a déjà une ce soir : il ajoute une matière à la session en cours,
 * ou à la plus proche (30 min avant son début → 1 h 30 après sa fin), même si son bilan est fait.
 */
export interface HostCandidate {
  id: string;
  kind: string;
  status: string;
  start: string;
  end: string;
  /** Session créée par un Focus libre précédent. */
  free: boolean;
}

const BEFORE_MS = 30 * 60_000;
const AFTER_MS = 90 * 60_000;
/** Une session « Focus libre » récente est réutilisée pendant 3 h. */
const FREE_REUSE_MS = 3 * 3600_000;

export function pickHostSession(sessions: HostCandidate[], now: Date): string | null {
  const t = now.getTime();
  const usable = sessions.filter((s) => s.kind !== "sport" && s.kind !== "suggestion" && (s.status === "prevue" || s.status === "bilan_fait"));
  const dist = (s: HostCandidate) => {
    const a = Date.parse(s.start);
    const b = Date.parse(s.end);
    return t < a ? a - t : t > b ? t - b : 0;
  };
  const real = usable
    .filter((s) => !s.free && Date.parse(s.start) - BEFORE_MS <= t && t <= Date.parse(s.end) + AFTER_MS)
    .sort((x, y) => dist(x) - dist(y) || Date.parse(y.start) - Date.parse(x.start));
  if (real.length) {
    // À distance égale (ex. entre deux sessions), la session en cours gagne ; sinon la plus proche.
    return real[0].id;
  }
  const free = usable.filter((s) => s.free && t - Date.parse(s.end) <= FREE_REUSE_MS && Date.parse(s.start) - BEFORE_MS <= t).sort((x, y) => dist(x) - dist(y));
  return free[0]?.id ?? null;
}

const CAP_AFTER_END_MS = 30 * 60_000;
const CAP_NO_SESSION_MIN = 240;

/** Minutes à compter pour un chrono arrêté à `stop` : plafonnées si le chrono a été oublié. */
export function capFocusMinutes(start: Date, stop: Date, sessionEnd: Date | null): number {
  let end = stop.getTime();
  if (sessionEnd) end = Math.min(end, Math.max(sessionEnd.getTime() + CAP_AFTER_END_MS, start.getTime() + 60_000));
  const min = Math.round((end - start.getTime()) / 60_000);
  return Math.max(1, sessionEnd ? min : Math.min(min, CAP_NO_SESSION_MIN));
}
