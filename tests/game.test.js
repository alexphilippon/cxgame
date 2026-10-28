const assert = require('assert');
const D = require('../js/data.js');
const G = require('../js/game.js');

const races = Object.values(D.RACES);
const sess = (n) => D.SESSIONS.find((s) => s.id === n);

// ---- Calendrier
assert.strictEqual(D.EVENTS.length, 32, '32 réunions');
assert.strictEqual(D.SESSIONS.length, 32, '32 sessions (une par réunion)');
assert.strictEqual(races.filter((r) => r.kind !== 'mondial').length, 68, '68 courses hors Mondiaux');
assert.strictEqual(races.filter((r) => r.kind === 'mondial').length, 6, '6 courses des Mondiaux');
assert.strictEqual(races.filter((r) => r.kind !== 'mondial' && r.cat === 'ELI').length, 64, '64 courses Élites');
assert.strictEqual(races.filter((r) => r.kind !== 'mondial' && r.cat !== 'ELI').length, 4, '4 courses U23/U19 (Euros)');
const inSessions = D.SESSIONS.concat([D.WORLDS]).flatMap((s) => s.races);
assert.strictEqual(inSessions.length, 74);
assert.strictEqual(new Set(inSessions).size, 74, 'chaque course dans une seule session');
inSessions.forEach((id) => assert.ok(D.RACES[id], 'course inconnue ' + id));
const perDesk = [1, 2, 3].map((d) => D.SESSIONS.filter((s) => s.desk === d).reduce((n, s) => n + s.races.length, 0));
assert.deepStrictEqual(perDesk, [24, 22, 22], 'desks 24 (20 Élites + 4 U23/U19) / 22 / 22');
assert.deepStrictEqual([1, 2, 3].map((d) => D.SESSIONS.filter((s) => s.desk === d).length), [10, 11, 11]);
assert.strictEqual(D.SESSIONS.filter((s) => s.desk === 0).length, 0, 'aucune session hors desk hors Mondiaux');
assert.strictEqual(D.WORLDS.desk, 3, 'Mondiaux dans le Desk 3');
// les sessions sont dans les bornes de leur desk et chronologiques
D.SESSIONS.forEach((s) => {
  const dk = D.DESKS[s.desk - 1];
  s.races.forEach((id) => assert.ok(D.RACES[id].date >= dk.from && D.RACES[id].date <= dk.to, id + ' hors desk'));
});
for (let i = 1; i < D.SESSIONS.length; i++) {
  const a = D.SESSIONS[i - 1].races.map((r) => D.RACES[r].date).sort()[0];
  const b = D.SESSIONS[i].races.map((r) => D.RACES[r].date).sort()[0];
  assert.ok(a < b, 'sessions chronologiques : ' + D.SESSIONS[i].name);
}
assert.strictEqual(sess(22).name, 'SP Diegem');
assert.strictEqual(sess(22).desk, 3, 'Diegem (30/12) tombe dans le desk 3');
assert.strictEqual(sess(21).desk, 2, 'Besançon (29/12) dans le desk 2');
// Élites H et F le même jour, sauf aux Euros
D.EVENTS.filter((e) => e.serie !== 'EU').forEach((e) => {
  assert.strictEqual(D.RACES[e.id + '-ELI-H'].date, D.RACES[e.id + '-ELI-F'].date, e.name + ' : H et F le même jour');
});
// Euros de Zeddam (bulletin UEC) : Élites F samedi 7 nov, Élites H dimanche 8 nov
assert.strictEqual(D.RACES['E03-ELI-F'].date, '2026-11-07');
assert.strictEqual(D.RACES['E03-ELI-H'].date, '2026-11-08');
assert.strictEqual(D.RACES['E03-U23-H'].date, '2026-11-07');
assert.strictEqual(D.RACES['E03-U23-F'].date, '2026-11-08');
assert.strictEqual(D.RACES['E03-U19-F'].date, '2026-11-07');
assert.strictEqual(D.RACES['E03-U19-H'].date, '2026-11-08');
assert.strictEqual(sess(3).races.length, 6, 'Euros : 6 courses (Élite, U23, U19 × H/F)');
// multiplicateurs
const mults = (kind, cat) => [...new Set(races.filter((r) => r.kind === kind && r.cat === cat).map((r) => r.mult))];
assert.deepStrictEqual(mults('euro', 'ELI'), [2], 'Euros Élites ×2');
assert.deepStrictEqual(mults('euro', 'U23'), [1], 'Euros U23 : ×1');
assert.deepStrictEqual(mults('euro', 'U19'), [2 / 3], 'Euros U19 : 1/3 des points Élites');
assert.deepStrictEqual(mults('mondial', 'ELI'), [3], 'Mondiaux Élites ×3');
assert.deepStrictEqual(mults('mondial', 'U23'), [2], 'Mondiaux U23 ×2');
assert.deepStrictEqual(mults('mondial', 'U19'), [1], 'Mondiaux U19 ×1');
assert.ok(races.filter((r) => r.kind === 'cx').every((r) => r.mult === 1), 'courses ordinaires ×1');
// honnêteté sur les données provisoires
assert.ok(races.every((r) => r.timeKnown === false), 'aucune heure de départ confirmée à ce stade');
assert.ok(D.WORLDS.races.every((id) => D.RACES[id].dateKnown === false), 'jours des Mondiaux non confirmés');
assert.ok(sess(3).races.every((id) => D.RACES[id].dateKnown === true), 'jours des Euros connus');

