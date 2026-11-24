import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/data/auth";
import { loadDs, loadKholles } from "@/lib/data/exams";
import { effectiveMinutes, type ItemWithSession } from "@/lib/data/work";
import { dateKey } from "@/lib/domain/time";
import { formatDayShort, formatMinutes, keyToDate, relativeDay } from "@/lib/format";
import { Card, SubjectChip } from "@/components/ui/misc";
import { LinksEditor } from "@/components/exam/editors";
import { SubjectItemsEditor } from "./items-editor";
import type { Link as LinkRow, SubjectItem } from "@/lib/types";

export default async function SubjectPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { supabase, ctx } = await requireUser();
  const subject = ctx.subjectByKey.get(key);
  if (!subject) notFound();
  const now = new Date();
  const [{ data: items }, { data: work }, { data: links }, ds, kh] = await Promise.all([
    supabase.from("subject_items").select("*").eq("subject_id", subject.id).order("type").order("number", { nullsFirst: false }),
    supabase.from("session_items").select("*, session:study_sessions!inner(id, date, start_at, end_at, status, kind)").eq("subject_id", subject.id).in("session.status", ["prevue", "bilan_fait"]),
    supabase.from("links").select("*").eq("target_type", "subject").eq("target_id", subject.id),
    loadDs(supabase, ctx.userId, { from: now }),
    loadKholles(supabase, ctx.userId, { from: now }),
  ]);
  const workItems = (work ?? []) as ItemWithSession[];
  const timeByItem = new Map<string, number>();
  let total = 0;
  for (const w of workItems) {
    if (new Date(w.session.start_at) > now) continue;
    const m = effectiveMinutes(w);
    total += m;
    if (w.subject_item_id) timeByItem.set(w.subject_item_id, (timeByItem.get(w.subject_item_id) ?? 0) + m);
  }
  const today = dateKey(now);
  const subjectItems = ((items ?? []) as SubjectItem[]).map((i) => ({
    ...i,
    minutes: timeByItem.get(i.id) ?? 0,
    lastLabel: i.last_worked_at ? relativeDay(dateKey(i.last_worked_at), today) : null,
  }));
  const upcoming = [
    ...ds.filter((d) => d.subject_id === subject.id).map((d) => ({ href: `/ds/${d.id}`, title: d.event.title, at: d.event.start_at })),
    ...kh.filter((k) => k.subject_id === subject.id).map((k) => ({ href: `/kholles/${k.id}`, title: k.event.title, at: k.event.start_at })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 6);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link href="/matieres" className="text-sm text-muted hover:text-text">← Matières</Link>
      <header className="card card-pad flex flex-wrap items-center justify-between gap-3" style={{ borderLeft: `4px solid ${subject.color}` }}>
        <div>
          <SubjectChip subject={subject} />
          <h1 className="text-2xl font-semibold mt-1.5">{subject.name}</h1>
          <p className="text-sm text-muted">{subject.teacher}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Temps total</p>
          <p className="text-2xl font-semibold">{formatMinutes(total)}</p>
        </div>
      </header>
      <div className="grid md:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <Card title="Éléments">
          <SubjectItemsEditor subjectId={subject.id} items={subjectItems} />
        </Card>
        <div className="space-y-4">
          <Card title="Prochaines épreuves">
            {upcoming.length ? (
              <ul className="space-y-1.5 text-sm">
                {upcoming.map((u) => (
                  <li key={u.href}>
                    <Link href={u.href} className="flex justify-between gap-2 hover:text-primary">
                      <span className="truncate">{u.title}</span>
                      <span className="text-muted text-xs whitespace-nowrap">{formatDayShort(u.at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Rien de prévu.</p>
            )}
          </Card>
          <Card title="Liens">
            <LinksEditor targetType="subject" targetId={subject.id} links={(links ?? []) as LinkRow[]} />
          </Card>
        </div>
      </div>
      <p className="text-xs text-muted">Dernière mise à jour : {formatDayShort(keyToDate(today))}</p>
    </div>
  );
}
