import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { requireUser } from "@/lib/data/auth";
import { loadExamExtras } from "@/lib/data/exam-page";
import { computeCountdown, formatCountdown } from "@/lib/domain/countdown";
import { formatDayLong, formatDayShort, formatMinutes, formatTime, keyToDate } from "@/lib/format";
import { Card, Gauge, SubjectChip } from "@/components/ui/misc";
import { GradeEditor, KholleQuestions, LinksEditor, PrepTasksEditor, PrepTopicsEditor } from "@/components/exam/editors";
import type { CalendarEvent, Kholle } from "@/lib/types";

export default async function KhollePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, ctx } = await requireUser();
  const { data } = await supabase.from("kholles").select("*, event:calendar_events(*)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const k = data as Kholle & { event: CalendarEvent };
  const [extras, { data: questions }] = await Promise.all([
    loadExamExtras(supabase, ctx.userId, "kholle", id, k.subject_id),
    supabase.from("kholle_questions").select("id, question, status").eq("kholle_id", id).order("created_at"),
  ]);
  const subject = k.subject_id ? ctx.subjectById.get(k.subject_id) : null;
  const start = new Date(k.event.start_at);
  const past = start <= new Date();

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link href="/kholles" className="text-sm text-muted hover:text-text">← Khôlles</Link>
      <header className="card card-pad flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <SubjectChip subject={subject} />
          <h1 className="text-2xl font-semibold">{k.event.title}</h1>
          <p className="text-sm text-muted flex flex-wrap items-center gap-x-2">
            {formatDayLong(k.event.start_at)} · {formatTime(k.event.start_at)} – {formatTime(k.event.end_at)}
            {k.event.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {k.event.location}
              </span>
            )}
            {k.teacher && <span>· {k.teacher}</span>}
          </p>
          {k.event.description && <p className="text-sm rounded-lg bg-surface-2 px-3 py-2">{k.event.description}</p>}
        </div>
        {!past && (
          <div className="text-right">
            <p className="text-xs text-muted">Temps de préparation restant</p>
            <p className="text-2xl font-semibold">{formatCountdown(computeCountdown(new Date(), start, ctx.holidays))}</p>
            <p className="text-xs text-muted">Préparé : {formatMinutes(extras.total)}</p>
          </div>
        )}
      </header>
      <div className="grid md:grid-cols-2 gap-4 items-start">
        <Card title="Questions de cours">
          <KholleQuestions kholleId={k.id} questions={(questions ?? []) as { id: string; question: string; status: "a_revoir" | "ok" }[]} />
        </Card>
        <Card title="À faire avant">
          <PrepTasksEditor targetType="kholle" targetId={k.id} tasks={extras.tasks} />
        </Card>
        <Card title={<span className="flex items-center gap-3">Programme <Gauge value={extras.gauge} className="w-32" /></span>}>
          <PrepTopicsEditor targetType="kholle" targetId={k.id} topics={extras.topics} subjectItems={extras.subjectItems} />
        </Card>
        <Card title={`Temps de préparation · ${formatMinutes(extras.total)}`}>
          {extras.perDay.length ? (
            <ul className="space-y-1 text-sm">
              {extras.perDay.map(([d, m]) => (
                <li key={d} className="flex justify-between">
                  <span className="text-muted">{formatDayShort(keyToDate(d))}</span>
                  {formatMinutes(m)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Aucune session n&apos;a encore ciblé cette khôlle.</p>
          )}
        </Card>
        <Card title="Liens">
          <LinksEditor targetType="kholle" targetId={k.id} links={extras.links} />
        </Card>
        <Card title="Note">
          <GradeEditor kind="kholle" id={k.id} grade={k.grade} notes={k.notes} />
        </Card>
      </div>
    </div>
  );
}
