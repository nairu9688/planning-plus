import Link from "next/link";
import { requireUser } from "@/lib/data/auth";
import { loadDs } from "@/lib/data/exams";
import { examCards } from "@/lib/data/dashboard";
import { formatCountdown } from "@/lib/domain/countdown";
import { cn, formatDayShort, formatMinutes, formatTime } from "@/lib/format";
import { Gauge, PageHeader, SubjectDot } from "@/components/ui/misc";
import type { CbPeriod } from "@/lib/types";

export default async function DsListPage() {
  const { supabase, ctx } = await requireUser();
  const now = new Date();
  const all = await loadDs(supabase, ctx.userId);
  const upcoming = all.filter((d) => new Date(d.event.start_at) > now);
  const past = all.filter((d) => new Date(d.event.start_at) <= now).reverse();
  const { ds: cards } = await examCards(supabase, ctx, upcoming, [], now);
  const { data: periods } = await supabase.from("cb_periods").select("*").eq("user_id", ctx.userId);
  const periodById = new Map(((periods ?? []) as CbPeriod[]).map((p) => [p.id, p]));
  const subj = (id: string | null) => (id ? ctx.subjectById.get(id) : undefined);

  const graded = past.filter((d) => d.grade !== null);
  const avg = graded.length ? graded.reduce((a, d) => a + (Number(d.grade) / Number(d.grade_max)) * 20, 0) / graded.length : null;

  return (
    <div className="space-y-5">
      <PageHeader title="DS & concours blancs" subtitle={avg !== null ? `Moyenne des DS notés : ${avg.toFixed(2)} / 20` : "Tous les DS de l'année"} />

      {(periods ?? []).length > 0 && (
        <section className="flex flex-wrap gap-2">
          {((periods ?? []) as CbPeriod[]).map((p) => (
            <Link key={p.id} href={`/ds/cb/${p.id}`} className="chip h-8 px-3 hover:bg-primary-tint">
              🏆 {p.name} · {all.filter((d) => d.cb_period_id === p.id).length} épreuves
            </Link>
          ))}
        </section>
      )}

      <section className="card card-pad">
        <h2 className="section-title mb-3">À venir</h2>
        <ul className="divide-y divide-border">
          {upcoming.map((d, i) => {
            const c = cards[i];
            const p = d.cb_period_id ? periodById.get(d.cb_period_id) : null;
            return (
              <li key={d.id}>
                <Link href={`/ds/${d.id}`} className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_160px_120px_110px] items-center gap-3 py-2.5 hover:bg-surface-2 -mx-2 px-2 rounded-lg">
                  <SubjectDot color={subj(d.subject_id)?.color} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{d.event.title}</p>
                    <p className="text-xs text-muted">
                      {formatDayShort(d.event.start_at)} · {formatTime(d.event.start_at)}
                      {p && ` · ${p.name}`}
                      {!p && d.cb_candidate && " · candidat CB ?"}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-right sm:text-left">{formatCountdown(c.countdown)}</span>
                  <Gauge value={c.gauge} className="hidden sm:flex" />
                  <span className="hidden sm:block text-xs text-muted text-right">{formatMinutes(c.worked7d)} sur 7 j</span>
                </Link>
              </li>
            );
          })}
          {!upcoming.length && <li className="text-sm text-muted py-2">Aucun DS à venir.</li>}
        </ul>
      </section>

      <section className="card card-pad">
        <h2 className="section-title mb-3">Passés</h2>
        <ul className="divide-y divide-border">
          {past.map((d) => (
            <li key={d.id}>
              <Link href={`/ds/${d.id}`} className="flex items-center gap-3 py-2 hover:bg-surface-2 -mx-2 px-2 rounded-lg">
                <SubjectDot color={subj(d.subject_id)?.color} />
                <span className="flex-1 text-sm truncate">{d.event.title}</span>
                <span className="text-xs text-muted">{formatDayShort(d.event.start_at)}</span>
                <span className={cn("text-sm font-semibold w-16 text-right tabular-nums", d.grade === null && "text-muted font-normal")}>
                  {d.grade !== null ? `${d.grade}/${d.grade_max}` : "—"}
                </span>
              </Link>
            </li>
          ))}
          {!past.length && <li className="text-sm text-muted py-2">Aucun DS passé dans la fenêtre synchronisée.</li>}
        </ul>
      </section>
    </div>
  );
}
