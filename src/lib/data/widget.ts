import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/data/context";
import { examCards, loadDashboard } from "@/lib/data/dashboard";
import { loadDs, loadKholles } from "@/lib/data/exams";
import { loadItemsBetween, realMinutes } from "@/lib/data/work";
import { formatCountdown } from "@/lib/domain/countdown";
import { addDays, dateKey, diffDays, mondayOf, parisDateTime, timeKey, weekdayOf } from "@/lib/domain/time";
import type { CalendarEvent, Homework, Note, StudySession, SessionItem } from "@/lib/types";

const DAY = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const DAY_LONG = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

/** Titre court pour les petits blocs (« Lettres & Philosophie (Gay) » → « Lettres & Philo »). */
function shortTitle(title: string) {
  return title
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/Philosophie/g, "Philo")
    .replace(/Mathématiques/g, "Maths")
    .replace(/Management Gest\. Entreprise/g, "Management")
    .replace(/Informatique/g, "Info")
    .replace(/^DS - /, "DS ")
    .trim();
}

function dayLabel(key: string, today: string) {
  const d = diffDays(key, today);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Demain";
  return `${DAY_LONG[weekdayOf(key)]} ${Number(key.slice(8))}`;
}

function dueLabel(iso: string | null, today: string) {
  if (!iso) return "sans date";
  const k = dateKey(iso);
  const d = diffDays(k, today);
  if (d < 0) return `en retard (${-d} j)`;
  if (d === 0) return "aujourd'hui";
  if (d === 1) return "demain";
  if (d < 7) return `${DAY[weekdayOf(k)]} ${Number(k.slice(8))}`;
  return `${Number(k.slice(8))}/${k.slice(5, 7)}`;
}

