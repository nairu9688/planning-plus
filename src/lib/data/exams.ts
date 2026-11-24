import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Exam } from "@/lib/domain/targets";
import type { UserContext } from "@/lib/data/context";
import type { SubjectKey } from "@/lib/domain/subjects";
import type { CalendarEvent, Ds, Kholle } from "@/lib/types";

export interface DsWithEvent extends Ds {
  event: CalendarEvent;
}
export interface KholleWithEvent extends Kholle {
  event: CalendarEvent;
}

const EVENT_COLS = "id, google_calendar_id, google_event_id, kind, subject_id, title, location, description, color_id, all_day, start_at, end_at";

export async function loadDs(db: SupabaseClient, userId: string, opts: { from?: Date; to?: Date } = {}) {
  let q = db
    .from("ds")
    .select(`*, event:calendar_events!inner(${EVENT_COLS})`)
    .eq("user_id", userId)
    .eq("event.kind", "ds");
  if (opts.from) q = q.gte("event.start_at", opts.from.toISOString());
  if (opts.to) q = q.lte("event.start_at", opts.to.toISOString());
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as DsWithEvent[]).sort((a, b) => a.event.start_at.localeCompare(b.event.start_at));
}

export async function loadKholles(db: SupabaseClient, userId: string, opts: { from?: Date; to?: Date } = {}) {
  let q = db
    .from("kholles")
    .select(`*, event:calendar_events!inner(${EVENT_COLS})`)
    .eq("user_id", userId)
    .eq("event.kind", "kholle");
  if (opts.from) q = q.gte("event.start_at", opts.from.toISOString());
  if (opts.to) q = q.lte("event.start_at", opts.to.toISOString());
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as KholleWithEvent[]).sort((a, b) => a.event.start_at.localeCompare(b.event.start_at));
}

/** DS et khôlles à venir sous la forme attendue par `resolveTarget`. */
export async function loadUpcomingExams(db: SupabaseClient, ctx: UserContext, from: Date): Promise<Exam[]> {
  const [ds, kh] = await Promise.all([loadDs(db, ctx.userId, { from }), loadKholles(db, ctx.userId, { from })]);
  const keyOf = (id: string | null) => (id ? ((ctx.subjectById.get(id)?.key as SubjectKey) ?? null) : null);
  return [
    ...ds.map((d) => ({ id: d.id, type: "ds" as const, subjectKey: keyOf(d.subject_id), startAt: new Date(d.event.start_at) })),
    ...kh.map((k) => ({ id: k.id, type: "kholle" as const, subjectKey: keyOf(k.subject_id), startAt: new Date(k.event.start_at) })),
  ];
}