// ---- Barème
assert.strictEqual(D.POINTS.length, 30);
assert.strictEqual(G.pointsForRank(1), 100);
assert.strictEqual(G.pointsForRank(2), 80);
assert.strictEqual(G.pointsForRank(16), 15);
assert.strictEqual(G.pointsForRank(30), 1);
assert.strictEqual(G.pointsForRank(31), 0);
assert.strictEqual(G.pointsForRank(0), 0);

// ---- Points
const RH = 'E01-ELI-H';
const res = {
  [RH]: [
    { ath: 'a', rank: 1 }, { ath: 'b', rank: 2 }, { ath: 'c', status: 'DNF' }, { ath: 'd', status: 'DNS' },
    { ath: 'e', status: 'DSQ' }, { ath: 'f', rank: 25, status: 'PULLED' }, { ath: 'g', rank: 31 },
  ],
  'E03-ELI-H': [{ ath: 'a', rank: 1 }],
  'MO-ELI-H': [{ ath: 'a', rank: 1 }],
};
const sc = (id, pick) => G.scoreRace(D.RACES[id], pick, res);
assert.strictEqual(sc(RH, { a: 'a' }), 100);
assert.strictEqual(sc(RH, { a: 'b' }), 80);
assert.strictEqual(sc(RH, { a: 'c' }), 0, 'DNF = 0');
assert.strictEqual(sc(RH, { a: 'e' }), 0, 'DSQ = 0');
assert.strictEqual(sc(RH, { a: 'd', b: 'b' }), 80, 'DNS : le remplaçant joue');
assert.strictEqual(sc(RH, { a: 'd' }), 0, 'DNS sans remplaçant = 0');
assert.strictEqual(sc(RH, { a: 'c', b: 'b' }), 0, 'DNF : pas de remplacement');
assert.strictEqual(sc(RH, { a: 'f' }), 6, 'pulled : garde son rang officiel (25e = 6)');
assert.strictEqual(sc(RH, { a: 'g' }), 0, '31e : hors barème');
assert.strictEqual(sc(RH, { a: 'zzz' }), 0, 'absent du classement');
assert.strictEqual(sc('E01-ELI-F', { a: 'a' }), null, 'pas de résultat');
assert.strictEqual(sc('E03-ELI-H', { a: 'a' }), 200, 'Euros ×2');
assert.strictEqual(sc('MO-ELI-H', { a: 'a' }), 300, 'Mondiaux ×3');
// U23 / U19 aux Euros et Mondiaux : 2/3 et 1/3 des points Élites, arrondis à l'entier par course
const resU = {
  'E03-U23-H': [{ ath: 'a', rank: 1 }, { ath: 'b', rank: 2 }], 'E03-U19-H': [{ ath: 'a', rank: 1 }, { ath: 'b', rank: 2 }],
  'MO-U23-H': [{ ath: 'a', rank: 1 }], 'MO-U19-H': [{ ath: 'a', rank: 1 }], 'MO-U23-F': [{ ath: 'a', rank: 3 }],
};
const scU = (id, a) => G.scoreRace(D.RACES[id], { a }, resU);
assert.strictEqual(scU('E03-U23-H', 'a'), 100, 'Euros U23 victoire : 100 × 1');
assert.strictEqual(scU('E03-U23-H', 'b'), 80, 'Euros U23 2e : 80 × 1');
assert.strictEqual(scU('E03-U19-H', 'a'), 67, 'Euros U19 victoire : 100 × 2/3 = 67');
assert.strictEqual(scU('E03-U19-H', 'b'), 53, 'Euros U19 2e : 80 × 2/3 = 53,3 → 53');
assert.strictEqual(scU('MO-U23-H', 'a'), 200, 'Mondiaux U23 victoire = 2/3 de 300');
assert.strictEqual(scU('MO-U19-H', 'a'), 100, 'Mondiaux U19 victoire = 1/3 de 300');
assert.strictEqual(scU('MO-U23-F', 'a'), 120, 'Mondiaux U23 3e : 60 × 2');
assert.strictEqual(G.effectiveAthlete({ a: 'd', d: 'z' }, res, RH), 'z', 'tirage au sort quand titulaire et remplaçant absents');
assert.strictEqual(G.effectiveAthlete({ a: 'd', b: 'd2', d: 'z' }, { [RH]: [{ ath: 'd', status: 'DNS' }, { ath: 'd2', status: 'DNS' }] }, RH), 'z', 'remplaçant aussi DNS : tirage');
assert.strictEqual(G.effectiveAthlete({ a: 'd', b: 'b', d: 'z' }, res, RH), 'b', 'le remplaçant prime sur le tirage');

