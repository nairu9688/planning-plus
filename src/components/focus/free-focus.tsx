"use client";
import { friendlyError } from "@/lib/errors";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Plus, Square, Timer } from "lucide-react";
import { correctFocusAction, focusHostAction, logWorkAction, startFreeFocusAction, stopFocusAction } from "@/app/actions/focus";
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

export interface StoppedFocus {
  minutes: number;
  label: string | null;
  itemId: string | null;
  sessionId: string | null;
}

/** Annonce un chrono arrêté (depuis n'importe quel bouton Stop) : la pastille affiche « Corriger ». */
export function announceStopped(r: StoppedFocus) {
  window.dispatchEvent(new CustomEvent("pp:focus-stopped", { detail: r }));
}

/** Confirmation après l'arrêt, avec correction de la durée (« j'ai oublié de l'arrêter »). */
function StoppedToast({ r, onClose }: { r: StoppedFocus; onClose: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(r.minutes);
  const [pending, start] = useTransition();
  const [minutes, setMinutes] = useState(r.minutes);
  const long = minutes >= 90;
  useEffect(() => {
    if (editing) return;
    const t = setTimeout(onClose, long ? 15000 : 8000);
    return () => clearTimeout(t);
  }, [editing, long, onClose]);
  return (
    <div className="pp-pop fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6 w-[min(92vw,420px)] rounded-2xl bg-success text-white px-4 py-2.5 text-sm shadow-lg">
      {editing ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!r.itemId) return;
            start(async () => {
              await correctFocusAction(r.itemId!, value);
              setMinutes(value);
              setEditing(false);
              router.refresh();
            });
          }}
        >
          <span className="flex-1">Temps réel</span>
          <input type="number" min={0} max={600} inputMode="numeric" autoFocus value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-20 h-8 rounded-lg px-2 text-[#121a2c]" aria-label="Minutes réellement faites" />
          <span>min</span>
          <button className="h-8 rounded-lg bg-white text-success font-semibold px-3" disabled={pending} aria-busy={pending}>OK</button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <span className="flex-1 min-w-0">
            ✓ {formatMinutes(minutes)}
            {r.label ? ` de ${r.label}` : ""} ajoutées{long ? " · tu as oublié de l'arrêter ?" : ""}
          </span>
          {r.itemId && (
            <button className="shrink-0 h-8 rounded-lg bg-white/20 hover:bg-white/30 font-semibold px-3" onClick={() => setEditing(true)}>
              Corriger
            </button>
          )}
          <button className="shrink-0 opacity-80" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
      )}
    </div>
  );
}

/** Pastille du chrono en cours, visible sur toutes les pages, avec arrêt en un geste. */
export function FocusPill({ status }: { status: FocusStatus }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  const [done, setDone] = useState<StoppedFocus | null>(null);
  useEffect(() => {
    if (!status.running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status.running]);
  useEffect(() => {
    const on = (e: Event) => setDone((e as CustomEvent<StoppedFocus>).detail);
    window.addEventListener("pp:focus-stopped", on);
    return () => window.removeEventListener("pp:focus-stopped", on);
  }, []);

  if (done) return <StoppedToast key={`${done.itemId}-${done.minutes}`} r={done} onClose={() => setDone(null)} />;
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
              if (r.stopped) setDone({ minutes: r.minutes, label: r.label, itemId: r.itemId, sessionId: r.sessionId });
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
