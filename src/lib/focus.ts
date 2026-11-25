import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/data/context";
import { loadUpcomingExams } from "@/lib/data/exams";
import { ensureReview } from "@/lib/data/review";
import { resolveTarget } from "@/lib/domain/targets";
import { dateKey } from "@/lib/domain/time";
import type { SubjectKey } from "@/lib/domain/subjects";

/** Marqueur des sessions créées par un Focus libre (bilan automatique à l'arrêt). */
export const FREE_FOCUS_NOTE = "Focus libre";

/** Résout une matière depuis un id, une clé (« droit ») ou un début de nom (« éco »). */
export function findSubjectId(ctx: UserContext, input?: string | null): string | null {
  if (!input) return null;
  const n = input.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const s =
    ctx.subjects.find((x) => x.id === input || x.key === n) ??
    ctx.subjects.find((x) => x.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().startsWith(n));
  return s?.id ?? null;
}

/** Session en cours maintenant (prévue, hors sport), sinon null. */
async function sessionInProgress(db: SupabaseClient, ctx: UserContext, now: Date) {
  const { data } = await db
    .from("study_sessions")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("status", "prevue")
    .neq("kind", "sport")
    .lte("start_at", now.toISOString())
    .gt("end_at", now.toISOString())
    .order("start_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id as string | undefined;
}

async function createFreeSession(db: SupabaseClient, ctx: UserContext, start: Date, end: Date) {
  const { data, error } = await db
    .from("study_sessions")
    .insert({
      user_id: ctx.userId,
      date: dateKey(start),
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      kind: "libre",
      status: "prevue",
      notes: FREE_FOCUS_NOTE,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function addFreeItem(db: SupabaseClient, ctx: UserContext, sessionId: string, sessionStart: Date, subjectId: string | null, description: string | null, minutes: number) {
  const exams = await loadUpcomingExams(db, ctx, sessionStart);
  const key = subjectId ? ((ctx.subjectById.get(subjectId)?.key as SubjectKey) ?? null) : null;
  const t = resolveTarget(key, "auto", sessionStart, exams);
  const { data, error } = await db
    .from("session_items")
    .insert({
      user_id: ctx.userId,
      session_id: sessionId,
      item_type: "revision",
      subject_id: subjectId,
      description: description || null,
      planned_minutes: 0,
      actual_minutes: minutes,
      done: minutes > 0,
      origin: "ajoute_au_bilan",
      target: t.target,
      target_ds_id: t.dsId,
      target_kholle_id: t.kholleId,
      sort_order: 900,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Clôt une session « Focus libre » : horaires réels et bilan automatique. */
async function closeFreeSession(db: SupabaseClient, ctx: UserContext, sessionId: string, start: Date, end: Date) {
  const realEnd = new Date(Math.max(end.getTime(), start.getTime() + 5 * 60_000));
  await db.from("study_sessions").update({ start_at: start.toISOString(), end_at: realEnd.toISOString(), date: dateKey(start) }).eq("id", sessionId);
  await ensureReview(db, ctx.userId, sessionId);
  await db.from("session_reviews").update({ reviewed_at: new Date().toISOString(), comment: FREE_FOCUS_NOTE }).eq("session_id", sessionId);
  await db.from("study_sessions").update({ status: "bilan_fait" }).eq("id", sessionId);
}

export interface FocusStatus {
  running: boolean;
  startedAt?: string;
  label?: string;
  color?: string | null;
  itemId?: string;
  sessionId?: string;
  free?: boolean;
}

/** Chrono en cours (Focus libre ou Focus d'une session). */
export async function getFocusStatus(db: SupabaseClient, ctx: UserContext): Promise<FocusStatus> {
  const { data } = await db
    .from("focus_logs")
    .select("started_at, item:session_items!inner(id, description, subject_id, session_id, session:study_sessions!inner(notes))")
    .eq("user_id", ctx.userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { running: false };
  const item = data.item as unknown as { id: string; description: string | null; subject_id: string | null; session_id: string; session: { notes: string | null } };
  const subject = item.subject_id ? ctx.subjectById.get(item.subject_id) : undefined;
  return {
    running: true,
    startedAt: data.started_at,
    label: [subject?.name, item.description].filter(Boolean).join(" · ") || "Focus",
    color: subject?.color ?? null,
    itemId: item.id,
    sessionId: item.session_id,
    free: item.session?.notes === FREE_FOCUS_NOTE,
  };
}

/** Démarre un chrono sur n'importe quelle matière. S'ajoute à la session en cours, sinon crée une session « libre ». */
export async function startFreeFocus(db: SupabaseClient, ctx: UserContext, input: { subjectId: string | null; description?: string | null }, now = new Date()) {
  await stopAnyFocus(db, ctx, now);
  let sessionId = await sessionInProgress(db, ctx, now);
  const sessionStart = now;
  if (!sessionId) sessionId = await createFreeSession(db, ctx, now, new Date(now.getTime() + 60 * 60_000));
  const itemId = await addFreeItem(db, ctx, sessionId, sessionStart, input.subjectId, input.description ?? null, 0);
  const { error } = await db.from("focus_logs").insert({ user_id: ctx.userId, session_item_id: itemId, started_at: now.toISOString() });
  if (error) throw new Error(error.message);
  return getFocusStatus(db, ctx);
}

/**
 * Arrête le chrono en cours : ajoute les minutes au réel de l'élément.
 * Pour un Focus libre hors session, la session « libre » est clôturée avec bilan automatique.
 */
export async function stopAnyFocus(db: SupabaseClient, ctx: UserContext, now = new Date()) {
  const { data: logs } = await db
    .from("focus_logs")
    .select("id, started_at, session_item_id, item:session_items!inner(id, actual_minutes, origin, session_id, session:study_sessions!inner(id, start_at, notes))")
    .eq("user_id", ctx.userId)
    .is("ended_at", null);
  let total = 0;
  let label: string | null = null;
  for (const l of logs ?? []) {
    const item = l.item as unknown as { id: string; actual_minutes: number | null; origin: string; session_id: string; session: { id: string; start_at: string; notes: string | null } };
    const minutes = Math.max(1, Math.round((now.getTime() - new Date(l.started_at).getTime()) / 60_000));
    total += minutes;
    await db.from("focus_logs").update({ ended_at: now.toISOString() }).eq("id", l.id);
    // Les éléments ajoutés en Focus libre cumulent directement leur réel ; ceux d'une session
    // prévue sont pré-remplis au bilan à partir des journaux (inchangé).
    if (item.origin === "ajoute_au_bilan") {
      await db.from("session_items").update({ actual_minutes: (item.actual_minutes ?? 0) + minutes, done: true }).eq("id", item.id);
    }
    if (item.session?.notes === FREE_FOCUS_NOTE) {
      await closeFreeSession(db, ctx, item.session.id, new Date(item.session.start_at), now);
    }
    const st = await db.from("session_items").select("description, subject_id").eq("id", item.id).single();
    label = [st.data?.subject_id ? ctx.subjectById.get(st.data.subject_id)?.name : null, st.data?.description].filter(Boolean).join(" · ") || null;
  }
  return { stopped: (logs ?? []).length > 0, minutes: total, label };
}

/** Ajout rapide sans chrono : « j'ai fait 20 min de droit sur Anki ». Compte tout de suite dans le réel. */
export async function logWork(db: SupabaseClient, ctx: UserContext, input: { subjectId: string | null; description?: string | null; minutes: number }, now = new Date()) {
  const minutes = Math.round(input.minutes);
  if (!(minutes > 0 && minutes <= 600)) throw new Error("Durée entre 1 et 600 minutes");
  const current = await sessionInProgress(db, ctx, now);
  if (current) {
    await addFreeItem(db, ctx, current, now, input.subjectId, input.description ?? null, minutes);
    return { sessionId: current, minutes, inSession: true };
  }
  const start = new Date(now.getTime() - minutes * 60_000);
  const sessionId = await createFreeSession(db, ctx, start, now);
  await addFreeItem(db, ctx, sessionId, start, input.subjectId, input.description ?? null, minutes);
  await closeFreeSession(db, ctx, sessionId, start, now);
  return { sessionId, minutes, inSession: false };
}
