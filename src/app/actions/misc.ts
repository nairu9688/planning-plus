"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/data/auth";
import { parisDateTime } from "@/lib/domain/time";
import { runUserSync } from "@/lib/sync/run";
import { randomToken, sha256 } from "@/lib/crypto";
import type { HolidayPeriod } from "@/lib/domain/holidays";
import type { SessionRules } from "@/lib/domain/sessions";

function refresh() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Post-its
// ---------------------------------------------------------------------------
export async function createNote(input: { content: string; color?: string; dueDate?: string | null; pinned?: boolean }) {
  const content = z.string().trim().min(1).parse(input.content);
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("notes").insert({
    user_id: user.id,
    content,
    color: input.color ?? "yellow",
    pinned: input.pinned ?? false,
    due_at: input.dueDate ? parisDateTime(input.dueDate, "08:00").toISOString() : null,
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function updateNote(id: string, patch: { content?: string; color?: string; pinned?: boolean; done?: boolean }) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("notes").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteNote(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("notes").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Liens
// ---------------------------------------------------------------------------
const LinkTarget = z.enum(["subject", "subject_item", "ds", "cb_period", "kholle", "homework", "prep_task", "global"]);

export async function createLink(input: { url: string; label?: string; targetType: string; targetId?: string | null }) {
  const url = z.string().url("URL invalide").parse(input.url.trim());
  const targetType = LinkTarget.parse(input.targetType);
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("links").insert({
    user_id: user.id,
    url,
    label: input.label?.trim() || null,
    target_type: targetType,
    target_id: targetType === "global" ? null : (input.targetId ?? null),
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteLink(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("links").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Synchro
// ---------------------------------------------------------------------------
export async function syncNow() {
  const { user } = await requireUser();
  const report = await runUserSync(user.id);
  refresh();
  return { ok: report.ok, error: report.error ?? null };
}

/** Synchro légère à l'ouverture de l'app si la dernière date de plus de 5 min. */
export async function syncIfStale() {
  const { user, ctx } = await requireUser();
  const last = ctx.settings.last_sync_at ? new Date(ctx.settings.last_sync_at).getTime() : 0;
  if (Date.now() - last < 5 * 60_000) return { skipped: true };
  after(() => runUserSync(user.id));
  return { skipped: false };
}

// ---------------------------------------------------------------------------
// Réglages
// ---------------------------------------------------------------------------
export async function setTheme(theme: "system" | "light" | "dark") {
  const { supabase, user } = await requireUser();
  await supabase.from("settings").update({ theme }).eq("user_id", user.id);
  (await cookies()).set("pp-theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  refresh();
}

export async function updateSettings(patch: {
  week_a_reference_date?: string;
  kholles_calendar_id?: string | null;
  primary_calendar_id?: string;
  session_rules?: SessionRules;
  holidays?: HolidayPeriod[];
  notification_prefs?: Record<string, boolean>;
  neglected_after_days?: number;
  weekly_goals?: Record<string, number>;
  coefficients?: Record<string, number>;
  target_average?: number;
}) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("settings").update(patch).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function updateSubject(id: string, patch: { name?: string; color?: string; teacher?: string | null; sort_order?: number }) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("subjects").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

/** Correction manuelle de la classification d'un événement Google. */
export async function setEventOverride(calendarEventId: string, input: { subjectId: string | null; kind: string | null }) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("event_overrides").upsert(
    {
      user_id: user.id,
      calendar_event_id: calendarEventId,
      subject_id: input.subjectId,
      clear_subject: input.subjectId === null,
      kind: input.kind,
    },
    { onConflict: "calendar_event_id" },
  );
  if (error) throw new Error(error.message);
  await supabase
    .from("calendar_events")
    .update({ subject_id: input.subjectId, ...(input.kind ? { kind: input.kind } : {}) })
    .eq("id", calendarEventId);
  after(() => runUserSync(user.id));
  refresh();
}

// ---------------------------------------------------------------------------
// Push et tokens API
// ---------------------------------------------------------------------------
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent ?? null },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

export async function sendTestPush() {
  const { user } = await requireUser();
  const { sendPush } = await import("@/lib/push");
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return sendPush(createAdminClient(), user.id, { title: "Planning+", body: "Les notifications fonctionnent.", url: "/" });
}

export async function createApiToken(name: string) {
  const { supabase, user } = await requireUser();
  const token = `pp_${randomToken(24)}`;
  const { error } = await supabase.from("api_tokens").insert({
    user_id: user.id,
    name: name.trim() || "Token",
    token_hash: sha256(token),
    token_prefix: token.slice(0, 7),
  });
  if (error) throw new Error(error.message);
  refresh();
  return token; // affiché une seule fois
}

export async function revokeApiToken(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("api_tokens").delete().eq("id", id);
  refresh();
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
}
