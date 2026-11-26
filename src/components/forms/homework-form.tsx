"use client";
import { friendlyError } from "@/lib/errors";

import { useState, useTransition } from "react";
import { createHomework, deleteHomework, updateHomework } from "@/app/actions/homework";
import type { Subject } from "@/lib/types";
import { parseQuickHomework } from "@/lib/domain/quick-homework";
import { dateKey } from "@/lib/domain/time";

export interface HomeworkDraft {
  id?: string;
  title?: string;
  subjectId?: string | null;
  description?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  estimatedMinutes?: number | null;
  priority?: "basse" | "normale" | "haute";
  relatedEventId?: string | null;
}

export function HomeworkForm({ subjects, draft, onDone }: { subjects: Subject[]; draft?: HomeworkDraft; onDone: () => void }) {
  const [d, setD] = useState<HomeworkDraft>({ priority: "normale", ...draft });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<HomeworkDraft>) => setD((x) => ({ ...x, ...p }));
  const [quick, setQuick] = useState("");
  /** Saisie en une ligne : remplit les champs en direct (ils restent modifiables). */
  const onQuick = (text: string) => {
    setQuick(text);
    const q = parseQuickHomework(text, dateKey(new Date()));
    const subject = q.subject ? subjects.find((x) => x.key === q.subject) : undefined;
    set({
      title: q.title,
      ...(subject ? { subjectId: subject.id } : {}),
      ...(q.dueDate ? { dueDate: q.dueDate } : {}),
      ...(q.dueTime ? { dueTime: q.dueTime } : {}),
      ...(q.minutes ? { estimatedMinutes: q.minutes } : {}),
      priority: q.priority === "haute" ? "haute" : d.priority === "haute" ? "normale" : d.priority,
    });
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!d.title?.trim()) {
      setError("Donne un titre au devoir (le texte grisé n'est qu'un exemple).");
      return;
    }
    start(async () => {
      try {
        const input = {
          title: d.title ?? "",
          subjectId: d.subjectId || null,
          description: d.description || null,
          dueDate: d.dueDate || null,
          dueTime: d.dueTime || null,
          estimatedMinutes: d.estimatedMinutes || null,
          priority: d.priority,
          relatedEventId: d.relatedEventId ?? null,
        };
        if (d.id) await updateHomework(d.id, input);
        else await createHomework(input);
        onDone();
      } catch (err) {
        setError(friendlyError(err));
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {!d.id && (
        <div>
          <label className="label" htmlFor="hw-quick">Saisie rapide</label>
          <input
            id="hw-quick"
            autoFocus
            className="input"
            value={quick}
            onChange={(e) => onQuick(e.target.value)}
            placeholder="maths exos 12-15 vendredi 30min"
            enterKeyHint="done"
          />
          <p className="text-[11px] text-muted mt-1">Matière, jour (demain, vendredi, 3/12), heure (8h), durée (30min), « urgent » : les champs se remplissent.</p>
        </div>
      )}
      <div>
        <label className="label" htmlFor="hw-title">Titre</label>
        <input id="hw-title" autoFocus={!!d.id} required className="input" value={d.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="Exercices 12 à 15 p. 84" />
      </div>
      <div>
        <span className="label">Matière</span>
        <div className="flex flex-wrap gap-1.5">
          {subjects.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => set({ subjectId: d.subjectId === s.id ? null : s.id })}
              className="chip h-7 border transition-colors"
              style={{
                borderColor: d.subjectId === s.id ? s.color : "transparent",
                background: d.subjectId === s.id ? `${s.color}2e` : undefined,
              }}
            >
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
        <div>
          <label className="label" htmlFor="hw-due">Échéance</label>
          <input id="hw-due" type="date" className="input" value={d.dueDate ?? ""} onChange={(e) => set({ dueDate: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="hw-time">Heure</label>
          <input id="hw-time" type="time" className="input" value={d.dueTime ?? ""} onChange={(e) => set({ dueTime: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="hw-est">Durée estimée (min)</label>
          <input id="hw-est" type="number" min={0} step={5} className="input" value={d.estimatedMinutes ?? ""} onChange={(e) => set({ estimatedMinutes: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div>
          <label className="label" htmlFor="hw-prio">Priorité</label>
          <select id="hw-prio" className="input" value={d.priority} onChange={(e) => set({ priority: e.target.value as HomeworkDraft["priority"] })}>
            <option value="basse">Basse</option>
            <option value="normale">Normale</option>
            <option value="haute">Haute</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="hw-desc">Description</label>
        <textarea id="hw-desc" className="input" value={d.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center justify-between gap-2 pt-1">
        {d.id ? (
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending} aria-busy={pending}
            onClick={() =>
              start(async () => {
                if (!confirm("Supprimer ce devoir ? Il sera aussi retiré de Google Tasks.")) return;
                await deleteHomework(d.id!);
                onDone();
              })
            }
          >
            Supprimer
          </button>
        ) : (
          <span />
        )}
        <button className="btn btn-primary" disabled={pending} aria-busy={pending}>
          {pending ? "Enregistrement…" : d.id ? "Enregistrer" : "Ajouter le devoir"}
        </button>
      </div>
    </form>
  );
}
