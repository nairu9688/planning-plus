# Décisions et précisions par rapport à la spec

Ces points priment sur `docs/SPEC.md`.

## Infrastructure
- **Cron** : Vercel Hobby ne permet qu'un cron par jour. Les déclenchements toutes les 15 min (synchro Google, génération des sessions, notifications) sont faits par **Supabase `pg_cron` + `pg_net`**, qui appellent `POST /api/cron/tick` avec `Authorization: Bearer <CRON_SECRET>`. L'URL de l'app et le secret sont stockés dans Supabase Vault (`app_url`, `cron_secret`).
- **API Google** : appels REST directs via `fetch` (pas de SDK `googleapis`, trop lourd et avec des dépendances vulnérables).
- **Accès** : application mono-utilisateur. Seules les adresses de `ALLOWED_EMAILS` (par défaut `nanigeek@gmail.com`) peuvent se connecter.

## Données Google
- ID du calendrier « Khôlles » pré-rempli : `2ebdf9d39ed676e10f6e2416f216698565c2bb8014cb56b913a429ffd3e12ebc@group.calendar.google.com`.
- **Semaine A** : la semaine du lundi 23/11/2026 est une semaine A (déduit des cours du samedi 28/11 marqués « semaine A »). `week_a_reference_date = 2026-11-23`.
- Classification « cours » : seulement si le titre est reconnu par mot-clé. Un événement reconnu par sa seule couleur garde la matière mais reste `autre`.
- Khôlles « Lettres & Philo (X) » : (Gay) → lettres ; sinon le mot « Philo » l'emporte → philo. Corrigeable par override.
- Le prof d'une khôlle est extrait des parenthèses du titre (« Khôlle Gestion (Roudière) » → Roudière).

## Règles métier
- **Compte à rebours** : un week-end dont le samedi est en vacances n'est pas compté comme « WE » mais dans les jours de vacances. Les jours de vacances comptés sont ceux non encore terminés et commencés avant l'épreuve.
- **Vacances zone C 2026-2027** (dernier jour sans cours inclus) : Toussaint 17/10–01/11, Noël 19/12–03/01, Hiver 06/02–21/02, Printemps 03/04–18/04, pont de l'Ascension 06/05–09/05, Été à partir du 03/07.
- **Jauge de préparation** : moyenne pondérée vu 0,33 / revu 0,66 / maîtrisé 1 (la formule pondérée de la spec l'emporte sur « part des revu/maîtrisé »).
- **Cible d'un élément de session** : prochain DS / khôlle de la matière **après le début de la session**.
- **Suppression d'une session générée** : elle passe en `ignoree` (masquée) au lieu d'être supprimée, pour ne pas être régénérée.
- « Travaillé pour X sur 7 j » : sessions commencées dans les 7 derniers jours et pas dans le futur ; éléments retirés au bilan exclus.

## Process
- À la demande de Naïm, les 4 phases sont enchaînées sans validation intermédiaire.
