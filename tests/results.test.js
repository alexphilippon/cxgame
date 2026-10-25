const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const R = require('../js/results.js');
const A = require('../js/athletes.js');
const G = require('../js/game.js');

const FX = fs.readFileSync(path.join(__dirname, 'fixtures', 'hoogerheide-2026-we.txt'), 'utf8');
const ATH = R.athletesOf(A, 'F');
const rows = R.rankRows(FX);

// ---- Lecture
assert.strictEqual(rows.filter((r) => r.rank).length, 67);
assert.deepStrictEqual(rows.filter((r) => r.status).map((r) => r.status + ' ' + r.name), ['DNF CABACA Mae', 'DNF WORST Annemarie']);
assert.strictEqual(rows[23].rank, 24); assert.strictEqual(rows[23].time, '', 'doublée sans temps : garde son rang');
assert.throws(() => R.rankRows('x|A B|FRA|1:00'), /illisible/);
assert.throws(() => R.rankRows('DNF|'), /illisible/);
assert.throws(() => R.startRows('abc|A B|FRA'), /illisible/);
assert.deepStrictEqual(R.startRows('# c\n12|DUPONT Jean|France\n'), [{ bib: 12, name: 'DUPONT Jean', nat: 'France' }]);
assert.strictEqual(R.athletesOf(A, 'F').length, 100); assert.strictEqual(R.athletesOf(A, 'H').length, 100);

// start list fictive : dossards dans l'ordre inverse du classement, + 2 partants fictifs absents du classement
const names = rows.map((r) => r.name);
const startNames = names.slice().reverse().concat(['TESTEUR Anna', 'EXEMPLE Berta']);
const startText = startNames.map((n, i) => `${i + 1}|${n}|`).join('\n');

// ---- Start list
const sl = R.buildStart(startText, ATH);
assert.strictEqual(sl.start.length, 71);
assert.deepStrictEqual(sl.start.map((s) => s.bib), Array.from({ length: 71 }, (_, i) => i + 1));
assert.ok(sl.unknown.includes('LANGENBARG Puck') && sl.unknown.includes('TESTEUR Anna') && !sl.unknown.includes('PIETERSE Puck'));
assert.throws(() => R.buildStart('1|A B|\n1|C D|', ATH), /Dossards en double/);
assert.throws(() => R.buildStart('1|A B|\n2|B A|', ATH), /Coureur en double/);
assert.throws(() => R.buildStart('# vide', ATH), /vide/);

// ---- Résultat : DNS jamais déclarés tout seuls
const raw = { race: 'E01-ELI-F', start: startText, ranked: FX };
const p = R.buildRace(raw, ATH);
assert.deepStrictEqual(p.pendingDns.map((d) => d.name), ['TESTEUR Anna', 'EXEMPLE Berta'], 'absents du classement = DNS possibles, en attente');
assert.strictEqual(p.pendingDns[0].bib, 70);
assert.strictEqual(p.entries.length, 0, 'tant qu’un DNS est en attente : rien à écrire');
const one = R.buildRace(Object.assign({}, raw, { confirmedDns: ['Anna Testeur'] }), ATH);
assert.deepStrictEqual(one.pendingDns.map((d) => d.name), ['EXEMPLE Berta'], 'confirmation par clé de nom : ordre et casse indifférents');
const r = R.buildRace(Object.assign({}, raw, { confirmedDns: ['TESTEUR Anna', 'EXEMPLE Berta'] }), ATH);
assert.strictEqual(r.pendingDns.length, 0);
assert.deepStrictEqual(r.warnings, [], 'rangs 1 à 67 consécutifs, tous dans la start list');
assert.strictEqual(r.entries.length, 71, '67 classées + 2 DNF + 2 DNS');
const by = (id) => r.entries.find((e) => e.ath === id);
assert.deepStrictEqual(by('puck-pieterse'), { ath: 'puck-pieterse', rank: 1, bib: 69, time: '51:54' }, 'dossards inversés : 1re = 69e dossard (69 classées/DNF avant les 2 fictifs)');
assert.strictEqual(by('kristyna-zemanova').rank, 2, 'accents : ZEMANOVÁ retrouvée');
assert.strictEqual(by('sidney-mcgill').rank, 24); assert.ok(!('time' in by('sidney-mcgill')), 'pas de temps affiché : rang conservé');
assert.strictEqual(by('annemarie-worst').status, 'DNF');
assert.strictEqual(by('puck-langenbarg').name, 'Puck Langenbarg', 'hors liste du jeu : nom conservé, identifiant stable');
assert.strictEqual(by('anna-testeur').status, 'DNS'); assert.strictEqual(by('anna-testeur').confirmed, true);
assert.strictEqual(G.dnsPending(r.entries).length, 0);
assert.strictEqual(r.start.length, 71);
assert.ok(R.buildRace(Object.assign({}, raw, { confirmedDns: ['TESTEUR Anna', 'EXEMPLE Berta', 'PIETERSE Puck'] }), ATH).warnings.some((w) => /PIETERSE Puck/.test(w)), 'DNS confirmé qui n’en est pas un : signalé');
// source qui annonce elle-même un DNS : il reste à confirmer
const srcDns = R.buildRace({ race: 'x', start: startText, ranked: FX + 'DNS|TESTEUR Anna|France\n' }, ATH);
assert.ok(srcDns.pendingDns.some((d) => d.name === 'TESTEUR Anna' && /annoncé/.test(d.why)));
// incohérences
assert.throws(() => R.buildRace({ race: 'x', start: startText, ranked: '1|PIETERSE Puck||\n1|BAKKER Manon||' }, ATH), /non croissants/);
assert.throws(() => R.buildRace({ race: 'x', start: startText, ranked: '1|PIETERSE Puck||\n2|PIETERSE Puck||' }, ATH), /deux fois/);
assert.ok(R.buildRace({ race: 'x', start: startText, ranked: '1|PIETERSE Puck||\n3|BAKKER Manon||', confirmedDns: [] }, ATH).warnings.some((w) => /Rang 2 manquant/.test(w)));
assert.ok(R.buildRace({ race: 'x', start: '1|PIETERSE Puck|', ranked: '1|PIETERSE Puck||\n2|BAKKER Manon||' }, ATH).warnings.some((w) => /absent de la start list/.test(w)));
assert.ok(R.buildRace({ race: 'x', ranked: '1|PIETERSE Puck||' }, ATH).warnings.some((w) => /Pas de start list/.test(w)));

