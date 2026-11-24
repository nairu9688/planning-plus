import { describe, expect, it } from "vitest";
import { classifyEvent, matchSubject, parseDsTitle, type GoogleEventLike } from "../classify";

const PRIMARY = "nanigeek@gmail.com";
const KHOLLES = "khollesid@group.calendar.google.com";
const PLANNING = "planningplus@group.calendar.google.com";
const ctx = { khollesCalendarId: KHOLLES, planningCalendarId: PLANNING };

function ev(summary: string, extra: Partial<GoogleEventLike> = {}): GoogleEventLike {
  return { id: "x", summary, eventType: "default", ...extra };
}

describe("matchSubject — titres réels du calendrier", () => {
  it.each([
    ["Maths Informatique (Le Mintier)", "11", "maths"],
    ["Economie (Jacquier)", "5", "eco"],
    ["Droit (Huguet)", "9", "droit"],
    ["Management Gest. Entreprise (Jacques) - Groupe G2", "3", "management"],
    ["Anglais LV1 (Defrance)", "7", "anglais"],
    ["Espagnol LV2 (Mayoral)", "6", "espagnol"],
    ["Lettres & Philosophie (Gay)", "10", "lettres"],
    ["Lettres & Philosophie (Gay) - semaine A", "10", "lettres"],
    ["Lettres & Philosophie (Cervellon)", "10", "philo"],
    ["DS - ESH HGG ECO N°2", "5", "eco"],
    ["DS - Philosophie N°2 (anticipée du CB)", "10", "philo"],
    ["DS - LV1 Ecricome N°3", "7", "anglais"],
    ["DS - LV2 Ecricome N°3", "6", "espagnol"],
    ["DS - Mathématiques N°4", "11", "maths"],
    ["Khôlle Gestion (Roudière)", "3", "management"],
    ["Khôlle Économie (Singer)", "5", "eco"],
    ["Khôlle Lettres & Philo (Gay)", "10", "lettres"],
    ["Khôlle Maths (Lemintier)", "11", "maths"],
    ["Synthèse N°1", "4", "droit"],
    ["Etude de cas ECT1 N°1", "2", "management"],
  ])("%s → %s", (title, colorId, expected) => {
    expect(matchSubject(title, colorId)).toBe(expected);
  });

  it("« Éco » accentué → eco", () => {
    expect(matchSubject("Révision Éco", undefined)).toBe("eco");
  });

  it("« école » ne déclenche pas eco", () => {
    expect(matchSubject("Réunion école", undefined)).toBeNull();
  });

  it("titre inconnu → repli sur colorId", () => {
    expect(matchSubject("Cours exceptionnel", "9")).toBe("droit");
    expect(matchSubject("Cours exceptionnel", "10")).toBe("philo");
  });

  it("ni mot-clé ni colorId connu → null", () => {
    expect(matchSubject("Rendez-vous orthodontiste", undefined)).toBeNull();
    expect(matchSubject("Anniversaire", "8")).toBeNull();
  });

  it("override manuel prioritaire", () => {
    expect(matchSubject("Droit (Huguet)", "9", { subjectKey: "eco" })).toBe("eco");
    expect(matchSubject("Droit (Huguet)", "9", { subjectKey: null })).toBeNull();
  });
});

describe("parseDsTitle", () => {
  it("extrait le numéro N°x", () => {
    expect(parseDsTitle("DS - ESH HGG ECO N°2")).toEqual({ number: 2, isCB: false });
    expect(parseDsTitle("DS - Mathématiques n° 4")).toEqual({ number: 4, isCB: false });
  });
  it("détecte la mention CB", () => {
    expect(parseDsTitle("DS - Philosophie N°2 (anticipée du CB)")).toEqual({ number: 2, isCB: true });
  });
  it("sans numéro", () => {
    expect(parseDsTitle("DS Droit")).toEqual({ number: null, isCB: false });
  });
});

describe("classifyEvent", () => {
  it("calendrier Khôlles → kholle, prof extrait", () => {
    const r = classifyEvent(KHOLLES, ev("Khôlle Gestion (Roudière)", { colorId: "3" }), ctx);
    expect(r).toMatchObject({ kind: "kholle", subjectKey: "management", teacher: "Roudière" });
  });

  it("titre commençant par DS → ds avec numéro", () => {
    const r = classifyEvent(PRIMARY, ev("DS - ESH HGG ECO N°2", { colorId: "5" }), ctx);
    expect(r).toMatchObject({ kind: "ds", subjectKey: "eco", dsNumber: 2, isCB: false });
  });

  it("DS en CB détecté", () => {
    const r = classifyEvent(PRIMARY, ev("DS - Philosophie N°2 (anticipée du CB)"), ctx);
    expect(r).toMatchObject({ kind: "ds", isCB: true });
  });

  it.each([
    ["Synthèse N°2", "4", "droit", 2],
    ["Synthèse N°3 (anticipée du CB)", "4", "droit", 3],
    ["Etude de cas ECT1 N°3", "2", "management", 3],
    ["Etude de cas Ecricome ECT1 N°2", "2", "management", 2],
    ["Etude de Cas N°5 ECT1", "2", "management", 5],
    ["DS - LV1 Elvi N°5 (CB)", "7", "anglais", 5],
  ])("épreuve numérotée sans « DS » : %s → ds / %s", (title, colorId, subject, n) => {
    const r = classifyEvent(PRIMARY, ev(title, { colorId }), ctx);
    expect(r).toMatchObject({ kind: "ds", subjectKey: subject, dsNumber: n });
  });

  it("un cours n'a jamais de N° : reste un cours", () => {
    expect(classifyEvent(PRIMARY, ev("Droit (Huguet)", { colorId: "9" }), ctx)?.kind).toBe("cours");
  });

  it("« DSCG » ou « Dsfr » n'est pas un DS", () => {
    expect(classifyEvent(PRIMARY, ev("DSCG infos"), ctx)?.kind).toBe("autre");
  });

  it("tâche Google Tasks (FOCUS_TIME + taskId) → ignorée", () => {
    const r = classifyEvent(
      PRIMARY,
      ev("imprimer droit", { eventType: "focusTime", taskId: "OOoxzk7gCMGOHNto" } as GoogleEventLike),
      ctx,
    );
    expect(r).toBeNull();
  });

  it("événement du calendrier Planning+ → ignoré", () => {
    expect(classifyEvent(PLANNING, ev("Session · étude"), ctx)).toBeNull();
  });

  it("événement annulé → ignoré", () => {
    expect(classifyEvent(PRIMARY, ev("Droit (Huguet)", { status: "cancelled" }), ctx)).toBeNull();
  });

  it("cours connu → cours", () => {
    const r = classifyEvent(PRIMARY, ev("Droit (Huguet)", { colorId: "9" }), ctx);
    expect(r).toMatchObject({ kind: "cours", subjectKey: "droit" });
  });

  it("autre événement → autre sans matière", () => {
    const r = classifyEvent(PRIMARY, ev("Dîner chez Mamie"), ctx);
    expect(r).toMatchObject({ kind: "autre", subjectKey: null });
  });

  it("override de kind prioritaire", () => {
    const r = classifyEvent(PRIMARY, ev("Droit (Huguet)", { colorId: "9" }), ctx, { kind: "ds" });
    expect(r?.kind).toBe("ds");
  });
});
