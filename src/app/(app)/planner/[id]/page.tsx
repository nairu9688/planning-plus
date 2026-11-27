import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, Play } from "lucide-react";
import { requireUser } from "@/lib/data/auth";
import { loadDs, loadKholles } from "@/lib/data/exams";
import { cn, formatDayLong, formatMinutes, formatTime, formatDayShort } from "@/lib/format";
import { timeKey } from "@/lib/domain/time";
import { ModeToggle } from "@/components/dashboard/widgets";
import { SessionSettings, SuggestionActions } from "../session-controls";
import { ItemsEditor, type ItemOptions } from "./items-editor";
import type { SessionItem, StudySession } from "@/lib/types";

const KIND_LABEL: Record<string, string> = { etude: "étude", maison: "maison", bibliotheque: "bibliothèque", sport: "sport", libre: "libre", suggestion: "suggestion" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, ctx } = await requireUser();
  const { data: s } = await supabase.from("study_sessions").select("*, items:session_items(*)").eq("id", id).maybeSingle();
  if (!s) notFound();
  const session = s as StudySession & { items: SessionItem[] };
  session.items.sort((a, b) => a.sort_order - b.sort_order);

  const start = new Date(session.start_at);
  const [ds, kh, { data: homework }, { data: subjectItems }] = await Promise.all([
    loadDs(supabase, ctx.userId, { from: start }),
    loadKholles(supabase, ctx.userId, { from: start }),
    supabase.from("homework").select("id, title, subject_id, due_at, estimated_minutes").eq("user_id", ctx.userId).neq("status", "fait").order("due_at", { nullsFirst: false }),
    supabase.from("subject_items").select("id, subject_id, type, title, number").eq("user_id", ctx.userId).eq("archived", false).order("number", { nullsFirst: false }),
  ]);
  const examIds = [...ds.slice(0, 30).map((d) => d.id), ...kh.slice(0, 30).map((k) => k.id)];
  const { data: prepTasks } = examIds.length
    ? await supabase.from("prep_tasks").select("id, title, target_type, target_id").in("target_id", examIds).eq("done", false)
    : { data: [] };
  const examLabel = new Map<string, string>([
    ...ds.map((d) => [d.id, `${d.event.title} (${formatDayShort(d.event.start_at)})`] as [string, string]),
    ...kh.map((k) => [k.id, `${k.event.title} (${formatDayShort(k.event.start_at)})`] as [string, string]),
  ]);

  // Aperçu des cibles par matière : prochain DS / khôlle après le début de la session.
  const nextBySubject: ItemOptions["nextBySubject"] = {};
  for (const sub of ctx.subjects) {
    const d = ds.find((x) => x.subject_id === sub.id);
    const k = kh.find((x) => x.subject_id === sub.id);
    nextBySubject[sub.id] = {
      ds: d ? { label: `${d.event.title} · ${formatDayShort(d.event.start_at)}`, at: d.event.start_at } : null,
      kholle: k ? { label: `${k.event.title} · ${formatDayShort(k.event.start_at)}`, at: k.event.start_at } : null,
    };
  }

  const options: ItemOptions = {
    homework: (homework ?? []).map((h) => ({ id: h.id, title: h.title, subjectId: h.subject_id, estimated: h.estimated_minutes, due: h.due_at ? formatDayShort(h.due_at) : null })),
    subjectItems: (subjectItems ?? []).map((i) => ({ id: i.id, subjectId: i.subject_id, label: `${i.type}${i.number ? ` ${i.number}` : ""} · ${i.title}` })),
    prepTasks: (prepTasks ?? []).map((t) => ({ id: t.id, label: t.title, exam: examLabel.get(t.target_id) ?? "" })),
    nextBySubject,
    targetLabels: Object.fromEntries(examLabel),
  };

  // Horaires réels de chaque élément (chronos terminés) : modifiables « de … à … ».
  const itemIds = session.items.map((i) => i.id);
  const { data: logs } = itemIds.length
    ? await supabase.from("focus_logs").select("session_item_id, started_at, ended_at").in("session_item_id", itemIds).not("ended_at", "is", null)
    : { data: [] };
  const ranges: Record<string, { start: string; end: string }> = {};
  for (const l of logs ?? []) {
    const r = ranges[l.session_item_id];
    ranges[l.session_item_id] = {
      start: !r || l.started_at < r.start ? l.started_at : r.start,
      end: !r || l.ended_at! > r.end ? l.ended_at! : r.end,
    };
  }

  const slot = (new Date(session.end_at).getTime() - start.getTime()) / 60_000;
  const items = session.items.filter((i) => !i.removed_in_review);
  const planned = items.reduce((a, i) => a + i.planned_minutes, 0);
  const real = items.reduce((a, i) => a + (i.actual_minutes ?? 0), 0);
  // Session passée / Focus libre : on montre le temps réellement fait, pas le prévu.
  const showReal = real > 0 || session.status === "bilan_fait";
  const barValue = showReal ? real : planned;
  const isEvening = session.kind === "etude" || session.kind === "maison";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link href="/planner" className="text-sm text-muted hover:text-text">← Study Planner</Link>
      <header className="card card-pad space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{formatDayLong(session.start_at)}</h1>
            <p className="text-sm text-muted">
              {formatTime(session.start_at)} – {formatTime(session.end_at)} · {KIND_LABEL[session.kind] ?? session.kind}
              {session.location ? ` · ${session.location}` : ""}
              {session.status === "suggeree" && " · suggestion"}
              {session.status === "bilan_fait" && " · bilan fait"}
            </p>
          </div>
          {isEvening && session.status !== "suggeree" && <ModeToggle sessionId={session.id} mode={session.kind as "etude" | "maison"} />}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <div className="h-2 flex-1 rounded-full bg-surface-2 overflow-hidden">
            <div className={cn("h-full rounded-full", showReal ? "bg-success" : planned > slot ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, (barValue / slot) * 100)}%` }} />
          </div>
          <span className={cn(!showReal && planned > slot && "text-warning font-medium")}>
            {showReal ? `${formatMinutes(real)} faites${planned ? ` · ${formatMinutes(planned)} prévues` : ""}` : `${formatMinutes(planned)} prévues`} / {formatMinutes(slot)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {session.status === "suggeree" ? (
            <SuggestionActions id={session.id} />
          ) : (
            <>
              <Link href={`/planner/${session.id}/focus`} className="btn btn-primary"><Play className="size-4" /> Focus</Link>
              <Link href={`/planner/${session.id}/bilan`} className="btn btn-outline"><ClipboardCheck className="size-4" /> Bilan</Link>
            </>
          )}
          <SessionSettings
            session={{
              id: session.id,
              date: session.date,
              start: timeKey(session.start_at),
              end: timeKey(session.end_at),
              kind: session.kind,
              location: session.location,
              notes: session.notes,
              status: session.status,
              generated: !!session.generated_by_rule,
            }}
          />
        </div>
        {session.notes && <p className="text-sm whitespace-pre-line">{session.notes}</p>}
      </header>

      <ItemsEditor sessionId={session.id} items={session.items} subjects={ctx.subjects} options={options} reviewed={session.status === "bilan_fait"} ranges={ranges} sessionDate={session.date} sessionStart={session.start_at} />
    </div>
  );
}
