"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data/auth";
import { correctLastFocus, getFocusStatus, hostSession, logWork, setWorkRange, startFreeFocus, stopAnyFocus } from "@/lib/focus";
import { addDays, parisDateTime, timeKey } from "@/lib/domain/time";
import { pushSessionsNow } from "@/lib/sync/push-one";

function refresh(userId: string) {
  after(() => pushSessionsNow(userId));
  revalidatePath("/", "layout");
}

/** Focus libre : démarre un chrono sur n'importe quelle matière. */
export async function startFreeFocusAction(subjectId: string | null, description?: string | null, sessionId?: string | null) {
  const { supabase, ctx, user } = await requireUser();
  const r = await startFreeFocus(supabase, ctx, { subjectId, description, sessionId });
  refresh(user.id);
  return r;
}

export async function stopFocusAction() {
  const { supabase, ctx, user } = await requireUser();
  const r = await stopAnyFocus(supabase, ctx);
  refresh(user.id);
  return r;
}

/** Ajout rapide : minutes déjà faites, sans chrono. */
export async function logWorkAction(subjectId: string | null, minutes: number, description?: string | null) {
  const { supabase, ctx, user } = await requireUser();
  const r = await logWork(supabase, ctx, { subjectId, minutes, description });
  refresh(user.id);
  return r;
}

/** « J'ai oublié de l'arrêter » : remplace la durée du dernier chrono de l'élément. */
export async function correctFocusAction(itemId: string, minutes: number) {
  const { supabase, ctx, user } = await requireUser();
  const r = await correctLastFocus(supabase, ctx, itemId, minutes);
  refresh(user.id);
  return r;
}

export async function focusStatusAction() {
  const { supabase, ctx } = await requireUser();
  return getFocusStatus(supabase, ctx);
}

const KIND: Record<string, string> = { etude: "Étude", maison: "Maison", bibliotheque: "Bibliothèque", libre: "Focus libre" };

/** Session à laquelle un Focus libre s'ajouterait maintenant (affichée dans le formulaire). */
export async function focusHostAction(): Promise<{ id: string; label: string } | null> {
  const { supabase, ctx } = await requireUser();
  const id = await hostSession(supabase, ctx, new Date());
  if (!id) return null;
  const { data } = await supabase.from("study_sessions").select("kind, start_at, end_at, status").eq("id", id).single();
  if (!data) return null;
  const label = `${KIND[data.kind] ?? "Session"} ${timeKey(data.start_at).replace(":", "h")}–${timeKey(data.end_at).replace(":", "h")}${data.status === "bilan_fait" ? " (bilan fait)" : ""}`;
  return { id, label };
}

/**
 * Horaires réels d'un élément (« de 18h23 à 19h03 ») : il est rangé dans l'étude s'il y tombe
 * majoritairement, sinon dans une session « Focus libre ». Erreurs renvoyées (pas levées :
 * elles seraient masquées en production).
 */
export async function setWorkRangeAction(itemId: string, date: string, start: string, end: string) {
  const { supabase, ctx, user } = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return { ok: false as const, error: "Horaires invalides" };
  const a = parisDateTime(date, start);
  const b = parisDateTime(end <= start ? addDays(date, 1) : date, end);
  try {
    const r = await setWorkRange(supabase, ctx, itemId, a, b);
    refresh(user.id);
    const { data } = await supabase.from("study_sessions").select("kind, notes, start_at, end_at").eq("id", r.sessionId).single();
    const where = data ? `${data.notes === "Focus libre" ? "session libre" : (KIND[data.kind] ?? "session").toLowerCase()} ${timeKey(data.start_at).replace(":", "h")}–${timeKey(data.end_at).replace(":", "h")}` : "session";
    return { ok: true as const, ...r, where };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Erreur" };
  }
}
