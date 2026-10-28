/* CX GAME – calendrier cyclo-cross 2026-2027
   Sources : calendrier sporza.be 2026-2027 (fourni par Alexandre) ; programme des Euros de Zeddam : bulletin d'information UEC (v13/04/2026) ;
   Mondiaux d'Ostende 29-31 janvier 2027 : jours par catégorie NON publiés, répartition provisoire calquée sur les Euros.
   Heures de départ : PROVISOIRES partout (timeKnown = false) tant que l'admin ne les a pas confirmées.
   Les heures provisoires sont volontairement tôt : mieux vaut verrouiller un peu avant le vrai départ qu'après. */
(function (root) {
  'use strict';

  const CATS = {
    ELI: { fr: 'Élites', short: 'Élite' },
    U23: { fr: 'Moins de 23 ans', short: 'U23' },
    U19: { fr: 'Moins de 19 ans', short: 'U19' },
  };
  const CAT_ORDER = ['ELI', 'U23', 'U19'];
  const GENDERS = { H: 'Hommes', F: 'Femmes' };

  const SERIES = {
    XO: { fr: 'X²O', short: 'X²O' },
    SP: { fr: 'Superprestige', short: 'SP' },
    EX: { fr: 'HG Cross', short: 'HG' },
    CM: { fr: 'Coupe du monde UCI', short: 'CdM' },
    EU: { fr: 'Championnats d’Europe', short: 'Euros' },
    MO: { fr: 'Championnats du monde', short: 'Mondiaux' },
  };

  // Format : n°|série|lieu|date   (une réunion = Élites H+F le même jour, sauf Euros : voir BIG ci-dessous)
  const EVENTS_RAW = `
1|XO|Oudenaarde|2026-11-01
2|SP|Middelkerke|2026-11-05
3|EU|Zeddam|2026-11-07
4|SP|Niel|2026-11-11
5|SP|Merksplas|2026-11-14
6|XO|Hamme-Zogge|2026-11-15
7|EX|Lokeren|2026-11-21
8|XO|Beringen|2026-11-22
9|CM|Ostrava|2026-11-27
10|CM|Tábor|2026-11-29
11|SP|Ruddervoorde|2026-12-06
12|CM|Glasgow|2026-12-13
13|EX|Mol|2026-12-17
14|CM|Anvers|2026-12-19
15|CM|Koksijde|2026-12-20
16|XO|Hofstade|2026-12-22
17|XO|Loenhout|2026-12-23
18|SP|Heusden-Zolder|2026-12-25
19|CM|Gavere|2026-12-26
20|CM|Namur|2026-12-27
21|CM|Besançon|2026-12-29
22|SP|Diegem|2026-12-30
23|XO|Baal|2027-01-01
24|SP|Gullegem|2027-01-02
25|CM|Zonhoven|2027-01-03
26|CM|Benidorm|2027-01-17
27|CM|Hamme|2027-01-23
28|CM|Hoogerheide|2027-01-24
29|EX|Maldegem|2027-02-03
30|XO|Lille|2027-02-07
31|EX|Sint-Niklaas|2027-02-13
32|XO|Bruxelles|2027-02-14
`;

  // Mondiaux : Élite ×3, U23 ×2, U19 ×1 (base × k / 3). Euros : Élite ×2, U23 ×1, U19 ×2/3.
  // (Un U23 peut aussi courir en Élite : le pool dépend de la catégorie de la COURSE, pas de l'âge du coureur.)
  const CAT_K = { ELI: 3, U23: 2, U19: 1 };
  const multOf = (base, cat) => (base * CAT_K[cat]) / 3;
  const EURO_MULT = { ELI: 2, U23: 1, U19: 2 / 3 };

  const pad = (n) => String(n).padStart(2, '0');
  const raceId = (ev, cat, g) => `${ev}-${cat}-${g}`;

  // Heures provisoires (heure de Paris), tôt par prudence.
  const T_ELITE = { F: '13:00', H: '14:30' };
  // Euros et Mondiaux : 6 courses sur 2 jours. jour 0 = samedi, 1 = dimanche (Euros : bulletin UEC ; Mondiaux : provisoire).
  const BIG = {
    'U19-F': { day: 0, time: '10:30' }, 'U23-H': { day: 0, time: '12:00' }, 'ELI-F': { day: 0, time: '14:00' },
    'U19-H': { day: 1, time: '10:30' }, 'U23-F': { day: 1, time: '12:00' }, 'ELI-H': { day: 1, time: '14:00' },
  };
  const EURO_DAYS = ['2026-11-07', '2026-11-08'];
  const WORLDS_DAYS = ['2027-01-30', '2027-01-31'];

  const RACES = {};
  function addRace(o) {
    RACES[o.id] = Object.assign({ sub: '', timeKnown: false, dateKnown: true }, o);
  }

  const EVENTS = [];
  EVENTS_RAW.trim().split('\n').forEach((line) => {
    const [n, serie, place, date] = line.split('|');
    const ev = 'E' + pad(n);
    const e = { id: ev, n: Number(n), serie, place, date, name: `${SERIES[serie].short} ${place}`, races: [] };
    if (serie === 'EU') {
      // Euros : Élites H et F ne courent pas le même jour, + U23 et U19 H+F. Barème ×2.
      Object.keys(BIG).forEach((k) => {
        const [cat, g] = k.split('-');
        const id = raceId(ev, cat, g);
        addRace({ id, ev, serie, cat, gender: g, n: e.n, place, date: EURO_DAYS[BIG[k].day], time: BIG[k].time, mult: EURO_MULT[cat], kind: 'euro' });
        e.races.push(id);
      });
    } else {
      ['F', 'H'].forEach((g) => {
        const id = raceId(ev, 'ELI', g);
        addRace({ id, ev, serie, cat: 'ELI', gender: g, n: e.n, place, date, time: T_ELITE[g], mult: 1, kind: 'cx' });
        e.races.push(id);
      });
    }
    EVENTS.push(e);
  });

  // Mondiaux d'Ostende : Élite, U23, U19, H+F (6 courses), barème ×3. Jours par catégorie à confirmer.
  const WORLDS_RACES = [];
  Object.keys(BIG).forEach((k) => {
    const [cat, g] = k.split('-');
    const id = raceId('MO', cat, g);
    addRace({ id, ev: 'MO', serie: 'MO', cat, gender: g, n: 0, place: 'Ostende', date: WORLDS_DAYS[BIG[k].day], time: BIG[k].time, dateKnown: false, mult: multOf(3, cat), kind: 'mondial' });
    WORLDS_RACES.push(id);
  });

  // Une session = une réunion ; sa deadline est le départ de sa première course.
  const DESKS = [
    { id: 1, name: 'Desk 1', from: '2026-11-01', to: '2026-11-29' },
    { id: 2, name: 'Desk 2', from: '2026-12-06', to: '2026-12-29' },
    { id: 3, name: 'Desk 3', from: '2026-12-30', to: '2027-02-14' },
  ];
  const deskOfDate = (date) => { const d = DESKS.find((x) => date >= x.from && date <= x.to); return d ? d.id : 0; };

  const SESSIONS = EVENTS.map((e) => ({
    id: e.n, desk: deskOfDate(e.date), name: e.name, races: e.races,
  }));

  const WORLDS = { id: 'MO', desk: 3, name: 'Championnats du monde d’Ostende', races: WORLDS_RACES };

  // Barème identique au ski : 100, 80, 60, 50, 45, 40, 36, 32, 29, 26, 24, 22, 20, 18, 16, 15 … 1 (30 places).
  const POINTS = [100, 80, 60, 50, 45, 40, 36, 32, 29, 26, 24, 22, 20, 18, 16,
    15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

  // Bonus des Mondiaux (modifiables par l'admin) : les deux vainqueurs H+F d'une catégorie d'âge (selon la catégorie, mêmes proportions 1 / 2/3 / 1/3,
  // valeurs rondes proposées, à valider) ; les six titres.
  const WORLDS_BONUS = { pair: { ELI: 200, U23: 130, U19: 70 }, all: 600 };

  const api = { CATS, CAT_ORDER, GENDERS, SERIES, EVENTS, RACES, SESSIONS, WORLDS, DESKS, POINTS, WORLDS_BONUS, deskOfDate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CX_DATA = api;
})(typeof window !== 'undefined' ? window : globalThis);
