"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/auth";
import { loadUpcomingExams } from "@/lib/data/exams";
import { dateKey, parisDateTime } from "@/lib/domain/time";
import { maisonToggle, type SessionKind } from "@/lib/domain/sessions";
import { resolveTarget, type TargetChoice } from "@/lib/domain/targets";
import type { SubjectKey } from "@/lib/domain/subjects";
import { deleteSessionEventNow, pushSessionsNow } from "@/lib/sync/push-one";
import type { SessionItem, StudySession } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

const SessionInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  kind: z.enum(["etude", "maison", "suggestion", "bibliotheque", "sport", "libre"]),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type SessionInput = z.infer<typeof SessionInput>;

export async function createSession(raw: SessionInput) {
  const input = SessionInput.parse(raw);
  const { supabase, user } = await requireUser();
  const start = parisDateTime(input.date, input.start);
  const end = parisDateTime(input.date, input.end);
  if (end <= start) throw new Error("La fin doit être après le début");
  const { data, error } = await supabase
    .from("study_sessions")
    .insert({
      user_id: user.id,
      date: input.date,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      kind: input.kind,
      status: "prevue",
      location: input.location || null,
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  after(() => pushSessionsNow(user.id));
  refresh();
  return data.id as string;
}

export async function updateSession(id: string, raw: Partial<SessionInput> & { status?: StudySession["status"] }) {
  const { supabase, user } = await requireUser();
  const { data: s } = await supabase.from("study_sessions").select("*").eq("id", id).single();
  if (!s) throw new Error("Session introuvable");
  const date = raw.date ?? s.date;
  const patch: Record<string, unknown> = {};
  if (raw.kind) patch.kind = raw.kind;
  if (raw.location !== undefined) patch.location = raw.location || null;
  if (raw.notes !== undefined) patch.notes = raw.notes || null;
  if (raw.status) patch.status = raw.status;
  if (raw.date || raw.start || raw.end) {
    const start = parisDateTime(date, raw.start ?? timeOf(s.start_at));
    const end = parisDateTime(date, raw.end ?? timeOf(s.end_at));
    if (end <= start) throw new Error("La fin doit être après le début");
    Object.assign(patch, { date, start_at: start.toISOString(), end_at: end.toISOString() });
  }
  const { error } = await supabase.from("study_sessions").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  after(() => pushSessionsNow(user.id));
  refresh();
}

function timeOf(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

/** Interrupteur étude / maison : change les horaires, conserve les éléments. */
export async function setSessionMode(id: string, mode: "etude" | "maison") {
  const { supabase, user, ctx } = await requireUser();
  const { data: s } = await supabase.from("study_sessions").select("date").eq("id", id).single();
  if (!s) throw new Error("Session introuvable");
  const r = maisonToggle(s.date, mode, ctx.rules);
  const { error } = await supabase
    .from("study_sessions")
    .update({ kind: r.kind, start_at: r.startAt.toISOString(), end_at: r.endAt.toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  after(() => pushSessionsNow(user.id));
  refresh();
}

/** Accepter une suggestion → prévue (horaires ajustables). La suggestion 17h20 devient une session d'étude. */
export async function acceptSuggestion(id: string, times?: { start: string; end: string }) {
  const { supabase } = await requireUser();
  const { data: s } = await supabase.from("study_sessions").select("kind").eq("id", id).single();
  await updateSession(id, {
    status: "prevue",
    ...(s?.kind === "suggestion" ? { kind: "etude" as SessionKind } : {}),
    ...(times ?? {}),
  });
}

/** Retirer une suggestion ou supprimer une session : les sessions générées passent en « ignorée » (non régénérées). */
export async function removeSession(id: string) {
  const { supabase, user } = await requireUser();
  const { data: s } = await supabase.from("study_sessions").select("generated_by_rule, google_event_id").eq("id", id).single();
  if (!s) return;
  if (s.generated_by_rule) {
    await supabase.from("study_sessions").update({ status: "ignoree" }).eq("id", id);
  } else {
    await supabase.from("study_sessions").delete().eq("id", id);
  }
  if (s.google_event_id) {
    const gid = s.google_event_id;
    after(() => deleteSessionEventNow(user.id, gid));
  }
  refresh();
}

// ---------------------------------------------------------------------------
// Éléments de session
// ---------------------------------------------------------------------------
const ItemInput = z.object({
  itemType: z.enum(["homework", "revision", "prep_task", "sport"]),
  homeworkId: z.string().uuid().nullable().optional(),
  subjectId: z.string().uuid().nullable().optional(),
  subjectItemId: z.string().uuid().nullable().optional(),
  prepTaskId: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  plannedMinutes: z.number().int().min(0),
  target: z.enum(["next_ds", "next_kholle", "none", "auto"]).default("auto"),
  origin: z.enum(["prevu", "ajoute_au_bilan"]).default("prevu"),
  actualMinutes: z.number().int().min(0).nullable().optional(),
  done: z.boolean().optional(),
});
export type ItemInput = z.input<typeof ItemInput>;

async function resolveItem(sessionId: string, input: z.infer<typeof ItemInput>) {
  const { supabase, ctx } = await requireUser();
  const { data: s } = await supabase.from("study_sessions").select("start_at").eq("id", sessionId).single();
  if (!s) throw new Error("Session introuvable");

  // La matière d'un devoir / d'une tâche de DS se déduit de l'objet lié.
  let subjectId = input.subjectId ?? null;
  let description = input.description ?? null;
  if (input.homeworkId) {
    const { data: h } = await supabase.from("homework").select("subject_id, title").eq("id", input.homeworkId).single();
    subjectId ??= h?.subject_id ?? null;
    description ||= h?.title ?? null;
  }
  if (input.prepTaskId) {
    const { data: t } = await supabase.from("prep_tasks").select("title, target_type, target_id").eq("id", input.prepTaskId).single();
    description ||= t?.title ?? null;
    if (t && !subjectId) {
      const table = t.target_type === "ds" ? "ds" : "kholles";
      const { data: tgt } = await supabase.from(table).select("subject_id").eq("id", t.target_id).single();
      subjectId = tgt?.subject_id ?? null;
    }
  }
  if (input.subjectItemId && !subjectId) {
    const { data: si } = await supabase.from("subject_items").select("subject_id").eq("id", input.subjectItemId).single();
    subjectId = si?.subject_id ?? null;
  }

  const exams = await loadUpcomingExams(supabase, ctx, new Date(s.start_at));
  const subjectKey = subjectId ? ((ctx.subjectById.get(subjectId)?.key as SubjectKey) ?? null) : null;
  const t = resolveTarget(subjectKey, input.target as TargetChoice, new Date(s.start_at), exams);
  return {
    subject_id: subjectId,
    description,
    target: t.target,
    target_ds_id: t.dsId,
    target_kholle_id: t.kholleId,
  };
}

export async function addSessionItem(sessionId: string, raw: ItemInput) {
  const input = ItemInput.parse(raw);
  const { supabase, user } = await requireUser();
  const resolved = await resolveItem(sessionId, input);
  const { count } = await supabase.from("session_items").select("id", { count: "exact", head: true }).eq("session_id", sessionId);
  const { error } = await supabase.from("session_items").insert({
    user_id: user.id,
    session_id: sessionId,
    item_type: input.itemType,
    homework_id: input.homeworkId ?? null,
    subject_item_id: input.subjectItemId ?? null,
    prep_task_id: input.prepTaskId ?? null,
    planned_minutes: input.origin === "ajoute_au_bilan" ? 0 : input.plannedMinutes,
    actual_minutes: input.actualMinutes ?? null,
    done: input.done ?? false,
    origin: input.origin,
    sort_order: count ?? 0,
    ...resolved,
  });
  if (error) throw new Error(error.message);
  if (input.itemType === "homework" && input.homeworkId) {
    await supabase.from("homework").update({ status: "en_cours" }).eq("id", input.homeworkId).eq("status", "a_faire");
  }
  after(() => pushSessionsNow(user.id));
  refresh();
}

export async function updateSessionItem(
  id: string,
  patch: { plannedMinutes?: number; actualMinutes?: number | null; done?: boolean; description?: string | null; removedInReview?: boolean; target?: TargetChoice; sortOrder?: number },
) {
  const { supabase, user } = await requireUser();
  const row: Record<string, unknown> = {};
  if (patch.plannedMinutes !== undefined) row.planned_minutes = patch.plannedMinutes;
  if (patch.actualMinutes !== undefined) row.actual_minutes = patch.actualMinutes;
  if (patch.done !== undefined) row.done = patch.done;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.removedInReview !== undefined) row.removed_in_review = patch.removedInReview;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.target) {
    const { data: it } = await supabase.from("session_items").select("*").eq("id", id).single();
    if (it) {
      const resolved = await resolveItem(it.session_id, {
        itemType: it.item_type,
        homeworkId: it.homework_id,
        subjectId: it.subject_id,
        subjectItemId: it.subject_item_id,
        prepTaskId: it.prep_task_id,
        description: it.description,
        plannedMinutes: it.planned_minutes,
        target: patch.target,
        origin: it.origin,
      });
      Object.assign(row, { target: resolved.target, target_ds_id: resolved.target_ds_id, target_kholle_id: resolved.target_kholle_id });
    }
  }
  const { error } = await supabase.from("session_items").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  after(() => pushSessionsNow(user.id));
  refresh();
}

export async function deleteSessionItem(id: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("session_items").delete().eq("id", id);
  after(() => pushSessionsNow(user.id));
  refresh();
}

// ---------------------------------------------------------------------------
// Bilan
// ---------------------------------------------------------------------------
/** Ouvre le bilan : fige une copie du prévu (une seule fois). */
export async function openReview(sessionId: string) {
  const { supabase, user } = await requireUser();
  const { data: existing } = await supabase.from("session_reviews").select("id").eq("session_id", sessionId).maybeSingle();
  if (existing) return;
  const { data: items } = await supabase.from("session_items").select("*").eq("session_id", sessionId).order("sort_order");
  const { data: s } = await supabase.from("study_sessions").select("start_at, end_at, kind").eq("id", sessionId).single();
  // Durées réelles pré-remplies par le chrono Focus.
  const ids = (items ?? []).map((i) => i.id);
  const { data: logs } = ids.length
    ? await supabase.from("focus_logs").select("session_item_id, started_at, ended_at").in("session_item_id", ids)
    : { data: [] };
  const focus = new Map<string, number>();
  for (const l of logs ?? []) {
    if (!l.ended_at) continue;
    const m = Math.round((new Date(l.ended_at).getTime() - new Date(l.started_at).getTime()) / 60_000);
    focus.set(l.session_item_id, (focus.get(l.session_item_id) ?? 0) + m);
  }
  for (const it of (items ?? []) as SessionItem[]) {
    if (it.actual_minutes === null) {
      await supabase
        .from("session_items")
        .update({ actual_minutes: focus.get(it.id) ?? it.planned_minutes })
        .eq("id", it.id);
    }
  }
  await supabase.from("session_reviews").upsert(
    {
      user_id: user.id,
      session_id: sessionId,
      planned_snapshot: { session: s, items: items ?? [] },
    },
    { onConflict: "session_id", ignoreDuplicates: true },
  );
  revalidatePath(`/planner/${sessionId}/bilan`);
}

/** Valide le bilan : session `bilan_fait`, devoirs cochés → faits, `last_worked_at` des éléments de matière. */
export async function validateReview(sessionId: string, comment?: string) {
  const { supabase, user } = await requireUser();
  const now = new Date().toISOString();
  const { data: items } = await supabase.from("session_items").select("*").eq("session_id", sessionId);
  const { data: s } = await supabase.from("study_sessions").select("end_at").eq("id", sessionId).single();
  for (const it of (items ?? []) as SessionItem[]) {
    if (it.removed_in_review) continue;
    if (it.done && it.homework_id) {
      await supabase.from("homework").update({ status: "fait", done_at: now }).eq("id", it.homework_id);
      const hid = it.homework_id;
      const { pushHomeworkNow } = await import("@/lib/sync/push-one");
      after(() => pushHomeworkNow(user.id, hid));
    }
    if (it.done && it.prep_task_id) await supabase.from("prep_tasks").update({ done: true }).eq("id", it.prep_task_id);
    if (it.subject_item_id && (it.actual_minutes ?? 0) > 0) {
      await supabase.from("subject_items").update({ last_worked_at: s?.end_at ?? now }).eq("id", it.subject_item_id);
    }
  }
  await supabase.from("session_reviews").update({ reviewed_at: now, comment: comment || null }).eq("session_id", sessionId);
  await supabase.from("study_sessions").update({ status: "bilan_fait" }).eq("id", sessionId);
  after(() => pushSessionsNow(user.id));
  refresh();
}

// ---------------------------------------------------------------------------
// Focus
// ---------------------------------------------------------------------------
export async function startFocus(sessionItemId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("focus_logs").update({ ended_at: new Date().toISOString() }).eq("user_id", user.id).is("ended_at", null);
  const { data, error } = await supabase
    .from("focus_logs")
    .insert({ user_id: user.id, session_item_id: sessionItemId })
    .select("id, started_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function stopFocus() {
  const { supabase, user } = await requireUser();
  await supabase.from("focus_logs").update({ ended_at: new Date().toISOString() }).eq("user_id", user.id).is("ended_at", null);
  revalidatePath("/planner", "layout");
}

export async function todayKey() {
  return dateKey(new Date());
}
