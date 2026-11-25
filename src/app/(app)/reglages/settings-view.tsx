"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Copy, LogOut, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  createApiToken,
  revokeApiToken,
  savePushSubscription,
  sendTestPush,
  setTheme,
  signOut,
  syncNow,
  updateSettings,
  updateSubject,
} from "@/app/actions/misc";
import { Card } from "@/components/ui/misc";
import { cn } from "@/lib/format";
import type { HolidayPeriod } from "@/lib/domain/holidays";
import type { SessionRules } from "@/lib/domain/sessions";
import type { Settings, Subject } from "@/lib/types";

export function SettingsView({
  settings,
  subjects,
  rules,
  holidays,
  tokens,
  vapidPublicKey,
  appUrl,
}: {
  settings: Settings;
  subjects: Subject[];
  rules: SessionRules;
  holidays: HolidayPeriod[];
  tokens: { id: string; name: string; token_prefix: string; last_used_at: string | null }[];
  vapidPublicKey: string;
  appUrl: string;
}) {
  return (
    <div className="space-y-4">
      <ThemeCard current={settings.theme} />
      <SyncCard settings={settings} />
      <SubjectsCard subjects={subjects} />
      <RulesCard rules={rules} weekA={settings.week_a_reference_date} neglected={settings.neglected_after_days} />
      <HolidaysCard holidays={holidays} />
      <NotificationsCard prefs={settings.notification_prefs} vapidPublicKey={vapidPublicKey} />
      <TokensCard tokens={tokens} appUrl={appUrl} />
      <button className="btn btn-outline w-full" onClick={async () => { await signOut(); window.location.href = "/login"; }}>
        <LogOut className="size-4" /> Se déconnecter
      </button>
    </div>
  );
}

function ThemeCard({ current }: { current: Settings["theme"] }) {
  const [pending, start] = useTransition();
  const apply = (t: Settings["theme"]) => {
    const d = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = d ? "dark" : "light";
    document.documentElement.dataset.pref = t;
    start(() => setTheme(t));
  };
  return (
    <Card title="Thème">
      <div className="inline-flex p-0.5 rounded-xl bg-surface-2 text-sm">
        {(["system", "light", "dark"] as const).map((t) => (
          <button key={t} disabled={pending} aria-busy={pending} onClick={() => apply(t)} className={cn("px-4 h-8 rounded-[10px]", current === t ? "bg-surface shadow-sm font-medium" : "text-muted")}>
            {t === "system" ? "Système" : t === "light" ? "Clair" : "Sombre"}
          </button>
        ))}
      </div>
    </Card>
  );
}

function SyncCard({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card title="Google Agenda et Tasks">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          start(async () => {
            await updateSettings({
              primary_calendar_id: (f.get("primary") as string) || "primary",
              kholles_calendar_id: (f.get("kholles") as string) || null,
            });
            setMsg("Enregistré");
          });
        }}
      >
        <div>
          <label className="label">Calendrier principal</label>
          <input name="primary" className="input" defaultValue={settings.primary_calendar_id} />
        </div>
        <div>
          <label className="label">ID du calendrier « Khôlles »</label>
          <input name="kholles" className="input font-mono text-xs" defaultValue={settings.kholles_calendar_id ?? ""} />
        </div>
        <p className="text-xs text-muted">
          Calendrier « Planning+ » : {settings.planning_calendar_id ? "créé" : "sera créé à la prochaine synchro"} · liste Tasks « Prépa » : {settings.tasks_list_id ? "reliée" : "sera créée à la prochaine synchro"}
        </p>
        <p className="text-xs text-muted">
          Dernière synchro : {settings.last_sync_at ? new Date(settings.last_sync_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "jamais"}
          {settings.last_sync_error && <span className="block text-warning mt-1">{settings.last_sync_error}</span>}
        </p>
        <div className="flex gap-2">
          <button className="btn btn-outline" disabled={pending} aria-busy={pending}>Enregistrer</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending} aria-busy={pending}
            onClick={() =>
              start(async () => {
                const r = await syncNow();
                setMsg(r.ok ? "Synchro terminée" : r.error);
                router.refresh();
              })
            }
          >
            <RefreshCw className={cn("size-4", pending && "animate-spin")} /> Synchroniser
          </button>
          <a href="/login" className="btn btn-ghost">Reconnecter Google</a>
        </div>
        {msg && <p className="text-xs text-muted">{msg}</p>}
      </form>
    </Card>
  );
}

