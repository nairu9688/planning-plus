import { describe, expect, it } from "vitest";
import { homeworkBadges } from "../homework-badges";

const maths = "maths";
const ev = (id: string, start: string, subjectId = maths, kind = "cours") => ({ id, start, subjectId, kind });
// Cours de maths : mer 25 (8h), jeu 26 (10h05), ven 27 (8h, 15h30), lun 30 (8h).
const events = [
  ev("mer", "2026-11-25T07:00:00Z"),
  ev("jeu", "2026-11-26T09:05:00Z"),
  ev("ven1", "2026-11-27T07:00:00Z"),
  ev("ven2", "2026-11-27T14:30:00Z"),
  ev("lun", "2026-11-30T07:00:00Z"),
  ev("droit", "2026-11-27T09:00:00Z", "droit"),
];

describe("homeworkBadges — un devoir n'apparaît que sur le cours où il est à rendre", () => {
  it("devoir pour vendredi : badge sur le premier cours de maths de vendredi seulement", () => {
    const m = homeworkBadges([{ subjectId: maths, dueAt: "2026-11-27T07:00:00Z", relatedEventId: null }], events);
    expect(Object.fromEntries(m)).toEqual({ ven1: 1 });
  });

  it("pas de cours de la matière le jour de l'échéance : le dernier cours avant", () => {
    const m = homeworkBadges([{ subjectId: maths, dueAt: "2026-11-29T07:00:00Z", relatedEventId: null }], events);
    expect(Object.fromEntries(m)).toEqual({ ven2: 1 });
  });

  it("devoir rattaché à un cours précis : badge sur ce cours", () => {
    const m = homeworkBadges([{ subjectId: maths, dueAt: "2026-11-27T07:00:00Z", relatedEventId: "lun" }], events);
    expect(Object.fromEntries(m)).toEqual({ lun: 1 });
  });

  it("sans échéance ou sans matière : aucun badge", () => {
    const m = homeworkBadges(
      [
        { subjectId: maths, dueAt: null, relatedEventId: null },
        { subjectId: null, dueAt: "2026-11-27T07:00:00Z", relatedEventId: null },
      ],
      events,
    );
    expect(m.size).toBe(0);
  });

  it("additionne les devoirs à rendre au même cours, ignore les non-cours", () => {
    const m = homeworkBadges(
      [
        { subjectId: maths, dueAt: "2026-11-27T07:00:00Z", relatedEventId: null },
        { subjectId: maths, dueAt: "2026-11-27T16:00:00Z", relatedEventId: null },
      ],
      [...events, ev("dsmaths", "2026-11-27T06:00:00Z", maths, "ds")],
    );
    expect(Object.fromEntries(m)).toEqual({ ven1: 2 });
  });
});
