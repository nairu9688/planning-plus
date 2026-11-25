"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarClock, MapPin, StickyNote } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { openQuickAdd } from "@/components/shell/quick-add";
import { setEventOverride } from "@/app/actions/misc";
import { cn, tint } from "@/lib/format";
import type { Subject } from "@/lib/types";
import type { GridEvent, GridSession } from "@/lib/data/week";

const TZ = "Europe/Paris";
const dkFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const hmFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const headFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric" });

const dayOf = (iso: string) => dkFmt.format(new Date(iso));
const minutesOf = (iso: string) => {
  const [h, m] = hmFmt.format(new Date(iso)).split(":").map(Number);
  return h * 60 + m;
};
const hm = (iso: string) => hmFmt.format(new Date(iso)).replace(":", "h");

type Block =
  | { type: "event"; start: number; end: number; e: GridEvent; col?: number; cols?: number }
  | { type: "session"; start: number; end: number; s: GridSession; col?: number; cols?: number };

/** Répartit les blocs qui se chevauchent en colonnes. */
function layout(blocks: Block[]) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster: Block[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols: number[] = [];
    for (const b of cluster) {
      let c = cols.findIndex((end) => end <= b.start);
      if (c === -1) c = cols.length;
      cols[c] = b.end;
      b.col = c;
    }
    cluster.forEach((b) => (b.cols = cols.length));
    cluster = [];
  };
  for (const b of sorted) {
    if (b.start >= clusterEnd && cluster.length) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  if (cluster.length) flush();
  return sorted;
}

