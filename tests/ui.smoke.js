// Test d'interface (nécessite Playwright) : node tests/ui.smoke.js <dossier-captures>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = process.argv[2] || '/tmp';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/js/config.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); r.end('window.CX_CONFIG = { firebase: null, adminEmail: "" };'); return; } let f = path.join(root, u); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'text/plain' }); r.end(d); } }); }).listen(8123);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1100, height: 900 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/flagcdn|fonts|ERR_|Failed to load|404/.test(m.text())) errs.push(m.text()); });
  await pg.goto('http://localhost:8123/'); await pg.waitForSelector('#auth-form');
  await pg.screenshot({ path: out + '/auth.png' });
  await pg.fill('#au-name', 'Alex'); await pg.fill('#au-mail', 'a@b.fr'); await pg.fill('#au-pw', 'secret1'); await pg.click('#auth-form button[type=submit]');
  await pg.waitForSelector('[data-rules-ok]'); await pg.click('[data-rules-ok]'); await pg.waitForSelector('.forfait');
  await pg.screenshot({ path: out + '/next.png' });
  await pg.click('[data-tab="1"]'); await pg.waitForSelector('.session');
  await pg.click('#pa-E01-ELI-H'); await pg.waitForSelector('#pa-E01-ELI-H ~ .combo__list .combo__opt', { state: 'visible' }); await pg.keyboard.type('vande'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
  console.log('choix H:', await pg.inputValue('#pa-E01-ELI-H'));
  await pg.screenshot({ path: out + '/desk1.png' });
  for (const t of ['2', '3', 'w', 'gen']) { await pg.click(`[data-tab="${t}"]`); await pg.waitForTimeout(100); await pg.screenshot({ path: out + '/tab-' + t + '.png' }); }
  await pg.click('[data-tab="1"]'); await pg.click('[data-sub="recap"]'); await pg.click('[data-sub="taken"]');
  await pg.fill('#sim-date', '2026-11-01T20:00').catch(() => {}); 
  for (const th of ['boue', 'neige', 'foret', 'tomorrowland', 'flandre']) { await pg.click(`.mast-actions [data-theme-set="${th}"]`); await pg.click('[data-tab="1"]'); await pg.screenshot({ path: out + '/th-' + th + '.png' }); }
  await pg.setViewportSize({ width: 390, height: 800 }); await pg.screenshot({ path: out + '/mobile.png' });
  // Admin (mode local : l'utilisateur est admin)
  await pg.click('[data-tab="adm"]'); await pg.waitForSelector('.adm');
  for (const sub of ['ctl', 'res', 'cal', 'ath', 'idea']) { await pg.click(`[data-adm-sub="${sub}"]`); await pg.waitForTimeout(80); }
  await pg.click('[data-adm-sub="res"]'); await pg.selectOption('#adm-race', 'E01-ELI-H');
  await pg.fill('#adm-text', '1 Mathieu van der Poel\n2 Toon Vandebosch\nDNS Niels Vandeputte'); await pg.click('[data-adm="analyse"]');
  await pg.waitForSelector('[data-adm="save-result"]:not([disabled])'); await pg.click('[data-adm="save-result"]'); await pg.waitForSelector('.adm__msg');
  console.log('résultat admin:', await pg.textContent('.adm__msg'));
  await pg.click('[data-adm-sub="cal"]'); await pg.selectOption('#adm-cal', 'E01-ELI-F'); pg.on('dialog', (d) => { console.log('dialogue:', d.message().slice(0, 120)); d.accept(); }); await pg.click('[data-adm="cal-cancel"]'); await pg.waitForSelector('.adm__msg');
  console.log('calendrier admin:', await pg.textContent('.adm__msg'));
  await pg.click('[data-tab="1"]'); console.log('annulée visible:', await pg.locator('.flag--off').count());
  console.log('erreurs:', errs); await b.close(); srv.close();
  process.exit(errs.length ? 1 : 0);
})();
