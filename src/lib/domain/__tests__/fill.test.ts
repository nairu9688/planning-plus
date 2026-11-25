import { describe, expect, it } from "vitest";
import { fillWeek, type FillSession, type FillTask } from "../fill";
import { parisDateTime } from "../time";

// Soirs d'étude lun 23 → ven 27 nov, 110 min chacun.
const evening = (date: string, capacity = 110): FillSession => ({
  id: date,
  start: parisDateTime(date, "20:00"),
  end: parisDateTime(date, "21:50"),
  capacity,
});
const week = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"].map((d) => evening(d));

const task = (key: string, minutes: number, deadline: Date | null, extra: Partial<FillTask> = {}): FillTask => ({ key, minutes, deadline, priority: 1, ...extra });

describe("fillWeek", () => {
  it("place un devoir dans la première session qui finit avant l'échéance", () => {
    const r = fillWeek(week, [task("hw", 45, parisDateTime("2026-11-26", "08:00"))]);
    expect(r.assignments).toEqual([{ sessionId: "2026-11-23", key: "hw", minutes: 45 }]);
    expect(r.unplaced).toEqual([]);
  });

  it("une session après l'échéance n'est jamais utilisée", () => {
    const r = fillWeek([evening("2026-11-26")], [task("hw", 30, parisDateTime("2026-11-26", "08:00"))]);
    expect(r.assignments).toEqual([]);
    expect(r.unplaced).toEqual(["hw"]);
  });

  it("respecte la capacité restante des sessions", () => {
    const r = fillWeek([evening("2026-11-23", 60), evening("2026-11-24", 60)], [task("a", 50, null), task("b", 50, null)]);
    expect(r.assignments).toEqual([
      { sessionId: "2026-11-23", key: "a", minutes: 50 },
      { sessionId: "2026-11-24", key: "b", minutes: 50 },
    ]);
  });

  it("échéance la plus proche d'abord", () => {
    const r = fillWeek([evening("2026-11-23", 60)], [task("tard", 60, parisDateTime("2026-11-30", "08:00")), task("tot", 60, parisDateTime("2026-11-25", "08:00"))]);
    expect(r.assignments.map((a) => a.key)).toEqual(["tot"]);
    expect(r.unplaced).toEqual(["tard"]);
  });

  it("à échéance égale, la priorité haute passe devant", () => {
    const d = parisDateTime("2026-11-26", "08:00");
    const r = fillWeek([evening("2026-11-23", 40)], [task("normal", 40, d, { priority: 1 }), task("urgent", 40, d, { priority: 2 })]);
    expect(r.assignments.map((a) => a.key)).toEqual(["urgent"]);
  });

  it("une longue tâche est découpée en morceaux d'au moins 20 min si nécessaire", () => {
    const r = fillWeek([evening("2026-11-23", 50), evening("2026-11-24", 50)], [task("long", 90, null)]);
    expect(r.assignments).toEqual([
      { sessionId: "2026-11-23", key: "long", minutes: 50 },
      { sessionId: "2026-11-24", key: "long", minutes: 40 },
    ]);
  });

  it("ne découpe pas si le total disponible ne suffit pas", () => {
    const r = fillWeek([evening("2026-11-23", 30)], [task("long", 90, null)]);
    expect(r.assignments).toEqual([]);
    expect(r.unplaced).toEqual(["long"]);
  });

  it("les morceaux d'un même groupe (préparation de DS) vont dans des sessions différentes", () => {
    const ds = parisDateTime("2026-11-30", "08:00");
    const r = fillWeek(week, [
      task("ds-1", 45, ds, { group: "ds" }),
      task("ds-2", 45, ds, { group: "ds" }),
      task("ds-3", 45, ds, { group: "ds" }),
    ]);
    expect(new Set(r.assignments.map((a) => a.sessionId)).size).toBe(3);
  });

  it("aucune session → tout est non placé", () => {
    expect(fillWeek([], [task("a", 30, null)])).toEqual({ assignments: [], unplaced: ["a"] });
  });
});
