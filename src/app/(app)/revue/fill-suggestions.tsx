"use client";

import { useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { addSessionItem } from "@/app/actions/sessions";

export interface Suggestion {
  key: string;
  kind: "homework" | "revision";
  label: string;
  hint: string;
  color: string | null;
  homeworkId?: string;
  subjectId: string | null;
  minutes: number;
  target?: "next_ds" | "next_kholle";
}
export interface SessionOption {
  id: string;
  label: string;
}

export function FillSuggestions({ suggestions, sessions }: { suggestions: Suggestion[]; sessions: SessionOption[] }) {
  if (!suggestions.length) return <p className="text-sm text-muted">Rien ne manque. Belle semaine en vue.</p>;
  if (!sessions.length) return <p className="text-sm text-muted">Aucune session prévue : accepte des suggestions ou crée des sessions dans le Study Planner.</p>;
  return (
    <ul className="divide-y divide-border">
      {suggestions.map((s) => (
        <Row key={s.key} s={s} sessions={sessions} />
      ))}
    </ul>
  );
}

function Row({ s, sessions }: { s: Suggestion; sessions: SessionOption[] }) {
  const [sessionId, setSessionId] = useState(sessions[0].id);
  const [minutes, setMinutes] = useState(s.minutes);
  const [added, setAdded] = useState(false);
  const [pending, start] = useTransition();
  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5">
      <span className="size-2.5 rounded-full" style={{ background: s.color ?? "var(--muted)" }} />
      <div className="flex-1 min-w-48">
        <p className="text-sm font-medium">{s.label}</p>
        <p className="text-xs text-muted">{s.hint}</p>
      </div>
      <select className="input h-8 w-auto text-xs" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
        {sessions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <input type="number" min={5} step={5} className="input h-8 w-16 text-xs" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
      <button
        className="btn btn-outline h-8"
        aria-busy={pending} disabled={pending || added}
        onClick={() =>
          start(async () => {
            await addSessionItem(sessionId, {
              itemType: s.kind,
              homeworkId: s.homeworkId ?? null,
              subjectId: s.kind === "revision" ? s.subjectId : null,
              description: s.kind === "revision" ? s.label : null,
              plannedMinutes: minutes,
              target: s.target ?? "auto",
            });
            setAdded(true);
          })
        }
      >
        {added ? <Check className="size-4" /> : <Plus className="size-4" />}
      </button>
    </li>
  );
}
