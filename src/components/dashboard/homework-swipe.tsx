"use client";

import { SwipeRow } from "@/components/ui/swipe-row";
import { setHomeworkStatus } from "@/app/actions/homework";
import { planHomeworkSoon } from "@/app/actions/sessions";
import { planSoonMessage } from "@/lib/plan-label";

/** Ligne de devoir glissable (C5) : → fait, ← dans la prochaine session. */
export function HomeworkSwipe({ id, done, children }: { id: string; done?: boolean; children: React.ReactNode }) {
  if (done) return <>{children}</>;
  return (
    <SwipeRow onRight={() => setHomeworkStatus(id, "fait")} onLeft={() => planSoonMessage(() => planHomeworkSoon(id))}>
      {children}
    </SwipeRow>
  );
}
