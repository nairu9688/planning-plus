import { apiRoute, readJson } from "@/lib/api-auth";
import { setSessionModeFor } from "@/lib/services";

/** POST /api/v1/sessions/:id/mode — { "mode": "etude" | "maison" } (sans corps : bascule). */
export const POST = apiRoute<{ id: string }>(async (req, { db, ctx }, { id }) => {
  const body = await readJson<{ mode?: "etude" | "maison" }>(req);
  let mode = body.mode;
  if (!mode) {
    const { data } = await db.from("study_sessions").select("kind").eq("id", id).eq("user_id", ctx.userId).maybeSingle();
    mode = data?.kind === "maison" ? "etude" : "maison";
  }
  if (mode !== "etude" && mode !== "maison") throw new Error("mode doit valoir etude ou maison");
  return setSessionModeFor(db, ctx, id, mode);
}, { write: true });
