import { apiRoute } from "@/lib/api-auth";
import { getSummary } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/v1/summary — prochains DS/CB/khôlles, soirs restants, devoirs du jour, session de ce soir. */
export const GET = apiRoute((_req, { db, ctx }) => getSummary(db, ctx));
