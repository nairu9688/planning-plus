import { cn } from "@/lib/format";

/**
 * Anneau de progression (C1) : le chiffre au centre (ex. soirs restants),
 * l'anneau montre une proportion (ex. préparation). Même langage que les widgets iPhone.
 */
export function Ring({
  value,
  big,
  small,
  color = "var(--primary)",
  size = 64,
  stroke = 7,
  track = "var(--surface-2)",
  className,
  textClassName,
}: {
  /** 0 → 1 (null = anneau vide). */
  value: number | null;
  big: React.ReactNode;
  small?: React.ReactNode;
  color?: string;
  size?: number;
  stroke?: number;
  track?: string;
  className?: string;
  textClassName?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, value ?? 0));
  return (
    <div className={cn("relative shrink-0 grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {p > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * p} ${c}`}
            className="transition-[stroke-dasharray] duration-700"
          />
        )}
      </svg>
      <div className={cn("relative text-center leading-none", textClassName)}>
        <div className="font-bold tracking-tight" style={{ fontSize: size * 0.3 }}>
          {big}
        </div>
        {small && (
          <div className="text-muted mt-0.5" style={{ fontSize: Math.max(8, size * 0.13) }}>
            {small}
          </div>
        )}
      </div>
    </div>
  );
}