// ---- DNS à confirmer
assert.deepStrictEqual(
  G.dnsPending([{ ath: 'a', status: 'DNS' }, { ath: 'b', status: 'DNS', confirmed: true }, { ath: 'c', status: 'DNF' }, { ath: 'd', rank: 3 }]).map((e) => e.ath),
  ['a'], 'seul un DNS non confirmé est en attente');
assert.strictEqual(G.dnsPending([]).length, 0);

// ---- Totaux
const picksTot = { 'E01-ELI-H': { a: 'a' }, 'E03-ELI-H': { a: 'a' } };
assert.strictEqual(G.deskScore(1, picksTot, res), 100 + 200);
assert.strictEqual(G.deskScore(2, picksTot, res), 0);
assert.strictEqual(G.sessionScore(sess(3), picksTot, res), 200);
assert.strictEqual(G.generalScore(picksTot, res).total, 300);
assert.deepStrictEqual(G.generalScore(picksTot, res).desks, [300, 0, 0]);

// ---- Bonus des Mondiaux : par catégorie d'âge (H+F) : Élite 200, U23 130, U19 70 ; +600 pour les six titres, cumulables
const wres = {}, picksAll = {};
D.WORLDS.races.forEach((id) => { wres[id] = [{ ath: 'w' + id, rank: 1 }]; picksAll[id] = { a: 'w' + id }; });
const only = (ids) => Object.fromEntries(ids.map((id) => [id, { a: 'w' + id }]));
assert.strictEqual(G.worldsBonus(picksAll, wres).total, 200 + 130 + 70 + 600, 'six titres : 1000 cumulés');
assert.strictEqual(G.worldsBonus(picksAll, wres).lines.length, 4);
assert.strictEqual(G.worldsBonus(only(['MO-ELI-H', 'MO-ELI-F']), wres).total, 200, 'paire Élite : 200');
assert.strictEqual(G.worldsBonus(only(['MO-U23-H', 'MO-U23-F']), wres).total, 130, 'paire U23 : 130');
assert.strictEqual(G.worldsBonus(only(['MO-U19-H', 'MO-U19-F']), wres).total, 70, 'paire U19 : 70');
assert.strictEqual(G.worldsBonus(only(['MO-ELI-H', 'MO-ELI-F', 'MO-U19-H', 'MO-U19-F']), wres).total, 270, 'deux catégories : 200 + 70');
assert.strictEqual(G.worldsBonus(only(['MO-ELI-H', 'MO-U23-H', 'MO-U19-H']), wres).total, 0, 'trois hommes seuls : pas de bonus');
assert.strictEqual(G.worldsBonus(only(['MO-ELI-H', 'MO-U23-F']), wres).total, 0, 'H et F de catégories différentes : rien');
assert.strictEqual(G.worldsBonus({}, wres).total, 0);
assert.strictEqual(G.worldsBonus(picksAll, wres, { pair: { ELI: 150, U23: 100, U19: 50 }, all: 500 }).total, 150 + 100 + 50 + 500, 'valeurs du bonus modifiables');
assert.strictEqual(G.worldsBonus(picksAll, wres, { pair: { U19: 80 } }).total, 200 + 130 + 80 + 600, 'modification partielle');
assert.strictEqual(G.worldsScore(picksAll, wres).races, 2 * 300 + 2 * 200 + 2 * 100, 'six victoires : 600 + 400 + 200');
assert.strictEqual(G.worldsScore(picksAll, wres).total, 1200 + 1000);
// un vainqueur DNS remplacé par le vainqueur : le bonus suit le coureur effectif
const wDns = { 'MO-ELI-H': [{ ath: 'p', status: 'DNS' }, { ath: 'q', rank: 1 }] };
assert.strictEqual(G.worldsWinner(wDns, 'MO-ELI-H'), 'q');
assert.strictEqual(G.worldsWinner({ 'MO-ELI-H': [{ ath: 'q', rank: 1, status: 'DSQ' }] }, 'MO-ELI-H'), null, 'un vainqueur DSQ n’est pas vainqueur');

