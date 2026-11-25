import { describe, expect, it } from "vitest";
import { buildBrief, type BriefInput } from "../brief";

const base: BriefInput = {
  dayLabel: "demain",
  weekday: "jeudi",
  events: [
    { title: "Maths", kind: "cours", start: "08h00", end: "09h50", location: "Salle 113" },
    { title: "Espagnol", kind: "cours", start: "10h05", end: "11h25", location: "Salle 113" },
    { title: "Lettres & Philo", kind: "cours", start: "13h00", end: "13h55", location: null },
    { title: "Économie", kind: "cours", start: "13h55", end: "14h50", location: null },
    { title: "Khôlle Économie", kind: "kholle", start: "17h10", end: "18h30", location: "Salle 444", prep: "17h10" },
  ],
  homework: [
    { title: "Exercices 12 à 15", subject: "Mathématiques" },
    { title: "Fiche arrêt Blanco", subject: "Droit" },
  ],
  session: { mode: "étude", start: "20h00", end: "21h50", items: 3 },
  nextDs: { title: "DS de Philosophie", when: "lundi", countdown: "4 soirs et 1 week-end" },
};

describe("buildBrief — phrase lue par Siri", () => {
  it("journée complète", () => {
    expect(buildBrief(base)).toBe(
      "Demain, jeudi, tu commences à 08h00 avec Maths en salle 113, et tu finis à 14h50 : 4 cours. " +
        "Khôlle Économie à 17h10, salle 444, préparation à 17h10. " +
        "2 devoirs à rendre : Exercices 12 à 15 en Mathématiques, et Fiche arrêt Blanco en Droit. " +
        "Session étude de 20h00 à 21h50, 3 éléments prévus. " +
        "Prochain DS : DS de Philosophie lundi, dans 4 soirs et 1 week-end.",
    );
  });

  it("jour sans cours ni devoir", () => {
    expect(buildBrief({ dayLabel: "demain", weekday: "samedi", events: [], homework: [], session: null, nextDs: null })).toBe(
      "Demain, samedi, tu n'as pas cours. Aucun devoir à rendre.",
    );
  });

  it("un seul cours et un seul devoir : accords au singulier", () => {
    const r = buildBrief({
      ...base,
      events: [{ title: "Droit", kind: "cours", start: "08h00", end: "09h25", location: null }],
      homework: [{ title: "Lire le chapitre 4", subject: null }],
      session: null,
      nextDs: null,
    });
    expect(r).toBe("Demain, jeudi, tu commences à 08h00 avec Droit, et tu finis à 09h25 : 1 cours. 1 devoir à rendre : Lire le chapitre 4.");
  });

  it("DS dans la journée mis en avant", () => {
    const r = buildBrief({
      ...base,
      events: [{ title: "DS de Philosophie", kind: "ds", start: "08h00", end: "12h00", location: "Salle 113" }],
      homework: [],
      session: null,
      nextDs: null,
    });
    expect(r).toBe("Demain, jeudi, attention : DS de Philosophie à 08h00, salle 113. Aucun devoir à rendre.");
  });

  it("aujourd'hui : formulation adaptée", () => {
    expect(buildBrief({ dayLabel: "aujourd'hui", weekday: "mercredi", events: [], homework: [], session: null, nextDs: null })).toBe(
      "Aujourd'hui, mercredi, tu n'as pas cours. Aucun devoir à rendre.",
    );
  });
});
