import { describe, expect, it } from "vitest";
import { parseKholleInfo, kholleReminderAt } from "../kholle";
import { parisDateTime } from "../time";

describe("parseKholleInfo — descriptions réelles du calendrier Khôlles", () => {
  it("préparation + début + fin", () => {
    expect(parseKholleInfo("Préparation : 17h10 — Début de la khôlle : 17h30 — Fin : 18h30 (semaine S4)")).toEqual({
      prep: "17:10",
      start: "17:30",
      end: "18:30",
      noPrep: false,
      week: "S4",
    });
  });

  it("pas de préparation", () => {
    expect(parseKholleInfo("Pas de préparation — Début de la khôlle : 17h00 — Fin : 18h00 (semaine S4)")).toEqual({
      prep: null,
      start: "17:00",
      end: "18:00",
      noPrep: true,
      week: "S4",
    });
  });

  it("sans mention de préparation", () => {
    expect(parseKholleInfo("Début de la khôlle : 17h15 — Fin : 18h15 (semaine S9)").prep).toBeNull();
  });

  it("formats variés : 9h, 09:05, 18 h 10", () => {
    expect(parseKholleInfo("Préparation : 9h").prep).toBe("09:00");
    expect(parseKholleInfo("Préparation : 09:05").prep).toBe("09:05");
    expect(parseKholleInfo("préparation: 18 h 10").prep).toBe("18:10");
  });

  it("description vide", () => {
    expect(parseKholleInfo(null)).toEqual({ prep: null, start: null, end: null, noPrep: false, week: null });
  });
});

describe("kholleReminderAt — 30 min avant la préparation (ou le début)", () => {
  const start = parisDateTime("2026-11-26", "17:10"); // début de l'événement = début de la prépa

  it("avec préparation 17h10 → rappel 16h40", () => {
    expect(kholleReminderAt(start, "Préparation : 17h10 — Début de la khôlle : 17h30")).toEqual(parisDateTime("2026-11-26", "16:40"));
  });

  it("sans préparation : 30 min avant le début de la khôlle", () => {
    const s = parisDateTime("2026-11-25", "17:30");
    expect(kholleReminderAt(s, "Pas de préparation — Début de la khôlle : 17h30 — Fin : 18h30")).toEqual(parisDateTime("2026-11-25", "17:00"));
  });

  it("sans description : 30 min avant le début de l'événement", () => {
    expect(kholleReminderAt(start, null)).toEqual(parisDateTime("2026-11-26", "16:40"));
  });

  it("avance personnalisable", () => {
    expect(kholleReminderAt(start, "Préparation : 17h10", 60)).toEqual(parisDateTime("2026-11-26", "16:10"));
  });
});
