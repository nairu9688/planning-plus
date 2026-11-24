import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadContext, type UserContext } from "@/lib/data/context";
import { sha256 } from "@/lib/crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ApiAuth {
  db: SupabaseClient;
  ctx: UserContext;
  scopes: string[];
}

/** Authentifie une requête via `Authorization: Bearer pp_…` (ou `?token=` pour Scriptable). */
export async function authenticateToken(req: Request): Promise<ApiAuth | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : new URL(req.url).searchParams.get("token");
  if (!token || !token.startsWith("pp_")) return null;
  const db = createAdminClient();
  const { data } = await db.from("api_tokens").select("id, user_id, scopes").eq("token_hash", sha256(token)).maybeSingle();
  if (!data) return null;
  await db.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { db, ctx: await loadContext(db, data.user_id), scopes: data.scopes ?? [] };
}

export function unauthorized() {
  return NextResponse.json({ error: "Token invalide ou manquant" }, { status: 401 });
}

/** Enveloppe une route API v1 : auth + gestion d'erreurs JSON + CORS minimal. */
export function apiRoute<P = Record<string, string>>(
  handler: (req: Request, auth: ApiAuth, params: P) => Promise<unknown>,
  opts: { write?: boolean } = {},
) {
  return async (req: Request, context: { params: Promise<P> }) => {
    const auth = await authenticateToken(req);
    if (!auth) return unauthorized();
    if (opts.write && !auth.scopes.includes("write")) return NextResponse.json({ error: "Scope write requis" }, { status: 403 });
    try {
      const result = await handler(req, auth, await context.params);
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 });
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
