import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let admin: SupabaseClient | null = null;

/** Client service role : contourne la RLS. À n'utiliser que côté serveur (cron, API, tokens Google). */
export function createAdminClient(): SupabaseClient {
  admin ??= createClient(env.supabaseUrl(), env.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
