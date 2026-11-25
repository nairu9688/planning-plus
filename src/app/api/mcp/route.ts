import { NextResponse } from "next/server";
import { authenticateToken, type ApiAuth } from "@/lib/api-auth";
import {
  addItemFor,
  createHomeworkFor,
  createNoteFor,
  createSessionFor,
  dsPreparation,
  getSummary,
  listDeadlines,
  listSessions,
  markHomeworkDone,
  reviewSessionFor,
  setSessionModeFor,
  updateHomeworkFor,
} from "@/lib/services";
import { addDays, dateKey } from "@/lib/domain/time";
import { findSubjectId, logWork, startFreeFocus, stopAnyFocus } from "@/lib/focus";
import { getBrief } from "@/lib/data/brief";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Serveur MCP « Planning+ » — transport HTTP streamable, mode sans état (réponses JSON).
 * Authentification : `Authorization: Bearer <token API>` (Réglages → Tokens API).
 */

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const itemSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["homework", "revision", "prep_task", "sport"] },
    homeworkId: { type: "string", description: "ID d'un devoir existant (type homework)" },
    subject: { type: "string", description: "Matière : clé (maths, eco, droit, management, anglais, espagnol, lettres, philo) ou nom" },
    subjectItemId: { type: "string" },
    prepTaskId: { type: "string" },
    description: { type: "string" },
    minutes: { type: "number" },
    target: { type: "string", enum: ["auto", "next_ds", "next_kholle", "none"], description: "Par défaut auto = le plus proche entre prochain DS et prochaine khôlle de la matière" },
  },
  required: ["type", "minutes"],
};

type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  write?: boolean;
  run: (args: Record<string, unknown>, auth: ApiAuth) => Promise<unknown>;
};

