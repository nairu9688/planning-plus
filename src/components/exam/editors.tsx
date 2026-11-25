"use client";
import { friendlyError } from "@/lib/errors";

import { useState, useTransition } from "react";
import { Check, ExternalLink, Plus, Trash2 } from "lucide-react";
import {
  addKholleQuestion,
  addPrepTask,
  addPrepTopic,
  deleteKholleQuestion,
  deletePrepTask,
  deletePrepTopic,
  setDsCbPeriod,
  setKholleQuestionStatus,
  setPrepTopicStatus,
  togglePrepTask,
  updateDs,
  updateKholle,
} from "@/app/actions/exams";
import { createLink, deleteLink } from "@/app/actions/misc";
import { cn } from "@/lib/format";
import type { CbPeriod, Link as LinkRow, PrepTask, PrepTopic } from "@/lib/types";

const STATUS: { v: PrepTopic["status"]; label: string }[] = [
  { v: "a_voir", label: "À voir" },
  { v: "vu", label: "Vu" },
  { v: "revu", label: "Revu" },
  { v: "maitrise", label: "Maîtrisé" },
];

export function PrepTopicsEditor({
  targetType,
  targetId,
  topics,
  subjectItems,
}: {
  targetType: "ds" | "kholle";
  targetId: string;
  topics: PrepTopic[];
  subjectItems: { id: string; label: string }[];
}) {
  const [title, setTitle] = useState("");
  const [itemId, setItemId] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {topics.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="flex-1 min-w-32">{t.title}</span>
            <div className="inline-flex p-0.5 rounded-lg bg-surface-2 text-[11px]">
              {STATUS.map((s) => (
                <button
                  key={s.v}
                  onClick={() => start(() => setPrepTopicStatus(t.id, s.v))}
                  className={cn("px-2 h-6 rounded-md", t.status === s.v ? "bg-surface shadow-sm font-medium" : "text-muted")}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button className="text-muted hover:text-danger" onClick={() => start(() => deletePrepTopic(t.id))} aria-label="Supprimer">
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const item = subjectItems.find((i) => i.id === itemId);
          start(async () => {
            await addPrepTopic(targetType, targetId, { title: title || item?.label || "", subjectItemId: itemId || null });
            setTitle("");
            setItemId("");
          });
        }}
      >
        {subjectItems.length > 0 && (
          <select className="input h-9 w-auto max-w-48" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Chapitre existant…</option>
            {subjectItems.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        )}
        <input className="input h-9 flex-1 min-w-40" placeholder="Chapitre au programme" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn btn-outline" aria-busy={pending} disabled={pending || (!title.trim() && !itemId)}>
          <Plus className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function PrepTasksEditor({ targetType, targetId, tasks }: { targetType: "ds" | "kholle"; targetId: string; tasks: PrepTask[] }) {
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-sm">
            <button
              onClick={() => start(() => togglePrepTask(t.id, !t.done))}
              className={cn("size-5 rounded-md border grid place-items-center", t.done ? "bg-success border-success text-white" : "border-border")}
              aria-label="Fait"
            >
              {t.done && <Check className="size-3.5" />}
            </button>
            <span className={cn("flex-1", t.done && "line-through text-muted")}>{t.title}</span>
            <button className="text-muted hover:text-danger" onClick={() => start(() => deletePrepTask(t.id))} aria-label="Supprimer">
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await addPrepTask(targetType, targetId, { title });
            setTitle("");
          });
        }}
      >
        <input className="input h-9" placeholder="Ex. Retravailler le DS4" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn btn-outline" aria-busy={pending} disabled={pending || !title.trim()}>
          <Plus className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function LinksEditor({ targetType, targetId, links }: { targetType: string; targetId: string | null; links: LinkRow[] }) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={l.id} className="flex items-center gap-2 text-sm">
            <ExternalLink className="size-3.5 text-muted" />
            <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-primary hover:underline">
              {l.label ?? l.url}
            </a>
            <button className="text-muted hover:text-danger" onClick={() => start(() => deleteLink(l.id))} aria-label="Supprimer">
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            try {
              await createLink({ url, label, targetType, targetId });
              setUrl("");
              setLabel("");
            } catch (err) {
              setError(friendlyError(err));
            }
          });
        }}
      >
        <input className="input h-9 flex-1 min-w-40" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className="input h-9 w-40" placeholder="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn btn-outline" aria-busy={pending} disabled={pending || !url.trim()}>
          <Plus className="size-4" />
        </button>
      </form>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function GradeEditor({ kind, id, grade, gradeMax, notes }: { kind: "ds" | "kholle"; id: string; grade: number | null; gradeMax?: number; notes: string | null }) {
  const [g, setG] = useState(grade?.toString() ?? "");
  const [max, setMax] = useState((gradeMax ?? 20).toString());
  const [n, setN] = useState(notes ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const grade = g.trim() ? Number(g.replace(",", ".")) : null;
          if (kind === "ds") await updateDs(id, { grade, grade_max: Number(max) || 20, notes: n || null });
          else await updateKholle(id, { grade, notes: n || null });
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
        });
      }}
    >
      <div className="flex items-center gap-2">
        <input className="input h-9 w-20" inputMode="decimal" placeholder="Note" value={g} onChange={(e) => setG(e.target.value)} />
        <span className="text-muted">/</span>
        {kind === "ds" ? <input className="input h-9 w-16" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} /> : <span className="text-sm">20</span>}
      </div>
      <textarea className="input" placeholder="Notes (remarques, erreurs à retenir…)" value={n} onChange={(e) => setN(e.target.value)} />
      <button className="btn btn-outline" disabled={pending} aria-busy={pending}>{saved ? "Enregistré" : "Enregistrer"}</button>
    </form>
  );
}

