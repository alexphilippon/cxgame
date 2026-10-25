// Test d'interface (nécessite Playwright) : node tests/ui.smoke.js <dossier-captures>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };
const srv = http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'text/plain' }); r.end(d); } }); }).listen(8123);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1000, height: 900 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/flagcdn|fonts|ERR_|Failed to load/.test(m.text())) errs.push(m.text()); });
  await pg.goto('http://localhost:8123/'); await pg.waitForSelector('#auth');
  await pg.click('[data-auth-mode="up"]'); await pg.fill('#au-name', 'Alex'); await pg.fill('#au-mail', 'a@b.fr'); await pg.fill('#au-pw', 'secret1'); await pg.click('#auth button[type=submit]');
  await pg.waitForSelector('.session');
  await pg.screenshot({ path: process.argv[2] + '/next.png' });
  // choisir un coureur
  await pg.click('#pa-E01-ELI-H'); await pg.waitForSelector('#pa-E01-ELI-H ~ .combo__list .combo__opt', { state: 'visible' }); await pg.keyboard.type('vande'); await pg.keyboard.press('Enter');
  await pg.waitForTimeout(200);
  console.log('pick H:', await pg.inputValue('#pa-E01-ELI-H'));
  await pg.click('#pb-E01-ELI-H'); await pg.keyboard.type('nys'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
  console.log('remplaçant:', await pg.inputValue('#pb-E01-ELI-H'));
  for (const t of ['d1', 'd2', 'd3', 'mo', 'gen', 'taken', 'adm']) { await pg.click(`[data-tab=${t}]`); await pg.waitForTimeout(100); if (t === 'mo') await pg.screenshot({ path: process.argv[2] + '/mo.png' }); }
  // simulation après 1er nov
  await pg.fill('#sim', '2026-11-01T20:00'); await pg.dispatchEvent('#sim', 'change'); await pg.click('[data-tab=next]'); await pg.screenshot({ path: process.argv[2] + '/locked.png' });
  for (const th of ['boue', 'neige', 'foret', 'tomorrowland']) { await pg.selectOption('#theme', th); await pg.screenshot({ path: process.argv[2] + '/th-' + th + '.png' }); }
  await pg.setViewportSize({ width: 390, height: 800 }); await pg.selectOption('#theme', 'flandre'); await pg.click('[data-tab=d1]'); await pg.screenshot({ path: process.argv[2] + '/mobile.png' });
  console.log('erreurs:', errs); await b.close(); srv.close();
})();
