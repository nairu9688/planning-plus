import { apiRoute, readJson } from "@/lib/api-auth";
import { findSubjectId, getFocusStatus, startFreeFocus, stopAnyFocus } from "@/lib/focus";

/**
 * POST /api/v1/focus/start — { "subject": "droit", "description": "Anki" }
 * « toggle": true » : arrête le chrono s'il tourne déjà (pratique pour un tag NFC).
 */
export const POST = apiRoute(async (req, { db, ctx }) => {
  const body = await readJson<{ subject?: string; description?: string; toggle?: boolean }>(req);
  if (body.toggle) {
    const st = await getFocusStatus(db, ctx);
    if (st.running) {
      const r = await stopAnyFocus(db, ctx);
      return { action: "stopped", ...r, text: `Chrono arrêté : ${r.minutes} minutes${r.label ? ` de ${r.label}` : ""} ajoutées.` };
    }
  }
  const st = await startFreeFocus(db, ctx, { subjectId: findSubjectId(ctx, body.subject), description: body.description ?? null });
  return { action: "started", ...st, text: `Chrono lancé${st.label && st.label !== "Focus" ? ` : ${st.label}` : ""}.` };
}, { write: true });
