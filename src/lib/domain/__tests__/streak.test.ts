import { describe, expect, it } from "vitest";
import { workStreak } from "../streak";

describe("workStreak — jours d'affilée avec du travail réel", () => {
  it("compte aujourd'hui s'il y a déjà du travail", () => {
    expect(workStreak(["2026-11-23", "2026-11-24", "2026-11-25"], "2026-11-25")).toEqual({ days: 3, includesToday: true });
  });

  it("aujourd'hui sans travail : la série jusqu'à hier reste valable", () => {
    expect(workStreak(["2026-11-23", "2026-11-24"], "2026-11-25")).toEqual({ days: 2, includesToday: false });
  });

  it("un trou casse la série", () => {
    expect(workStreak(["2026-11-20", "2026-11-22", "2026-11-23"], "2026-11-23")).toEqual({ days: 2, includesToday: true });
  });

  it("rien hier ni aujourd'hui → 0", () => {
    expect(workStreak(["2026-11-20"], "2026-11-25")).toEqual({ days: 0, includesToday: false });
  });

  it("doublons ignorés", () => {
    expect(workStreak(["2026-11-25", "2026-11-25", "2026-11-24"], "2026-11-25").days).toBe(2);
  });
});
