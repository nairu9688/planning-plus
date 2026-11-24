# Mise en route de Planning+

État au 24/11/2026 :

| Élément | État |
|---|---|
| Projet Supabase `planning-plus` (FinTrack, eu-west-3) | ✅ créé : `hsigepvbdfdchokfyaji` |
| Migrations + RLS + pg_cron (toutes les 15 min) | ✅ appliquées |
| Vault : `app_url`, `cron_secret` | ✅ créés |
| Projet Vercel `planning-plus` relié au repo | ✅ https://planning-plus-naim1.vercel.app |
| Variables Vercel : Supabase URL/anon, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, VAPID, `ALLOWED_EMAILS`, `APP_URL` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ⏳ à ajouter (étape 3) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ⏳ à créer (étapes 1-2) |

## 1. Client OAuth Google (console.cloud.google.com)

1. Crée un projet « Planning+ ».
2. **API et services → Bibliothèque** : active **Google Calendar API** et **Google Tasks API**.
3. **Écran de consentement OAuth** : type *Externe*, nom « Planning+ », ton adresse en contact.
   - Champs d'application : `.../auth/calendar.readonly`, `.../auth/calendar.app.created`, `.../auth/tasks` (+ `openid`, `email`, `profile`).
   - Utilisateurs test : `nanigeek@gmail.com`.
   - Puis **Publier l'application** → statut **« En production »** (sans validation). Sinon le refresh token expire au bout de 7 jours. Google affichera « application non validée » à la connexion : clique *Paramètres avancés → Accéder à Planning+*.
4. **Identifiants → Créer → ID client OAuth** → *Application Web* :
   - Origine JavaScript autorisée : `https://planning-plus-naim1.vercel.app`
   - URI de redirection autorisé : `https://hsigepvbdfdchokfyaji.supabase.co/auth/v1/callback`
5. Note l'**ID client** et le **code secret**.

## 2. Supabase → Authentication

Dashboard : https://supabase.com/dashboard/project/hsigepvbdfdchokfyaji

1. **Sign In / Providers → Google** : active, colle l'ID client et le secret.
2. **URL Configuration** :
   - Site URL : `https://planning-plus-naim1.vercel.app`
   - Redirect URLs : `https://planning-plus-naim1.vercel.app/auth/callback` et `http://localhost:3000/auth/callback`
3. (Conseillé) **Sign In / Providers → Email** : désactive l'inscription par email (seul Google sert).

## 3. Vercel → Settings → Environment Variables

Projet : https://vercel.com/naim1/planning-plus/settings/environment-variables

| Clé | Valeur | Où la trouver |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` | Supabase → Project Settings → API Keys |
| `GOOGLE_CLIENT_ID` | ID client | étape 1 |
| `GOOGLE_CLIENT_SECRET` | secret | étape 1 |

Type **Sensitive**, environnements Production + Preview. Puis **Deployments → … → Redeploy**.

## 4. Premier lancement

1. Ouvre https://planning-plus-naim1.vercel.app et connecte-toi avec Google (accepte les 3 autorisations).
2. La première synchro démarre en arrière-plan ; bouton « Synchroniser » sur le tableau de bord ou dans Réglages.
3. Vérifie : cours / DS / khôlles de la semaine aux bonnes couleurs, calendrier « Planning+ » créé, liste Tasks « Prépa » créée.
4. iPhone : Safari → Partager → **Sur l'écran d'accueil**, ouvre l'app depuis l'icône, puis Réglages → Notifications → **Activer sur cet appareil**.

## Développement local

```bash
cp .env.example .env.local   # puis remplis les valeurs
npm install
npm run dev
```

```bash
npm test
```

Les migrations SQL sont dans `supabase/migrations/` (appliquées sur le projet distant).
