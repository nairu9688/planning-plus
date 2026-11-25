export interface FillSession {
  id: string;
  start: Date;
  end: Date;
  /** Minutes encore libres dans la session. */
  capacity: number;
}

export interface FillTask {
  key: string;
  minutes: number;
  /** La tâche doit être faite dans une session qui se termine avant cette date. */
  deadline: Date | null;
  /** 0 basse · 1 normale · 2 haute. */
  priority: number;
  /** Les tâches d'un même groupe (ex. morceaux de préparation d'un DS) vont dans des sessions différentes. */
  group?: string;
}

export interface FillResult {
  assignments: { sessionId: string; key: string; minutes: number }[];
  unplaced: string[];
}

const MIN_CHUNK = 20;

/**
 * « Remplis ma semaine » : répartit les tâches dans les sessions prévues.
 * Échéance la plus proche d'abord, puis priorité ; première session libre avant l'échéance ;
 * découpage en morceaux d'au moins 20 min si aucune session ne peut tout contenir.
 */
export function fillWeek(sessions: FillSession[], tasks: FillTask[]): FillResult {
  const free = new Map(sessions.map((s) => [s.id, s.capacity]));
  const ordered = [...sessions].sort((a, b) => a.start.getTime() - b.start.getTime());
  const usedByGroup = new Map<string, Set<string>>();
  const assignments: FillResult["assignments"] = [];
  const unplaced: string[] = [];

  const sortedTasks = [...tasks].sort(
    (a, b) =>
      (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity) ||
      b.priority - a.priority ||
      b.minutes - a.minutes,
  );

  for (const t of sortedTasks) {
    const used = t.group ? (usedByGroup.get(t.group) ?? new Set<string>()) : new Set<string>();
    const candidates = ordered.filter(
      (s) => (!t.deadline || s.end.getTime() <= t.deadline.getTime()) && !used.has(s.id) && (free.get(s.id) ?? 0) > 0,
    );

    const whole = candidates.find((s) => free.get(s.id)! >= t.minutes);
    if (whole) {
      assignments.push({ sessionId: whole.id, key: t.key, minutes: t.minutes });
      free.set(whole.id, free.get(whole.id)! - t.minutes);
      used.add(whole.id);
      if (t.group) usedByGroup.set(t.group, used);
      continue;
    }

    // Découpage : seulement si le temps libre total (en morceaux ≥ 20 min) suffit.
    const chunks = candidates.filter((s) => free.get(s.id)! >= MIN_CHUNK);
    const total = chunks.reduce((a, s) => a + free.get(s.id)!, 0);
    if (total < t.minutes) {
      unplaced.push(t.key);
      continue;
    }
    let left = t.minutes;
    for (const s of chunks) {
      if (left <= 0) break;
      let take = Math.min(left, free.get(s.id)!);
      // Évite de laisser un reliquat inférieur à 20 min pour la suite.
      if (left - take > 0 && left - take < MIN_CHUNK) take = Math.max(MIN_CHUNK, left - MIN_CHUNK);
      assignments.push({ sessionId: s.id, key: t.key, minutes: take });
      free.set(s.id, free.get(s.id)! - take);
      used.add(s.id);
      left -= take;
    }
    if (t.group) usedByGroup.set(t.group, used);
  }
  return { assignments, unplaced };
}
