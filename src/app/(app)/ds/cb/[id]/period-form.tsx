"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCbPeriod, updateCbPeriod } from "@/app/actions/exams";
import type { CbPeriod } from "@/lib/types";

export function CbPeriodForm({ period }: { period: CbPeriod }) {
  const router = useRouter();
  const [name, setName] = useState(period.name);
  const [notes, setNotes] = useState(period.notes ?? "");
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(() => updateCbPeriod(period.id, { name, notes: notes || null }));
      }}
    >
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Organisation, salles, horaires…" />
      <div className="flex justify-between">
        <button
          type="button"
          className="btn btn-danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (!confirm("Supprimer cette période ? Les DS restent, ils sont simplement détachés.")) return;
              await deleteCbPeriod(period.id);
              router.push("/ds");
            })
          }
        >
          Supprimer
        </button>
        <button className="btn btn-outline" disabled={pending}>Enregistrer</button>
      </div>
    </form>
  );
}
