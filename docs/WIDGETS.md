# Widgets iPhone (Scriptable)

Un seul script, [`scriptable/planning-plus-widget.js`](scriptable/planning-plus-widget.js), fournit tous les widgets. Le **paramètre** du widget choisit le type.

## Installation (une fois)

1. Installe **Scriptable** (App Store, gratuit).
2. Dans Planning+ : Réglages → Tokens API → crée un token « iPhone widgets » et copie-le.
3. Dans Scriptable : **+** → colle le contenu du script → renomme-le exactement **Planning+**.
4. Lance-le une fois (▶︎) : il demande l'URL (`https://planning-plus-two.vercel.app`) et le token, stockés dans le trousseau iOS. Le menu qui suit permet de **prévisualiser chaque widget dans chaque taille**.
5. Écran d'accueil → appui long → **+** → Scriptable → choisis la taille → touche le widget → Script : *Planning+*, **Parameter** : le type ci-dessous, « When interacting » : *Open URL* (laisser par défaut).

## Types de widgets

| Paramètre | Petit | Moyen | Grand / très grand |
|---|---|---|---|
| `tableau` (défaut) | anneau DS (soirs restants, jauge de prépa) + devoirs + ce soir | « Ce soir » en grand (bleu marine, barre par matière, Focus / étude↔maison) ; sinon anneaux DS + khôlle | direction A : maintenant / ensuite avec minuteur, bande de la journée, « Ce soir » en grand, anneaux DS / khôlle (+ CB / semaine en très grand), à rendre |
| `edt` | cours en cours / suivant | les prochains cours d'aujourd'hui | **emploi du temps dessiné sur 3 jours** (5 jours en très grand), couleurs des matières, sessions hachurées, ligne rouge « maintenant » |
| `maintenant` | cours en cours + suivant, minuteur en direct | idem | idem |
| `devoirs` | anneau « cette semaine », retards | 4 devoirs avec **bouton pour cocher** | 9 devoirs groupés (en retard, aujourd'hui, demain, plus tard) + bouton « Devoir » |
| `kholles` | prochaine khôlle (J-x, salle, préparation) | 2 khôlles | 4 khôlles : prof, salle, temps de prépa, questions à revoir |
| `ds` | grand anneau : soirs restants + jauge | DS suivant + celui d'après | liste des DS avec mini-jauges + carte concours blanc |
| `soir` | étude/maison, horaires, éléments | session + boutons **Étude↔Maison**, **Focus**, **Bilan** | tous les éléments |
| `semaine` | anneau réel/prévu + répartition par matière | anneau + histogramme par jour | + barres par matière, série 🔥, matières délaissées |
| `postits` | 1 post-it | 2 post-its | 6 post-its ; toucher = ranger |
| `actions` | 4 boutons | 4 boutons | 8 boutons : devoir, post-it, étude/maison, Focus, Bilan, synchro, calendrier, revue |

**Écran verrouillé** (même script, aucun paramètre nécessaire) : rond = soirs avant le prochain DS, rectangle = cours en cours/suivant (sinon ce soir), ligne = prochain DS + compte à rebours.

Design v2 (25/11) : mêmes anneaux qu'à l'app (chiffre = soirs restants, anneau = préparation), « Ce soir » sur fond bleu marine avec la barre de remplissage par matière, couleurs Philo / Management mises à jour.

## Écran d'accueil transparent ou teinté (style « verre »)

En mode transparent / teinté d'iOS, tout fond de couleur est repeint en blanc uni : les cartes deviennent des pavés blancs et leur texte disparaît. Le style **verre** dessine les cartes et les boutons par un contour, sans fond.

- Pour tous les widgets : lance le script dans Scriptable → « 🪟 Style : normal → passer en verre ».
- Pour un seul widget : ajoute `verre` au paramètre, ex. `tableau verre`, `edt verre` (ou `normal` pour forcer le style normal).

## Boutons

Les boutons qui *agissent* (cocher un devoir, basculer étude/maison, ranger un post-it, synchroniser, ajouter un devoir ou un post-it) relancent le script via `scriptable:///run/Planning%2B?action=…` : Scriptable s'ouvre une seconde, exécute l'action et confirme par une notification. Les autres ouvrent directement la bonne page de Planning+.

Le script garde en cache la dernière réponse : hors ligne, le widget affiche les dernières données avec la mention « hors ligne ».

## API utilisée

`GET /api/v1/widget?days=3` renvoie en un appel : EDT jour par jour, cours en cours/suivant, ce soir, DS, khôlles, CB, devoirs, semaine, série, matières délaissées, post-its. Actions : `POST /api/v1/homework/:id/done`, `/api/v1/sessions/:id/mode`, `/api/v1/notes/:id/done`, `/api/v1/sync`, `/api/v1/homework`, `/api/v1/notes`.
