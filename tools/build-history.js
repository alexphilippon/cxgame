#!/usr/bin/env node
/* CX GAME – construit data/history-<saison>.json (résultats de la saison passée, pour la Data room et les fiches coureurs)
   à partir des classements bruts : Coupe du monde (data/raw/wc-<saison>/*.txt, PDF officiels ChronoRace).
   Usage : node tools/build-history.js 2025-2026 */
'use strict';
const fs = require('fs'), path = require('path');
const N = require('../js/names.js'), A = require('../js/athletes.js'), P = require('./parse-chronorace.js');
const season = process.argv[2] || '2025-2026';
const dir = path.join(__dirname, '..', 'data', 'raw', 'wc-' + season);
const byKey = {};
for (const g of Object.keys(A.lists)) for (const a of A.lists[g]) byKey[N.nameKey(a.src || a.name)] = a;
const CAT = { 'men elite': ['ELI', 'H'], 'women elite': ['ELI', 'F'], 'men u23': ['U23', 'H'], 'women u23': ['U23', 'F'], 'men u19': ['U19', 'H'], 'women u19': ['U19', 'F'] };
const races = [], ath = {}, warn = [], seenKey = {};
function add(series, place, date, cat, g, rows, nowc) {
  const res = rows.map((r) => {
    const nk = N.nameKey(r.name), known = byKey[nk], id = known ? known.id : (seenKey[nk] || N.slug(N.displayName(r.name)));
    seenKey[nk] = id;
    if (!ath[id]) ath[id] = { name: known ? known.name : N.displayName(r.name), nat: r.nat, g, cat, listed: !!known };
    return [id, r.status || r.rank];
  });
  races.push({ id: `${date}-${N.slug(place)}-${cat}-${g}`, series, place, date, cat, g, nowc: nowc || undefined, res });
}
// Coupe du monde (PDF officiels ChronoRace)
const idx = fs.existsSync(path.join(dir, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')) : [];
for (const it of idx) {
  const label = it.cat.toLowerCase().replace(/\s*\(.*\)/, '').trim(), c = CAT[label];
  if (!c || !it.pdf) { if (!c) warn.push('catégorie ignorée : ' + it.cat); continue; }
  const { rows } = P.parse(fs.readFileSync(path.join(dir, it.file), 'utf8'));
  add('CdM', it.place.replace(/\s*\(.*\)/, ''), it.date, c[0], c[1], rows, /no world cup/i.test(it.cat));
}
// Superprestige (PDF officiels, data/raw/series/sp-*.txt) : élites hommes et femmes, juniors (U19) ; les U23 courent avec les élites
const SP = require('./parse-superprestige.js'), sdir = path.join(__dirname, '..', 'data', 'raw', 'series');
const y0 = Number(season.slice(0, 4));
if (fs.existsSync(sdir)) for (const f of fs.readdirSync(sdir).filter((x) => /^sp-\d+\.txt$/.test(x))) {
  const r = SP.parse(fs.readFileSync(path.join(sdir, f), 'utf8')), h = r.head, c = h && SP.category(h.label);
  if (!c || !h.place || h.date < `${y0}-08-01` || h.date > `${y0 + 1}-07-31`) continue;
  const girl = (x) => /WOMEN|^WU|^WJ|MEISJES|^WE/i.test(x.cat);
  const groups = c.g === 'MIX' ? [['H', r.rows.filter((x) => !girl(x) && x.yob >= y0 - 17)], ['F', r.rows.filter((x) => girl(x) && x.yob >= y0 - 17)]] : [[c.g, r.rows]];
  for (const [g, rows0] of groups) {
    const rows = c.g === 'MIX' ? rows0.filter((x) => x.yob <= y0 - 16).sort((a, b) => (a.status ? 1 : 0) - (b.status ? 1 : 0) || (a.rank || 0) - (b.rank || 0)) : rows0;
    let k = 0; const rr = rows.map((x) => (x.status ? x : Object.assign({}, x, { rank: ++k })));
    if (rr.length) add('SP', h.place, h.date, c.cat, g, rr, false);
  }
}
// HG Cross (ex-Exact Cross) : classements Chronorace/ACN Timing (data/raw/hg/*.json) ; juniors = U19
const hdir = path.join(__dirname, '..', 'data', 'raw', 'hg');
const HGC = { 31: ['ELI', 'H'], 32: ['ELI', 'F'], 34: ['U19', 'H'], 35: ['U19', 'F'] };
if (fs.existsSync(hdir)) for (const f of fs.readdirSync(hdir).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(hdir, f), 'utf8')), c = HGC[j.group];
  if (!c || j.date < `${y0}-08-01` || j.date > `${y0 + 1}-07-31`) continue;
  const rows = j.rows.map((r) => (typeof r[0] === 'number' ? { rank: r[0], name: r[1], nat: r[2] } : { status: r[0], name: r[1], nat: r[2] }));
  if (rows.length) add('HG', j.place, j.date, c[0], c[1], rows, false);
}
// X²O Trofee : classements saisis depuis cyclocross24 (data/raw/xo/AAAA-MM-JJ-Lieu-H|F.txt, lignes « rang|Prénom Nom|PAYS »)
const xdir = path.join(__dirname, '..', 'data', 'raw', 'xo');
if (fs.existsSync(xdir)) for (const f of fs.readdirSync(xdir).filter((x) => /^\d{4}-\d\d-\d\d-.+-[HF]\.txt$/.test(x))) {
  const [, date, place, g] = f.match(/^(\d{4}-\d\d-\d\d)-(.+)-([HF])\.txt$/);
  if (date < `${y0}-08-01` || date > `${y0 + 1}-07-31`) continue;
  const rows = fs.readFileSync(path.join(xdir, f), 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => { const [a, name, nat] = l.split('|'); return /^\d+$/.test(a) ? { rank: Number(a), name, nat } : { status: a, name, nat }; });
  if (rows.length) add('XO', place, date, 'ELI', g, rows, false);
}
races.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
const out = { season, generated: new Date().toISOString().slice(0, 10), source: 'UCI Coupe du monde de cyclo-cross (ChronoRace) Superprestige, HG Cross et X²O Trofee (classements officiels / cyclocross24)', races, ath };
fs.writeFileSync(path.join(__dirname, '..', 'data', `history-${season}.json`), JSON.stringify(out));
console.log(races.length + ' courses, ' + Object.keys(ath).length + ' coureurs (' + Object.values(ath).filter((a) => a.listed).length + ' dans la liste UCI)');
warn.forEach((w) => console.log(w));
