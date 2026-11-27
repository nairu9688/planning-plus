import { describe, expect, it } from "vitest";
import { pickHostSession, capFocusMinutes } from "../focus-host";

const s = (id: string, start: string, end: string, kind = "etude", status = "prevue", free = false) => ({ id, kind, status, start, end, free });
// Mercredi 25/11 : étude 20h–21h50 (Paris = UTC+1).
const etude = s("etude", "2026-11-25T19:00:00Z", "2026-11-25T20:50:00Z");
const now = (hhmm: string) => new Date(`2026-11-25T${hhmm}:00+01:00`);

describe("pickHostSession — un Focus libre s'ajoute à la session du soir", () => {
  it("pendant la session : cette session", () => {
    expect(pickHostSession([etude], now("20:37"))).toBe("etude");
  });
  it("même si son bilan est déjà fait", () => {
    expect(pickHostSession([{ ...etude, status: "bilan_fait" }], now("21:10"))).toBe("etude");
  });
  it("avant le début (jusqu'à 3 h) ou après la fin (1 h 30) : toujours la session du soir", () => {
    expect(pickHostSession([etude], now("19:35"))).toBe("etude");
    expect(pickHostSession([etude], now("18:23"))).toBe("etude");
    expect(pickHostSession([etude], now("23:15"))).toBe("etude");
  });
  it("trop loin de toute session : aucune (on en créera une)", () => {
    expect(pickHostSession([etude], now("16:30"))).toBeNull();
  });
  it("ignore sport, suggestions et sessions ignorées", () => {
    expect(pickHostSession([s("sp", etude.start, etude.end, "sport")], now("20:30"))).toBeNull();
    expect(pickHostSession([s("sg", etude.start, etude.end, "suggestion", "suggeree")], now("20:30"))).toBeNull();
    expect(pickHostSession([{ ...etude, status: "ignoree" }], now("20:30"))).toBeNull();
  });
  it("préfère la vraie session à une session « Focus libre » et la session en cours à une voisine", () => {
    const libre = s("libre", "2026-11-25T19:30:00Z", "2026-11-25T19:45:00Z", "libre", "bilan_fait", true);
    expect(pickHostSession([libre, etude], now("20:40"))).toBe("etude");
    const apres = s("biblio", "2026-11-25T21:00:00Z", "2026-11-25T22:00:00Z", "bibliotheque");
    expect(pickHostSession([etude, apres], now("21:30"))).toBe("etude");
    expect(pickHostSession([etude, apres], now("22:05"))).toBe("biblio");
  });
  it("réutilise une session Focus libre récente s'il n'y a rien d'autre", () => {
    const libre = s("libre", "2026-11-25T14:00:00Z", "2026-11-25T14:20:00Z", "libre", "bilan_fait", true);
    expect(pickHostSession([libre], now("16:00"))).toBe("libre");
  });
});

describe("capFocusMinutes — un chrono oublié ne compte pas la nuit entière", () => {
  it("chrono normal : minutes réelles", () => {
    expect(capFocusMinutes(new Date("2026-11-25T19:40:00Z"), new Date("2026-11-25T20:03:00Z"), new Date("2026-11-25T20:50:00Z"))).toBe(23);
  });
  it("au moins 1 minute", () => {
    expect(capFocusMinutes(new Date("2026-11-25T19:40:00Z"), new Date("2026-11-25T19:40:20Z"), null)).toBe(1);
  });
  it("arrêté longtemps après la fin de la session : plafonné à la fin + 30 min", () => {
    expect(capFocusMinutes(new Date("2026-11-25T19:38:00Z"), new Date("2026-11-26T07:00:00Z"), new Date("2026-11-25T20:50:00Z"))).toBe(102);
  });
  it("sans session connue : plafond de 4 h", () => {
    expect(capFocusMinutes(new Date("2026-11-25T08:00:00Z"), new Date("2026-11-26T08:00:00Z"), null)).toBe(240);
  });
});

import { hostForRange } from "../focus-host";

describe("hostForRange — un créneau de travail corrigé va dans la bonne session", () => {
  const at = (hhmm: string) => new Date(`2026-11-27T${hhmm}:00+01:00`);
  const etude27 = { id: "etude", kind: "etude", status: "prevue", start: "2026-11-27T19:00:00Z", end: "2026-11-27T20:50:00Z", free: false };
  const libre = { id: "libre", kind: "libre", status: "bilan_fait", start: "2026-11-27T17:00:00Z", end: "2026-11-27T17:30:00Z", free: true };
  it("18h23–19h03, étude 20h : hors de l'étude", () => {
    expect(hostForRange([etude27], at("18:23"), at("19:03"))).toBeNull();
  });
  it("dans l'étude ou majoritairement dedans : l'étude", () => {
    expect(hostForRange([etude27], at("20:10"), at("20:50"))).toBe("etude");
    expect(hostForRange([etude27], at("19:40"), at("20:40"))).toBe("etude");
  });
  it("à moitié ou moins dedans : hors de l'étude", () => {
    expect(hostForRange([etude27], at("19:30"), at("20:30"))).toBeNull();
  });
  it("ignore les sessions Focus libre, sport et ignorées", () => {
    expect(hostForRange([libre], at("18:00"), at("18:20"))).toBeNull();
    expect(hostForRange([{ ...etude27, kind: "sport" }], at("20:10"), at("20:50"))).toBeNull();
    expect(hostForRange([{ ...etude27, status: "ignoree" }], at("20:10"), at("20:50"))).toBeNull();
  });
});
