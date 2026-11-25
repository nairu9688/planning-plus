import { apiRoute } from "@/lib/api-auth";
import { getFocusStatus } from "@/lib/focus";

export const dynamic = "force-dynamic";

/** GET /api/v1/focus — chrono en cours + liste des matières (pour les menus des raccourcis). */
export const GET = apiRoute(async (_req, { db, ctx }) => ({
  ...(await getFocusStatus(db, ctx)),
  subjects: ctx.subjects.map((s) => ({ key: s.key, name: s.name })),
  subjectNames: ctx.subjects.map((s) => s.name),
}));