function SubjectsCard({ subjects }: { subjects: Subject[] }) {
  const [pending, start] = useTransition();
  return (
    <Card title="Matières">
      <ul className="space-y-2">
        {subjects.map((s, i) => (
          <li key={s.id}>
            <form
              className={cn("grid grid-cols-[40px_1fr_1fr_50px_auto] gap-2 items-center", pending && "opacity-70")}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                start(() =>
                  updateSubject(s.id, {
                    name: f.get("name") as string,
                    teacher: (f.get("teacher") as string) || null,
                    color: f.get("color") as string,
                    sort_order: Number(f.get("order")),
                  }),
                );
              }}
            >
              <input type="color" name="color" defaultValue={s.color} className="h-9 w-10 rounded-lg border border-border bg-transparent" />
              <input name="name" defaultValue={s.name} className="input h-9" />
              <input name="teacher" defaultValue={s.teacher ?? ""} className="input h-9" placeholder="Prof" />
              <input name="order" type="number" defaultValue={s.sort_order ?? i} className="input h-9" aria-label="Ordre" />
              <button className="btn btn-outline h-9">OK</button>
            </form>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted mt-2">Les khôlles de Gestion sont rattachées à Management.</p>
    </Card>
  );
}

function RulesCard({ rules, weekA, neglected }: { rules: SessionRules; weekA: string; neglected: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const rows: [keyof SessionRules, string][] = [
    ["etude", "Soir · étude (lun→ven)"],
    ["maison", "Soir · maison"],
    ["suggestion", "Suggestion après les cours"],
    ["sundaySport", "Dimanche · sport"],
    ["sundayLibrary", "Dimanche · bibliothèque"],
  ];
  return (
    <Card title="Règles horaires">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const next = Object.fromEntries(rows.map(([k]) => [k, { start: f.get(`${k}-start`) as string, end: f.get(`${k}-end`) as string }])) as unknown as SessionRules;
          start(async () => {
            await updateSettings({ session_rules: next, week_a_reference_date: f.get("weekA") as string, neglected_after_days: Number(f.get("neglected")) || 7 });
            setMsg("Enregistré. Les prochaines sessions générées suivront ces horaires.");
          });
        }}
      >
        {rows.map(([k, label]) => (
          <div key={k} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-sm">
            <span>{label}</span>
            <input type="time" name={`${k}-start`} defaultValue={rules[k].start} className="input h-9 w-28" />
            <input type="time" name={`${k}-end`} defaultValue={rules[k].end} className="input h-9 w-28" />
          </div>
        ))}
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center text-sm pt-2">
          <span>Lundi d&apos;une semaine A</span>
          <input type="date" name="weekA" defaultValue={weekA} className="input h-9 w-40" />
          <span>Matière délaissée après (jours)</span>
          <input type="number" name="neglected" min={1} defaultValue={neglected} className="input h-9 w-40" />
        </div>
        <button className="btn btn-outline" disabled={pending} aria-busy={pending}>Enregistrer</button>
        {msg && <p className="text-xs text-muted">{msg}</p>}
      </form>
    </Card>
  );
}

