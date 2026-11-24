# Planning+

Web app personnelle (un seul utilisateur) de suivi du travail en prépa ECT : tableau de bord Google Calendar, devoirs, DS/CB, khôlles, Study Planner.

**La spécification de référence est [`docs/SPEC.md`](docs/SPEC.md). Lis-la avant toute modification.**
Les écarts et précisions décidés depuis sont dans [`docs/DECISIONS.md`](docs/DECISIONS.md) : ils priment sur la spec.

## Stack
- Next.js 15 (App Router, TypeScript, Server Actions), déployé sur Vercel.
- Supabase (Postgres + Auth Google + RLS). Projet `planning-plus`, organisation FinTrack.
- Tailwind CSS v4, icônes Lucide. Composants UI maison dans `src/components/ui` (style shadcn).
- Dates : `@date-fns/tz`, tout en **Europe/Paris** (stockage `timestamptz`).
- Tests : Vitest (`npm test`).

## Organisation du code
- `src/lib/domain/` — logique métier **pure et testée** (compte à rebours, classification, génération des sessions, cibles, jauge). Pas d'accès réseau/BDD ici.
- `src/lib/google/` — clients REST Google (Calendar, Tasks), OAuth et refresh des tokens.
- `src/lib/sync/` — synchro lecture (calendriers → `calendar_events`) et écriture (devoirs → Tasks, sessions → calendrier « Planning+ »).
- `src/lib/supabase/` — clients Supabase (navigateur, serveur, service role).
- `src/app/(app)/` — écrans authentifiés ; `src/app/api/` — routes (cron, API v1, MCP).
- `supabase/migrations/` — migrations SQL versionnées (RLS sur toutes les tables).

## Règles
- Interface en français, ton direct, sentence case.
- Toute nouvelle règle métier va dans `src/lib/domain` avec ses tests **écrits avant** l'implémentation.
- Jamais de `new Date().getHours()` etc. : utiliser les helpers de `src/lib/domain/time.ts` (Paris).
- Secrets uniquement en variables d'environnement (voir `.env.example`). Les tokens Google sont chiffrés (AES-256-GCM, `TOKEN_ENCRYPTION_KEY`) et lisibles uniquement via la service role.
- Planning+ est la source de vérité : seul le cochage d'une tâche Google Tasks remonte.

## Commandes
- `npm test` — tests unitaires
- `npm run typecheck` — TypeScript
- `npm run build` — build de production
