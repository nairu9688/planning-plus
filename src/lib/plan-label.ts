import { dateKey } from "@/lib/domain/time";

const hm = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const wd = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long" });

/** « ce soir 20h00 », « demain 20h00 », « jeudi 20h00 ». */
export function sessionWhen(startIso: string, now = new Date()): string {
  const d = dateKey(startIso);
  const today = dateKey(now);
  const tomorrow = dateKey(new Date(now.getTime() + 86_400_000));
  const h = hm.format(new Date(startIso)).replace(":", "h");
  return `${d === today ? (Number(h.slice(0, 2)) >= 17 ? "ce soir" : "aujourd'hui") : d === tomorrow ? "demain" : wd.format(new Date(startIso))} ${h}`;
}

/** Action « mettre dans la prochaine session » pour une ligne glissable : texte de confirmation ou erreur lisible. */
export async function planSoonMessage(run: () => Promise<{ start: string } | null>): Promise<string> {
  const r = await run();
  if (!r) throw new Error("Aucune session à venir : crée-en une dans le Planner");
  return `Ajouté à ta session de ${sessionWhen(r.start)}`;
}
