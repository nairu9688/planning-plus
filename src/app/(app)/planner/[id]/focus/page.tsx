import { notFound } from "next/navigation";
import { requireUser } from "@/lib/data/auth";
import { FocusMode, type FocusItem } from "./focus-mode";
import type { Link as LinkRow, SessionItem } from "@/lib/types";

export default async function FocusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, ctx } = await requireUser();
  const { data: s } = await supabase.from("study_sessions").select("id, end_at, items:session_items(*)").eq("id", id).maybeSingle();
  if (!s) notFound();
  const items = ((s.items ?? []) as SessionItem[]).filter((i) => !i.removed_in_review).sort((a, b) => a.sort_order - b.sort_order);

  // Liens rattachés aux éléments : matière, élément de matière, devoir, tâche de DS.
  const targetIds = items.flatMap((i) => [i.subject_id, i.subject_item_id, i.homework_id, i.prep_task_id].filter(Boolean)) as string[];
  const { data: links } = targetIds.length ? await supabase.from("links").select("*").in("target_id", targetIds) : { data: [] };
  const { data: open } = await supabase.from("focus_logs").select("session_item_id, started_at").eq("user_id", ctx.userId).is("ended_at", null).maybeSingle();

  const focusItems: FocusItem[] = items.map((i) => {
    const subject = i.subject_id ? ctx.subjectById.get(i.subject_id) : undefined;
    const ids = [i.subject_id, i.subject_item_id, i.homework_id, i.prep_task_id];
    return {
      id: i.id,
      title: i.description ?? subject?.name ?? "Élément",
      subject: subject?.name ?? null,
      color: subject?.color ?? null,
      planned: i.planned_minutes,
      actual: i.actual_minutes ?? 0,
      done: i.done,
      links: ((links ?? []) as LinkRow[]).filter((l) => ids.includes(l.target_id)).map((l) => ({ url: l.url, label: l.label ?? l.url })),
    };
  });

  return <FocusMode subjects={ctx.subjects.map((x) => ({ id: x.id, name: x.name, color: x.color }))} sessionId={id} items={focusItems} running={open ? { itemId: open.session_item_id, startedAt: open.started_at } : null} endAt={s.end_at} />;
}
