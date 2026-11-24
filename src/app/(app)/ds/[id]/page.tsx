import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { requireUser } from "@/lib/data/auth";
import { loadExamExtras } from "@/lib/data/exam-page";
import { computeCountdown, formatCountdown } from "@/lib/domain/countdown";
import { formatDayLong, formatDayShort, formatMinutes, formatTime, keyToDate } from "@/lib/format";
import { Card, Gauge, SubjectChip } from "@/components/ui/misc";
import { CbPicker, GradeEditor, LinksEditor, PrepTasksEditor, PrepTopicsEditor } from "@/components/exam/editors";
import type { CalendarEvent, CbPeriod, Ds } from "@/lib/types";

export default async function DsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, ctx } = await requireUser();
  const { data } = await supabase.from("ds").select("*, event:calendar_events(*)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const ds = data as Ds & { event: CalendarEvent };
  const [extras, { data: periods }] = await Promise.all([
    loadExamExtras(supabase, ctx.userId, "ds", id, ds.subject_id),
    supabase.from("cb_periods").select("*").eq("user_id", ctx.userId).order("created_at"),
  ]);
  const subject = ds.subject_id ? ctx.subjectById.get(ds.subject_id) : null;
  const start = new Date(ds.event.start_at);
  const past = start <= new Date();
  const countdown = computeCountdown(new Date(), start, ctx.holidays);
  const max = Math.max(30, ...extras.perDay.map(([, m]) => m));

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link href="/ds" className="text-sm text-muted hover:text-text">← DS & CB</Link>
      <header className="card card-pad flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <SubjectChip subject={subject} />
          <h1 className="text-2xl font-semibold">{ds.event.title}</h1>
          <p className="text-sm text-muted flex flex-wrap items-center gap-x-2">
            {formatDayLong(ds.event.start_at)} · {formatTime(ds.event.start_at)} – {formatTime(ds.event.end_at)}
            {ds.event.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {ds.event.location}
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          {past ? (
            <p className="text-sm text-muted">Épreuve passée</p>
          ) : (
            <>
              <p className="text-xs text-muted">Temps de révision restant</p>
              <p className="text-2xl font-semibold">{formatCountdown(countdown)}</p>
            </>
          )}
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        <Card title={<span className="flex items-center gap-3">Programme <Gauge value={extras.gauge} className="w-32" /></span>}>
          <PrepTopicsEditor targetType="ds" targetId={ds.id} topics={extras.topics} subjectItems={extras.subjectItems} />
        </Card>
        <Card title="À faire avant">
          <PrepTasksEditor targetType="ds" targetId={ds.id} tasks={extras.tasks} />
          <p className="text-xs text-muted mt-2">Ces tâches peuvent être ajoutées à une session dans le Study Planner.</p>
        </Card>
        <Card title={`Temps travaillé · ${formatMinutes(extras.total)}`}>
          {extras.perDay.length ? (
            <ul className="space-y-1.5">
              {extras.perDay.map(([d, m]) => (
                <li key={d} className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-muted">{formatDayShort(keyToDate(d))}</span>
                  <div className="h-2 flex-1 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(m / max) * 100}%` }} />
                  </div>
                  <span className="w-14 text-right">{formatMinutes(m)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Aucune session n&apos;a encore ciblé ce DS.</p>
          )}
        </Card>
        <Card title="Concours blanc">
          <CbPicker dsId={ds.id} current={ds.cb_period_id} periods={(periods ?? []) as CbPeriod[]} candidate={ds.cb_candidate} />
          {ds.cb_period_id && (
            <Link href={`/ds/cb/${ds.cb_period_id}`} className="text-xs text-primary font-medium mt-2 inline-block">
              Voir la période →
            </Link>
          )}
        </Card>
        <Card title="Liens">
          <LinksEditor targetType="ds" targetId={ds.id} links={extras.links} />
        </Card>
        <Card title="Note">
          <GradeEditor kind="ds" id={ds.id} grade={ds.grade} gradeMax={ds.grade_max} notes={ds.notes} />
        </Card>
      </div>
    </div>
  );
}
