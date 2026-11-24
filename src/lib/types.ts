import type { EventKind } from "@/lib/domain/classify";
import type { HolidayPeriod } from "@/lib/domain/holidays";
import type { SessionKind, SessionRules, SessionStatus } from "@/lib/domain/sessions";
import type { PrepStatus, Target } from "@/lib/domain/targets";

export interface Subject {
  id: string;
  key: string;
  name: string;
  color: string;
  teacher: string | null;
  google_color_id: string | null;
  sort_order: number;
}

export interface Settings {
  id: string;
  user_id: string;
  theme: "system" | "light" | "dark";
  week_a_reference_date: string;
  primary_calendar_id: string;
  kholles_calendar_id: string | null;
  planning_calendar_id: string | null;
  tasks_list_id: string | null;
  session_rules: Partial<SessionRules>;
  holidays: HolidayPeriod[];
  notification_prefs: { bilan?: boolean; kholle?: boolean; homework?: boolean; sunday?: boolean };
  neglected_after_days: number;
  last_sync_at: string | null;
  last_sync_error: string | null;
}

export interface CalendarEvent {
  id: string;
  google_calendar_id: string;
  google_event_id: string;
  kind: EventKind;
  subject_id: string | null;
  title: string;
  location: string | null;
  description: string | null;
  color_id: string | null;
  all_day: boolean;
  start_at: string;
  end_at: string;
}

export interface Ds {
  id: string;
  calendar_event_id: string;
  subject_id: string | null;
  number: number | null;
  cb_period_id: string | null;
  cb_candidate: boolean;
  grade: number | null;
  grade_max: number;
  notes: string | null;
  event?: CalendarEvent;
}

export interface Kholle {
  id: string;
  calendar_event_id: string;
  subject_id: string | null;
  teacher: string | null;
  grade: number | null;
  notes: string | null;
  event?: CalendarEvent;
}

export interface CbPeriod {
  id: string;
  name: string;
  notes: string | null;
}

export type HomeworkStatus = "a_faire" | "en_cours" | "fait";

export interface Homework {
  id: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  estimated_minutes: number | null;
  priority: "basse" | "normale" | "haute";
  status: HomeworkStatus;
  done_at: string | null;
  google_task_id: string | null;
  related_event_id: string | null;
  updated_at: string;
}

export interface StudySession {
  id: string;
  date: string;
  start_at: string;
  end_at: string;
  kind: SessionKind;
  status: SessionStatus;
  location: string | null;
  notes: string | null;
  google_event_id: string | null;
  generated_by_rule: string | null;
  items?: SessionItem[];
}

export interface SessionItem {
  id: string;
  session_id: string;
  item_type: "homework" | "revision" | "prep_task" | "sport";
  homework_id: string | null;
  subject_id: string | null;
  subject_item_id: string | null;
  prep_task_id: string | null;
  description: string | null;
  planned_minutes: number;
  actual_minutes: number | null;
  done: boolean;
  origin: "prevu" | "ajoute_au_bilan";
  removed_in_review: boolean;
  target: Target;
  target_ds_id: string | null;
  target_kholle_id: string | null;
  sort_order: number;
}

export interface SubjectItem {
  id: string;
  subject_id: string;
  type: string;
  title: string;
  number: number | null;
  description: string | null;
  archived: boolean;
  last_worked_at: string | null;
}

export interface PrepTopic {
  id: string;
  target_type: "ds" | "kholle";
  target_id: string;
  subject_item_id: string | null;
  title: string;
  status: PrepStatus;
}

export interface PrepTask {
  id: string;
  target_type: "ds" | "kholle";
  target_id: string;
  title: string;
  description: string | null;
  done: boolean;
}

export interface Note {
  id: string;
  content: string;
  color: string;
  pinned: boolean;
  done: boolean;
  due_at: string | null;
}

export interface Link {
  id: string;
  url: string;
  label: string | null;
  target_type: string;
  target_id: string | null;
}
