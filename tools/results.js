#!/usr/bin/env node
/* CX GAME – résultats d'une course → data/results.json.
   Usage : node tools/results.js E01-ELI-H resultats.txt [--confirm-dns "NOM Prénom; NOM Prénom"] [--source URL]
                                  [--validated] [--replace] [--no-startlist] [--out f] [--starts f] [--now ISO (tests)]
   resultats.txt : « rang|NOM Prénom|pays|temps » et « DNF|NOM Prénom|pays » (DNF, DSQ, DNS).
   Garde-fous (rien n'est écrit sinon) :
     3 la course n'est pas terminée ;
     4 pas de start list enregistrée (tools/startlist.js), sauf --no-startlist ;
     2 un DNS possible n'est pas confirmé : un partant absent du classement n'est PAS déclaré DNS tout seul, il faut --confirm-dns ;
     1 résultat déjà présent (sauf --replace), course inconnue, fichier illisible.
   Sans --validated : simulation, data/results.json n'est pas modifié. --validated = ta validation du résultat. */
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('../js/results.js');
const A = require('../js/athletes.js');
const D = require('../js/data.js');
const G = require('../js/game.js');

const RACE_MAX_MS = 2 * 3600 * 1000; // une course dure au plus ~1 h 10 : on attend départ + 2 h

function main() {
  const args = process.argv.slice(2);
  const flag = (n) => args.includes(n);
  const opt = (n) => (flag(n) ? args[args.indexOf(n) + 1] : null);
  const VALUE_FLAGS = ['--confirm-dns', '--source', '--out', '--starts', '--now'];
  const pos = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1]));
  const [id, file] = pos;
  const fail = (code, msg) => { console.error(msg); process.exit(code); };
  if (!id || !file) fail(1, 'Usage : node tools/results.js E01-ELI-H resultats.txt [--confirm-dns "NOM Prénom; …"] [--validated] [--replace] [--no-startlist]');
  if (!D.RACES[id]) fail(1, 'Course inconnue : ' + id);
  if (!fs.existsSync(file)) fail(1, 'Fichier introuvable : ' + file);
  const root = path.join(__dirname, '..');
  const out = opt('--out') || path.join(root, 'data', 'results.json');
  const starts = opt('--starts') || path.join(root, 'data', 'startlists.json');
  const ovr = path.join(root, 'data', 'calendar-overrides.json');
  if (fs.existsSync(ovr)) G.setOverrides(JSON.parse(fs.readFileSync(ovr, 'utf8')));
  const race = G.raceOf(id), now = opt('--now') ? new Date(opt('--now')) : new Date();

  if (race.cancelled) fail(3, `${id} est annulée : pas de résultat.`);
  const end = new Date(G.raceStart(race).getTime() + RACE_MAX_MS);
  if (now < end) fail(3, `${id} n'est pas terminée (départ ${G.raceStart(race).toISOString()}, résultats acceptés après ${end.toISOString()}).`);

  const sdb = fs.existsSync(starts) ? JSON.parse(fs.readFileSync(starts, 'utf8')) : { races: {} };
  const sl = sdb.races[id];
  if (!sl && !flag('--no-startlist')) fail(4, `Pas de start list enregistrée pour ${id} : node tools/startlist.js ${id} start.txt (ou --no-startlist : DNS non détectables, pas de tirage possible).`);

  const athletes = R.athletesOf(A, race.gender), byId = {}; athletes.forEach((a) => { byId[a.id] = a; });
  const startNamed = sl ? sl.start.map((s) => `${s.bib}|${s.name}|`).join('\n') : '';

  let r;
  try {
    r = R.buildRace({
      race: id, start: startNamed, ranked: fs.readFileSync(file, 'utf8'),
      confirmedDns: (opt('--confirm-dns') || '').split(';').map((x) => x.trim()).filter(Boolean),
    }, athletes);
  } catch (e) { fail(1, e.message); }

  if (r.pendingDns.length) {
    console.error('DNS À CONFIRMER avant d’écrire le résultat (aucun n’est déclaré tout seul) :');
    r.pendingDns.forEach((d) => console.error(`  ${d.bib ? 'dossard ' + d.bib + ' ' : ''}${d.name} — ${d.why}`));
    console.error('Relance avec --confirm-dns "NOM Prénom; NOM Prénom" pour ceux qui sont réellement DNS ; les autres sont à corriger dans le fichier (DNF, DSQ ou classé).');
    process.exit(2);
  }
  r.warnings.forEach((w) => console.log('Attention :', w));
  if (r.unknown.length) console.log(`Hors liste du jeu (identifiant créé depuis le nom) : ${r.unknown.length} coureur(s)`);

  const db = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : { races: {} };
  if (db.races[id] && !flag('--replace')) fail(1, `${id} a déjà un résultat dans ${out} : ajoute --replace pour le remplacer (c'est une donnée réelle).`);
  const ranked = r.entries.filter((e) => e.rank), st = (s) => r.entries.filter((e) => e.status === s).length;
  const summary = `${id} : ${ranked.length} classés, ${st('DNF')} DNF, ${st('DSQ')} DSQ, ${st('DNS')} DNS, départ de ${r.start.length}`;
  if (!flag('--validated')) {
    console.log('SIMULATION – rien n’est écrit. ' + summary);
    ranked.slice(0, 5).forEach((e) => console.log(`  ${e.rank}. ${e.name || (byId[e.ath] ? byId[e.ath].name : e.ath)}`));
    console.log('Après validation : relancer avec --validated.');
    return;
  }
  db.races[id] = { source: opt('--source') || '', fetched: new Date().toISOString(), entries: r.entries, start: r.start };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(db));
  console.log('ÉCRIT : ' + summary + ' -> ' + out);
}

if (require.main === module) main();
