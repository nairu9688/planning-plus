import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/data/auth";
import { ensureReview } from "@/lib/data/review";
import { formatDayLong, formatMinutes, formatTime } from "@/lib/format";
import { SubjectDot } from "@/components/ui/misc";
import { ReviewEditor } from "./review-editor";
import type { SessionItem, StudySession } from "@/lib/types";

export default async function BilanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ force?: string }> }) {
  const { id } = await params;
  const { force } = await searchParams;
  const { supabase, ctx } = await requireUser();
  const { data: s } = await supabase.from("study_sessions").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();
  const session = s as StudySession;
  const ended = new Date(session.end_at) <= new Date();

  if (!ended && !force) {
    return (
      <div className="max-w-xl mx-auto card card-pad space-y-3 text-center">
        <h1 className="text-lg font-semibold">La session n&apos;est pas finie</h1>
        <p className="text-sm text-muted">Le bilan s&apos;ouvre à {formatTime(session.end_at)}.</p>
        <div className="flex justify-center gap-2">
          <Link href={`/planner/${id}`} className="btn btn-outline">Retour</Link>
          <Link href={`/planner/${id}/bilan?force=1`} className="btn btn-primary">Faire le bilan maintenant</Link>
        </div>
      </div>
    );
  }

  const review = await ensureReview(supabase, ctx.userId, id);
  const { data: items } = await supabase.from("session_items").select("*").eq("session_id", id).order("sort_order");
  const snapshot = ((review?.planned_snapshot as { items?: SessionItem[] })?.items ?? []) as SessionItem[];
  const subj = (sid: string | null) => (sid ? ctx.subjectById.get(sid) : undefined);
  const plannedTotal = snapshot.reduce((a, i) => a + i.planned_minutes, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link href={`/planner/${id}`} className="text-sm text-muted hover:text-text">← Session</Link>
      <header>
        <h1 className="text-xl font-semibold">Bilan · {formatDayLong(session.start_at)}</h1>
        <p className="text-sm text-muted">
          {formatTime(session.start_at)} – {formatTime(session.end_at)}
          {session.status === "bilan_fait" && " · bilan validé (tu peux encore le corriger)"}
        </p>
      </header>
      <div className="grid md:grid-cols-[1fr_1.4fr] gap-4 items-start">
        <section className="card card-pad">
          <h2 className="section-title mb-3">
            Prévu <span className="text-muted font-normal">· {formatMinutes(plannedTotal)}</span>
          </h2>
          {snapshot.length ? (
            <ul className="space-y-2">
              {snapshot.map((i) => (
                <li key={i.id} className="flex items-center gap-2 text-sm">
                  <SubjectDot color={subj(i.subject_id)?.color} />
                  <span className="flex-1">{i.description ?? subj(i.subject_id)?.name ?? i.item_type}</span>
                  <span className="text-xs text-muted">{formatMinutes(i.planned_minutes)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Rien n&apos;était prévu.</p>
          )}
        </section>
        <ReviewEditor
          sessionId={id}
          items={(items ?? []) as SessionItem[]}
          subjects={ctx.subjects}
          comment={(review?.comment as string | null) ?? ""}
          validated={session.status === "bilan_fait"}
        />
      </div>
    </div>
  );
}
