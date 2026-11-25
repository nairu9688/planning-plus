import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { requireUser } from "@/lib/data/auth";
import { loadGrid } from "@/lib/data/week";
import { loadDs } from "@/lib/data/exams";
import { loadItemsBetween, realMinutes } from "@/lib/data/work";
import { addDays, dateKey, mondayOf, parisDateTime, weekLetter } from "@/lib/domain/time";
import { isHoliday } from "@/lib/domain/holidays";
import { cn, formatDayLong, formatMinutes, formatMonthYear, keyToDate, tint } from "@/lib/format";
import { WeekGrid } from "@/components/calendar/week-grid";
import { WeekPlanner } from "@/components/dashboard/week-planner";
import { QuickAddButton } from "@/components/shell/quick-add";

type View = "jour" | "semaine" | "mois" | "annee";
const VIEWS: { v: View; label: string }[] = [
  { v: "jour", label: "Jour" },
  { v: "semaine", label: "Semaine" },
  { v: "mois", label: "Mois" },
  { v: "annee", label: "Année" },
];

function monthStart(key: string) {
  return `${key.slice(0, 7)}-01`;
}
function addMonths(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function schoolYearStart(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${m >= 8 ? y : y - 1}-08-31`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: View; date?: string }> }) {
  const sp = await searchParams;
  const view: View = sp.view ?? "semaine";
  const { supabase, ctx } = await requireUser();
  const today = dateKey(new Date());
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const nav = (() => {
    switch (view) {
      case "jour":
        return { prev: addDays(date, -1), next: addDays(date, 1), title: formatDayLong(keyToDate(date)) };
      case "semaine": {
        const mon = mondayOf(date);
        return { prev: addDays(mon, -7), next: addDays(mon, 7), title: `Semaine du ${formatDayLong(keyToDate(mon)).toLowerCase()} · ${weekLetter(mon, ctx.settings.week_a_reference_date)}` };
      }
      case "mois":
        return { prev: addMonths(date, -1), next: addMonths(date, 1), title: formatMonthYear(keyToDate(monthStart(date))) };
      case "annee": {
        const start = schoolYearStart(date);
        return { prev: addDays(start, -360), next: addDays(start, 370), title: `Année scolaire ${start.slice(0, 4)}–${Number(start.slice(0, 4)) + 1}` };
      }
    }
  })();

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 pr-11 md:pr-0">
        <div className="flex items-center gap-2">
          <Link href={`/calendrier?view=${view}&date=${nav.prev}`} className="btn btn-outline h-9 w-9 p-0" aria-label="Précédent">
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={`/calendrier?view=${view}&date=${nav.next}`} className="btn btn-outline h-9 w-9 p-0" aria-label="Suivant">
            <ChevronRight className="size-4" />
          </Link>
          <Link href={`/calendrier?view=${view}`} className="btn btn-ghost">Aujourd&apos;hui</Link>
          <h1 className="text-lg font-semibold ml-1">{nav.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex p-0.5 rounded-xl bg-surface-2 text-xs font-medium">
            {VIEWS.map((v) => (
              <Link key={v.v} href={`/calendrier?view=${v.v}&date=${date}`} className={cn("px-3 h-8 grid place-items-center rounded-[10px]", v.v === view ? "bg-surface shadow-sm" : "text-muted")}>
                {v.label}
              </Link>
            ))}
          </div>
          <QuickAddButton className="btn btn-primary" detail={{ type: "devoir", date }}>
            <Plus className="size-4" /> <span className="hidden sm:inline">Nouveau</span>
          </QuickAddButton>
        </div>
      </header>

      <div className="card p-2 sm:p-3">
        {view === "jour" && <DayOrWeek days={[date]} today={today} />}
        {view === "semaine" && <ResponsiveWeek monday={mondayOf(date)} today={today} />}
        {view === "mois" && <MonthView month={monthStart(date)} today={today} />}
        {view === "annee" && <YearView start={schoolYearStart(date)} today={today} />}
      </div>
    </div>
  );

  async function DayOrWeek({ days, today }: { days: string[]; today: string }) {
    const grid = await loadGrid(supabase, ctx, days[0], days.length);
    return <WeekGrid days={days} events={grid.events} sessions={grid.sessions} subjects={ctx.subjects} today={today} />;
  }

  // Semaine : 7 jours sur grand écran, 3 jours avec glissement sur iPhone.
  async function ResponsiveWeek({ monday, today }: { monday: string; today: string }) {
    const grid = await loadGrid(supabase, ctx, monday, 7);
    return (
      <WeekPlanner
        key={monday}
        variant="calendar"
        initial={{ monday, events: grid.events, sessions: grid.sessions }}
        today={today}
        subjects={ctx.subjects}
        weekAReference={ctx.settings.week_a_reference_date}
      />
    );
  }

  async function MonthView({ month, today }: { month: string; today: string }) {
    const first = mondayOf(month);
    const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
    const grid = await loadGrid(supabase, ctx, first, 42);
    const { data: hw } = await supabase
      .from("homework")
      .select("id, title, subject_id, due_at, status")
      .eq("user_id", ctx.userId)
      .gte("due_at", parisDateTime(first).toISOString())
      .lt("due_at", parisDateTime(addDays(first, 42)).toISOString());
    const items = await loadItemsBetween(supabase, ctx.userId, first, addDays(first, 41));
    const minutesByDay = new Map<string, number>();
    for (const i of items) minutesByDay.set(i.session.date, (minutesByDay.get(i.session.date) ?? 0) + realMinutes(i));
    const curMonth = month.slice(0, 7);
    return (
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((d) => (
          <div key={d} className="bg-surface text-center text-[11px] text-muted py-1.5">{d}</div>
        ))}
        {days.map((d) => {
          const important = grid.events.filter((e) => dateKey(e.start) === d && (e.kind === "ds" || e.kind === "kholle"));
          const due = (hw ?? []).filter((h) => h.due_at && dateKey(h.due_at) === d);
          const m = minutesByDay.get(d) ?? 0;
          return (
            <Link
              key={d}
              href={`/calendrier?view=jour&date=${d}`}
              className={cn("bg-surface min-h-24 p-1.5 text-xs space-y-1 hover:bg-surface-2", d.slice(0, 7) !== curMonth && "opacity-45", isHoliday(d, ctx.holidays) && "bg-surface-2")}
            >
              <div className="flex items-center justify-between">
                <span className={cn("font-medium", d === today && "rounded-full bg-primary text-on-primary px-1.5")}>{Number(d.slice(8))}</span>
                {m > 0 && <span className="text-[10px] text-primary">{formatMinutes(m)}</span>}
              </div>
              {important.map((e) => (
                <div key={e.id} className="truncate rounded px-1 font-semibold border-l-2" style={{ background: tint(e.color ?? "#888", 0.18), borderColor: e.color ?? "#888" }}>
                  {e.title}
                </div>
              ))}
              {due.map((h) => (
                <div key={h.id} className={cn("truncate flex items-center gap-1", h.status === "fait" && "line-through text-muted")}>
                  <span className="size-1.5 rounded-full shrink-0" style={{ background: ctx.subjectById.get(h.subject_id ?? "")?.color ?? "#888" }} />
                  {h.title}
                </div>
              ))}
            </Link>
          );
        })}
      </div>
    );
  }

  async function YearView({ start, today }: { start: string; today: string }) {
    const first = mondayOf(addDays(start, 1));
    const weeks = 48;
    const last = addDays(first, weeks * 7 - 1);
    const [items, ds] = await Promise.all([
      loadItemsBetween(supabase, ctx.userId, first, last),
      loadDs(supabase, ctx.userId, { from: parisDateTime(first), to: parisDateTime(last) }),
    ]);
    const minutes = new Map<string, number>();
    for (const i of items) minutes.set(i.session.date, (minutes.get(i.session.date) ?? 0) + realMinutes(i));
    const cbDays = new Set(ds.filter((d) => d.cb_period_id).map((d) => dateKey(d.event.start_at)));
    const dsDays = new Set(ds.map((d) => dateKey(d.event.start_at)));
    const max = Math.max(60, ...minutes.values());
    const total = [...minutes.values()].reduce((a, b) => a + b, 0);
    const level = (m: number) => (m <= 0 ? 0 : Math.min(4, Math.ceil((m / max) * 4)));
    const LEVEL_ALPHA = [0, 0.25, 0.45, 0.7, 1];
    return (
      <div className="space-y-3 p-1">
        <p className="text-sm text-muted">
          Temps de travail réel : <span className="font-semibold text-text">{formatMinutes(total)}</span>
        </p>
        <div className="overflow-x-auto">
          <div className="inline-grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: "repeat(7, 14px)" }}>
            {Array.from({ length: weeks * 7 }, (_, i) => {
              const d = addDays(first, i);
              const m = minutes.get(d) ?? 0;
              const holiday = isHoliday(d, ctx.holidays);
              return (
                <Link
                  key={d}
                  href={`/calendrier?view=jour&date=${d}`}
                  title={`${d} · ${formatMinutes(m)}${holiday ? " · vacances" : ""}${cbDays.has(d) ? " · CB" : dsDays.has(d) ? " · DS" : ""}`}
                  className={cn(
                    "size-[14px] rounded-[3px] border",
                    d === today ? "border-text" : cbDays.has(d) ? "border-danger" : dsDays.has(d) ? "border-warning" : "border-transparent",
                  )}
                  style={{
                    background: m > 0 ? `color-mix(in srgb, var(--primary) ${LEVEL_ALPHA[level(m)] * 100}%, transparent)` : holiday ? "repeating-linear-gradient(135deg, var(--border) 0 2px, transparent 2px 4px)" : "var(--surface-2)",
                  }}
                />
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1"><span className="size-3 rounded-[3px] bg-surface-2" /> rien</span>
          <span className="flex items-center gap-1"><span className="size-3 rounded-[3px] bg-primary" /> beaucoup</span>
          <span className="flex items-center gap-1"><span className="size-3 rounded-[3px] border border-danger" /> concours blanc</span>
          <span className="flex items-center gap-1"><span className="size-3 rounded-[3px] border border-warning" /> DS</span>
          <span className="flex items-center gap-1"><span className="size-3 rounded-[3px]" style={{ background: "repeating-linear-gradient(135deg, var(--border) 0 2px, transparent 2px 4px)" }} /> vacances</span>
        </div>
        <p className="text-[11px] text-muted">Colonnes = semaines (lundi en haut).</p>
      </div>
    );
  }
}