// ---- Enchaînement avec les règles du jeu
const RID = 'E01-ELI-F';
const results = { [RID]: r.entries };
const race = G.raceOf(RID);
const sc = (a, b) => G.scoreRace(race, { a, b }, results);
assert.strictEqual(sc('puck-pieterse'), 100);
assert.strictEqual(sc('sidney-mcgill'), 7, 'pulled/doublée : rang officiel 24 = 7 points');
assert.strictEqual(sc('annemarie-worst'), 0, 'DNF = 0');
assert.strictEqual(sc('anna-testeur', 'puck-pieterse'), 100, 'DNS : le remplaçant joue');
assert.strictEqual(sc('anna-testeur'), 0, 'DNS sans remplaçant');
assert.ok(!G.usedInDesk(1, 'F', 'ELI', { [RID]: { a: 'anna-testeur' } }, null, results).has('anna-testeur'), 'DNS libéré');
assert.ok(G.usedInDesk(1, 'F', 'ELI', { [RID]: { a: 'annemarie-worst' } }, null, results).has('annemarie-worst'), 'DNF grillé');
const meta = { [RID]: { start: r.start } };
const picks = { p1: { [RID]: { a: 'anna-testeur', b: 'berta-exemple' } }, p2: { [RID]: { a: 'anna-testeur', b: 'puck-pieterse' } } };
const draws = G.autoDraws(results, meta, picks);
assert.deepStrictEqual(Object.keys(draws[RID]), ['p1'], 'tirage seulement si titulaire ET remplaçant sont DNS');
const top20 = r.start.slice().sort((a, b) => a.bib - b.bib).slice(0, 20).map((s) => s.ath);
assert.ok(top20.includes(draws[RID].p1.ath));
assert.deepStrictEqual(G.autoDraws(results, meta, picks), draws, 'reproductible');

// ---- Outils en ligne de commande : garde-fous
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-'));
const f = (n) => path.join(tmp, n);
fs.writeFileSync(f('start.txt'), startText); fs.writeFileSync(f('res.txt'), FX);
const run = (tool, ...a) => cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', tool), ...a], { encoding: 'utf8' });
const STARTS = f('starts.json'), OUT = f('results.json'), AFTER = '2026-11-02T00:00:00Z';
const common = ['E01-ELI-F', f('res.txt'), '--out', OUT, '--starts', STARTS];
let x = run('results.js', ...common, '--now', AFTER);
assert.strictEqual(x.status, 4, 'sans start list : refus'); assert.ok(!fs.existsSync(OUT));
x = run('startlist.js', 'E01-ELI-F', f('start.txt'), '--out', STARTS, '--source', 'test');
assert.strictEqual(x.status, 0, x.stderr); assert.strictEqual(JSON.parse(fs.readFileSync(STARTS, 'utf8')).races['E01-ELI-F'].start.length, 71);
assert.strictEqual(run('startlist.js', 'E99-ELI-F', f('start.txt'), '--out', STARTS).status, 1, 'course inconnue');
x = run('results.js', ...common, '--now', '2026-10-30T00:00:00Z');
assert.strictEqual(x.status, 3, 'course pas encore courue : refus');
x = run('results.js', ...common, '--now', '2026-11-01T12:30:00Z');
assert.strictEqual(x.status, 3, 'départ 13 h : 30 min après le départ, pas terminée');
x = run('results.js', ...common, '--now', AFTER, '--validated');
assert.strictEqual(x.status, 2, 'DNS non confirmés : refus même avec --validated'); assert.ok(/TESTEUR Anna/.test(x.stderr) && !fs.existsSync(OUT));
const conf = ['--confirm-dns', 'TESTEUR Anna; EXEMPLE Berta'];
x = run('results.js', ...common, '--now', AFTER, ...conf);
assert.strictEqual(x.status, 0, x.stderr); assert.ok(/SIMULATION/.test(x.stdout) && !fs.existsSync(OUT), 'sans --validated : rien n’est écrit');
x = run('results.js', ...common, '--now', AFTER, ...conf, '--validated', '--source', 'test');
assert.strictEqual(x.status, 0, x.stderr); assert.ok(/ÉCRIT/.test(x.stdout));
const saved = JSON.parse(fs.readFileSync(OUT, 'utf8')).races['E01-ELI-F'];
assert.strictEqual(saved.entries.length, 71); assert.strictEqual(saved.start.length, 71); assert.strictEqual(saved.source, 'test');
x = run('results.js', ...common, '--now', AFTER, ...conf, '--validated');
assert.strictEqual(x.status, 1, 'résultat déjà présent : pas d’écrasement'); assert.ok(/--replace/.test(x.stderr));
x = run('results.js', ...common, '--now', AFTER, ...conf, '--validated', '--replace');
assert.strictEqual(x.status, 0, x.stderr);
fs.rmSync(tmp, { recursive: true, force: true });

console.log('Tous les tests passent (résultats).');
