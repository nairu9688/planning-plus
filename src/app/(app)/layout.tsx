import { requireUser } from "@/lib/data/auth";
import { QuickAddProvider } from "@/components/shell/quick-add";
import { BottomTabs, Sidebar } from "@/components/shell/nav";
import { CommandPalette, type SearchEntry } from "@/components/shell/command-palette";
import { AutoSync } from "@/components/shell/auto-sync";
import { NavigationProgress } from "@/components/shell/navigation-progress";
import { Suspense } from "react";
import { loadDs, loadKholles } from "@/lib/data/exams";
import { formatDayShort } from "@/lib/format";

export const dynamic = "force-dynamic";
// La synchro Google lancée par « Synchroniser » peut dépasser la limite par défaut.
export const maxDuration = 60;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, ctx } = await requireUser();
  const from = new Date(Date.now() - 30 * 86_400_000);
  const [ds, kholles, { data: homework }] = await Promise.all([
    loadDs(supabase, user.id, { from }),
    loadKholles(supabase, user.id, { from }),
    supabase.from("homework").select("id, title, subject_id, due_at").eq("user_id", user.id).neq("status", "fait").limit(200),
  ]);
  const color = (id: string | null) => (id ? ctx.subjectById.get(id)?.color : undefined);
  const entries: SearchEntry[] = [
    ...(homework ?? []).map((h) => ({ label: h.title, hint: h.due_at ? `Devoir · ${formatDayShort(h.due_at)}` : "Devoir", href: `/devoirs?id=${h.id}`, color: color(h.subject_id) })),
    ...ds.map((d) => ({ label: d.event.title, hint: `DS · ${formatDayShort(d.event.start_at)}`, href: `/ds/${d.id}`, color: color(d.subject_id) })),
    ...kholles.map((k) => ({ label: k.event.title, hint: `Khôlle · ${formatDayShort(k.event.start_at)}`, href: `/kholles/${k.id}`, color: color(k.subject_id) })),
    ...ctx.subjects.map((s) => ({ label: s.name, hint: "Matière", href: `/matieres/${s.key}`, color: s.color })),
  ];

  return (
    <QuickAddProvider subjects={ctx.subjects}>
      <Sidebar />
      <div className="md:pl-[72px] min-h-dvh">
        <main className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pt-5 pb-28 md:pb-10">{children}</main>
      </div>
      <BottomTabs />
      <CommandPalette entries={entries} />
      <AutoSync />
      <Suspense>
        <NavigationProgress />
      </Suspense>
    </QuickAddProvider>
  );
}
