import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dateKey } from "@/lib/domain/time";
import { prepGauge } from "@/lib/domain/targets";
import { effectiveMinutes, type ItemWithSession } from "@/lib/data/work";
import type { Link, PrepTask, PrepTopic } from "@/lib/types";

/** Données communes d'une page DS / khôlle : programme, à faire avant, liens, temps travaillé jour par jour. */
export async function loadExamExtras(db: SupabaseClient, userId: string, type: "ds" | "kholle", id: string, subjectId: string | null) {
  const col = type === "ds" ? "target_ds_id" : "target_kholle_id";
  const [{ data: topics }, { data: tasks }, { data: links }, { data: items }, { data: subjectItems }] = await Promise.all([
    db.from("prep_topics").select("*").eq("target_type", type).eq("target_id", id).order("created_at"),
    db.from("prep_tasks").select("*").eq("target_type", type).eq("target_id", id).order("created_at"),
    db.from("links").select("*").eq("target_type", type).eq("target_id", id),
    db.from("session_items").select("*, session:study_sessions!inner(id, date, start_at, end_at, status, kind)").eq(col, id),
    subjectId ? db.from("subject_items").select("id, type, number, title").eq("subject_id", subjectId).eq("archived", false) : Promise.resolve({ data: [] }),
  ]);
  const perDay = new Map<string, number>();
  for (const i of (items ?? []) as ItemWithSession[]) {
    if (!["prevue", "bilan_fait"].includes(i.session.status)) continue;
    const d = dateKey(i.session.start_at);
    perDay.set(d, (perDay.get(d) ?? 0) + effectiveMinutes(i));
  }
  const t = (topics ?? []) as PrepTopic[];
  return {
    topics: t,
    gauge: prepGauge(t.map((x) => x.status)),
    tasks: (tasks ?? []) as PrepTask[],
    links: (links ?? []) as Link[],
    perDay: [...perDay.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    total: [...perDay.values()].reduce((a, b) => a + b, 0),
    subjectItems: (subjectItems ?? []).map((i) => ({ id: i.id, label: `${i.type}${i.number ? ` ${i.number}` : ""} · ${i.title}` })),
  };
}
