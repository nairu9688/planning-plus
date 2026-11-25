import { apiRoute } from "@/lib/api-auth";
import { stopAnyFocus } from "@/lib/focus";

/** POST /api/v1/focus/stop — arrête le chrono et ajoute les minutes au réel. */
export const POST = apiRoute(async (_req, { db, ctx }) => {
  const r = await stopAnyFocus(db, ctx);
  return { ...r, text: r.stopped ? `${r.minutes} minutes${r.label ? ` de ${r.label}` : ""} ajoutées.` : "Aucun chrono en cours." };
}, { write: true });
