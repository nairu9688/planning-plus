/** Phrase naturelle lue par Siri (« Dis Siri, j'ai quoi demain ? »). */

export interface BriefEvent {
  title: string;
  kind: "cours" | "ds" | "kholle" | "autre";
  start: string; // "08h00"
  end: string;
  location: string | null;
  prep?: string | null;
}

export interface BriefInput {
  dayLabel: "aujourd'hui" | "demain" | string;
  weekday: string;
  events: BriefEvent[];
  homework: { title: string; subject: string | null }[];
  session: { mode: string; start: string; end: string; items: number } | null;
  nextDs: { title: string; when: string; countdown: string } | null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const room = (loc: string | null) => (loc ? loc.replace(/^salle\s+/i, "salle ") : null);

function joinList(parts: string[]) {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")}, et ${parts[parts.length - 1]}`;
}

export function buildBrief(b: BriefInput): string {
  const out: string[] = [];
  const intro = `${cap(b.dayLabel)}, ${b.weekday}, `;
  const ds = b.events.filter((e) => e.kind === "ds");
  const cours = b.events.filter((e) => e.kind === "cours");
  const kholles = b.events.filter((e) => e.kind === "kholle");

  let first = intro;
  if (ds.length) {
    out.push(`${first}attention : ${joinList(ds.map((e) => `${e.title} à ${e.start}${e.location ? `, ${room(e.location)}` : ""}`))}.`);
    first = "";
  }
  if (cours.length) {
    const a = cours[0];
    const z = cours[cours.length - 1];
    const where = a.location ? (/^salle/i.test(a.location) ? ` en ${room(a.location)}` : ` (${a.location})`) : "";
    const s = `tu commences à ${a.start} avec ${a.title}${where}, et tu finis à ${z.end} : ${cours.length} cours.`;
    out.push(first ? `${first}${s}` : cap(s));
    first = "";
  } else if (!ds.length) {
    out.push(`${intro}tu n'as pas cours.`);
  }

  for (const k of kholles) {
    out.push(`${k.title} à ${k.start}${k.location ? `, ${room(k.location)}` : ""}${k.prep ? `, préparation à ${k.prep}` : ""}.`);
  }

  if (!b.homework.length) out.push("Aucun devoir à rendre.");
  else {
    const n = b.homework.length;
    out.push(`${n} devoir${n > 1 ? "s" : ""} à rendre : ${joinList(b.homework.map((h) => (h.subject ? `${h.title} en ${h.subject}` : h.title)))}.`);
  }

  if (b.session) {
    const n = b.session.items;
    out.push(`Session ${b.session.mode} de ${b.session.start} à ${b.session.end}, ${n ? `${n} élément${n > 1 ? "s" : ""} prévu${n > 1 ? "s" : ""}` : "rien de prévu pour l'instant"}.`);
  }

  if (b.nextDs) out.push(`Prochain DS : ${b.nextDs.title} ${b.nextDs.when}, dans ${b.nextDs.countdown}.`);
  return out.join(" ");
}
