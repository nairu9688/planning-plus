"use client";

import { useRef, useState } from "react";
import { Check, MoonStar } from "lucide-react";
import { cn } from "@/lib/format";

const THRESHOLD = 80;

/**
 * Ligne glissable (C5) : glisser vers la droite = action principale (fait),
 * vers la gauche = action secondaire (ce soir). Sur ordinateur, des boutons
 * apparaissent au survol à la place du geste.
 */
export function SwipeRow({
  children,
  onRight,
  onLeft,
  onUndoRight,
  rightLabel = "Fait",
  leftLabel = "Ce soir",
  className,
}: {
  children: React.ReactNode;
  onRight?: () => Promise<unknown> | void;
  onLeft?: () => Promise<unknown> | void;
  /** Annuler l'action « fait » (bouton dans la confirmation). */
  onUndoRight?: () => Promise<unknown> | void;
  rightLabel?: string;
  leftLabel?: string;
  className?: string;
}) {
  const [dx, setDx] = useState(0);
  const [state, setState] = useState<"idle" | "busy" | "done-right" | "done-left">("idle");
  const [doneText, setDoneText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);

  const run = async (dir: "right" | "left") => {
    const fn = dir === "right" ? onRight : onLeft;
    if (!fn) return;
    setState("busy");
    try {
      const r = await fn();
      if (typeof r === "string") setDoneText(r);
      setState(dir === "right" ? "done-right" : "done-left");
    } catch (e) {
      setState("idle");
      setErr(e instanceof Error && !/Server Components/.test(e.message) ? e.message : "Ça n'a pas marché, réessaie");
      setTimeout(() => setErr(null), 3000);
    }
    setDx(0);
  };

  if (state === "done-right" || state === "done-left") {
    return (
      <div className={cn("pp-pop flex items-center gap-2 rounded-xl px-3 py-2 text-sm", state === "done-right" ? "bg-success/15 text-success" : "bg-primary-tint text-primary", className)}>
        {state === "done-right" ? <Check className="size-4" /> : <MoonStar className="size-4" />}
        <span className="flex-1 min-w-0">{doneText ?? (state === "done-right" ? "Fait, bravo" : "Ajouté à ta prochaine session")}</span>
        {state === "done-right" && onUndoRight && (
          <button
            className="text-xs font-semibold underline underline-offset-2 shrink-0"
            onClick={async () => {
              await onUndoRight();
              setState("idle");
              setDoneText(null);
            }}
          >
            Annuler
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("group relative overflow-hidden rounded-xl", className)}>
      {err && <p role="alert" className="absolute inset-x-0 top-0 z-10 rounded-xl bg-danger text-white text-xs font-medium px-3 py-2">{err}</p>}
      {/* Fonds révélés par le glissement */}
      <div className="absolute inset-0 flex items-stretch justify-between text-xs font-semibold" aria-hidden>
        <div className="flex items-center gap-1.5 px-3 bg-success text-white" style={{ opacity: dx > 0 ? Math.min(1, dx / THRESHOLD) : 0 }}>
          <Check className="size-4" /> {rightLabel}
        </div>
        <div className="flex items-center gap-1.5 px-3 bg-primary text-on-primary" style={{ opacity: dx < 0 ? Math.min(1, -dx / THRESHOLD) : 0 }}>
          {leftLabel} <MoonStar className="size-4" />
        </div>
      </div>
      <div
        className={cn("relative bg-surface touch-pan-y", state === "busy" && "opacity-60", dx === 0 && "transition-transform duration-200")}
        style={{ transform: `translateX(${dx}px)` }}
        onTouchStart={(e) => (start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: null })}
        onTouchMove={(e) => {
          const s = start.current;
          if (!s) return;
          const mx = e.touches[0].clientX - s.x;
          const my = e.touches[0].clientY - s.y;
          if (s.locked === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) s.locked = Math.abs(mx) > Math.abs(my);
          if (!s.locked) return;
          const v = mx > 0 && !onRight ? 0 : mx < 0 && !onLeft ? 0 : mx;
          setDx(Math.max(-140, Math.min(140, v)));
        }}
        onTouchEnd={() => {
          start.current = null;
          if (dx > THRESHOLD) run("right");
          else if (dx < -THRESHOLD) run("left");
          else setDx(0);
        }}
      >
        {children}
        {/* Boutons au survol (ordinateur) */}
        <div className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onLeft && (
            <button className="btn btn-outline h-7 px-2 text-xs" onClick={() => run("left")} disabled={state === "busy"} aria-busy={state === "busy"}>
              <MoonStar className="size-3.5" /> {leftLabel}
            </button>
          )}
          {onRight && (
            <button className="btn btn-primary h-7 px-2 text-xs" onClick={() => run("right")} disabled={state === "busy"}>
              <Check className="size-3.5" /> {rightLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
