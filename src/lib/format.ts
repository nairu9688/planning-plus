import { twMerge } from "tailwind-merge";
import { TZ } from "@/lib/domain/time";

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, ...opts });

const time = fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dayShort = fmt({ weekday: "short", day: "numeric", month: "short" });
const dayLong = fmt({ weekday: "long", day: "numeric", month: "long" });
const dayNum = fmt({ day: "numeric", month: "2-digit" });
const monthYear = fmt({ month: "long", year: "numeric" });

export const formatTime = (d: string | Date) => time.format(new Date(d)).replace(":", "h");
export const formatDayShort = (d: string | Date) => dayShort.format(new Date(d));
export const formatDayLong = (d: string | Date) => capitalize(dayLong.format(new Date(d)));
export const formatDayNum = (d: string | Date) => dayNum.format(new Date(d));
export const formatMonthYear = (d: string | Date) => capitalize(monthYear.format(new Date(d)));

/** "2026-11-24" → Date à midi UTC (sûr pour formater un jour civil). */
export const keyToDate = (key: string) => new Date(`${key}T12:00:00Z`);

export function formatMinutes(m: number): string {
  m = Math.round(m);
  if (m <= 0) return "0 min";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function relativeDay(key: string, today: string): string {
  const diff = Math.round((Date.parse(key) - Date.parse(today)) / 86_400_000);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "demain";
  if (diff === -1) return "hier";
  if (diff > 1 && diff < 7) return `dans ${diff} j`;
  if (diff < 0) return `il y a ${-diff} j`;
  return formatDayShort(keyToDate(key));
}

export function greeting(hour: number) {
  if (hour < 5) return "Bonne nuit";
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

/** Concatène des classes ; en cas de conflit Tailwind (size-4 vs size-5…), la dernière l'emporte. */
export function cn(...c: (string | false | null | undefined)[]) {
  return twMerge(c.filter(Boolean).join(" "));
}

/** Couleur hex → rgba avec opacité (fonds teintés matières ~18 %). */
export function tint(hex: string, alpha = 0.18) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
