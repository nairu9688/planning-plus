import { describe, expect, it } from "vitest";
import { DEFAULT_COEFFICIENTS, requiredGrade, weightedAverage, goalProgress } from "../grades";

describe("coefficients par défaut", () => {
  it("total de 30, comme les coefficients d'écrit BCE", () => {
    expect(Object.values(DEFAULT_COEFFICIENTS).reduce((a, b) => a + b, 0)).toBe(30);
  });
});

describe("weightedAverage", () => {
  const subjects = [
    { key: "maths", coef: 5, grades: [12, 14] }, // 13
    { key: "anglais", coef: 4, grades: [16] }, // 16
    { key: "droit", coef: 3, grades: [] }, // ignorée
  ];

  it("moyenne par matière et moyenne générale pondérée (matières sans note ignorées)", () => {
    const r = weightedAverage(subjects);
    expect(r.bySubject).toEqual({ maths: 13, anglais: 16, droit: null });
    expect(r.average).toBeCloseTo((13 * 5 + 16 * 4) / 9, 6);
    expect(r.totalCoef).toBe(9);
  });

  it("aucune note → null", () => {
    expect(weightedAverage([{ key: "maths", coef: 5, grades: [] }]).average).toBeNull();
  });

  it("coefficient 0 : matière ignorée", () => {
    expect(weightedAverage([{ key: "maths", coef: 0, grades: [20] }, { key: "eco", coef: 2, grades: [10] }]).average).toBe(10);
  });
});

describe("requiredGrade — note nécessaire au prochain DS pour atteindre une moyenne cible", () => {
  const subjects = [
    { key: "maths", coef: 5, grades: [10] },
    { key: "anglais", coef: 5, grades: [14] },
  ];

  it("cas standard", () => {
    // moyenne actuelle 12 ; viser 13 avec un 2e DS de maths : maths → (10 + x)/2 ; (5·(10+x)/2 + 70)/10 = 13 → x = 14
    expect(requiredGrade(subjects, "maths", 13)).toEqual({ needed: 14, achievable: true, alreadyReached: false });
  });

  it("déjà atteint : même un 0 suffit", () => {
    expect(requiredGrade(subjects, "anglais", 8).alreadyReached).toBe(true);
  });

  it("inatteignable : plus de 20 nécessaire", () => {
    const r = requiredGrade(subjects, "maths", 17);
    expect(r.achievable).toBe(false);
    expect(r.needed).toBeGreaterThan(20);
  });

  it("matière encore sans note", () => {
    // (5·x + 5·14)/10 = 15 → x = 16
    expect(requiredGrade([{ key: "maths", coef: 5, grades: [] }, { key: "anglais", coef: 5, grades: [14] }], "maths", 15).needed).toBe(16);
  });
});

describe("goalProgress", () => {
  it("ratio et minutes restantes", () => {
    expect(goalProgress(90, 120)).toEqual({ ratio: 0.75, remaining: 30, reached: false });
    expect(goalProgress(150, 120)).toEqual({ ratio: 1.25, remaining: 0, reached: true });
    expect(goalProgress(30, 0)).toEqual({ ratio: null, remaining: 0, reached: false });
  });
});
