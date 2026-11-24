import { describe, expect, it } from "vitest";
import { prepGauge, resolveTarget, workedMinutesFor, type Exam } from "../targets";
import { parisDateTime } from "../time";

const sessionStart = parisDateTime("2026-11-24", "20:00");

const exams: Exam[] = [
  { id: "ds-philo-2", type: "ds", subjectKey: "philo", startAt: parisDateTime("2026-11-30", "08:00") },
  { id: "ds-eco-2", type: "ds", subjectKey: "eco", startAt: parisDateTime("2026-11-23", "08:00") },
  { id: "ds-eco-3", type: "ds", subjectKey: "eco", startAt: parisDateTime("2026-12-14", "08:00") },
  { id: "kh-eco", type: "kholle", subjectKey: "eco", startAt: parisDateTime("2026-11-26", "17:10") },
  { id: "kh-eco-old", type: "kholle", subjectKey: "eco", startAt: parisDateTime("2026-11-04", "17:10") },
  { id: "ds-maths-4", type: "ds", subjectKey: "maths", startAt: parisDateTime("2026-12-15", "08:00") },
  { id: "kh-maths", type: "kholle", subjectKey: "maths", startAt: parisDateTime("2026-12-08", "17:15") },
];

describe("resolveTarget", () => {
  it("next_ds → prochain DS de la matière après la session (pas un DS passé)", () => {
    expect(resolveTarget("eco", "next_ds", sessionStart, exams)).toEqual({
      target: "next_ds",
      dsId: "ds-eco-3",
      kholleId: null,
    });
  });

  it("next_kholle → prochaine khôlle de la matière", () => {
    expect(resolveTarget("eco", "next_kholle", sessionStart, exams)).toEqual({
      target: "next_kholle",
      dsId: null,
      kholleId: "kh-eco",
    });
  });

  it("auto → le plus proche des deux (khôlle éco jeudi avant DS éco 14/12)", () => {
    expect(resolveTarget("eco", "auto", sessionStart, exams).target).toBe("next_kholle");
    expect(resolveTarget("maths", "auto", sessionStart, exams)).toEqual({
      target: "next_kholle",
      dsId: null,
      kholleId: "kh-maths",
    });
    expect(resolveTarget("philo", "auto", sessionStart, exams)).toEqual({
      target: "next_ds",
      dsId: "ds-philo-2",
      kholleId: null,
    });
  });

  it("auto sans DS ni khôlle à venir → none", () => {
    expect(resolveTarget("droit", "auto", sessionStart, exams)).toEqual({
      target: "none",
      dsId: null,
      kholleId: null,
    });
  });

  it("cible demandée introuvable → none", () => {
    expect(resolveTarget("philo", "next_kholle", sessionStart, exams).target).toBe("none");
  });

  it("élément sans matière → none", () => {
    expect(resolveTarget(null, "auto", sessionStart, exams).target).toBe("none");
  });

  it("none explicite → none", () => {
    expect(resolveTarget("eco", "none", sessionStart, exams).target).toBe("none");
  });
});

describe("workedMinutesFor (7 derniers jours)", () => {
  const now = parisDateTime("2026-11-24", "22:00");
  it("somme réel si bilan, sinon prévu ; exclut les éléments retirés et hors fenêtre", () => {
    const items = [
      { targetId: "ds-philo-2", sessionStart: parisDateTime("2026-11-23", "20:00"), planned: 60, actual: 45, reviewed: true, removed: false },
      { targetId: "ds-philo-2", sessionStart: parisDateTime("2026-11-24", "20:00"), planned: 30, actual: null, reviewed: false, removed: false },
      { targetId: "ds-philo-2", sessionStart: parisDateTime("2026-11-10", "20:00"), planned: 90, actual: 90, reviewed: true, removed: false },
      { targetId: "ds-philo-2", sessionStart: parisDateTime("2026-11-22", "10:00"), planned: 60, actual: 0, reviewed: true, removed: true },
      { targetId: "autre", sessionStart: parisDateTime("2026-11-23", "20:00"), planned: 60, actual: 60, reviewed: true, removed: false },
    ];
    expect(workedMinutesFor("ds-philo-2", items, now)).toBe(75);
  });
});

describe("prepGauge", () => {
  it("pondération vu 0,33 / revu 0,66 / maîtrisé 1", () => {
    expect(prepGauge(["a_voir", "vu", "revu", "maitrise"])).toBeCloseTo((0 + 0.33 + 0.66 + 1) / 4, 5);
  });
  it("aucun chapitre → null", () => {
    expect(prepGauge([])).toBeNull();
  });
});
