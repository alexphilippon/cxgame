/* Écrit tools/photo-credits.json et credits.html à partir des crédits des photos (utilisé par les scripts de téléchargement). */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const credFile = path.join(__dirname, 'photo-credits.json');
const load = () => (fs.existsSync(credFile) ? JSON.parse(fs.readFileSync(credFile, 'utf8')) : {});
function save(credits) {
  fs.writeFileSync(credFile, JSON.stringify(credits, null, 1));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = Object.entries(credits).sort((x, y) => x[1].name.localeCompare(y[1].name)).map(([, c]) =>
    `<tr><td>${esc(c.name)}</td><td>${esc(c.author)}</td><td>${esc(c.license)}</td><td><a href="${esc(c.page)}">source</a></td></tr>`).join('\n');
  fs.writeFileSync(path.join(root, 'credits.html'), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crédits photos – CX GAME</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:860px;margin:0 auto;padding:24px 16px;background:#fbf8ef;color:#1b2b44}table{border-collapse:collapse;width:100%}td,th{padding:6px 8px;border-bottom:1px solid #d8cfb8;text-align:left;font-size:14px}a{color:#a93a2c}</style></head><body>
<p><a href="./">← Retour au jeu</a></p><h1>Crédits photos</h1>
<p>Portraits issus de Wikimedia Commons (licences libres, auteurs ci-dessous), redimensionnés. Les autres coureurs sont affichés avec leurs initiales.</p>
<table><thead><tr><th>Coureur</th><th>Auteur</th><th>Licence</th><th>Fichier</th></tr></thead><tbody>
${rows}
</tbody></table></body></html>`);
}


module.exports = { load, save };
