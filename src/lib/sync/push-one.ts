import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadContext } from "@/lib/data/context";
import { getGoogleAccessToken } from "@/lib/google/token";
import { pushHomework, removeHomeworkTask, removeSessionEvent, syncSessionsToCalendar } from "./write";
import type { Homework } from "@/lib/types";

/** Répercussions immédiates vers Google après une action (best-effort ; le cron rattrape les échecs). */
async function withGoogle<T>(userId: string, fn: (a: { db: ReturnType<typeof createAdminClient>; ctx: Awaited<ReturnType<typeof loadContext>>; token: string }) => Promise<T>) {
  try {
    const db = createAdminClient();
    const ctx = await loadContext(db, userId);
    const token = await getGoogleAccessToken(userId);
    return await fn({ db, ctx, token });
  } catch (e) {
    console.error("[google]", e instanceof Error ? e.message : e);
    return null;
  }
}

export function pushHomeworkNow(userId: string, homeworkId: string) {
  return withGoogle(userId, async ({ db, ctx, token }) => {
    const { data } = await db.from("homework").select("*").eq("id", homeworkId).maybeSingle();
    if (data) await pushHomework(db, ctx, token, data as Homework);
  });
}

export function deleteHomeworkTaskNow(userId: string, googleTaskId: string) {
  return withGoogle(userId, ({ db, ctx, token }) => removeHomeworkTask(db, ctx, token, googleTaskId));
}

export function pushSessionsNow(userId: string) {
  return withGoogle(userId, ({ db, ctx, token }) => syncSessionsToCalendar(db, ctx, token));
}

export function deleteSessionEventNow(userId: string, googleEventId: string) {
  return withGoogle(userId, ({ db, ctx, token }) => removeSessionEvent(db, ctx, token, googleEventId));
}
