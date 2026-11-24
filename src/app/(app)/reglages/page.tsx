import { requireUser } from "@/lib/data/auth";
import { PageHeader } from "@/components/ui/misc";
import { env } from "@/lib/env";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const { supabase, ctx, user } = await requireUser();
  const { data: tokens } = await supabase
    .from("api_tokens")
    .select("id, name, token_prefix, last_used_at, created_at")
    .eq("user_id", ctx.userId)
    .order("created_at");
  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Réglages" subtitle={user.email ?? undefined} />
      <SettingsView
        settings={ctx.settings}
        subjects={ctx.subjects}
        rules={ctx.rules}
        holidays={ctx.holidays}
        tokens={tokens ?? []}
        vapidPublicKey={env.vapidPublicKey()}
        appUrl={env.appUrl()}
      />
    </div>
  );
}
