import { apiRoute, readJson } from "@/lib/api-auth";
import { createNoteFor } from "@/lib/services";

/** POST /api/v1/notes — { "content": "…", "color": "yellow", "dueDate": "2026-11-27" } */
export const POST = apiRoute(async (req, { db, ctx }) => createNoteFor(db, ctx, await readJson(req)), { write: true });
