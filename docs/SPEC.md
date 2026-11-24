# Planning+ — Spécification produit et technique

> Document de passation pour Claude Code. À placer à la racine du repo sous `docs/SPEC.md` (et à référencer depuis `CLAUDE.md`).
> Rédigé le 24 novembre 2026, à partir de la session de design avec Naïm.

## 1. Contexte et objectif

Naïm est en CPGE ECT1 (Notre-Dame du Grandchamp, Versailles), il prépare BCE / ECRICOME (session avril 2028). Son emploi du temps (cours, DS) est dans Google Calendar, ses khôlles dans un calendrier Google dédié « Khôlles ». Google Calendar / Tasks sont trop limités pour suivre devoirs, révisions et préparation des DS.

**Planning+** est une web app personnelle (un seul utilisateur) qui :
- lit son Google Calendar et le présente sous forme de **tableau de bord** pour ne rien rater ;
- gère **devoirs**, **DS / concours blancs**, **khôlles**, **post-its**, **liens** ;
- contient un **Study Planner** : planifier ses sessions de travail, les remplir (devoirs, révisions), faire le **bilan** prévu vs réel, et relier ce travail à la préparation du prochain DS ou de la prochaine khôlle ;
- pousse devoirs vers Google Tasks et sessions vers un calendrier Google « Planning+ », mais **le suivi se fait dans Planning+** (source de vérité).

Langue de l'interface : **français**. Fuseau : **Europe/Paris** partout (stocker en `timestamptz`, afficher en Europe/Paris).

## 2. Stack

- **Next.js** (App Router, TypeScript, Server Actions / Route Handlers), déployé sur **Vercel**.
- **Supabase** : Postgres, Auth, RLS. Nouveau projet **`planning-plus`** dans l'organisation Supabase **fintrack**.
- UI : Tailwind CSS + shadcn/ui, icônes Lucide, police sans-serif (Inter ou Geist). Calendrier : composant maison (grille semaine/jour) ou FullCalendar si plus rapide, mais stylé au design system.
- **PWA** installable sur iPhone (manifest, icônes, service worker) — nécessaire pour les notifications push iOS (iOS ≥ 16.4, app ajoutée à l'écran d'accueil).
- Cron : **Vercel Cron** (synchro Google toutes les 15 min, notifications).
- Push : Web Push (VAPID), lib `web-push`.

## 3. Design system

- Look **SaaS moderne** : barre latérale à icônes (desktop), barre d'onglets en bas (iPhone), cartes arrondies (radius 14–16 px), bordures fines, pas d'ombres lourdes, beaucoup d'air, pastilles/chips arrondies.
- **Couleur principale : bleu marine.** Clair : `#1B2A4A` (primaire), hover `#24365E`, tint `#E8EDF7`. Sombre : primaire `#7C9CE0`, tint `rgba(124,156,224,0.15)`. Le marine est réservé à l'interface (navigation, boutons, sessions de travail).
- **Thème clair + thème sombre** dès la phase 1 : suit le système par défaut, forçable dans Réglages.
- Couleurs matières = couleurs Google Calendar (section 4), utilisées en pastilles, bordure gauche des événements, fonds teintés à ~18 % d'opacité.
- Codes visuels du calendrier : cours = fond teinté + bordure gauche couleur matière ; **DS / khôlle** = idem + contour marqué et texte en gras ; **session** = hachures marine ; **suggestion** = contour pointillé, à accepter/retirer ; badge rouge sur un cours = nombre de devoirs non faits de cette matière.
- Saisie rapide partout : bouton « + Nouveau » global (devoir / session / post-it / lien), raccourci ⌘K (palette de commandes), clic sur un créneau du calendrier = menu avec date/heure pré-remplies. Sur iPhone, formulaires en **bottom sheet**.

## 4. Matières

| Clé | Nom affiché | Prof | Google colorId | Couleur |
|---|---|---|---|---|
| `maths` | Mathématiques | Le Mintier | 11 (Tomate) | `#D50000` |
| `eco` | Économie | Jacquier | 5 (Banane) | `#F6BF26` |
| `droit` | Droit | Huguet | 9 (Myrtille) | `#3F51B5` |
| `management` | Management | Jacques | 3 (Raisin) | `#8E24AA` |
| `anglais` | Anglais | Defrance | 7 (Paon) | `#039BE5` |
| `espagnol` | Espagnol | Mayoral | 6 (Mandarine) | `#F4511E` |
| `lettres` | Lettres | Gay | 10 (Basilic) | `#33B679` |
| `philo` | Philosophie | Cervellon | 10 (Basilic) | `#0B8043` |