const TOOLS: Tool[] = [
  {
    name: "get_summary",
    description: "Résumé du jour : prochain DS / CB / khôlle avec compte à rebours (soirs, week-ends), devoirs du jour, session de ce soir, travail de la semaine.",
    inputSchema: { type: "object", properties: {} },
    run: (_a, { db, ctx }) => getSummary(db, ctx),
  },
  {
    name: "list_deadlines",
    description: "Échéances à venir (DS, khôlles, devoirs) avec le temps travaillé sur 7 jours pour chaque DS / khôlle.",
    inputSchema: { type: "object", properties: { days: { type: "number", description: "Horizon en jours (défaut 21)" } } },
    run: (a, { db, ctx }) => listDeadlines(db, ctx, Number(a.days ?? 21)),
  },
  {
    name: "list_homework",
    description: "Liste les devoirs (par défaut ceux non faits).",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: ["ouverts", "fait", "tous"] } } },
    run: async (a, { db, ctx }) => {
      let q = db.from("homework").select("id, title, subject_id, due_at, status, priority, estimated_minutes, description").eq("user_id", ctx.userId).order("due_at", { nullsFirst: false });
      if ((a.status ?? "ouverts") === "ouverts") q = q.neq("status", "fait");
      if (a.status === "fait") q = q.eq("status", "fait");
      const { data } = await q;
      return (data ?? []).map((h) => ({ ...h, subject: h.subject_id ? ctx.subjectById.get(h.subject_id)?.name : null }));
    },
  },
  {
    name: "create_homework",
    description: "Crée un devoir (synchronisé vers Google Tasks, liste « Prépa »).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        subject: { type: "string" },
        dueDate: { type: "string", description: "YYYY-MM-DD (Europe/Paris)" },
        dueTime: { type: "string", description: "HH:MM" },
        description: { type: "string" },
        estimatedMinutes: { type: "number" },
        priority: { type: "string", enum: ["basse", "normale", "haute"] },
      },
      required: ["title"],
    },
    write: true,
    run: (a, { db, ctx }) => createHomeworkFor(db, ctx, a as never),
  },
  {
    name: "update_homework",
    description: "Modifie un devoir (titre, matière, échéance, description, statut a_faire/en_cours/fait).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        subject: { type: "string" },
        dueDate: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["a_faire", "en_cours", "fait"] },
        estimatedMinutes: { type: "number" },
      },
      required: ["id"],
    },
    write: true,
    run: (a, { db, ctx }) => updateHomeworkFor(db, ctx, String(a.id), a as never),
  },
  {
    name: "complete_homework",
    description: "Coche un devoir comme fait.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    write: true,
    run: (a, { db, ctx }) => markHomeworkDone(db, ctx, String(a.id)),
  },
  {
    name: "list_sessions",
    description: "Liste les sessions de travail et leurs éléments entre deux dates (défaut : aujourd'hui → +7 j).",
    inputSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } } },
    run: (a, { db, ctx }) => {
      const today = dateKey(new Date());
      return listSessions(db, ctx, String(a.from ?? today), String(a.to ?? addDays(today, 7)));
    },
  },
  {
    name: "create_session",
    description: "Crée une session de travail confirmée et ses éléments (poussée vers le calendrier Google « Planning+ »).",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        start: { type: "string", description: "HH:MM" },
        end: { type: "string", description: "HH:MM" },
        kind: { type: "string", enum: ["etude", "maison", "bibliotheque", "sport", "libre"] },
        location: { type: "string" },
        items: { type: "array", items: itemSchema },
      },
      required: ["date", "start", "end"],
    },
    write: true,
    run: (a, { db, ctx }) => createSessionFor(db, ctx, a as never),
  },
  {
    name: "add_session_item",
    description: "Ajoute un élément (devoir, révision, tâche de DS, sport) à une session existante.",
    inputSchema: { type: "object", properties: { sessionId: { type: "string" }, item: itemSchema }, required: ["sessionId", "item"] },
    write: true,
    run: (a, { db, ctx }) => addItemFor(db, ctx, String(a.sessionId), a.item as never, 50),
  },
  {
    name: "set_session_mode",
    description: "Bascule une session du soir entre étude (20h00–21h50) et maison (21h00–23h00).",
    inputSchema: { type: "object", properties: { sessionId: { type: "string" }, mode: { type: "string", enum: ["etude", "maison"] } }, required: ["sessionId", "mode"] },
    write: true,
    run: (a, { db, ctx }) => setSessionModeFor(db, ctx, String(a.sessionId), a.mode as "etude" | "maison"),
  },
  {
    name: "review_session",
    description: "Fait le bilan d'une session : éléments faits / pas faits, durées réelles, éléments retirés, ajouts, commentaire. Les devoirs cochés passent à « fait ».",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        items: {
          type: "array",
          items: { type: "object", properties: { id: { type: "string" }, done: { type: "boolean" }, actualMinutes: { type: "number" }, removed: { type: "boolean" } }, required: ["id"] },
        },
        extra: { type: "array", items: itemSchema, description: "Travail fait en plus du prévu" },
        comment: { type: "string" },
      },
      required: ["sessionId"],
    },
    write: true,
    run: (a, { db, ctx }) => reviewSessionFor(db, ctx, String(a.sessionId), a as never),
  },
  {
    name: "add_note",
    description: "Ajoute un post-it.",
    inputSchema: { type: "object", properties: { content: { type: "string" }, color: { type: "string", enum: ["yellow", "blue", "green", "pink", "purple"] }, dueDate: { type: "string" } }, required: ["content"] },
    write: true,
    run: (a, { db, ctx }) => createNoteFor(db, ctx, a as never),
  },
  {
    name: "start_focus",
    description: "Démarre un chrono (Focus libre) sur une matière, éventuellement avec une description (« Anki », « fiche ch. 3 »). S'ajoute à la session en cours, sinon crée une session libre.",
    inputSchema: { type: "object", properties: { subject: { type: "string" }, description: { type: "string" } } },
    write: true,
    run: (a, { db, ctx }) => startFreeFocus(db, ctx, { subjectId: findSubjectId(ctx, a.subject as string), description: (a.description as string) ?? null }),
  },
  {
    name: "stop_focus",
    description: "Arrête le chrono en cours et ajoute les minutes au travail réel.",
    inputSchema: { type: "object", properties: {} },
    write: true,
    run: (_a, { db, ctx }) => stopAnyFocus(db, ctx),
  },
  {
    name: "log_work",
    description: "Ajoute du travail déjà fait sans chrono (ex. 20 min de droit sur Anki). Compte tout de suite dans les stats et les objectifs.",
    inputSchema: { type: "object", properties: { subject: { type: "string" }, minutes: { type: "number" }, description: { type: "string" } }, required: ["minutes"] },
    write: true,
    run: (a, { db, ctx }) => logWork(db, ctx, { subjectId: findSubjectId(ctx, a.subject as string), minutes: Number(a.minutes), description: (a.description as string) ?? null }),
  },
  {
    name: "day_brief",
    description: "Résumé parlé d'une journée (aujourd'hui ou demain) : cours, khôlles avec préparation, devoirs à rendre, session, prochain DS.",
    inputSchema: { type: "object", properties: { day: { type: "string", enum: ["today", "tomorrow"] } } },
    run: (a, { db, ctx }) => getBrief(db, ctx, a.day === "today" ? "today" : "tomorrow"),
  },
  {
    name: "ds_preparation",
    description: "Préparation d'un DS (par défaut le prochain) : compte à rebours, programme et jauge, tâches « à faire avant », temps travaillé, liens.",
    inputSchema: { type: "object", properties: { dsId: { type: "string" } } },
    run: (a, { db, ctx }) => dsPreparation(db, ctx, a.dsId ? String(a.dsId) : undefined),
  },
];

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const ok = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const fail = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

