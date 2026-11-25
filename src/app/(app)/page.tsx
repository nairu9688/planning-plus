import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { requireUser } from "@/lib/data/auth";
import { loadDashboard } from "@/lib/data/dashboard";
import { loadGrid } from "@/lib/data/week";
import { addDays, dateKey, mondayOf, toParis } from "@/lib/domain/time";
import { cn, formatDayLong, formatDayShort, formatMinutes, formatTime, greeting, relativeDay } from "@/lib/format";
import { Card, SubjectDot } from "@/components/ui/misc";
import { PaletteTrigger } from "@/components/shell/command-palette";
import { QuickAddButton } from "@/components/shell/quick-add";
import { SyncButton } from "@/components/shell/auto-sync";
import { WeekPlanner } from "@/components/dashboard/week-planner";
import { DeadlinesWeeks } from "@/components/dashboard/deadlines-weeks";
import { RemainingTabs } from "@/components/dashboard/remaining-tabs";
import { SpacedReviews } from "@/components/dashboard/spaced-reviews";
import { GoalsCard } from "@/components/dashboard/goals-card";
import { loadSpacedReviews } from "@/lib/data/reviews";
import { NotesBoard } from "@/components/dashboard/widgets";
import { LiveSchedule, type LiveBlock } from "@/components/dashboard/live-schedule";
import { DueSoon, TonightHero } from "@/components/dashboard/direction-a";
import { Ring } from "@/components/ui/ring";

