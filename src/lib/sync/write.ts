import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GoogleApiError,
  createCalendar,
  deleteEvent,
  deleteTask,
  findOrCreateTaskList,
  insertEvent,
  insertTask,
  listTasks,
  updateEvent,
  updateTask,
} from "@/lib/google/api";
import { addDays, dateKey } from "@/lib/domain/time";
import { generateSessions, SESSION_KIND_LABEL, type BusyEvent } from "@/lib/domain/sessions";
import type { UserContext } from "@/lib/data/context";
import type { Homework, SessionItem, StudySession } from "@/lib/types";
import { env } from "@/lib/env";

export const TASK_LIST_TITLE = "Prépa";
export const PLANNING_CALENDAR_TITLE = "Planning+";

/** L'objet n'existe plus côté Google (supprimé à la main, liste/calendrier effacé…). */
export function isGone(e: unknown) {
  return e instanceof GoogleApiError && (e.status === 404 || e.status === 410);
}

/** La liste Tasks a disparu : on l'oublie, et tous les devoirs seront recréés dans la nouvelle. */
async function resetTaskList(db: SupabaseClient, ctx: UserContext) {
  ctx.settings.tasks_list_id = null;
  await db.from("settings").update({ tasks_list_id: null }).eq("user_id", ctx.userId);
  await db.from("homework").update({ google_task_id: null, google_synced_at: null }).eq("user_id", ctx.userId);
}

/** Le calendrier « Planning+ » a disparu : idem pour les sessions. */
async function resetPlanningCalendar(db: SupabaseClient, ctx: UserContext) {
  ctx.settings.planning_calendar_id = null;
  await db.from("settings").update({ planning_calendar_id: null }).eq("user_id", ctx.userId);
  await db.from("study_sessions").update({ google_event_id: null, google_synced_at: null }).eq("user_id", ctx.userId);
}

async function taskListId(db: SupabaseClient, ctx: UserContext, token: string) {
  if (ctx.settings.tasks_list_id) return ctx.settings.tasks_list_id;
  const id = await findOrCreateTaskList(token, TASK_LIST_TITLE);
  await db.from("settings").update({ tasks_list_id: id }).eq("user_id", ctx.userId);
  ctx.settings.tasks_list_id = id;
  return id;
}

async function planningCalendarId(db: SupabaseClient, ctx: UserContext, token: string) {
  if (ctx.settings.planning_calendar_id) return ctx.settings.planning_calendar_id;
  const id = await createCalendar(token, PLANNING_CALENDAR_TITLE);
  await db.from("settings").update({ planning_calendar_id: id }).eq("user_id", ctx.userId);
  ctx.settings.planning_calendar_id = id;
  return id;
}

function homeworkTask(ctx: UserContext, h: Homework) {
  const subject = h.subject_id ? ctx.subjectById.get(h.subject_id) : null;
  const link = `${env.appUrl()}/devoirs?id=${h.id}`;
  return {
    title: subject ? `[${subject.name}] ${h.title}` : h.title,
    notes: [h.description, `Planning+ : ${link}`].filter(Boolean).join("\n\n"),
    due: h.due_at ? `${dateKey(h.due_at)}T00:00:00.000Z` : null,
    completed: h.status === "fait",
  };
}

/** Pousse un devoir vers Google Tasks (création ou mise à jour). */
export async function pushHomework(db: SupabaseClient, ctx: UserContext, token: string, h: Homework) {
  const listId = await taskListId(db, ctx, token);
  const t = homeworkTask(ctx, h);
  let taskId = h.google_task_id;
  if (taskId) {
    try {
      await updateTask(token, listId, taskId, t);
    } catch (e) {
      if (!isGone(e)) throw e;
      taskId = null; // tâche supprimée dans Google Tasks : Planning+ fait foi, on la recrée
    }
  }
  if (!taskId) taskId = await insertTask(token, listId, t);
  // On ne touche pas updated_at (trigger) : google_synced_at sert de marqueur.
  await db
    .from("homework")
    .update({ google_task_id: taskId, google_synced_at: new Date(Date.now() + 2000).toISOString() })
    .eq("id", h.id);
}

export async function removeHomeworkTask(db: SupabaseClient, ctx: UserContext, token: string, googleTaskId: string) {
  const listId = await taskListId(db, ctx, token);
  await deleteTask(token, listId, googleTaskId);
}

/**
 * 1. Retour unique : une tâche cochée dans Google Tasks passe le devoir à « fait ».
 * 2. Pousse les devoirs créés / modifiés depuis la dernière synchro.
 */
export async function syncHomework(db: SupabaseClient, ctx: UserContext, token: string) {
  let listId = await taskListId(db, ctx, token);
  let tasks;
  try {
    tasks = await listTasks(token, listId);
  } catch (e) {
    if (!isGone(e)) throw e;
    await resetTaskList(db, ctx);
    listId = await taskListId(db, ctx, token);
    tasks = await listTasks(token, listId);
  }
  const completed = new Map(tasks.filter((t) => t.status === "completed" && !t.deleted).map((t) => [t.id, t]));

  const { data: open } = await db
    .from("homework")
    .select("id, google_task_id")
    .eq("user_id", ctx.userId)
    .neq("status", "fait")
    .not("google_task_id", "is", null);
  let pulled = 0;
  for (const h of open ?? []) {
    const t = completed.get(h.google_task_id!);
    if (!t) continue;
    await db
      .from("homework")
      .update({ status: "fait", done_at: t.completed ?? new Date().toISOString(), google_synced_at: new Date(Date.now() + 2000).toISOString() })
      .eq("id", h.id);
    pulled++;
  }

  const { data: all } = await db.from("homework").select("*").eq("user_id", ctx.userId);
  let pushed = 0;
  const errors: string[] = [];
  for (const h of (all ?? []) as (Homework & { google_synced_at: string | null })[]) {
    const dirty = !h.google_task_id || !h.google_synced_at || new Date(h.updated_at) > new Date(h.google_synced_at);
    if (!dirty) continue;
    try {
      await pushHomework(db, ctx, token, h);
      pushed++;
    } catch (e) {
      errors.push(`« ${h.title} » : ${e instanceof Error ? e.message : e}`);
    }
  }
  // Un devoir en échec n'empêche pas les autres ; l'erreur remonte pour être affichée.
  if (errors.length) throw new Error(`${errors.length} devoir(s) non synchronisé(s) — ${errors[0]}`);
  return { pulled, pushed };
}

