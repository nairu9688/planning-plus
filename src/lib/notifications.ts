import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, dateKey, parisDateTime, timeKey, weekdayOf } from "@/lib/domain/time";
import type { UserContext } from "@/lib/data/context";
import { sendOnce } from "@/lib/push";

function inWindow(now: Date, from: string, to: string) {
  const t = timeKey(now);
  return t >= from && t < to;
}

/**
 * Notifications planifiées (appelées toutes les 15 min) :
 * - 22h00 : rappel de bilan si la session du soir n'a pas de bilan ;
 * - 19h00 : veille de khôlle ;
 * - 18h00 : devoirs dus demain ;
 * - dimanche 20h00 : résumé → revue du dimanche.
 */
export async function runNotifications(db: SupabaseClient, ctx: UserContext, now = new Date()) {
  const prefs = ctx.settings.notification_prefs ?? {};
  const today = dateKey(now);
  const tomorrow = addDays(today, 1);
  const results: string[] = [];

  if (prefs.bilan !== false && inWindow(now, "22:00", "23:30")) {
    const { data } = await db
      .from("study_sessions")
      .select("id, kind, status, end_at")
      .eq("user_id", ctx.userId)
      .eq("date", today)
      .in("kind", ["etude", "maison"])
      .eq("status", "prevue");
    const ended = (data ?? []).filter((s) => new Date(s.end_at) <= now);
    if (ended.length) {
      await sendOnce(db, ctx.userId, `bilan:${today}`, {
        title: "Bilan de ce soir",
        body: "Ta session est finie : 1 minute pour faire le bilan.",
        url: `/planner/${ended[0].id}/bilan`,
        tag: "bilan",
      });
      results.push("bilan");
    }
  }

  if (prefs.kholle !== false && inWindow(now, "19:00", "20:00")) {
    const { data } = await db
      .from("calendar_events")
      .select("id, title, start_at, location")
      .eq("user_id", ctx.userId)
      .eq("kind", "kholle")
      .gte("start_at", parisDateTime(tomorrow).toISOString())
      .lt("start_at", parisDateTime(addDays(tomorrow, 1)).toISOString());
    if (data?.length) {
      const k = data[0];
      await sendOnce(db, ctx.userId, `kholle:${tomorrow}`, {
        title: "Khôlle demain",
        body: `${k.title} à ${timeKey(k.start_at)}${k.location ? ` · ${k.location}` : ""}`,
        url: "/kholles",
        tag: "kholle",
      });
      results.push("kholle");
    }
  }

  if (prefs.homework !== false && inWindow(now, "18:00", "19:00")) {
    const { data } = await db
      .from("homework")
      .select("id, title")
      .eq("user_id", ctx.userId)
      .neq("status", "fait")
      .gte("due_at", parisDateTime(tomorrow).toISOString())
      .lt("due_at", parisDateTime(addDays(tomorrow, 1)).toISOString());
    if (data?.length) {
      await sendOnce(db, ctx.userId, `homework:${tomorrow}`, {
        title: data.length > 1 ? `${data.length} devoirs pour demain` : "Devoir pour demain",
        body: data.map((h) => h.title).join(" · "),
        url: "/devoirs",
        tag: "homework",
      });
      results.push("homework");
    }
  }

  if (prefs.sunday !== false && weekdayOf(today) === 0 && inWindow(now, "20:00", "21:00")) {
    await sendOnce(db, ctx.userId, `sunday:${today}`, {
      title: "Revue du dimanche",
      body: "Fais le point sur ta semaine et prépare la suivante.",
      url: "/revue",
      tag: "sunday",
    });
    results.push("sunday");
  }
  return results;
}
