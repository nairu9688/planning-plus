import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";

export class GoogleAuthError extends Error {}

/** Stocke (chiffrés) les tokens Google renvoyés par Supabase Auth après la connexion. */
export async function saveGoogleTokens(input: {
  userId: string;
  email: string;
  accessToken: string | null | undefined;
  refreshToken: string | null | undefined;
}) {
  const admin = createAdminClient();
  const row: Record<string, unknown> = {
    user_id: input.userId,
    email: input.email,
  };
  if (input.accessToken) {
    row.access_token_enc = encrypt(input.accessToken);
    row.expires_at = new Date(Date.now() + 55 * 60_000).toISOString();
  }
  if (input.refreshToken) row.refresh_token_enc = encrypt(input.refreshToken);
  const { error } = await admin.from("google_accounts").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

/** Retourne un access token Google valide (rafraîchi si besoin). Service role uniquement. */
export async function getGoogleAccessToken(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("google_accounts")
    .select("access_token_enc, refresh_token_enc, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new GoogleAuthError("Compte Google non connecté");

  const valid = data.access_token_enc && data.expires_at && new Date(data.expires_at).getTime() > Date.now() + 60_000;
  if (valid) return decrypt(data.access_token_enc);

  if (!data.refresh_token_enc) throw new GoogleAuthError("Pas de refresh token : reconnecte-toi avec Google");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId(),
      client_secret: env.googleClientSecret(),
      refresh_token: decrypt(data.refresh_token_enc),
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new GoogleAuthError(`Refresh Google refusé : ${json.error ?? res.status}`);

  await admin
    .from("google_accounts")
    .update({
      access_token_enc: encrypt(json.access_token),
      expires_at: new Date(Date.now() + (json.expires_in - 60) * 1000).toISOString(),
      ...(json.refresh_token ? { refresh_token_enc: encrypt(json.refresh_token) } : {}),
    })
    .eq("user_id", userId);
  return json.access_token;
}
