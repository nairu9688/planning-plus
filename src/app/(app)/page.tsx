import Link from "next/link";
import { AlertTriangle, GraduationCap, MessagesSquare, Plus, Timer, Trophy } from "lucide-react";
import { requireUser } from "@/lib/data/auth";
import { loadDashboard } from "@/lib/data/dashboard";
import { loadGrid } from "@/lib/data/week";
import { formatCountdown } from "@/lib/domain/countdown";
import { dateKey, mondayOf, toParis } from "@/lib/domain/time";
import { cn, formatDayLong, formatDayShort, formatMinutes, formatTime, greeting } from "@/lib/format";
import { Card, Empty, Gauge, SubjectDot } from "@/components/ui/misc";
import { PaletteTrigger } from "@/components/shell/command-palette";
import { QuickAddButton } from "@/components/shell/quick-add";
import { SyncButton } from "@/components/shell/auto-sync";
import { WeekPlanner } from "@/components/dashboard/week-planner";
import { DeadlinesWeeks } from "@/components/dashboard/deadlines-weeks";
import { RemainingTabs } from "@/components/dashboard/remaining-tabs";
import { SpacedReviews } from "@/components/dashboard/spaced-reviews";
import { loadSpacedReviews } from "@/lib/data/reviews";
import { ModeToggle, NotesBoard, TonightActions } from "@/components/dashboard/widgets";