export function CbPicker({ dsId, current, periods, candidate }: { dsId: string; current: string | null; periods: CbPeriod[]; candidate: boolean }) {
  const [on, setOn] = useState(!!current);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 text-sm">
      {candidate && !current && <p className="rounded-lg bg-primary-tint text-primary px-2.5 py-1.5 text-xs">Ce DS ressemble à une épreuve de concours blanc (mention « CB » ou mardi).</p>}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            if (!e.target.checked && current) start(() => setDsCbPeriod(dsId, null).then(() => {}));
          }}
        />
        Fait partie d&apos;un concours blanc
      </label>
      {on && (
        <div className="flex flex-wrap gap-2">
          <select className="input h-9 w-auto" value={current ?? ""} onChange={(e) => e.target.value && start(() => setDsCbPeriod(dsId, { id: e.target.value }).then(() => {}))}>
            <option value="">Choisir une période…</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input h-9 w-44" placeholder="ou nouvelle (CB décembre)" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-outline" aria-busy={pending} disabled={pending || !name.trim()} onClick={() => start(() => setDsCbPeriod(dsId, { name }).then(() => setName("")))}>
            Créer
          </button>
        </div>
      )}
    </div>
  );
}

export function KholleQuestions({ kholleId, questions }: { kholleId: string; questions: { id: string; question: string; status: "a_revoir" | "ok" }[] }) {
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {questions.map((x) => (
          <li key={x.id} className="flex items-center gap-2 text-sm">
            <button
              onClick={() => start(() => setKholleQuestionStatus(x.id, x.status === "ok" ? "a_revoir" : "ok"))}
              className={cn("chip h-6", x.status === "ok" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}
            >
              {x.status === "ok" ? "OK" : "À revoir"}
            </button>
            <span className="flex-1">{x.question}</span>
            <button className="text-muted hover:text-danger" onClick={() => start(() => deleteKholleQuestion(x.id))} aria-label="Supprimer">
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await addKholleQuestion(kholleId, q);
            setQ("");
          });
        }}
      >
        <input className="input h-9" placeholder="Question de cours" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-outline" aria-busy={pending} disabled={pending || !q.trim()}>
          <Plus className="size-4" />
        </button>
      </form>
    </div>
  );
}
