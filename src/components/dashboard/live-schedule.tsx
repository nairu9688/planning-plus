"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { cn, tint } from "@/lib/format";

export interface LiveBlock {
  id: string;
  title: string;
  kind: "cours" | "ds" | "kholle" | "autre" | "session";
  start: string;
  end: string;
  color: string | null;
  location: string | null;
  href: string | null;
}

const hm = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fmt = (iso: string | number) => hm.format(new Date(iso)).replace(":", "h");
const minutesOfDay = (t: number) => {
  const [h, m] = hm.format(new Date(t)).split(":").map(Number);
  return h * 60 + m;
};

function shortTitle(t: string) {
  return t.replace(/\s*\([^)]*\)\s*(- .*)?$/, "").replace("Philosophie", "Philo").replace("Management Gest. Entreprise", "Management").trim();
}

function duration(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, "0")}`;
}

/** Emploi du temps en temps réel : maintenant / ensuite + bande de la journée. Mise à jour toutes les 30 s. */
export function LiveSchedule({ today, tomorrow }: { today: LiveBlock[]; tomorrow: LiveBlock[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const blocks = useMemo(() => [...today].sort((a, b) => a.start.localeCompare(b.start)), [today]);
  const current = blocks.find((b) => Date.parse(b.start) <= now && Date.parse(b.end) > now);
  const next = blocks.find((b) => Date.parse(b.start) > now);
  const first = Math.min(8 * 60, ...blocks.map((b) => minutesOfDay(Date.parse(b.start))));
  const last = Math.max(22 * 60, ...blocks.map((b) => minutesOfDay(Date.parse(b.end)) || 24 * 60));
  const pos = (t: number) => ((minutesOfDay(t) - first) / (last - first)) * 100;
  const nowPos = pos(now);

  return (
    <section className="card card-pad min-w-0 space-y-3" aria-label="Emploi du temps en temps réel">
      <div className="grid sm:grid-cols-2 gap-2">
        {current ? (
          <NowCard label="Maintenant" block={current} now={now} live />
        ) : (
          <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Maintenant</p>
            <p className="text-sm font-semibold mt-0.5">{next ? "Temps libre" : "Journée terminée"}</p>
            {next && <p className="text-xs text-muted">jusqu&apos;à {fmt(next.start)}</p>}
          </div>
        )}
        {next ? (
          <NowCard label="Ensuite" block={next} now={now} />
        ) : (
          <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Demain</p>
            {tomorrow[0] ? (
              <>
                <p className="text-sm font-semibold mt-0.5 truncate">{shortTitle(tomorrow[0].title)}</p>
                <p className="text-xs text-muted">
                  {fmt(tomorrow[0].start)}
                  {tomorrow[0].location ? ` · ${tomorrow[0].location}` : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted mt-0.5">Rien de prévu</p>
            )}
          </div>
        )}
      </div>

      {/* Bande de la journée */}
      {blocks.length > 0 && (
        <div>
          <div className="relative h-9 rounded-xl bg-surface-2 overflow-hidden">
            {blocks.map((b) => {
              const l = pos(Date.parse(b.start));
              const w = Math.max(1.5, pos(Date.parse(b.end)) - l);
              const past = Date.parse(b.end) <= now;
              const style =
                b.kind === "session"
                  ? { left: `${l}%`, width: `${w}%`, backgroundImage: "repeating-linear-gradient(135deg, var(--hatch) 0 5px, transparent 5px 10px)", borderColor: "var(--primary)" }
                  : { left: `${l}%`, width: `${w}%`, background: tint(b.color ?? "#8a93a6", past ? 0.25 : 0.55), borderColor: b.color ?? "#8a93a6" };
              return (
                <div
                  key={b.id}
                  title={`${fmt(b.start)} · ${b.title}`}
                  className={cn("absolute top-1 bottom-1 rounded-md border-l-2", (b.kind === "ds" || b.kind === "kholle") && "ring-1 ring-inset", past && "opacity-60")}
                  style={{ ...style, ["--tw-ring-color" as string]: b.color ?? undefined }}
                />
              );
            })}
            {nowPos > 0 && nowPos < 100 && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-danger" style={{ left: `${nowPos}%` }}>
                <span className="absolute -top-0.5 -left-[3px] size-2 rounded-full bg-danger" />
              </div>
            )}
          </div>
          <div className="flex justify-between text-[10px] text-muted mt-1 px-0.5">
            {Array.from({ length: 5 }, (_, i) => {
              const m = first + ((last - first) * i) / 4;
              return <span key={i}>{Math.floor(m / 60)}h</span>;
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function NowCard({ label, block, now, live }: { label: string; block: LiveBlock; now: number; live?: boolean }) {
  const s = Date.parse(block.start);
  const e = Date.parse(block.end);
  const progress = live ? (now - s) / (e - s) : 0;
  const color = block.kind === "session" ? "var(--primary)" : (block.color ?? "#8a93a6");
  const body = (
    <div className="rounded-2xl px-3 py-2.5 border-l-4 h-full" style={{ background: block.kind === "session" ? "var(--primary-tint)" : tint(block.color ?? "#8a93a6", 0.14), borderLeftColor: color }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className={cn("text-[11px] font-semibold", live ? "text-danger" : "text-primary")}>
          {live ? `encore ${duration(e - now)}` : `dans ${duration(s - now)}`}
        </p>
      </div>
      <p className={cn("text-sm mt-0.5 truncate", block.kind === "ds" || block.kind === "kholle" ? "font-bold" : "font-semibold")}>
        {block.kind === "ds" && <span className="text-[10px] font-bold bg-danger text-white rounded px-1 mr-1">DS</span>}
        {block.kind === "kholle" && <span className="text-[10px] font-bold bg-primary text-on-primary rounded px-1 mr-1">KH</span>}
        {shortTitle(block.title)}
      </p>
      <p className="text-xs text-muted flex items-center gap-1 truncate">
        {fmt(block.start)}–{fmt(block.end)}
        {block.location && (
          <>
            <MapPin className="size-3 shrink-0" />
            {block.location}
          </>
        )}
      </p>
      {live && (
        <div className="h-1 mt-1.5 rounded-full bg-black/10 overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.round(progress * 100)}%`, background: color }} />
        </div>
      )}
    </div>
  );
  return block.href ? <Link href={block.href}>{body}</Link> : body;
}
