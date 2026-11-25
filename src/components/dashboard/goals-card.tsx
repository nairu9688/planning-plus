import Link from "next/link";
import { goalProgress } from "@/lib/domain/grades";
import { formatMinutes } from "@/lib/format";
import type { Subject } from "@/lib/types";

/** Objectifs hebdomadaires par matière : barre réel / objectif. */
export function GoalsCard({ subjects, goals, minutes, weekElapsed }: { subjects: Subject[]; goals: Record<string, number>; minutes: Record<string, number>; weekElapsed: number }) {
  const rows = subjects.filter((s) => (goals[s.key] ?? 0) > 0);
  const totalGoal = rows.reduce((a, s) => a + goals[s.key], 0);
  const totalDone = rows.reduce((a, s) => a + Math.min(goals[s.key], minutes[s.id] ?? 0), 0);
  return (
    <section className="card card-pad min-w-0">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title">Objectifs de la semaine</h2>
        {rows.length > 0 && <span className="text-xs text-muted">{Math.round((totalDone / totalGoal) * 100)} % · semaine à {Math.round(weekElapsed * 100)} %</span>}
      </div>
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((s) => {
            const done = minutes[s.id] ?? 0;
            const p = goalProgress(done, goals[s.key]);
            const late = (p.ratio ?? 0) < weekElapsed - 0.15;
            return (
              <li key={s.id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="size-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className={late ? "text-xs text-warning" : p.reached ? "text-xs text-success" : "text-xs text-muted"}>
                    {formatMinutes(done)} / {formatMinutes(goals[s.key])}
                    {p.reached ? " ✓" : ""}
                  </span>
                </div>
                <div className="relative h-1.5 mt-1 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (p.ratio ?? 0) * 100)}%`, background: s.color }} />
                  {/* Repère : là où tu devrais en être vu l'avancement de la semaine. */}
                  <div className="absolute top-0 h-full w-px bg-text/40" style={{ left: `${Math.round(weekElapsed * 100)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          Fixe un nombre d&apos;heures par matière et par semaine dans{" "}
          <Link href="/reglages#objectifs" className="text-primary font-medium">
            Réglages
          </Link>{" "}
          pour suivre ta progression ici.
        </p>
      )}
    </section>
  );
}
