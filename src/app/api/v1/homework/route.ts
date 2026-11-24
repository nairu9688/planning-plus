import { apiRoute, readJson } from "@/lib/api-auth";
import { createHomeworkFor } from "@/lib/services";

/**
 * POST /api/v1/homework
 * { "title": "Fiche chapitre 3", "subject": "droit", "dueDate": "2026-11-27", "dueTime": "08:00", "description": "…" }
 */
export const POST = apiRoute(async (req, { db, ctx }) => {
  const body = await readJson<Parameters<typeof createHomeworkFor>[2]>(req);
  return createHomeworkFor(db, ctx, body);
}, { write: true });
