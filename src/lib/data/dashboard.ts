import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, dateKey, diffDays, mondayOf, parisDateTime, weekLetter } from "@/lib/domain/time";
import { computeCountdown, formatCountdown, type Countdown } from "@/lib/domain/countdown";
import { prepGauge, workedMinutesFor, type PrepStatus } from "@/lib/domain/targets";
import type { UserContext } from "@/lib/data/context";
import { loadDs, loadKholles, type DsWithEvent, type KholleWithEvent } from "@/lib/data/exams";
import { effectiveMinutes, loadItemsBetween, realMinutes, toWorkItems, type ItemWithSession } from "@/lib/data/work";
import type { CbPeriod, Homework, Note, PrepTask, StudySession, SessionItem } from "@/lib/types";

export interface ExamCard {
  id: string;
  type: "ds" | "kholle";
  title: string;
  start: string;
  subjectId: string | null;
  countdown: Countdown;
  gauge: number | null;
  worked7d: number;
  href: string;
  location: string | null;
}

export interface CbCard {
  period: CbPeriod;
  first: string;
  last: string;
  exams: { title: string; start: string; subjectId: string | null }[];
  countdown: Countdown;
}

export interface DeadlineRow {
  kind: "ds" | "kholle" | "homework";
  id: string;
  title: string;
  at: string | null;
  subjectId: string | null;
  href: string;
  worked7d?: number;
  status?: string;
  gauge?: number | null;
  countdownText?: string;
  location?: string | null;
  priority?: string;
}

/** Charge les données des cartes DS / khôlles (compte à rebours, jauge, travail 7 j). */
export async function examCards(db: SupabaseClient, ctx: UserContext, ds: DsWithEvent[], kh: KholleWithEvent[], now: Date) {
  const ids = [...ds.map((d) => d.id), ...kh.map((k) => k.id)];
  const [{ data: topics }, items] = await Promise.all([
    ids.length ? db.from("prep_topics").select("target_id, status").in("target_id", ids) : Promise.resolve({ data: [] }),
    loadItemsBetween(db, ctx.userId, addDays(dateKey(now), -8), dateKey(now)),
  ]);
  const work = toWorkItems(items);
  const statuses = new Map<string, PrepStatus[]>();
  for (const t of topics ?? []) statuses.set(t.target_id, [...(statuses.get(t.target_id) ?? []), t.status]);
  const card = (type: "ds" | "kholle", x: DsWithEvent | KholleWithEvent): ExamCard => ({
    id: x.id,
    type,
    title: x.event.title,
    start: x.event.start_at,
    subjectId: x.subject_id,
    countdown: computeCountdown(now, new Date(x.event.start_at), ctx.holidays),
    gauge: prepGauge(statuses.get(x.id) ?? []),
    worked7d: workedMinutesFor(x.id, work, now),
    href: type === "ds" ? `/ds/${x.id}` : `/kholles/${x.id}`,
    location: x.event.location,
  });
  return { ds: ds.map((d) => card("ds", d)), kholles: kh.map((k) => card("kholle", k)) };
}

