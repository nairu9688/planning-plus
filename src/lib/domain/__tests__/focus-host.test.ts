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
  it("peu avant le début (30 min) ou après la fin (1 h 30) : toujours la session du soir", () => {
    expect(pickHostSession([etude], now("19:35"))).toBe("etude");
    expect(pickHostSession([etude], now("23:15"))).toBe("etude");
  });
  it("trop loin de toute session : aucune (on en créera une)", () => {
    expect(pickHostSession([etude], now("15:00"))).toBeNull();
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
