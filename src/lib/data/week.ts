import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, parisDateTime, type DateKey } from "@/lib/domain/time";
import type { UserContext } from "@/lib/data/context";
import type { CalendarEvent, StudySession } from "@/lib/types";

export interface GridEvent {
  id: string;
  title: string;
  kind: CalendarEvent["kind"];
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  description: string | null;
  color: string | null;
  subjectId: string | null;
  subjectName: string | null;
  href: string | null;
  badge: number;
}

export interface GridSession {
  id: string;
  kind: StudySession["kind"];
  status: StudySession["status"];
  start: string;
  end: string;
  dots: string[];
  label: string;
}

/** Données d'une grille de calendrier (événements + sessions) sur une plage de jours. */
export async function loadGrid(db: SupabaseClient, ctx: UserContext, from: DateKey, days: number) {
  const to = addDays(from, days);
  const [{ data: events }, { data: sessions }, { data: hw }, { data: ds }, { data: kh }] = await Promise.all([
    db
      .from("calendar_events")
      .select("*")
      .eq("user_id", ctx.userId)
      .gte("start_at", parisDateTime(from).toISOString())
      .lt("start_at", parisDateTime(to).toISOString())
      .order("start_at"),
    db
      .from("study_sessions")
      .select("id, kind, status, start_at, end_at, items:session_items(subject_id, removed_in_review)")
      .eq("user_id", ctx.userId)
      .gte("date", from)
      .lt("date", to)
      .neq("status", "ignoree"),
    db.from("homework").select("subject_id").eq("user_id", ctx.userId).neq("status", "fait"),
    db.from("ds").select("id, calendar_event_id").eq("user_id", ctx.userId),
    db.from("kholles").select("id, calendar_event_id").eq("user_id", ctx.userId),
  ]);

  const openBySubject = new Map<string, number>();
  for (const h of hw ?? []) if (h.subject_id) openBySubject.set(h.subject_id, (openBySubject.get(h.subject_id) ?? 0) + 1);
  const dsByEvent = new Map((ds ?? []).map((d) => [d.calendar_event_id, d.id]));
  const khByEvent = new Map((kh ?? []).map((k) => [k.calendar_event_id, k.id]));
  const now = Date.now();

  const gridEvents: GridEvent[] = ((events ?? []) as CalendarEvent[]).map((e) => {
    const s = e.subject_id ? ctx.subjectById.get(e.subject_id) : null;
    const href =
      e.kind === "ds" && dsByEvent.get(e.id) ? `/ds/${dsByEvent.get(e.id)}` : e.kind === "kholle" && khByEvent.get(e.id) ? `/kholles/${khByEvent.get(e.id)}` : null;
    return {
      id: e.id,
      title: e.title,
      kind: e.kind,
      start: e.start_at,
      end: e.end_at,
      allDay: e.all_day,
      location: e.location,
      description: e.description,
      color: s?.color ?? null,
      subjectId: e.subject_id,
      subjectName: s?.name ?? null,
      href,
      badge: e.kind === "cours" && e.subject_id && new Date(e.end_at).getTime() > now ? (openBySubject.get(e.subject_id) ?? 0) : 0,
    };
  });

  const KIND: Record<string, string> = { etude: "Étude", maison: "Maison", suggestion: "Suggestion", bibliotheque: "Bibliothèque", sport: "Sport", libre: "Libre" };
  const gridSessions: GridSession[] = (sessions ?? []).map((s) => {
    const items = (s.items ?? []) as { subject_id: string | null; removed_in_review: boolean }[];
    return {
      id: s.id,
      kind: s.kind,
      status: s.status,
      start: s.start_at,
      end: s.end_at,
      label: KIND[s.kind] ?? s.kind,
      dots: items.filter((i) => !i.removed_in_review && i.subject_id).map((i) => ctx.subjectById.get(i.subject_id!)?.color ?? "#999"),
    };
  });
  return { events: gridEvents, sessions: gridSessions };
}
