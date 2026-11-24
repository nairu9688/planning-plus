import Link from "next/link";
import { requireUser } from "@/lib/data/auth";
import { examCards, neglectedSubjects } from "@/lib/data/dashboard";
import { loadDs, loadKholles } from "@/lib/data/exams";
import { loadItemsBetween, realMinutes } from "@/lib/data/work";
import { addDays, dateKey, mondayOf, parisDateTime, weekdayOf } from "@/lib/domain/time";
import { formatCountdown } from "@/lib/domain/countdown";
import { cn, formatDayShort, formatMinutes, formatTime } from "@/lib/format";
import { Card, Gauge, PageHeader, SubjectDot } from "@/components/ui/misc";
import { FillSuggestions, type Suggestion, type SessionOption } from "./fill-suggestions";
import type { Homework, StudySession, SessionItem } from "@/lib/types";

const STEPS = ["Semaine écoulée", "Semaine à venir", "Remplir les sessions"];

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const step = Math.min(3, Math.max(1, Number((await searchParams).step ?? 1)));
  const { supabase, ctx } = await requireUser();
  const now = new Date();
  const today = dateKey(now);
  // Le dimanche, « semaine à venir » = lundi suivant. Les autres jours : semaine en cours.
  const thisMonday = mondayOf(today);
  const nextMonday = weekdayOf(today) === 0 ? addDays(today, 1) : addDays(thisMonday, 7);
  const pastMonday = addDays(nextMonday, -7);
  const subj = (id: string | null) => (id ? ctx.subjectById.get(id) : undefined);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Revue du dimanche" subtitle="Bilan, semaine à venir, puis remplissage des sessions." />
      <ol className="flex gap-2 mb-5">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <Link href={`/revue?step=${i + 1}`} className={cn("block rounded-xl border px-3 py-2 text-xs sm:text-sm", step === i + 1 ? "border-primary bg-primary-tint text-primary font-medium" : "border-border text-muted")}>
              <span className="font-semibold mr-1">{i + 1}.</span>
              {s}
            </Link>
          </li>
        ))}
      </ol>
      {step === 1 && <PastWeek />}
      {step === 2 && <NextWeek />}
      {step === 3 && <Fill />}
      <div className="flex justify-between mt-5">
        {step > 1 ? <Link href={`/revue?step=${step - 1}`} className="btn btn-outline">Précédent</Link> : <span />}
        {step < 3 ? <Link href={`/revue?step=${step + 1}`} className="btn btn-primary">Suivant</Link> : <Link href="/" className="btn btn-primary">Terminer</Link>}
      </div>
    </div>
  );

  async function PastWeek() {
    const items = await loadItemsBetween(supabase, ctx.userId, pastMonday, addDays(pastMonday, 6));
    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("id, date, start_at, status, kind")
      .eq("user_id", ctx.userId)
      .gte("date", pastMonday)
      .lte("date", addDays(pastMonday, 6))
      .in("status", ["prevue", "bilan_fait"])
      .order("start_at");
    const planned = items.filter((i) => i.origin === "prevu").reduce((a, i) => a + i.planned_minutes, 0);
    const real = items.reduce((a, i) => a + realMinutes(i), 0);
    const bySubject = new Map<string, { planned: number; real: number }>();
    for (const i of items) {
      if (!i.subject_id) continue;
      const cur = bySubject.get(i.subject_id) ?? { planned: 0, real: 0 };
      cur.planned += i.origin === "prevu" ? i.planned_minutes : 0;
      cur.real += realMinutes(i);
      bySubject.set(i.subject_id, cur);
    }
    const missing = (sessions ?? []).filter((s) => s.status === "prevue" && new Date(s.start_at) < now);
    const { data: done } = await supabase.from("homework").select("id").eq("user_id", ctx.userId).eq("status", "fait").gte("done_at", parisDateTime(pastMonday).toISOString());
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card><p className="text-2xl font-semibold">{formatMinutes(real)}</p><p className="text-xs text-muted">réel</p></Card>
          <Card><p className="text-2xl font-semibold">{formatMinutes(planned)}</p><p className="text-xs text-muted">prévu</p></Card>
          <Card><p className="text-2xl font-semibold">{done?.length ?? 0}</p><p className="text-xs text-muted">devoirs faits</p></Card>
        </div>
        <Card title="Par matière (réel / prévu)">
          <ul className="space-y-2">
            {[...bySubject.entries()].map(([id, v]) => (
              <li key={id} className="flex items-center gap-2 text-sm">
                <SubjectDot color={subj(id)?.color} />
                <span className="w-32">{subj(id)?.name}</span>
                <div className="h-2 flex-1 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${v.planned ? Math.min(100, (v.real / v.planned) * 100) : 100}%` }} />
                </div>
                <span className="text-xs text-muted w-28 text-right">{formatMinutes(v.real)} / {formatMinutes(v.planned)}</span>
              </li>
            ))}
            {!bySubject.size && <li className="text-sm text-muted">Aucun travail enregistré.</li>}
          </ul>
        </Card>
        {missing.length > 0 && (
          <Card title="Bilans manquants">
            <ul className="space-y-1.5 text-sm">
              {missing.map((s) => (
                <li key={s.id} className="flex justify-between">
                  <span>{formatDayShort(s.start_at)} · {formatTime(s.start_at)}</span>
                  <Link href={`/planner/${s.id}/bilan`} className="text-primary font-medium">Faire le bilan</Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  async function NextWeek() {
    const from = parisDateTime(nextMonday);
    const to = parisDateTime(addDays(nextMonday, 7));
    const [ds, kh, { data: hw }] = await Promise.all([
      loadDs(supabase, ctx.userId, { from, to }),
      loadKholles(supabase, ctx.userId, { from, to }),
      supabase.from("homework").select("*").eq("user_id", ctx.userId).neq("status", "fait").lt("due_at", to.toISOString()).order("due_at"),
    ]);
    const cards = await examCards(supabase, ctx, ds, kh, now);
    return (
      <div className="space-y-4">
        <Card title={`DS · ${ds.length}`}>
          <ul className="space-y-2">
            {cards.ds.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 text-sm">
                <SubjectDot color={subj(c.subjectId)?.color} />
                <Link href={c.href} className="flex-1 font-semibold">{c.title}</Link>
                <span className="text-xs text-muted">{formatDayShort(c.start)} · {formatCountdown(c.countdown)}</span>
                <Gauge value={c.gauge} className="w-32" />
              </li>
            ))}
            {!ds.length && <li className="text-sm text-muted">Pas de DS.</li>}
          </ul>
        </Card>
        <Card title={`Khôlles · ${kh.length}`}>
          <ul className="space-y-2">
            {cards.kholles.map((c) => (
              <li key={c.id} className="flex items-center gap-3 text-sm">
                <SubjectDot color={subj(c.subjectId)?.color} />
                <Link href={c.href} className="flex-1 font-semibold">{c.title}</Link>
                <span className="text-xs text-muted">{formatDayShort(c.start)} {formatTime(c.start)} · {formatMinutes(c.worked7d)} sur 7 j</span>
              </li>
            ))}
            {!kh.length && <li className="text-sm text-muted">Pas de khôlle.</li>}
          </ul>
        </Card>
        <Card title={`Devoirs dus · ${(hw ?? []).length}`}>
          <ul className="space-y-1.5">
            {((hw ?? []) as Homework[]).map((h) => (
              <li key={h.id} className="flex items-center gap-2 text-sm">
                <SubjectDot color={subj(h.subject_id)?.color} />
                <Link href={`/devoirs?id=${h.id}`} className="flex-1">{h.title}</Link>
                <span className={cn("text-xs", h.due_at && h.due_at < now.toISOString() ? "text-danger" : "text-muted")}>{h.due_at ? formatDayShort(h.due_at) : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  async function Fill() {
    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("*, items:session_items(*)")
      .eq("user_id", ctx.userId)
      .gte("date", today)
      .lte("date", addDays(nextMonday, 6))
      .in("status", ["prevue", "suggeree"])
      .order("start_at");
    const list = (sessions ?? []) as (StudySession & { items: SessionItem[] })[];
    const options: SessionOption[] = list
      .filter((s) => s.status === "prevue")
      .map((s) => {
        const slot = (new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 60_000;
        const planned = s.items.filter((i) => !i.removed_in_review).reduce((a, i) => a + i.planned_minutes, 0);
        return { id: s.id, label: `${formatDayShort(s.start_at)} ${formatTime(s.start_at)} · ${formatMinutes(Math.max(0, slot - planned))} libres` };
      });

    // Suggestions : devoirs non planifiés, DS proches peu préparés, matières délaissées.
    const { data: openHw } = await supabase.from("homework").select("*").eq("user_id", ctx.userId).neq("status", "fait");
    const hwIds = (openHw ?? []).map((h) => h.id);
    const { data: planned } = hwIds.length ? await supabase.from("session_items").select("homework_id").in("homework_id", hwIds) : { data: [] };
    const plannedSet = new Set((planned ?? []).map((p) => p.homework_id));
    const ds = await loadDs(supabase, ctx.userId, { from: now, to: parisDateTime(addDays(today, 15)) });
    const cards = await examCards(supabase, ctx, ds, [], now);
    const neglected = await neglectedSubjects(supabase, ctx, now);

    const suggestions: Suggestion[] = [
      ...((openHw ?? []) as Homework[])
        .filter((h) => !plannedSet.has(h.id))
        .map((h) => ({
          key: `hw-${h.id}`,
          kind: "homework" as const,
          label: h.title,
          hint: `Devoir non planifié${h.due_at ? ` · pour ${formatDayShort(h.due_at)}` : ""}`,
          color: subj(h.subject_id)?.color ?? null,
          homeworkId: h.id,
          subjectId: h.subject_id,
          minutes: h.estimated_minutes ?? 45,
        })),
      ...cards.ds
        .filter((c) => (c.gauge ?? 0) < 0.5 || c.worked7d < 120)
        .map((c) => ({
          key: `ds-${c.id}`,
          kind: "revision" as const,
          label: `Réviser pour ${c.title}`,
          hint: `DS ${formatDayShort(c.start)} · préparation ${c.gauge === null ? "non renseignée" : `${Math.round(c.gauge * 100)} %`} · ${formatMinutes(c.worked7d)} sur 7 j`,
          color: subj(c.subjectId)?.color ?? null,
          subjectId: c.subjectId,
          minutes: 60,
          target: "next_ds" as const,
        })),
      ...neglected.slice(0, 4).map((n) => ({
        key: `ng-${n.subject.id}`,
        kind: "revision" as const,
        label: `Reprendre ${n.subject.name}`,
        hint: n.days === null ? "Jamais travaillée récemment" : `Délaissée depuis ${n.days} j`,
        color: n.subject.color,
        subjectId: n.subject.id,
        minutes: 45,
      })),
    ];

    return (
      <div className="space-y-4">
        <Card title="Sessions à venir">
          <ul className="space-y-1.5 text-sm">
            {list.map((s) => {
              const slot = (new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 60_000;
              const p = s.items.filter((i) => !i.removed_in_review).reduce((a, i) => a + i.planned_minutes, 0);
              return (
                <li key={s.id} className="flex items-center gap-3">
                  <Link href={`/planner/${s.id}`} className="w-44 hover:text-primary">{formatDayShort(s.start_at)} · {formatTime(s.start_at)}</Link>
                  {s.status === "suggeree" ? (
                    <span className="chip">suggestion à accepter</span>
                  ) : (
                    <>
                      <div className="h-1.5 flex-1 rounded-full bg-surface-2 overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (p / slot) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-muted w-24 text-right">{formatMinutes(p)} / {formatMinutes(slot)}</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="Ce qui manque">
          <FillSuggestions suggestions={suggestions} sessions={options} />
        </Card>
      </div>
    );
  }
}
