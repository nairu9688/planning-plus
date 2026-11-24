"use client";

import { useState, useTransition } from "react";
import { Archive, Plus } from "lucide-react";
import { createSubjectItem, updateSubjectItem } from "@/app/actions/exams";
import { formatMinutes } from "@/lib/format";
import type { SubjectItem } from "@/lib/types";

const DEFAULT_TYPES = ["chapitre", "ds", "course_material", "autre"];
const TYPE_LABEL: Record<string, string> = { chapitre: "Chapitres", ds: "DS", course_material: "Course materials", autre: "Autres" };

export function SubjectItemsEditor({ subjectId, items }: { subjectId: string; items: (SubjectItem & { minutes: number; lastLabel: string | null })[] }) {
  const [type, setType] = useState("chapitre");
  const [customType, setCustomType] = useState("");
  const [title, setTitle] = useState("");
  const [num, setNum] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [pending, start] = useTransition();
  const types = [...new Set([...DEFAULT_TYPES, ...items.map((i) => i.type)])];
  const visible = items.filter((i) => showArchived || !i.archived);

  return (
    <div className="space-y-4">
      {types
        .filter((t) => visible.some((i) => i.type === t))
        .map((t) => (
          <div key={t}>
            <p className="text-xs font-medium text-muted mb-1.5">{TYPE_LABEL[t] ?? t}</p>
            <ul className="divide-y divide-border">
              {visible
                .filter((i) => i.type === t)
                .map((i) => (
                  <li key={i.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className={i.archived ? "flex-1 text-muted line-through" : "flex-1"}>
                      {i.number ? <span className="text-muted mr-1">{i.number}.</span> : null}
                      {i.title}
                    </span>
                    <span className="text-xs text-muted w-16 text-right">{formatMinutes(i.minutes)}</span>
                    <span className="text-xs text-muted w-24 text-right">{i.lastLabel ?? "jamais révisé"}</span>
                    <button className="text-muted hover:text-text" title={i.archived ? "Désarchiver" : "Archiver"} onClick={() => start(() => updateSubjectItem(i.id, { archived: !i.archived }))}>
                      <Archive className="size-3.5" />
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      {!visible.length && <p className="text-sm text-muted">Aucun élément. Ajoute tes chapitres, DS à retravailler, course materials…</p>}
      <form
        className="flex flex-wrap gap-2 pt-2 border-t border-border"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await createSubjectItem(subjectId, { type: type === "__custom" ? customType : type, title, number: num ? Number(num) : null });
            setTitle("");
            setNum("");
          });
        }}
      >
        <select className="input h-9 w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          {types.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
          <option value="__custom">Autre type…</option>
        </select>
        {type === "__custom" && <input className="input h-9 w-32" placeholder="Type" value={customType} onChange={(e) => setCustomType(e.target.value)} />}
        <input className="input h-9 w-16" placeholder="N°" inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value)} />
        <input className="input h-9 flex-1 min-w-40" placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn btn-outline" disabled={pending || !title.trim()}>
          <Plus className="size-4" />
        </button>
      </form>
      {items.some((i) => i.archived) && (
        <button className="text-xs text-muted" onClick={() => setShowArchived((s) => !s)}>
          {showArchived ? "Masquer les archivés" : "Afficher les archivés"}
        </button>
      )}
    </div>
  );
}
