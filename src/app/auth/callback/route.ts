import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveGoogleTokens } from "@/lib/google/token";
import { env } from "@/lib/env";
import { ensureBootstrap } from "@/lib/data/context";
import { runUserSync } from "@/lib/sync/run";
import { after } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const fail = (reason: string) => NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);

  if (!code) return fail(searchParams.get("error_description") ?? "Code OAuth manquant");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) return fail(error?.message ?? "Échec de la connexion");

  const { user, provider_token, provider_refresh_token } = data.session;
  const email = (user.email ?? "").toLowerCase();
  if (!env.allowedEmails().includes(email)) {
    await supabase.auth.signOut();
    return fail("Ce compte Google n'est pas autorisé");
  }

  await saveGoogleTokens({
    userId: user.id,
    email,
    accessToken: provider_token,
    refreshToken: provider_refresh_token,
  });
  await ensureBootstrap(supabase, user.id);

  // Première synchro en arrière-plan, sans bloquer la redirection.
  after(async () => {
    try {
      await runUserSync(user.id);
    } catch (e) {
      console.error("Synchro post-connexion", e);
    }
  });

  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/"}`);
}
