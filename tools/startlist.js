#!/usr/bin/env node
/* CX GAME – enregistre la start list d'une course (dossards) dans data/startlists.json.
   Usage : node tools/startlist.js E01-ELI-H start.txt [--source URL] [--out data/startlists.json]
   start.txt : une ligne par partant « dossard|NOM Prénom|pays » (les lignes « # » sont ignorées).
   Ne touche jamais à data/results.json. Si la start list n'est pas publiée, il n'y a rien à enregistrer : on ne l'invente pas. */
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('../js/results.js');
const A = require('../js/athletes.js');
const D = require('../js/data.js');

function main() {
  const args = process.argv.slice(2);
  const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
  const pos = args.filter((a, i) => !a.startsWith('--') && !['--source', '--out'].includes(args[i - 1]));
  const [id, file] = pos;
  if (!id || !file) { console.error('Usage : node tools/startlist.js E01-ELI-H start.txt [--source URL] [--out fichier]'); process.exit(1); }
  const race = D.RACES[id];
  if (!race) { console.error('Course inconnue : ' + id); process.exit(1); }
  if (!fs.existsSync(file)) { console.error('Fichier introuvable : ' + file); process.exit(1); }
  const out = opt('--out') || path.join(__dirname, '..', 'data', 'startlists.json');
  let r;
  try { r = R.buildStart(fs.readFileSync(file, 'utf8'), R.athletesOf(A, race.gender)); } catch (e) { console.error(e.message); process.exit(1); }
  const db = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : { races: {} };
  const replaced = !!db.races[id];
  if (replaced && JSON.stringify(db.races[id].start) === JSON.stringify(r.start)) { console.log(`${id} : start list inchangée (${r.start.length} partants)`); return; }
  db.races[id] = { source: opt('--source') || '', fetched: new Date().toISOString(), start: r.start };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(db, null, 1) + '\n');
  console.log(`${id} : ${r.start.length} partants (dossards ${r.start[0].bib} à ${r.start[r.start.length - 1].bib})${replaced ? ' – start list remplacée' : ''} -> ${out}`);
  if (r.unknown.length) console.log(`Hors liste du jeu (identifiant créé depuis le nom) : ${r.unknown.length} coureur(s)`);
}

if (require.main === module) main();
