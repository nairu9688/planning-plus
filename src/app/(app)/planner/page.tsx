import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { requireUser } from "@/lib/data/auth";
import { addDays, dateKey, parisDateTime } from "@/lib/domain/time";
import { isHoliday } from "@/lib/domain/holidays";
import { cn, formatDayLong, formatMinutes, formatTime, keyToDate, relativeDay } from "@/lib/format";
import { PageHeader, SubjectDot } from "@/components/ui/misc";
import { QuickAddButton } from "@/components/shell/quick-add";
import { SuggestionActions } from "./session-controls";
import type { CalendarEvent, SessionItem, StudySession } from "@/lib/types";

const KIND_LABEL: Record<string, string> = { etude: "Étude", maison: "Maison", suggestion: "Suggestion", bibliotheque: "Bibliothèque", sport: "Sport", libre: "Libre" };

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const sp = await searchParams;
  const { supabase, ctx } = await requireUser();
  const today = dateKey(new Date());
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : addDays(today, -1);
  const days = Array.from({ length: 10 }, (_, i) => addDays(from, i));
  const to = days[days.length - 1];

  const [{ data: sessions }, { data: events }] = await Promise.all([
    supabase
      .from("study_sessions")
      .select("*, items:session_items(*)")
      .eq("user_id", ctx.userId)
      .gte("date", from)
      .lte("date", to)
      .neq("status", "ignoree")
      .order("start_at"),
    supabase
      .from("calendar_events")
      .select("id, kind, title, start_at, subject_id")
      .eq("user_id", ctx.userId)
      .in("kind", ["ds", "kholle"])
      .gte("start_at", parisDateTime(from).toISOString())
      .lt("start_at", parisDateTime(addDays(to, 1)).toISOString()),
  ]);
  const list = (sessions ?? []) as (StudySession & { items: SessionItem[] })[];

  return (
    <div>
      <PageHeader
        title="Study Planner"
        subtitle="Planifie tes sessions, remplis-les, fais le bilan."
        action={
          <div className="flex gap-2">
            <Link href={`/planner?from=${addDays(from, -7)}`} className="btn btn-outline w-9 p-0" aria-label="Plus tôt"><ChevronLeft className="size-4" /></Link>
            <Link href="/planner" className="btn btn-ghost">Aujourd&apos;hui</Link>
            <Link href={`/planner?from=${addDays(from, 7)}`} className="btn btn-outline w-9 p-0" aria-label="Plus tard"><ChevronRight className="size-4" /></Link>
            <QuickAddButton className="btn btn-primary" detail={{ type: "session" }}>
              <Plus className="size-4" /> Session
            </QuickAddButton>
          </div>
        }
      />
      <div className="space-y-3">
        {days.map((d) => {
          const daySessions = list.filter((s) => s.date === d);
          const dayEvents = ((events ?? []) as CalendarEvent[]).filter((e) => dateKey(e.start_at) === d);
          return (
            <section key={d} className={cn("card card-pad", d === today && "ring-1 ring-primary/40", d < today && "opacity-80")}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h2 className="section-title">
                  {formatDayLong(keyToDate(d))} <span className="text-muted font-normal">· {relativeDay(d, today)}</span>
                  {isHoliday(d, ctx.holidays) && <span className="chip ml-2">vacances</span>}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {dayEvents.map((e) => (
                    <span key={e.id} className="chip font-semibold">
                      <SubjectDot color={ctx.subjectById.get(e.subject_id ?? "")?.color} />
                      {e.kind === "ds" ? "DS" : "Khôlle"} · {formatTime(e.start_at)}
                    </span>
                  ))}
                  <QuickAddButton className="chip h-6 hover:bg-primary-tint" detail={{ type: "session", date: d }}>
                    <Plus className="size-3" /> session
                  </QuickAddButton>
                </div>
              </div>
              {daySessions.length ? (
                <ul className="space-y-2">
                  {daySessions.map((s) => {
                    const slot = (new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 60_000;
                    const items = s.items.filter((i) => !i.removed_in_review);
                    const planned = items.reduce((a, i) => a + i.planned_minutes, 0);
                    const suggestion = s.status === "suggeree";
                    return (
                      <li key={s.id} className={cn("rounded-xl p-3 border", suggestion ? "border-dashed border-primary/50" : "border-border hatch")}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/planner/${s.id}`} className="flex-1 min-w-0">
                            <p className="text-sm font-medium">
                              {KIND_LABEL[s.kind]} · {formatTime(s.start_at)} – {formatTime(s.end_at)}
                              {s.status === "bilan_fait" && <span className="chip ml-2 bg-success/15 text-success">bilan fait</span>}
                              {suggestion && <span className="chip ml-2">suggérée</span>}
                            </p>
                            {items.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {items.map((i) => (
                                  <span key={i.id} className={cn("chip bg-surface", i.done && "line-through opacity-60")}>
                                    <SubjectDot color={ctx.subjectById.get(i.subject_id ?? "")?.color} />
                                    {i.description ?? ctx.subjectById.get(i.subject_id ?? "")?.name ?? "Élément"}
                                  </span>
                                ))}
                              </div>
                            )}
                          </Link>
                          {suggestion ? (
                            <SuggestionActions id={s.id} />
                          ) : (
                            <div className="flex gap-1.5">
                              <Link href={`/planner/${s.id}/focus`} className="btn btn-outline h-8">Focus</Link>
                              <Link href={`/planner/${s.id}/bilan`} className="btn btn-outline h-8">Bilan</Link>
                            </div>
                          )}
                        </div>
                        {!suggestion && (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                            <div className="h-1.5 flex-1 rounded-full bg-surface-2 overflow-hidden">
                              <div className={cn("h-full rounded-full", planned > slot ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, (planned / slot) * 100)}%` }} />
                            </div>
                            {formatMinutes(planned)} / {formatMinutes(slot)}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">Aucune session.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