async function handleOne(msg: RpcRequest, auth: ApiAuth) {
  switch (msg.method) {
    case "initialize": {
      const requested = String(msg.params?.protocolVersion ?? "");
      return ok(msg.id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "planning-plus", title: "Planning+", version: "1.0.0" },
        instructions:
          "Planning+ : suivi des devoirs, DS, khôlles et sessions de travail d'un étudiant de prépa ECT. Dates en Europe/Paris (YYYY-MM-DD, HH:MM). Matières : maths, eco, droit, management, anglais, espagnol, lettres, philo.",
      });
    }
    case "ping":
      return ok(msg.id, {});
    case "tools/list":
      return ok(msg.id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return fail(msg.id, -32602, `Outil inconnu : ${name}`);
      if (tool.write && !auth.scopes.includes("write")) {
        return ok(msg.id, { content: [{ type: "text", text: "Ce token n'a pas le scope write." }], isError: true });
      }
      try {
        const result = await tool.run((msg.params?.arguments as Record<string, unknown>) ?? {}, auth);
        return ok(msg.id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: Array.isArray(result) ? { items: result } : (result as object) });
      } catch (e) {
        return ok(msg.id, { content: [{ type: "text", text: e instanceof Error ? e.message : "Erreur" }], isError: true });
      }
    }
    default:
      if (msg.method?.startsWith("notifications/")) return null;
      return fail(msg.id, -32601, `Méthode inconnue : ${msg.method}`);
  }
}

export async function POST(req: Request) {
  const auth = await authenticateToken(req);
  if (!auth) {
    return NextResponse.json(fail(null, -32001, "Token invalide ou manquant"), { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="planning-plus"' } });
  }
  let body: RpcRequest | RpcRequest[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(fail(null, -32700, "JSON invalide"), { status: 400 });
  }
  const batch = Array.isArray(body) ? body : [body];
  const responses = (await Promise.all(batch.map((m) => handleOne(m, auth)))).filter((r) => r !== null);
  if (!responses.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? responses : responses[0]);
}

export async function GET() {
  // Pas de flux SSE côté serveur en mode sans état.
  return new NextResponse("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new NextResponse(null, { status: 405 });
}