// ---- Contrainte « une fois par desk, par genre et par catégorie d'âge »
G.setOverrides({});
const picks = { 'E01-ELI-H': { a: 'a' }, 'E02-ELI-H': { a: 'b' }, 'E11-ELI-H': { a: 'a' }, 'E01-ELI-F': { a: 'x' }, 'E03-U23-H': { a: 'u' } };
const u1 = G.usedInDesk(1, 'H', 'ELI', picks, 'E04-ELI-H');
assert.ok(u1.has('a') && u1.has('b') && u1.size === 2, 'desk 1 Élites H : a, b pris');
assert.ok(!G.usedInDesk(1, 'H', 'ELI', picks, 'E01-ELI-H').has('a'), 'on peut modifier sa propre course');
assert.ok(!G.usedInDesk(1, 'F', 'ELI', picks, null).has('a') && G.usedInDesk(1, 'F', 'ELI', picks, null).has('x'), 'pools H et F séparés');
assert.ok(G.usedInDesk(2, 'H', 'ELI', picks, null).has('a'), 'E11 est dans le desk 2 : a y est repris légitimement');
assert.ok(!G.usedInDesk(2, 'H', 'ELI', picks, null).has('b'), 'b n’est pas grillé au desk 2');
assert.ok(G.usedInDesk(1, 'H', 'U23', picks, null).has('u'), 'U23 : u pris dans son pool');
assert.ok(!G.usedInDesk(1, 'H', 'ELI', picks, null).has('u'), 'pool Élites distinct du pool U23');
assert.ok(!G.usedInDesk(1, 'H', 'U19', picks, null).has('u'), 'pool U19 distinct du pool U23');
// Mondiaux : dans le Desk 3, pools par catégorie et genre, partagés avec les courses du desk
const wp = { 'MO-U23-H': { a: 'p' }, 'MO-ELI-F': { a: 'q' } };
assert.ok(G.usedInDesk(3, 'H', 'U23', wp, null).has('p') && !G.usedInDesk(3, 'H', 'ELI', wp, null).has('p'), 'Mondiaux : pool par catégorie');
assert.ok(G.usedInDesk(3, 'F', 'ELI', wp, null).has('q') && !G.usedInDesk(3, 'H', 'ELI', wp, null).has('q'), 'Mondiaux : pool par genre');
assert.ok(!G.usedInDesk(1, 'H', 'U23', wp, null).has('p'), 'Mondiaux : hors desk 1');
assert.ok(G.usedInDesk(3, 'H', 'ELI', { 'E22-ELI-H': { a: 'z' } }, 'MO-ELI-H').has('z'), 'un coureur pris au Desk 3 est grillé pour les Mondiaux');
assert.ok(G.usedInDesk(3, 'H', 'ELI', { 'MO-ELI-H': { a: 'z' } }, 'E22-ELI-H').has('z'), 'un coureur pris aux Mondiaux est grillé pour le reste du Desk 3');
// Les points des Mondiaux et leur bonus comptent dans le Desk 3, sans double comptage au général
const gw = G.generalScore(picksAll, wres);
assert.strictEqual(gw.desks[2], 1200 + 1000, 'Desk 3 = Mondiaux (courses + bonus)');
assert.strictEqual(gw.total, 2200, 'général = somme des trois desks');
// DNS : titulaire libéré (rejouable), remplaçant ou tiré au sort grillé. DNF / DSQ : titulaire grillé.
const rd = { 'E01-ELI-H': [{ ath: 'a', status: 'DNS' }, { ath: 'b', rank: 2 }] };
const ud = G.usedInDesk(1, 'H', 'ELI', { 'E01-ELI-H': { a: 'a', b: 'b' } }, null, rd);
assert.ok(!ud.has('a') && ud.has('b') && ud.size === 1, 'DNS : titulaire libéré, remplaçant grillé');
assert.strictEqual(G.usedInDesk(1, 'H', 'ELI', { 'E01-ELI-H': { a: 'a' } }, null, rd).size, 0, 'DNS sans remplaçant : personne de grillé');
const ud2 = G.usedInDesk(1, 'H', 'ELI', { 'E01-ELI-H': { a: 'a', d: 'z' } }, null, rd);
assert.ok(!ud2.has('a') && ud2.has('z'), 'DNS : le coureur tiré au sort est grillé');
const ud3 = G.usedInDesk(1, 'H', 'ELI', { 'E01-ELI-H': { a: 'a', b: 'b2', d: 'z' } }, null, { 'E01-ELI-H': [{ ath: 'a', status: 'DNS' }, { ath: 'b2', status: 'DNS' }] });
assert.ok(!ud3.has('a') && !ud3.has('b2') && ud3.has('z'), 'titulaire et remplaçant DNS : seul le tiré au sort est grillé');
assert.ok(G.usedInDesk(1, 'H', 'ELI', { 'E01-ELI-H': { a: 'c' } }, null, { 'E01-ELI-H': [{ ath: 'c', status: 'DNF' }] }).has('c'), 'DNF : grillé');
assert.ok(G.usedInDesk(1, 'H', 'ELI', { 'E01-ELI-H': { a: 'e' } }, null, { 'E01-ELI-H': [{ ath: 'e', status: 'DSQ' }] }).has('e'), 'DSQ : grillé');
assert.ok(G.usedInDesk(1, 'H', 'ELI', { 'E01-ELI-H': { a: 'f' } }, null, { 'E01-ELI-H': [{ ath: 'f', rank: 25, status: 'PULLED' }] }).has('f'), 'pulled : grillé');
assert.ok(G.usedInDesk(1, 'H', 'ELI', { 'E01-ELI-H': { a: 'a' } }, null).has('a'), 'avant résultat : le titulaire compte');

