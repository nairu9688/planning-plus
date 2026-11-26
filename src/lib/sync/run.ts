import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadContext } from "@/lib/data/context";
import { getGoogleAccessToken } from "@/lib/google/token";
import { syncCalendarsRead } from "./read";
import { generateUpcomingSessions, syncHomework, syncSessionsToCalendar } from "./write";
import { runNotifications } from "@/lib/notifications";
import { closeStaleFocus } from "@/lib/focus";

export interface SyncReport {
  userId: string;
  ok: boolean;
  steps: Record<string, unknown>;
  error?: string;
}

/** Synchro complète d'un utilisateur (service role). Chaque étape est isolée. */
export async function runUserSync(userId: string, opts: { notifications?: boolean } = {}): Promise<SyncReport> {
  const db = createAdminClient();
  const ctx = await loadContext(db, userId);
  const steps: Record<string, unknown> = {};
  const errors: string[] = [];

  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      steps[name] = await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      steps[name] = { error: msg };
      errors.push(`${name} : ${msg}`);
    }
  };

  let token: string | null = null;
  await step("token", async () => {
    token = await getGoogleAccessToken(userId);
    return "ok";
  });

  if (token) {
    const t = token;
    await step("calendars", () => syncCalendarsRead(db, ctx, t));
    await step("homework", () => syncHomework(db, ctx, t));
  }
  await step("generate", () => generateUpcomingSessions(db, ctx));
  if (token) {
    const t = token;
    await step("sessions", () => syncSessionsToCalendar(db, ctx, t));
  }
  if (opts.notifications) {
    await step("focus", () => closeStaleFocus(db, ctx));
    await step("notifications", () => runNotifications(db, ctx));
  }

  await db
    .from("settings")
    .update({ last_sync_at: new Date().toISOString(), last_sync_error: errors.length ? errors.join(" · ").slice(0, 1000) : null })
    .eq("user_id", userId);

  return { userId, ok: errors.length === 0, steps, error: errors.join(" · ") || undefined };
}

/** Tous les utilisateurs ayant un compte Google relié (en pratique : un seul). */
export async function runAllSyncs(opts: { notifications?: boolean } = {}) {
  const db = createAdminClient();
  const { data } = await db.from("google_accounts").select("user_id");
  const reports: SyncReport[] = [];
  for (const row of data ?? []) reports.push(await runUserSync(row.user_id, opts));
  return reports;
}
