"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/format";
import { HomeworkCheck } from "@/components/dashboard/widgets";

export interface RemainingRow {
  id: string;
  label: string;
  color?: string | null;
  meta?: string;
  href: string;
  homework?: boolean;
}

/** « Ce qui reste cette semaine » en onglets compacts : une liste à la fois, 5 lignes max. */
export function RemainingTabs({ groups }: { groups: { key: string; label: string; rows: RemainingRow[]; more: string }[] }) {
  const firstNonEmpty = Math.max(0, groups.findIndex((g) => g.rows.length));
  const [tab, setTab] = useState(firstNonEmpty);
  const g = groups[tab];
  const total = groups.reduce((a, x) => a + x.rows.length, 0);
  return (
    <section className="card card-pad min-w-0">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title">Ce qui reste cette semaine</h2>
        <span className="text-xs text-muted">{total ? `${total} au total` : "rien 🎉"}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-2 mb-3">
        {groups.map((x, i) => (
          <button
            key={x.key}
            onClick={() => setTab(i)}
            className={cn("rounded-lg py-1.5 text-center min-w-0", i === tab ? "bg-surface shadow-sm" : "text-muted")}
          >
            <span className="block text-lg font-semibold leading-none">{x.rows.length}</span>
            <span className="block text-[10px] mt-0.5 truncate px-1">{x.label}</span>
          </button>
        ))}
      </div>
      {g.rows.length ? (
        <ul className="space-y-1.5">
          {g.rows.slice(0, 5).map((r) => (
            <li key={r.id} className="flex items-center gap-2 min-w-0 text-sm">
              {r.homework ? <HomeworkCheck id={r.id} done={false} className="size-4" /> : null}
              <span className="size-2 rounded-full shrink-0" style={{ background: r.color ?? "var(--muted)" }} />
              <Link href={r.href} className="flex-1 min-w-0 truncate">
                {r.label}
              </Link>
              {r.meta && <span className="text-xs text-muted shrink-0">{r.meta}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted py-2">Rien ici.</p>
      )}
      {g.rows.length > 5 && (
        <Link href={g.more} className="text-xs text-primary font-medium mt-2 inline-block">
          + {g.rows.length - 5} autre(s)
        </Link>
      )}
    </section>
  );
}
