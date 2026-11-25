"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data/auth";
import { examCards, neglectedSubjects } from "@/lib/data/dashboard";
import { loadDs, loadKholles } from "@/lib/data/exams";
import { loadSpacedReviews } from "@/lib/data/reviews";
import { fillWeek, type FillSession, type FillTask } from "@/lib/domain/fill";
import { addDays, dateKey, parisDateTime } from "@/lib/domain/time";
import { formatDayShort, formatTime } from "@/lib/format";
import { addSessionItem, type ItemInput } from "./sessions";

export interface FillProposalRow {
  key: string;
  sessionId: string;
  sessionLabel: string;
  minutes: number;
  label: string;
  reason: string;
  color: string | null;
}

interface TaskMeta {
  label: string;
  reason: string;
  color: string | null;
  item: Omit<ItemInput, "plannedMinutes">;
}

const PRIO = { basse: 0, normale: 1, haute: 2 } as const;

/** Calcule une proposition de remplissage des sessions des 7 prochains jours (rien n'est écrit). */
export async function proposeWeekFill() {
  const { supabase, ctx } = await requireUser();
  const now = new Date();
  const today = dateKey(now);
  const end = parisDateTime(addDays(today, 7));
  const color = (id: string | null) => (id ? (ctx.subjectById.get(id)?.color ?? null) : null);
  const name = (id: string | null) => (id ? (ctx.subjectById.get(id)?.name ?? "") : "");

  const [{ data: sessions }, { data: homework }, { data: plannedHw }, ds, kh, reviews, neglected] = await Promise.all([
    supabase
      .from("study_sessions")
      .select("id, start_at, end_at, kind, items:session_items(planned_minutes, removed_in_review)")
      .eq("user_id", ctx.userId)
      .eq("status", "prevue")
      .gte("start_at", now.toISOString())
      .lt("start_at", end.toISOString())
      .neq("kind", "sport")
      .order("start_at"),
    supabase.from("homework").select("id, title, subject_id, due_at, estimated_minutes, priority").eq("user_id", ctx.userId).neq("status", "fait"),
    supabase.from("session_items").select("homework_id, session:study_sessions!inner(status, end_at)").eq("user_id", ctx.userId).not("homework_id", "is", null),
    loadDs(supabase, ctx.userId, { from: now, to: parisDateTime(addDays(today, 14)) }),
    loadKholles(supabase, ctx.userId, { from: now, to: end }),
    loadSpacedReviews(supabase, ctx, 6, now),
    neglectedSubjects(supabase, ctx, now),
  ]);

  const fillSessions: FillSession[] = (sessions ?? []).map((s) => {
    const slot = Math.round((new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 60000);
    const used = ((s.items ?? []) as { planned_minutes: number; removed_in_review: boolean }[]).filter((i) => !i.removed_in_review).reduce((a, i) => a + i.planned_minutes, 0);
    return { id: s.id, start: new Date(s.start_at), end: new Date(s.end_at), capacity: Math.max(0, slot - used) };
  });
  const sessionLabel = new Map((sessions ?? []).map((s) => [s.id, `${formatDayShort(s.start_at)} · ${formatTime(s.start_at)}`]));

  const tasks: FillTask[] = [];
  const meta = new Map<string, TaskMeta>();
  const add = (t: FillTask, m: TaskMeta) => {
    tasks.push(t);
    meta.set(t.key, m);
  };

  // 1. Devoirs pas encore planifiés dans une session à venir.
  const alreadyPlanned = new Set(
    (plannedHw ?? [])
      .filter((p) => {
        const s = p.session as unknown as { status: string; end_at: string };
        return s.status !== "ignoree" && new Date(s.end_at) > now;
      })
      .map((p) => p.homework_id),
  );
  for (const h of homework ?? []) {
    if (alreadyPlanned.has(h.id)) continue;
    add(
      { key: `hw:${h.id}`, minutes: h.estimated_minutes ?? 45, deadline: h.due_at ? new Date(h.due_at) : null, priority: PRIO[h.priority as keyof typeof PRIO] ?? 1 },
      { label: h.title, reason: h.due_at ? `Devoir pour ${formatDayShort(h.due_at)}` : "Devoir sans échéance", color: color(h.subject_id), item: { itemType: "homework", homeworkId: h.id, target: "auto" } },
    );
  }

  // 2. Révisions espacées dues d'ici 6 jours.
  for (const r of reviews) {
    add(
      { key: `rev:${r.itemId}`, minutes: 20, deadline: null, priority: r.overdueDays >= 0 ? 2 : 1 },
      {
        label: `Révision · ${r.title}`,
        reason: r.overdueDays > 0 ? `Révision espacée en retard (${r.overdueDays} j)` : r.overdueDays === 0 ? "Révision espacée du jour" : `Révision espacée le ${formatDayShort(parisDateTime(r.date))}`,
        color: r.subject?.color ?? null,
        item: { itemType: "revision", subjectId: r.subject?.id ?? null, subjectItemId: r.itemId, description: `Révision · ${r.title}`, target: "auto" },
      },
    );
  }

  // 3. DS des 14 prochains jours peu préparés : jusqu'à 3 blocs de 45 min, dans des sessions différentes.
  const cards = await examCards(supabase, ctx, ds, kh, now);
  for (const c of cards.ds) {
    const missing = Math.max(0, 180 - c.worked7d);
    if ((c.gauge ?? 0) >= 0.66 && missing === 0) continue;
    const n = Math.min(3, Math.max(1, Math.ceil(missing / 45)));
    const soon = new Date(c.start).getTime() - now.getTime() < 7 * 86_400_000;
    for (let k = 1; k <= n; k++) {
      add(
        { key: `ds:${c.id}:${k}`, minutes: 45, deadline: new Date(c.start), priority: soon ? 2 : 1, group: `ds:${c.id}` },
        { label: `Préparer ${c.title}`, reason: `DS ${formatDayShort(c.start)} · ${c.worked7d} min sur 7 j`, color: color(c.subjectId), item: { itemType: "revision", subjectId: c.subjectId, description: `Préparation ${c.title}`, target: "next_ds" } },
      );
    }
  }

  // 4. Khôlles de la semaine peu préparées.
  for (const c of cards.kholles) {
    if (c.worked7d >= 60) continue;
    add(
      { key: `kh:${c.id}`, minutes: 30, deadline: new Date(c.start), priority: 2 },
      { label: `Préparer ${c.title}`, reason: `Khôlle ${formatDayShort(c.start)} ${formatTime(c.start)}`, color: color(c.subjectId), item: { itemType: "revision", subjectId: c.subjectId, description: `Préparation ${c.title}`, target: "next_kholle" } },
    );
  }

  // 5. Matières délaissées (les 2 plus anciennes).
  for (const n of neglected.slice(0, 2)) {
    add(
      { key: `ng:${n.subject.id}`, minutes: 30, deadline: null, priority: 0 },
      { label: `Reprendre ${n.subject.name}`, reason: n.days === null ? "Pas travaillée depuis 60 j" : `Délaissée depuis ${n.days} j`, color: n.subject.color, item: { itemType: "revision", subjectId: n.subject.id, description: `Reprise ${name(n.subject.id)}`, target: "auto" } },
    );
  }

  const result = fillWeek(fillSessions, tasks);
  const rows: FillProposalRow[] = result.assignments.map((a) => {
    const m = meta.get(a.key)!;
    return { key: a.key, sessionId: a.sessionId, sessionLabel: sessionLabel.get(a.sessionId) ?? "", minutes: a.minutes, label: m.label, reason: m.reason, color: m.color };
  });
  return {
    rows,
    unplaced: result.unplaced.map((k) => ({ key: k, label: meta.get(k)!.label, reason: meta.get(k)!.reason })),
    sessions: fillSessions.length,
    freeMinutes: fillSessions.reduce((a, s) => a + s.capacity, 0),
  };
}

/** Applique les lignes cochées de la proposition. */
export async function applyWeekFill(rows: { key: string; sessionId: string; minutes: number }[]) {
  await requireUser();
  // On recalcule les métadonnées côté serveur : le client n'envoie que des clés.
  const proposal = await proposeWeekFill();
  const allowed = new Map(proposal.rows.map((r) => [`${r.key}|${r.sessionId}`, r]));
  const metaFor = (key: string): Omit<ItemInput, "plannedMinutes"> => {
    const [kind, id] = key.split(":");
    switch (kind) {
      case "hw":
        return { itemType: "homework", homeworkId: id, target: "auto" };
      case "rev":
        return { itemType: "revision", subjectItemId: id, target: "auto" };
      default:
        return { itemType: "revision", target: kind === "ds" ? "next_ds" : kind === "kh" ? "next_kholle" : "auto" };
    }
  };
  let added = 0;
  for (const r of rows) {
    const p = allowed.get(`${r.key}|${r.sessionId}`);
    if (!p) continue;
    const base = metaFor(r.key);
    const [kind, id] = r.key.split(":");
    await addSessionItem(r.sessionId, {
      ...base,
      // Matière : pour DS / khôlle / matière délaissée, déduite de l'objet visé.
      subjectId: kind === "ng" ? id : base.subjectId,
      description: kind === "hw" ? null : p.label,
      plannedMinutes: r.minutes,
      ...(kind === "ds" || kind === "kh" ? await examSubject(kind, id) : {}),
    });
    added++;
  }
  revalidatePath("/", "layout");
  return { added };
}

async function examSubject(kind: string, id: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from(kind === "ds" ? "ds" : "kholles").select("subject_id").eq("id", id).maybeSingle();
  return { subjectId: data?.subject_id ?? null };
}