export async function loadDashboard(db: SupabaseClient, ctx: UserContext, now = new Date()) {
  const today = dateKey(now);
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const horizon = parisDateTime(addDays(today, 21));
  const lastMonday = addDays(monday, -7);

  const [dsAll, khAll, { data: periods }, { data: homework }, { data: notes }, weekItems, lastWeekItems, { data: weekSessions }, { data: tonight }] =
    await Promise.all([
      loadDs(db, ctx.userId, { from: now }),
      loadKholles(db, ctx.userId, { from: now }),
      db.from("cb_periods").select("*").eq("user_id", ctx.userId),
      db.from("homework").select("*").eq("user_id", ctx.userId).neq("status", "fait").order("due_at", { ascending: true, nullsFirst: false }),
      db.from("notes").select("*").eq("user_id", ctx.userId).eq("done", false).order("pinned", { ascending: false }).order("created_at", { ascending: false }),
      loadItemsBetween(db, ctx.userId, monday, sunday),
      loadItemsBetween(db, ctx.userId, lastMonday, addDays(monday, -1)),
      db.from("study_sessions").select("id, date, status, start_at, end_at, kind").eq("user_id", ctx.userId).gte("date", lastMonday).lte("date", sunday),
      db
        .from("study_sessions")
        .select("*, items:session_items(*)")
        .eq("user_id", ctx.userId)
        .eq("date", today)
        .in("kind", ["etude", "maison"])
        .neq("status", "ignoree")
        .order("start_at")
        .limit(1),
    ]);

  const upcomingDs = dsAll.filter((d) => new Date(d.event.start_at) <= horizon || d.cb_period_id);
  const upcomingKh = khAll.filter((k) => new Date(k.event.start_at) <= horizon);
  const cards = await examCards(db, ctx, upcomingDs, upcomingKh, now);

  // Prochaine période de CB (dont la première épreuve est à venir ou en cours).
  let cb: CbCard | null = null;
  for (const p of (periods ?? []) as CbPeriod[]) {
    const exams = dsAll.filter((d) => d.cb_period_id === p.id);
    if (!exams.length) continue;
    const first = exams[0].event.start_at;
    if (!cb || first < cb.first) {
      cb = {
        period: p,
        first,
        last: exams[exams.length - 1].event.start_at,
        exams: exams.map((e) => ({ title: e.event.title, start: e.event.start_at, subjectId: e.subject_id })),
        countdown: computeCountdown(now, new Date(first), ctx.holidays),
      };
    }
  }

  // Travail de la semaine : réel / prévu, % de semaine écoulée.
  const planned = weekItems.filter((i) => i.origin === "prevu").reduce((s, i) => s + i.planned_minutes, 0);
  const real = weekItems.reduce((s, i) => s + realMinutes(i), 0);
  const weekStart = parisDateTime(monday).getTime();
  const weekPct = Math.min(1, Math.max(0, (now.getTime() - weekStart) / (7 * 86_400_000)));

  // Échéances des 3 prochaines semaines.
  const hw = (homework ?? []) as Homework[];
  const deadlines: DeadlineRow[] = [
    ...cards.ds.filter((d) => new Date(d.start) <= horizon).map((d) => ({ kind: "ds" as const, id: d.id, title: d.title, at: d.start, subjectId: d.subjectId, href: d.href, worked7d: d.worked7d, gauge: d.gauge, countdownText: formatCountdown(d.countdown), location: d.location })),
    ...cards.kholles.map((k) => ({ kind: "kholle" as const, id: k.id, title: k.title, at: k.start, subjectId: k.subjectId, href: k.href, worked7d: k.worked7d, gauge: k.gauge, countdownText: formatCountdown(k.countdown), location: k.location })),
    ...hw.filter((h) => h.due_at && new Date(h.due_at) <= horizon).map((h) => ({ kind: "homework" as const, id: h.id, title: h.title, at: h.due_at, subjectId: h.subject_id, href: `/devoirs?id=${h.id}`, status: h.status, priority: h.priority })),
  ].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));

  // Ce qui reste cette semaine.
  const endOfWeek = parisDateTime(addDays(sunday, 1));
  const remainingHomework = hw.filter((h) => h.due_at && new Date(h.due_at) < endOfWeek);
  const remainingRevisions = weekItems.filter(
    (i) => i.item_type === "revision" && !i.done && !i.removed_in_review && i.session.status !== "bilan_fait",
  );
  const weekExamIds = [...upcomingDs, ...upcomingKh].filter((x) => new Date(x.event.start_at) < parisDateTime(addDays(sunday, 8))).map((x) => x.id);
  const { data: prepTasks } = weekExamIds.length
    ? await db.from("prep_tasks").select("*").in("target_id", weekExamIds).eq("done", false)
    : { data: [] };

  // Bilan de la semaine passée.
  const lastPlanned = lastWeekItems.filter((i) => i.origin === "prevu").reduce((s, i) => s + i.planned_minutes, 0);
  const lastReal = lastWeekItems.reduce((s, i) => s + realMinutes(i), 0);
  const lastSessions = (weekSessions ?? []).filter((s) => s.date < monday && ["prevue", "bilan_fait"].includes(s.status));
  const bySubject = new Map<string, number>();
  for (const i of lastWeekItems) if (i.subject_id) bySubject.set(i.subject_id, (bySubject.get(i.subject_id) ?? 0) + realMinutes(i));

  // Matières délaissées (phase 3).
  const neglected = await neglectedSubjects(db, ctx, now);

  const tonightSession = (tonight?.[0] ?? null) as (StudySession & { items: SessionItem[] }) | null;
  tonightSession?.items?.sort((a, b) => a.sort_order - b.sort_order);

  return {
    today,
    monday,
    week: weekLetter(today, ctx.settings.week_a_reference_date),
    nextDs: cards.ds[0] ?? null,
    nextKholle: cards.kholles[0] ?? null,
    cb,
    weekWork: { planned, real, pct: weekPct },
    tonight: tonightSession,
    notes: (notes ?? []) as Note[],
    deadlines,
    remaining: { homework: remainingHomework, revisions: remainingRevisions, prepTasks: (prepTasks ?? []) as PrepTask[] },
    lastWeek: {
      planned: lastPlanned,
      real: lastReal,
      sessions: lastSessions.length,
      reviewed: lastSessions.filter((s) => s.status === "bilan_fait").length,
      bySubject: [...bySubject.entries()].sort((a, b) => b[1] - a[1]),
    },
    neglected,
  };
}

/** Matières sans travail réel depuis `settings.neglected_after_days` jours. */
export async function neglectedSubjects(db: SupabaseClient, ctx: UserContext, now: Date) {
  const since = addDays(dateKey(now), -60);
  const items: ItemWithSession[] = await loadItemsBetween(db, ctx.userId, since, dateKey(now));
  const last = new Map<string, string>();
  for (const i of items) {
    if (!i.subject_id || effectiveMinutes(i) <= 0 || new Date(i.session.start_at) > now) continue;
    const prev = last.get(i.subject_id);
    if (!prev || i.session.date > prev) last.set(i.subject_id, i.session.date);
  }
  const threshold = ctx.settings.neglected_after_days ?? 7;
  const today = dateKey(now);
  return ctx.subjects
    .map((s) => ({ subject: s, lastDate: last.get(s.id) ?? null, days: last.get(s.id) ? diffDays(today, last.get(s.id)!) : null }))
    .filter((x) => x.days === null || x.days >= threshold)
    .sort((a, b) => (b.days ?? 999) - (a.days ?? 999));
}
