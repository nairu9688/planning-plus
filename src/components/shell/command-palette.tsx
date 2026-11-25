"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { NAV } from "./nav";
import { openQuickAdd } from "./quick-add";
import { cn } from "@/lib/format";

export interface SearchEntry {
  label: string;
  hint?: string;
  href: string;
  color?: string;
}

type Item = { label: string; hint?: string; color?: string; run: () => void };

function norm(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Palette de commandes (⌘K / Ctrl+K) : navigation, création rapide, recherche. */
export function CommandPalette({ entries }: { entries: SearchEntry[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (!open && !e.metaKey && !e.ctrlKey && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          openQuickAdd({ type: "devoir" });
        } else if (e.key.toLowerCase() === "f") {
          e.preventDefault();
          openQuickAdd({ type: "focus" });
        }
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pp:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pp:palette", onOpen);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => input.current?.focus(), 10);
    }
  }, [open]);

  const items: Item[] = useMemo(() => {
    const go = (href: string) => () => {
      setOpen(false);
      router.push(href);
    };
    const add = (type: "devoir" | "focus" | "session" | "postit" | "lien") => () => {
      setOpen(false);
      openQuickAdd({ type });
    };
    const base: Item[] = [
      { label: "Nouveau devoir", hint: "N", run: add("devoir") },
      { label: "Focus libre (chrono ou minutes faites)", hint: "F", run: add("focus") },
      { label: "Nouvelle session", run: add("session") },
      { label: "Nouveau post-it", run: add("postit") },
      { label: "Nouveau lien", run: add("lien") },
      ...NAV.map((n) => ({ label: n.label, hint: "Aller à", run: go(n.href) })),
    ];
    const extra = entries.map((e) => ({ label: e.label, hint: e.hint, color: e.color, run: go(e.href) }));
    const all = [...base, ...extra];
    if (!q.trim()) return base;
    const n = norm(q);
    return all.filter((i) => norm(`${i.label} ${i.hint ?? ""}`).includes(n)).slice(0, 30);
  }, [q, entries, router]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true">
      <button aria-label="Fermer" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg card shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search className="size-4 text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, items.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              }
              if (e.key === "Enter") items[sel]?.run();
            }}
            placeholder="Rechercher un devoir, un DS, une page…"
            className="h-12 flex-1 bg-transparent outline-none text-sm"
          />
          <kbd className="text-[10px] text-muted border border-border rounded px-1.5 py-0.5">Échap</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {items.map((i, idx) => (
            <li key={`${i.label}-${idx}`}>
              <button
                onMouseEnter={() => setSel(idx)}
                onClick={i.run}
                className={cn("w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm", idx === sel && "bg-surface-2")}
              >
                {i.color && <span className="size-2 rounded-full" style={{ background: i.color }} />}
                <span className="flex-1 truncate">{i.label}</span>
                {i.hint && <span className="text-xs text-muted">{i.hint}</span>}
              </button>
            </li>
          ))}
          {!items.length && <li className="px-3 py-6 text-center text-sm text-muted">Aucun résultat</li>}
        </ul>
      </div>
    </div>
  );
}

export function PaletteTrigger({ className }: { className?: string }) {
  return (
    <button onClick={() => window.dispatchEvent(new Event("pp:palette"))} className={cn("btn btn-outline text-muted font-normal", className)}>
      <Search className="size-4" />
      <span className="hidden sm:inline">Rechercher</span>
      <kbd className="hidden sm:inline text-[10px] border border-border rounded px-1">⌘K</kbd>
    </button>
  );
}
