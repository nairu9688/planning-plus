import { describe, expect, it } from "vitest";
import { computeCountdown, formatCountdown } from "../countdown";
import { parisDateTime } from "../time";
import { DEFAULT_HOLIDAYS_2026_2027 } from "../holidays";

const holidays = DEFAULT_HOLIDAYS_2026_2027;
const now = parisDateTime("2026-11-24", "16:00"); // mardi 24/11/2026 16h

describe("computeCountdown — exemples de la spec (section 7)", () => {
  it("DS Philosophie N°2 du lundi 30/11 à 8h → 4 soirs · 1 WE", () => {
    const c = computeCountdown(now, parisDateTime("2026-11-30", "08:00"), holidays);
    expect(c).toEqual({ evenings: 4, weekends: 1, holidayDays: 0 });
    expect(formatCountdown(c)).toBe("4 soirs · 1 WE");
  });

  it("CB du lundi 14/12 à 8h → 14 soirs · 3 WE", () => {
    const c = computeCountdown(now, parisDateTime("2026-12-14", "08:00"), holidays);
    expect(c).toEqual({ evenings: 14, weekends: 3, holidayDays: 0 });
    expect(formatCountdown(c)).toBe("14 soirs · 3 WE");
  });
});

describe("computeCountdown — DS du mardi et de l'après-midi", () => {
  it("DS du mardi 15/12 à 8h : le lundi soir 14/12 compte", () => {
    const c = computeCountdown(now, parisDateTime("2026-12-15", "08:00"), holidays);
    expect(c.evenings).toBe(15);
    expect(c.weekends).toBe(3);
  });

  it("DS du lundi 30/11 à 14h : le lundi soir ne compte pas (après le début)", () => {
    const c = computeCountdown(now, parisDateTime("2026-11-30", "14:00"), holidays);
    expect(c.evenings).toBe(4);
  });

  it("épreuve le lundi 30/11 à 21h : le lundi soir 20h compte", () => {
    const c = computeCountdown(now, parisDateTime("2026-11-30", "21:00"), holidays);
    expect(c.evenings).toBe(5);
  });

  it("le soir même ne compte plus après 20h", () => {
    const late = parisDateTime("2026-11-24", "20:30");
    const c = computeCountdown(late, parisDateTime("2026-11-30", "08:00"), holidays);
    expect(c.evenings).toBe(3);
  });
});

describe("computeCountdown — week-ends", () => {
  it("le week-end en cours compte tant qu'il n'est pas fini (dimanche 22h)", () => {
    const sunday = parisDateTime("2026-11-29", "22:00");
    const c = computeCountdown(sunday, parisDateTime("2026-11-30", "08:00"), holidays);
    expect(c).toEqual({ evenings: 0, weekends: 1, holidayDays: 0 });
  });

  it("une épreuve le samedi matin compte le week-end (samedi 00h avant l'épreuve)", () => {
    const c = computeCountdown(now, parisDateTime("2026-11-28", "08:00"), holidays);
    expect(c).toEqual({ evenings: 4, weekends: 1, holidayDays: 0 });
  });

  it("épreuve vendredi → aucun week-end", () => {
    const c = computeCountdown(now, parisDateTime("2026-11-27", "08:00"), holidays);
    expect(c).toEqual({ evenings: 3, weekends: 0, holidayDays: 0 });
  });
});

describe("computeCountdown — vacances", () => {
  it("vacances de Noël : soirs et week-ends de vacances exclus, jours de vacances à part", () => {
    // Vacances zone C : samedi 19/12/2026 → dimanche 03/01/2027 (reprise lundi 04/01)
    const from = parisDateTime("2026-12-15", "10:00");
    const c = computeCountdown(from, parisDateTime("2027-01-04", "08:00"), holidays);
    expect(c).toEqual({ evenings: 4, weekends: 0, holidayDays: 16 });
    expect(formatCountdown(c)).toBe("4 soirs · 0 WE · 16 j de vacances");
  });

  it("épreuve juste après les vacances avec un week-end normal avant", () => {
    const from = parisDateTime("2026-12-10", "10:00"); // jeudi
    const c = computeCountdown(from, parisDateTime("2027-01-05", "08:00"), holidays);
    // soirs : jeu 10, ven 11, lun 14 → ven 18 (5), lun 04/01 → 9
    expect(c.evenings).toBe(8);
    // WE : 12-13/12 seulement
    expect(c.weekends).toBe(1);
    expect(c.holidayDays).toBe(16);
  });

  it("en plein milieu des vacances, seuls les jours restants comptent", () => {
    const from = parisDateTime("2027-01-01", "12:00");
    const c = computeCountdown(from, parisDateTime("2027-01-04", "08:00"), holidays);
    expect(c).toEqual({ evenings: 0, weekends: 0, holidayDays: 3 });
  });
});

describe("computeCountdown — changement d'heure et cas limites", () => {
  it("passage à l'heure d'été (28/03/2027) sans décalage", () => {
    const from = parisDateTime("2027-03-26", "21:00"); // vendredi après 20h
    const c = computeCountdown(from, parisDateTime("2027-03-29", "20:30"), holidays);
    expect(c).toEqual({ evenings: 1, weekends: 1, holidayDays: 0 });
  });

  it("passage à l'heure d'hiver (25/10/2026) sans décalage", () => {
    const from = parisDateTime("2026-10-23", "21:00");
    // 17/10 → 01/11 = vacances de la Toussaint : le WE du 24-25 est en vacances
    const c = computeCountdown(from, parisDateTime("2026-11-02", "08:00"), holidays);
    expect(c.weekends).toBe(0);
    expect(c.evenings).toBe(0);
    expect(c.holidayDays).toBe(10);
  });

  it("épreuve passée → tout à zéro", () => {
    const c = computeCountdown(now, parisDateTime("2026-11-23", "08:00"), holidays);
    expect(c).toEqual({ evenings: 0, weekends: 0, holidayDays: 0 });
  });

  it("singulier : 1 soir", () => {
    expect(formatCountdown({ evenings: 1, weekends: 0, holidayDays: 1 })).toBe(
      "1 soir · 0 WE · 1 j de vacances",
    );
  });
});
