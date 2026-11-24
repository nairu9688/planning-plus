import { apiRoute } from "@/lib/api-auth";
import { getWidgetData } from "@/lib/data/widget";

export const dynamic = "force-dynamic";

/** GET /api/v1/widget?days=3 — toutes les données des widgets Scriptable en un appel. */
export const GET = apiRoute((req, { db, ctx }) => {
  const days = Number(new URL(req.url).searchParams.get("days") ?? 3);
  return getWidgetData(db, ctx, { days });
});
