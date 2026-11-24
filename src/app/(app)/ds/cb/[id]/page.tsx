import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/data/auth";
import { loadDs } from "@/lib/data/exams";
import { examCards } from "@/lib/data/dashboard";
import { computeCountdown, formatCountdown } from "@/lib/domain/countdown";
import { formatDayShort, formatMinutes, formatTime } from "@/lib/format";
import { Card, Gauge, SubjectDot } from "@/components/ui/misc";
import { LinksEditor } from "@/components/exam/editors";
import { CbPeriodForm } from "./period-form";
import type { CbPeriod, Link as LinkRow } from "@/lib/types";

export default async function CbPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, ctx } = await requireUser();
  const { data: p } = await supabase.from("cb_periods").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const period = p as CbPeriod;
  const all = await loadDs(supabase, ctx.userId);
  const exams = all.filter((d) => d.cb_period_id === id);
  const now = new Date();
  const { ds: cards } = await examCards(supabase, ctx, exams, [], now);
  const { data: links } = await supabase.from("links").select("*").eq("target_type", "cb_period").eq("target_id", id);
  const first = exams[0];
  const graded = exams.filter((d) => d.grade !== null);
  const avg = graded.length ? graded.reduce((a, d) => a + (Number(d.grade) / Number(d.grade_max)) * 20, 0) / graded.length : null;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Link href="/ds" className="text-sm text-muted hover:text-text">← DS & CB</Link>
      <header className="card card-pad flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">🏆 {period.name}</h1>
          {first && (
            <p className="text-sm text-muted">
              {formatDayShort(first.event.start_at)} → {formatDayShort(exams[exams.length - 1].event.start_at)} · {exams.length} épreuves
              {avg !== null && ` · moyenne ${avg.toFixed(2)}/20`}
            </p>
          )}
        </div>
        {first && new Date(first.event.start_at) > now && (
          <div className="text-right">
            <p className="text-xs text-muted">Jusqu&apos;à la première épreuve</p>
            <p className="text-2xl font-semibold">{formatCountdown(computeCountdown(now, new Date(first.event.start_at), ctx.holidays))}</p>
          </div>
        )}
      </header>
      <Card title="Épreuves">
        <ul className="divide-y divide-border">
          {exams.map((d, i) => (
            <li key={d.id}>
              <Link href={`/ds/${d.id}`} className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_120px_100px_70px] items-center gap-3 py-2.5 hover:bg-surface-2 -mx-2 px-2 rounded-lg">
                <SubjectDot color={ctx.subjectById.get(d.subject_id ?? "")?.color} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{d.event.title}</p>
                  <p className="text-xs text-muted">{formatDayShort(d.event.start_at)} · {formatTime(d.event.start_at)}</p>
                </div>
                <Gauge value={cards[i].gauge} className="hidden sm:flex" />
                <span className="hidden sm:block text-xs text-muted">{formatMinutes(cards[i].worked7d)} / 7 j</span>
                <span className="text-sm text-right tabular-nums">{d.grade !== null ? `${d.grade}/${d.grade_max}` : "—"}</span>
              </Link>
            </li>
          ))}
          {!exams.length && <li className="text-sm text-muted py-2">Aucune épreuve rattachée. Rattache des DS depuis leur page.</li>}
        </ul>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Notes">
          <CbPeriodForm period={period} />
        </Card>
        <Card title="Liens">
          <LinksEditor targetType="cb_period" targetId={id} links={(links ?? []) as LinkRow[]} />
        </Card>
      </div>
    </div>
  );
}
