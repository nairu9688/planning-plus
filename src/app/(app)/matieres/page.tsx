import Link from "next/link";
import { requireUser } from "@/lib/data/auth";
import { loadItemsBetween, realMinutes } from "@/lib/data/work";
import { neglectedSubjects } from "@/lib/data/dashboard";
import { addDays, dateKey } from "@/lib/domain/time";
import { formatMinutes, tint } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";

export default async function SubjectsPage() {
  const { supabase, ctx } = await requireUser();
  const now = new Date();
  const today = dateKey(now);
  const [items, neglected, { data: counts }] = await Promise.all([
    loadItemsBetween(supabase, ctx.userId, addDays(today, -30), today),
    neglectedSubjects(supabase, ctx, now),
    supabase.from("subject_items").select("subject_id").eq("user_id", ctx.userId).eq("archived", false),
  ]);
  const minutes = new Map<string, number>();
  for (const i of items) if (i.subject_id) minutes.set(i.subject_id, (minutes.get(i.subject_id) ?? 0) + realMinutes(i));
  const itemCount = new Map<string, number>();
  for (const c of counts ?? []) itemCount.set(c.subject_id, (itemCount.get(c.subject_id) ?? 0) + 1);
  const lastBySubject = new Map(neglected.map((n) => [n.subject.id, n.days]));

  return (
    <div>
      <PageHeader title="Matières" subtitle="Temps réel sur 30 jours" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ctx.subjects.map((s) => (
          <Link key={s.id} href={`/matieres/${s.key}`} className="card card-pad hover:border-primary/40 transition-colors" style={{ borderLeft: `4px solid ${s.color}` }}>
            <p className="font-semibold">{s.name}</p>
            <p className="text-xs text-muted">{s.teacher}</p>
            <p className="text-2xl font-semibold mt-3">{formatMinutes(minutes.get(s.id) ?? 0)}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="chip" style={{ background: tint(s.color, 0.14) }}>{itemCount.get(s.id) ?? 0} éléments</span>
              {lastBySubject.has(s.id) && <span className="chip bg-warning/15 text-warning">{lastBySubject.get(s.id) === null ? "jamais travaillée" : `délaissée ${lastBySubject.get(s.id)} j`}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
