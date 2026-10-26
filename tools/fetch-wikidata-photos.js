#!/usr/bin/env node
/* Photos des coureurs depuis Wikimedia Commons, retrouvées via Wikidata (même méthode que le SKI GAME).
   Usage (GitHub Actions « Photos des coureurs », Codespaces ou ordinateur, Node 18+) :  npm i sharp  puis  node tools/fetch-wikidata-photos.js
   Options : --force (re-télécharge même si img/athletes/<id>.jpg existe)   --dry (compte sans télécharger)
   - Recherche par nom sur Wikidata ; on ne garde qu'une fiche dont le libellé est exactement le nom du coureur,
     décrite comme coureur cycliste, et qui a une image (propriété P18). Aucun risque de photo d'un homonyme.
   - Les photos déjà présentes (ajoutées à la main) ne sont jamais écrasées, sauf --force.
   - Écrit img/athletes/<id>.jpg (240 px de large), tools/photo-credits.json et credits.html (auteurs + licences). */
const fs = require('fs');
const path = require('path');
const data = require('../js/athletes.js');

const WD_API = process.env.WD_API || 'https://www.wikidata.org/w/api.php';
const COMMONS_API = process.env.COMMONS_API || 'https://commons.wikimedia.org/w/api.php';
const DELAY = parseInt(process.env.DELAY || '400', 10);
const UA = 'CXGameFantasy/1.0 (https://github.com/alexphilippon/cxgame; photos de coureurs)';
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'img', 'athletes');
const CR = require('./credits.js');
const force = process.argv.includes('--force'), dry = process.argv.includes('--dry');
fs.mkdirSync(outDir, { recursive: true });
let sharp = null;
if (!dry) { try { sharp = require('sharp'); } catch (e) { console.warn('⚠ « sharp » absent : lance d\'abord  npm i sharp'); process.exit(1); } }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function http(url, opts, asBuffer) {
  for (let k = 1; k <= 4; k++) {
    const gap = DELAY - (Date.now() - last); if (gap > 0) await sleep(gap);
    last = Date.now();
    const r = await fetch(url, Object.assign({ headers: { 'User-Agent': UA, Accept: 'application/json' } }, opts));
    if (r.status === 429 || r.status >= 500) { const w = parseInt(r.headers.get('retry-after') || '0', 10) * 1000 || 5000 * k; console.log(`  (le serveur demande de patienter ${w / 1000} s)`); await sleep(w); continue; }
    if (!r.ok) throw new Error(`${r.status} ${url.slice(0, 120)}`);
    return asBuffer ? Buffer.from(await r.arrayBuffer()) : r.json();
  }
  throw new Error('trop de refus : ' + url.slice(0, 120));
}
const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const CYCLIST = /cycl|cyclo|vélo|velo|bike|rider/i;

async function commonsInfo(file) {
  const j = await http(`${COMMONS_API}?action=query&format=json&titles=${encodeURIComponent('File:' + file)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480`);
  const page = Object.values((j.query && j.query.pages) || {})[0];
  const ii = page && page.imageinfo && page.imageinfo[0];
  if (!ii) return null;
  const m = ii.extmetadata || {};
  return { thumb: ii.thumburl || ii.url, page: ii.descriptionurl, author: strip(m.Artist && m.Artist.value) || 'Auteur inconnu', license: strip(m.LicenseShortName && m.LicenseShortName.value) || 'Licence à vérifier', file };
}
/** Fichier Commons (P18) d'un coureur : fiche au libellé exact, décrite comme cycliste, avec une image. */
async function searchByName(name) {
  const s = await http(`${WD_API}?action=wbsearchentities&format=json&language=en&type=item&limit=8&search=${encodeURIComponent(name)}`);
  const ids = (s.search || []).filter((x) => norm(x.label || x.match && x.match.text || '') === norm(name) && CYCLIST.test(x.description || '')).map((x) => x.id);
  if (!ids.length) return null;
  const e = await http(`${WD_API}?action=wbgetentities&format=json&props=claims&ids=${ids.join('|')}`);
  for (const id of ids) {
    const c = e.entities && e.entities[id] && e.entities[id].claims;
    const img = c && c.P18 && c.P18[0] && c.P18[0].mainsnak && c.P18[0].mainsnak.datavalue && c.P18[0].mainsnak.datavalue.value;
    if (img) return String(img).replace(/_/g, ' ');
  }
  return null;
}
async function save(a, file, credits) {
  const info = await commonsInfo(file);
  if (!info) return false;
  const buf = await http(info.thumb, { headers: { 'User-Agent': UA } }, true);
  const jpg = await sharp(buf).resize(240, 320, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#eee5cf' }).jpeg({ quality: 82 }).toBuffer();
  fs.writeFileSync(path.join(outDir, `${a.id}.jpg`), jpg);
  credits[a.id] = { name: a.name, author: info.author, license: info.license, page: info.page, how: 'wikidata' };
  return true;
}

(async () => {
  const all = Object.values(data.lists).flat();
  const todo = all.filter((a) => force || !fs.existsSync(path.join(outDir, `${a.id}.jpg`)));
  const credits = CR.load();
  console.log(`${all.length - todo.length} déjà présentes (gardées), ${todo.length} à chercher.`);
  let ok = 0; const missing = [];
  for (const a of todo) {
    try {
      const file = await searchByName(a.name);
      if (!file) { missing.push(a.name); }
      else if (dry) ok++;
      else if (await save(a, file, credits)) ok++;
      else missing.push(a.name);
    } catch (e) { console.log(`  ✗ ${a.name} : ${e.message}`); missing.push(a.name); }
    const done = ok + missing.length; if (done % 25 === 0) console.log(`… ${done} / ${todo.length}`);
  }
  if (!dry) CR.save(credits);
  console.log(`\nPhotos ${dry ? 'trouvées' : 'enregistrées'} : ${ok}. Sans photo (initiales affichées) : ${missing.length}.`);
  if (missing.length) console.log('Sans photo : ' + missing.join(', '));
})();
