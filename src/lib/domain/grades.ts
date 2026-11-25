/**
 * Coefficients indicatifs (écrits ECT, total 30). Chaque école fixe les siens :
 * ils sont modifiables dans Réglages.
 */
export const DEFAULT_COEFFICIENTS: Record<string, number> = {
  maths: 5,
  eco: 3,
  droit: 3,
  management: 6,
  anglais: 4,
  espagnol: 3,
  lettres: 3,
  philo: 3,
};

export interface SubjectGrades {
  key: string;
  coef: number;
  /** Notes ramenées sur 20. */
  grades: number[];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Moyenne par matière et moyenne générale pondérée (matières sans note ou de coefficient 0 ignorées). */
export function weightedAverage(subjects: SubjectGrades[]) {
  const bySubject: Record<string, number | null> = {};
  let sum = 0;
  let totalCoef = 0;
  for (const s of subjects) {
    const avg = s.grades.length ? mean(s.grades) : null;
    bySubject[s.key] = avg;
    if (avg !== null && s.coef > 0) {
      sum += avg * s.coef;
      totalCoef += s.coef;
    }
  }
  return { average: totalCoef ? sum / totalCoef : null, bySubject, totalCoef };
}

/**
 * Note nécessaire au prochain DS de `subjectKey` pour que la moyenne générale pondérée atteigne `target`.
 * Le nouveau DS compte dans la moyenne de sa matière (moyenne simple des DS de la matière).
 */
export function requiredGrade(subjects: SubjectGrades[], subjectKey: string, target: number) {
  const s = subjects.find((x) => x.key === subjectKey);
  if (!s || s.coef <= 0) return { needed: NaN, achievable: false, alreadyReached: false };
  const others = subjects.filter((x) => x.key !== subjectKey && x.grades.length && x.coef > 0);
  const othersSum = others.reduce((a, x) => a + mean(x.grades) * x.coef, 0);
  const totalCoef = others.reduce((a, x) => a + x.coef, 0) + s.coef;
  const n = s.grades.length;
  const sumS = s.grades.reduce((a, b) => a + b, 0);
  // (othersSum + coef·(sumS + x)/(n+1)) / totalCoef = target
  const needed = ((target * totalCoef - othersSum) * (n + 1)) / s.coef - sumS;
  const rounded = Math.round(needed * 100) / 100;
  return { needed: rounded, achievable: rounded <= 20, alreadyReached: rounded <= 0 };
}

/** Progression vers un objectif de minutes (null si pas d'objectif). */
export function goalProgress(minutes: number, goal: number) {
  if (!goal) return { ratio: null, remaining: 0, reached: false };
  return { ratio: minutes / goal, remaining: Math.max(0, goal - minutes), reached: minutes >= goal };
}
