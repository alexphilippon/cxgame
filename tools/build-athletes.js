#!/usr/bin/env node
/* CX GAME – génère js/athletes.js à partir des classements UCI relevés dans data/raw/ranking-<CAT>-<G>.txt
   (lignes « rang|NOM Prénom|pays|équipe|points », les lignes « # » sont ignorées).
   Usage : node tools/build-athletes.js
   Refuse d'écrire si un classement est incohérent (rangs non consécutifs, points qui remontent, doublons). */
'use strict';
const fs = require('fs');
const path = require('path');
const N = require('../js/names.js');

// Pays tels qu'écrits par cyclocross24 → code CIO/UCI à 3 lettres.
const NAT = {
  'Belgique': 'BEL', 'Pays-Bas': 'NED', 'Espagne': 'ESP', 'Royaume-Uni': 'GBR', 'Grande Bretagne': 'GBR', 'Suisse': 'SUI', 'France': 'FRA',
  'Italie': 'ITA', 'Tchéquie': 'CZE', 'République Tchèque': 'CZE', 'Canada': 'CAN', 'États-Unis': 'USA', 'États Unis': 'USA', 'Danemark': 'DEN',
  'Éthiopie': 'ETH', 'Hongrie': 'HUN', 'Pologne': 'POL', 'Japon': 'JPN', 'Luxembourg': 'LUX', 'Slovaquie': 'SVK', 'Suède': 'SWE', 'Allemagne': 'GER',
  'Portugal': 'POR', 'Nouvelle-Zélande': 'NZL', 'Autriche': 'AUT', 'Norvège': 'NOR',
};

/** Lit un classement brut. Retourne { athletes, warnings } ; lève une erreur si le classement est incohérent. */
function parseRanking(text, label) {
  const lines = String(text).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const athletes = [], warnings = [], keys = new Set(), ids = new Set();
  lines.forEach((line, i) => {
    const f = line.split('|');
    if (f.length !== 5) throw new Error(`${label} ligne ${i + 1} : 5 champs attendus, reçu ${f.length} (${line})`);
    const rank = Number(f[0]), pts = Number(f[4]);
    if (!Number.isInteger(rank) || !Number.isInteger(pts)) throw new Error(`${label} ligne ${i + 1} : rang ou points non numérique (${line})`);
    if (rank !== i + 1) throw new Error(`${label} : rang ${rank} à la ligne ${i + 1}, rangs non consécutifs`);
    if (i && pts > athletes[i - 1].pts) throw new Error(`${label} : les points remontent au rang ${rank}`);
    const src = f[1].trim(), country = f[2].trim();
    const name = N.displayName(src), key = N.nameKey(src);
    if (keys.has(key)) throw new Error(`${label} : clé de nom en double « ${key} » (${src})`);
    keys.add(key);
    let id = N.slug(name);
    if (ids.has(id)) id += '-' + rank;
    ids.add(id);
    if (!NAT[country]) warnings.push(`${label} rang ${rank} : pays inconnu « ${country} »`);
    const a = { id, name, src, key, nat: NAT[country] || country, rank, pts };
    if (f[3].trim()) a.team = f[3].trim();
    athletes.push(a);
  });
  if (!athletes.length) throw new Error(`${label} : classement vide`);
  return { athletes, warnings };
}

function main() {
  const root = path.join(__dirname, '..');
  const lists = {}, warnings = [], sources = [];
  fs.readdirSync(path.join(root, 'data', 'raw')).filter((f) => /^ranking-(ELI|U23|U19)-(H|F)\.txt$/.test(f)).sort().forEach((f) => {
    const m = f.match(/^ranking-(ELI|U23|U19)-(H|F)\.txt$/), id = `${m[1]}-${m[2]}`;
    const r = parseRanking(fs.readFileSync(path.join(root, 'data', 'raw', f), 'utf8'), id);
    lists[id] = r.athletes;
    r.warnings.forEach((w) => warnings.push(w));
    sources.push(`${id} : ${r.athletes.length} coureurs`);
  });
  const body = `/* Liste des coureurs : généré par tools/build-athletes.js à partir de data/raw/ranking-*.txt (classement UCI cyclo-cross 2026-2027, cyclocross24.com).
   Ne pas modifier à la main : mettre à jour les fichiers bruts puis relancer le script. */
(function (root) {
  'use strict';
  const data = {
    generated: '2026-10-25',
    source: 'Classement UCI cyclo-cross 2026-2027 (cyclocross24.com), 100 premiers par liste',
    lists: {
${Object.keys(lists).map((k) => `      '${k}': ${JSON.stringify(lists[k])},`).join('\n')}
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.CX_ATHLETES = data;
})(typeof window !== 'undefined' ? window : globalThis);
`;
  fs.writeFileSync(path.join(root, 'js', 'athletes.js'), body);
  console.log(sources.join('\n'));
  if (warnings.length) { console.log('Avertissements :'); warnings.forEach((w) => console.log(' - ' + w)); }
}

if (require.main === module) main();
module.exports = { parseRanking, NAT };
