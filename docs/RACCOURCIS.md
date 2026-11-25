# Raccourcis iPhone prêts à monter

Tous les raccourcis utilisent la même base :
- **URL de l'app** : `https://planning-plus-two.vercel.app`
- **En-tête** : `Authorization` = `Bearer pp_…` (ton token : Réglages → Tokens API dans Planning+).

Astuce : crée d'abord le raccourci 1, puis **duplique-le** pour les autres (l'URL et l'en-tête sont déjà en place, il suffit de changer l'adresse et la suite).

> Pourquoi pas un fichier à importer directement ? iOS n'accepte que des raccourcis signés par Apple (via iCloud ou un Mac). Une fois les tiens créés, tu peux les partager en lien iCloud pour les garder.

---

## 1. « Dis Siri, j'ai quoi demain ? »

Nom du raccourci : **J'ai quoi demain** (c'est la phrase que tu diras à Siri).

1. **Obtenir le contenu de l'URL**
   - URL : `https://planning-plus-two.vercel.app/api/v1/brief?jour=demain`
   - Afficher plus → Méthode : `GET` → En-têtes : `Authorization` = `Bearer pp_…`
2. **Obtenir la valeur du dictionnaire** → Valeur pour la clé `text`
3. **Énoncer le texte** → Valeur du dictionnaire

Siri répond par exemple : « Demain, jeudi, tu commences à 08h00 avec Maths en salle 113, et tu finis à 14h50 : 4 cours. Khôlle Économie à 17h10, salle 444, préparation à 17h10. 2 devoirs à rendre… Prochain DS : DS de Philosophie numéro 2 lundi, dans 4 soirs et 1 week-end. »

**Variante « Ma journée »** : duplique, renomme **Ma journée** et remplace `jour=demain` par `jour=aujourdhui`.

---

## 2. Mode Concentration automatique pendant les sessions

Prérequis : un mode de concentration (Réglages → Concentration), par exemple **Travail**, avec les apps et notifications que tu veux couper.

### Le raccourci « Planning+ Concentration »

1. **Obtenir le contenu de l'URL**
   - URL : `https://planning-plus-two.vercel.app/api/v1/shortcut/tonight`
   - En-têtes : `Authorization` = `Bearer pp_…`
2. **Obtenir la valeur du dictionnaire** → clé `active` → renomme la variable « Active »
3. **Si** « Active » **est** `oui`
   1. **Obtenir la valeur du dictionnaire** → clé `endTime` (du résultat de l'étape 1)
   2. **Obtenir les dates de l'entrée** → Valeur du dictionnaire
   3. **Définir la concentration** → Activer **Travail** → Jusqu'à : **Heure** → Dates
   4. **Obtenir la valeur du dictionnaire** → clé `text` → **Afficher la notification** avec cette valeur
4. **Sinon** → **Afficher la notification** « Pas de session prévue ce soir »
5. **Fin de Si**

Lancement :
- depuis le **mode Focus** de Planning+ : bouton **🌙 Concentration iPhone** en haut ;
- à la voix : « Dis Siri, Planning+ Concentration ».

### L'automatisation (déclenchement tout seul)

Raccourcis → Automatisation → **+** → **Heure de la journée** → `19:55`, **Quotidiennement** → **Exécuter immédiatement** → action **Exécuter le raccourci** « Planning+ Concentration ».

Pour couvrir aussi le mode maison (21h00), ajoute une 2ᵉ automatisation à `20:55`. Pour qu'elle n'active la concentration que si la session commence bientôt, remplace dans le raccourci la clé `active` par `startsSoon` (vaut `oui` si la session commence dans moins de 15 min ou a déjà commencé).

---

## 3. Focus libre à la voix

### « Lance un focus »

1. **Obtenir le contenu de l'URL** → `…/api/v1/focus` (GET, en-tête)
2. **Obtenir la valeur du dictionnaire** → clé `subjectNames`
3. **Choisir dans la liste** → Invite : « Quelle matière ? »
4. **Demander une entrée** (Texte) → « Quoi ? (Anki, fiche…) » — laisse vide si rien
5. **Obtenir le contenu de l'URL** → `…/api/v1/focus/start`
   - Méthode : `POST`, en-tête `Authorization`
   - Corps de la requête : **JSON** → `subject` = Élément choisi, `description` = Entrée fournie
6. **Obtenir la valeur du dictionnaire** → clé `text` → **Énoncer le texte**

### « Stop focus »

1. **Obtenir le contenu de l'URL** → `…/api/v1/focus/stop` (POST, en-tête)
2. **Obtenir la valeur du dictionnaire** → `text` → **Énoncer le texte** (« 23 minutes de Droit · Anki ajoutées. »)

### « J'ai travaillé » (minutes déjà faites)

1. **Obtenir le contenu de l'URL** → `…/api/v1/focus` → valeur `subjectNames` → **Choisir dans la liste**
2. **Demander une entrée** (Nombre) → « Combien de minutes ? »
3. **Demander une entrée** (Texte) → « Quoi ? » (facultatif)
4. **Obtenir le contenu de l'URL** → `…/api/v1/focus/log`, `POST`, JSON : `subject`, `minutes`, `description`
5. Valeur `text` → **Énoncer le texte**

---

## 4. Tag NFC sur le bureau

Un autocollant NFC (NTAG213, quelques euros) : tu poses ton iPhone dessus pour lancer le chrono, une 2ᵉ fois pour l'arrêter.

Raccourcis → Automatisation → **+** → **NFC** → scanne le tag → **Exécuter immédiatement** → actions :
1. **Obtenir le contenu de l'URL** → `…/api/v1/focus/start`, `POST`, JSON : `toggle` = **Oui** (booléen), `subject` = *(vide, ou une matière fixe : « droit »)*
2. Valeur `text` → **Afficher la notification**

Avec `toggle`, le tag arrête le chrono s'il tourne déjà (et compte les minutes), sinon il en lance un.

---

## 5. Points d'API utilisés

| Route | Rôle |
|---|---|
| `GET /api/v1/brief?jour=demain\|aujourdhui` | `text` : la phrase lue par Siri |
| `GET /api/v1/shortcut/tonight` | `active`, `startsSoon` (oui/non), `start`, `end`, `endTime`, `focusUrl`, `text` |
| `GET /api/v1/focus` | chrono en cours + `subjectNames` |
| `POST /api/v1/focus/start` | `subject`, `description`, `toggle` |
| `POST /api/v1/focus/stop` | arrête et compte les minutes |
| `POST /api/v1/focus/log` | `subject`, `minutes`, `description` |

Toutes ces routes répondent avec un champ `text` prêt à être lu ou affiché.
