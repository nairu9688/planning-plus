import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SUBJECTS } from "@/lib/domain/subjects";
import { DEFAULT_HOLIDAYS_2026_2027, type HolidayPeriod } from "@/lib/domain/holidays";
import { DEFAULT_SESSION_RULES, type SessionRules } from "@/lib/domain/sessions";
import type { Settings, Subject } from "@/lib/types";

export const DEFAULT_KHOLLES_CALENDAR_ID =
  "2ebdf9d39ed676e10f6e2416f216698565c2bb8014cb56b913a429ffd3e12ebc@group.calendar.google.com";

export interface UserContext {
  userId: string;
  settings: Settings;
  subjects: Subject[];
  subjectById: Map<string, Subject>;
  subjectByKey: Map<string, Subject>;
  holidays: HolidayPeriod[];
  rules: SessionRules;
}

/** Crée les réglages et matières par défaut au premier accès (idempotent). */
export async function ensureBootstrap(db: SupabaseClient, userId: string) {
  const { data: s } = await db.from("settings").select("id").eq("user_id", userId).maybeSingle();
  if (!s) {
    await db.from("settings").upsert(
      {
        user_id: userId,
        kholles_calendar_id: DEFAULT_KHOLLES_CALENDAR_ID,
        holidays: DEFAULT_HOLIDAYS_2026_2027,
        session_rules: DEFAULT_SESSION_RULES,
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  }
  const { count } = await db.from("subjects").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (!count) {
    await db.from("subjects").upsert(
      DEFAULT_SUBJECTS.map((d, i) => ({
        user_id: userId,
        key: d.key,
        name: d.name,
        color: d.color,
        teacher: d.teacher,
        google_color_id: d.googleColorId,
        sort_order: i,
      })),
      { onConflict: "user_id,key", ignoreDuplicates: true },
    );
  }
}

export async function loadContext(db: SupabaseClient, userId: string): Promise<UserContext> {
  await ensureBootstrap(db, userId);
  const [{ data: settings, error: e1 }, { data: subjects, error: e2 }] = await Promise.all([
    db.from("settings").select("*").eq("user_id", userId).single(),
    db.from("subjects").select("*").eq("user_id", userId).order("sort_order"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const subs = (subjects ?? []) as Subject[];
  const st = settings as Settings;
  return {
    userId,
    settings: st,
    subjects: subs,
    subjectById: new Map(subs.map((s) => [s.id, s])),
    subjectByKey: new Map(subs.map((s) => [s.key, s])),
    holidays: st.holidays?.length ? st.holidays : DEFAULT_HOLIDAYS_2026_2027,
    rules: { ...DEFAULT_SESSION_RULES, ...(st.session_rules ?? {}) },
  };
}