// ---- Fuseau horaire (heure d'hiver, pas de changement d'heure sur la saison)
assert.strictEqual(G.parisInstant('2026-10-24', '10:00').toISOString(), '2026-10-24T08:00:00.000Z', 'CEST +2');
assert.strictEqual(G.parisInstant('2026-11-01', '14:30').toISOString(), '2026-11-01T13:30:00.000Z', 'CET +1');
assert.strictEqual(G.parisInstant('2027-01-30', '10:30').toISOString(), '2027-01-30T09:30:00.000Z');

// ---- Deadlines et états de session
const s1 = sess(1);
assert.strictEqual(G.sessionDeadline(s1).toISOString(), '2026-11-01T12:00:00.000Z', 'deadline = départ de la 1re course (F, 13 h)');
assert.strictEqual(G.sessionState(s1, new Date('2026-11-01T11:59:00Z')), 'ouverte');
assert.strictEqual(G.sessionState(s1, new Date('2026-11-01T12:00:00Z')), 'en cours');
assert.strictEqual(G.sessionState(s1, new Date('2026-11-02T02:00:00Z')), 'terminée');
assert.strictEqual(G.sessionDeadline(sess(3)).toISOString(), '2026-11-07T09:30:00.000Z', 'Euros : deadline = 1re course du samedi');
assert.ok(G.raceLocked(G.raceOf('E03-ELI-H'), new Date('2026-11-07T09:30:00Z')), 'Euros : toute la session se verrouille à la 1re course');
assert.ok(!G.raceLocked(G.raceOf('E03-ELI-H'), new Date('2026-11-07T09:29:00Z')));
assert.strictEqual(G.deskIdOf('MO-ELI-H'), 3, 'les Mondiaux comptent dans le Desk 3');
assert.strictEqual(G.deskIdOf('E22-ELI-F'), 3);

