"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Barre de progression en haut de l'écran pendant les navigations internes
 * (clic sur un lien), pour voir tout de suite que ça charge.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);

  // Fin de navigation : la nouvelle URL est rendue.
  useEffect(() => {
    if (!active) return;
    setProgress(100);
    const t = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  // Début : clic sur un lien interne vers une autre URL.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setActive(true);
      setProgress(15);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Avance doucement tant que la page n'est pas là.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setProgress((p) => (p < 90 ? p + (90 - p) * 0.12 : p)), 200);
    return () => clearInterval(t);
  }, [active]);

  if (!active) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[100] h-[3px] pointer-events-none" role="progressbar" aria-label="Chargement de la page">
      <div className="h-full bg-primary shadow-[0_0_8px_var(--primary)] transition-[width] duration-200 ease-out" style={{ width: `${progress}%` }} />
    </div>
  );
}
