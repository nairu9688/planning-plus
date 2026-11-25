"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Home,
  LayoutGrid,
  Library,
  MessagesSquare,
  Plus,
  Settings,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/format";
import { Sheet } from "@/components/ui/sheet";
import { useQuickAdd } from "./quick-add";

export const NAV = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/calendrier", label: "Calendrier", icon: CalendarDays },
  { href: "/planner", label: "Study Planner", icon: Timer },
  { href: "/devoirs", label: "Devoirs", icon: BookOpen },
  { href: "/ds", label: "DS & CB", icon: GraduationCap },
  { href: "/kholles", label: "Khôlles", icon: MessagesSquare },
  { href: "/matieres", label: "Matières", icon: Library },
  { href: "/revue", label: "Revue du dimanche", icon: ClipboardCheck },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/reglages", label: "Réglages", icon: Settings },
] as const;

// Onglets iPhone : Aujourd'hui, Planner, [+], Devoirs, Plus (le calendrier est dans « Plus » et sur l'accueil).
const MOBILE_TABS = ["/", "/planner", "/devoirs"];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const quickAdd = useQuickAdd();
  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-[72px] flex-col items-center gap-1 border-r border-border bg-surface py-4">
      <Link href="/" className="mb-3 size-10 rounded-xl bg-primary text-on-primary grid place-items-center font-semibold text-sm">
        P+
      </Link>
      <button onClick={() => quickAdd()} className="mb-2 size-10 rounded-xl border border-border grid place-items-center hover:bg-surface-2" title="Nouveau (N)">
        <Plus className="size-5" />
      </button>
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          title={n.label}
          className={cn(
            "group relative size-10 rounded-xl grid place-items-center transition-colors",
            isActive(pathname, n.href) ? "bg-primary-tint text-primary" : "text-muted hover:bg-surface-2 hover:text-text",
          )}
        >
          <n.icon className="size-5" />
          <span className="pointer-events-none absolute left-12 whitespace-nowrap rounded-lg bg-text text-bg text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {n.label}
          </span>
        </Link>
      ))}
    </aside>
  );
}

export function BottomTabs() {
  const pathname = usePathname();
  const quickAdd = useQuickAdd();
  const [more, setMore] = useState(false);
  const tabs = NAV.filter((n) => MOBILE_TABS.includes(n.href));
  const rest = NAV.filter((n) => !MOBILE_TABS.includes(n.href));
  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface/95 backdrop-blur pb-safe">
        <div className="grid grid-cols-5 items-center px-2 pt-1.5">
          {tabs.slice(0, 2).map((n) => (
            <TabLink key={n.href} href={n.href} label={n.href === "/" ? "Aujourd'hui" : n.label === "Study Planner" ? "Planner" : n.label} icon={n.icon} active={isActive(pathname, n.href)} />
          ))}
          <div className="flex justify-center">
            <button onClick={() => quickAdd()} className="size-12 -mt-5 rounded-2xl bg-primary text-on-primary grid place-items-center shadow-lg" aria-label="Nouveau">
              <Plus className="size-6" />
            </button>
          </div>
          {tabs.slice(2).map((n) => (
            <TabLink key={n.href} href={n.href} label={n.label === "Study Planner" ? "Planner" : n.label} icon={n.icon} active={isActive(pathname, n.href)} />
          ))}
          <button onClick={() => setMore(true)} className={cn("flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium", rest.some((n) => isActive(pathname, n.href)) ? "text-primary" : "text-muted")} aria-label="Plus de pages">
            <LayoutGrid className="size-5" />
            Plus
          </button>
        </div>
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title="Menu">
        <div className="grid grid-cols-3 gap-2">
          {rest.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setMore(false)} className={cn("flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-xs", isActive(pathname, n.href) && "bg-primary-tint text-primary border-transparent")}>
              <n.icon className="size-5" />
              {n.label}
            </Link>
          ))}
        </div>
      </Sheet>
    </>
  );
}

function TabLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link href={href} className={cn("flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium", active ? "text-primary" : "text-muted")}>
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
