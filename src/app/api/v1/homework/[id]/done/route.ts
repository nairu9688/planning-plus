import { apiRoute } from "@/lib/api-auth";
import { markHomeworkDone } from "@/lib/services";

/** POST /api/v1/homework/:id/done */
export const POST = apiRoute<{ id: string }>((_req, { db, ctx }, { id }) => markHomeworkDone(db, ctx, id), { write: true });