Règles de reconnaissance d'un événement Google → matière (dans cet ordre) :
1. Override manuel stocké (`event_overrides.subject_id`) s'il existe.
2. Mots-clés du titre : « Math » → maths ; « Econ »/« Éco »/« ESH » → eco ; « Droit » → droit ; « Management »/« Gestion » → management ; « Anglais »/« LV1 » → anglais ; « Espagnol »/« LV2 » → espagnol ; « Philo » → philo ; « Gay » ou « Lettres » sans « Philo » → lettres ; « Lettres & Philosophie (Gay) » → lettres, « (Cervellon) » → philo.
3. Sinon `colorId` (10 → philo par défaut).
4. Sinon `null` (événement « autre »).

Les matières sont éditables dans Réglages (nom, couleur, prof, ordre). Les khôlles de Gestion se rattachent à **Management**.

## 5. Données Google : lecture et écriture

### OAuth
- Connexion via Supabase Auth (provider Google) **et** stockage séparé des tokens Google (access + refresh) dans `google_accounts` (chiffrés, accès service role uniquement) pour que le cron puisse synchroniser sans session ouverte.
- Scopes : `calendar.readonly`, `calendar.app.created` (créer/gérer le calendrier « Planning+ »), `tasks`.
- Passer l'app OAuth Google en statut **« In production »** (non vérifiée, usage personnel) pour éviter l'expiration des refresh tokens à 7 jours du mode « Testing ».

### Lecture (cron toutes les 15 min + à l'ouverture de l'app + bouton « Synchroniser »)
- Calendriers lus : principal (`nanigeek@gmail.com`) et « Khôlles » (id configurable dans Réglages). Fenêtre : J-60 → fin d'année scolaire (début juillet).
- Upsert dans `calendar_events` (clé : `google_calendar_id` + `google_event_id`), suppression des annulés.
- Classification `kind` :
  - calendrier Khôlles → `kholle` ;
  - titre commençant par « DS » → `ds` (numéro extrait de « N°x », mention « CB » détectée) ;
  - événements Google Tasks (eventType `FOCUS_TIME` avec `taskId`) → ignorés (ce sont les devoirs eux-mêmes) ;
  - événements du calendrier « Planning+ » → ignorés (ce sont nos sessions) ;
  - sinon titre de cours connu → `cours` ; sinon `autre`.
- Les infos de khôlle (heure de préparation, salle) sont dans la description / location : les afficher telles quelles.

