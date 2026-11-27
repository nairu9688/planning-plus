"use client";
import { friendlyError } from "@/lib/errors";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Clock, GripVertical, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setWorkRangeAction } from "@/app/actions/focus";
import { dateKey, timeKey } from "@/lib/domain/time";
import { addSessionItem, deleteSessionItem, reorderSessionItems, updateSessionItem } from "@/app/actions/sessions";
import { createHomework } from "@/app/actions/homework";
import { createSubjectItem } from "@/app/actions/exams";
import { cn } from "@/lib/format";
import type { SessionItem, Subject } from "@/lib/types";

export interface ItemOptions {
  homework: { id: string; title: string; subjectId: string | null; estimated: number | null; due: string | null }[];
  subjectItems: { id: string; subjectId: string; label: string }[];
  prepTasks: { id: string; label: string; exam: string }[];
  nextBySubject: Record<string, { ds: { label: string; at: string } | null; kholle: { label: string; at: string } | null }>;
  targetLabels: Record<string, string>;
}

type ItemType = "homework" | "revision" | "prep_task" | "sport";
type TargetChoice = "auto" | "next_ds" | "next_kholle" | "none";

const TYPE_LABEL: Record<ItemType, string> = { homework: "Devoir", revision: "Révision", prep_task: "Tâche DS / khôlle", sport: "Sport" };