/** Toutes les données des widgets Scriptable en un seul appel. */
export async function getWidgetData(db: SupabaseClient, ctx: UserContext, opts: { days?: number } = {}) {
  const now = new Date();
  const today = dateKey(now);
  const nDays = Math.min(7, Math.max(1, opts.days ?? 3));
  const monday = mondayOf(today);
  const color = (id: string | null) => (id ? (ctx.subjectById.get(id)?.color ?? null) : null);
  const subjectName = (id: string | null) => (id ? (ctx.subjectById.get(id)?.name ?? null) : null);

  const [dash, { data: events }, { data: sessions }, { data: hw }, dsAll, khAll, weekItems, streakItems, { data: notes }] = await Promise.all([
    loadDashboard(db, ctx, now),
    db
      .from("calendar_events")
      .select("*")
      .eq("user_id", ctx.userId)
      .gte("start_at", parisDateTime(today).toISOString())
      .lt("start_at", parisDateTime(addDays(today, nDays)).toISOString())
      .order("start_at"),
    db
      .from("study_sessions")
      .select("*, items:session_items(*)")
      .eq("user_id", ctx.userId)
      .gte("date", today)
      .lt("date", addDays(today, nDays))
      .in("status", ["prevue", "bilan_fait", "suggeree"])
      .order("start_at"),
    db
      .from("homework")
      .select("*")
      .eq("user_id", ctx.userId)
      .neq("status", "fait")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(40),
    loadDs(db, ctx.userId, { from: now, to: parisDateTime(addDays(today, 60)) }),
    loadKholles(db, ctx.userId, { from: now, to: parisDateTime(addDays(today, 30)) }),
    loadItemsBetween(db, ctx.userId, monday, addDays(monday, 6)),
    loadItemsBetween(db, ctx.userId, addDays(today, -60), today),
    db.from("notes").select("*").eq("user_id", ctx.userId).eq("done", false).order("pinned", { ascending: false }).limit(6),
  ]);

  const cards = await examCards(db, ctx, dsAll.slice(0, 6), khAll.slice(0, 6), now);
  const khIds = khAll.slice(0, 6).map((k) => k.id);
  const [{ data: questions }, { data: prepTasks }] = await Promise.all([
    khIds.length ? db.from("kholle_questions").select("kholle_id, status").in("kholle_id", khIds) : Promise.resolve({ data: [] }),
    khIds.length || dsAll.length
      ? db.from("prep_tasks").select("target_id, done").in("target_id", [...khIds, ...dsAll.slice(0, 6).map((d) => d.id)])
      : Promise.resolve({ data: [] }),
  ]);

  // Emploi du temps jour par jour.
  const days = Array.from({ length: nDays }, (_, i) => {
    const key = addDays(today, i);
    return {
      date: key,
      label: dayLabel(key, today),
      short: `${DAY[weekdayOf(key)]} ${Number(key.slice(8))}`,
      events: ((events ?? []) as CalendarEvent[])
        .filter((e) => dateKey(e.start_at) === key && !e.all_day)
        .map((e) => ({
          id: e.id,
          title: e.title,
          short: shortTitle(e.title),
          kind: e.kind,
          start: e.start_at,
          end: e.end_at,
          startLabel: timeKey(e.start_at).replace(":", "h"),
          endLabel: timeKey(e.end_at).replace(":", "h"),
          startMin: Number(timeKey(e.start_at).slice(0, 2)) * 60 + Number(timeKey(e.start_at).slice(3)),
          endMin: Number(timeKey(e.end_at).slice(0, 2)) * 60 + Number(timeKey(e.end_at).slice(3)),
          color: color(e.subject_id),
          subject: subjectName(e.subject_id),
          location: e.location,
        })),
      sessions: ((sessions ?? []) as (StudySession & { items: SessionItem[] })[])
        .filter((s) => s.date === key && s.status !== "suggeree")
        .map((s) => ({
          id: s.id,
          kind: s.kind,
          status: s.status,
          start: s.start_at,
          end: s.end_at,
          startLabel: timeKey(s.start_at).replace(":", "h"),
          endLabel: timeKey(s.end_at).replace(":", "h"),
          startMin: Number(timeKey(s.start_at).slice(0, 2)) * 60 + Number(timeKey(s.start_at).slice(3)),
          endMin: Number(timeKey(s.end_at).slice(0, 2)) * 60 + Number(timeKey(s.end_at).slice(3)),
          colors: s.items.filter((i) => !i.removed_in_review).map((i) => color(i.subject_id)).filter(Boolean),
        })),
    };
  });

  // Prochain / en cours (aujourd'hui).
  const todayBlocks = [...days[0].events.map((e) => ({ ...e, type: "event" as const })), ...days[0].sessions.map((s) => ({ ...s, type: "session" as const, short: `Session ${s.kind}`, color: null, location: null }))].sort((a, b) => a.startMin - b.startMin);
  const current = todayBlocks.find((b) => new Date(b.start) <= now && new Date(b.end) > now) ?? null;
  const next = todayBlocks.find((b) => new Date(b.start) > now) ?? null;

  // Devoirs.
  const homework = ((hw ?? []) as Homework[]).map((h) => ({
    id: h.id,
    title: h.title,
    subject: subjectName(h.subject_id),
    color: color(h.subject_id),
    due: h.due_at,
    dueLabel: dueLabel(h.due_at, today),
    overdue: !!h.due_at && dateKey(h.due_at) < today,
    dueToday: !!h.due_at && dateKey(h.due_at) === today,
    priority: h.priority,
    status: h.status,
    estimatedMinutes: h.estimated_minutes,
  }));

  // Semaine : minutes réelles par jour et par matière.
  const byDay = Array.from({ length: 7 }, (_, i) => {
    const k = addDays(monday, i);
    return { date: k, short: DAY[weekdayOf(k)].slice(0, 1).toUpperCase(), minutes: weekItems.filter((x) => x.session.date === k).reduce((a, x) => a + realMinutes(x), 0), isToday: k === today };
  });
  const bySubjectMap = new Map<string, number>();
  for (const i of weekItems) if (i.subject_id) bySubjectMap.set(i.subject_id, (bySubjectMap.get(i.subject_id) ?? 0) + realMinutes(i));

  // Série : jours consécutifs avec du travail réel (aujourd'hui compte s'il y en a déjà).
  const worked = new Set(streakItems.filter((i) => realMinutes(i) > 0).map((i) => i.session.date));
  let streak = 0;
  for (let k = worked.has(today) ? today : addDays(today, -1); worked.has(k); k = addDays(k, -1)) streak++;

  const exam = (c: (typeof cards.ds)[number]) => ({
    id: c.id,
    title: c.title,
    short: shortTitle(c.title),
    subject: subjectName(c.subjectId),
    color: color(c.subjectId),
    start: c.start,
    dayLabel: dayLabel(dateKey(c.start), today),
    time: timeKey(c.start).replace(":", "h"),
    daysLeft: diffDays(dateKey(c.start), today),
    countdown: c.countdown,
    countdownText: formatCountdown(c.countdown),
    gauge: c.gauge,
    worked7dMinutes: c.worked7d,
    location: c.location,
    prepTasksOpen: (prepTasks ?? []).filter((t) => t.target_id === c.id && !t.done).length,
  });

  return {
    generatedAt: now.toISOString(),
    today,
    todayLabel: `${DAY_LONG[weekdayOf(today)]} ${Number(today.slice(8))}`,
    week: dash.week,
    streak,
    current,
    next,
    days,
    tonight: dash.tonight && {
      id: dash.tonight.id,
      mode: dash.tonight.kind,
      status: dash.tonight.status,
      startLabel: timeKey(dash.tonight.start_at).replace(":", "h"),
      endLabel: timeKey(dash.tonight.end_at).replace(":", "h"),
      ended: new Date(dash.tonight.end_at) <= now,
      plannedMinutes: dash.tonight.items.filter((i) => !i.removed_in_review).reduce((a, i) => a + i.planned_minutes, 0),
      slotMinutes: Math.round((new Date(dash.tonight.end_at).getTime() - new Date(dash.tonight.start_at).getTime()) / 60000),
      items: dash.tonight.items
        .filter((i) => !i.removed_in_review)
        .map((i) => ({ id: i.id, label: i.description ?? subjectName(i.subject_id) ?? "Élément", subject: subjectName(i.subject_id), color: color(i.subject_id), minutes: i.planned_minutes, done: i.done })),
    },
    ds: cards.ds.map(exam),
    kholles: cards.kholles.map((c) => {
      const k = khAll.find((x) => x.id === c.id);
      const qs = (questions ?? []).filter((q) => q.kholle_id === c.id);
      return {
        ...exam(c),
        teacher: k?.teacher ?? null,
        info: k?.event.description ?? null,
        questions: qs.length,
        questionsToReview: qs.filter((q) => q.status === "a_revoir").length,
      };
    }),
    cb: dash.cb && { id: dash.cb.period.id, name: dash.cb.period.name, exams: dash.cb.exams.length, first: dash.cb.first, daysLeft: diffDays(dateKey(dash.cb.first), today), countdownText: formatCountdown(dash.cb.countdown) },
    homework,
    homeworkCounts: {
      open: homework.length,
      overdue: homework.filter((h) => h.overdue).length,
      today: homework.filter((h) => h.dueToday).length,
      week: homework.filter((h) => h.due && new Date(h.due) < parisDateTime(addDays(monday, 7))).length,
    },
    weekWork: {
      realMinutes: dash.weekWork.real,
      plannedMinutes: dash.weekWork.planned,
      weekElapsed: dash.weekWork.pct,
      byDay,
      bySubject: [...bySubjectMap.entries()].sort((a, b) => b[1] - a[1]).map(([id, minutes]) => ({ name: subjectName(id), color: color(id), minutes })),
    },
    neglected: dash.neglected.slice(0, 3).map((n) => ({ name: n.subject.name, color: n.subject.color, days: n.days })),
    notes: ((notes ?? []) as Note[]).map((n) => ({ id: n.id, content: n.content, color: n.color, pinned: n.pinned })),
    subjects: ctx.subjects.map((s) => ({ key: s.key, name: s.name, color: s.color })),
  };
}

export type WidgetData = Awaited<ReturnType<typeof getWidgetData>>;
