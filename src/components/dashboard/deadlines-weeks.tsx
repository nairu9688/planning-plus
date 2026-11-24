import Link from "next/link";
import { CalendarCheck, GraduationCap, MessagesSquare } from "lucide-react";
import { addDays, dateKey, weekdayOf } from "@/lib/domain/time";
import { cn, formatMinutes, formatTime, keyToDate, tint } from "@/lib/format";
import { HomeworkCheck } from "@/components/dashboard/widgets";
import type { DeadlineRow } from "@/lib/data/dashboard";
import type { Subject } from "@/lib/types";

const DAY = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
const dayNum = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" });

/**
 * Échéances des 3 prochaines semaines, une colonne par semaine :
 * bande des 7 jours (chargement visuel), puis les jours qui ont quelque chose.
 * Sur mobile, les semaines défilent horizontalement.
 */
export function DeadlinesWeeks({
  rows,
  monday,
  today,
  subjects,
}: {
  rows: DeadlineRow[];
  monday: string;
  today: string;
  subjects: Map<string, Subject>;
}) {
  const weeks = [0, 1, 2].map((w) => {
    const start = addDays(monday, w * 7);
    const end = addDays(start, 6);
    const items = rows.filter((r) => {
      if (!r.at) return false;
      const k = dateKey(r.at);
      // Devoirs en retard : rangés dans la semaine en cours.
      if (w === 0 && k < start) return true;
      return k >= start && k <= end;
    });
    return { w, start, end, items };
  });

  return (
    <section className="card card-pad min-w-0">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="section-title">Échéances des 3 prochaines semaines</h2>
        <Link href="/devoirs" className="text-xs text-primary font-medium whitespace-nowrap shrink-0">Devoirs →</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible pb-1">
        {weeks.map((wk) => (
          <WeekColumn key={wk.w} {...wk} today={today} subjects={subjects} />
        ))}
      </div>
    </section>
  );
}

function WeekColumn({
  w,
  start,
  end,
  items,
  today,
  subjects,
}: {
  w: number;
  start: string;
  end: string;
  items: DeadlineRow[];
  today: string;
  subjects: Map<string, Subject>;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const count = (k: DeadlineRow["kind"]) => items.filter((i) => i.kind === k).length;
  const title = w === 0 ? "Cette semaine" : w === 1 ? "Semaine prochaine" : "Dans 2 semaines";
  const byDay = new Map<string, DeadlineRow[]>();
  for (const it of items) {
    const k = dateKey(it.at!) < start ? "retard" : dateKey(it.at!);
    byDay.set(k, [...(byDay.get(k) ?? []), it]);
  }
  const order = ["retard", ...days].filter((k) => byDay.has(k));

  return (
    <div className="snap-start shrink-0 w-[85%] sm:w-[60%] lg:w-auto min-w-0 rounded-2xl border border-border bg-surface-2/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[11px] text-muted">
          {dayNum.format(keyToDate(start))} → {dayNum.format(keyToDate(end))}
        </p>
      </div>

      {/* Bande des 7 jours : couleur = épreuve la plus importante du jour. */}
      <div className="grid grid-cols-7 gap-1 mt-2.5">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const ds = list.find((x) => x.kind === "ds");
          const kh = list.find((x) => x.kind === "kholle");
          const hw = list.filter((x) => x.kind === "homework").length;
          const main = ds ?? kh;
          const color = main?.subjectId ? subjects.get(main.subjectId)?.color : undefined;
          return (
            <div
              key={d}
              title={list.map((x) => x.title).join(" · ")}
              className={cn(
                "rounded-lg h-11 flex flex-col items-center justify-center text-[10px] leading-tight border",
                d === today ? "border-primary" : "border-transparent",
                !main && "bg-surface",
              )}
              style={main ? { background: tint(color ?? "#8a93a6", ds ? 0.35 : 0.2) } : undefined}
            >
              <span className={cn("uppercase", d === today ? "text-primary font-semibold" : "text-muted")}>{DAY[weekdayOf(d)].slice(0, 1)}</span>
              <span className={cn("font-semibold", ds && "text-text")}>{Number(d.slice(8))}</span>
              <span className="flex gap-0.5 h-1.5 mt-0.5">
                {ds && <span className="size-1.5 rounded-full bg-danger" />}
                {kh && <span className="size-1.5 rounded-full bg-primary" />}
                {Array.from({ length: Math.min(3, hw) }, (_, i) => (
                  <span key={i} className="size-1.5 rounded-full bg-muted/60" />
                ))}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1.5 mt-2.5 text-[11px]">
        <span className={cn("chip h-5", count("ds") > 0 && "bg-danger/15 text-danger")}><GraduationCap className="size-3" /> {count("ds")} DS</span>
        <span className={cn("chip h-5", count("kholle") > 0 && "bg-primary-tint text-primary")}><MessagesSquare className="size-3" /> {count("kholle")}</span>
        <span className="chip h-5"><CalendarCheck className="size-3" /> {count("homework")} devoirs</span>
      </div>

      <div className="mt-3 space-y-2.5">
        {order.length === 0 && <p className="text-sm text-muted py-3 text-center">Semaine libre ✨</p>}
        {order.map((k) => (
          <div key={k}>
            <p className={cn("text-[11px] font-semibold uppercase tracking-wide mb-1", k === "retard" ? "text-danger" : k === today ? "text-primary" : "text-muted")}>
              {k === "retard" ? "En retard" : k === today ? "Aujourd'hui" : `${DAY[weekdayOf(k)]} ${Number(k.slice(8))}`}
            </p>
            <ul className="space-y-1">
              {byDay.get(k)!.map((r) => (
                <Item key={`${r.kind}-${r.id}`} r={r} subject={r.subjectId ? subjects.get(r.subjectId) : undefined} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Item({ r, subject }: { r: DeadlineRow; subject?: Subject }) {
  const color = subject?.color ?? "#8a93a6";
  if (r.kind === "homework") {
    return (
      <li className="flex items-center gap-2 min-w-0">
        <HomeworkCheck id={r.id} done={false} className="size-4" />
        <span className="size-2 rounded-full shrink-0" style={{ background: color }} />
        <Link href={r.href} className={cn("flex-1 min-w-0 truncate text-sm", r.priority === "haute" && "font-semibold")}>
          {r.title}
        </Link>
      </li>
    );
  }
  const pct = r.gauge === null || r.gauge === undefined ? null : Math.round(r.gauge * 100);
  return (
    <li>
      <Link
        href={r.href}
        className={cn("block rounded-xl px-2.5 py-2 border-l-[3px] min-w-0 hover:brightness-95 transition", r.kind === "ds" && "ring-1")}
        style={{ background: tint(color, 0.16), borderLeftColor: color, ["--tw-ring-color" as string]: tint(color, 0.5) }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn("text-[10px] font-bold px-1.5 rounded", r.kind === "ds" ? "bg-danger text-white" : "bg-primary text-on-primary")}>
            {r.kind === "ds" ? "DS" : "KH"}
          </span>
          <span className="text-sm font-semibold truncate min-w-0 flex-1">{r.title}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-muted">
          <span className="truncate">
            {r.at ? formatTime(r.at) : ""}
            {r.location ? ` · ${r.location}` : ""} · {r.countdownText}
          </span>
          <span className="shrink-0">{formatMinutes(r.worked7d ?? 0)} / 7 j</span>
        </div>
        {pct !== null && (
          <div className="mt-1.5 h-1 rounded-full bg-black/10 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
        )}
      </Link>
    </li>
  );
}
