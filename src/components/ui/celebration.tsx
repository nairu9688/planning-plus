"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

const COLORS = ["#D50000", "#F6BF26", "#3F51B5", "#B0369B", "#039BE5", "#F4511E", "#33B679", "#00897B", "#7C9CE0"];

/** Écran de réussite (bilan validé) : confettis discrets + résumé. Respecte « réduire les animations ». */
export function Celebration({ title, lines, streak }: { title: string; lines: string[]; streak?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.2 + Math.random() * 1.6,
        size: 6 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
        round: Math.random() > 0.6,
      })),
    [],
  );
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 backdrop-blur-[2px] p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        {pieces.map((p, i) => (
          <span
            key={i}
            className="pp-confetti absolute top-0"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 0.45,
              borderRadius: p.round ? 999 : 2,
              background: p.color,
              animation: `pp-fall ${p.duration}s ${p.delay}s ease-in forwards`,
              transform: "translateY(-10vh)",
            }}
          />
        ))}
      </div>
      <div className="pp-pop relative w-full max-w-sm card elevated p-6 text-center space-y-3">
        <div className="mx-auto size-14 rounded-full bg-success/15 text-success grid place-items-center">
          <Check className="size-7" />
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <ul className="text-sm text-muted space-y-0.5">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {streak ? <p className="chip h-7 bg-warning/15 text-warning mx-auto">🔥 {streak} jour(s) d&apos;affilée</p> : null}
        <div className="flex gap-2 justify-center pt-2">
          <Link href="/" className="btn btn-primary">Retour à l&apos;accueil</Link>
          <Link href="/planner" className="btn btn-outline">Planner</Link>
        </div>
      </div>
    </div>
  );
}
