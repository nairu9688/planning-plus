import { apiRoute, readJson } from "@/lib/api-auth";
import { findSubjectId, logWork } from "@/lib/focus";

/** POST /api/v1/focus/log — { "subject": "droit", "minutes": 20, "description": "Anki" } : ajout rapide sans chrono. */
export const POST = apiRoute(async (req, { db, ctx }) => {
  const body = await readJson<{ subject?: string; minutes?: number | string; description?: string }>(req);
  const minutes = Number(String(body.minutes ?? "").replace(/[^0-9]/g, ""));
  const r = await logWork(db, ctx, { subjectId: findSubjectId(ctx, body.subject), minutes, description: body.description ?? null });
  return { ...r, text: `${minutes} minutes ajoutées${body.subject ? ` en ${body.subject}` : ""}.` };
}, { write: true });
