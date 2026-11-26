import { addDays, weekdayOf, type DateKey } from "./time";
import type { SubjectKey } from "./subjects";

/** Ajout de devoir en une ligne : « maths exos 12-15 vendredi 30min urgent ». */
export interface QuickHomework {
  subject: SubjectKey | null;
  title: string;
  dueDate: DateKey | null;
  dueTime: string | null;
  minutes: number | null;
  priority: "normale" | "haute";
}

const SUBJECT_WORDS: [RegExp, SubjectKey][] = [
  [/^(maths?|mathematiques?)$/, "maths"],
  [/^(eco|economie)$/, "eco"],
  [/^droit$/, "droit"],
  [/^(manag|management|mgmt)$/, "management"],
  [/^(anglais|ang|lv1)$/, "anglais"],
  [/^(espagnol|esp|lv2)$/, "espagnol"],
  [/^(lettres|cg|culture)$/, "lettres"],
  [/^(philo|philosophie)$/, "philo"],
];
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const fold = (w: string) => w.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function parseQuickHomework(input: string, today: DateKey): QuickHomework {
  const out: QuickHomework = { subject: null, title: "", dueDate: null, dueTime: null, minutes: null, priority: "normale" };
  const keep: string[] = [];
  const words = input.trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const f = fold(w).replace(/[.,;!?]+$/, "");
    if (!out.subject && keep.length === 0 && SUBJECT_WORDS.some(([re]) => re.test(f))) {
      out.subject = SUBJECT_WORDS.find(([re]) => re.test(f))![1];
      continue;
    }
    if (f === "pour" || f === "pr" || f === "le") {
      const next = fold(words[i + 1] ?? "");
      if (DAYS.includes(next) || next === "demain" || /^\d{1,2}\/\d{1,2}/.test(next)) continue;
    }
    if (f === "demain") { out.dueDate = addDays(today, 1); continue; }
    if (f === "apres-demain" || (f === "apres" && fold(words[i + 1] ?? "") === "demain")) {
      out.dueDate = addDays(today, 2);
      if (f === "apres") i++;
      continue;
    }
    if (f === "aujourd'hui" || f === "auj") { out.dueDate = today; continue; }
    const day = DAYS.indexOf(f);
    if (day >= 0) {
      const delta = (day + 1 - weekdayOf(today) + 7) % 7 || 7;
      out.dueDate = addDays(today, delta);
      continue;
    }
    const dm = /^(\d{1,2})\/(\d{1,2})$/.exec(f);
    if (dm) {
      const [y, m] = [Number(today.slice(0, 4)), Number(dm[2])];
      let key = `${y}-${String(m).padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
      if (key < today) key = `${y + 1}${key.slice(4)}`;
      out.dueDate = key;
      continue;
    }
    const dur = /^(?:(\d+)h(\d{2})?|(\d+)\s?min)$/.exec(f);
    // « 8h » / « 10h15 » juste après une date = heure ; sinon « 1h30 » = durée.
    if (dur && dur[1] !== undefined && out.dueDate && out.dueTime === null && keep.length > 0 && isAfterDate(words, i)) {
      out.dueTime = `${dur[1].padStart(2, "0")}:${dur[2] ?? "00"}`;
      continue;
    }
    if (dur) {
      out.minutes = dur[3] !== undefined ? Number(dur[3]) : Number(dur[1]) * 60 + Number(dur[2] ?? 0);
      continue;
    }
    if (f === "urgent" || f === "!" || f === "important") { out.priority = "haute"; continue; }
    keep.push(w);
  }
  const t = keep.join(" ");
  out.title = t ? t[0].toUpperCase() + t.slice(1) : "";
  return out;
}

/** Le mot précédent est un repère de date (jour, demain, jj/mm). */
function isAfterDate(words: string[], i: number) {
  const prev = fold(words[i - 1] ?? "");
  return DAYS.includes(prev) || prev === "demain" || prev === "apres-demain" || /^\d{1,2}\/\d{1,2}$/.test(prev) || prev === "aujourd'hui";
}