function sessionEvent(s: StudySession, items: SessionItem[], ctx: UserContext) {
  const lines = items
    .filter((i) => !i.removed_in_review)
    .map((i) => {
      const subj = i.subject_id ? ctx.subjectById.get(i.subject_id)?.name : null;
      return `• ${[subj, i.description].filter(Boolean).join(" — ")} (${i.planned_minutes} min)`;
    });
  return {
    summary: `Session · ${SESSION_KIND_LABEL[s.kind]}`,
    description: lines.length ? lines.join("\n") : "Aucun élément prévu",
    location: s.location ?? undefined,
    start: new Date(s.start_at),
    end: new Date(s.end_at),
  };
}

/** Pousse les sessions confirmées vers le calendrier « Planning+ » ; retire les suggestions/ignorées. */
export async function syncSessionsToCalendar(db: SupabaseClient, ctx: UserContext, token: string, retried = false): Promise<{ pushed: number }> {
  const calId = await planningCalendarId(db, ctx, token);
  const from = addDays(dateKey(new Date()), -14);
  const { data: sessions } = await db
    .from("study_sessions")
    .select("*, items:session_items(*)")
    .eq("user_id", ctx.userId)
    .gte("date", from);
  let pushed = 0;
  const errors: string[] = [];
  const synced = () => new Date(Date.now() + 2000).toISOString();

  for (const s of (sessions ?? []) as (StudySession & { updated_at: string; google_synced_at: string | null })[]) {
    try {
      const confirmed = s.status === "prevue" || s.status === "bilan_fait";
      if (!confirmed) {
        if (s.google_event_id) {
          await deleteEvent(token, calId, s.google_event_id); // 404/410 déjà ignorés
          await db.from("study_sessions").update({ google_event_id: null, google_synced_at: synced() }).eq("id", s.id);
        }
        continue;
      }
      const dirty = !s.google_event_id || !s.google_synced_at || new Date(s.updated_at) > new Date(s.google_synced_at);
      if (!dirty) continue;
      const ev = sessionEvent(s, s.items ?? [], ctx);
      let eventId = s.google_event_id;
      if (eventId) {
        try {
          await updateEvent(token, calId, eventId, ev);
        } catch (e) {
          if (!isGone(e)) throw e;
          eventId = null; // événement supprimé dans Google Agenda : Planning+ fait foi, on le recrée
        }
      }
      if (!eventId) eventId = await insertEvent(token, calId, ev);
      await db.from("study_sessions").update({ google_event_id: eventId, google_synced_at: synced() }).eq("id", s.id);
      pushed++;
    } catch (e) {
      // Calendrier « Planning+ » supprimé : on le recrée une fois et on repousse tout.
      if (isGone(e) && !retried) {
        await resetPlanningCalendar(db, ctx);
        return syncSessionsToCalendar(db, ctx, token, true);
      }
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (errors.length) throw new Error(`${errors.length} session(s) non synchronisée(s) — ${errors[0]}`);
  return { pushed };
}

export async function removeSessionEvent(db: SupabaseClient, ctx: UserContext, token: string, googleEventId: string) {
  const calId = await planningCalendarId(db, ctx, token);
  await deleteEvent(token, calId, googleEventId);
}

/** Génère les sessions automatiques sur 3 semaines glissantes (idempotent). */
export async function generateUpcomingSessions(db: SupabaseClient, ctx: UserContext, now = new Date()) {
  const from = dateKey(now);
  const to = addDays(from, 21);
  const [{ data: events }, { data: existing }] = await Promise.all([
    db
      .from("calendar_events")
      .select("kind, start_at, end_at")
      .eq("user_id", ctx.userId)
      .gte("start_at", `${from}T00:00:00Z`)
      .lte("start_at", `${to}T23:59:59Z`),
    db
      .from("study_sessions")
      .select("date, generated_by_rule")
      .eq("user_id", ctx.userId)
      .not("generated_by_rule", "is", null)
      .gte("date", from),
  ]);
  const busy: BusyEvent[] = (events ?? []).map((e) => ({
    kind: e.kind,
    startAt: new Date(e.start_at),
    endAt: new Date(e.end_at),
  }));
  const generated = generateSessions({
    from,
    days: 21,
    rules: ctx.rules,
    holidays: ctx.holidays,
    events: busy,
    existing: (existing ?? []).map((e) => ({ date: e.date, rule: e.generated_by_rule! })),
  });
  if (!generated.length) return { created: 0 };
  const { error } = await db.from("study_sessions").upsert(
    generated.map((g) => ({
      user_id: ctx.userId,
      date: g.date,
      start_at: g.startAt.toISOString(),
      end_at: g.endAt.toISOString(),
      kind: g.kind,
      status: g.status,
      generated_by_rule: g.rule,
    })),
    { onConflict: "user_id,date,generated_by_rule", ignoreDuplicates: true },
  );
  if (error) throw error;
  return { created: generated.length };
}