// ---- Calendrier vivant : annulation, report, heure confirmée
G.setOverrides({ 'E01-ELI-F': { status: 'cancelled' } });
assert.ok(G.raceOf('E01-ELI-F').cancelled);
assert.strictEqual(G.scoreRace(G.raceOf('E01-ELI-F'), { a: 'a' }, { 'E01-ELI-F': [{ ath: 'a', rank: 1 }] }), null, 'course annulée : rien à marquer');
assert.ok(!G.usedInDesk(1, 'F', 'ELI', { 'E01-ELI-F': { a: 'z' } }, null).has('z'), 'annulée : coureur libéré');
assert.ok(G.usedInDesk(1, 'H', 'ELI', { 'E01-ELI-H': { a: 'z' } }, null).has('z'), 'course maintenue : coureur pris');
assert.strictEqual(G.activeRaces(s1).length, 1);
assert.strictEqual(G.sessionDeadline(s1).toISOString(), '2026-11-01T13:30:00.000Z', 'F annulée : la session s’ouvre jusqu’au départ des H');

G.setOverrides({ 'E01-ELI-H': { date: '2026-11-02', time: '14:30', moved: true } });
const hMoved = G.raceOf('E01-ELI-H');
assert.strictEqual(G.raceLockTime(hMoved).toISOString(), '2026-11-02T13:30:00.000Z', 'course reportée : verrou = nouveau départ');
assert.strictEqual(G.raceLockTime(G.raceOf('E01-ELI-F')).toISOString(), '2026-11-01T12:00:00.000Z', 'les autres gardent la deadline de session');
assert.ok(!G.raceLocked(hMoved, new Date('2026-11-01T20:00:00Z')), 'reportée : encore modifiable après la deadline de session');
assert.ok(G.raceLocked(hMoved, new Date('2026-11-02T13:30:00Z')));
G.setOverrides({ 'E01-ELI-H': { date: '2027-02-15', time: '10:00', moved: true } });
assert.strictEqual(G.sessionState(s1, new Date('2026-11-05T10:00:00Z')), 'terminée', 'un report lointain ne retient pas la session');

G.setOverrides({ 'E01-ELI-F': { time: '12:00' } });
assert.ok(G.raceOf('E01-ELI-F').timeKnown, 'heure posée par l’admin = confirmée');
assert.strictEqual(G.sessionDeadline(s1).toISOString(), '2026-11-01T11:00:00.000Z');
G.setOverrides({ 'MO-ELI-H': { date: '2027-01-31' } });
assert.ok(G.raceOf('MO-ELI-H').dateKnown, 'jour posé par l’admin = confirmé');
G.setOverrides({});

