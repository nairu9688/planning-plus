"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Check, Pin, Play, Trash2, ClipboardCheck } from "lucide-react";
import { setHomeworkStatus } from "@/app/actions/homework";
import { deleteNote, updateNote } from "@/app/actions/misc";
import { setSessionMode } from "@/app/actions/sessions";
import { NOTE_BG, openQuickAdd } from "@/components/shell/quick-add";
import { cn } from "@/lib/format";
import type { Note } from "@/lib/types";

export function HomeworkCheck({ id, done, className }: { id: string; done: boolean; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      aria-label={done ? "Marquer à faire" : "Marquer fait"}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(() => setHomeworkStatus(id, done ? "a_faire" : "fait"));
      }}
      className={cn(
        "size-5 shrink-0 rounded-md border grid place-items-center transition-colors",
        done ? "bg-success border-success text-white" : "border-border hover:border-primary",
        pending && "opacity-50",
        className,
      )}
    >
      {done && <Check className="size-3.5" />}
    </button>
  );
}

export function ModeToggle({ sessionId, mode }: { sessionId: string; mode: "etude" | "maison" }) {
  const [pending, start] = useTransition();
  return (
    <div className={cn("inline-flex p-0.5 rounded-xl bg-surface-2 text-xs font-medium", pending && "opacity-60")}>
      {(["etude", "maison"] as const).map((m) => (
        <button
          key={m}
          disabled={pending || m === mode}
          onClick={() => start(() => setSessionMode(sessionId, m))}
          className={cn("px-3 h-7 rounded-[10px] transition-colors", m === mode ? "bg-surface shadow-sm text-text" : "text-muted")}
        >
          {m === "etude" ? "Étude" : "Maison"}
        </button>
      ))}
    </div>
  );
}

export function TonightActions({ sessionId, ended }: { sessionId: string; ended: boolean }) {
  return (
    <div className="flex gap-2">
      <Link href={`/planner/${sessionId}/focus`} className="btn btn-primary">
        <Play className="size-4" /> Focus
      </Link>
      <Link href={`/planner/${sessionId}/bilan`} className={cn("btn btn-outline", !ended && "opacity-60")}>
        <ClipboardCheck className="size-4" /> Bilan
      </Link>
      <Link href={`/planner/${sessionId}`} className="btn btn-ghost">
        Modifier
      </Link>
    </div>
  );
}

export function NotesBoard({ notes }: { notes: Note[] }) {
  const [, start] = useTransition();
  if (!notes.length)
    return (
      <button onClick={() => openQuickAdd({ type: "postit" })} className="w-full rounded-xl border border-dashed border-border py-6 text-sm text-muted hover:bg-surface-2">
        + Ajouter un post-it
      </button>
    );
  return (
    <div className="grid grid-cols-2 gap-2">
      {notes.map((n) => (
        <div key={n.id} className="group relative rounded-xl p-3 text-sm min-h-20 text-[#1b1b1b]" style={{ background: NOTE_BG[n.color] ?? NOTE_BG.yellow }}>
          <p className="whitespace-pre-line pr-5 break-words">{n.content}</p>
          {n.due_at && <p className="text-[11px] opacity-60 mt-1">pour le {new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" }).format(new Date(n.due_at))}</p>}
          <div className="absolute top-1.5 right-1.5 flex flex-col gap-0.5 sm:opacity-0 group-hover:opacity-100 transition-opacity">
            <button title="Fait" onClick={() => start(() => updateNote(n.id, { done: true }))} className="size-6 rounded-md grid place-items-center hover:bg-black/10">
              <Check className="size-3.5" />
            </button>
            <button title={n.pinned ? "Désépingler" : "Épingler"} onClick={() => start(() => updateNote(n.id, { pinned: !n.pinned }))} className={cn("size-6 rounded-md grid place-items-center hover:bg-black/10", n.pinned && "opacity-100")}>
              <Pin className={cn("size-3.5", n.pinned && "fill-current")} />
            </button>
            <button title="Supprimer" onClick={() => start(() => deleteNote(n.id))} className="size-6 rounded-md grid place-items-center hover:bg-black/10">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
