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
const races = [], ath = {}, warn = [];
const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
for (const it of idx) {
  const label = it.cat.toLowerCase().replace(/\s*\(.*\)/, '').trim(), c = CAT[label];
  if (!c || !it.pdf) { if (!c) warn.push('catégorie ignorée : ' + it.cat); continue; }
  const text = fs.readFileSync(path.join(dir, it.file), 'utf8'), { rows } = P.parse(text);
  const nowc = /no world cup/i.test(it.cat);
  const res = rows.map((r) => {
    const key = N.nameKey(r.name), known = byKey[key];
    const id = known ? known.id : N.slug(N.displayName(r.name));
    if (!ath[id]) ath[id] = { name: known ? known.name : N.displayName(r.name), nat: r.nat, g: c[1], cat: c[0], listed: !!known };
    return [id, r.status || r.rank];
  });
  const place = it.place.replace(/\s*\(.*\)/, '');
  races.push({ id: `${it.date}-${N.slug(place)}-${c[0]}-${c[1]}`, series: 'CdM', place, date: it.date, cat: c[0], g: c[1], nowc: nowc || undefined, res });
}
races.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
const out = { season, generated: new Date().toISOString().slice(0, 10), source: 'UCI Coupe du monde de cyclo-cross (classements officiels ChronoRace)', races, ath };
fs.writeFileSync(path.join(__dirname, '..', 'data', `history-${season}.json`), JSON.stringify(out));
console.log(races.length + ' courses, ' + Object.keys(ath).length + ' coureurs (' + Object.values(ath).filter((a) => a.listed).length + ' dans la liste UCI)');
warn.forEach((w) => console.log(w));
