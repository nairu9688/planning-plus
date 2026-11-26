"use client";

import { useState, useTransition } from "react";
import { Celebration } from "@/components/ui/celebration";
import { Check, Plus, RotateCcw, X } from "lucide-react";
import { addSessionItem, updateSessionItem, validateReview } from "@/app/actions/sessions";
import { cn, formatMinutes } from "@/lib/format";
import type { SessionItem, Subject } from "@/lib/types";

export function ReviewEditor({
  sessionId,
  items,
  subjects,
  comment: initialComment,
  validated,
}: {
  sessionId: string;
  items: SessionItem[];
  subjects: Subject[];
  comment: string;
  validated: boolean;
}) {
  const [comment, setComment] = useState(initialComment);
  const [celebrate, setCelebrate] = useState<null | { title: string; lines: string[] }>(null);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const subj = (id: string | null) => subjects.find((s) => s.id === id);
  const realTotal = items.filter((i) => !i.removed_in_review).reduce((a, i) => a + (i.actual_minutes ?? 0), 0);

  return (
    <section className="card card-pad space-y-3">
      {celebrate && <Celebration title={celebrate.title} lines={celebrate.lines} />}
      <h2 className="section-title">
        Réel <span className="text-muted font-normal">· {formatMinutes(realTotal)}</span>
      </h2>
      <ul className="divide-y divide-border">
        {items.map((i) => (
          <RealRow key={i.id} item={i} subject={subj(i.subject_id)} />
        ))}
      </ul>

      {adding ? (
        <AddExtra sessionId={sessionId} subjects={subjects} onDone={() => setAdding(false)} />
      ) : (
        <button className="btn btn-ghost text-sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Ajouter ce que j&apos;ai fait en plus
        </button>
      )}

      <div>
        <label className="label">Commentaire</label>
        <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ce qui a marché, ce qui a bloqué…" />
      </div>
      <button
        className="btn btn-primary w-full h-11"
        disabled={pending} aria-busy={pending}
        onClick={() =>
          start(async () => {
            await validateReview(sessionId, comment);
            const kept = items.filter((i) => !i.removed_in_review);
            const done = kept.filter((i) => i.done).length;
            const planned = items.filter((i) => i.origin === "prevu").reduce((a, i) => a + i.planned_minutes, 0);
            setCelebrate({
              title: done === kept.length && kept.length ? "Soirée bouclée !" : "Bilan enregistré",
              lines: [
                `${formatMinutes(realTotal)} de travail réel${planned ? ` sur ${formatMinutes(planned)} prévues` : ""}`,
                `${done}/${kept.length} élément(s) fait(s)`,
                ...(items.some((i) => i.homework_id && i.done) ? ["Devoirs cochés passés à « fait » ✓"] : []),
              ],
            });
          })
        }
      >
        <Check className="size-4" /> {validated ? "Mettre à jour le bilan" : "Valider le bilan"}
      </button>
    </section>
  );
}

function RealRow({ item, subject }: { item: SessionItem; subject?: Subject }) {
  const [pending, start] = useTransition();
  const [minutes, setMinutes] = useState(item.actual_minutes ?? item.planned_minutes);
  const removed = item.removed_in_review;
  return (
    <li className={cn("flex flex-wrap items-center gap-2 py-2.5", pending && "opacity-60", removed && "opacity-50")}>
      <button
        onClick={() => start(() => updateSessionItem(item.id, { done: !item.done }))}
        disabled={removed}
        className={cn("size-6 rounded-lg border grid place-items-center", item.done ? "bg-success border-success text-white" : "border-border")}
        aria-label={item.done ? "Pas fait" : "Fait"}
      >
        {item.done && <Check className="size-4" />}
      </button>
      <span className="size-2.5 rounded-full" style={{ background: subject?.color ?? "var(--muted)" }} />
      <div className="flex-1 min-w-32">
        <p className={cn("text-sm", removed && "line-through")}>{item.description ?? subject?.name ?? item.item_type}</p>
        <p className="text-xs text-muted">
          {item.origin === "ajoute_au_bilan" ? "ajouté au bilan" : `prévu ${formatMinutes(item.planned_minutes)}`}
          {item.homework_id && item.done && " · le devoir passera à « fait »"}
        </p>
      </div>
      {!removed && (
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            step={5}
            className="input h-8 w-16 text-xs"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            onBlur={() => minutes !== item.actual_minutes && start(() => updateSessionItem(item.id, { actualMinutes: minutes }))}
            aria-label="Durée réelle"
          />
          <span className="text-xs text-muted">min</span>
        </div>
      )}
      <button
        className="btn btn-ghost h-8 w-8 p-0"
        onClick={() => start(() => updateSessionItem(item.id, { removedInReview: !removed }))}
        aria-label={removed ? "Rétablir" : "Supprimer du réel"}
        title={removed ? "Rétablir" : "Pas fait du tout / supprimer"}
      >
        {removed ? <RotateCcw className="size-4" /> : <X className="size-4" />}
      </button>
    </li>
  );
}

function AddExtra({ sessionId, subjects, onDone }: { sessionId: string; subjects: Subject[]; onDone: () => void }) {
  // Aucune matière présélectionnée : on choisit explicitement (avant, « Mathématiques » par défaut).
  const [subjectId, setSubjectId] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [pending, start] = useTransition();
  return (
    <form
      className="rounded-xl border border-border p-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!subjectId) return;
        start(async () => {
          await addSessionItem(sessionId, {
            itemType: "revision",
            subjectId,
            description: description || null,
            plannedMinutes: 0,
            actualMinutes: minutes,
            done: true,
            origin: "ajoute_au_bilan",
            target: "auto",
          });
          onDone();
        });
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {subjects.map((s) => (
          <button
            type="button"
            key={s.id}
            onClick={() => setSubjectId(s.id)}
            className="chip h-8 px-3 border"
            style={{ borderColor: subjectId === s.id ? s.color : "transparent", background: subjectId === s.id ? `${s.color}2e` : undefined }}
          >
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </button>
        ))}
      </div>
      <input className="input" placeholder="Ce que tu as fait (facultatif)" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <input type="number" min={0} step={5} className="input h-9 w-20" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
          <span className="text-xs text-muted">min</span>
        </div>
        <div className="flex gap-1">
          <button type="button" className="btn btn-ghost" onClick={onDone}>Annuler</button>
          <button className="btn btn-primary" disabled={pending || !subjectId} aria-busy={pending}>{subjectId ? "Ajouter" : "Choisis la matière"}</button>
        </div>
      </div>
    </form>
  );
}
