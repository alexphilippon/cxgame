// Test d'interface : start list = ordre des dossards, hors-liste « DNS », pop-up si le choix n'est pas partant. node tests/startlist.ui.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/js/config.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); r.end('window.CX_CONFIG = { firebase: null, adminEmail: "" };'); return; } let f = path.join(root, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'text/plain' }); r.end(d); } }); }).listen(8124);
(async () => {
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 1100, height: 900 } }), errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('http://localhost:8124/'); await pg.waitForSelector('#auth-form');
  await pg.fill('#au-name', 'Alex'); await pg.fill('#au-mail', 'a@b.fr'); await pg.fill('#au-pw', 'secret1'); await pg.click('#auth-form button[type=submit]');
  await pg.waitForSelector('[data-rules-ok]'); await pg.click('[data-rules-ok]'); await pg.waitForSelector('.forfait');
  await pg.click('[data-tab="1"]'); await pg.waitForSelector('.session');
  const sel = '#pa-E01-ELI-F';
  await pg.click(sel); await pg.waitForSelector(sel + ' ~ .combo__list .combo__opt', { state: 'visible' });
  const labels = await pg.$$eval(sel + ' ~ .combo__list .combo__opt:not([hidden])', (l) => l.map((x) => x.textContent));
  assert.ok(/^1 · Lucinda Brand/.test(labels[0]) && /^43 · Emily/.test(labels[42]), 'ordre des dossards : ' + labels.slice(0, 2));
  assert.ok(labels.slice(43).every((x) => x.startsWith('DNS · ')) && labels.length > 80, 'hors liste : DNS devant');
  assert.strictEqual(await pg.locator(sel + ' ~ .combo__list .combo__hd--out').count(), 1);
  await pg.keyboard.type('backstedt'); await pg.waitForTimeout(100);
  const hit = await pg.$$eval(sel + ' ~ .combo__list .combo__opt:not([hidden])', (l) => l.map((x) => x.textContent));
  assert.ok(hit.length && hit[0].startsWith('DNS · ') && /BACKSTEDT/i.test(hit[0]), 'Backstedt proposée en DNS : ' + hit);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
  assert.ok((await pg.inputValue(sel)).startsWith('DNS · '));
  // rechargement : le pop-up prévient
  await pg.reload(); await pg.waitForSelector('.forfait', { timeout: 8000 }).catch(() => {});
  await pg.waitForSelector('#modal:not([hidden]) .dtl__k.bad', { timeout: 8000 });
  const txt = await pg.textContent('#modal');
  assert.ok(/Backstedt/i.test(txt) && /DNS/.test(txt), txt);
  console.log('ok'); console.log('erreurs:', errs); await b.close(); srv.close(); process.exit(errs.length ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
