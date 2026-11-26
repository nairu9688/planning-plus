"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Pause, Play, Plus, SkipForward, X } from "lucide-react";
import { startFreeFocusAction } from "@/app/actions/focus";
import { startFocus, stopFocus, updateSessionItem } from "@/app/actions/sessions";
import { cn } from "@/lib/format";

export interface FocusItem {
  id: string;
  title: string;
  subject: string | null;
  color: string | null;
  planned: number;
  /** Minutes déjà comptées (Focus libre, bilan). */
  actual: number;
  done: boolean;
  links: { url: string; label: string }[];
}

function fmt(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Mode Focus plein écran : élément en cours, chrono, suivant, liens. */
export function FocusMode({
  sessionId,
  items,
  running,
  endAt,
  subjects,
}: {
  sessionId: string;
  items: FocusItem[];
  running: { itemId: string; startedAt: string } | null;
  endAt: string;
  subjects: { id: string; name: string; color: string }[];
}) {
  const router = useRouter();
  const firstOpen = items.findIndex((i) => !i.done);
  const initial = running ? Math.max(0, items.findIndex((i) => i.id === running.itemId)) : Math.max(0, firstOpen);
  const [idx, setIdx] = useState(initial);
  const [startedAt, setStartedAt] = useState<number | null>(running && items[initial]?.id === running.itemId ? new Date(running.startedAt).getTime() : null);
  const [now, setNow] = useState(Date.now());
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);

  // Pomodoro : travail puis pause ; pendant la pause le chrono est arrêté (la pause ne compte pas comme travail).
  const [pomo, setPomo] = useState<"off" | "25/5" | "50/10">(() => {
    try {
      return (localStorage.getItem("pp-pomodoro") as "off" | "25/5" | "50/10") || "off";
    } catch {
      return "off";
    }
  });
  const [cycleStart, setCycleStart] = useState<number | null>(null);
  const [breakUntil, setBreakUntil] = useState<number | null>(null);
  const [rounds, setRounds] = useState(0);
  const [work, brk] = pomo === "off" ? [0, 0] : pomo.split("/").map(Number);
  const choosePomo = (v: "off" | "25/5" | "50/10") => {
    setPomo(v);
    setCycleStart(v !== "off" && startedAt ? Date.now() : null);
    setBreakUntil(null);
    try {
      localStorage.setItem("pp-pomodoro", v);
    } catch {}
  };
  useEffect(() => {
    if (startedAt && pomo !== "off" && cycleStart === null) setCycleStart(Date.now());
  }, [startedAt, pomo, cycleStart]);
  useEffect(() => {
    if (pomo === "off" || !cycleStart || !startedAt || breakUntil) return;
    if (now - cycleStart >= work * 60_000) {
      start(async () => {
        await stopFocus();
        setStartedAt(null);
        setRounds((r) => r + 1);
        setBreakUntil(Date.now() + brk * 60_000);
        setCycleStart(null);
        try {
          navigator.vibrate?.(300);
        } catch {}
      });
    }
  }, [now, pomo, cycleStart, startedAt, breakUntil, work, brk]);
  const breakLeft = breakUntil ? Math.max(0, Math.floor((breakUntil - now) / 1000)) : 0;
  const resumeAfterBreak = () => {
    setBreakUntil(null);
    play();
  };

  // Le serveur renvoie un nouveau chrono (autre matière ajoutée) : on se place dessus.
  useEffect(() => {
    if (!running) return;
    const j = items.findIndex((i) => i.id === running.itemId);
    if (j >= 0) {
      setIdx(j);
      setStartedAt(new Date(running.startedAt).getTime());
    }
  }, [running?.itemId, running?.startedAt, items]);

  /** Passer à un autre élément à tout moment : le chrono en cours s'arrête (et compte), le nouveau démarre s'il tournait. */
  const switchTo = (j: number) => {
    if (j === idx) return;
    const wasRunning = startedAt !== null;
    start(async () => {
      if (wasRunning) await stopFocus();
      setIdx(j);
      if (wasRunning) {
        const r = await startFocus(items[j].id);
        setStartedAt(new Date(r.started_at).getTime());
      } else setStartedAt(null);
    });
  };
  const addSubject = (subjectId: string) =>
    start(async () => {
      await startFreeFocusAction(subjectId, null, sessionId);
      setAdding(false);
      router.refresh();
    });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const item = items[idx];
  const next = items.slice(idx + 1).find((i) => !i.done);
  const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  const remainingSession = Math.max(0, Math.floor((new Date(endAt).getTime() - now) / 1000));

  function play() {
    start(async () => {
      const r = await startFocus(item.id);
      setStartedAt(new Date(r.started_at).getTime());
    });
  }
  const pause = () =>
    start(async () => {
      await stopFocus();
      setStartedAt(null);
    });
  const goNext = (markDone: boolean) =>
    start(async () => {
      await stopFocus();
      if (markDone) await updateSessionItem(item.id, { done: true });
      setStartedAt(null);
      const n = items.findIndex((i, j) => j > idx && !i.done);
      if (n === -1) router.push(`/planner/${sessionId}/bilan?force=1`);
      else setIdx(n);
    });

  return (
    <div className="fixed inset-0 z-[70] bg-bg flex flex-col">
      <div className="flex items-start justify-between gap-2 p-4 pt-safe">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Fin de session dans {fmt(remainingSession)}</span>
          <div className="inline-flex rounded-lg bg-surface-2 p-0.5 text-xs" role="group" aria-label="Pomodoro">
            {(["off", "25/5", "50/10"] as const).map((v) => (
              <button key={v} onClick={() => choosePomo(v)} className={cn("px-2 h-7 rounded-md font-medium", pomo === v ? "bg-surface shadow-sm" : "text-muted")}>
                {v === "off" ? "Sans pause" : v}
              </button>
            ))}
          </div>
          <a href={`shortcuts://run-shortcut?name=${encodeURIComponent("Planning+ Concentration")}`} className="btn btn-outline h-8 text-xs" title="Lance le raccourci « Planning+ Concentration » (voir docs/RACCOURCIS.md)">
            🌙 Concentration iPhone
          </a>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() =>
            start(async () => {
              await stopFocus();
              router.push(`/planner/${sessionId}`);
            })
          }
        >
          <X className="size-4" /> Quitter
        </button>
      </div>
      {breakUntil ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-success">Pause · pomodoro {rounds} terminé</p>
          <p className="text-6xl sm:text-7xl font-semibold tabular-nums">{fmt(breakLeft)}</p>
          <p className="text-muted">{breakLeft ? "Lève-toi, bois de l'eau. La pause ne compte pas dans ton travail." : "Pause finie !"}</p>
          <button className="btn btn-primary h-12 px-6" onClick={resumeAfterBreak} disabled={pending} aria-busy={pending}>
            <Play className="size-5" /> Reprendre {item ? `· ${item.subject ?? item.title}` : ""}
          </button>
        </div>
      ) : item ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="space-y-2">
            {item.subject && (
              <p className="chip mx-auto" style={{ background: item.color ? `${item.color}2e` : undefined }}>
                <span className="size-2 rounded-full" style={{ background: item.color ?? undefined }} />
                {item.subject}
              </p>
            )}
            <h1 className={cn("text-3xl sm:text-4xl font-semibold tracking-tight", item.done && "line-through text-muted")}>{item.title}</h1>
            <p className="text-muted">
              {item.planned ? `${item.planned} min prévues` : "Ajouté en Focus libre"}
              {item.actual > 0 && ` · ${item.actual} min déjà faites`}
            </p>
          </div>
          <p className={cn("text-6xl sm:text-7xl font-semibold tabular-nums", item.planned > 0 && elapsed > item.planned * 60 && "text-warning")}>{fmt(elapsed)}</p>
          <div className="flex gap-3">
            {startedAt ? (
              <button className="btn btn-outline h-12 px-5" onClick={pause} disabled={pending} aria-busy={pending}>
                <Pause className="size-5" /> Pause
              </button>
            ) : (
              <button className="btn btn-primary h-12 px-5" onClick={play} disabled={pending} aria-busy={pending}>
                <Play className="size-5" /> Démarrer
              </button>
            )}
            <button className="btn btn-primary h-12 px-5" onClick={() => goNext(true)} disabled={pending} aria-busy={pending}>
              <Check className="size-5" /> Fait
            </button>
            <button className="btn btn-ghost h-12 px-4" onClick={() => goNext(false)} disabled={pending} aria-busy={pending} title="Passer">
              <SkipForward className="size-5" />
            </button>
          </div>
          {item.links.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {item.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="chip h-8 px-3 hover:bg-primary-tint">
                  <ExternalLink className="size-3.5" /> {l.label}
                </a>
              ))}
            </div>
          )}
          {pomo !== "off" && startedAt && cycleStart && (
            <p className="text-sm text-muted">
              Pause dans {fmt(Math.max(0, Math.floor((cycleStart + work * 60_000 - now) / 1000)))}
              {rounds > 0 && ` · ${rounds} pomodoro${rounds > 1 ? "s" : ""}`}
            </p>
          )}
          {next && <p className="text-sm text-muted">Suivant : {next.title}</p>}
        </div>
      ) : (
        <div className="flex-1 grid place-items-center text-center px-6">
          <div className="space-y-3">
            <p className="text-lg">Aucun élément dans cette session.</p>
            <Link href={`/planner/${sessionId}`} className="btn btn-primary">Remplir la session</Link>
          </div>
        </div>
      )}
      <div className="px-4 pb-8 pb-safe space-y-3">
        <div className="flex gap-1.5 overflow-x-auto justify-start sm:justify-center no-scrollbar">
          {items.map((i, j) => (
            <button
              key={i.id}
              onClick={() => switchTo(j)}
              disabled={pending}
              className={cn("chip h-8 px-3 shrink-0 border", j === idx ? "border-primary bg-primary-tint" : "border-transparent", i.done && j !== idx && "text-muted line-through")}
            >
              <span className="size-2 rounded-full" style={{ background: i.color ?? "var(--muted)" }} />
              {i.subject ?? i.title}
              {i.actual > 0 && <span className="text-muted font-normal">· {i.actual}′</span>}
            </button>
          ))}
          <button onClick={() => setAdding((v) => !v)} className="chip h-8 px-3 shrink-0 border border-dashed border-border">
            <Plus className="size-3.5" /> Autre matière
          </button>
        </div>
        {adding && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {subjects.map((x) => (
              <button key={x.id} disabled={pending} onClick={() => addSubject(x.id)} className="chip h-8 px-3" style={{ background: `${x.color}2e` }}>
                <span className="size-2 rounded-full" style={{ background: x.color }} />
                {x.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
