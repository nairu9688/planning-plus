import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/data/context";
import { examCards, loadDashboard } from "@/lib/data/dashboard";
import { loadDs, loadUpcomingExams } from "@/lib/data/exams";
import { loadExamExtras } from "@/lib/data/exam-page";
import { ensureReview } from "@/lib/data/review";
import { formatCountdown } from "@/lib/domain/countdown";
import { addDays, dateKey, parisDateTime } from "@/lib/domain/time";
import { maisonToggle } from "@/lib/domain/sessions";
import { resolveTarget, type TargetChoice } from "@/lib/domain/targets";
import type { SubjectKey } from "@/lib/domain/subjects";
import { pushHomeworkNow, pushSessionsNow } from "@/lib/sync/push-one";
import type { Homework, SessionItem } from "@/lib/types";

/**
 * Opérations métier utilisables sans session navigateur (API REST v1 et serveur MCP).
 * `db` est un client service role : chaque requête filtre explicitement sur ctx.userId.
 */

export function resolveSubjectId(ctx: UserContext, input?: string | null): string | null {
  if (!input) return null;
  const n = input.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const s =
    ctx.subjects.find((x) => x.id === input || x.key === n) ??
    ctx.subjects.find((x) => x.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().startsWith(n));
  return s?.id ?? null;
}

const subjectName = (ctx: UserContext, id: string | null) => (id ? (ctx.subjectById.get(id)?.name ?? null) : null);

export async function getSummary(db: SupabaseClient, ctx: UserContext) {
  const now = new Date();
  const d = await loadDashboard(db, ctx, now);
  const today = dateKey(now);
  const { data: dueToday } = await db
    .from("homework")
    .select("id, title, subject_id, due_at, status")
    .eq("user_id", ctx.userId)
    .neq("status", "fait")
    .lt("due_at", parisDateTime(addDays(today, 1)).toISOString())
    .order("due_at");
  const exam = (c: typeof d.nextDs) =>
    c && { id: c.id, title: c.title, start: c.start, subject: subjectName(ctx, c.subjectId), countdown: c.countdown, countdownText: formatCountdown(c.countdown), gauge: c.gauge, worked7dMinutes: c.worked7d };
  return {
    date: today,
    week: d.week,
    nextDs: exam(d.nextDs),
    nextKholle: exam(d.nextKholle),
    cb: d.cb && { id: d.cb.period.id, name: d.cb.period.name, first: d.cb.first, last: d.cb.last, exams: d.cb.exams.length, countdownText: formatCountdown(d.cb.countdown) },
    homeworkToday: (dueToday ?? []).map((h) => ({ id: h.id, title: h.title, subject: subjectName(ctx, h.subject_id), due: h.due_at, status: h.status })),
    tonight: d.tonight && {
      id: d.tonight.id,
      mode: d.tonight.kind,
      start: d.tonight.start_at,
      end: d.tonight.end_at,
      status: d.tonight.status,
      items: d.tonight.items.filter((i) => !i.removed_in_review).map((i) => ({ id: i.id, description: i.description, subject: subjectName(ctx, i.subject_id), minutes: i.planned_minutes, done: i.done })),
    },
    weekWork: { realMinutes: d.weekWork.real, plannedMinutes: d.weekWork.planned, weekElapsed: d.weekWork.pct },
    colors: Object.fromEntries(ctx.subjects.map((s) => [s.name, s.color])),
  };
}

export async function listDeadlines(db: SupabaseClient, ctx: UserContext, days = 21) {
  const d = await loadDashboard(db, ctx);
  const horizon = parisDateTime(addDays(dateKey(new Date()), days)).toISOString();
  return d.deadlines
    .filter((r) => !r.at || r.at <= horizon)
    .map((r) => ({ kind: r.kind, id: r.id, title: r.title, at: r.at, subject: subjectName(ctx, r.subjectId), worked7dMinutes: r.worked7d ?? null }));
}

