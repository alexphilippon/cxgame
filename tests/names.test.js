const assert = require('assert');
const N = require('../js/names.js');
const { parseRanking } = require('../tools/build-athletes.js');

// ---- Clé de rapprochement : sans accents, minuscules, mots triés
assert.strictEqual(N.nameKey('VAN DER POEL Mathieu'), N.nameKey('Mathieu van der Poel'), 'ordre et casse indifférents');
assert.strictEqual(N.nameKey('Van der Poel Mathieu'), 'der mathieu poel van');
assert.strictEqual(N.nameKey('ZEMANOVÁ Kristyna'), N.nameKey('Kristyna Zemanova'), 'accents');
assert.strictEqual(N.nameKey('Lars Sommer'), N.nameKey('SOMMER, Lars'), 'ponctuation');
assert.strictEqual(N.nameKey('LELANDAIS Rémi'), N.nameKey('Remi Lelandais'));
assert.strictEqual(N.nameKey('Møller Åse'), N.nameKey('MOLLER Ase'), 'lettres spéciales');
assert.strictEqual(N.nameKey('SUAREZ FERNANDEZ Kevin'), N.nameKey('Kevin Suarez-Fernandez'), 'trait d’union');
assert.notStrictEqual(N.nameKey('CLAUZEL Hélène'), N.nameKey('CLAUZEL Perrine'), 'deux Clauzel');
assert.notStrictEqual(N.nameKey('AGOSTINACCHIO Filippo'), N.nameKey('AGOSTINACCHIO Mattia'));
assert.strictEqual(N.nameKey(''), '');
assert.strictEqual(N.nameKey(null), '');

// ---- Affichage « Prénom Nom »
assert.strictEqual(N.displayName('VANDEPUTTE Niels'), 'Niels Vandeputte');
assert.strictEqual(N.displayName('VAN DER POEL Mathieu'), 'Mathieu van der Poel');
assert.strictEqual(N.displayName('DE BRUYCKERE Kay'), 'Kay de Bruyckere');
assert.strictEqual(N.displayName('DEL GROSSO Tibor'), 'Tibor del Grosso');
assert.strictEqual(N.displayName('ORTS LLORET Felipe'), 'Felipe Orts Lloret');
assert.strictEqual(N.displayName('ALVARADO Ceylin Del Carmen'), 'Ceylin Del Carmen Alvarado');
assert.strictEqual(N.displayName('ZEMANOVÁ Kristyna'), 'Kristyna Zemanová');
assert.strictEqual(N.displayName('MCGILL Sidney'), 'Sidney McGill');
assert.strictEqual(N.displayName('JUNQUERA SAN MILLAN Mario'), 'Mario Junquera San Millan');
assert.strictEqual(N.displayName('Mathieu van der Poel'), 'Mathieu Van Der Poel', 'sans partie NOM détectée : pas de devinette');
assert.strictEqual(N.slug('Mathieu van der Poel'), 'mathieu-van-der-poel');
assert.strictEqual(N.slug('Kristyna Zemanová'), 'kristyna-zemanova');

// ---- Lecture d'un classement : contrôles
const ok = '# commentaire\n1|AAA Bob|Belgique|Team X|100\n2|BBB Carl|Pays-Bas||90\n3|CCC Dan|Canada|Team Y|90\n';
const r = parseRanking(ok, 'T');
assert.strictEqual(r.athletes.length, 3);
assert.deepStrictEqual(r.athletes[1], { id: 'carl-bbb', name: 'Carl Bbb', src: 'BBB Carl', key: 'bbb carl', nat: 'NED', rank: 2, pts: 90 }, 'équipe vide : champ absent');
assert.strictEqual(r.athletes[0].team, 'Team X');
assert.throws(() => parseRanking('1|A B|Belgique||10\n3|C D|Belgique||9\n', 'T'), /non consécutifs/);
assert.throws(() => parseRanking('1|A B|Belgique||10\n2|C D|Belgique||11\n', 'T'), /points remontent/);
assert.throws(() => parseRanking('1|A B|Belgique||10\n2|B A|Belgique||9\n', 'T'), /double/);
assert.throws(() => parseRanking('1|A B|Belgique|10\n', 'T'), /5 champs/);
assert.throws(() => parseRanking('# rien\n', 'T'), /vide/);
assert.deepStrictEqual(parseRanking('1|A B|Atlantide||10\n', 'T').warnings.length, 1, 'pays inconnu signalé');

console.log('Tous les tests passent (noms).');
