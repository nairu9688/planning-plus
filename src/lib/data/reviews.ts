import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/data/context";
import { dueReviews, type DueReview } from "@/lib/domain/spaced";
import { dateKey } from "@/lib/domain/time";
import type { Subject } from "@/lib/types";

export interface SpacedReview extends DueReview {
  itemId: string;
  title: string;
  type: string;
  number: number | null;
  subject: Subject | null;
}

/**
 * Révisions espacées dues : un chapitre (élément de matière) travaillé en session
 * revient à J+1, J+3, J+7 puis J+21 après son dernier passage.
 */
export async function loadSpacedReviews(db: SupabaseClient, ctx: UserContext, horizonDays = 0, now = new Date()): Promise<SpacedReview[]> {
  const [{ data: items }, { data: work }] = await Promise.all([
    db.from("subject_items").select("id, subject_id, title, type, number, last_worked_at").eq("user_id", ctx.userId).eq("archived", false),
    db
      .from("session_items")
      .select("subject_item_id, actual_minutes, planned_minutes, removed_in_review, session:study_sessions!inner(start_at, status)")
      .eq("user_id", ctx.userId)
      .not("subject_item_id", "is", null)
      .eq("session.status", "bilan_fait"),
  ]);
  const dates = new Map<string, string[]>();
  for (const w of work ?? []) {
    const s = w.session as unknown as { start_at: string };
    if (w.removed_in_review || (w.actual_minutes ?? 0) <= 0) continue;
    dates.set(w.subject_item_id!, [...(dates.get(w.subject_item_id!) ?? []), dateKey(s.start_at)]);
  }
  // Un chapitre marqué travaillé sans session (import, saisie) compte aussi.
  for (const i of items ?? []) {
    if (i.last_worked_at && !dates.has(i.id)) dates.set(i.id, [dateKey(i.last_worked_at)]);
  }
  const byId = new Map((items ?? []).map((i) => [i.id, i]));
  return dueReviews(
    [...dates.entries()].filter(([id]) => byId.has(id)).map(([id, workedDates]) => ({ id, workedDates })),
    dateKey(now),
    horizonDays,
  ).map((r) => {
    const i = byId.get(r.id)!;
    return { ...r, itemId: i.id, title: i.title, type: i.type, number: i.number, subject: ctx.subjectById.get(i.subject_id) ?? null };
  });
}
