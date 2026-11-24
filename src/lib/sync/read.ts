import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyEvent, type GoogleEventLike, type Override } from "@/lib/domain/classify";
import { dateKey, parisDateTime, weekdayOf } from "@/lib/domain/time";
import { listEvents } from "@/lib/google/api";
import type { UserContext } from "@/lib/data/context";

/** Fenêtre de synchro : J-60 → début juillet de l'année scolaire en cours. */
export function syncWindow(now = new Date()) {
  const key = dateKey(now);
  const [y, m] = key.split("-").map(Number);
  const endYear = m >= 7 ? y + 1 : y;
  return {
    timeMin: new Date(now.getTime() - 60 * 86_400_000),
    timeMax: parisDateTime(`${endYear}-07-10`, "00:00"),
  };
}

function eventBounds(e: GoogleEventLike) {
  const allDay = !e.start?.dateTime;
  const start = e.start?.dateTime ? new Date(e.start.dateTime) : parisDateTime(e.start?.date ?? "1970-01-01");
  const end = e.end?.dateTime ? new Date(e.end.dateTime) : parisDateTime(e.end?.date ?? e.start?.date ?? "1970-01-01");
  return { allDay, start, end };
}

/**
 * Lit les calendriers (principal + Khôlles), classe et upsert dans `calendar_events`,
 * supprime les événements disparus de la fenêtre, crée les fiches DS / khôlles manquantes.
 */
export async function syncCalendarsRead(db: SupabaseClient, ctx: UserContext, token: string) {
  const { settings, subjectByKey, userId } = ctx;
  const { timeMin, timeMax } = syncWindow();
  const calendars = [settings.primary_calendar_id || "primary", settings.kholles_calendar_id].filter(Boolean) as string[];

  // Overrides existants, indexés par (calendrier, id Google).
  const { data: overrideRows } = await db
    .from("event_overrides")
    .select("subject_id, clear_subject, kind, calendar_events!inner(google_calendar_id, google_event_id)")
    .eq("user_id", userId);
  const subjectKeyById = new Map(ctx.subjects.map((s) => [s.id, s.key]));
  const overrides = new Map<string, Override>();
  for (const o of overrideRows ?? []) {
    const ev = o.calendar_events as unknown as { google_calendar_id: string; google_event_id: string };
    const ov: Override = {};
    if (o.clear_subject) ov.subjectKey = null;
    else if (o.subject_id) ov.subjectKey = (subjectKeyById.get(o.subject_id) as Override["subjectKey"]) ?? undefined;
    if (o.kind) ov.kind = o.kind;
    overrides.set(`${ev.google_calendar_id}|${ev.google_event_id}`, ov);
  }

  let upserted = 0;
  for (const calendarId of calendars) {
    const items = await listEvents(token, calendarId, timeMin, timeMax);
    // L'id réel du calendrier principal peut être « primary » côté réglages.
    const storedCalId = calendarId;
    const rows = [];
    const seen = new Set<string>();
    for (const e of items) {
      const c = classifyEvent(
        calendarId,
        e,
        { khollesCalendarId: settings.kholles_calendar_id, planningCalendarId: settings.planning_calendar_id },
        overrides.get(`${storedCalId}|${e.id}`),
      );
      if (!c) continue;
      const { allDay, start, end } = eventBounds(e);
      seen.add(e.id);
      rows.push({
        user_id: userId,
        google_calendar_id: storedCalId,
        google_event_id: e.id,
        kind: c.kind,
        subject_id: c.subjectKey ? (subjectByKey.get(c.subjectKey)?.id ?? null) : null,
        title: e.summary ?? "(sans titre)",
        location: e.location ?? null,
        description: e.description ?? null,
        color_id: e.colorId ?? null,
        all_day: allDay,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        raw: { classification: c, htmlLink: (e as { htmlLink?: string }).htmlLink ?? null },
      });
    }

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db
        .from("calendar_events")
        .upsert(rows.slice(i, i + 500), { onConflict: "user_id,google_calendar_id,google_event_id" });
      if (error) throw error;
    }
    upserted += rows.length;

    // Suppression des événements disparus (annulés / supprimés) dans la fenêtre.
    const { data: existing } = await db
      .from("calendar_events")
      .select("id, google_event_id")
      .eq("user_id", userId)
      .eq("google_calendar_id", storedCalId)
      .gte("start_at", timeMin.toISOString())
      .lt("start_at", timeMax.toISOString());
    const gone = (existing ?? []).filter((r) => !seen.has(r.google_event_id)).map((r) => r.id);
    for (let i = 0; i < gone.length; i += 200) {
      await db.from("calendar_events").delete().in("id", gone.slice(i, i + 200));
    }
  }

  await ensureExamRows(db, ctx);
  return { upserted };
}

/** Crée les fiches `ds` / `kholles` pour les événements classés comme tels, et aligne leur matière. */
export async function ensureExamRows(db: SupabaseClient, ctx: UserContext) {
  const { userId } = ctx;
  const { data: events } = await db
    .from("calendar_events")
    .select("id, kind, subject_id, title, start_at, raw")
    .eq("user_id", userId)
    .in("kind", ["ds", "kholle"]);
  const { data: dsRows } = await db.from("ds").select("id, calendar_event_id, subject_id").eq("user_id", userId);
  const { data: khRows } = await db.from("kholles").select("id, calendar_event_id, subject_id").eq("user_id", userId);
  const dsByEvent = new Map((dsRows ?? []).map((d) => [d.calendar_event_id, d]));
  const khByEvent = new Map((khRows ?? []).map((k) => [k.calendar_event_id, k]));

  const newDs = [];
  const newKh = [];
  for (const e of events ?? []) {
    const cls = (e.raw as { classification?: { dsNumber?: number | null; isCB?: boolean; teacher?: string | null } })
      ?.classification;
    if (e.kind === "ds") {
      const existing = dsByEvent.get(e.id);
      if (!existing) {
        newDs.push({
          user_id: userId,
          calendar_event_id: e.id,
          subject_id: e.subject_id,
          number: cls?.dsNumber ?? null,
          // Candidat CB : mention « CB » ou DS un mardi (suggestion, pas d'association).
          cb_candidate: !!cls?.isCB || weekdayOf(dateKey(e.start_at)) === 2,
        });
      } else if (existing.subject_id !== e.subject_id) {
        await db.from("ds").update({ subject_id: e.subject_id }).eq("id", existing.id);
      }
    } else {
      const existing = khByEvent.get(e.id);
      if (!existing) {
        newKh.push({ user_id: userId, calendar_event_id: e.id, subject_id: e.subject_id, teacher: cls?.teacher ?? null });
      } else if (existing.subject_id !== e.subject_id) {
        await db.from("kholles").update({ subject_id: e.subject_id }).eq("id", existing.id);
      }
    }
  }
  if (newDs.length) await db.from("ds").upsert(newDs, { onConflict: "calendar_event_id", ignoreDuplicates: true });
  if (newKh.length) await db.from("kholles").upsert(newKh, { onConflict: "calendar_event_id", ignoreDuplicates: true });
}
