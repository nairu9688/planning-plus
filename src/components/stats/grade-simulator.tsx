"use client";

import { useMemo, useState } from "react";
import { requiredGrade, weightedAverage, type SubjectGrades } from "@/lib/domain/grades";
import { cn } from "@/lib/format";

export interface SimSubject extends SubjectGrades {
  name: string;
  color: string;
  nextDs: string | null;
}

/** Moyenne pondérée par les coefficients + « quelle note au prochain DS pour atteindre X ». */
export function GradeSimulator({ subjects, target: initialTarget }: { subjects: SimSubject[]; target: number }) {
  const r = useMemo(() => weightedAverage(subjects), [subjects]);
  const withNext = subjects.filter((s) => s.coef > 0);
  const [key, setKey] = useState(withNext.find((s) => s.nextDs)?.key ?? withNext[0]?.key ?? "");
  const [target, setTarget] = useState(initialTarget);
  const need = key ? requiredGrade(subjects, key, target) : null;
  const subject = subjects.find((s) => s.key === key);
  const max = Math.max(...subjects.map((s) => s.coef), 1);

  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4">
      <div className="space-y-3">
        <div className="flex items-end gap-3">
          <p className="text-4xl font-semibold tabular-nums">{r.average === null ? "—" : r.average.toFixed(2)}</p>
          <p className="text-sm text-muted pb-1">/ 20 · moyenne pondérée des DS (coef. total {r.totalCoef})</p>
        </div>
        <ul className="space-y-1.5">
          {subjects.map((s) => {
            const avg = r.bySubject[s.key];
            return (
              <li key={s.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="size-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="truncate">{s.name}</span>
                  <span className="flex gap-0.5" title={`Coefficient ${s.coef}`}>
                    {Array.from({ length: s.coef }, (_, i) => (
                      <span key={i} className="h-2.5 w-1 rounded-sm" style={{ background: s.color, opacity: 0.35 + (0.65 * s.coef) / max }} />
                    ))}
                  </span>
                </span>
                <span className="text-xs text-muted">{s.grades.length} DS</span>
                <span className={cn("tabular-nums font-medium w-12 text-right", avg !== null && avg < 10 && "text-danger")}>{avg === null ? "—" : avg.toFixed(1)}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="rounded-2xl bg-primary-tint/50 p-4 space-y-3">
        <p className="text-sm font-semibold">Simulateur</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Pour atteindre</span>
          <input type="number" min={0} max={20} step={0.5} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="input h-9 w-20" aria-label="Moyenne cible" />
          <span>de moyenne, il me faut au prochain DS de</span>
          <select className="input h-9 w-auto" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Matière">
            {withNext.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {need && subject && (
          <div className="rounded-xl bg-surface p-4 text-center">
            {need.alreadyReached ? (
              <p className="text-lg font-semibold text-success">Déjà atteint : même un 0 suffit ✓</p>
            ) : !need.achievable ? (
              <p className="text-lg font-semibold text-danger">Il faudrait {need.needed.toFixed(1)}/20 : objectif hors d&apos;atteinte avec un seul DS</p>
            ) : (
              <>
                <p className="text-5xl font-semibold tabular-nums" style={{ color: subject.color }}>
                  {need.needed.toFixed(1)}
                </p>
                <p className="text-sm text-muted mt-1">/ 20 au prochain DS de {subject.name}</p>
              </>
            )}
            {subject.nextDs && <p className="text-xs text-muted mt-2">Prochain : {subject.nextDs}</p>}
          </div>
        )}
        <p className="text-[11px] text-muted">Coefficients indicatifs sur 30 (chaque école a les siens) : modifiables dans Réglages.</p>
      </div>
    </div>
  );
}