function HolidaysCard({ holidays }: { holidays: HolidayPeriod[] }) {
  const [list, setList] = useState(holidays);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const set = (i: number, p: Partial<HolidayPeriod>) => setList((l) => l.map((h, j) => (j === i ? { ...h, ...p } : h)));
  return (
    <Card title="Vacances scolaires (zone C)">
      <ul className="space-y-2">
        {list.map((h, i) => (
          <li key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
            <input className="input h-9" value={h.name} onChange={(e) => set(i, { name: e.target.value })} />
            <input type="date" className="input h-9 w-36" value={h.start} onChange={(e) => set(i, { start: e.target.value })} />
            <input type="date" className="input h-9 w-36" value={h.end} onChange={(e) => set(i, { end: e.target.value })} />
            <button className="btn btn-ghost h-9 w-9 p-0" onClick={() => setList((l) => l.filter((_, j) => j !== i))} aria-label="Supprimer">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted mt-2">Dates incluses : premier et dernier jour sans cours.</p>
      <div className="flex gap-2 mt-3">
        <button className="btn btn-ghost" onClick={() => setList((l) => [...l, { name: "Vacances", start: "", end: "" }])}>
          <Plus className="size-4" /> Ajouter
        </button>
        <button
          className="btn btn-outline"
          disabled={pending} aria-busy={pending}
          onClick={() =>
            start(async () => {
              await updateSettings({ holidays: list.filter((h) => h.start && h.end) });
              setMsg("Enregistré");
            })
          }
        >
          Enregistrer
        </button>
      </div>
      {msg && <p className="text-xs text-muted mt-1">{msg}</p>}
    </Card>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function NotificationsCard({ prefs, vapidPublicKey }: { prefs: Settings["notification_prefs"]; vapidPublicKey: string }) {
  const [state, setState] = useState(prefs ?? {});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const items: [keyof typeof state, string][] = [
    ["bilan", "Rappel de bilan à 22h00 (session du soir sans bilan)"],
    ["kholle", "Khôlles : la veille à 19h00 et 30 min avant la préparation"],
    ["homework", "Devoirs dus demain (18h00)"],
    ["sunday", "Dimanche 20h00 : revue de la semaine"],
  ];

  async function enable() {
    setMsg(null);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setMsg("Notifications non supportées ici. Sur iPhone : ajoute d'abord Planning+ à l'écran d'accueil (iOS 16.4+), puis ouvre-le depuis l'icône.");
        return;
      }
      if (!vapidPublicKey) {
        setMsg("Clé VAPID absente côté serveur.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("Permission refusée.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await savePushSubscription(json, navigator.userAgent);
      setMsg("Notifications activées sur cet appareil.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <Card title="Notifications">
      <div className="space-y-2">
        {items.map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={state[k] !== false} onChange={(e) => setState((s) => ({ ...s, [k]: e.target.checked }))} />
            {label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <button className="btn btn-outline" disabled={pending} aria-busy={pending} onClick={() => start(async () => { await updateSettings({ notification_prefs: state as Record<string, boolean> }); setMsg("Préférences enregistrées"); })}>
          Enregistrer
        </button>
        <button className="btn btn-primary" onClick={enable}>
          <Bell className="size-4" /> Activer sur cet appareil
        </button>
        <button className="btn btn-ghost" disabled={pending} aria-busy={pending} onClick={() => start(async () => { const r = await sendTestPush(); setMsg(r.sent ? `Test envoyé (${r.sent})` : (r.skipped ?? "Aucun appareil abonné")); })}>
          Tester
        </button>
      </div>
      {msg && <p className="text-xs text-muted mt-2">{msg}</p>}
    </Card>
  );
}

function TokensCard({ tokens, appUrl }: { tokens: { id: string; name: string; token_prefix: string; last_used_at: string | null }[]; appUrl: string }) {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card title="Tokens API (Scriptable, Raccourcis, MCP)">
      <ul className="space-y-1.5 text-sm mb-3">
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center gap-2">
            <span className="flex-1">{t.name}</span>
            <code className="text-xs text-muted">{t.token_prefix}…</code>
            <span className="text-xs text-muted">{t.last_used_at ? `utilisé ${new Date(t.last_used_at).toLocaleDateString("fr-FR")}` : "jamais utilisé"}</span>
            <button className="btn btn-ghost h-8 w-8 p-0" onClick={() => start(() => revokeApiToken(t.id))} aria-label="Révoquer">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {!tokens.length && <li className="text-muted">Aucun token.</li>}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setCreated(await createApiToken(name || "iPhone"));
            setName("");
          });
        }}
      >
        <input className="input h-9" placeholder="Nom (ex. iPhone Scriptable)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-outline" disabled={pending} aria-busy={pending}>Créer</button>
      </form>
      {created && (
        <div className="mt-3 rounded-xl bg-primary-tint p-3 text-sm space-y-1">
          <p className="font-medium">Copie ce token maintenant, il ne sera plus affiché :</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all text-xs">{created}</code>
            <button className="btn btn-ghost h-8 w-8 p-0" onClick={() => navigator.clipboard.writeText(created)} aria-label="Copier">
              <Copy className="size-4" />
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted mt-3">
        API : <code>{appUrl}/api/v1/summary</code> · MCP : <code>{appUrl}/api/mcp</code> — en-tête <code>Authorization: Bearer &lt;token&gt;</code>.
      </p>
    </Card>
  );
}
