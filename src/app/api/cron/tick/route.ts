import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runAllSyncs } from "@/lib/sync/run";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Appelé toutes les 15 min par Supabase pg_cron (voir supabase/migrations/*_cron.sql). */
async function handle(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const reports = await runAllSyncs({ notifications: true });
  return NextResponse.json({ ok: reports.every((r) => r.ok), reports });
}

export const POST = handle;
export const GET = handle;
