# CX GAME – cyclo-cross 2026-27

Adaptation du SKI GAME. Site statique (HTML/CSS/JS, sans build).

- `index.html`, `css/style.css`, `js/app.js` : interface (5 ambiances : Flandre, boue, neige, forêt, Tomorrowland).
- `js/data.js`, `js/game.js` : calendrier et règles (fonctions pures, testées).
- `js/store.js`, `js/config.js` : stockage local (essais) ou Firebase (étape 5, nouveau projet).
- `data/` : `results.json`, `startlists.json` (écrits par `tools/results.js` et `tools/startlist.js`, jamais sans validation).
- Tests : `for f in tests/*.test.js; do node "$f" || exit 1; done` ; test d'interface : `node tests/ui.smoke.js <dossier>` (Playwright).
