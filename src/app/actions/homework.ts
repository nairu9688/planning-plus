"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/auth";
import { deleteHomeworkTaskNow, pushHomeworkNow } from "@/lib/sync/push-one";
import { parisDateTime } from "@/lib/domain/time";

const HomeworkInput = z.object({
  title: z.string().trim().min(1, "Titre requis"),
  subjectId: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  priority: z.enum(["basse", "normale", "haute"]).optional(),
  relatedEventId: z.string().uuid().nullable().optional(),
});
export type HomeworkInput = z.infer<typeof HomeworkInput>;

function toRow(input: HomeworkInput) {
  return {
    title: input.title,
    subject_id: input.subjectId ?? null,
    description: input.description || null,
    due_at: input.dueDate ? parisDateTime(input.dueDate, input.dueTime ?? "08:00").toISOString() : null,
    estimated_minutes: input.estimatedMinutes ?? null,
    priority: input.priority ?? "normale",
    related_event_id: input.relatedEventId ?? null,
  };
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function createHomework(raw: HomeworkInput) {
  const input = HomeworkInput.parse(raw);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("homework")
    .insert({ ...toRow(input), user_id: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  after(() => pushHomeworkNow(user.id, data.id));
  refresh();
  return data.id as string;
}

export async function updateHomework(id: string, raw: HomeworkInput) {
  const input = HomeworkInput.parse(raw);
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("homework").update(toRow(input)).eq("id", id);
  if (error) throw new Error(error.message);
  after(() => pushHomeworkNow(user.id, id));
  refresh();
}

export async function setHomeworkStatus(id: string, status: "a_faire" | "en_cours" | "fait") {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("homework")
    .update({ status, done_at: status === "fait" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  after(() => pushHomeworkNow(user.id, id));
  refresh();
}

export async function deleteHomework(id: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("homework").select("google_task_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("homework").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (data?.google_task_id) {
    const taskId = data.google_task_id;
    after(() => deleteHomeworkTaskNow(user.id, taskId));
  }
  refresh();
}
