"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { WeekGrid } from "@/components/calendar/week-grid";
import { Spinner } from "@/components/ui/spinner";
import { getGridRange } from "@/app/actions/calendar";
import { cn } from "@/lib/format";
import type { GridEvent, GridSession } from "@/lib/data/week";
import type { Subject } from "@/lib/types";

const STORAGE_KEY = "pp-week-collapsed";
const headFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" });
const dkFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });

function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function mondayOf(key: string) {
  const wd = new Date(`${key}T12:00:00Z`).getUTCDay();
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}
const label = (key: string) => headFmt.format(new Date(`${key}T12:00:00Z`));

/** iPhone (< 640 px) : 3 jours ; sinon 7. */
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

interface Loaded {
  from: string;
  days: number;
  events: GridEvent[];
  sessions: GridSession[];
}

/**
 * Planning navigable : 7 jours sur grand écran, 3 jours sur iPhone avec glissement du doigt.
 * Variante « dashboard » : repliable (mémorisé). Variante « calendar » : toujours ouverte.
 */
export function WeekPlanner({
  initial,
  today,
  subjects,
  variant = "dashboard",
  weekAReference,
}: {
  initial: { monday: string; week?: "A" | "B"; events: GridEvent[]; sessions: GridSession[] };
  today: string;
  subjects: Subject[];
  variant?: "dashboard" | "calendar";
  weekAReference?: string;
}) {
  const mobile = useIsMobile();
  const [loaded, setLoaded] = useState<Loaded>({ from: initial.monday, days: 7, events: initial.events, sessions: initial.sessions });
  const [start, setStart] = useState(initial.monday);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startT] = useTransition();
  const touch = useRef<{ x: number; y: number } | null>(null);

  const span = mobile ? 3 : 7;

  useEffect(() => {
    if (variant !== "dashboard") return;
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
  }, [variant]);

  // Passage mobile ↔ desktop : sur iPhone on part d'aujourd'hui (si dans la semaine affichée), sinon du lundi.
  useEffect(() => {
    setStart((s) => {
      if (mobile) {
        const inWeek = today >= initial.monday && today <= addDays(initial.monday, 6);
        return s === initial.monday && inWeek ? today : s;
      }
      return mondayOf(s);
    });
  }, [mobile, today, initial.monday]);

  // Après une action (devoir créé, session modifiée), le serveur renvoie de nouvelles données.
  useEffect(() => {
    setLoaded((l) => (l.from === initial.monday && l.days === 7 ? { from: initial.monday, days: 7, events: initial.events, sessions: initial.sessions } : l));
  }, [initial]);

  const ensure = useCallback(
    (from: string, n: number) => {
      const inside = from >= loaded.from && addDays(from, n - 1) <= addDays(loaded.from, loaded.days - 1);
      if (inside) return;
      setError(null);
      startT(async () => {
        try {
          // Une marge de chaque côté pour que les glissements suivants soient instantanés.
          const r = await getGridRange(addDays(from, -3), n + 6);
          setLoaded({ from: r.from, days: r.days, events: r.events, sessions: r.sessions });
        } catch {
          setError("Impossible de charger ces jours");
        }
      });
    },
    [loaded],
  );

  useEffect(() => {
    ensure(start, span);
  }, [start, span, ensure]);

  const go = (dir: -1 | 1) => setStart((s) => addDays(s, dir * span));
  const goToday = () => setStart(mobile ? today : mondayOf(today));

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });

  const days = Array.from({ length: span }, (_, i) => addDays(start, i));
  const inView = (iso: string) => {
    const k = dkFmt.format(new Date(iso));
    return k >= days[0] && k <= days[days.length - 1];
  };
  const events = loaded.events.filter((e) => inView(e.start));
  const sessions = loaded.sessions.filter((s) => inView(s.start));
  const isNow = days.includes(today);
  const weekLetter = (() => {
    if (!weekAReference) return initial.week;
    const diff = Math.round((Date.parse(mondayOf(start)) - Date.parse(mondayOf(weekAReference))) / (7 * 86_400_000));
    return Math.abs(diff) % 2 === 0 ? "A" : "B";
  })();

  const title = (
    <>
      {variant === "dashboard" ? "Planning · " : ""}
      {label(days[0])} → {label(days[days.length - 1])}
      {weekLetter && <span className="ml-2 chip h-5">Sem. {weekLetter}</span>}
    </>
  );

  const body = (
    <div
      className={cn("relative transition-opacity touch-pan-y", pending && "opacity-50")}
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        if (!touch.current) return;
        const dx = e.changedTouches[0].clientX - touch.current.x;
        const dy = e.changedTouches[0].clientY - touch.current.y;
        touch.current = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
      }}
    >
      {error && <p className="text-sm text-danger mb-2">{error}</p>}
      <WeekGrid days={days} events={events} sessions={sessions} subjects={subjects} today={today} compact={variant === "dashboard"} />
      {pending && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <Spinner className="rounded-full bg-surface px-3 py-2 shadow text-primary" label="Chargement…" />
        </div>
      )}
      {mobile && <p className="text-[11px] text-muted text-center mt-2">Glisse vers la gauche ou la droite pour changer de jours</p>}
    </div>
  );

  const nav = (
    <div className="flex items-center gap-1.5">
      {pending && <Spinner className="text-primary mr-1" />}
      <button className="btn btn-outline h-8 w-8 p-0" onClick={() => go(-1)} aria-label="Précédent">
        <ChevronLeft className="size-4" />
      </button>
      <button className="btn btn-ghost h-8 text-xs" onClick={goToday} disabled={isNow && (!mobile || days[0] === today)}>
        Aujourd&apos;hui
      </button>
      <button className="btn btn-outline h-8 w-8 p-0" onClick={() => go(1)} aria-label="Suivant">
        <ChevronRight className="size-4" />
      </button>
      {variant === "dashboard" && (
        <Link href={`/calendrier?view=semaine&date=${start}`} className="text-xs text-primary font-medium ml-1 hidden sm:inline">
          Calendrier
        </Link>
      )}
    </div>
  );

  if (variant === "calendar") {
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          {nav}
        </div>
        {body}
      </div>
    );
  }

  return (
    <section className="card card-pad min-w-0">
      <div className={cn("flex flex-wrap items-center justify-between gap-2", !collapsed && "mb-3")}>
        <button onClick={toggle} className="flex items-center gap-2 text-left" aria-expanded={!collapsed}>
          <ChevronDown className={cn("size-4 text-muted transition-transform", collapsed && "-rotate-90")} />
          <h2 className="section-title">{title}</h2>
        </button>
        {!collapsed && nav}
      </div>
      {!collapsed && body}
    </section>
  );
}
