# CX GAME – cyclo-cross 2026-27

Adaptation du SKI GAME. Site statique (HTML/CSS/JS, sans build).

- `index.html`, `css/style.css`, `js/app.js` : interface (5 ambiances : Flandre, boue, neige, forêt, Tomorrowland).
- `js/data.js`, `js/game.js` : calendrier et règles (fonctions pures, testées).
- `js/store.js`, `js/config.js` : stockage local (essais) ou Firebase (étape 5, nouveau projet).
- `data/` : `results.json`, `startlists.json` (écrits par `tools/results.js` et `tools/startlist.js`, jamais sans validation).
- Tests : `for f in tests/*.test.js; do node "$f" || exit 1; done` ; test d'interface : `node tests/ui.smoke.js <dossier>` (Playwright).
- Contraste : `node tests/contrast.js [largeur]` vérifie qu'aucun texte n'est illisible (toutes ambiances, desktop et mobile).

## Partage entre joueurs (étape 5)
1. Firebase (nouveau projet `cxgame`, jamais celui du ski) : Authentication (e-mail/mot de passe) + Firestore.
2. `firebase/firestore.rules` : à coller dans Firestore > Règles.
3. `js/config.js` : coller la configuration web Firebase et `adminEmail`.
4. Vercel : importer le dépôt `alexphilippon/cxgame` (projet statique, aucune commande de build).
Sans configuration, le site tourne en mode local (comptes et choix dans le navigateur, pour essais).

## Administration
Onglet **Admin** (visible uniquement pour `adminEmail`) : Contrôles (qui a choisi, choix tardifs, joueurs), Résultats (collage d'un classement, secours si `data/results.json` n'est pas à jour), Calendrier (annulation, report, heure), Coureurs (ajout, fusion des noms libres), Idées. Les tirages au sort sont automatiques (dossards publiés).
