import { describe, expect, it } from "vitest";
import { parseQuickHomework } from "../quick-homework";

// Mercredi 25/11/2026.
const today = "2026-11-25";
const p = (s: string) => parseQuickHomework(s, today);

describe("parseQuickHomework — « maths exos 12-15 vendredi »", () => {
  it("matière, titre, jour de la semaine (prochain vendredi)", () => {
    expect(p("maths exos 12-15 vendredi")).toEqual({ subject: "maths", title: "Exos 12-15", dueDate: "2026-11-27", dueTime: null, minutes: null, priority: "normale" });
  });
  it("« pour » et un jour déjà passé cette semaine → semaine suivante ; aujourd'hui → dans 7 jours", () => {
    expect(p("droit fiche arrêt pour lundi").dueDate).toBe("2026-11-30");
    expect(p("anglais essay mercredi").dueDate).toBe("2026-12-02");
  });
  it("demain, après-demain, date jj/mm", () => {
    expect(p("éco dissert demain").dueDate).toBe("2026-11-26");
    expect(p("philo lecture après-demain").dueDate).toBe("2026-11-27");
    expect(p("management étude de cas 3/12").dueDate).toBe("2026-12-03");
    expect(p("lettres résumé 15/01").dueDate).toBe("2027-01-15");
  });
  it("heure, durée, priorité", () => {
    const r = p("eco QCM demain 8h 30min urgent");
    expect(r).toMatchObject({ subject: "eco", title: "QCM", dueDate: "2026-11-26", dueTime: "08:00", minutes: 30, priority: "haute" });
    expect(p("maths DM 1h30 lundi 10h15")).toMatchObject({ minutes: 90, dueTime: "10:15", title: "DM" });
  });
  it("alias de matières, accents et majuscules", () => {
    expect(p("Mathématiques DM").subject).toBe("maths");
    expect(p("ESP traduction").subject).toBe("espagnol");
    expect(p("manag cas Nike").subject).toBe("management");
    expect(p("philosophie texte").subject).toBe("philo");
  });
  it("sans matière ni date : tout est le titre", () => {
    expect(p("lire le chapitre 4")).toEqual({ subject: null, title: "Lire le chapitre 4", dueDate: null, dueTime: null, minutes: null, priority: "normale" });
  });
});
