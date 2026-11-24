"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/auth";

function refresh() {
  revalidatePath("/", "layout");
}

const num = z.number().finite().nullable();

export async function updateDs(id: string, patch: { grade?: number | null; grade_max?: number; notes?: string | null; cb_period_id?: string | null; cb_candidate?: boolean }) {
  if (patch.grade !== undefined) num.parse(patch.grade);
  const { supabase } = await requireUser();
  const { error } = await supabase.from("ds").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

/** Rattache un DS à une période de CB existante ou nouvelle (nom), ou le détache (null). */
export async function setDsCbPeriod(dsId: string, period: { id?: string; name?: string } | null) {
  const { supabase, user } = await requireUser();
  let periodId: string | null = null;
  if (period?.id) periodId = period.id;
  else if (period?.name?.trim()) {
    const { data, error } = await supabase
      .from("cb_periods")
      .insert({ user_id: user.id, name: period.name.trim() })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    periodId = data.id;
  }
  const { error } = await supabase.from("ds").update({ cb_period_id: periodId, cb_candidate: false }).eq("id", dsId);
  if (error) throw new Error(error.message);
  refresh();
  return periodId;
}

export async function updateCbPeriod(id: string, patch: { name?: string; notes?: string | null }) {
  const { supabase } = await requireUser();
  await supabase.from("cb_periods").update(patch).eq("id", id);
  refresh();
}

export async function deleteCbPeriod(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("cb_periods").delete().eq("id", id);
  refresh();
}

export async function updateKholle(id: string, patch: { grade?: number | null; notes?: string | null; teacher?: string | null }) {
  if (patch.grade !== undefined) num.parse(patch.grade);
  const { supabase } = await requireUser();
  const { error } = await supabase.from("kholles").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

// ---------------------------------------------------------------------------
// Programme (prep_topics), à faire avant (prep_tasks), questions de khôlle
// ---------------------------------------------------------------------------
type TargetType = "ds" | "kholle";

export async function addPrepTopic(targetType: TargetType, targetId: string, input: { title: string; subjectItemId?: string | null }) {
  const { supabase, user } = await requireUser();
  const title = z.string().trim().min(1).parse(input.title);
  const { error } = await supabase.from("prep_topics").insert({
    user_id: user.id,
    target_type: targetType,
    target_id: targetId,
    title,
    subject_item_id: input.subjectItemId ?? null,
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function setPrepTopicStatus(id: string, status: "a_voir" | "vu" | "revu" | "maitrise") {
  const { supabase } = await requireUser();
  await supabase.from("prep_topics").update({ status }).eq("id", id);
  refresh();
}

export async function deletePrepTopic(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("prep_topics").delete().eq("id", id);
  refresh();
}

export async function addPrepTask(targetType: TargetType, targetId: string, input: { title: string; description?: string }) {
  const { supabase, user } = await requireUser();
  const title = z.string().trim().min(1).parse(input.title);
  const { error } = await supabase.from("prep_tasks").insert({
    user_id: user.id,
    target_type: targetType,
    target_id: targetId,
    title,
    description: input.description || null,
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function togglePrepTask(id: string, done: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("prep_tasks").update({ done }).eq("id", id);
  refresh();
}

export async function deletePrepTask(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("prep_tasks").delete().eq("id", id);
  refresh();
}

export async function addKholleQuestion(kholleId: string, question: string) {
  const { supabase, user } = await requireUser();
  const q = z.string().trim().min(1).parse(question);
  await supabase.from("kholle_questions").insert({ user_id: user.id, kholle_id: kholleId, question: q });
  refresh();
}

export async function setKholleQuestionStatus(id: string, status: "a_revoir" | "ok") {
  const { supabase } = await requireUser();
  await supabase.from("kholle_questions").update({ status }).eq("id", id);
  refresh();
}

export async function deleteKholleQuestion(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("kholle_questions").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Éléments de matière
// ---------------------------------------------------------------------------
export async function createSubjectItem(subjectId: string, input: { type: string; title: string; number?: number | null; description?: string }) {
  const { supabase, user } = await requireUser();
  const title = z.string().trim().min(1).parse(input.title);
  const { data, error } = await supabase
    .from("subject_items")
    .insert({
      user_id: user.id,
      subject_id: subjectId,
      type: input.type.trim() || "chapitre",
      title,
      number: input.number ?? null,
      description: input.description || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  refresh();
  return data.id as string;
}

export async function updateSubjectItem(id: string, patch: { title?: string; type?: string; number?: number | null; description?: string | null; archived?: boolean }) {
  const { supabase } = await requireUser();
  await supabase.from("subject_items").update(patch).eq("id", id);
  refresh();
}