export function WeekGrid({
  days,
  events,
  sessions,
  subjects,
  startHour = 8,
  endHour = 23,
  today,
  compact,
}: {
  days: string[];
  events: GridEvent[];
  sessions: GridSession[];
  subjects: Subject[];
  startHour?: number;
  endHour?: number;
  today: string;
  compact?: boolean;
}) {
  const hourPx = compact ? 36 : 48;
  const total = (endHour - startHour) * 60;
  const [selected, setSelected] = useState<GridEvent | null>(null);
  const [slot, setSlot] = useState<{ date: string; time: string } | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, Block[]>();
    const allDay = new Map<string, GridEvent[]>();
    for (const d of days) {
      m.set(d, []);
      allDay.set(d, []);
    }
    for (const e of events) {
      const d = dayOf(e.start);
      if (!m.has(d)) continue;
      if (e.allDay) {
        allDay.get(d)!.push(e);
        continue;
      }
      m.get(d)!.push({ type: "event", start: minutesOf(e.start), end: dayOf(e.end) === d ? minutesOf(e.end) : 24 * 60, e });
    }
    for (const s of sessions) {
      const d = dayOf(s.start);
      if (!m.has(d)) continue;
      m.get(d)!.push({ type: "session", start: minutesOf(s.start), end: dayOf(s.end) === d ? minutesOf(s.end) : 24 * 60, s });
    }
    for (const [d, blocks] of m) m.set(d, layout(blocks));
    return { timed: m, allDay };
  }, [days, events, sessions]);

  const hasAllDay = days.some((d) => byDay.allDay.get(d)!.length);
  const nowMin = minutesOf(new Date().toISOString());

  function onGridClick(day: string, e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const min = startHour * 60 + Math.floor(((e.clientY - rect.top) / hourPx) * 60 / 15) * 15;
    const time = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
    setSlot({ date: day, time });
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: days.length > 3 ? 640 : undefined }}>
        <div className="grid sticky top-0 z-10 bg-surface" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(0,1fr))` }}>
          <div />
          {days.map((d) => (
            <div key={d} className={cn("text-center text-xs py-2 font-medium capitalize", d === today ? "text-primary" : "text-muted")}>
              <span className={cn(d === today && "inline-block rounded-full bg-primary text-on-primary px-2 py-0.5")}>{headFmt.format(new Date(`${d}T12:00:00Z`))}</span>
            </div>
          ))}
        </div>
        {hasAllDay && (
          <div className="grid border-b border-border pb-1" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(0,1fr))` }}>
            <div className="text-[10px] text-muted pt-1">jour</div>
            {days.map((d) => (
              <div key={d} className="px-0.5 space-y-0.5">
                {byDay.allDay.get(d)!.map((e) => (
                  <button key={e.id} onClick={() => setSelected(e)} className="w-full truncate rounded-md px-1.5 py-0.5 text-[11px] text-left bg-surface-2">
                    {e.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="grid relative" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(0,1fr))` }}>
          <div className="relative" style={{ height: (total / 60) * hourPx }}>
            {Array.from({ length: endHour - startHour }, (_, i) => (
              <div key={i} className="absolute right-1.5 text-[10px] text-muted -translate-y-1/2" style={{ top: i * hourPx }}>
                {i === 0 ? "" : `${startHour + i}h`}
              </div>
            ))}
          </div>
          {days.map((d) => (
            <div
              key={d}
              onClick={(e) => onGridClick(d, e)}
              className={cn("relative border-l border-border cursor-pointer", d === today && "bg-primary-tint/30")}
              style={{
                height: (total / 60) * hourPx,
                backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${hourPx}px)`,
              }}
            >
              {d === today && nowMin > startHour * 60 && nowMin < endHour * 60 && (
                <div className="absolute inset-x-0 z-20 h-0.5 bg-danger pointer-events-none" style={{ top: ((nowMin - startHour * 60) / 60) * hourPx }} />
              )}
              {byDay.timed.get(d)!.map((b) => {
                const top = Math.max(0, ((b.start - startHour * 60) / 60) * hourPx);
                const bottom = Math.min(total, b.end - startHour * 60);
                const height = Math.max(16, (bottom / 60) * hourPx - top - 2);
                if (b.end <= startHour * 60 || b.start >= endHour * 60) return null;
                const width = `calc(${100 / (b.cols ?? 1)}% - 3px)`;
                const left = `calc(${((b.col ?? 0) * 100) / (b.cols ?? 1)}% + 1px)`;
                return b.type === "event" ? (
                  <EventBlock key={b.e.id} e={b.e} style={{ top, height, width, left }} onClick={() => setSelected(b.e)} />
                ) : (
                  <SessionBlock key={b.s.id} s={b.s} style={{ top, height, width, left }} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <EventSheet event={selected} onClose={() => setSelected(null)} subjects={subjects} events={events} />
      <Sheet open={!!slot} onClose={() => setSlot(null)} title={slot ? `${headFmt.format(new Date(`${slot.date}T12:00:00Z`))} · ${slot.time.replace(":", "h")}` : ""}>
        <div className="grid grid-cols-3 gap-2">
          {[
            { type: "devoir" as const, label: "Devoir", icon: BookOpen },
            { type: "session" as const, label: "Session", icon: CalendarClock },
            { type: "postit" as const, label: "Post-it", icon: StickyNote },
          ].map((o) => (
            <button
              key={o.type}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-4 text-sm hover:bg-surface-2"
              onClick={() => {
                const s = slot!;
                setSlot(null);
                openQuickAdd({ type: o.type, date: s.date, time: s.time });
              }}
            >
              <o.icon className="size-5" />
              {o.label}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function EventBlock({ e, style, onClick }: { e: GridEvent; style: React.CSSProperties; onClick: () => void }) {
  const color = e.color ?? "#8a93a6";
  const strong = e.kind === "ds" || e.kind === "kholle";
  return (
    <button
      onClick={(ev) => {
        ev.stopPropagation();
        onClick();
      }}
      className={cn("absolute z-10 overflow-hidden rounded-md text-left px-1.5 py-0.5 text-[11px] leading-tight border-l-[3px]", strong && "font-semibold ring-1")}
      style={{ ...style, background: tint(color, 0.18), borderLeftColor: color, ["--tw-ring-color" as string]: color }}
    >
      <div className="truncate">{e.title}</div>
      <div className="truncate text-muted font-normal">
        {hm(e.start)}
        {e.location ? ` · ${e.location}` : ""}
      </div>
      {e.badge > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-4 h-4 rounded-full bg-danger text-white text-[10px] font-semibold grid place-items-center px-1" title={`${e.badge} devoir(s) non fait(s)`}>
          {e.badge}
        </span>
      )}
    </button>
  );
}

function SessionBlock({ s, style }: { s: GridSession; style: React.CSSProperties }) {
  const suggestion = s.status === "suggeree";
  return (
    <Link
      href={`/planner/${s.id}`}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "absolute z-[5] overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] leading-tight text-primary",
        suggestion ? "border border-dashed border-primary/60 bg-surface/60" : "hatch border border-primary/30",
      )}
      style={style}
    >
      <div className="font-medium truncate">
        {suggestion ? "Suggestion · " : "Session · "}
        {s.label}
      </div>
      <div className="flex gap-0.5 mt-0.5 flex-wrap">
        {s.dots.map((c, i) => (
          <span key={i} className="size-1.5 rounded-full" style={{ background: c }} />
        ))}
      </div>
    </Link>
  );
}

function EventSheet({ event, onClose, subjects, events }: { event: GridEvent | null; onClose: () => void; subjects: Subject[]; events: GridEvent[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!event) return null;
  const nextSame = events
    .filter((e) => e.subjectId && e.subjectId === event.subjectId && e.kind === "cours" && e.start > event.end)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  return (
    <Sheet open onClose={onClose} title={event.title}>
      <div className="space-y-4">
        <div className="text-sm text-muted space-y-1">
          <p>
            {new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(event.start))} ·{" "}
            {event.allDay ? "journée" : `${hm(event.start)} – ${hm(event.end)}`}
          </p>
          {event.location && (
            <p className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {event.location}
            </p>
          )}
          {event.description && <p className="whitespace-pre-line text-text">{event.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {event.href && (
            <Link href={event.href} className="btn btn-primary" onClick={onClose}>
              Ouvrir la fiche
            </Link>
          )}
          <button
            className="btn btn-outline"
            onClick={() => {
              onClose();
              openQuickAdd({
                type: "devoir",
                subjectId: event.subjectId,
                relatedEventId: event.id,
                date: nextSame ? dayOf(nextSame.start) : undefined,
              });
            }}
          >
            <BookOpen className="size-4" /> Devoir pour {nextSame ? "le prochain cours" : "ce cours"}
          </button>
        </div>
        <details className="rounded-xl border border-border p-3">
          <summary className="text-sm cursor-pointer">Corriger la classification</summary>
          <form
            className="mt-3 grid grid-cols-2 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              start(async () => {
                await setEventOverride(event.id, {
                  subjectId: (f.get("subject") as string) || null,
                  kind: (f.get("kind") as string) || null,
                });
                onClose();
                router.refresh();
              });
            }}
          >
            <select name="subject" defaultValue={event.subjectId ?? ""} className="input">
              <option value="">Aucune matière</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select name="kind" defaultValue={event.kind} className="input">
              <option value="cours">Cours</option>
              <option value="ds">DS</option>
              <option value="kholle">Khôlle</option>
              <option value="autre">Autre</option>
            </select>
            <button className="btn btn-primary col-span-2" disabled={pending} aria-busy={pending}>
              Enregistrer
            </button>
          </form>
        </details>
      </div>
    </Sheet>
  );
}
