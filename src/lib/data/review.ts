import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionItem } from "@/lib/types";

/**
 * Ouvre le bilan d'une session (idempotent) : fige une copie du prévu et
 * pré-remplit les durées réelles (chrono Focus s'il a servi, sinon durée prévue).
 */
export async function ensureReview(db: SupabaseClient, userId: string, sessionId: string) {
  const { data: existing } = await db.from("session_reviews").select("*").eq("session_id", sessionId).maybeSingle();
  if (existing) return existing;

  const [{ data: items }, { data: s }] = await Promise.all([
    db.from("session_items").select("*").eq("session_id", sessionId).order("sort_order"),
    db.from("study_sessions").select("start_at, end_at, kind").eq("id", sessionId).single(),
  ]);
  const list = (items ?? []) as SessionItem[];
  const ids = list.map((i) => i.id);
  const { data: logs } = ids.length
    ? await db.from("focus_logs").select("session_item_id, started_at, ended_at").in("session_item_id", ids)
    : { data: [] };
  const focus = new Map<string, number>();
  for (const l of logs ?? []) {
    if (!l.ended_at) continue;
    const m = Math.round((new Date(l.ended_at).getTime() - new Date(l.started_at).getTime()) / 60_000);
    focus.set(l.session_item_id, (focus.get(l.session_item_id) ?? 0) + m);
  }

  const { data: created } = await db
    .from("session_reviews")
    .upsert(
      { user_id: userId, session_id: sessionId, planned_snapshot: { session: s, items: list } },
      { onConflict: "session_id", ignoreDuplicates: true },
    )
    .select("*")
    .maybeSingle();

  for (const it of list) {
    if (it.actual_minutes === null) {
      await db.from("session_items").update({ actual_minutes: focus.get(it.id) ?? it.planned_minutes }).eq("id", it.id);
    }
  }
  return created ?? (await db.from("session_reviews").select("*").eq("session_id", sessionId).single()).data;
}
