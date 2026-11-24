import "server-only";
import * as webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configured = false;
function configure() {
  if (configured) return true;
  const pub = env.vapidPublicKey();
  const priv = env.vapidPrivateKey();
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:planning-plus@users.noreply.github.com", pub, priv);
  configured = true;
  return true;
}

/** Envoie une notification à tous les appareils de l'utilisateur. Nettoie les abonnements expirés. */
export async function sendPush(db: SupabaseClient, userId: string, payload: PushPayload) {
  if (!configure()) return { sent: 0, skipped: "VAPID non configuré" };
  const { data: subs } = await db.from("push_subscriptions").select("*").eq("user_id", userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return { sent };
}

/** Envoie une seule fois par clé (journal `notification_log`). */
export async function sendOnce(db: SupabaseClient, userId: string, key: string, payload: PushPayload) {
  const { error } = await db.from("notification_log").insert({ user_id: userId, key });
  if (error) return { sent: 0, skipped: "déjà envoyé" }; // violation d'unicité = déjà fait
  return sendPush(db, userId, payload);
}
