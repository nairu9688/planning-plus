import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadContext } from "@/lib/data/context";

/** Utilisateur connecté + contexte (réglages, matières). Mis en cache pour la requête. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const ctx = await loadContext(supabase, user.id);
  return { supabase, user, ctx };
});
