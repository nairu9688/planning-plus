"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data/auth";
import { getFocusStatus, logWork, startFreeFocus, stopAnyFocus } from "@/lib/focus";
import { pushSessionsNow } from "@/lib/sync/push-one";

function refresh(userId: string) {
  after(() => pushSessionsNow(userId));
  revalidatePath("/", "layout");
}

/** Focus libre : démarre un chrono sur n'importe quelle matière. */
export async function startFreeFocusAction(subjectId: string | null, description?: string | null) {
  const { supabase, ctx, user } = await requireUser();
  const r = await startFreeFocus(supabase, ctx, { subjectId, description });
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

export async function focusStatusAction() {
  const { supabase, ctx } = await requireUser();
  return getFocusStatus(supabase, ctx);
}
