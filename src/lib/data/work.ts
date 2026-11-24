import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkItem } from "@/lib/domain/targets";
import type { SessionItem, StudySession } from "@/lib/types";

export interface ItemWithSession extends SessionItem {
  session: Pick<StudySession, "id" | "date" | "start_at" | "end_at" | "status" | "kind">;
}

/** Éléments de session (hors sessions ignorées / suggérées) entre deux dates civiles. */
export async function loadItemsBetween(db: SupabaseClient, userId: string, fromDate: string, toDate: string) {
  const { data, error } = await db
    .from("session_items")
    .select("*, session:study_sessions!inner(id, date, start_at, end_at, status, kind)")
    .eq("user_id", userId)
    .gte("session.date", fromDate)
    .lte("session.date", toDate)
    .in("session.status", ["prevue", "bilan_fait"]);
  if (error) throw error;
  return (data ?? []) as ItemWithSession[];
}

export function toWorkItems(items: ItemWithSession[]): WorkItem[] {
  return items.map((i) => ({
    targetId: i.target_ds_id ?? i.target_kholle_id,
    sessionStart: new Date(i.session.start_at),
    planned: i.planned_minutes,
    actual: i.actual_minutes,
    reviewed: i.session.status === "bilan_fait",
    removed: i.removed_in_review,
  }));
}

/** Minutes effectives d'un élément : réel si bilan fait, sinon prévu. */
export function effectiveMinutes(i: ItemWithSession) {
  if (i.removed_in_review) return 0;
  return i.session.status === "bilan_fait" ? (i.actual_minutes ?? 0) : i.planned_minutes;
}

export function realMinutes(i: ItemWithSession) {
  if (i.removed_in_review || i.session.status !== "bilan_fait") return 0;
  return i.actual_minutes ?? 0;
}
