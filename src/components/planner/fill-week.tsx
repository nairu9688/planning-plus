"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { applyWeekFill, proposeWeekFill, type FillProposalRow } from "@/app/actions/fill";
import { cn, formatMinutes } from "@/lib/format";

type Proposal = Awaited<ReturnType<typeof proposeWeekFill>>;

/** Bouton « Remplis ma semaine » : calcule une proposition, l'affiche session par session, applique ce qui est coché. */
export function FillWeekButton({ className, label = "Remplis ma semaine" }: { className?: string; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [loading, startLoad] = useTransition();
  const [applying, startApply] = useTransition();
  const id = (r: FillProposalRow) => `${r.key}|${r.sessionId}`;

  const openSheet = () => {
    setOpen(true);
    setError(null);
    setResult(null);
    setProposal(null);
    startLoad(async () => {
      try {
        const p = await proposeWeekFill();
        setProposal(p);
        setChecked(new Set(p.rows.map(id)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  };

  const bySession = new Map<string, FillProposalRow[]>();
  for (const r of proposal?.rows ?? []) bySession.set(r.sessionLabel, [...(bySession.get(r.sessionLabel) ?? []), r]);

  return (
    <>
      <button className={cn("btn btn-primary", className)} onClick={openSheet}>
        <Sparkles className="size-4" /> {label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Remplis ma semaine" wide>
        {loading && <Spinner className="text-primary py-6" label="Je regarde tes devoirs, DS, khôlles et révisions…" />}
        {error && <p className="text-sm text-danger">{error}</p>}
        {result !== null && (
          <div className="py-6 text-center space-y-3">
            <p className="text-lg font-semibold">{result} élément(s) ajouté(s) à tes sessions ✓</p>
            <button className="btn btn-outline" onClick={() => setOpen(false)}>Fermer</button>
          </div>
        )}
        {proposal && result === null && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {proposal.sessions} session(s) prévue(s) sur 7 jours · {formatMinutes(proposal.freeMinutes)} libres. Décoche ce que tu ne veux pas.
            </p>
            {!proposal.rows.length && <p className="text-sm">Rien à ajouter : tout est déjà planifié, ou aucune session n&apos;a de place.</p>}
            {[...bySession.entries()].map(([label, rows]) => (
              <div key={label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">{label}</p>
                <ul className="space-y-1.5">
                  {rows.map((r) => (
                    <li key={id(r)}>
                      <label className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2 cursor-pointer has-[:checked]:border-primary/50 has-[:checked]:bg-primary-tint/40">
                        <input
                          type="checkbox"
                          className="accent-[var(--primary)] size-4"
                          checked={checked.has(id(r))}
                          onChange={(e) =>
                            setChecked((c) => {
                              const n = new Set(c);
                              if (e.target.checked) n.add(id(r));
                              else n.delete(id(r));
                              return n;
                            })
                          }
                        />
                        <span className="size-2.5 rounded-full shrink-0" style={{ background: r.color ?? "var(--muted)" }} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm truncate">{r.label}</span>
                          <span className="block text-[11px] text-muted truncate">{r.reason}</span>
                        </span>
                        <span className="text-xs font-medium shrink-0">{formatMinutes(r.minutes)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {proposal.unplaced.length > 0 && (
              <div className="rounded-xl bg-warning/10 p-3 text-sm">
                <p className="font-medium text-warning mb-1">Pas de place avant l&apos;échéance pour :</p>
                <ul className="text-xs text-muted space-y-0.5">
                  {proposal.unplaced.slice(0, 8).map((u) => (
                    <li key={u.key}>• {u.label} — {u.reason}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted mt-1">Ajoute une session ou accepte une suggestion dans le Study Planner.</p>
              </div>
            )}
            {proposal.rows.length > 0 && (
              <div className="flex justify-end gap-2 sticky bottom-0 bg-surface pt-2">
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
                <button
                  className="btn btn-primary"
                  disabled={applying || !checked.size}
                  aria-busy={applying}
                  onClick={() =>
                    startApply(async () => {
                      try {
                        const rows = proposal.rows.filter((r) => checked.has(id(r))).map((r) => ({ key: r.key, sessionId: r.sessionId, minutes: r.minutes }));
                        const res = await applyWeekFill(rows);
                        setResult(res.added);
                        router.refresh();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Erreur");
                      }
                    })
                  }
                >
                  <Check className="size-4" /> Ajouter {checked.size} élément(s)
                </button>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
