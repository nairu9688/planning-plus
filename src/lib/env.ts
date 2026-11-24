function req(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export const env = {
  supabaseUrl: () => req("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => req("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  serviceRoleKey: () => req("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  googleClientId: () => req("GOOGLE_CLIENT_ID", process.env.GOOGLE_CLIENT_ID),
  googleClientSecret: () => req("GOOGLE_CLIENT_SECRET", process.env.GOOGLE_CLIENT_SECRET),
  tokenEncryptionKey: () => req("TOKEN_ENCRYPTION_KEY", process.env.TOKEN_ENCRYPTION_KEY),
  cronSecret: () => req("CRON_SECRET", process.env.CRON_SECRET),
  vapidPublicKey: () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: () => process.env.VAPID_PRIVATE_KEY ?? "",
  allowedEmails: () =>
    (process.env.ALLOWED_EMAILS ?? "nanigeek@gmail.com")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  appUrl: () => process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
};

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/tasks",
];
