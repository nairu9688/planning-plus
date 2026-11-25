import { describe, expect, it } from "vitest";
import { nextReview, dueReviews, REVIEW_INTERVALS } from "../spaced";

describe("nextReview — révisions espacées J+1, J+3, J+7, J+21", () => {
  it("intervalles par défaut", () => {
    expect(REVIEW_INTERVALS).toEqual([1, 3, 7, 21]);
  });

  it("travaillé une fois le 20/11 → révision le 21/11", () => {
    expect(nextReview(["2026-11-20"])).toEqual({ date: "2026-11-21", step: 1 });
  });

  it("2e passage → +3 jours après le dernier", () => {
    expect(nextReview(["2026-11-20", "2026-11-21"])).toEqual({ date: "2026-11-24", step: 2 });
  });

  it("3e passage → +7 jours", () => {
    expect(nextReview(["2026-11-20", "2026-11-21", "2026-11-24"])).toEqual({ date: "2026-12-01", step: 3 });
  });

  it("à partir du 4e passage → +21 jours", () => {
    expect(nextReview(["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-12", "2026-11-02"])).toEqual({ date: "2026-11-23", step: 4 });
  });

  it("doublons et désordre ignorés", () => {
    expect(nextReview(["2026-11-21", "2026-11-20", "2026-11-20"])).toEqual({ date: "2026-11-24", step: 2 });
  });

  it("jamais travaillé → null", () => {
    expect(nextReview([])).toBeNull();
  });
});

describe("dueReviews", () => {
  const items = [
    { id: "a", workedDates: ["2026-11-20"] }, // dû le 21 → 3 j de retard
    { id: "b", workedDates: ["2026-11-20", "2026-11-21"] }, // dû le 24 → aujourd'hui
    { id: "c", workedDates: ["2026-11-20", "2026-11-21", "2026-11-24"] }, // dû le 1/12
    { id: "d", workedDates: [] },
  ];

  it("ne garde que les révisions dues à la date donnée, les plus en retard d'abord", () => {
    expect(dueReviews(items, "2026-11-24")).toEqual([
      { id: "a", date: "2026-11-21", step: 1, overdueDays: 3 },
      { id: "b", date: "2026-11-24", step: 2, overdueDays: 0 },
    ]);
  });

  it("horizon : inclut aussi celles dues dans les N jours", () => {
    expect(dueReviews(items, "2026-11-24", 7).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(dueReviews(items, "2026-11-24", 7).find((r) => r.id === "c")?.overdueDays).toBe(-7);
  });
});
