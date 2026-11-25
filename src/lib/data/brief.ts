import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/data/context";
import { buildBrief, type BriefEvent } from "@/lib/domain/brief";
import { computeCountdown } from "@/lib/domain/countdown";
import { parseKholleInfo } from "@/lib/domain/kholle";
import { addDays, dateKey, diffDays, parisDateTime, timeKey, weekdayOf } from "@/lib/domain/time";
import { loadDs } from "@/lib/data/exams";
import { env } from "@/lib/env";
import type { CalendarEvent } from "@/lib/types";

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const hh = (iso: string) => timeKey(iso).replace(":", "h");

/** « Philosophie N°2 (anticipée du CB) » → « Philosophie N°2 » ; « Maths Informatique (Le Mintier) » → « Maths Informatique ». */
function spokenTitle(t: string) {
  return t
    .replace(/\s*\([^)]*\)\s*(- .*)?$/, "")
    .replace(/^DS - /, "DS de ")
    .replace(/N°\s*(\d+)/g, "numéro $1")
    .replace(/ - semaine [AB]$/, "")
    .trim();
}

function spokenCountdown(c: { evenings: number; weekends: number; holidayDays: number }) {
  const parts = [`${c.evenings} soir${c.evenings > 1 ? "s" : ""}`];
  if (c.weekends) parts.push(`${c.weekends} week-end${c.weekends > 1 ? "s" : ""}`);
  if (c.holidayDays) parts.push(`${c.holidayDays} jour${c.holidayDays > 1 ? "s" : ""} de vacances`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}` : parts[0];
}

/** Brief vocal d'une journée (aujourd'hui ou demain) : texte pour Siri + données structurées. */
export async function getBrief(db: SupabaseClient, ctx: UserContext, which: "today" | "tomorrow", now = new Date()) {
  const today = dateKey(now);
  const day = which === "today" ? today : addDays(today, 1);
  const from = parisDateTime(day);
  const to = parisDateTime(addDays(day, 1));

  const [{ data: events }, { data: hw }, { data: sessions }, ds] = await Promise.all([
    db.from("calendar_events").select("*").eq("user_id", ctx.userId).gte("start_at", from.toISOString()).lt("start_at", to.toISOString()).neq("kind", "autre").eq("all_day", false).order("start_at"),
    db.from("homework").select("title, subject_id, due_at").eq("user_id", ctx.userId).neq("status", "fait").gte("due_at", from.toISOString()).lt("due_at", to.toISOString()).order("due_at"),
    db.from("study_sessions").select("id, kind, start_at, end_at, items:session_items(id, removed_in_review)").eq("user_id", ctx.userId).eq("date", day).eq("status", "prevue").neq("kind", "sport").order("start_at"),
    loadDs(db, ctx.userId, { from: to }),
  ]);

  const briefEvents: BriefEvent[] = ((events ?? []) as CalendarEvent[]).map((e) => ({
    title: spokenTitle(e.title),
    kind: e.kind,
    start: hh(e.start_at),
    end: hh(e.end_at),
    location: e.location,
    prep: e.kind === "kholle" ? (parseKholleInfo(e.description).prep?.replace(":", "h") ?? null) : null,
  }));
  const s = sessions?.[0];
  const next = ds[0];
  const nextKey = next ? dateKey(next.event.start_at) : null;
  const when = nextKey
    ? diffDays(nextKey, day) < 7
      ? WEEKDAYS[weekdayOf(nextKey)]
      : `le ${Number(nextKey.slice(8))} ${MONTHS[Number(nextKey.slice(5, 7)) - 1]}`
    : "";
  const MODE: Record<string, string> = { etude: "étude", maison: "maison", bibliotheque: "bibliothèque", libre: "libre" };

  const text = buildBrief({
    dayLabel: which === "today" ? "aujourd'hui" : "demain",
    weekday: WEEKDAYS[weekdayOf(day)],
    events: briefEvents,
    homework: (hw ?? []).map((h) => ({ title: h.title, subject: h.subject_id ? (ctx.subjectById.get(h.subject_id)?.name ?? null) : null })),
    session: s ? { mode: MODE[s.kind] ?? s.kind, start: hh(s.start_at), end: hh(s.end_at), items: ((s.items ?? []) as { removed_in_review: boolean }[]).filter((i) => !i.removed_in_review).length } : null,
    nextDs: next ? { title: spokenTitle(next.event.title), when, countdown: spokenCountdown(computeCountdown(now, new Date(next.event.start_at), ctx.holidays)) } : null,
  });
  return { day, text, events: briefEvents, homework: hw?.length ?? 0 };
}

/** Session de ce soir pour le raccourci « Concentration » : heures de début / fin prêtes à l'emploi. */
export async function getTonightForShortcut(db: SupabaseClient, ctx: UserContext, now = new Date()) {
  const today = dateKey(now);
  const { data } = await db
    .from("study_sessions")
    .select("id, kind, start_at, end_at, items:session_items(id, removed_in_review)")
    .eq("user_id", ctx.userId)
    .eq("date", today)
    .eq("status", "prevue")
    .neq("kind", "sport")
    .gt("end_at", now.toISOString())
    .order("start_at")
    .limit(1);
  const s = data?.[0];
  if (!s) return { hasSession: false, active: "non", startsSoon: "non", text: "Pas de session prévue ce soir." };
  const items = ((s.items ?? []) as { removed_in_review: boolean }[]).filter((i) => !i.removed_in_review).length;
  return {
    hasSession: true,
    id: s.id,
    mode: s.kind,
    start: timeKey(s.start_at),
    end: timeKey(s.end_at),
    startISO: s.start_at,
    endISO: s.end_at,
    minutesUntilStart: Math.max(0, Math.round((new Date(s.start_at).getTime() - now.getTime()) / 60000)),
    // Champs texte faciles à comparer dans Raccourcis (« Si … est oui »).
    active: "oui",
    startsSoon: new Date(s.start_at).getTime() - now.getTime() <= 15 * 60_000 ? "oui" : "non",
    endTime: hh(s.end_at),
    focusUrl: `${env.appUrl()}/planner/${s.id}/focus`,
    text: `Session ${s.kind === "maison" ? "maison" : "étude"} de ${hh(s.start_at)} à ${hh(s.end_at)}, ${items} élément${items > 1 ? "s" : ""}. Concentration activée jusqu'à ${hh(s.end_at)}.`,
  };
}
