"use server";

import { requireUser } from "@/lib/data/auth";
import { loadGrid } from "@/lib/data/week";
import { mondayOf, weekLetter } from "@/lib/domain/time";

/** Données de la grille sur une plage de jours (vue 3 jours sur iPhone). */
export async function getGridRange(from: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error("Date invalide");
  const { supabase, ctx } = await requireUser();
  const n = Math.min(14, Math.max(1, Math.round(days)));
  return { from, days: n, ...(await loadGrid(supabase, ctx, from, n)) };
}

/** Données d'une semaine de la grille (navigation depuis le tableau de bord). */
export async function getWeekGrid(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date invalide");
  const { supabase, ctx } = await requireUser();
  const monday = mondayOf(date);
  const grid = await loadGrid(supabase, ctx, monday, 7);
  return { monday, week: weekLetter(monday, ctx.settings.week_a_reference_date), ...grid };
}
