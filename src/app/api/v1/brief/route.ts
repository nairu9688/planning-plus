import { apiRoute } from "@/lib/api-auth";
import { getBrief } from "@/lib/data/brief";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/brief?jour=demain|aujourdhui — phrase prête à lire par Siri (« text ») + détails.
 * Par défaut : demain. Accepte aussi day=tomorrow|today.
 */
export const GET = apiRoute((req, { db, ctx }) => {
  const q = new URL(req.url).searchParams;
  const v = (q.get("jour") ?? q.get("day") ?? "demain").toLowerCase();
  const which = ["aujourdhui", "aujourd'hui", "today", "auj"].includes(v) ? "today" : "tomorrow";
  return getBrief(db, ctx, which);
});
