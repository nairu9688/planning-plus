import { apiRoute } from "@/lib/api-auth";
import { getTonightForShortcut } from "@/lib/data/brief";

export const dynamic = "force-dynamic";

/** GET /api/v1/shortcut/tonight — session de ce soir pour le raccourci « Concentration » (hasSession, start, end, text). */
export const GET = apiRoute((_req, { db, ctx }) => getTonightForShortcut(db, ctx));
