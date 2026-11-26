"use client";
import { friendlyError } from "@/lib/errors";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Plus, Square, Timer } from "lucide-react";
import { focusHostAction, logWorkAction, startFreeFocusAction, stopFocusAction } from "@/app/actions/focus";
import { cn, formatMinutes } from "@/lib/format";
import type { Subject } from "@/lib/types";
import type { FocusStatus } from "@/lib/focus";

const QUICK_MINUTES = [10, 20, 30, 45, 60];

/**
 * Focus libre : choisir une matière (et un mot : « Anki », « fiche ch. 3 »), puis
 * démarrer un chrono, ou noter des minutes déjà faites.
 */
export function FreeFocusForm({ subjects, onDone, initialSubjectId = null }: { subjects: Subject[]; onDone: () => void; initialSubjectId?: string | null }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState<string | null>(initialSubjectId);
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [host, setHost] = useState<{ label: string } | null | undefined>(undefined);
  useEffect(() => {
    focusHostAction().then(setHost, () => setHost(null));
  }, []);

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
        router.refresh();
        onDone();
      } catch (e) {
        setError(friendlyError(e));
      }
    });

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-primary-tint text-sm px-3 py-2">
        {host === undefined ? "…" : host ? <>S&apos;ajoute à ta session <b>{host.label}</b> : pas de nouvelle session.</> : <>Pas de session en ce moment : une session « Focus libre » sera créée.</>}
      </p>
      <div>
        <span className="label">Matière</span>
        <div className="flex flex-wrap gap-1.5">
          {subjects.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setSubjectId(subjectId === s.id ? null : s.id)}
              className="chip h-8 px-3 border transition-colors"
              style={{ borderColor: subjectId === s.id ? s.color : "transparent", background: subjectId === s.id ? `${s.color}2e` : undefined }}
            >
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="ff-desc">Quoi (facultatif)</label>
        <input id="ff-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Anki, fiche chapitre 3, exos…" />
      </div>

      <button className="btn btn-primary w-full h-11" disabled={pending || !subjectId} aria-busy={pending} onClick={() => run(() => startFreeFocusAction(subjectId, description || null))}>
        <Play className="size-4" /> {subjectId ? "Démarrer le chrono" : "Choisis une matière"}
      </button>

      <div className="rounded-2xl bg-surface-2 p-3 space-y-2">
        <p className="text-sm font-medium">…ou j&apos;ai déjà travaillé</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_MINUTES.map((m) => (
            <button key={m} type="button" onClick={() => setMinutes(m)} className={cn("chip h-8 px-3", minutes === m && "bg-primary text-on-primary")}>
              {formatMinutes(m)}
            </button>
          ))}
          <input type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="input h-8 w-20" aria-label="Minutes" />
        </div>
        <button className="btn btn-outline w-full" disabled={pending || !(minutes > 0 && minutes <= 600) || !subjectId} onClick={() => run(() => logWorkAction(subjectId, minutes, description || null))}>
          <Plus className="size-4" /> Ajouter {formatMinutes(minutes)}
        </button>
        <p className="text-[11px] text-muted">Compte tout de suite dans tes stats et tes objectifs.</p>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function clock(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Pastille du chrono en cours, visible sur toutes les pages, avec arrêt en un geste. */
export function FocusPill({ status }: { status: FocusStatus }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    if (!status.running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status.running]);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), 3500);
    return () => clearTimeout(t);
  }, [done]);

  if (done)
    return (
      <div className="pp-pop fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6 rounded-full bg-success text-white px-4 py-2 text-sm font-medium shadow-lg">
        ✓ {done}
      </div>
    );
  if (!status.running || !status.startedAt) return null;
  const sec = Math.max(0, Math.floor((now - Date.parse(status.startedAt)) / 1000));
  return (
    <div className="fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6 md:left-auto md:right-6 md:translate-x-0">
      <div className="elevated flex items-center gap-2 rounded-full pl-3 pr-1.5 py-1.5 border border-border">
        <span className="size-2.5 rounded-full animate-pulse" style={{ background: status.color ?? "var(--primary)" }} />
        <Timer className="size-4 text-muted" />
        <Link href={status.sessionId ? `/planner/${status.sessionId}/focus` : "/planner"} className="flex items-center gap-2 min-w-0" title="Ouvrir le Focus (changer de matière)">
          <span className="text-sm font-medium max-w-40 truncate">{status.label}</span>
          <span className="text-sm font-semibold tabular-nums">{clock(sec)}</span>
        </Link>
        <button
          className="btn btn-primary h-8 rounded-full px-3"
          disabled={pending}
          aria-busy={pending}
          onClick={() =>
            start(async () => {
              const r = await stopFocusAction();
              setDone(`${formatMinutes(r.minutes)}${r.label ? ` de ${r.label}` : ""} ajoutées`);
              router.refresh();
            })
          }
          aria-label="Arrêter le chrono"
        >
          <Square className="size-3.5 fill-current" /> Stop
        </button>
      </div>
    </div>
  );
}
