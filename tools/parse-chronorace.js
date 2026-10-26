/* CX GAME – lecture des classements ChronoRace (texte extrait des PDF officiels, pdftotext -layout) -> lignes « rang|NOM Prénom|pays|temps » ou « DNF|NOM Prénom|pays ».
   Les coureurs doublés gardent leur rang (temps vide). Usage : node tools/parse-chronorace.js <fichier.txt> */
'use strict';
const fs = require('fs');
function parse(text) {
  const out = [], seen = new Set(); let total = null;
  for (const raw of text.split(/\r?\n/)) {
    let m = raw.match(/^\s*(\d+)\.\s+(\d+)\s+(.+?)\s+([A-Z]{3})\s+(\d{4})\s+(.*)$/);      // « 1. 13 NYS Thibau  BEL 2002 1:03:39 - »
    if (m) {
      const rank = Number(m[1]), key = 'r' + rank + m[3];
      if (seen.has(key)) continue; seen.add(key);
      const tail = m[6].trim(), t = tail.match(/^(\d+:\d\d:\d\d|\d+:\d\d)/);
      out.push({ rank, name: m[3].trim(), nat: m[4], time: t ? t[1] : '' });
      continue;
    }
    m = raw.match(/^\s{6,}(\d+)\s+(.+?)\s+([A-Z]{3})\s+(\d{4})\s+(DNF|DNS|DSQ|OTL)\b/);   // « 31 ROUILLER Loris SUI 2000 DNF » (sans rang)
    if (m) { const key = 's' + m[2]; if (seen.has(key)) continue; seen.add(key); out.push({ status: m[5] === 'OTL' ? 'DNF' : m[5], name: m[2].trim(), nat: m[3] }); }
  }
  const e = text.match(/Entries \/ Nations\s*\n\s*(\d+)/); if (e) total = Number(e[1]);
  return { rows: out, entries: total };
}
const toText = (rows) => rows.map((r) => (r.status ? `${r.status}|${r.name}|${r.nat}` : `${r.rank}|${r.name}|${r.nat}|${r.time}`)).join('\n');
module.exports = { parse, toText };
if (require.main === module) { const r = parse(fs.readFileSync(process.argv[2], 'utf8')); console.error(r.rows.length + ' lignes (départs annoncés : ' + r.entries + ')'); console.log(toText(r.rows)); }