### Écriture
- **Devoirs → Google Tasks**, liste « Prépa » (créée si absente) : titre `[Matière] Titre`, notes = description + lien Planning+, due = échéance. Mise à jour/suppression répercutées.
- **Retour unique** : si une tâche est cochée dans Google Tasks, le devoir passe à « fait » dans Planning+ (vérifié à chaque synchro).
- **Sessions → calendrier Google « Planning+ »** (créé par l'app) : seulement les sessions confirmées (pas les suggestions). Titre = « Session · étude » etc., description = liste des éléments prévus.
- Planning+ est la source de vérité : une modification faite dans Google sur ces objets (hors cochage de tâche) est écrasée à la synchro suivante.

## 6. Modèle de données (Supabase)

Toutes les tables ont `id uuid pk`, `user_id uuid` (RLS : `user_id = auth.uid()`), `created_at`, `updated_at`.

- `subjects` — key, name, color, teacher, google_color_id, sort_order.
- `subject_items` — « éléments » d'une matière : subject_id, type (`chapitre` | `ds` | `course_material` | `autre`, types personnalisables), title, number, description, archived, last_worked_at (dérivé).
- `calendar_events` — google_calendar_id, google_event_id, kind (`cours`|`ds`|`kholle`|`autre`), subject_id, title, location, description, start_at, end_at, raw jsonb.
- `event_overrides` — calendar_event_id, subject_id, kind (corrections manuelles de classification).
- `cb_periods` — name (« CB décembre »), notes. Une période = ensemble de DS.
- `ds` — calendar_event_id (unique), subject_id, number, cb_period_id nullable, grade numeric nullable, grade_max default 20, notes.
- `kholles` — calendar_event_id (unique), subject_id, teacher, grade nullable, notes.
- `prep_topics` — chapitres au programme d'un DS ou d'une khôlle : target_type (`ds`|`kholle`), target_id, subject_item_id nullable, title, status (`a_voir`|`vu`|`revu`|`maitrise`).
- `prep_tasks` — « à faire avant » un DS / une khôlle : target_type, target_id, title, description, done. (ex. « Retravailler le DS4 »). Sélectionnables comme éléments de session.
- `kholle_questions` — kholle_id, question, status (`a_revoir`|`ok`).
- `homework` — subject_id, title, description, due_at, estimated_minutes, priority (`basse`|`normale`|`haute`), status (`a_faire`|`en_cours`|`fait`), done_at, google_task_id, related_event_id nullable (cours concerné).
- `study_sessions` — date, start_at, end_at, kind (`etude`|`maison`|`suggestion`|`bibliotheque`|`sport`|`libre`), status (`suggeree`|`prevue`|`ignoree`|`bilan_fait`), location, notes, google_event_id, generated_by_rule (pour ne pas régénérer une session supprimée).
- `session_items` — session_id, item_type (`homework`|`revision`|`prep_task`|`sport`), homework_id, subject_id, subject_item_id, prep_task_id, description, planned_minutes, actual_minutes, done, origin (`prevu`|`ajoute_au_bilan`), removed_in_review bool, target (`next_ds`|`next_kholle`|`none`), target_ds_id, target_kholle_id (résolus à l'enregistrement : prochain DS/khôlle **de la matière de l'élément**), sort_order.
- `session_reviews` — session_id, reviewed_at, planned_snapshot jsonb (copie figée du prévu), comment.
- `focus_logs` — session_item_id, started_at, ended_at (chrono du mode Focus).
- `notes` (post-its) — content, color, pinned, done, due_at nullable.
- `links` — url, label, target_type (`subject`|`subject_item`|`ds`|`cb_period`|`kholle`|`homework`|`prep_task`|`global`), target_id. Les liens vers l'artefact « Corrigés DS maths » se créent ainsi (à la main).
- `settings` — theme, week_a_reference_date, kholles_calendar_id, evening rules (heures étude/maison), suggestion slot, notification prefs, school holidays (liste de périodes, pré-remplie zone C 2026-2027).
- `push_subscriptions`, `api_tokens` (phase 4, hash du token, scopes).

## 7. Règles métier

### Sessions automatiques (générées sur 3 semaines glissantes, idempotent via `generated_by_rule` + date)
- **Lundi → vendredi soir** : session `etude` 20h00–21h50, statut `prevue`. Interrupteur **étude / maison** sur la session : `maison` = 21h00–23h00 (les éléments sont conservés).
- **Créneau suggestion** lundi → vendredi 17h20–19h00, statut `suggeree`, **uniquement si aucun événement (khôlle, cours, DS) ne chevauche ce créneau**. Accepter → `prevue` (heures ajustables) ; retirer → `ignoree` (non régénérée).
- **Dimanche** : suggestion `sport` 9h–10h et session `bibliotheque` 10h–19h (suggérée, à accepter/ajuster).
- **Samedi** : rien d'automatique.
- **Vacances scolaires** : pas de génération automatique (sessions créées à la main).
- Toutes les heures de ces règles sont éditables dans Réglages.

### Compte à rebours « temps de révision restant » (DS, période de CB, khôlle)
Calculé de maintenant jusqu'au début de l'épreuve (vraie date et heure, les DS ne sont pas toujours le lundi : en période de CB il y a des DS le mardi, et certains DS sont l'après-midi) :
- **Soirs de semaine** = nombre de jours lundi→vendredi (hors vacances) dont le soir (20h00) est après maintenant et avant le début de l'épreuve. Le lundi soir compte.
- **Week-ends** = nombre de week-ends (sam+dim) dont le dimanche 23h59 est après maintenant et dont le samedi 00h00 est avant l'épreuve (le week-end en cours compte s'il n'est pas fini).
- **Jours de vacances** = jours de vacances scolaires entre les deux, affichés à part s'il y en a.
- Affichage : « 4 soirs · 1 WE » (+ « · 3 j de vacances »).
- Exemple de contrôle : le mardi 24/11/2026 à 16h, pour le DS Philosophie N°2 du lundi 30/11 à 8h → **4 soirs · 1 WE**. Pour le CB du 14/12 → **14 soirs · 3 WE**.

### Concours blancs
- Sur la page d'un DS : case « Fait partie d'un concours blanc » → choisir/créer une `cb_period`. Le tableau de bord affiche la période (dates, épreuves) avec son propre compte à rebours jusqu'à sa première épreuve.
- Pré-détection : un DS dont le titre contient « CB » ou qui tombe un mardi est proposé comme candidat CB (suggestion, pas d'association automatique).

### Préparation (lien sessions ↔ DS / khôlles)
- Chaque élément de session (révision, devoir, tâche de DS) a un `target` : prochain DS de sa matière, prochaine khôlle de sa matière, ou rien. Valeur par défaut proposée : le plus proche des deux dans le temps.
- « Travaillé pour X sur les 7 derniers jours » = somme des `actual_minutes` (ou `planned_minutes` si pas de bilan) des éléments ciblant X dont la session est dans les 7 derniers jours.
- **Jauge de préparation** d'un DS = part des `prep_topics` en statut `revu` ou `maitrise` (pondération : vu 0,33 / revu 0,66 / maîtrisé 1).
- Une révision liée à un `subject_item` met à jour son `last_worked_at`.

### Bilan
- Bouton « Bilan » disponible dès la fin de la session (et le lendemain). À l'ouverture : on fige `planned_snapshot`, puis l'utilisateur modifie, ajoute (`origin = ajoute_au_bilan`), supprime (`removed_in_review`), coche fait/pas fait, ajuste les durées réelles (pré-remplies par le chrono Focus s'il a servi). Valider → session `bilan_fait`. Cocher un devoir dans le bilan le passe à « fait ».
- Les stats « prévu vs réel » se basent sur snapshot vs état final.

### Semaine A / B
- Calculée depuis `settings.week_a_reference_date` (parité de semaine ISO). Affichée dans l'en-tête.

## 8. Écrans

1. **Tableau de bord** (accueil) — en-tête (salutation, date, semaine A/B, recherche ⌘K, « + Nouveau ») ; rangée d'indicateurs : prochain DS (compte à rebours + jauge), prochaine période de CB, prochaine khôlle (+ temps de prépa sur 7 j), travail de la semaine (réel / prévu, % de la semaine passée) ; carte **Ce soir** (interrupteur étude/maison, éléments en chips, boutons Focus et Bilan) ; **Post-its** ; **Échéances des 3 prochaines semaines** (DS, khôlles, devoirs, avec temps travaillé sur 7 j pour chaque DS/khôlle) ; **Ce qui reste cette semaine** (devoirs, révisions planifiées non faites, tâches de DS) ; **Bilan de la semaine passée** ; **en dessous, le planning de la semaine** (grille lun→dim, 8h–23h).
2. **Calendrier** — vues jour / semaine (défaut) / mois / année. Badge « n devoirs » sur les cours. Clic sur créneau vide → menu (devoir, session, post-it). Vue année = heatmap du temps de travail réel + périodes de CB et vacances.
3. **Devoirs** — liste filtrable (matière, statut, échéance), groupée par échéance ; fiche devoir (bottom sheet) avec « Planifié dans la session du … ».
4. **Study Planner** — vue jours (liste de sessions par jour) ; création/édition de session ; ajout d'éléments (devoir existant ou nouveau, révision = matière + élément + description, tâche de DS) avec durée et cible ; barre de remplissage vs durée du créneau ; acceptation/retrait des suggestions.
5. **Mode Focus** — plein écran : élément en cours, chrono, « suivant », liens de l'élément.
6. **Bilan** — prévu (gauche) / réel éditable (droite) ; validation rapide.
7. **DS & CB** — liste de l'année ; page DS (programme + jauge, à faire avant, liens, temps travaillé jour par jour, note) ; page période de CB.
8. **Khôlles** — liste ; page khôlle (questions de cours, à faire avant, liens, note).
9. **Matières** — par matière : éléments (chapitres, DS, course materials…) avec temps passé et dernière révision ; liens.
10. **Revue du dimanche** — assistant en 3 étapes : bilan de la semaine écoulée → semaine à venir (DS, khôlles, devoirs dus) → remplir les sessions (suggestions de ce qui manque : devoirs non planifiés, DS proches peu préparés, matières délaissées).
11. **Stats** (phase 3) — temps par matière/semaine, prévu vs réel, matières délaissées, notes et moyennes.
12. **Réglages** — thème, matières, calendriers, règles horaires, vacances, semaine A, notifications, tokens API.

## 9. Phases et critères d'acceptation

### Phase 1 — Socle et tableau de bord
Projet Supabase `planning-plus` (org fintrack) + migrations + RLS ; app Next.js sur Vercel ; connexion Google ; synchro lecture ; classification des événements et matières ; devoirs (CRUD, badge sur cours, création depuis bouton/calendrier/cours, sync Google Tasks + retour du cochage) ; calendrier 4 vues ; DS (périodes de CB, compte à rebours, à faire avant, liens, note) ; khôlles (page de base) ; post-its ; liens manuels ; tableau de bord (sans les parties dépendant des sessions) ; thèmes clair/sombre ; PWA.
**Accepté quand** : les cours, DS et khôlles de la semaine du 23/11/2026 s'affichent aux bonnes couleurs ; les comptes à rebours de l'exemple section 7 sont exacts ; un devoir créé apparaît dans Google Tasks et revient « fait » quand on le coche dans Google Tasks.

### Phase 2 — Study Planner
Génération des sessions ; interrupteur étude/maison ; suggestions ; éléments de matière ; éléments de session et cibles ; prep_topics + jauge ; mode Focus ; bilan ; revue du dimanche ; envoi des sessions vers le calendrier « Planning+ » ; complétion du tableau de bord (ce soir, prépa 7 j, reste de la semaine, semaine passée).

### Phase 3 — Stats et notifications
Page Stats ; alerte « matière délaissée depuis N jours » ; notes et moyennes ; heatmap annuelle ; notifications push : rappel bilan 22h00 (si session du soir sans bilan), veille de khôlle 19h, devoir dû demain, résumé du dimanche soir → revue.

### Phase 4 — Scriptable, raccourcis et MCP
- **API REST** authentifiée par token personnel (`api_tokens`) : `GET /api/v1/summary` (prochains DS/CB/khôlles, soirs restants, devoirs du jour, session de ce soir), `POST /api/v1/homework`, `POST /api/v1/notes`, `POST /api/v1/sessions/:id/mode` (étude/maison), `POST /api/v1/homework/:id/done`.
- **Widgets Scriptable** (petit, moyen, grand) consommant `/summary`, aux couleurs de l'app, avec actions rapides (ouvrir l'ajout de devoir, basculer étude/maison, ouvrir le bilan) via URL scheme / Raccourcis.
- **Raccourcis iOS** pour l'ajout express (« Ajoute un devoir de droit pour vendredi »).
- **Serveur MCP « Planning+ »** (Route Handler MCP en HTTP streamable dans l'app) exposant : lister échéances, créer/modifier/cocher un devoir, créer une session et ses éléments, faire le bilan d'une session, ajouter un post-it, consulter la préparation d'un DS.

## 10. Hors périmètre
Import Anki, import Google Classroom (explicitement refusés). Multi-utilisateur.

## 11. Consignes pour Claude Code
- Avancer phase par phase ; déployer sur Vercel à la fin de chaque phase et faire valider par Naïm avant la suivante.
- Migrations SQL versionnées (Supabase CLI) ; RLS activée sur toutes les tables ; secrets uniquement en variables d'environnement Vercel (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`).
- Tests unitaires obligatoires pour : classification des événements, compte à rebours (cas de la section 7, DS du mardi, DS de l'après-midi, vacances), génération des sessions (idempotence, chevauchement khôlle), résolution des cibles.
- Toutes les dates manipulées en Europe/Paris (date-fns-tz ou Temporal), attention au passage heure d'hiver/été.
- Interface en français, ton direct, sentence case.