// ---- Tirage au sort (propositions, reproductibles)
assert.strictEqual(G.drawRider('s', []), null);
assert.deepStrictEqual(G.drawRider('s', ['x', 'y', 'z']), G.drawRider('s', ['x', 'y', 'z']), 'même graine, même tirage');
{
  const start = Array.from({ length: 30 }, (_, i) => ({ bib: i + 1, ath: 'r' + (i + 1) }));
  const meta = { [RH]: { start: start.slice().reverse() } }; // ordre quelconque : le tri se fait par dossard
  const rs = { [RH]: [{ ath: 'a', status: 'DNS' }, { ath: 'b', status: 'DNS' }, { ath: 'r1', status: 'DNS' }, { ath: 'r3', rank: 1 }] };
  const byPlayer = {
    p1: { [RH]: { a: 'a', b: 'b' }, 'E02-ELI-H': { a: 'r2' } },   // r2 déjà grillé dans le desk 1
    p2: { [RH]: { a: 'a', b: 'r5' } },                            // le remplaçant joue : pas de tirage
    p3: { [RH]: { a: 'a', b: 'b', d: 'r9' } },                    // déjà tiré
    p4: { [RH]: { a: 'r3' } },                                    // titulaire au départ
    p5: { [RH]: { a: 'a' } },                                     // pas de remplaçant
    p6: { [RH]: { a: 'a', b: 'b' }, 'E03-U23-H': { a: 'r4' } },   // r4 pris, mais en U23 : reste tirable en Élites
  };
  const out = G.autoDraws(rs, meta, byPlayer);
  assert.deepStrictEqual(Object.keys(out[RH]).sort(), ['p1', 'p5', 'p6'], 'un tirage par joueur concerné');
  const top20 = start.slice(0, 20).map((x) => x.ath);
  assert.strictEqual(out[RH].p1.seed, `${RH}|p1|${top20.join(',')}`, 'graine = course|joueur|20 premiers de la grille');
  assert.strictEqual(out[RH].p1.candidates.length, 18, '20 premiers − r1 (DNS) − r2 (grillé)');
  assert.ok(!out[RH].p1.candidates.includes('r1') && !out[RH].p1.candidates.includes('r2') && !out[RH].p1.candidates.includes('r21'));
  assert.strictEqual(out[RH].p5.candidates.length, 19, '20 premiers − r1 (DNS)');
  assert.strictEqual(out[RH].p6.candidates.length, 19);
  assert.ok(out[RH].p6.candidates.includes('r4'), 'U23 et Élites sont des pools distincts');
  Object.values(out[RH]).forEach((d) => assert.ok(top20.includes(d.ath) && d.ath !== 'r1', 'tiré parmi les 20 premiers dossards, hors non-partants'));
  assert.notStrictEqual(out[RH].p1.seed, out[RH].p5.seed, 'graine différente par joueur');
  assert.deepStrictEqual(G.autoDraws(rs, { [RH]: { start } }, byPlayer), out, 'indépendant de l’ordre de la liste');
  assert.deepStrictEqual(G.autoDraws(rs, meta, byPlayer), out, 'reproductible');
  assert.deepStrictEqual(G.autoDraws({}, meta, byPlayer), {}, 'sans résultat : aucun tirage');
  assert.deepStrictEqual(G.autoDraws(rs, { [RH]: {} }, byPlayer), {}, 'sans liste de départ : aucun tirage');
}

// ---- Rentabilité d'un choix
{
  const rid = 'E02-ELI-F', race = G.raceOf(rid), ids = ['me', 'a', 'b', 'c'];
  const r2 = { [rid]: [1, 2, 3, 4, 5].map((r) => ({ ath: 'x' + r, rank: r })) };
  const pk = (a) => ({ [rid]: { a } });
  const pp = { me: pk('x4'), a: pk('x1'), b: pk('x2'), c: pk('x4') };
  const an = G.pickAnalysis(race, 'me', pp, r2, ids);
  assert.strictEqual(an.mine, 50);
  assert.strictEqual(an.race.n, 3); assert.strictEqual(an.race.avg, (100 + 80 + 50) / 3);
  assert.strictEqual(an.rider.n, 1); assert.strictEqual(an.rider.ok, false, 'un seul autre joueur : pas assez de données');
  assert.ok(an.provisional && an.rating > 0 && an.rating <= 5 && an.rating * 2 === Math.round(an.rating * 2));
  assert.strictEqual(G.pickAnalysis(race, 'me', { me: pk('x4'), a: pk('x1') }, r2, ids).rating, null, 'trop peu de joueurs : attente');
  assert.strictEqual(G.pickAnalysis(race, 'me', { me: pk('x9'), a: pk('x1'), b: pk('x2') }, r2, ids).rating, 0, '0 point = 0');
  assert.strictEqual(G.pickAnalysis(race, 'me', { me: pk('x1'), a: pk('x4'), b: pk('x5') }, r2, ids).rating, 5, 'victoire face au peloton = 5');
  assert.strictEqual(G.pickAnalysis(race, 'me', { a: pk('x1') }, r2, ids), null);
}

{ // petit globe par catégorie
  const R = { 'E01-ELI-H': [{ ath: 'a', rank: 1 }], 'E03-U23-H': [{ ath: 'b', rank: 1 }] };
  const pk = { 'E01-ELI-H': { a: 'a' }, 'E03-U23-H': { a: 'b' } };
  assert.strictEqual(G.categoryScore('ELI', pk, R), 100);
  assert.strictEqual(G.categoryScore('U23', pk, R), 100, 'Euros U23 : ×1');
  assert.strictEqual(G.categoryScore('U19', pk, R), 0);
  assert.ok(G.genderScore('H', pk, R) + G.genderScore('F', pk, R) >= 100, 'quête annexe hommes/femmes');
}
console.log('Tous les tests passent.');
