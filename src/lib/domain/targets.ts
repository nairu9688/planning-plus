import type { SubjectKey } from "./subjects";

export type TargetChoice = "next_ds" | "next_kholle" | "none" | "auto";
export type Target = "next_ds" | "next_kholle" | "none";

export interface Exam {
  id: string;
  type: "ds" | "kholle";
  subjectKey: SubjectKey | null;
  startAt: Date;
}

export interface ResolvedTarget {
  target: Target;
  dsId: string | null;
  kholleId: string | null;
}

const NONE: ResolvedTarget = { target: "none", dsId: null, kholleId: null };

function nextOf(type: Exam["type"], subjectKey: SubjectKey, after: Date, exams: Exam[]) {
  return exams
    .filter((e) => e.type === type && e.subjectKey === subjectKey && e.startAt.getTime() > after.getTime())
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0];
}

/**
 * Résout la cible d'un élément de session : prochain DS / prochaine khôlle
 * de la matière de l'élément, après le début de la session. `auto` = le plus proche des deux.
 */
export function resolveTarget(
  subjectKey: SubjectKey | null,
  choice: TargetChoice,
  sessionStart: Date,
  exams: Exam[],
): ResolvedTarget {
  if (!subjectKey || choice === "none") return NONE;
  const ds = nextOf("ds", subjectKey, sessionStart, exams);
  const kh = nextOf("kholle", subjectKey, sessionStart, exams);
  const asDs = (): ResolvedTarget => (ds ? { target: "next_ds", dsId: ds.id, kholleId: null } : NONE);
  const asKh = (): ResolvedTarget => (kh ? { target: "next_kholle", dsId: null, kholleId: kh.id } : NONE);

  if (choice === "next_ds") return asDs();
  if (choice === "next_kholle") return asKh();
  if (ds && kh) return kh.startAt.getTime() < ds.startAt.getTime() ? asKh() : asDs();
  return ds ? asDs() : asKh();
}

export interface WorkItem {
  targetId: string | null;
  sessionStart: Date;
  planned: number;
  actual: number | null;
  reviewed: boolean;
  removed: boolean;
}

/** Minutes de travail réel (ou prévu si pas de bilan) ciblant `targetId` sur les 7 derniers jours. */
export function workedMinutesFor(targetId: string, items: WorkItem[], now: Date, days = 7): number {
  const from = now.getTime() - days * 86_400_000;
  return items
    .filter(
      (i) =>
        i.targetId === targetId &&
        !i.removed &&
        i.sessionStart.getTime() >= from &&
        i.sessionStart.getTime() <= now.getTime(),
    )
    .reduce((sum, i) => sum + (i.reviewed ? (i.actual ?? 0) : i.planned), 0);
}

export type PrepStatus = "a_voir" | "vu" | "revu" | "maitrise";
const PREP_WEIGHT: Record<PrepStatus, number> = { a_voir: 0, vu: 0.33, revu: 0.66, maitrise: 1 };

/** Jauge de préparation pondérée (0 → 1), `null` si aucun chapitre au programme. */
export function prepGauge(statuses: PrepStatus[]): number | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((s, st) => s + PREP_WEIGHT[st], 0) / statuses.length;
}
