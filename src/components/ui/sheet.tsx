"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

/** Bottom sheet sur iPhone, fenêtre centrée sur desktop. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <button aria-label="Fermer" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          "relative w-full bg-surface border border-border shadow-xl",
          "rounded-t-[20px] sm:rounded-[16px] max-h-[92dvh] overflow-y-auto pb-safe",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-center justify-between px-5 pt-3 sm:pt-4 pb-2 sticky top-0 bg-surface z-10">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost h-8 w-8 p-0" aria-label="Fermer">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}
