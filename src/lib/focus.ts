import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/data/context";
import { loadUpcomingExams } from "@/lib/data/exams";
import { ensureReview } from "@/lib/data/review";
import { resolveTarget } from "@/lib/domain/targets";
import { dateKey } from "@/lib/domain/time";
import { capFocusMinutes, pickHostSession } from "@/lib/domain/focus-host";
import { sendOnce } from "@/lib/push";
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

/**
 * Session qui accueille un Focus libre : la session du soir (en cours ou proche, même bilan fait),
 * sinon une session « Focus libre » récente. Null s'il faut en créer une.
 */
export async function hostSession(db: SupabaseClient, ctx: UserContext, now: Date): Promise<string | null> {
  const { data } = await db
    .from("study_sessions")
    .select("id, kind, status, start_at, end_at, notes")
    .eq("user_id", ctx.userId)
    .gte("end_at", new Date(now.getTime() - 6 * 3600_000).toISOString())
    .lte("start_at", new Date(now.getTime() + 3 * 3600_000).toISOString());
  return pickHostSession(
    (data ?? []).map((x) => ({ id: x.id, kind: x.kind, status: x.status, start: x.start_at, end: x.end_at, free: x.notes === FREE_FOCUS_NOTE })),
    now,
  );
}

/** Une session « Focus libre » réutilisée s'étend jusqu'à maintenant. */
async function stretchFreeSession(db: SupabaseClient, sessionId: string, from: Date, to: Date) {
  const { data } = await db.from("study_sessions").select("start_at, end_at, notes").eq("id", sessionId).single();
  if (data?.notes !== FREE_FOCUS_NOTE) return;
  const start = new Date(Math.min(Date.parse(data.start_at), from.getTime()));
  const end = new Date(Math.max(Date.parse(data.end_at), to.getTime()));
  await db.from("study_sessions").update({ start_at: start.toISOString(), end_at: end.toISOString() }).eq("id", sessionId);
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
export async function startFreeFocus(
  db: SupabaseClient,
  ctx: UserContext,
  input: { subjectId: string | null; description?: string | null; sessionId?: string | null },
  now = new Date(),
) {
  await stopAnyFocus(db, ctx, now);
  let sessionId = input.sessionId || (await hostSession(db, ctx, now));
  if (!sessionId) sessionId = await createFreeSession(db, ctx, now, new Date(now.getTime() + 60 * 60_000));
  else await stretchFreeSession(db, sessionId, now, new Date(now.getTime() + 5 * 60_000));
  // Même matière (et même description) déjà dans la session : le chrono s'y ajoute, pas de doublon.
  const { data: same } = await db
    .from("session_items")
    .select("id, description")
    .eq("session_id", sessionId)
    .eq("removed_in_review", false)
    .match(input.subjectId ? { subject_id: input.subjectId } : {})
    .limit(20);
  const desc = (input.description ?? "").trim().toLowerCase();
  const reuse = input.subjectId ? (same ?? []).find((x) => (x.description ?? "").trim().toLowerCase() === desc || (!desc && true)) : undefined;
  const itemId = reuse?.id ?? (await addFreeItem(db, ctx, sessionId, now, input.subjectId, input.description ?? null, 0));
  const { error } = await db.from("focus_logs").insert({ user_id: ctx.userId, session_item_id: itemId, started_at: now.toISOString() });
  if (error) throw new Error(error.message);
  return getFocusStatus(db, ctx);
}

/**
 * Arrête le chrono en cours et compte ses minutes (plafonnées si le chrono a été oublié :
 * au plus 30 min après la fin de la session, 4 h pour un Focus libre hors session).
 * Les éléments ajoutés en Focus libre, ou d'une session dont le bilan est fait, cumulent
 * directement leur réel ; les autres sont pré-remplis au bilan à partir des journaux.
 */
export async function stopAnyFocus(db: SupabaseClient, ctx: UserContext, now = new Date()) {
  const { data: logs } = await db
    .from("focus_logs")
    .select("id, started_at, session_item_id, item:session_items!inner(id, actual_minutes, origin, session_id, description, subject_id, session:study_sessions!inner(id, start_at, end_at, status, notes))")
    .eq("user_id", ctx.userId)
    .is("ended_at", null);
  let total = 0;
  let label: string | null = null;
  let lastItem: string | null = null;
  let lastSession: string | null = null;
  for (const l of logs ?? []) {
    const item = l.item as unknown as {
      id: string;
      actual_minutes: number | null;
      origin: string;
      description: string | null;
      subject_id: string | null;
      session: { id: string; start_at: string; end_at: string; status: string; notes: string | null };
    };
    const free = item.session?.notes === FREE_FOCUS_NOTE;
    const started = new Date(l.started_at);
    const minutes = capFocusMinutes(started, now, free ? null : new Date(item.session.end_at));
    const ended = new Date(Math.min(now.getTime(), started.getTime() + minutes * 60_000));
    total += minutes;
    await db.from("focus_logs").update({ ended_at: ended.toISOString() }).eq("id", l.id);
    if (item.origin === "ajoute_au_bilan" || item.session.status === "bilan_fait" || item.actual_minutes !== null) {
      await db.from("session_items").update({ actual_minutes: (item.actual_minutes ?? 0) + minutes, done: true }).eq("id", item.id);
    }
    if (free) {
      const start = new Date(Math.min(Date.parse(item.session.start_at), started.getTime()));
      await closeFreeSession(db, ctx, item.session.id, start, ended);
    }
    label = [item.subject_id ? ctx.subjectById.get(item.subject_id)?.name : null, item.description].filter(Boolean).join(" · ") || null;
    lastItem = item.id;
    lastSession = item.session.id;
  }
  return { stopped: (logs ?? []).length > 0, minutes: total, label, itemId: lastItem, sessionId: lastSession };
}

/**
 * Ajout rapide sans chrono : « j'ai fait 20 min de droit sur Anki ». S'ajoute à la session du soir
 * (en cours ou proche, même bilan fait), sinon à une session « libre » bilan faite. Compte tout de suite.
 */
export async function logWork(db: SupabaseClient, ctx: UserContext, input: { subjectId: string | null; description?: string | null; minutes: number }, now = new Date()) {
  const minutes = Math.round(input.minutes);
  if (!(minutes > 0 && minutes <= 600)) throw new Error("Durée entre 1 et 600 minutes");
  const start = new Date(now.getTime() - minutes * 60_000);
  const host = await hostSession(db, ctx, now);
  if (host) {
    await addFreeItem(db, ctx, host, now, input.subjectId, input.description ?? null, minutes);
    await stretchFreeSession(db, host, start, now);
    return { sessionId: host, minutes, inSession: true };
  }
  const sessionId = await createFreeSession(db, ctx, start, now);
  await addFreeItem(db, ctx, sessionId, start, input.subjectId, input.description ?? null, minutes);
  await closeFreeSession(db, ctx, sessionId, start, now);
  return { sessionId, minutes, inSession: false };
}

/** Cron : arrête un chrono oublié (au-delà de son plafond), pour que la pastille ne tourne pas la nuit. */
export async function closeStaleFocus(db: SupabaseClient, ctx: UserContext, now = new Date()) {
  const { data } = await db
    .from("focus_logs")
    .select("id, started_at, item:session_items!inner(session_id, session:study_sessions!inner(end_at, notes))")
    .eq("user_id", ctx.userId)
    .is("ended_at", null);
  // Chrono qui tourne encore après la fin de la session (ou 1 h 30 hors session) : une notification.
  for (const l of data ?? []) {
    const it = l.item as unknown as { session_id: string; session: { end_at: string; notes: string | null } };
    const free = it.session.notes === FREE_FOCUS_NOTE;
    const late = free ? now.getTime() - Date.parse(l.started_at) > 90 * 60_000 : now.getTime() > Date.parse(it.session.end_at) + 10 * 60_000;
    if (late) {
      const min = Math.round((now.getTime() - Date.parse(l.started_at)) / 60_000);
      await sendOnce(db, ctx.userId, `focus-long:${l.id}`, {
        title: "Ton chrono tourne toujours",
        body: `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} : arrête-le et corrige la durée si besoin.`,
        url: `/planner/${it.session_id}/focus`,
        tag: "focus-long",
      });
    }
  }
  const stale = (data ?? []).some((l) => {
    const sess = (l.item as unknown as { session: { end_at: string; notes: string | null } }).session;
    const started = new Date(l.started_at);
    const capped = capFocusMinutes(started, now, sess.notes === FREE_FOCUS_NOTE ? null : new Date(sess.end_at));
    return now.getTime() - started.getTime() > capped * 60_000 + 60_000;
  });
  if (!stale) return { stopped: 0 };
  const r = await stopAnyFocus(db, ctx, now);
  return { stopped: 1, minutes: r.minutes };
}

/**
 * Corrige la durée du dernier chrono d'un élément (« j'ai oublié de l'arrêter ») :
 * raccourcit le journal et ajuste le temps fait de l'élément (et la fin d'une session Focus libre).
 */
export async function correctLastFocus(db: SupabaseClient, ctx: UserContext, itemId: string, minutes: number) {
  const m = Math.round(minutes);
  if (!(m >= 0 && m <= 600)) throw new Error("Durée entre 0 et 600 minutes");
  const { data: log } = await db
    .from("focus_logs")
    .select("id, started_at, ended_at, item:session_items!inner(id, actual_minutes, session:study_sessions!inner(id, notes, start_at))")
    .eq("user_id", ctx.userId)
    .eq("session_item_id", itemId)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!log) return { ok: false };
  const item = log.item as unknown as { id: string; actual_minutes: number | null; session: { id: string; notes: string | null; start_at: string } };
  const old = Math.round((Date.parse(log.ended_at!) - Date.parse(log.started_at)) / 60_000);
  const ended = new Date(Date.parse(log.started_at) + m * 60_000);
  await db.from("focus_logs").update({ ended_at: ended.toISOString() }).eq("id", log.id);
  if (item.actual_minutes !== null) {
    await db.from("session_items").update({ actual_minutes: Math.max(0, item.actual_minutes + m - old) }).eq("id", item.id);
  }
  if (item.session.notes === FREE_FOCUS_NOTE) {
    const end = new Date(Math.max(ended.getTime(), Date.parse(item.session.start_at) + 5 * 60_000));
    await db.from("study_sessions").update({ end_at: end.toISOString() }).eq("id", item.session.id);
  }
  return { ok: true, minutes: m };
}
