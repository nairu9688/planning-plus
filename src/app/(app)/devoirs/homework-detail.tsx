"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { HomeworkForm } from "@/components/forms/homework-form";
import type { Homework, Subject } from "@/lib/types";

const dk = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });

/** Fiche devoir (bottom sheet) : édition + « Planifié dans la session du … ». */
export function HomeworkDetail({
  homework: h,
  subjects,
  closeHref,
  dueTime,
  sessions,
}: {
  homework: Homework;
  subjects: Subject[];
  closeHref: string;
  dueTime: string | null;
  sessions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const close = () => router.push(closeHref, { scroll: false });
  return (
    <Sheet open onClose={close} title="Devoir">
      <div className="mb-4 rounded-xl bg-surface-2 p-3 text-sm">
        {sessions.length ? (
          <div className="space-y-1">
            <p className="text-muted text-xs">Planifié dans la session du</p>
            {sessions.map((s) => (
              <Link key={s.id} href={`/planner/${s.id}`} className="block text-primary font-medium">
                {s.label}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted">
            Pas encore planifié.{" "}
            <Link href="/planner" className="text-primary font-medium">
              L&apos;ajouter à une session
            </Link>
          </p>
        )}
      </div>
      <HomeworkForm
        subjects={subjects}
        draft={{
          id: h.id,
          title: h.title,
          subjectId: h.subject_id,
          description: h.description,
          dueDate: h.due_at ? dk.format(new Date(h.due_at)) : null,
          dueTime,
          estimatedMinutes: h.estimated_minutes,
          priority: h.priority,
          relatedEventId: h.related_event_id,
        }}
        onDone={close}
      />
    </Sheet>
  );
}
