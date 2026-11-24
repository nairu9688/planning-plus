"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { WeekGrid } from "@/components/calendar/week-grid";
import { Spinner } from "@/components/ui/spinner";
import { getWeekGrid } from "@/app/actions/calendar";
import { cn } from "@/lib/format";
import type { GridEvent, GridSession } from "@/lib/data/week";
import type { Subject } from "@/lib/types";

const STORAGE_KEY = "pp-week-collapsed";
const headFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" });

function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
const label = (key: string) => headFmt.format(new Date(`${key}T12:00:00Z`));

interface WeekData {
  monday: string;
  week: "A" | "B";
  events: GridEvent[];
  sessions: GridSession[];
}

/** Planning de la semaine du tableau de bord : repliable, navigation semaine par semaine sans changer de page. */
export function WeekPlanner({ initial, today, subjects }: { initial: WeekData; today: string; subjects: Subject[] }) {
  const [data, setData] = useState(initial);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const currentMonday = initial.monday;

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
  }, []);
  // Après une action (devoir créé, session modifiée), la page renvoie de nouvelles données.
  useEffect(() => {
    setData((d) => (d.monday === initial.monday ? initial : d));
  }, [initial]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const go = (monday: string) => {
    setError(null);
    start(async () => {
      try {
        setData(await getWeekGrid(monday));
      } catch {
        setError("Impossible de charger cette semaine");
      }
    });
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(data.monday, i));
  const isCurrent = data.monday === currentMonday;

  return (
    <section className="card card-pad">
      <div className={cn("flex flex-wrap items-center justify-between gap-2", !collapsed && "mb-3")}>
        <button onClick={toggle} className="flex items-center gap-2 text-left" aria-expanded={!collapsed}>
          <ChevronDown className={cn("size-4 text-muted transition-transform", collapsed && "-rotate-90")} />
          <h2 className="section-title">
            Planning de la semaine · {label(data.monday)} → {label(addDays(data.monday, 6))}
            <span className="ml-2 chip h-5">Sem. {data.week}</span>
          </h2>
        </button>
        {!collapsed && (
          <div className="flex items-center gap-1.5">
            {pending && <Spinner className="text-primary mr-1" />}
            <button className="btn btn-outline h-8 w-8 p-0" onClick={() => go(addDays(data.monday, -7))} disabled={pending} aria-busy={pending} aria-label="Semaine précédente">
              <ChevronLeft className="size-4" />
            </button>
            <button className="btn btn-ghost h-8 text-xs" onClick={() => go(currentMonday)} aria-busy={pending} disabled={pending || isCurrent}>
              Cette semaine
            </button>
            <button className="btn btn-outline h-8 w-8 p-0" onClick={() => go(addDays(data.monday, 7))} disabled={pending} aria-busy={pending} aria-label="Semaine suivante">
              <ChevronRight className="size-4" />
            </button>
            <Link href={`/calendrier?view=semaine&date=${data.monday}`} className="text-xs text-primary font-medium ml-1 hidden sm:inline">
              Calendrier
            </Link>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className={cn("relative transition-opacity", pending && "opacity-50 pointer-events-none")}>
          {error && <p className="text-sm text-danger mb-2">{error}</p>}
          <WeekGrid days={days} events={data.events} sessions={data.sessions} subjects={subjects} today={today} compact />
          {pending && (
            <div className="absolute inset-0 grid place-items-center">
              <Spinner className="rounded-full bg-surface px-3 py-2 shadow text-primary" label="Chargement de la semaine…" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
