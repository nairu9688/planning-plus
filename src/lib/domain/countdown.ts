import { addDays, dateKey, parisDateTime, weekdayOf } from "./time";
import { isHoliday, type HolidayPeriod } from "./holidays";

export interface Countdown {
  /** Soirs lun→ven hors vacances dont 20h00 est entre maintenant et l'épreuve. */
  evenings: number;
  /** Week-ends (hors vacances) dont dim 23h59 > maintenant et sam 00h00 < épreuve. */
  weekends: number;
  /** Jours de vacances scolaires restants avant l'épreuve. */
  holidayDays: number;
}

export const EVENING_TIME = "20:00";

/**
 * Temps de révision restant entre `now` et le début de l'épreuve.
 * Toutes les bornes sont calculées en heure civile de Paris (changement d'heure inclus).
 */
export function computeCountdown(
  now: Date,
  examStart: Date,
  holidays: HolidayPeriod[],
): Countdown {
  const result: Countdown = { evenings: 0, weekends: 0, holidayDays: 0 };
  if (examStart.getTime() <= now.getTime()) return result;

  const first = dateKey(now);
  const last = dateKey(examStart);
  const t0 = now.getTime();
  const t1 = examStart.getTime();

  for (let day = first; day <= last; day = addDays(day, 1)) {
    const wd = weekdayOf(day);
    const dayStart = parisDateTime(day, "00:00").getTime();
    const dayEnd = parisDateTime(day, "23:59").getTime();

    if (isHoliday(day, holidays)) {
      if (dayEnd > t0 && dayStart < t1) result.holidayDays++;
      continue;
    }

    if (wd >= 1 && wd <= 5) {
      const evening = parisDateTime(day, EVENING_TIME).getTime();
      if (evening > t0 && evening < t1) result.evenings++;
    }

    if (wd === 6) {
      const sunday = addDays(day, 1);
      const sundayEnd = parisDateTime(sunday, "23:59").getTime();
      if (sundayEnd > t0 && dayStart < t1) result.weekends++;
    }
  }

  // Week-end en cours commencé avant `first` : si on est dimanche, le samedi est déjà passé.
  if (weekdayOf(first) === 0) {
    const saturday = addDays(first, -1);
    if (!isHoliday(saturday, holidays)) {
      const sundayEnd = parisDateTime(first, "23:59").getTime();
      const satStart = parisDateTime(saturday, "00:00").getTime();
      if (sundayEnd > t0 && satStart < t1) result.weekends++;
    }
  }

  return result;
}

export function formatCountdown(c: Countdown): string {
  const parts = [`${c.evenings} ${c.evenings > 1 ? "soirs" : "soir"}`, `${c.weekends} WE`];
  if (c.holidayDays > 0) parts.push(`${c.holidayDays} j de vacances`);
  return parts.join(" · ");
}
