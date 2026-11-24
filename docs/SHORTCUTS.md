# Raccourcis iOS et API Planning+

Tous les appels utilisent l'en-tête `Authorization: Bearer <token>` (token créé dans Réglages → Tokens API).
`APP` = l'URL Vercel de l'app.

## API REST v1

| Méthode | Route | Corps | Effet |
|---|---|---|---|
| GET | `APP/api/v1/summary` | — | Prochains DS / CB / khôlles (compte à rebours), devoirs du jour, session de ce soir |
| POST | `APP/api/v1/homework` | `{"title","subject","dueDate","dueTime","description"}` | Crée un devoir (→ Google Tasks) |
| POST | `APP/api/v1/homework/:id/done` | — | Coche un devoir |
| POST | `APP/api/v1/notes` | `{"content","color","dueDate"}` | Ajoute un post-it |
| GET | `APP/api/v1/widget?days=3` | — | Toutes les données des widgets |
| POST | `APP/api/v1/notes/:id/done` | — | Range un post-it |
| POST | `APP/api/v1/sync` | — | Synchro Google immédiate |
| POST | `APP/api/v1/sessions/:id/mode` | `{"mode":"etude"\|"maison"}` ou vide (bascule) | Interrupteur étude / maison |

`subject` accepte la clé (`maths`, `eco`, `droit`, `management`, `anglais`, `espagnol`, `lettres`, `philo`) ou le début du nom (« Droit », « Éco »…).

## Raccourci « Ajoute un devoir »

But : « Dis Siri, ajoute un devoir de droit pour vendredi ».

1. **Demander une entrée** (texte) : « Quel devoir ? » → variable `Titre`.
2. **Choisir dans le menu** : Mathématiques / Économie / Droit / Management / Anglais / Espagnol / Lettres / Philosophie → dans chaque branche, **Texte** avec la clé (`droit`…) → variable `Matière`.
3. **Demander une entrée** (date) : « Pour quand ? » → **Formater la date** au format personnalisé `yyyy-MM-dd` → variable `Échéance`.
4. **Obtenir le contenu de l'URL** :
   - URL : `APP/api/v1/homework`
   - Méthode : POST
   - En-têtes : `Authorization` = `Bearer pp_…`
   - Corps : JSON — `title` = Titre, `subject` = Matière, `dueDate` = Échéance
5. **Afficher la notification** « Devoir ajouté ».

Nomme le raccourci « Ajoute un devoir » pour le lancer à la voix.

## Raccourci « Planning+ mode » (utilisé par le grand widget)

1. Entrée du raccourci : texte (ID de session).
2. **Obtenir le contenu de l'URL** : `APP/api/v1/sessions/[Entrée du raccourci]/mode`, POST, en-tête `Authorization`, corps vide (bascule étude ↔ maison).
3. **Afficher la notification** « Session mise à jour ».

## Liens profonds

- `APP/?nouveau=devoir` (aussi `session`, `postit`, `lien`) — ouvre la saisie rapide ; options `&matiere=droit&date=2026-11-27`.
- `APP/planner/<id>/bilan` — bilan d'une session.

## Widget Scriptable

Voir [`docs/WIDGETS.md`](WIDGETS.md) : 10 types de widgets (EDT 3 jours, devoirs, khôlles, DS, tableaux de bord…), 4 tailles, écran verrouillé, boutons d'action.

## Serveur MCP

URL : `APP/api/mcp` (HTTP streamable, sans état), en-tête `Authorization: Bearer pp_…`.
Outils : `get_summary`, `list_deadlines`, `list_homework`, `create_homework`, `update_homework`, `complete_homework`, `list_sessions`, `create_session`, `add_session_item`, `set_session_mode`, `review_session`, `add_note`, `ds_preparation`.

Exemple Claude Code :

```bash
claude mcp add --transport http planning-plus https://<app>.vercel.app/api/mcp --header "Authorization: Bearer pp_…"
```