export default async function DashboardPage() {
  const { supabase, user, ctx } = await requireUser();
  const now = new Date();
  const [d, grid, reviews, live] = await Promise.all([
    loadDashboard(supabase, ctx, now),
    loadGrid(supabase, ctx, mondayOf(dateKey(now)), 7),
    loadSpacedReviews(supabase, ctx, 0, now),
    loadGrid(supabase, ctx, dateKey(now), 2),
  ]);
  const toLive = (day: string): LiveBlock[] => [
    ...live.events
      .filter((e) => !e.allDay && dateKey(e.start) === day)
      .map((e) => ({ id: e.id, title: e.title, kind: e.kind, start: e.start, end: e.end, color: e.color, location: e.location, href: e.href })),
    ...live.sessions
      .filter((s) => s.status !== "suggeree" && dateKey(s.start) === day)
      .map((s) => ({ id: s.id, title: `Session ${s.label.toLowerCase()}`, kind: "session" as const, start: s.start, end: s.end, color: null, location: null, href: `/planner/${s.id}` })),
  ];
  const liveToday = toLive(dateKey(now));
  const liveTomorrow = toLive(addDays(dateKey(now), 1));
  const subj = (id: string | null) => (id ? ctx.subjectById.get(id) : undefined);
  const firstName = (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? "";

  return (
    <div className="space-y-5">
      {/* En-tête compact (C4) : une ligne, icônes pour la recherche et la synchro, série 🔥 */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted truncate">
            {formatDayLong(now)} · Semaine {d.week}
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <span className="truncate">
              {greeting(toParis(now).getHours())}
              {firstName ? ` ${firstName}` : ""}
            </span>
            {d.streak.days > 0 && (
              <span
                className={cn("chip h-6 shrink-0", d.streak.includesToday ? "bg-warning/15 text-warning" : "")}
                title={d.streak.includesToday ? "Jours d'affilée avec du travail réel" : "Travaille ce soir pour prolonger ta série"}
              >
                🔥 {d.streak.days} j
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <SyncButton lastSync={ctx.settings.last_sync_at} error={ctx.settings.last_sync_error} />
          <PaletteTrigger className="w-9 px-0 sm:w-auto sm:px-3.5" />
          <QuickAddButton className="btn btn-primary hidden md:inline-flex">
            <Plus className="size-4" /> Nouveau
          </QuickAddButton>
        </div>
      </header>

      {ctx.settings.last_sync_error && (
        <p className="text-sm rounded-xl bg-warning/10 text-warning px-3 py-2">Synchro Google : {ctx.settings.last_sync_error}</p>
      )}

      {/* Direction A : aujourd'hui d'abord */}
      <div className="grid lg:grid-cols-3 gap-3 items-start">
        <div className="lg:col-span-2 space-y-3 min-w-0">
          <LiveSchedule today={liveToday} tomorrow={liveTomorrow} />
          <TonightHero
            t={
              d.tonight && {
                id: d.tonight.id,
                mode: d.tonight.kind,
                start: d.tonight.start_at,
                end: d.tonight.end_at,
                status: d.tonight.status,
                location: d.tonight.location,
                items: d.tonight.items
                  .filter((i) => !i.removed_in_review)
                  .map((i) => ({ id: i.id, label: i.description ?? subj(i.subject_id)?.name ?? "Élément", color: subj(i.subject_id)?.color ?? null, minutes: i.planned_minutes, done: i.done })),
              }
            }
          />
        </div>
        <div className="space-y-3 min-w-0">
          {/* C1 : comptes à rebours en anneaux (défilement horizontal sur iPhone) */}
          <div className="flex gap-3 overflow-x-auto snap-x -mx-4 px-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-2 lg:overflow-visible pb-1">
            <RingTile
              href={d.nextDs?.href ?? "/ds"}
              label="Prochain DS"
              empty="Aucun DS à venir"
              emptyAction="Voir les DS"
              ring={d.nextDs && { value: d.nextDs.gauge, big: d.nextDs.countdown.evenings, small: d.nextDs.countdown.evenings > 1 ? "soirs" : "soir", color: subj(d.nextDs.subjectId)?.color }}
              title={d.nextDs ? shortExam(d.nextDs.title) : null}
              sub={d.nextDs ? `${formatDayShort(d.nextDs.start)} ${formatTime(d.nextDs.start)} · ${d.nextDs.countdown.weekends} WE · prépa ${d.nextDs.gauge === null ? "—" : `${Math.round(d.nextDs.gauge * 100)} %`}` : null}
            />
            <RingTile
              href={d.nextKholle?.href ?? "/kholles"}
              label="Khôlle"
              empty="Aucune khôlle à venir"
              emptyAction="Voir les khôlles"
              ring={d.nextKholle && { value: Math.min(1, d.nextKholle.worked7d / 120), big: d.nextKholle.countdown.evenings, small: d.nextKholle.countdown.evenings > 1 ? "soirs" : "soir", color: subj(d.nextKholle.subjectId)?.color }}
              title={d.nextKholle ? shortExam(d.nextKholle.title) : null}
              sub={d.nextKholle ? `${formatDayShort(d.nextKholle.start)} ${formatTime(d.nextKholle.start)}${d.nextKholle.location ? ` · ${d.nextKholle.location}` : ""} · ${formatMinutes(d.nextKholle.worked7d)} de prépa` : null}
            />
            <RingTile
              href={d.cb ? `/ds/cb/${d.cb.period.id}` : "/ds"}
              label="Concours blanc"
              empty="Pas encore de CB"
              emptyAction="Coche « concours blanc » sur un DS"
              ring={d.cb && { value: null, big: d.cb.countdown.evenings, small: "soirs", color: "var(--primary)" }}
              title={d.cb?.period.name ?? null}
              sub={d.cb ? `${d.cb.exams.length} épreuves · ${d.cb.countdown.weekends} WE` : null}
            />
            <RingTile
              href="/stats"
              label="Semaine"
              ring={{ value: d.weekWork.planned ? d.weekWork.real / d.weekWork.planned : null, big: formatMinutes(d.weekWork.real), small: `/ ${formatMinutes(d.weekWork.planned)}`, color: "var(--success)", bigSize: 0.22 }}
              title="Travail réel"
              sub={`Semaine écoulée à ${Math.round(d.weekWork.pct * 100)} %`}
            />
          </div>

          <DueSoon
            total={d.deadlines.filter((r) => r.kind === "homework").length}
            items={d.deadlines
              .filter((r) => r.kind === "homework" && r.at && dateKey(r.at) <= addDays(d.today, 3))
              .slice(0, 6)
              .map((r) => ({
                id: r.id,
                title: r.title,
                color: subj(r.subjectId)?.color ?? null,
                subject: subj(r.subjectId)?.name ?? null,
                dueLabel: relativeDay(dateKey(r.at!), d.today),
                overdue: dateKey(r.at!) < d.today,
                high: r.priority === "haute",
              }))}
          />

          <Card title="Post-its" action={<QuickAddButton detail={{ type: "postit" }} className="btn btn-ghost h-7 px-2 text-xs"><Plus className="size-3.5" /> Ajouter</QuickAddButton>}>
            <NotesBoard notes={d.notes} />
          </Card>
        </div>
      </div>

      {/* Planning de la semaine (repliable, navigation sans quitter la page) */}
      <WeekPlanner initial={{ monday: d.monday, week: d.week, ...grid }} today={d.today} subjects={ctx.subjects} weekAReference={ctx.settings.week_a_reference_date} />

      {d.neglected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
          <AlertTriangle className="size-4 text-warning" />
          <span className="text-muted">Matières délaissées :</span>
          {d.neglected.slice(0, 5).map((n) => (
            <Link key={n.subject.id} href={`/matieres/${n.subject.key}`} className="chip">
              <SubjectDot color={n.subject.color} />
              {n.subject.name} · {n.days === null ? "jamais" : `${n.days} j`}
            </Link>
          ))}
        </div>
      )}

      <DeadlinesWeeks rows={d.deadlines} monday={d.monday} today={d.today} subjects={ctx.subjectById} />

      <div className="grid md:grid-cols-2 gap-3">
        <RemainingTabs
          groups={[
            {
              key: "devoirs",
              label: "Devoirs",
              more: "/devoirs?echeance=semaine",
              rows: d.remaining.homework.map((h) => ({ id: h.id, label: h.title, color: subj(h.subject_id)?.color, meta: h.due_at ? formatDayShort(h.due_at) : undefined, href: `/devoirs?id=${h.id}`, homework: true })),
            },
            {
              key: "revisions",
              label: "Révisions",
              more: "/planner",
              rows: d.remaining.revisions.map((i) => ({ id: i.id, label: i.description ?? subj(i.subject_id)?.name ?? "Révision", color: subj(i.subject_id)?.color, meta: formatDayShort(i.session.start_at), href: `/planner/${i.session_id}` })),
            },
            {
              key: "prep",
              label: "Avant DS/KH",
              more: "/ds",
              rows: d.remaining.prepTasks.map((t) => ({ id: t.id, label: t.title, href: t.target_type === "ds" ? `/ds/${t.target_id}` : `/kholles/${t.target_id}` })),
            },
          ]}
        />

        <SpacedReviews
          rows={reviews.map((r) => ({ itemId: r.itemId, title: r.title, subject: r.subject?.name ?? null, color: r.subject?.color ?? null, step: r.step, overdueDays: r.overdueDays }))}
        />

        <GoalsCard subjects={ctx.subjects} goals={ctx.settings.weekly_goals ?? {}} minutes={d.weekBySubject} weekElapsed={d.weekWork.pct} />

      {/* Bilan de la semaine passée */}
      <Card title="Bilan de la semaine passée" className="min-w-0">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-2xl font-semibold">{formatMinutes(d.lastWeek.real)}</p>
            <p className="text-muted">réels sur {formatMinutes(d.lastWeek.planned)} prévus</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">
              {d.lastWeek.reviewed}/{d.lastWeek.sessions}
            </p>
            <p className="text-muted">sessions avec bilan</p>
          </div>
          <div className="col-span-2 flex flex-wrap gap-1.5 content-start">
            {d.lastWeek.bySubject.length ? (
              d.lastWeek.bySubject.map(([id, m]) => (
                <span key={id} className="chip">
                  <SubjectDot color={subj(id)?.color} /> {subj(id)?.name} · {formatMinutes(m)}
                </span>
              ))
            ) : (
              <span className="text-muted">Aucun travail enregistré</span>
            )}
          </div>
        </div>
      </Card>
      </div>
    </div>
  );
}

function shortExam(t: string) {
  return t.replace(/^DS - /, "").replace(/\s*\([^)]*\)\s*$/, "").replace("Philosophie", "Philo");
}

/** Tuile à anneau (C1) : chiffre au centre (soirs restants), anneau = préparation / avancement. */
function RingTile({
  href,
  label,
  ring,
  title,
  sub,
  empty,
  emptyAction,
}: {
  href: string;
  label: string;
  ring: { value: number | null; big: React.ReactNode; small?: string; color?: string; bigSize?: number } | null;
  title: string | null;
  sub: string | null;
  empty?: string;
  emptyAction?: string;
}) {
  return (
    <Link href={href} className="card p-3 flex items-center gap-3 min-w-[230px] lg:min-w-0 snap-start hover:border-primary/40 transition-colors">
      {ring ? (
        <Ring value={ring.value} big={ring.big} small={ring.small} color={ring.color ?? "var(--primary)"} size={ring.bigSize ? 64 : 60} />
      ) : (
        <div className="size-[60px] rounded-full border-[6px] border-surface-2 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
        {title ? (
          <>
            <p className="text-sm font-semibold truncate">{title}</p>
            <p className="text-[11px] text-muted line-clamp-2">{sub}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">{empty}</p>
            {emptyAction && <p className="text-[11px] text-primary font-medium">{emptyAction} →</p>}
          </>
        )}
      </div>
    </Link>
  );
}
