import { dateKey } from "./time";

export interface BadgeHomework {
  subjectId: string | null;
  dueAt: string | null;
  relatedEventId: string | null;
}

export interface BadgeEvent {
  id: string;
  subjectId: string | null;
  kind: string;
  start: string;
}

/**
 * Nombre de devoirs non faits à afficher sur chaque cours : un devoir ne compte que sur le cours
 * où il est à rendre. Cours rattaché s'il y en a un ; sinon le premier cours de la matière le jour
 * de l'échéance (Paris) ; sinon le dernier cours de la matière avant l'échéance.
 */
export function homeworkBadges(homework: BadgeHomework[], events: BadgeEvent[]): Map<string, number> {
  const courses = events.filter((e) => e.kind === "cours" && e.subjectId).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const ids = new Set(events.map((e) => e.id));
  const out = new Map<string, number>();
  const add = (id: string) => out.set(id, (out.get(id) ?? 0) + 1);

  for (const h of homework) {
    if (h.relatedEventId && ids.has(h.relatedEventId)) {
      add(h.relatedEventId);
      continue;
    }
    if (!h.subjectId || !h.dueAt) continue;
    const mine = courses.filter((e) => e.subjectId === h.subjectId);
    const day = dateKey(h.dueAt);
    const sameDay = mine.find((e) => dateKey(e.start) === day);
    const target = sameDay ?? mine.filter((e) => Date.parse(e.start) < Date.parse(h.dueAt!)).at(-1);
    if (target) add(target.id);
  }
  return out;
}
