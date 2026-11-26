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

  const play = () =>
    start(async () => {
      const r = await startFocus(item.id);
      setStartedAt(new Date(r.started_at).getTime());
    });
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
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">Fin de session dans {fmt(remainingSession)}</span>
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
      {item ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="space-y-2">
            {item.subject && (
              <p className="chip mx-auto" style={{ background: item.color ? `${item.color}2e` : undefined }}>
                <span className="size-2 rounded-full" style={{ background: item.color ?? undefined }} />
                {item.subject}
              </p>
            )}
            <h1 className={cn("text-3xl sm:text-4xl font-semibold tracking-tight", item.done && "line-through text-muted")}>{item.title}</h1>
            <p className="text-muted">{item.planned} min prévues</p>
          </div>
          <p className={cn("text-6xl sm:text-7xl font-semibold tabular-nums", elapsed > item.planned * 60 && "text-warning")}>{fmt(elapsed)}</p>
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
