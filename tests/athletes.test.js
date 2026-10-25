const assert = require('assert');
const A = require('../js/athletes.js');
const N = require('../js/names.js');

assert.deepStrictEqual(Object.keys(A.lists).sort(), ['ELI-F', 'ELI-H'], 'listes disponibles : Élites H et F (U23/U19 : pas encore de source)');
Object.keys(A.lists).forEach((k) => {
  const l = A.lists[k];
  assert.strictEqual(l.length, 100, k + ' : 100 coureurs');
  l.forEach((a, i) => {
    assert.strictEqual(a.rank, i + 1, k + ' : rangs consécutifs');
    assert.ok(a.id && a.name && a.key && /^[A-Z]{3}$/.test(a.nat), k + ' : champs complets ' + a.src);
    assert.strictEqual(a.key, N.nameKey(a.src), 'clé cohérente avec nameKey');
    assert.strictEqual(a.key, N.nameKey(a.name), 'clé identique pour « NOM Prénom » et « Prénom Nom »');
    if (i) assert.ok(a.pts <= l[i - 1].pts, k + ' : points décroissants');
  });
  assert.strictEqual(new Set(l.map((a) => a.id)).size, 100, k + ' : ids uniques');
  assert.strictEqual(new Set(l.map((a) => a.key)).size, 100, k + ' : clés uniques');
});

// rapprochement par clé depuis d'autres écritures (start lists, résultats)
const byKey = (list) => Object.fromEntries(A.lists[list].map((a) => [a.key, a]));
const H = byKey('ELI-H'), F = byKey('ELI-F');
assert.strictEqual(H[N.nameKey('Mathieu van der Poel')].rank, 2);
assert.strictEqual(H[N.nameKey('Van Aert Wout')].nat, 'BEL');
assert.strictEqual(H[N.nameKey('Remi Lelandais')].src, 'LELANDAIS Rémi', 'sans accent');
assert.strictEqual(F[N.nameKey('Kristyna Zemanova')].nat, 'CZE', 'sans accent');
assert.strictEqual(F[N.nameKey('Lucinda Brand')].rank, 1);
assert.strictEqual(F[N.nameKey('Hélène Clauzel')].rank, 17);
assert.strictEqual(F[N.nameKey('Perrine Clauzel')].rank, 48);
assert.strictEqual(H[N.nameKey('Lucinda Brand')], undefined, 'une coureuse n’est pas dans la liste Hommes');

console.log('Tous les tests passent (coureurs).');
