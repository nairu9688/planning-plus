"use client";

import { createContext, useCallback, useContext, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarClock, Link2, StickyNote, Timer } from "lucide-react";
import { FreeFocusForm } from "@/components/focus/free-focus";
import { Sheet } from "@/components/ui/sheet";
import { HomeworkForm, type HomeworkDraft } from "@/components/forms/homework-form";
import { createLink, createNote } from "@/app/actions/misc";
import { createSession } from "@/app/actions/sessions";
import { cn } from "@/lib/format";
import type { Subject } from "@/lib/types";

export type QuickAddType = "devoir" | "focus" | "session" | "postit" | "lien";
export interface QuickAddDetail {
  type?: QuickAddType;
  date?: string;
  time?: string;
  subjectId?: string | null;
  relatedEventId?: string | null;
  homework?: HomeworkDraft;
}

const Ctx = createContext<(d?: QuickAddDetail) => void>(() => {});
export const useQuickAdd = () => useContext(Ctx);

/** Déclencheur utilisable depuis n'importe quel composant (y compris rendu serveur via <QuickAddButton>). */
export function openQuickAdd(detail: QuickAddDetail) {
  window.dispatchEvent(new CustomEvent("pp:quick-add", { detail }));
}

const TABS: { type: QuickAddType; label: string; icon: React.ElementType }[] = [
  { type: "devoir", label: "Devoir", icon: BookOpen },
  { type: "focus", label: "Focus", icon: Timer },
  { type: "session", label: "Session", icon: CalendarClock },
  { type: "postit", label: "Post-it", icon: StickyNote },
  { type: "lien", label: "Lien", icon: Link2 },
];

export function QuickAddProvider({ subjects, children }: { subjects: Subject[]; children: React.ReactNode }) {
  const [detail, setDetail] = useState<QuickAddDetail | null>(null);
  const open = useCallback((d: QuickAddDetail = {}) => setDetail({ type: "devoir", ...d }), []);
  const close = useCallback(() => setDetail(null), []);

  useEffect(() => {
    const on = (e: Event) => open((e as CustomEvent<QuickAddDetail>).detail);
    window.addEventListener("pp:quick-add", on);
    // Lien profond (widgets Scriptable, Raccourcis) : /?nouveau=devoir&matiere=droit&date=2026-11-27
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("nouveau") as QuickAddType | null;
    if (t && TABS.some((x) => x.type === t)) {
      const key = sp.get("matiere");
      open({ type: t, date: sp.get("date") ?? undefined, subjectId: subjects.find((s) => s.key === key)?.id });
      sp.delete("nouveau");
      window.history.replaceState(null, "", `${window.location.pathname}${sp.size ? `?${sp}` : ""}`);
    }
    return () => window.removeEventListener("pp:quick-add", on);
  }, [open, subjects]);

  const type = detail?.type ?? "devoir";
  const isEdit = !!detail?.homework?.id;
  return (
    <Ctx.Provider value={open}>
      {children}
      <Sheet open={!!detail} onClose={close} title={isEdit ? "Modifier le devoir" : "Nouveau"}>
        {!isEdit && (
          <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-surface-2 mb-4">
            {TABS.map((t) => (
              <button
                key={t.type}
                onClick={() => setDetail((d) => ({ ...d, type: t.type }))}
                className={cn("flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium", type === t.type ? "bg-surface shadow-sm" : "text-muted")}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        )}
        {detail && type === "devoir" && (
          <HomeworkForm
            key={JSON.stringify(detail)}
            subjects={subjects}
            draft={{ subjectId: detail.subjectId, dueDate: detail.date, relatedEventId: detail.relatedEventId, ...detail.homework }}
            onDone={close}
          />
        )}
        {detail && type === "focus" && <FreeFocusForm subjects={subjects} onDone={close} />}
        {detail && type === "session" && <SessionQuickForm detail={detail} onDone={close} />}
        {detail && type === "postit" && <NoteQuickForm onDone={close} date={detail.date} />}
        {detail && type === "lien" && <LinkQuickForm onDone={close} />}
      </Sheet>
    </Ctx.Provider>
  );
}

function addMinutes(t: string, m: number) {
  const [h, mm] = t.split(":").map(Number);
  const tot = Math.min(h * 60 + mm + m, 23 * 60 + 59);
  return `${String(Math.floor(tot / 60)).padStart(2, "0")}:${String(tot % 60).padStart(2, "0")}`;
}

function SessionQuickForm({ detail, onDone }: { detail: QuickAddDetail; onDone: () => void }) {
  const router = useRouter();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const [date, setDate] = useState(detail.date ?? today);
  const [start, setStart] = useState(detail.time ?? "20:00");
  const [end, setEnd] = useState(detail.time ? addMinutes(detail.time, 90) : "21:50");
  const [kind, setKind] = useState("etude");
  const [error, setError] = useState<string | null>(null);
  const [pending, startT] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        startT(async () => {
          try {
            const id = await createSession({ date, start, end, kind: kind as "etude" });
            onDone();
            router.push(`/planner/${id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur");
          }
        });
      }}
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3 sm:col-span-1">
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Début</label>
          <input type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="label">Fin</label>
          <input type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Type</label>
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="etude">Étude</option>
          <option value="maison">Maison</option>
          <option value="bibliotheque">Bibliothèque</option>
          <option value="sport">Sport</option>
          <option value="libre">Libre</option>
        </select>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={pending} aria-busy={pending}>Créer et remplir</button>
      </div>
    </form>
  );
}

const NOTE_COLORS = ["yellow", "blue", "green", "pink", "purple"];
export const NOTE_BG: Record<string, string> = {
  yellow: "#FFF4C2",
  blue: "#DCEBFF",
  green: "#DDF5E3",
  pink: "#FFE0EA",
  purple: "#EDE3FF",
};

function NoteQuickForm({ onDone, date }: { onDone: () => void; date?: string }) {
  const [content, setContent] = useState("");
  const [color, setColor] = useState("yellow");
  const [due, setDue] = useState(date ?? "");
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await createNote({ content, color, dueDate: due || null });
          onDone();
        });
      }}
    >
      <textarea autoFocus className="input" rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Penser à…" style={{ background: NOTE_BG[color], color: "#1b1b1b" }} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {NOTE_COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setColor(c)} aria-label={c} className={cn("size-6 rounded-full border-2", color === c ? "border-primary" : "border-transparent")} style={{ background: NOTE_BG[c] }} />
          ))}
        </div>
        <input type="date" className="input w-auto" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Pour le" />
      </div>
      <div className="flex justify-end">
        <button className="btn btn-primary" aria-busy={pending} disabled={pending || !content.trim()}>Ajouter</button>
      </div>
    </form>
  );
}

function LinkQuickForm({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            await createLink({ url, label, targetType: "global" });
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur");
          }
        });
      }}
    >
      <input autoFocus className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé (facultatif)" />
      <p className="text-xs text-muted">Pour rattacher un lien à un DS, une khôlle ou une matière, ajoute-le depuis sa page.</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={pending} aria-busy={pending}>Ajouter</button>
      </div>
    </form>
  );
}

export function QuickAddButton({ detail, className, children, title }: { detail?: QuickAddDetail; className?: string; children: React.ReactNode; title?: string }) {
  const open = useQuickAdd();
  return (
    <button type="button" title={title} className={className} onClick={(e) => { e.stopPropagation(); open(detail); }}>
      {children}
    </button>
  );
}
