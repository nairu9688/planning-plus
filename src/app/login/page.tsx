import { LoginButton } from "./login-button";

export const metadata = { title: "Connexion · Planning+" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <main className="min-h-dvh grid place-items-center p-6 bg-bg">
      <div className="w-full max-w-sm card p-8 text-center space-y-6">
        <div className="mx-auto size-14 rounded-2xl bg-primary text-on-primary grid place-items-center text-2xl font-semibold">
          P+
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Planning+</h1>
          <p className="text-sm text-muted">Devoirs, DS, khôlles et sessions de travail, au même endroit.</p>
        </div>
        {error && <p className="text-sm rounded-xl bg-danger/10 text-danger px-3 py-2">{error}</p>}
        <LoginButton next={next} />
        <p className="text-xs text-muted">
          Accès lecture à Google Agenda, création du calendrier « Planning+ » et gestion de Google Tasks.
        </p>
      </div>
    </main>
  );
}
