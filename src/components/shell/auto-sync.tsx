"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { syncIfStale, syncNow } from "@/app/actions/misc";
import { cn } from "@/lib/format";

/** Synchro à l'ouverture de l'app (si la dernière a plus de 5 min). */
export function AutoSync() {
  useEffect(() => {
    syncIfStale().catch(() => {});
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

export function SyncButton({ lastSync, error }: { lastSync: string | null; error: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const label = lastSync
    ? `Synchronisé à ${new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(lastSync))}`
    : "Jamais synchronisé";
  return (
    <button
      className={cn("btn btn-ghost text-xs text-muted", error && "text-warning")}
      title={msg ?? error ?? label}
      disabled={pending} aria-busy={pending}
      onClick={() =>
        start(async () => {
          const r = await syncNow();
          setMsg(r.ok ? "Synchro terminée" : (r.error ?? "Erreur"));
          router.refresh();
        })
      }
    >
      <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
      <span className="hidden lg:inline">{pending ? "Synchro…" : error ? "Synchro incomplète" : label}</span>
    </button>
  );
}
