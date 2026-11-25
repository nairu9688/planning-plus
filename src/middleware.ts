import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionExpiresAt } from "@/lib/auth/session-cookie";

const PUBLIC_PREFIXES = ["/login", "/auth", "/api/cron", "/api/v1", "/api/mcp", "/manifest.webmanifest", "/sw.js", "/icons"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Préchargement (Link) avec un jeton bientôt expiré : on ne rafraîchit pas la session ici.
  // Un préchargement est souvent interrompu ; le nouveau jeton n'arriverait alors jamais au
  // navigateur, qui réutiliserait l'ancien plus tard, et Supabase fermerait la session (déconnexion).
  // La vraie navigation, juste après, rafraîchira normalement.
  if (request.headers.get("next-router-prefetch") || request.headers.get("purpose") === "prefetch" || request.headers.get("sec-purpose")?.includes("prefetch")) {
    const exp = sessionExpiresAt(request.cookies.getAll());
    if (exp === null || exp - Date.now() < 120_000) return new NextResponse(null, { status: 204 });
  }

  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico|webp)$).*)"],
};
