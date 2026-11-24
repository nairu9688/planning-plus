import { requireUser } from "@/lib/data/auth";
import { loadDs, loadKholles } from "@/lib/data/exams";
import { neglectedSubjects } from "@/lib/data/dashboard";
import { loadItemsBetween, realMinutes } from "@/lib/data/work";
import { addDays, dateKey, mondayOf } from "@/lib/domain/time";
import { formatDayNum, formatMinutes, keyToDate } from "@/lib/format";
import { Card, PageHeader, SubjectDot } from "@/components/ui/misc";

const WEEKS = 8;

export default async function StatsPage() {
  const { supabase, ctx } = await requireUser();
  const now = new Date();
  const today = dateKey(now);
  const firstMonday = addDays(mondayOf(today), -7 * (WEEKS - 1));
  const [items, ds, kh, neglected] = await Promise.all([
    loadItemsBetween(supabase, ctx.userId, firstMonday, addDays(mondayOf(today), 6)),
    loadDs(supabase, ctx.userId),
    loadKholles(supabase, ctx.userId),
    neglectedSubjects(supabase, ctx, now),
  ]);

  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(firstMonday, i * 7));
  const grid = new Map<string, Map<string, number>>(); // semaine → matière → minutes réelles
  const plannedByWeek = new Map<string, number>();
  const realByWeek = new Map<string, number>();
  const totalBySubject = new Map<string, number>();
  for (const i of items) {
    const w = mondayOf(i.session.date);
    const r = realMinutes(i);
    if (i.origin === "prevu") plannedByWeek.set(w, (plannedByWeek.get(w) ?? 0) + i.planned_minutes);
    realByWeek.set(w, (realByWeek.get(w) ?? 0) + r);
    if (!i.subject_id) continue;
    const m = grid.get(w) ?? new Map();
    m.set(i.subject_id, (m.get(i.subject_id) ?? 0) + r);
    grid.set(w, m);
    totalBySubject.set(i.subject_id, (totalBySubject.get(i.subject_id) ?? 0) + r);
  }
  const maxWeek = Math.max(60, ...weeks.map((w) => Math.max(realByWeek.get(w) ?? 0, plannedByWeek.get(w) ?? 0)));
  const maxSubject = Math.max(60, ...totalBySubject.values());

  // Notes et moyennes (sur 20).
  const grades = ctx.subjects.map((s) => {
    const d = ds.filter((x) => x.subject_id === s.id && x.grade !== null).map((x) => (Number(x.grade) / Number(x.grade_max)) * 20);
    const k = kh.filter((x) => x.subject_id === s.id && x.grade !== null).map((x) => Number(x.grade));
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    return { subject: s, ds: avg(d), dsCount: d.length, kh: avg(k), khCount: k.length };
  });
  const all = grades.flatMap((g) => [g.ds, g.kh]).filter((x): x is number => x !== null);
  const general = all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Stats" subtitle={`${WEEKS} dernières semaines`} />

      <Card title="Prévu vs réel par semaine">
        <div className="flex items-end gap-2 h-40">
          {weeks.map((w) => {
            const p = plannedByWeek.get(w) ?? 0;
            const r = realByWeek.get(w) ?? 0;
            return (
              <div key={w} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`Semaine du ${formatDayNum(keyToDate(w))} · réel ${formatMinutes(r)} / prévu ${formatMinutes(p)}`}>
                <div className="w-full flex items-end gap-0.5 h-full">
                  <div className="flex-1 rounded-t bg-primary/25" style={{ height: `${(p / maxWeek) * 100}%` }} />
                  <div className="flex-1 rounded-t bg-primary" style={{ height: `${(r / maxWeek) * 100}%` }} />
                </div>
                <span className="text-[10px] text-muted">{formatDayNum(keyToDate(w))}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-primary/25" /> prévu</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-primary" /> réel</span>
        </div>
      </Card>

      <Card title="Temps par matière et par semaine">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="text-left font-medium py-1">Matière</th>
                {weeks.map((w) => <th key={w} className="font-medium px-1">{formatDayNum(keyToDate(w))}</th>)}
                <th className="text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {ctx.subjects.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-1.5 whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><SubjectDot color={s.color} />{s.name}</span></td>
                  {weeks.map((w) => {
                    const m = grid.get(w)?.get(s.id) ?? 0;
                    return (
                      <td key={w} className="px-1 text-center">
                        <span className="inline-block rounded px-1 text-[11px] tabular-nums" style={{ background: m ? `${s.color}${Math.round(Math.min(1, m / 240) * 200 + 30).toString(16).padStart(2, "0")}` : undefined }}>
                          {m ? formatMinutes(m) : "·"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="text-right tabular-nums">{formatMinutes(totalBySubject.get(s.id) ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Répartition sur la période">
          <ul className="space-y-2">
            {ctx.subjects.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="w-28 truncate">{s.name}</span>
                <div className="h-2 flex-1 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${((totalBySubject.get(s.id) ?? 0) / maxSubject) * 100}%`, background: s.color }} />
                </div>
                <span className="text-xs text-muted w-14 text-right">{formatMinutes(totalBySubject.get(s.id) ?? 0)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Matières délaissées">
          {neglected.length ? (
            <ul className="space-y-1.5 text-sm">
              {neglected.map((n) => (
                <li key={n.subject.id} className="flex items-center gap-2">
                  <SubjectDot color={n.subject.color} />
                  <span className="flex-1">{n.subject.name}</span>
                  <span className="text-xs text-warning">{n.days === null ? "aucun travail sur 60 j" : `${n.days} j sans travail`}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Aucune : toutes les matières ont été travaillées depuis moins de {ctx.settings.neglected_after_days} jours.</p>
          )}
        </Card>
      </div>

      <Card title={`Notes et moyennes${general !== null ? ` · moyenne générale ${general.toFixed(2)}/20` : ""}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="text-left font-medium py-1">Matière</th>
              <th className="text-right font-medium">DS</th>
              <th className="text-right font-medium">Khôlles</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => (
              <tr key={g.subject.id} className="border-t border-border">
                <td className="py-1.5"><span className="inline-flex items-center gap-1.5"><SubjectDot color={g.subject.color} />{g.subject.name}</span></td>
                <td className="text-right tabular-nums">{g.ds !== null ? `${g.ds.toFixed(2)} (${g.dsCount})` : "—"}</td>
                <td className="text-right tabular-nums">{g.kh !== null ? `${g.kh.toFixed(2)} (${g.khCount})` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
