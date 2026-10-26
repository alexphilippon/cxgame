/* CX GAME – lecture des classements Superprestige (PDF officiels, texte pdftotext -layout) :
   en-tête (épreuve, date, catégorie) + lignes « Plaats Nr NOM Prénom NAT######## … Tijd ». */
'use strict';
const fs = require('fs');
function header(text) {
  const L = text.split(/\r?\n/).slice(0, 12);
  const ev = (L.find((l) => /SUPERPRESTIGE/i.test(l)) || '').match(/SUPERPRESTIGE\s+([A-ZÀ-Ý' -]+?)\s*(?:-.*)?$/i);
  const di = L.findIndex((l) => /\d\d\/\d\d\/\d{4}/.test(l));
  if (di < 0) return null;
  const d = L[di].match(/(\d\d)\/(\d\d)\/(\d{4})/);
  let label = L[di].slice(L[di].indexOf(d[0]) + 10).replace(/^[\s-]+/, '').replace(/^Veldrijden\s*/i, '').trim();
  if (!label) { const nx = L.slice(di + 1).find((l) => l.trim() && !/^Reeks/.test(l.trim())); label = nx ? nx.trim() : ''; }
  return { place: ev ? ev[1].trim().replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase()) : '', date: `${d[3]}-${d[2]}-${d[1]}`, label };
}
function parse(text) {
  const rows = [], seen = new Set();
  for (const raw of text.split(/\r?\n/)) {
    let m = raw.match(/^\s*(\d+)\s+(\d+)\s+(.+?)\s+([A-Z]{3})(\d{8})\s+(.*)$/);
    if (!m) continue;
    const rest = m[6], st = rest.match(/\b(DNF|DNS|DSQ|OTL)\b\s*$/);
    const cat = rest.split(/\s{2,}/)[0] || '';
    const base = { name: m[3].trim(), nat: m[4], yob: Number(m[5].slice(0, 4)), cat };
    if (/^\d+$/.test(m[1]) && !st) { const k = 'r' + m[1] + m[3]; if (seen.has(k)) continue; seen.add(k); rows.push(Object.assign({ rank: Number(m[1]) }, base)); }
  }
  for (const raw of text.split(/\r?\n/)) {      // abandons : ligne sans « Plaats » (le numéro de dossard est en première colonne)
    const m = raw.match(/^\s*(\d+)\s+(.+?)\s+([A-Z]{3})(\d{8})\s+(.*?)\b(DNF|DNS|DSQ|OTL)\s*$/);
    if (m && !/^\d+\s+\d+\s/.test(raw.trim())) { const cat = m[5].split(/\s{2,}/)[0] || ''; rows.push({ status: m[6] === 'OTL' ? 'DNF' : m[6], name: m[2].trim(), nat: m[3], yob: Number(m[4].slice(0, 4)), cat }); }
  }
  return { head: header(text), rows };
}
/** Catégorie du jeu d'après le libellé de la course : { cat, g } ou null (jeunes, hors périmètre). */
function category(label) {
  const l = label.toLowerCase();
  if (/klasse|elite|élite/.test(l) && !/vrouw|women/.test(l)) return { cat: 'ELI', g: 'H' };
  if (/vrouwen|women elite/.test(l)) return { cat: 'ELI', g: 'F' };
  if (/meisjes junior|junior women|women junior|juniores/.test(l)) return { cat: 'U19', g: 'F' };
  if (/juniors? ?(uci)?\s*\(m\/v\)/.test(l)) return { cat: 'U19', g: 'MIX' };
  if (/^juniors/.test(l)) return { cat: 'U19', g: 'H' };
  return null;
}
module.exports = { parse, category, header };
if (require.main === module) for (const f of process.argv.slice(2)) { const r = parse(fs.readFileSync(f, 'utf8')); console.log(f, JSON.stringify(r.head), JSON.stringify(category(r.head ? r.head.label : '')), r.rows.length, 'lignes'); }
