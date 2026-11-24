import "server-only";
import type { GoogleEventLike } from "@/lib/domain/classify";

const CAL = "https://www.googleapis.com/calendar/v3";
const TASKS = "https://tasks.googleapis.com/tasks/v1";

export class GoogleApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function g<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) throw new GoogleApiError(res.status, `Google ${res.status} sur ${url.split("?")[0]} : ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------
export async function listEvents(
  token: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<GoogleEventLike[]> {
  const out: GoogleEventLike[] = [];
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      maxResults: "2500",
      orderBy: "startTime",
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await g<{ items: GoogleEventLike[]; nextPageToken?: string }>(
      token,
      `${CAL}/calendars/${encodeURIComponent(calendarId)}/events?${qs}`,
    );
    out.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

export async function createCalendar(token: string, summary: string): Promise<string> {
  const cal = await g<{ id: string }>(token, `${CAL}/calendars`, {
    method: "POST",
    body: JSON.stringify({ summary, timeZone: "Europe/Paris" }),
  });
  return cal.id;
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  colorId?: string;
}

function toGoogleEvent(e: CalendarEventInput) {
  return {
    summary: e.summary,
    description: e.description,
    location: e.location,
    colorId: e.colorId,
    start: { dateTime: e.start.toISOString(), timeZone: "Europe/Paris" },
    end: { dateTime: e.end.toISOString(), timeZone: "Europe/Paris" },
  };
}

export async function insertEvent(token: string, calendarId: string, e: CalendarEventInput): Promise<string> {
  const r = await g<{ id: string }>(token, `${CAL}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(toGoogleEvent(e)),
  });
  return r.id;
}

export async function updateEvent(token: string, calendarId: string, eventId: string, e: CalendarEventInput) {
  await g(token, `${CAL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PUT",
    body: JSON.stringify(toGoogleEvent(e)),
  });
}

export async function deleteEvent(token: string, calendarId: string, eventId: string) {
  try {
    await g(token, `${CAL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    });
  } catch (e) {
    if (e instanceof GoogleApiError && (e.status === 404 || e.status === 410)) return;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: "needsAction" | "completed";
  completed?: string;
  deleted?: boolean;
}

export async function findOrCreateTaskList(token: string, title: string): Promise<string> {
  const lists = await g<{ items?: { id: string; title: string }[] }>(token, `${TASKS}/users/@me/lists?maxResults=100`);
  const found = lists.items?.find((l) => l.title === title);
  if (found) return found.id;
  const created = await g<{ id: string }>(token, `${TASKS}/users/@me/lists`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return created.id;
}

export async function listTasks(token: string, listId: string): Promise<GoogleTask[]> {
  const out: GoogleTask[] = [];
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams({
      showCompleted: "true",
      showHidden: "true",
      showDeleted: "true",
      maxResults: "100",
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await g<{ items?: GoogleTask[]; nextPageToken?: string }>(
      token,
      `${TASKS}/lists/${encodeURIComponent(listId)}/tasks?${qs}`,
    );
    out.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

export interface TaskInput {
  title: string;
  notes?: string;
  due?: string | null; // RFC3339, seule la date est prise en compte par Google
  completed: boolean;
}

function toGoogleTask(t: TaskInput) {
  return {
    title: t.title,
    notes: t.notes,
    due: t.due ?? undefined,
    status: t.completed ? "completed" : "needsAction",
    ...(t.completed ? {} : { completed: null }),
  };
}

export async function insertTask(token: string, listId: string, t: TaskInput): Promise<string> {
  const r = await g<{ id: string }>(token, `${TASKS}/lists/${encodeURIComponent(listId)}/tasks`, {
    method: "POST",
    body: JSON.stringify(toGoogleTask(t)),
  });
  return r.id;
}

export async function updateTask(token: string, listId: string, taskId: string, t: TaskInput) {
  await g(token, `${TASKS}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify(toGoogleTask(t)),
  });
}

export async function deleteTask(token: string, listId: string, taskId: string) {
  try {
    await g(token, `${TASKS}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`, {
      method: "DELETE",
    });
  } catch (e) {
    if (e instanceof GoogleApiError && (e.status === 404 || e.status === 410)) return;
    throw e;
  }
}
