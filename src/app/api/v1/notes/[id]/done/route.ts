import { apiRoute } from "@/lib/api-auth";

/** POST /api/v1/notes/:id/done — marque un post-it comme fait. */
export const POST = apiRoute<{ id: string }>(async (_req, { db, ctx }, { id }) => {
  const { data, error } = await db.from("notes").update({ done: true }).eq("id", id).eq("user_id", ctx.userId).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Post-it introuvable");
  return { ok: true };
}, { write: true });
