import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, dateKey, parisDateTime, timeKey, weekdayOf } from "@/lib/domain/time";
import type { UserContext } from "@/lib/data/context";
import { sendOnce } from "@/lib/push";
import { kholleReminderAt, parseKholleInfo } from "@/lib/domain/kholle";

function inWindow(now: Date, from: string, to: string) {
  const t = timeKey(now);
  return t >= from && t < to;
}

/**
 * Notifications planifiées (appelées toutes les 15 min) :
 * - 22h00 : rappel de bilan si la session du soir n'a pas de bilan ;
 * - 19h00 : veille de khôlle ; 30 min avant la préparation de khôlle ;
 * - 18h00 : devoirs dus demain ;
 * - dimanche 20h00 : résumé → revue du dimanche.
 */
export async function runNotifications(db: SupabaseClient, ctx: UserContext, now = new Date()) {
  const prefs = ctx.settings.notification_prefs ?? {};
  const today = dateKey(now);
  const tomorrow = addDays(today, 1);
  const results: string[] = [];

  // Bilan : dès la fin de chaque session de travail (cron toutes les 15 min), une fois par session.
  if (prefs.bilan !== false) {
    const { data } = await db
      .from("study_sessions")
      .select("id, kind, status, start_at, end_at, notes")
      .eq("user_id", ctx.userId)
      .eq("status", "prevue")
      .not("kind", "in", "(sport,suggestion)")
      .lte("end_at", now.toISOString())
      .gte("end_at", new Date(now.getTime() - 2 * 3600_000).toISOString());
    for (const s of (data ?? []).filter((x) => x.notes !== "Focus libre")) {
      await sendOnce(db, ctx.userId, `bilan:${s.id}`, {
        title: "Session terminée : bilan ?",
        body: "1 minute : les durées du chrono sont déjà pré-remplies.",
        url: `/planner/${s.id}/bilan`,
        tag: `bilan-${s.id}`,
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

  // 30 min avant la préparation de khôlle (heure lue dans la description), sinon avant le début.
  if (prefs.kholle !== false) {
    const { data } = await db
      .from("calendar_events")
      .select("id, title, start_at, location, description")
      .eq("user_id", ctx.userId)
      .eq("kind", "kholle")
      .gte("start_at", parisDateTime(today).toISOString())
      .lt("start_at", parisDateTime(addDays(today, 1)).toISOString());
    for (const k of data ?? []) {
      const at = kholleReminderAt(new Date(k.start_at), k.description);
      const anchor = new Date(at.getTime() + 30 * 60_000);
      if (now >= at && now < anchor) {
        const info = parseKholleInfo(k.description);
        await sendOnce(db, ctx.userId, `kholle-prep:${k.id}`, {
          title: info.prep ? `Préparation à ${info.prep.replace(":", "h")}` : `Khôlle à ${(info.start ?? timeKey(k.start_at)).replace(":", "h")}`,
          body: `${k.title}${k.location ? ` · ${k.location}` : ""}`,
          url: "/kholles",
          tag: "kholle-prep",
        });
        results.push("kholle-prep");
      }
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
