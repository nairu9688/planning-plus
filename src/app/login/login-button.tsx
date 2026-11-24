"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/tasks",
].join(" ");

export function LoginButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: SCOPES,
        // Refresh token indispensable pour la synchro en arrière-plan.
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button onClick={signIn} disabled={loading} className="btn btn-primary w-full h-11">
        {loading ? "Redirection…" : "Se connecter avec Google"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
