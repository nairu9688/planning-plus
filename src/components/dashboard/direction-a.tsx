"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeftRight, ClipboardCheck, MoonStar, Play, Plus } from "lucide-react";
import { setSessionMode } from "@/app/actions/sessions";
import { setHomeworkStatus } from "@/app/actions/homework";
import { planHomeworkSoon } from "@/app/actions/sessions";
import { planSoonMessage } from "@/lib/plan-label";
import { SwipeRow } from "@/components/ui/swipe-row";
import { FillWeekButton } from "@/components/planner/fill-week";
import { openQuickAdd } from "@/components/shell/quick-add";
import { cn, formatMinutes } from "@/lib/format";

export interface TonightItem {
  id: string;
  label: string;
  color: string | null;
  minutes: number;
  done: boolean;
}

export interface TonightData {
  id: string;
  mode: "etude" | "maison" | string;
  start: string;
  end: string;
  status: string;
  location: string | null;
  items: TonightItem[];
}

const hm = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fmt = (iso: string) => hm.format(new Date(iso)).replace(":", "h");

function relative(ms: number) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

/** « Ce soir » en grand (direction A + C2) : barre de remplissage par matière, Focus, bascule étude/maison. */
export function TonightHero({ t }: { t: TonightData | null }) {
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  if (!t) {
    return (
      <section className="hero p-4 sm:p-5 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Ce soir</p>
        <p className="text-lg font-semibold">Pas de session ce soir</p>
        <p className="text-sm text-white/70">Crée une session ou laisse Planning+ remplir ta semaine avec tes devoirs, révisions et préparations.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn bg-white text-[#1b2a4a] hover:bg-white/90" onClick={() => openQuickAdd({ type: "session" })}>
            <Plus className="size-4" /> Créer une session
          </button>
          <FillWeekButton className="bg-white/15 hover:bg-white/25 text-white" />
        </div>
      </section>
    );
  }

  const s = Date.parse(t.start);
  const e = Date.parse(t.end);
  const slot = Math.round((e - s) / 60000);
  const items = t.items;
  const planned = items.reduce((a, i) => a + i.minutes, 0);
  const status = t.status === "bilan_fait" ? "bilan fait ✓" : now < s ? `dans ${relative(s - now)}` : now < e ? `en cours · encore ${relative(e - now)}` : "terminée";
  const ended = now >= e;
  const evening = t.mode === "etude" || t.mode === "maison";

  return (
    <section className="hero p-4 sm:p-5 space-y-3" aria-label="Session de ce soir">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/75">
          Ce soir · {t.mode === "maison" ? "maison" : t.mode === "etude" ? "étude" : t.mode} {fmt(t.start)}–{fmt(t.end)}
          {t.location ? ` · ${t.location}` : ""}
        </p>
        <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">{status}</span>
      </div>

      {/* C2 : barre de remplissage segmentée par matière, dans l'ordre de passage */}
      <div>
        <div className="flex h-3.5 rounded-full bg-white/15 overflow-hidden">
          {items.map((i) => (
            <span
              key={i.id}
              className={cn("h-full border-r border-[#1b2a4a]/40 last:border-r-0", i.done && "opacity-40")}
              style={{ width: `${(Math.min(i.minutes, slot) / Math.max(slot, planned)) * 100}%`, background: i.color ?? "#9fb8f0" }}
              title={`${i.label} · ${formatMinutes(i.minutes)}`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-white/70 mt-1">
          <span>{items.length ? `${items.length} élément(s)` : "Vide"}</span>
          <span className={planned > slot ? "text-[#fdd663] font-semibold" : ""}>
            {formatMinutes(planned)} / {formatMinutes(slot)}
            {planned > slot ? " · trop rempli" : planned < slot ? ` · ${formatMinutes(slot - planned)} libres` : ""}
          </span>
        </div>
      </div>

      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((i) => (
            <li key={i.id} className={cn("flex items-center gap-2 text-sm", i.done && "line-through text-white/50")}>
              <span className="size-2.5 rounded-full shrink-0" style={{ background: i.color ?? "#9fb8f0" }} />
              <span className="flex-1 min-w-0 truncate">{i.label}</span>
              <span className="text-xs text-white/70 shrink-0">{formatMinutes(i.minutes)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
          Rien de prévu.
          <FillWeekButton className="h-8 bg-white/15 hover:bg-white/25 text-white" label="Remplir automatiquement" />
          <Link href={`/planner/${t.id}`} className="underline underline-offset-2">ou à la main</Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {ended && t.status !== "bilan_fait" ? (
          <Link href={`/planner/${t.id}/bilan`} className="btn bg-white text-[#1b2a4a] hover:bg-white/90 flex-1 sm:flex-none">
            <ClipboardCheck className="size-4" /> Faire le bilan
          </Link>
        ) : (
          <Link href={`/planner/${t.id}/focus`} className="btn bg-white text-[#1b2a4a] hover:bg-white/90 flex-1 sm:flex-none">
            <Play className="size-4" /> Lancer le Focus
          </Link>
        )}
        {evening && (
          <button
            className="btn bg-white/15 hover:bg-white/25 text-white"
            disabled={pending}
            aria-busy={pending}
            onClick={() => start(() => setSessionMode(t.id, t.mode === "maison" ? "etude" : "maison"))}
          >
            <ArrowLeftRight className="size-4" /> {t.mode === "maison" ? "Étude 20h" : "Maison 21h"}
          </button>
        )}
        <Link href={`/planner/${t.id}`} className="btn bg-white/10 hover:bg-white/20 text-white">
          Modifier
        </Link>
      </div>
    </section>
  );
}

export interface DueItem {
  id: string;
  title: string;
  color: string | null;
  subject: string | null;
  dueLabel: string;
  overdue: boolean;
  high: boolean;
}

/** « À rendre » : devoirs proches, à glisser (fait / ce soir). */
export function DueSoon({ items, total }: { items: DueItem[]; total: number }) {
  return (
    <section className="card card-pad min-w-0">
      <div className="flex items-center justify-between mb-2">
        <h2 className="section-title">À rendre</h2>
        <Link href="/devoirs" className="text-xs text-primary font-medium">
          {total} au total →
        </Link>
      </div>
      {items.length ? (
        <>
          <ul className="space-y-1">
            {items.map((h) => (
              <li key={h.id}>
                <SwipeRow onRight={() => setHomeworkStatus(h.id, "fait")} onLeft={() => planSoonMessage(() => planHomeworkSoon(h.id))}>
                  <Link href={`/devoirs?id=${h.id}`} className="flex items-center gap-2.5 px-2 py-2 min-w-0">
                    <span className="size-2.5 rounded-full shrink-0" style={{ background: h.color ?? "var(--muted)" }} />
                    <span className="flex-1 min-w-0">
                      <span className={cn("block text-sm truncate", h.high && "font-semibold")}>{h.title}</span>
                      {h.subject && <span className="block text-[11px] text-muted truncate">{h.subject}</span>}
                    </span>
                    <span className={cn("text-xs shrink-0 md:group-hover:opacity-0", h.overdue ? "text-danger font-semibold" : "text-muted")}>{h.dueLabel}</span>
                  </Link>
                </SwipeRow>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted mt-2 md:hidden">
            Glisse → fait · glisse ← <MoonStar className="inline size-3" /> ce soir
          </p>
        </>
      ) : (
        <div className="text-sm text-muted space-y-2">
          <p>Rien à rendre dans les 3 prochains jours.</p>
          <button className="btn btn-outline h-8" onClick={() => openQuickAdd({ type: "devoir" })}>
            <Plus className="size-4" /> Ajouter un devoir
          </button>
        </div>
      )}
    </section>
  );
}
