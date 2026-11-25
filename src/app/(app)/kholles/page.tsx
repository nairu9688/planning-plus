import Link from "next/link";
import { requireUser } from "@/lib/data/auth";
import { loadKholles } from "@/lib/data/exams";
import { examCards } from "@/lib/data/dashboard";
import { formatCountdown } from "@/lib/domain/countdown";
import { parseKholleInfo } from "@/lib/domain/kholle";
import { cn, formatDayShort, formatMinutes, formatTime } from "@/lib/format";
import { PageHeader, SubjectDot } from "@/components/ui/misc";

export default async function KhollesPage() {
  const { supabase, ctx } = await requireUser();
  const now = new Date();
  const all = await loadKholles(supabase, ctx.userId);
  const upcoming = all.filter((k) => new Date(k.event.start_at) > now);
  const past = all.filter((k) => new Date(k.event.start_at) <= now).reverse();
  const { kholles: cards } = await examCards(supabase, ctx, [], upcoming, now);
  const subj = (id: string | null) => (id ? ctx.subjectById.get(id) : undefined);
  const graded = past.filter((k) => k.grade !== null);
  const avg = graded.length ? graded.reduce((a, k) => a + Number(k.grade), 0) / graded.length : null;

  return (
    <div className="space-y-5">
      <PageHeader title="Khôlles" subtitle={avg !== null ? `Moyenne : ${avg.toFixed(2)} / 20 sur ${graded.length} khôlles notées` : "Depuis ton calendrier « Khôlles »"} />
      <section className="card card-pad">
        <h2 className="section-title mb-3">À venir</h2>
        <ul className="divide-y divide-border">
          {upcoming.map((k, i) => (
            <li key={k.id}>
              <Link href={`/kholles/${k.id}`} className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_150px_110px] items-center gap-3 py-2.5 hover:bg-surface-2 -mx-2 px-2 rounded-lg">
                <SubjectDot color={subj(k.subject_id)?.color} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{k.event.title}</p>
                  <p className="text-xs text-muted truncate">
                    {formatDayShort(k.event.start_at)} · {formatTime(k.event.start_at)}
                    {k.event.location ? ` · ${k.event.location}` : ""}
                    {parseKholleInfo(k.event.description).prep ? ` · prépa ${parseKholleInfo(k.event.description).prep!.replace(":", "h")}` : ""}
                  </p>
                </div>
                <span className="text-sm font-medium">{formatCountdown(cards[i].countdown)}</span>
                <span className="hidden sm:block text-xs text-muted text-right">{formatMinutes(cards[i].worked7d)} sur 7 j</span>
              </Link>
            </li>
          ))}
          {!upcoming.length && <li className="text-sm text-muted py-2">Aucune khôlle à venir.</li>}
        </ul>
      </section>
      <section className="card card-pad">
        <h2 className="section-title mb-3">Passées</h2>
        <ul className="divide-y divide-border">
          {past.map((k) => (
            <li key={k.id}>
              <Link href={`/kholles/${k.id}`} className="flex items-center gap-3 py-2 hover:bg-surface-2 -mx-2 px-2 rounded-lg">
                <SubjectDot color={subj(k.subject_id)?.color} />
                <span className="flex-1 text-sm truncate">{k.event.title}</span>
                <span className="text-xs text-muted">{formatDayShort(k.event.start_at)}</span>
                <span className={cn("text-sm font-semibold w-14 text-right tabular-nums", k.grade === null && "text-muted font-normal")}>{k.grade !== null ? `${k.grade}/20` : "—"}</span>
              </Link>
            </li>
          ))}
          {!past.length && <li className="text-sm text-muted py-2">Aucune khôlle passée.</li>}
        </ul>
      </section>
    </div>
  );
}
