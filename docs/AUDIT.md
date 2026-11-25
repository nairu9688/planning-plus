# Audit Planning+ — 25/11/2026

## 1. Audit des problèmes

Sources : erreurs d'exécution Vercel (7 j), réponses HTTP du cron (Supabase `net._http_response`), avis sécurité/performance Supabase, état de la base, relecture du code.

| # | Problème | Gravité | État |
|---|---|---|---|
| 1 | « Synthèse N°x » et « Etude de cas … N°x » classés « autre » (pas de préfixe « DS ») | Haute | ✅ corrigé : toute épreuve « N°x » est un DS ; Synthèse → Droit, Étude de cas → Management |
| 2 | Synchro des sessions bloquée par un 404 Google (événement supprimé côté Google) ; un seul échec arrêtait toute l'étape | Haute | ✅ corrigé : l'événement / la tâche / le calendrier / la liste est recréé ; les échecs sont isolés par élément |
| 3 | Cron en 500 de 17h15 à 22h00 : `SUPABASE_SERVICE_ROLE_KEY` absente | Haute | ✅ résolu par l'ajout de la clé (200 depuis 22h15) |
| 4 | Messages d'erreur Google illisibles (URL + JSON brut dans le bandeau) | Moyenne | ✅ message court (« Google Agenda 404 (Not Found) »), détail dans les logs |
| 5 | « PMI Annualisation (Le Mintier) » classé « autre » (seul le prof est dans le titre) | Moyenne | ✅ reconnaissance par nom de prof en dernier recours |
| 6 | Blocs du tableau de bord qui débordent sur mobile (grilles sans `min-w-0`) | Moyenne | ✅ corrigé + vérifié en capture à 390 px |
| 7 | Heures formatées avec `hour12:false` : minuit peut s'afficher « 24:00 » selon le navigateur | Faible | ✅ `hourCycle: "h23"` |
| 8 | Génération des sessions : bornes de journée en UTC au lieu de Paris | Faible | ✅ |
| 9 | Classes Tailwind en conflit (ex. taille de case à cocher) résolues au hasard | Faible | ✅ `tailwind-merge` dans `cn()` |
| 10 | Synchro manuelle pouvant dépasser la durée max par défaut d'une fonction | Faible | ✅ `maxDuration = 60` |
| 11 | 19 index jamais utilisés (avis Supabase) | Info | ⏸ normal sur une base neuve, à revoir dans un mois |
| 12 | `google_accounts` et `notification_log` sans policy RLS | Info | ✅ voulu (service role uniquement) |

Risques restants, non bloquants :
- **Synthèse → Droit** est une hypothèse : si la synthèse relève d'une autre matière, corrige un événement (clic → « Corriger la classification ») ou dis-le-moi pour changer la règle.
- La règle « N°x = DS » classerait aussi un éventuel « Réunion N°2 » en DS (correction manuelle possible).
- Les widgets Scriptable ont été exécutés sur 70 combinaisons type × taille contre une imitation de l'API Scriptable, **pas sur un vrai iPhone** : le rendu exact (marges, tailles de police) est à valider à l'écran.
- `addItemFor` (API/MCP) ne vérifie pas la propriété d'un `subjectItemId` / `prepTaskId` passé à la main ; sans conséquence en mono-utilisateur.

## 2. Propositions — design

1. **Calendrier sur iPhone** : vue 3 jours par défaut sous 640 px (7 colonnes sont illisibles à 390 px), avec glissement gauche/droite pour changer de jours.
2. **Cohérence visuelle app ↔ widgets** : remplacer les barres des indicateurs du tableau de bord par les mêmes anneaux que les widgets (soirs restants + jauge de prépa).
3. **Bandeau « Maintenant »** en haut du tableau de bord : cours en cours / suivant avec minuteur, comme le widget.
4. **Couleurs Lettres / Philo** trop proches (deux verts) : proposer un vert sauge et un bleu-vert distincts, ou un motif.
5. **Gestes sur mobile** : glisser un devoir vers la droite pour le cocher, vers la gauche pour le planifier ce soir.
6. **Retour visuel de réussite** : petite animation au cochage d'un devoir et au bilan validé ; série 🔥 visible dans l'en-tête.
7. **Planner en glisser-déposer** : déplacer un élément d'une session à l'autre, réordonner.
8. **Vue « semaine type »** : le planning du tableau de bord en mode compact (heures resserrées 8h–19h + soirée).

## 3. Propositions — fonctionnalités

1. **Révisions espacées** : pour chaque chapitre travaillé, proposer automatiquement des révisions à J+1, J+3, J+7, J+21 dans les sessions libres (utilise `last_worked_at`).
2. **Remplissage automatique des sessions** : bouton « Remplis ma semaine » qui répartit devoirs (par échéance et durée estimée), préparations de DS proches peu avancées et matières délaissées dans les créneaux disponibles — tu valides ou ajustes.
3. **Rappel de préparation de khôlle** : lire « Préparation : 17h10 » dans la description et notifier 30 min avant la prépa (pas seulement la veille).
4. **Objectifs hebdomadaires par matière** (heures cibles) avec progression sur le tableau de bord et dans le widget `semaine`.
5. **Moyennes pondérées** par les coefficients BCE / ECRICOME ECT + simulateur « quelle note au prochain DS pour atteindre X ».
6. **Copies et corrigés** : joindre photos/PDF de copies et corrigés à un DS (Supabase Storage), avec les erreurs à retenir.
7. **Mode veille de DS** : la veille, une checklist générée (programme, « à faire avant », fiches liées, horaires/salle).
8. **Pomodoro dans le mode Focus** (25/5 ou 50/10) avec pauses comptées à part dans le bilan.
9. **Résumé hebdomadaire par Claude** via le serveur MCP : bilan écrit + plan de la semaine suivante, envoyé le dimanche soir.
10. **Mode hors ligne** de la PWA : cache des dernières pages vues pour consulter devoirs et EDT sans réseau.
