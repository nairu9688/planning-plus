import { cn, tint } from "@/lib/format";
import type { Subject } from "@/lib/types";

export function SubjectDot({ color, className }: { color?: string | null; className?: string }) {
  return <span className={cn("inline-block size-2.5 rounded-full shrink-0", className)} style={{ background: color ?? "var(--muted)" }} />;
}

export function SubjectChip({ subject, className }: { subject?: Subject | null; className?: string }) {
  if (!subject) return <span className={cn("chip", className)}>Autre</span>;
  return (
    <span className={cn("chip", className)} style={{ background: tint(subject.color, 0.16) }}>
      <SubjectDot color={subject.color} />
      {subject.name}
    </span>
  );
}

export function Card({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("card card-pad min-w-0", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {title && <h2 className="section-title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted py-2">{children}</p>;
}

export function Gauge({ value, className }: { value: number | null; className?: string }) {
  const pct = value === null ? 0 : Math.round(value * 100);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted tabular-nums w-9 text-right">{value === null ? "—" : `${pct} %`}</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
