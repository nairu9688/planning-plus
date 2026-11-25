"use client";

import { useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { planReviewSoon } from "@/app/actions/sessions";
import { cn } from "@/lib/format";

export interface ReviewRow {
  itemId: string;
  title: string;
  subject: string | null;
  color: string | null;
  step: number;
  overdueDays: number;
}

const STEP_LABEL = ["", "J+1", "J+3", "J+7", "J+21"];

/** Révisions espacées dues : un bouton pour les ajouter à la prochaine session. */
export function SpacedReviews({ rows }: { rows: ReviewRow[] }) {
  return (
    <section className="card card-pad min-w-0">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title">Révisions espacées</h2>
        <span className="text-xs text-muted">{rows.length ? `${rows.length} à revoir` : "à jour"}</span>
      </div>
      {rows.length ? (
        <ul className="space-y-1.5">
          {rows.slice(0, 6).map((r) => (
            <Row key={r.itemId} r={r} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          Rien à revoir aujourd&apos;hui. Chaque chapitre travaillé en session revient à J+1, J+3, J+7 puis J+21.
        </p>
      )}
      {rows.length > 6 && <p className="text-xs text-muted mt-2">+ {rows.length - 6} autre(s)</p>}
    </section>
  );
}

function Row({ r }: { r: ReviewRow }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="flex items-center gap-2 min-w-0 text-sm">
      <span className="size-2 rounded-full shrink-0" style={{ background: r.color ?? "var(--muted)" }} />
      <div className="flex-1 min-w-0">
        <p className="truncate">{r.title}</p>
        <p className={cn("text-[11px]", r.overdueDays > 0 ? "text-danger" : "text-muted")}>
          {r.subject} · {STEP_LABEL[r.step]} · {r.overdueDays > 0 ? `en retard de ${r.overdueDays} j` : "aujourd'hui"}
          {error && <span className="text-danger"> · {error}</span>}
        </p>
      </div>
      <button
        className="btn btn-outline h-7 px-2 text-xs shrink-0"
        disabled={pending || done}
        aria-busy={pending}
        title="Ajouter à la prochaine session"
        onClick={() =>
          start(async () => {
            try {
              await planReviewSoon(r.itemId);
              setDone(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Erreur");
            }
          })
        }
      >
        {done ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
        {done ? "Planifié" : "Planifier"}
      </button>
    </li>
  );
}
