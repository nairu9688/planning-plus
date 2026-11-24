import { apiRoute } from "@/lib/api-auth";
import { runUserSync } from "@/lib/sync/run";

export const maxDuration = 60;

/** POST /api/v1/sync — lance une synchro Google immédiate (bouton des widgets). */
export const POST = apiRoute(async (_req, { ctx }) => {
  const r = await runUserSync(ctx.userId);
  return { ok: r.ok, error: r.error ?? null };
}, { write: true });