export async function createHomeworkFor(
  db: SupabaseClient,
  ctx: UserContext,
  input: { title: string; subject?: string | null; dueDate?: string | null; dueTime?: string | null; description?: string | null; estimatedMinutes?: number | null; priority?: string | null },
) {
  if (!input.title?.trim()) throw new Error("title requis");
  const { data, error } = await db
    .from("homework")
    .insert({
      user_id: ctx.userId,
      title: input.title.trim(),
      subject_id: resolveSubjectId(ctx, input.subject),
      description: input.description ?? null,
      due_at: input.dueDate ? parisDateTime(input.dueDate, input.dueTime ?? "08:00").toISOString() : null,
      estimated_minutes: input.estimatedMinutes ?? null,
      priority: ["basse", "normale", "haute"].includes(input.priority ?? "") ? input.priority : "normale",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await pushHomeworkNow(ctx.userId, data.id);
  return data as Homework;
}

export async function updateHomeworkFor(
  db: SupabaseClient,
  ctx: UserContext,
  id: string,
  patch: { title?: string; subject?: string | null; dueDate?: string | null; description?: string | null; status?: string; estimatedMinutes?: number | null },
) {
  const row: Record<string, unknown> = {};
  if (patch.title) row.title = patch.title;
  if (patch.subject !== undefined) row.subject_id = resolveSubjectId(ctx, patch.subject);
  if (patch.dueDate !== undefined) row.due_at = patch.dueDate ? parisDateTime(patch.dueDate, "08:00").toISOString() : null;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.estimatedMinutes !== undefined) row.estimated_minutes = patch.estimatedMinutes;
  if (patch.status && ["a_faire", "en_cours", "fait"].includes(patch.status)) {
    row.status = patch.status;
    row.done_at = patch.status === "fait" ? new Date().toISOString() : null;
  }
  const { data, error } = await db.from("homework").update(row).eq("id", id).eq("user_id", ctx.userId).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Devoir introuvable");
  await pushHomeworkNow(ctx.userId, id);
  return data as Homework;
}

export const markHomeworkDone = (db: SupabaseClient, ctx: UserContext, id: string) => updateHomeworkFor(db, ctx, id, { status: "fait" });

export async function createNoteFor(db: SupabaseClient, ctx: UserContext, input: { content: string; color?: string; dueDate?: string | null }) {
  if (!input.content?.trim()) throw new Error("content requis");
  const { data, error } = await db
    .from("notes")
    .insert({ user_id: ctx.userId, content: input.content.trim(), color: input.color ?? "yellow", due_at: input.dueDate ? parisDateTime(input.dueDate, "08:00").toISOString() : null })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setSessionModeFor(db: SupabaseClient, ctx: UserContext, sessionId: string, mode: "etude" | "maison") {
  const { data: s } = await db.from("study_sessions").select("date").eq("id", sessionId).eq("user_id", ctx.userId).maybeSingle();
  if (!s) throw new Error("Session introuvable");
  const r = maisonToggle(s.date, mode, ctx.rules);
  const { data, error } = await db
    .from("study_sessions")
    .update({ kind: r.kind, start_at: r.startAt.toISOString(), end_at: r.endAt.toISOString() })
    .eq("id", sessionId)
    .select("id, kind, start_at, end_at")
    .single();
  if (error) throw new Error(error.message);
  await pushSessionsNow(ctx.userId);
  return data;
}

export interface ItemSpec {
  type: "homework" | "revision" | "prep_task" | "sport";
  homeworkId?: string;
  subject?: string;
  subjectItemId?: string;
  prepTaskId?: string;
  description?: string;
  minutes: number;
  target?: TargetChoice;
}

export async function createSessionFor(
  db: SupabaseClient,
  ctx: UserContext,
  input: { date: string; start: string; end: string; kind?: string; location?: string; items?: ItemSpec[] },
) {
  const start = parisDateTime(input.date, input.start);
  const end = parisDateTime(input.date, input.end);
  if (end <= start) throw new Error("La fin doit être après le début");
  const { data: s, error } = await db
    .from("study_sessions")
    .insert({ user_id: ctx.userId, date: input.date, start_at: start.toISOString(), end_at: end.toISOString(), kind: input.kind ?? "etude", status: "prevue", location: input.location ?? null })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  for (const [i, it] of (input.items ?? []).entries()) await addItemFor(db, ctx, s.id, it, i);
  await pushSessionsNow(ctx.userId);
  return s;
}

export async function addItemFor(db: SupabaseClient, ctx: UserContext, sessionId: string, it: ItemSpec, sortOrder = 0) {
  const { data: s } = await db.from("study_sessions").select("start_at").eq("id", sessionId).eq("user_id", ctx.userId).maybeSingle();
  if (!s) throw new Error("Session introuvable");
  let subjectId = resolveSubjectId(ctx, it.subject);
  let description = it.description ?? null;
  if (it.homeworkId) {
    const { data: h } = await db.from("homework").select("subject_id, title").eq("id", it.homeworkId).eq("user_id", ctx.userId).maybeSingle();
    subjectId ??= h?.subject_id ?? null;
    description ??= h?.title ?? null;
  }
  const exams = await loadUpcomingExams(db, ctx, new Date(s.start_at));
  const key = subjectId ? ((ctx.subjectById.get(subjectId)?.key as SubjectKey) ?? null) : null;
  const t = resolveTarget(key, it.type === "sport" ? "none" : (it.target ?? "auto"), new Date(s.start_at), exams);
  const { data, error } = await db
    .from("session_items")
    .insert({
      user_id: ctx.userId,
      session_id: sessionId,
      item_type: it.type,
      homework_id: it.homeworkId ?? null,
      subject_id: subjectId,
      subject_item_id: it.subjectItemId ?? null,
      prep_task_id: it.prepTaskId ?? null,
      description,
      planned_minutes: it.minutes,
      target: t.target,
      target_ds_id: t.dsId,
      target_kholle_id: t.kholleId,
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SessionItem;
}

/** Bilan d'une session : pour chaque élément, fait / durée réelle / retiré ; ajouts éventuels. */
export async function reviewSessionFor(
  db: SupabaseClient,
  ctx: UserContext,
  sessionId: string,
  input: { items?: { id: string; done?: boolean; actualMinutes?: number; removed?: boolean }[]; extra?: ItemSpec[]; comment?: string },
) {
  const { data: s } = await db.from("study_sessions").select("id, end_at").eq("id", sessionId).eq("user_id", ctx.userId).maybeSingle();
  if (!s) throw new Error("Session introuvable");
  await ensureReview(db, ctx.userId, sessionId);
  for (const u of input.items ?? []) {
    const row: Record<string, unknown> = {};
    if (u.done !== undefined) row.done = u.done;
    if (u.actualMinutes !== undefined) row.actual_minutes = u.actualMinutes;
    if (u.removed !== undefined) row.removed_in_review = u.removed;
    await db.from("session_items").update(row).eq("id", u.id).eq("session_id", sessionId);
  }
  for (const e of input.extra ?? []) {
    const item = await addItemFor(db, ctx, sessionId, e, 99);
    await db.from("session_items").update({ origin: "ajoute_au_bilan", planned_minutes: 0, actual_minutes: e.minutes, done: true }).eq("id", item.id);
  }
  const now = new Date().toISOString();
  const { data: items } = await db.from("session_items").select("*").eq("session_id", sessionId);
  for (const it of (items ?? []) as SessionItem[]) {
    if (it.removed_in_review) continue;
    if (it.done && it.homework_id) {
      await db.from("homework").update({ status: "fait", done_at: now }).eq("id", it.homework_id);
      await pushHomeworkNow(ctx.userId, it.homework_id);
    }
    if (it.done && it.prep_task_id) await db.from("prep_tasks").update({ done: true }).eq("id", it.prep_task_id);
    if (it.subject_item_id && (it.actual_minutes ?? 0) > 0) await db.from("subject_items").update({ last_worked_at: s.end_at }).eq("id", it.subject_item_id);
  }
  await db.from("session_reviews").update({ reviewed_at: now, comment: input.comment ?? null }).eq("session_id", sessionId);
  await db.from("study_sessions").update({ status: "bilan_fait" }).eq("id", sessionId);
  await pushSessionsNow(ctx.userId);
  return { ok: true };
}

export async function dsPreparation(db: SupabaseClient, ctx: UserContext, dsId?: string) {
  const now = new Date();
  const upcoming = await loadDs(db, ctx.userId, { from: now });
  const target = dsId ? (await loadDs(db, ctx.userId)).find((d) => d.id === dsId) : upcoming[0];
  if (!target) throw new Error("DS introuvable");
  const [extras, cards] = await Promise.all([loadExamExtras(db, ctx.userId, "ds", target.id, target.subject_id), examCards(db, ctx, [target], [], now)]);
  return {
    id: target.id,
    title: target.event.title,
    start: target.event.start_at,
    subject: subjectName(ctx, target.subject_id),
    countdownText: formatCountdown(cards.ds[0].countdown),
    gauge: extras.gauge,
    topics: extras.topics.map((t) => ({ title: t.title, status: t.status })),
    prepTasks: extras.tasks.map((t) => ({ id: t.id, title: t.title, done: t.done })),
    workedMinutesTotal: extras.total,
    worked7dMinutes: cards.ds[0].worked7d,
    links: extras.links.map((l) => ({ url: l.url, label: l.label })),
  };
}

export async function listSessions(db: SupabaseClient, ctx: UserContext, from: string, to: string) {
  const { data } = await db
    .from("study_sessions")
    .select("id, date, kind, status, start_at, end_at, items:session_items(id, description, subject_id, planned_minutes, actual_minutes, done, removed_in_review)")
    .eq("user_id", ctx.userId)
    .gte("date", from)
    .lte("date", to)
    .neq("status", "ignoree")
    .order("start_at");
  return (data ?? []).map((s) => ({
    ...s,
    items: (s.items as SessionItem[]).map((i) => ({ ...i, subject: subjectName(ctx, i.subject_id) })),
  }));
}
