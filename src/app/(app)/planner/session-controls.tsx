"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { acceptSuggestion, removeSession, updateSession } from "@/app/actions/sessions";
import { Sheet } from "@/components/ui/sheet";

export function SuggestionActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1.5">
      <button className="btn btn-primary h-8" disabled={pending} aria-busy={pending} onClick={() => start(() => acceptSuggestion(id))}>
        <Check className="size-4" /> Accepter
      </button>
      <button className="btn btn-ghost h-8" disabled={pending} aria-busy={pending} onClick={() => start(() => removeSession(id))} title="Retirer (ne sera pas régénérée)">
        <X className="size-4" />
      </button>
    </div>
  );
}

const KINDS = [
  ["etude", "Étude"],
  ["maison", "Maison"],
  ["bibliotheque", "Bibliothèque"],
  ["sport", "Sport"],
  ["libre", "Libre"],
] as const;

export function SessionSettings({
  session,
}: {
  session: { id: string; date: string; start: string; end: string; kind: string; location: string | null; notes: string | null; status: string; generated: boolean };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button className="btn btn-outline" onClick={() => setOpen(true)}>
        Horaires et lieu
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Session">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () => {
              try {
                await updateSession(session.id, {
                  date: f.get("date") as string,
                  start: f.get("start") as string,
                  end: f.get("end") as string,
                  kind: f.get("kind") as "etude",
                  location: (f.get("location") as string) || null,
                  notes: (f.get("notes") as string) || null,
                });
                setOpen(false);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur");
              }
            });
          }}
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3">
              <label className="label">Date</label>
              <input name="date" type="date" defaultValue={session.date} className="input" />
            </div>
            <div>
              <label className="label">Début</label>
              <input name="start" type="time" defaultValue={session.start} className="input" />
            </div>
            <div>
              <label className="label">Fin</label>
              <input name="end" type="time" defaultValue={session.end} className="input" />
            </div>
            <div>
              <label className="label">Type</label>
              <select name="kind" defaultValue={session.kind === "suggestion" ? "etude" : session.kind} className="input">
                {KINDS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Lieu</label>
            <input name="location" defaultValue={session.location ?? ""} className="input" placeholder="Salle d'étude, BU…" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea name="notes" defaultValue={session.notes ?? ""} className="input" />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-between">
            <button
              type="button"
              className="btn btn-danger"
              disabled={pending} aria-busy={pending}
              onClick={() =>
                start(async () => {
                  if (!confirm(session.generated ? "Retirer cette session ? Elle ne sera pas régénérée." : "Supprimer cette session ?")) return;
                  await removeSession(session.id);
                  router.push("/planner");
                })
              }
            >
              {session.generated ? "Retirer" : "Supprimer"}
            </button>
            <button className="btn btn-primary" disabled={pending} aria-busy={pending}>Enregistrer</button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