export default async function DashboardPage() {
  const { supabase, user, ctx } = await requireUser();
  const now = new Date();
  const [d, grid, reviews] = await Promise.all([
    loadDashboard(supabase, ctx, now),
    loadGrid(supabase, ctx, mondayOf(dateKey(now)), 7),
    loadSpacedReviews(supabase, ctx, 0, now),
  ]);
  const subj = (id: string | null) => (id ? ctx.subjectById.get(id) : undefined);
  const firstName = (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? "";

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <header className="flex flex-wrap items-center justify-between gap-3 pr-11 md:pr-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting(toParis(now).getHours())}
            {firstName ? ` ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted">
            {formatDayLong(now)} · <span className="font-medium text-text">Semaine {d.week}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncButton lastSync={ctx.settings.last_sync_at} error={ctx.settings.last_sync_error} />
          <PaletteTrigger />
          <QuickAddButton className="btn btn-primary">
            <Plus className="size-4" /> Nouveau
          </QuickAddButton>
        </div>
      </header>

      {ctx.settings.last_sync_error && (
        <p className="text-sm rounded-xl bg-warning/10 text-warning px-3 py-2">Synchro Google : {ctx.settings.last_sync_error}</p>
      )}

      {/* Indicateurs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Indicator icon={GraduationCap} label="Prochain DS" href={d.nextDs?.href}>
          {d.nextDs ? (
            <>
              <p className="font-medium truncate">{d.nextDs.title}</p>
              <p className="text-xs text-muted">{formatDayShort(d.nextDs.start)} · {formatTime(d.nextDs.start)}</p>
              <p className="text-lg font-semibold mt-1.5">{formatCountdown(d.nextDs.countdown)}</p>
              <Gauge value={d.nextDs.gauge} className="mt-1" />
            </>
          ) : (
            <Empty>Aucun DS à venir</Empty>
          )}
        </Indicator>
        <Indicator icon={Trophy} label="Concours blanc" href={d.cb ? `/ds/cb/${d.cb.period.id}` : "/ds"}>
          {d.cb ? (
            <>
              <p className="font-medium truncate">{d.cb.period.name}</p>
              <p className="text-xs text-muted">
                {formatDayShort(d.cb.first)} → {formatDayShort(d.cb.last)} · {d.cb.exams.length} épreuves
              </p>
              <p className="text-lg font-semibold mt-1.5">{formatCountdown(d.cb.countdown)}</p>
            </>
          ) : (
            <Empty>Aucune période de CB. Coche « concours blanc » sur un DS.</Empty>
          )}
        </Indicator>
        <Indicator icon={MessagesSquare} label="Prochaine khôlle" href={d.nextKholle?.href}>
          {d.nextKholle ? (
            <>
              <p className="font-medium truncate">{d.nextKholle.title}</p>
              <p className="text-xs text-muted">
                {formatDayShort(d.nextKholle.start)} · {formatTime(d.nextKholle.start)}
                {d.nextKholle.location ? ` · ${d.nextKholle.location}` : ""}
              </p>
              <p className="text-lg font-semibold mt-1.5">{formatCountdown(d.nextKholle.countdown)}</p>
              <p className="text-xs text-muted">Préparé sur 7 j : {formatMinutes(d.nextKholle.worked7d)}</p>
            </>
          ) : (
            <Empty>Aucune khôlle à venir</Empty>
          )}
        </Indicator>
        <Indicator icon={Timer} label="Travail de la semaine" href="/planner">
          <p className="text-lg font-semibold">
            {formatMinutes(d.weekWork.real)} <span className="text-sm font-normal text-muted">/ {formatMinutes(d.weekWork.planned)} prévus</span>
          </p>
          <div className="mt-2 space-y-1.5">
            <Bar label="Réalisé" value={d.weekWork.planned ? d.weekWork.real / d.weekWork.planned : 0} />
            <Bar label="Semaine" value={d.weekWork.pct} muted />
          </div>
        </Indicator>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        {/* Ce soir */}
        <Card
          className="lg:col-span-2"
          title="Ce soir"
          action={d.tonight && (d.tonight.kind === "etude" || d.tonight.kind === "maison") ? <ModeToggle sessionId={d.tonight.id} mode={d.tonight.kind} /> : null}
        >
          {d.tonight ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                {formatTime(d.tonight.start_at)} – {formatTime(d.tonight.end_at)}
                {d.tonight.location ? ` · ${d.tonight.location}` : ""}
                {d.tonight.status === "bilan_fait" && " · bilan fait"}
              </p>
              {d.tonight.items.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {d.tonight.items
                    .filter((i) => !i.removed_in_review)
                    .map((i) => (
                      <span key={i.id} className={cn("chip h-7", i.done && "line-through opacity-60")}>
                        <SubjectDot color={subj(i.subject_id)?.color} />
                        {i.description ?? subj(i.subject_id)?.name ?? "Élément"} · {formatMinutes(i.planned_minutes)}
                      </span>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Rien de prévu.{" "}
                  <Link href={`/planner/${d.tonight.id}`} className="text-primary font-medium">
                    Remplir la session
                  </Link>
                </p>
              )}
              <TonightActions sessionId={d.tonight.id} ended={new Date(d.tonight.end_at) <= now} />
            </div>
          ) : (
            <Empty>Pas de session ce soir.</Empty>
          )}
        </Card>

        {/* Post-its */}
        <Card title="Post-its" action={<QuickAddButton detail={{ type: "postit" }} className="btn btn-ghost h-7 px-2 text-xs"><Plus className="size-3.5" /> Ajouter</QuickAddButton>}>
          <NotesBoard notes={d.notes} />
        </Card>
      </div>

      {/* Planning de la semaine (repliable, navigation sans quitter la page) */}
      <WeekPlanner initial={{ monday: d.monday, week: d.week, ...grid }} today={d.today} subjects={ctx.subjects} />

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

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
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

function Indicator({ icon: Icon, label, href, children }: { icon: React.ElementType; label: string; href?: string; children: React.ReactNode }) {
  const body = (
    <div className="card card-pad h-full min-w-0 hover:border-primary/40 transition-colors">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted mb-2">
        <Icon className="size-3.5" /> {label}
      </p>
      {children}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Bar({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted">
      <span className="w-14">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-surface-2 overflow-hidden">
        <div className={cn("h-full rounded-full", muted ? "bg-muted/50" : "bg-primary")} style={{ width: `${Math.min(100, Math.round(value * 100))}%` }} />
      </div>
      <span className="w-8 text-right tabular-nums">{Math.round(value * 100)} %</span>
    </div>
  );
}

