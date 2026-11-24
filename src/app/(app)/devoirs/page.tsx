import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/data/auth";
import { addDays, dateKey, mondayOf, parisDateTime } from "@/lib/domain/time";
import { cn, formatDayShort, formatMinutes, formatTime } from "@/lib/format";
import { Empty, PageHeader, SubjectChip } from "@/components/ui/misc";
import { QuickAddButton } from "@/components/shell/quick-add";
import { HomeworkCheck } from "@/components/dashboard/widgets";
import { HomeworkDetail } from "./homework-detail";
import type { Homework } from "@/lib/types";

type Status = "ouverts" | "fait" | "tous";

export default async function HomeworkPage({ searchParams }: { searchParams: Promise<{ matiere?: string; statut?: Status; echeance?: string; id?: string }> }) {
  const sp = await searchParams;
  const { supabase, ctx } = await requireUser();
  const statut: Status = sp.statut ?? "ouverts";
  const today = dateKey(new Date());

  let q = supabase.from("homework").select("*").eq("user_id", ctx.userId).order("due_at", { ascending: true, nullsFirst: false });
  if (statut === "ouverts") q = q.neq("status", "fait");
  if (statut === "fait") q = q.eq("status", "fait");
  const subject = sp.matiere ? ctx.subjectByKey.get(sp.matiere) : null;
  if (subject) q = q.eq("subject_id", subject.id);
  if (sp.echeance === "semaine") q = q.lt("due_at", parisDateTime(addDays(mondayOf(today), 7)).toISOString());
  const { data } = await q;
  const list = (data ?? []) as Homework[];

  // Planification : dans quelle(s) session(s) chaque devoir est prévu.
  const ids = list.map((h) => h.id);
  const { data: planned } = ids.length
    ? await supabase.from("session_items").select("homework_id, session:study_sessions!inner(id, start_at, status)").in("homework_id", ids).neq("session.status", "ignoree")
    : { data: [] };
  const plannedIn = new Map<string, { id: string; start_at: string }[]>();
  for (const p of planned ?? []) {
    const s = p.session as unknown as { id: string; start_at: string };
    plannedIn.set(p.homework_id!, [...(plannedIn.get(p.homework_id!) ?? []), s]);
  }

  // Regroupement par échéance.
  const monday = mondayOf(today);
  const groups: { label: string; items: Homework[] }[] = [
    { label: "En retard", items: [] },
    { label: "Aujourd'hui", items: [] },
    { label: "Demain", items: [] },
    { label: "Cette semaine", items: [] },
    { label: "Semaine prochaine", items: [] },
    { label: "Plus tard", items: [] },
    { label: "Sans échéance", items: [] },
  ];
  for (const h of list) {
    const k = h.due_at ? dateKey(h.due_at) : null;
    const idx = !k ? 6 : k < today && h.status !== "fait" ? 0 : k === today ? 1 : k === addDays(today, 1) ? 2 : k < addDays(monday, 7) ? 3 : k < addDays(monday, 14) ? 4 : 5;
    groups[idx].items.push(h);
  }
  const selected = sp.id ? (list.find((h) => h.id === sp.id) ?? (await supabase.from("homework").select("*").eq("id", sp.id).maybeSingle()).data) : null;

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { matiere: sp.matiere, statut: sp.statut, echeance: sp.echeance, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/devoirs?${p}`;
  };

  return (
    <div>
      <PageHeader
        title="Devoirs"
        subtitle={`${list.length} ${statut === "fait" ? "faits" : statut === "ouverts" ? "à faire" : "au total"} · synchronisés avec Google Tasks (liste « Prépa »)`}
        action={
          <QuickAddButton className="btn btn-primary" detail={{ type: "devoir", subjectId: subject?.id }}>
            <Plus className="size-4" /> Nouveau devoir
          </QuickAddButton>
        }
      />
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(["ouverts", "fait", "tous"] as Status[]).map((s) => (
          <Link key={s} href={qs({ statut: s })} className={cn("chip h-7", statut === s && "bg-primary text-on-primary")}>
            {s === "ouverts" ? "À faire" : s === "fait" ? "Faits" : "Tous"}
          </Link>
        ))}
        <Link href={qs({ echeance: sp.echeance === "semaine" ? undefined : "semaine" })} className={cn("chip h-7", sp.echeance === "semaine" && "bg-primary text-on-primary")}>
          Cette semaine
        </Link>
        <span className="w-px bg-border mx-1" />
        <Link href={qs({ matiere: undefined })} className={cn("chip h-7", !subject && "ring-1 ring-primary")}>Toutes</Link>
        {ctx.subjects.map((s) => (
          <Link key={s.id} href={qs({ matiere: s.key })} className={cn("chip h-7", subject?.id === s.id && "ring-1 ring-primary")}>
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        {groups
          .filter((g) => g.items.length)
          .map((g) => (
            <section key={g.label} className="card card-pad">
              <h2 className={cn("section-title mb-2", g.label === "En retard" && "text-danger")}>
                {g.label} <span className="text-muted font-normal">· {g.items.length}</span>
              </h2>
              <ul className="divide-y divide-border">
                {g.items.map((h) => {
                  const sessions = plannedIn.get(h.id) ?? [];
                  return (
                    <li key={h.id} className="flex items-center gap-3 py-2.5">
                      <HomeworkCheck id={h.id} done={h.status === "fait"} />
                      <Link href={qs({ id: h.id })} scroll={false} className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium truncate", h.status === "fait" && "line-through text-muted")}>
                          {h.priority === "haute" && <span className="text-danger mr-1">!</span>}
                          {h.title}
                        </p>
                        <p className="text-xs text-muted truncate">
                          {h.status === "en_cours" && "En cours · "}
                          {h.estimated_minutes ? `${formatMinutes(h.estimated_minutes)} · ` : ""}
                          {sessions.length ? `Planifié ${sessions.map((s) => formatDayShort(s.start_at)).join(", ")}` : "Non planifié"}
                        </p>
                      </Link>
                      <SubjectChip subject={h.subject_id ? ctx.subjectById.get(h.subject_id) : null} className="hidden sm:inline-flex" />
                      <span className="text-xs text-muted w-20 text-right">{h.due_at ? `${formatDayShort(h.due_at)}` : "—"}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        {!list.length && <Empty>Aucun devoir ici.</Empty>}
      </div>

      {selected && (
        <HomeworkDetail
          homework={selected as Homework}
          subjects={ctx.subjects}
          closeHref={qs({ id: undefined })}
          dueTime={selected.due_at ? formatTime(selected.due_at).replace("h", ":") : null}
          sessions={(plannedIn.get(selected.id) ?? []).map((s) => ({ id: s.id, label: `${formatDayShort(s.start_at)} · ${formatTime(s.start_at)}` }))}
        />
      )}
    </div>
  );
}
