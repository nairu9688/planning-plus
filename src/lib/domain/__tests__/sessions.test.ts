import { describe, expect, it } from "vitest";
import {
  DEFAULT_SESSION_RULES,
  generateSessions,
  maisonToggle,
  type BusyEvent,
  type ExistingGenerated,
} from "../sessions";
import { DEFAULT_HOLIDAYS_2026_2027 } from "../holidays";
import { parisDateTime } from "../time";

const rules = DEFAULT_SESSION_RULES;
const holidays = DEFAULT_HOLIDAYS_2026_2027;

function gen(from: string, events: BusyEvent[] = [], existing: ExistingGenerated[] = [], days = 7) {
  return generateSessions({ from, days, rules, holidays, events, existing });
}

describe("generateSessions — règles de base", () => {
  it("semaine du lundi 23/11 : 5 soirs d'étude, suggestions 17h20 libres, dimanche sport + biblio", () => {
    const out = gen("2026-11-23");
    const soirs = out.filter((s) => s.rule === "soir_etude");
    expect(soirs).toHaveLength(5);
    expect(soirs[0]).toMatchObject({
      date: "2026-11-23",
      kind: "etude",
      status: "prevue",
      startAt: parisDateTime("2026-11-23", "20:00"),
      endAt: parisDateTime("2026-11-23", "21:50"),
    });
    expect(out.filter((s) => s.rule === "apres_cours")).toHaveLength(5);
    expect(out.filter((s) => s.rule === "apres_cours").every((s) => s.status === "suggeree")).toBe(true);

    const dimanche = out.filter((s) => s.date === "2026-11-29");
    expect(dimanche.map((s) => [s.rule, s.kind, s.status])).toEqual([
      ["dimanche_sport", "sport", "suggeree"],
      ["dimanche_biblio", "bibliotheque", "suggeree"],
    ]);
    expect(dimanche[1].startAt).toEqual(parisDateTime("2026-11-29", "10:00"));
    expect(dimanche[1].endAt).toEqual(parisDateTime("2026-11-29", "19:00"));
  });

  it("samedi : rien d'automatique", () => {
    expect(gen("2026-11-23").filter((s) => s.date === "2026-11-28")).toEqual([]);
  });

  it("3 semaines glissantes = 21 jours", () => {
    const out = gen("2026-11-23", [], [], 21);
    expect(out.filter((s) => s.rule === "soir_etude")).toHaveLength(15);
  });
});

describe("generateSessions — chevauchements", () => {
  it("khôlle 17h30–18h30 → pas de suggestion 17h20 ce jour-là", () => {
    const kholle: BusyEvent = {
      kind: "kholle",
      startAt: parisDateTime("2026-11-25", "17:30"),
      endAt: parisDateTime("2026-11-25", "18:30"),
    };
    const out = gen("2026-11-23", [kholle]);
    expect(out.find((s) => s.date === "2026-11-25" && s.rule === "apres_cours")).toBeUndefined();
    expect(out.find((s) => s.date === "2026-11-25" && s.rule === "soir_etude")).toBeDefined();
  });

  it("cours finissant à 17h20 pile → la suggestion reste (pas de chevauchement)", () => {
    const cours: BusyEvent = {
      kind: "cours",
      startAt: parisDateTime("2026-11-27", "15:30"),
      endAt: parisDateTime("2026-11-27", "17:20"),
    };
    const out = gen("2026-11-23", [cours]);
    expect(out.find((s) => s.date === "2026-11-27" && s.rule === "apres_cours")).toBeDefined();
  });

  it("un événement « autre » ne bloque pas la suggestion", () => {
    const autre: BusyEvent = {
      kind: "autre",
      startAt: parisDateTime("2026-11-24", "18:00"),
      endAt: parisDateTime("2026-11-24", "19:00"),
    };
    expect(gen("2026-11-23", [autre]).find((s) => s.date === "2026-11-24" && s.rule === "apres_cours")).toBeDefined();
  });
});

describe("generateSessions — idempotence", () => {
  it("ne régénère pas une session déjà créée (quel que soit son statut, y compris ignorée)", () => {
    const first = gen("2026-11-23");
    const existing: ExistingGenerated[] = first.map((s) => ({ date: s.date, rule: s.rule }));
    expect(gen("2026-11-23", [], existing)).toEqual([]);
  });

  it("une suggestion retirée (ignorée) n'est pas régénérée, les autres oui", () => {
    const existing: ExistingGenerated[] = [{ date: "2026-11-24", rule: "apres_cours" }];
    const out = gen("2026-11-23", [], existing);
    expect(out.find((s) => s.date === "2026-11-24" && s.rule === "apres_cours")).toBeUndefined();
    expect(out.find((s) => s.date === "2026-11-24" && s.rule === "soir_etude")).toBeDefined();
  });
});

describe("generateSessions — vacances", () => {
  it("aucune génération pendant les vacances de Noël", () => {
    const out = gen("2026-12-19", [], [], 16);
    expect(out).toEqual([]);
  });

  it("reprise le lundi 04/01 : génération normale", () => {
    const out = gen("2027-01-03", [], [], 2);
    expect(out.map((s) => [s.date, s.rule])).toEqual([
      ["2027-01-04", "soir_etude"],
      ["2027-01-04", "apres_cours"],
    ]);
  });
});

describe("generateSessions — changement d'heure", () => {
  it("dimanche 28/03/2027 (heure d'été) : biblio 10h–19h en heure locale", () => {
    const out = gen("2027-03-28", [], [], 1);
    const biblio = out.find((s) => s.rule === "dimanche_biblio")!;
    expect(biblio.startAt.toISOString()).toBe("2027-03-28T08:00:00.000Z");
    expect(biblio.endAt.toISOString()).toBe("2027-03-28T17:00:00.000Z");
  });
});

describe("maisonToggle", () => {
  it("étude → maison : 21h00–23h00", () => {
    const r = maisonToggle("2026-11-24", "maison", rules);
    expect(r).toEqual({
      kind: "maison",
      startAt: parisDateTime("2026-11-24", "21:00"),
      endAt: parisDateTime("2026-11-24", "23:00"),
    });
  });
  it("maison → étude : 20h00–21h50", () => {
    const r = maisonToggle("2026-11-24", "etude", rules);
    expect(r.startAt).toEqual(parisDateTime("2026-11-24", "20:00"));
    expect(r.endAt).toEqual(parisDateTime("2026-11-24", "21:50"));
  });
});
