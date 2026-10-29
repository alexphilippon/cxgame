/* CX GAME – « Data room » : résultats bruts de la saison passée (data/history-2025-2026.json), classés au barème du jeu.
   Sert aussi aux fiches coureurs (historique d'un coureur). Contexte C fourni par app.js. */
(function (root) {
  'use strict';
  let C = null;
  const SEASONS = ['2026-2027', '2025-2026'], short = (y) => y.slice(2, 4) + '-' + y.slice(7);
  const store = {};                                   // saison -> { H, loading }
  const ui = { y: SEASONS[0], g: 'H', cat: 'ELI', s: 'all', more: false };
  const SER = { CdM: 'Coupe du monde', SP: 'Superprestige', XO: 'X²O Trofee', HG: 'HG Cross' };
  const cur = () => store[ui.y] && store[ui.y].H;
  const init = (ctx) => { C = ctx; };
  const load = (y) => {
    y = y || ui.y; const st = (store[y] = store[y] || {});
    if (st.H || st.loading) return; st.loading = true;
    fetch('data/history-' + y + '.json').then((r) => r.json()).then((d) => { st.H = d; C.rerender(); }).catch(() => { st.H = { races: [], ath: {}, error: true }; C.rerender(); });
  };
  const allH = () => SEASONS.map((y) => store[y] && store[y].H).filter(Boolean);
  const mo = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });
  const frDate = (r) => mo.format(new Date(r.date + 'T12:00:00Z'));
  const nameOf = (id) => (C.ATH()[id] && C.ATH()[id].name) || (allH().map((h) => h.ath[id]).find(Boolean) || {}).name || id;
  const natOf = (id) => (C.ATH()[id] && C.ATH()[id].nat) || (allH().map((h) => h.ath[id]).find(Boolean) || {}).nat || '';
  const cellCls = (e) => (!e ? 'c-none' : typeof e === 'string' ? 'c-st c-st--' + e.toLowerCase() : e === 1 ? 'c-1' : e === 2 ? 'c-2' : e === 3 ? 'c-3' : e <= 10 ? 'c-top' : 'c-in');
  const pts = (rank) => (typeof rank === 'number' ? C.G.pointsForRank(rank) : 0);
  const chip = (attr, v, label, on) => `<button type="button" class="ffc ffc--${v}" data-dr="${attr}:${v}" aria-pressed="${on}">${label}</button>`;

  function table(H) {
    const races = H.races.filter((r) => r.g === ui.g && r.cat === ui.cat && !r.nowc && (ui.s === 'all' || r.series === ui.s));
    const by = {};
    races.forEach((r) => r.res.forEach(([id, e]) => { const s = (by[id] = by[id] || { id, pts: 0, n: 0, cells: {} }); s.cells[r.id] = e; s.n++; s.pts += pts(e); }));
    const rows = Object.values(by).sort((a, b) => b.pts - a.pts || a.n - b.n || nameOf(a.id).localeCompare(nameOf(b.id), 'fr'));
    let last = null, rk = 0; rows.forEach((r, i) => { if (r.pts !== last) { rk = i + 1; last = r.pts; } r.rank = rk; });
    return { races, rows };
  }
  function render() {
    load();
    const H = cur();
    if (!H) return '<p class="hint">Chargement des résultats…</p>';
    if (H.error) return '<p class="hint">Résultats indisponibles pour cette saison.</p>';
    const sers = Object.keys(SER).filter((k) => H.races.some((r) => r.series === k)), { races, rows } = table(H), shown = ui.more ? rows : rows.slice(0, 40);
    const head = races.map((r) => `<th scope="col" class="num dr__rc" title="${C.esc(SER[r.series] || r.series)} · ${C.esc(r.place)} · ${frDate(r)}"><span>${C.esc(r.place.slice(0, 3).toUpperCase())}</span><small>${frDate(r)}</small></th>`).join('');
    const body = shown.map((r) => `<tr><td class="num"><span class="rnk rnk--${r.rank <= 3 ? r.rank : r.rank <= 10 ? 'c' : 'n'}">${r.rank}</span></td>
      <th scope="row"><button type="button" class="dr__sk dr__lnk" data-hist="${C.esc(r.id)}">${C.flag(natOf(r.id))}<span class="dr__nm">${C.esc(nameOf(r.id))}</span></button></th>
      <td class="num"><b>${r.pts}</b></td>${races.map((x) => { const e = r.cells[x.id]; return `<td class="num dr__c ${cellCls(e)}">${e == null ? '' : e}</td>`; }).join('')}</tr>`).join('');
    return `<section class="genpanel"><header class="deskhead"><div><h2>Data room</h2><p class="deskhead__meta">Saison ${short(ui.y)} · ${sers.map((k) => SER[k]).join(', ')}, classements complets, points au barème du jeu</p></div></header>
      <div class="ff dr__filters" role="group" aria-label="Filtres"><span class="ff__g">${SEASONS.map((y) => chip('y', y, short(y), ui.y === y).replace('ffc--' + y, 'ffc--all')).join('')}</span><span class="ff__g">${chip('g', 'H', 'Hommes', ui.g === 'H')}${chip('g', 'F', 'Femmes', ui.g === 'F')}</span>
      <span class="ff__g">${chip('s', 'all', 'Toutes', ui.s === 'all')}${sers.map((k) => chip('s', k, SER[k], ui.s === k)).join('')}</span>
      <span class="ff__g">${['ELI', 'U23', 'U19'].map((c) => chip('cat', c, C.D.CATS[c].short, ui.cat === c)).join('')}</span></div>
      <div class="tablewrap tablewrap--scroll"><table class="grid grid--rank dr__tab"><caption>${ui.g === 'H' ? 'Hommes' : 'Femmes'} ${C.esc(C.D.CATS[ui.cat].fr.toLowerCase())}, ${races.length} courses</caption>
      <thead><tr><th class="num" scope="col">Rang</th><th scope="col">Coureur</th><th class="num" scope="col">Pts</th>${head}</tr></thead><tbody>${body || `<tr><td colspan="${3 + races.length}"><span class="none">Aucun résultat.</span></td></tr>`}</tbody></table></div>
      ${rows.length > 40 ? `<p class="dr__more"><button type="button" class="btn btn--ghost btn--sm" data-dr="more:1">${ui.more ? 'Réduire' : `Voir les ${rows.length} coureurs`}</button></p>` : ''}
      <p class="hint">Cases : place d’arrivée (DNF : abandon). Points : 100, 80, 60… comme dans le jeu, sans multiplicateur. Clique sur un coureur pour voir sa saison. Sources : UCI, Superprestige, X²O Trofee, HG Cross.</p></section>`;
  }
  /** Saison 2025-26 d'un coureur : [{race, e}] (toutes catégories). */
  function historyOf(id, y) {
    const H = store[y] && store[y].H;
    if (!H) return [];
    return H.races.filter((r) => !r.nowc).map((r) => { const x = r.res.find((y) => y[0] === id); return x ? { race: r, e: x[1] } : null; }).filter(Boolean);
  }
  function histHtml(id) {
    return SEASONS.map((y) => { load(y); return seasonHtml(id, y); }).join('');
  }
  function seasonHtml(id, y) {
    const h = historyOf(id, y);
    if (!h.length) return '';
    const total = h.reduce((a, x) => a + pts(x.e), 0);
    return `<h3 class="fh">Saison ${short(y)}</h3><ul class="dtls">${h.map((x) => `<li class="dtl"><span class="dtl__r"><strong>${C.esc(x.race.place)}</strong> <span class="sub">${frDate(x.race)} · ${C.esc(SER[x.race.series] || "")} · ${C.esc(C.D.CATS[x.race.cat].short)}</span></span><span class="dtl__a"></span><span class="dtl__k ${typeof x.e === 'number' ? '' : 'bad'}">${typeof x.e === 'number' ? C.ordinal(x.e) : x.e} <b>${pts(x.e) ? '+' + pts(x.e) : ''}</b></span></li>`).join('')}</ul><p class="dtl__tot">${h.length} courses · ${total} pts (barème du jeu)</p>`;
  }
  function histModal(id) {
    load();
    const a = allH().map((h) => h.ath[id]).find(Boolean);
    C.openModal(`<h2>${C.esc(nameOf(id))}</h2><p class="hint">${C.flag(natOf(id))} ${C.esc(natOf(id))}${a ? ' · ' + C.esc(C.D.CATS[a.cat].fr) : ''}</p>${histHtml(id) || '<p class="hint">Aucun résultat enregistré.</p>'}`);
  }
  /** Clic dans la Data room : true si traité. */
  function click(t) {
    const d = t.closest('[data-dr]');
    if (d) { const [k, v] = d.dataset.dr.split(':'); if (k === 'g') ui.g = v; else if (k === 'y') { ui.y = v; ui.s = 'all'; } else if (k === 'cat') ui.cat = v; else if (k === 's') ui.s = v; else if (k === 'more') ui.more = !ui.more; ui.more = k === 'more' ? ui.more : false; C.rerender(); return true; }
    const h = t.closest('[data-hist]'); if (h) { histModal(h.dataset.hist); return true; }
    return false;
  }
  const api = { init, render, click, histHtml, historyOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CX_DATAROOM = api;
})(typeof self !== 'undefined' ? self : this);