export function ItemsEditor({
  sessionId,
  items,
  subjects,
  options,
  reviewed = false,
  ranges = {},
  sessionDate,
  sessionStart,
}: {
  sessionId: string;
  items: SessionItem[];
  subjects: Subject[];
  options: ItemOptions;
  /** Bilan fait : on corrige le temps réellement fait. */
  reviewed?: boolean;
  /** Horaires réels (chronos) par élément. */
  ranges?: Record<string, { start: string; end: string }>;
  sessionDate?: string;
  sessionStart?: string;
}) {
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const visible = items.filter((i) => !i.removed_in_review);
  const key = visible.map((i) => i.id).join(",");
  const [order, setOrder] = useState(() => visible.map((i) => i.id));
  useEffect(() => setOrder(key ? key.split(",") : []), [key]);
  const byId = new Map(visible.map((i) => [i.id, i]));
  const listRef = useRef<HTMLUListElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startSave] = useTransition();
  const [notice, setNotice] = useState<{ text: string; href: string } | null>(null);

  // Glisser-déposer à la poignée (souris et doigt) : l'élément suit le pointeur, l'ordre est enregistré au lâcher.
  const onMove = (e: React.PointerEvent) => {
    if (!dragId || !listRef.current) return;
    const rows = [...listRef.current.querySelectorAll<HTMLLIElement>("li[data-id]")];
    const others = rows.filter((r) => r.dataset.id !== dragId);
    let idx = others.findIndex((r) => {
      const b = r.getBoundingClientRect();
      return e.clientY < b.top + b.height / 2;
    });
    if (idx === -1) idx = others.length;
    const next = others.map((r) => r.dataset.id!);
    next.splice(idx, 0, dragId);
    if (next.join(",") !== order.join(",")) setOrder(next);
  };
  const onUp = () => {
    if (!dragId) return;
    setDragId(null);
    if (order.join(",") !== key) startSave(() => reorderSessionItems(sessionId, order));
  };

  return (
    <div className="space-y-3">
      <section className="card card-pad">
        <h2 className="section-title mb-3">{reviewed ? "Éléments" : "Éléments prévus"}</h2>
        {notice && (
          <p className="mb-3 rounded-xl bg-success/10 text-success text-sm px-3 py-2">
            ✓ {notice.text} ·{" "}
            <Link href={notice.href} className="underline font-medium">
              voir
            </Link>
          </p>
        )}
        {visible.length ? (
          <ul ref={listRef} className="divide-y divide-border" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            {order.filter((id) => byId.has(id)).map((id) => {
              const i = byId.get(id)!;
              return (
                <ItemRow
                  key={i.id}
                  item={i}
                  subject={i.subject_id ? subjectById.get(i.subject_id) : undefined}
                  options={options}
                  dragging={dragId === i.id}
                  onGrab={(e) => {
                    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                    setDragId(i.id);
                  }}
                  canDrag={visible.length > 1}
                  reviewed={reviewed}
                  range={ranges[i.id] ?? null}
                  sessionDate={sessionDate}
                  sessionStart={sessionStart}
                  onMoved={(text, href) => setNotice({ text, href })}
                />
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">Aucun élément. Ajoute un devoir, une révision ou une tâche de préparation.</p>
        )}
      </section>
      <AddItemForm sessionId={sessionId} subjects={subjects} options={options} />
    </div>
  );
}

function targetText(item: SessionItem, options: ItemOptions) {
  if (item.target === "next_ds" && item.target_ds_id) return `→ ${options.targetLabels[item.target_ds_id] ?? "prochain DS"}`;
  if (item.target === "next_kholle" && item.target_kholle_id) return `→ ${options.targetLabels[item.target_kholle_id] ?? "prochaine khôlle"}`;
  return "sans cible";
}

function ItemRow({
  item,
  subject,
  options,
  dragging,
  onGrab,
  canDrag,
  reviewed,
  range,
  sessionDate,
  sessionStart,
  onMoved,
}: {
  item: SessionItem;
  subject?: Subject;
  options: ItemOptions;
  dragging: boolean;
  onGrab: (e: React.PointerEvent) => void;
  canDrag: boolean;
  reviewed: boolean;
  range: { start: string; end: string } | null;
  sessionDate?: string;
  sessionStart?: string;
  onMoved: (text: string, href: string) => void;
}) {
  const [editRange, setEditRange] = useState(false);
  const [pending, start] = useTransition();
  const [minutes, setMinutes] = useState(item.planned_minutes);
  const [real, setReal] = useState(item.actual_minutes ?? 0);
  useEffect(() => setReal(item.actual_minutes ?? 0), [item.actual_minutes]);
  // Temps fait modifiable dès qu'il existe (Focus libre, bilan fait) ; prévu seulement s'il a un sens.
  const showReal = reviewed || item.origin === "ajoute_au_bilan" || item.actual_minutes !== null;
  const showPlanned = item.origin !== "ajoute_au_bilan" || item.planned_minutes > 0;
  return (
    <li data-id={item.id} className={cn("flex flex-wrap items-center gap-2 py-2.5 bg-surface", pending && "opacity-60", dragging && "relative z-10 rounded-xl shadow-lg ring-1 ring-primary/40")}>
      {canDrag && (
        <button
          type="button"
          onPointerDown={onGrab}
          className="touch-none cursor-grab active:cursor-grabbing -ml-1 p-1 text-muted"
          aria-label="Déplacer (glisser)"
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <span className="size-2.5 rounded-full shrink-0" style={{ background: subject?.color ?? "var(--muted)" }} />
      <div className="flex-1 min-w-40">
        <p className="text-sm font-medium">{item.description ?? subject?.name ?? TYPE_LABEL[item.item_type]}</p>
        <p className="text-xs text-muted">
          {TYPE_LABEL[item.item_type]}
          {subject ? ` · ${subject.name}` : ""} · {targetText(item, options)}

        </p>
      </div>
      <select
        className="input h-8 w-auto text-xs"
        value={item.target === "none" ? "none" : item.target}
        onChange={(e) => start(() => updateSessionItem(item.id, { target: e.target.value as TargetChoice }))}
        aria-label="Cible"
      >
        <option value="next_ds">Prochain DS</option>
        <option value="next_kholle">Prochaine khôlle</option>
        <option value="none">Aucune cible</option>
      </select>
      {showPlanned && (
        <label className="flex items-center gap-1">
          <span className="text-[11px] text-muted">prévu</span>
          <input
            type="number"
            min={0}
            step={5}
            className="input h-8 w-16 text-xs"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            onBlur={() => minutes !== item.planned_minutes && start(() => updateSessionItem(item.id, { plannedMinutes: minutes }))}
            aria-label="Durée prévue (min)"
          />
        </label>
      )}
      {showReal && (
        <label className="flex items-center gap-1">
          <span className="text-[11px] text-success font-medium">fait</span>
          <input
            type="number"
            min={0}
            max={900}
            step={5}
            inputMode="numeric"
            className="input h-8 w-16 text-xs border-success/50"
            value={real}
            onChange={(e) => setReal(Number(e.target.value))}
            onBlur={() => real !== (item.actual_minutes ?? 0) && start(() => updateSessionItem(item.id, { actualMinutes: Math.max(0, Math.round(real)) }))}
            aria-label="Temps réellement fait (min)"
          />
          <span className="text-xs text-muted">min</span>
        </label>
      )}
      {showReal && (
        <button
          className={cn("btn btn-ghost h-8 px-2 text-xs", editRange && "bg-surface-2")}
          onClick={() => setEditRange((v) => !v)}
          title="De quelle heure à quelle heure ?"
          aria-expanded={editRange}
        >
          <Clock className="size-4" />
          {range ? `${timeKey(range.start).replace(":", "h")}–${timeKey(range.end).replace(":", "h")}` : "horaires"}
        </button>
      )}
      <button className="btn btn-ghost h-8 w-8 p-0" onClick={() => start(() => deleteSessionItem(item.id))} aria-label="Retirer">
        <Trash2 className="size-4" />
      </button>
      {editRange && (
        <RangeEditor
          itemId={item.id}
          date={range ? dateKey(range.start) : (sessionDate ?? dateKey(new Date()))}
          start={range ? timeKey(range.start) : sessionStart ? timeKey(sessionStart) : "20:00"}
          end={range ? timeKey(range.end) : addMin(sessionStart ? timeKey(sessionStart) : "20:00", item.actual_minutes ?? 30)}
          onClose={() => setEditRange(false)}
          onMoved={onMoved}
        />
      )}
    </li>
  );
}

export function AddItemForm({
  sessionId,
  subjects,
  options,
  origin = "prevu",
  onAdded,
}: {
  sessionId: string;
  subjects: Subject[];
  options: ItemOptions;
  origin?: "prevu" | "ajoute_au_bilan";
  onAdded?: () => void;
}) {
  const [type, setType] = useState<ItemType>("revision");
  const [subjectId, setSubjectId] = useState<string>("");
  const [homeworkId, setHomeworkId] = useState<string>("");
  const [newHomework, setNewHomework] = useState("");
  const [subjectItemId, setSubjectItemId] = useState<string>("");
  const [newSubjectItem, setNewSubjectItem] = useState("");
  const [prepTaskId, setPrepTaskId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [target, setTarget] = useState<TargetChoice>("auto");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const hw = options.homework.find((h) => h.id === homeworkId);
  const effectiveSubject = type === "homework" ? (hw?.subjectId ?? (homeworkId === "" && newHomework ? subjectId : null)) : type === "revision" ? subjectId : null;
  const next = effectiveSubject ? options.nextBySubject[effectiveSubject] : null;
  const autoTarget = next?.ds && next?.kholle ? (next.kholle.at < next.ds.at ? "kholle" : "ds") : next?.ds ? "ds" : next?.kholle ? "kholle" : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        if ((type === "revision" || (type === "homework" && !homeworkId)) && !subjectId) throw new Error("Choisis la matière");
        let hid = homeworkId || null;
        if (type === "homework" && !hid) {
          if (!newHomework.trim()) throw new Error("Choisis ou crée un devoir");
          hid = await createHomework({ title: newHomework, subjectId: subjectId || null, estimatedMinutes: minutes });
        }
        let siid = subjectItemId || null;
        if (type === "revision" && !siid && newSubjectItem.trim()) {
          siid = await createSubjectItem(subjectId, { type: "chapitre", title: newSubjectItem });
        }
        if (type === "prep_task" && !prepTaskId) throw new Error("Choisis une tâche");
        await addSessionItem(sessionId, {
          itemType: type,
          homeworkId: type === "homework" ? hid : null,
          subjectId: type === "revision" ? subjectId : null,
          subjectItemId: type === "revision" ? siid : null,
          prepTaskId: type === "prep_task" ? prepTaskId : null,
          description: description || (type === "sport" ? "Sport" : null),
          plannedMinutes: minutes,
          actualMinutes: origin === "ajoute_au_bilan" ? minutes : null,
          done: origin === "ajoute_au_bilan",
          target: type === "sport" ? "none" : target,
          origin,
        });
        setDescription("");
        setNewHomework("");
        setNewSubjectItem("");
        setHomeworkId("");
        setSubjectItemId("");
        onAdded?.();
      } catch (err) {
        setError(friendlyError(err));
      }
    });
  }

  return (
    <form onSubmit={submit} className="card card-pad space-y-3">
      <h2 className="section-title">{origin === "prevu" ? "Ajouter un élément" : "Ajouter ce que tu as fait en plus"}</h2>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(TYPE_LABEL) as ItemType[]).map((t) => (
          <button type="button" key={t} onClick={() => setType(t)} className={cn("chip h-7", type === t && "bg-primary text-on-primary")}>
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {type === "homework" && (
        <div className="grid sm:grid-cols-2 gap-2">
          <select className="input" value={homeworkId} onChange={(e) => {
            setHomeworkId(e.target.value);
            const h = options.homework.find((x) => x.id === e.target.value);
            if (h?.estimated) setMinutes(h.estimated);
          }}>
            <option value="">— Nouveau devoir —</option>
            {options.homework.map((h) => (
              <option key={h.id} value={h.id}>
                {h.title}
                {h.due ? ` (${h.due})` : ""}
              </option>
            ))}
          </select>
          {!homeworkId && (
            <div className="flex gap-2">
              <select className="input w-36" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Matière…</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input className="input" placeholder="Titre du devoir" value={newHomework} onChange={(e) => setNewHomework(e.target.value)} />
            </div>
          )}
        </div>
      )}

      {type === "revision" && (
        <div className="grid sm:grid-cols-2 gap-2">
          <select className="input" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setSubjectItemId(""); }}>
            <option value="">Matière…</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input" value={subjectItemId} onChange={(e) => setSubjectItemId(e.target.value)}>
            <option value="">— Élément (facultatif) —</option>
            {options.subjectItems.filter((i) => i.subjectId === subjectId).map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
          {!subjectItemId && <input className="input sm:col-span-2" placeholder="…ou nouveau chapitre (facultatif)" value={newSubjectItem} onChange={(e) => setNewSubjectItem(e.target.value)} />}
        </div>
      )}

      {type === "prep_task" && (
        <select className="input" value={prepTaskId} onChange={(e) => setPrepTaskId(e.target.value)}>
          <option value="">— Choisir une tâche « à faire avant » —</option>
          {options.prepTasks.map((t) => <option key={t.id} value={t.id}>{t.label} · {t.exam}</option>)}
        </select>
      )}

      <input className="input" placeholder="Description (ex. fiche chapitre 3, exos 4-7)" value={description} onChange={(e) => setDescription(e.target.value)} />

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Durée (min)</label>
          <input type="number" min={0} step={5} className="input w-24" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </div>
        {type !== "sport" && (
          <div className="flex-1 min-w-48">
            <label className="label">Cible</label>
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value as TargetChoice)}>
              <option value="auto">
                Auto{autoTarget === "ds" ? ` : ${next?.ds?.label}` : autoTarget === "kholle" ? ` : ${next?.kholle?.label}` : " (le plus proche)"}
              </option>
              <option value="next_ds">Prochain DS{next?.ds ? ` : ${next.ds.label}` : ""}</option>
              <option value="next_kholle">Prochaine khôlle{next?.kholle ? ` : ${next.kholle.label}` : ""}</option>
              <option value="none">Aucune</option>
            </select>
          </div>
        )}
        <button className="btn btn-primary" disabled={pending} aria-busy={pending}>
          <Plus className="size-4" /> Ajouter
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}

function addMin(t: string, m: number) {
  const [h, mm] = t.split(":").map(Number);
  const tot = (h * 60 + mm + m) % (24 * 60);
  return `${String(Math.floor(tot / 60)).padStart(2, "0")}:${String(tot % 60).padStart(2, "0")}`;
}

/** « J'ai travaillé de … à … » : temps fait recalculé, élément rangé dans la bonne session. */
function RangeEditor({
  itemId,
  date,
  start: s0,
  end: e0,
  onClose,
  onMoved,
}: {
  itemId: string;
  date: string;
  start: string;
  end: string;
  onClose: () => void;
  onMoved: (text: string, href: string) => void;
}) {
  const router = useRouter();
  const [d, setD] = useState(date);
  const [a, setA] = useState(s0);
  const [b, setB] = useState(e0);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const mins = (() => {
    const [h1, m1] = a.split(":").map(Number);
    const [h2, m2] = b.split(":").map(Number);
    let x = h2 * 60 + m2 - (h1 * 60 + m1);
    if (x <= 0) x += 24 * 60;
    return x;
  })();
  return (
    <form
      className="basis-full rounded-xl bg-surface-2 p-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setWorkRangeAction(itemId, d, a, b);
          if (!r.ok) return setErr(r.error);
          setErr(null);
          if (r.moved) onMoved(`${mins} min déplacées dans la ${r.where}`, `/planner/${r.sessionId}`);
          onClose();
          router.refresh();
        });
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="label">Jour</span>
          <input type="date" className="input h-9" value={d} onChange={(e) => setD(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="label">De</span>
          <input type="time" className="input h-9 w-28" value={a} onChange={(e) => setA(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="label">À</span>
          <input type="time" className="input h-9 w-28" value={b} onChange={(e) => setB(e.target.value)} />
        </label>
        <span className="text-sm text-muted pb-2">= {mins} min</span>
        <button className="btn btn-primary h-9" disabled={pending} aria-busy={pending}>Enregistrer</button>
      </div>
      <p className="text-[11px] text-muted">Si ce créneau est surtout en dehors de cette session, l&apos;élément passe dans une session libre à ces horaires (et inversement).</p>
      {err && <p className="text-sm text-danger">{err}</p>}
    </form>
  );
}
