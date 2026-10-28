// Audit de contraste : aucun texte clair sur fond clair (ni sombre sur sombre), dans toutes les ambiances. node tests/contrast.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/js/config.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); r.end('window.CX_CONFIG = { firebase: null, adminEmail: "" };'); return; } let f = path.join(root, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'text/plain' }); r.end(d); } }); }).listen(8125);
/** Mesure sur les pixels réels de la capture : couleur de fond dominante dans le rectangle du texte, contre la couleur du texte. */
const audit = async (shot) => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const img = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + shot; });
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
  const m = document.querySelector('#modal:not([hidden])'); const scope = m ? m.querySelectorAll('*') : document.querySelectorAll('body *');
  const bad = [];
  scope.forEach((el) => {
    if (el.closest('svg') || el.closest('[hidden]') || el.closest('.skip') || el.closest('.sr') || el.classList.contains('skip')) return;
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (!txt) return;
    if (el.classList.contains('avatar__in')) { const im = el.parentElement.querySelector('.avatar__img'); if (im && im.complete && im.naturalWidth && im.style.display !== 'none') return; }
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
    const fg = parse(cs.color); if (!fg || fg.a === 0) return;
    const rg = document.createRange(); rg.selectNodeContents(el); const r = rg.getBoundingClientRect(); if (r.width < 3 || r.height < 3) return;
    const tw = el.closest('.tablewrap--scroll'); if (tw) { const tr = tw.getBoundingClientRect(); if (r.bottom > tr.bottom || r.top < tr.top || r.right > tr.right || r.left < tr.left) return; }   // partie masquée par le défilement
    const mc = el.closest('.modal__card'); if (mc && (r.bottom > window.innerHeight || r.top < 0)) return;   // partie du modal visible seulement en le faisant défiler
    { const cxp = r.left + r.width / 2, cyp = r.top + r.height / 2; if (cxp >= 0 && cyp >= 0 && cxp < window.innerWidth && cyp < window.innerHeight) { const top = document.elementFromPoint(cxp, cyp); if (top && !el.contains(top) && !top.contains(el)) return; } }   // masqué par une barre fixe
    const lst = el.closest('.combo__list'); if (lst) { const lr = lst.getBoundingClientRect(); if (r.bottom > lr.bottom || r.top < lr.top) return; }
    const P = 1, x0 = Math.max(0, Math.floor(r.left + scrollX) - P), y0 = Math.max(0, Math.floor(r.top + scrollY) - P), w = Math.min(Math.ceil(r.width) + 2 * P, cv.width - x0), h = Math.min(Math.ceil(r.height) + 2 * P, cv.height - y0); if (w < 4 || h < 4) return;
    const d = cx.getImageData(x0, y0, w, h).data, cnt = {};
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { if (yy >= P && yy < h - P && xx >= P && xx < w - P) continue; const i = (yy * w + xx) * 4; const k = (d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3); cnt[k] = (cnt[k] || 0) + 1; }
    if (!Object.keys(cnt).length) return;
    const top = Object.entries(cnt).sort((p, q) => q[1] - p[1])[0][0].split(',').map((v) => v * 8 + 4), bg = { r: top[0], g: top[1], b: top[2] };
    const f = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
    const L1 = lum(f), L2 = lum(bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    if (ratio < 3) bad.push(`${ratio.toFixed(2)} ${el.tagName.toLowerCase()}.${String(typeof el.className === 'string' ? el.className : '').split(' ')[0]} « ${txt.slice(0, 40)} » dans ${el.parentElement ? el.parentElement.className.toString().split(' ')[0] : ''} / ${el.parentElement && el.parentElement.parentElement ? el.parentElement.parentElement.className.toString().split(' ')[0] : ''} texte=${cs.color} fond=rgb(${top})`);
  });
  return bad;
};
const run = async (pg) => { const shot = (await pg.screenshot({ fullPage: true })).toString('base64'); return pg.evaluate(audit, shot); };
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: +(process.argv[2] || 1100), height: 900 } });
  await pg.goto('http://localhost:8125/'); await pg.evaluate(() => localStorage.setItem('cxgame.rulesSeen', '1')); await pg.reload();
  await pg.fill('#au-name', 'Alex'); await pg.fill('#au-mail', 'a@b.fr'); await pg.fill('#au-pw', 'secret1'); await pg.click('#auth-form button[type=submit]'); await pg.waitForSelector('.forfait');
  await pg.click('[data-tab="1"]'); await pg.click('#pa-E01-ELI-H'); await pg.keyboard.type('vande'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(150); await pg.click('[data-draft]');
  let total = 0;
  const views = [['adm'], ['next'], ['1'], ['1', 'recap'], ['1', 'taken'], ['2'], ['3'], ['gen'], ['data']];
  for (const th of ['flandre', 'boue', 'neige', 'foret', 'tomorrowland']) {
    await pg.$eval(`.mast-actions [data-theme-set="${th}"]`, (e) => e.click()); await pg.waitForTimeout(600);
    for (const [t, sub] of views) {
      await pg.click(`[data-tab="${t}"]`); if (sub) await pg.click(`[data-sub="${sub}"]`); await pg.waitForTimeout(450);
      const bad = await run(pg); total += bad.length; bad.slice(0, 12).forEach((x) => console.log(`[${th} ${t}${sub ? '/' + sub : ''}]`, x));
    }
    await pg.evaluate(() => window.scrollTo(0, 0)); await pg.click("[data-rules]"); await pg.waitForTimeout(500); let bad = await run(pg); total += bad.length; bad.slice(0, 8).forEach((x) => console.log(`[${th} règles]`, x)); await pg.click('[data-close]');
    await pg.click('[data-settings]'); bad = await run(pg); total += bad.length; bad.slice(0, 8).forEach((x) => console.log(`[${th} réglages]`, x)); await pg.click('[data-close]');
    await pg.click('[data-tab="1"]'); await pg.click('#pa-E01-ELI-F'); bad = await run(pg); total += bad.length; bad.slice(0, 8).forEach((x) => console.log(`[${th} liste]`, x)); await pg.keyboard.press('Escape');
  }
  console.log('Contrastes insuffisants :', total); await b.close(); srv.close(); process.exit(total ? 1 : 0);
})();
