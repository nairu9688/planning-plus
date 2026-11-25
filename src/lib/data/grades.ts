import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/data/context";
import { DEFAULT_COEFFICIENTS, type SubjectGrades } from "@/lib/domain/grades";
import { loadDs, loadKholles } from "@/lib/data/exams";

export const coefOf = (ctx: UserContext, key: string) => ctx.settings.coefficients?.[key] ?? DEFAULT_COEFFICIENTS[key] ?? 1;
export const goalOf = (ctx: UserContext, key: string) => ctx.settings.weekly_goals?.[key] ?? 0;

/** Notes de DS (ramenées sur 20) et de khôlles par matière, avec les coefficients en vigueur. */
export async function loadGrades(db: SupabaseClient, ctx: UserContext) {
  const [ds, kh] = await Promise.all([loadDs(db, ctx.userId), loadKholles(db, ctx.userId)]);
  const dsGrades: SubjectGrades[] = ctx.subjects.map((s) => ({
    key: s.key,
    coef: coefOf(ctx, s.key),
    grades: ds.filter((d) => d.subject_id === s.id && d.grade !== null).map((d) => (Number(d.grade) / Number(d.grade_max || 20)) * 20),
  }));
  const khGrades: SubjectGrades[] = ctx.subjects.map((s) => ({
    key: s.key,
    coef: coefOf(ctx, s.key),
    grades: kh.filter((k) => k.subject_id === s.id && k.grade !== null).map((k) => Number(k.grade)),
  }));
  const nextDs = Object.fromEntries(
    ctx.subjects.map((s) => {
      const d = ds.find((x) => x.subject_id === s.id && new Date(x.event.start_at) > new Date());
      return [s.key, d ? { title: d.event.title, start: d.event.start_at } : null];
    }),
  );
  return { dsGrades, khGrades, nextDs };
}
