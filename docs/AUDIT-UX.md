# Audit praticité / UX — 26/11/2026

Point de départ : test du 25/11 au soir (Focus libre qui crée des sessions, « Mathématiques » qui revient partout). Relecture de tous les parcours du soir (Ce soir → Focus → bilan), des devoirs, du Planner, des gestes et des messages d'erreur, plus l'état réel de la base.

## Corrigé et déployé

| # | Problème constaté | Correction |
|---|---|---|
| 1 | Focus libre : créait une nouvelle session « libre » même avec une étude en cours (2 sessions parasites le 25/11) | Le Focus libre **s'ajoute à la session du soir** : en cours, ou 30 min avant → 1 h 30 après, même si le bilan est fait. Session « Focus libre » créée seulement s'il n'y a rien, puis réutilisée 3 h. Règle testée (`domain/focus-host.ts`). |
| 2 | Même matière relancée : un élément en double à chaque fois | Le chrono reprend l'élément de la même matière déjà présent dans la session. |
| 3 | Page Focus bloquée sur l'élément en cours (« ça me remettait mathématiques ») | Pastilles de matières cliquables **à tout moment** (le chrono bascule), bouton **Autre matière**, minutes déjà faites affichées. La pastille du chrono ouvre le Focus. |
| 4 | Chrono d'économie (Anki) resté ouvert toute la nuit | Plafond : fin de session + 30 min (4 h hors session) ; le cron arrête les chronos oubliés. |
| 5 | Formulaires avec « Mathématiques » présélectionné (bilan « en plus », ajout d'élément) | Aucune matière par défaut, choix obligatoire. |
| 6 | Erreurs serveur illisibles en production (« An error occurred in the Server Components… ») | Messages en français ; validations faites côté téléphone (titre, minutes, matière). |
| 7 | Glisser un devoir « ce soir » : échec silencieux s'il n'y a pas de session, et on ne sait pas où il est allé | « Ajouté à ta session de ce soir 20h00 » ; message clair sinon ; sport exclu. |
| 8 | Pas d'annulation après avoir glissé un devoir en « fait » | Bouton **Annuler** dans la confirmation. |
| 9 | Bilan : une durée tapée puis « Valider » tout de suite pouvait être perdue | Les durées saisies partent avec la validation. |
| 10 | « Ce soir » proposait « Lancer le Focus » après le bilan | « Voir le bilan ». Les éléments du Focus libre affichent leurs minutes réelles (avant : 0 min). |
| 11 | Session 22h → 0h30 refusée | Acceptée : fin le lendemain. |
| 12 | Page session : type affiché « etude » | « étude », et minutes faites par élément. |
| 13 | Devoirs sur iPhone : matière invisible, filtres sur 4 lignes | Pastille de couleur, filtres sur une ligne défilante. |
| 14 | Badge « 1 » sur tous les cours de maths (25/11) | Badge seulement sur le cours où le devoir est à rendre. |
| 15 | Déconnexions (détection de réutilisation du jeton) | Plus de renouvellement de session pendant un préchargement de page. |

Données corrigées à la main : les 2 sessions « Focus libre » du 25/11 ont été fusionnées dans l'étude 20h–21h50 (éléments déplacés, sessions retirées du calendrier) ; le chrono Anki (éco) oublié a été arrêté à 21h50, soit **72 min** : à ajuster dans le bilan du 25/11 si c'est faux.

## Validé le 26/11 et réalisé

1. **Déconnexions** : réglage Supabase à couper par toi si ça se reproduit (Authentication → Sessions, « Detect and revoke potentially compromised refresh tokens ») — je n'ai pas accès à ce réglage.
2. **Bouton +** : pendant une session de travail (jusqu'à 30 min après), il ouvre l'onglet **Focus**.
3. **Pomodoro** dans le Focus : « Sans pause », 25/5 ou 50/10 (mémorisé). À la fin du bloc, le chrono s'arrête, compte à rebours de pause (non compté comme travail), puis « Reprendre ».
4. **Bilan à l'heure de fin** : notification dès la fin de chaque session de travail (cron toutes les 15 min), une seule fois par session.
5. **« Ce soir » vivant** : matière en cours, chrono à la seconde et bouton Stop dans le bloc.
6. **Réordonner** les éléments d'une session : poignée ⋮⋮ à glisser (doigt ou souris).
7. **Devoir en une ligne** : champ « Saisie rapide » (« maths exos 12-15 vendredi 30min urgent ») qui remplit matière, échéance, heure, durée, priorité ; règle testée (`domain/quick-homework.ts`).
