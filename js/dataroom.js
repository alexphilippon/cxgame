/* CX GAME – « Data room » : résultats bruts de la saison passée (data/history-2025-2026.json), classés au barème du jeu.
   Sert aussi aux fiches coureurs (historique d'un coureur). Contexte C fourni par app.js. */
(function (root) {
  'use strict';
  let C = null;
  const SEASONS = ['2026-2027', '2025-2026'], short = (y) => y.slice(2, 4) + '-' + y.slice(7);
  const store = {};                                   // saison -> { H, loading }
  const ui = { y: SEASONS[0], g: 'H', cat: 'ELI', s: 'all', more: false, sub: 'comp', open: {} };
  const SER = { CdM: 'Coupe du monde', SP: 'Superprestige', XO: 'X²O Trofee', HG: 'HG Cross', EU: 'Euros', MO: 'Mondiaux' };
  /** Historique d'une saison + courses du jeu saisies au jour le jour (C.extra(y) → { races, ath }), sans doublon (même date, catégorie, genre). */
  const H_ = (y) => {
    const base = store[y] && store[y].H; if (!base) return base;
    const x = C.extra ? C.extra(y) : null; if (!x || !x.races.length) return base;
    const has = new Set(base.races.map((r) => `${r.date}|${r.cat}|${r.g}`));
    const add = x.races.filter((r) => !has.has(`${r.date}|${r.cat}|${r.g}`));
    return add.length ? Object.assign({}, base, { races: base.races.concat(add), ath: Object.assign({}, x.ath, base.ath) }) : base;
  };
  const cur = () => H_(ui.y);
  const init = (ctx) => { C = ctx; };
  const load = (y) => {
    y = y || ui.y; const st = (store[y] = store[y] || {});
    if (st.H || st.loading) return; st.loading = true;
    fetch('data/history-' + y + '.json').then((r) => r.json()).then((d) => { st.H = d; C.rerender(); }).catch(() => { st.H = { races: [], ath: {}, error: true }; C.rerender(); });
  };
  /** Charge les deux saisons ; la promesse se résout quand tout est là. */
  const preload = () => Promise.all(SEASONS.map((y) => { const st = (store[y] = store[y] || {}); if (st.H) return Promise.resolve(); if (!st.p) st.p = fetch('data/history-' + y + '.json').then((r) => r.json()).then((d) => { st.H = d; }).catch(() => { st.H = { races: [], ath: {}, error: true }; }); return st.p; }));
  const ready = () => SEASONS.every((y) => store[y] && store[y].H);
  const allH = () => SEASONS.map((y) => H_(y)).filter(Boolean);
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
  function course() {
    load();
    const H = cur();
    if (!H) return '<p class="hint">Chargement des résultats…</p>';
    if (H.error) return '<p class="hint">Résultats indisponibles pour cette saison.</p>';
    const sers = Object.keys(SER).filter((k) => H.races.some((r) => r.series === k)), { races, rows } = table(H), shown = ui.more ? rows : rows.slice(0, 40);
    const head = races.map((r) => `<th scope="col" class="num dr__rc" title="${C.esc(SER[r.series] || r.series)} · ${C.esc(r.place)} · ${frDate(r)}"><span>${C.esc(r.place.slice(0, 3).toUpperCase())}</span><small>${frDate(r)}</small></th>`).join('');
    const body = shown.map((r) => `<tr>
      <th scope="row"><button type="button" class="dr__sk dr__lnk" data-hist="${C.esc(r.id)}">${C.flag(natOf(r.id))}<span class="dr__nm">${C.esc(nameOf(r.id))}</span></button></th>
      <td class="num">${r.n}</td>${races.map((x) => { const e = r.cells[x.id]; return `<td class="num dr__c ${cellCls(e)}">${e == null ? '' : e}</td>`; }).join('')}</tr>`).join('');
    return `<p class="hint">Saison ${short(ui.y)} · ${sers.map((k) => SER[k]).join(', ')}, résultats complets par course</p>
      <div class="ff dr__filters" role="group" aria-label="Filtres"><span class="ff__g">${chip('g', 'H', 'Hommes', ui.g === 'H')}${chip('g', 'F', 'Femmes', ui.g === 'F')}</span>
      <span class="ff__g">${chip('s', 'all', 'Toutes', ui.s === 'all')}${sers.map((k) => chip('s', k, SER[k], ui.s === k)).join('')}</span>
      <span class="ff__g">${['ELI', 'U23', 'U19'].map((c) => chip('cat', c, C.D.CATS[c].short, ui.cat === c)).join('')}</span></div>
      <div class="tablewrap tablewrap--scroll"><table class="grid grid--rank dr__tab"><caption>${ui.g === 'H' ? 'Hommes' : 'Femmes'} ${C.esc(C.D.CATS[ui.cat].fr.toLowerCase())}, ${races.length} courses</caption>
      <thead><tr><th scope="col">Coureur</th><th class="num" scope="col" title="Courses disputées">Crs</th>${head}</tr></thead><tbody>${body || `<tr><td colspan="${2 + races.length}"><span class="none">Aucun résultat.</span></td></tr>`}</tbody></table></div>
      ${rows.length > 40 ? `<p class="dr__more"><button type="button" class="btn btn--ghost btn--sm" data-dr="more:1">${ui.more ? 'Réduire' : `Voir les ${rows.length} coureurs`}</button></p>` : ''}
      <p class="hint">Cases : place d’arrivée (DNF : abandon). Crs : courses disputées. Les coureurs sont classés selon leurs résultats dans le barème du jeu, mais les points ne sont pas affichés (barèmes différents selon les séries). Clique sur un coureur pour voir sa saison. Sources : UCI, Superprestige, X²O Trofee, HG Cross.</p>`;
  }
  /** Onglet « Compétitions » : total de la saison puis un classement par série (barème du jeu). */
  function comp() {
    load(SEASONS[0]);
    const H = H_(SEASONS[0]);
    if (!H) return '<p class="hint">Chargement des résultats…</p>';
    const base = H.races.filter((r) => r.g === ui.g && r.cat === ui.cat && !r.nowc);
    const rank = (races) => {
      const by = {};
      races.forEach((r) => r.res.forEach(([id, e]) => { const o = (by[id] = by[id] || { id, pts: 0, n: 0 }); o.n++; o.pts += pts(e); }));
      const rows = Object.values(by).sort((a, b) => b.pts - a.pts || a.n - b.n || nameOf(a.id).localeCompare(nameOf(b.id), 'fr'));
      let last = null, rk = 0; rows.forEach((r, i) => { if (r.pts !== last) { rk = i + 1; last = r.pts; } r.rank = rk; });
      return rows;
    };
    const who = (ui.g === 'H' ? 'Hommes' : 'Femmes') + ' ' + C.D.CATS[ui.cat].fr.toLowerCase();
    const block = (key, title, races) => {
      const rows = rank(races), open = !!ui.open[key], shown = open ? rows : rows.slice(0, 15);
      const xb = C.share ? C.share.xbar({ key: 'dr:comp:' + key + ui.g + ui.cat, title, sub: who + ' · CX Game 2026-27', unit: ' pts', head: ['Rang', 'Coureur', 'Points'], rows: rows.slice(0, 30).map((r) => ({ c: [String(r.rank), nameOf(r.id), String(r.pts)] })) }) : '';
      const body = shown.map((r) => `<tr><td class="num">${r.rank}</td><th scope="row"><button type="button" class="dr__sk dr__lnk" data-hist="${C.esc(r.id)}">${C.flag(natOf(r.id))}<span class="dr__nm">${C.esc(nameOf(r.id))}</span></button></th><td class="num"><b>${r.pts}</b></td><td class="num">${r.n}</td></tr>`).join('');
      return `${C.share ? C.share.fsOpen() : ''}<div class="tablewrap"><table class="grid grid--rank dr__light"><caption>${C.esc(title)} · ${races.length} course${races.length > 1 ? 's' : ''}${xb}</caption>
        <thead><tr><th class="num" scope="col">Rang</th><th scope="col">Coureur</th><th class="num" scope="col">Pts</th><th class="num" scope="col" title="Courses disputées">Crs</th></tr></thead><tbody>${body || '<tr><td colspan="4"><span class="none">Aucun résultat.</span></td></tr>'}</tbody></table></div>${C.share ? '</div>' : ''}
        ${rows.length > 15 ? `<p class="dr__more"><button type="button" class="btn btn--ghost btn--sm" data-dr="open:${key}">${open ? 'Réduire' : `Voir les ${rows.length} coureurs`}</button></p>` : ''}`;
    };
    const sers = ['SP', 'XO', 'HG', 'CdM'].filter((k) => base.some((r) => r.series === k));
    return `<div class="ff dr__filters" role="group" aria-label="Filtres"><span class="ff__g">${chip('g', 'H', 'Hommes', ui.g === 'H')}${chip('g', 'F', 'Femmes', ui.g === 'F')}</span><span class="ff__g">${['ELI', 'U23', 'U19'].map((c) => chip('cat', c, C.D.CATS[c].short, ui.cat === c)).join('')}</span></div>
      <h3 class="subtitle">Total de la saison</h3>${block('all', 'Toutes compétitions', base)}
      ${sers.map((k) => `<h3 class="subtitle">${C.esc(SER[k])}</h3>${block(k, SER[k], base.filter((r) => r.series === k))}`).join('')}
      <p class="hint">Points au barème du jeu (100, 80, 60…) d’après les résultats complets de chaque course : ils ne reprennent pas les barèmes officiels des séries.</p>`;
  }
  function render() {
    const body = ui.sub === 'bub' ? (C.bubbles ? C.bubbles() : '') : ui.sub === 'comp' ? comp() : (ui.y = ui.sub === 'past' ? SEASONS[1] : SEASONS[0], course());
    const tab = (id, l, cls) => `<button type="button" role="tab" class="seg__btn${cls || ''}" aria-selected="${ui.sub === id}" data-dr="sub:${id}">${l}</button>`;
    return `<section class="genpanel"><header class="deskhead"><div><h2>Data room</h2><p class="deskhead__meta">Classements par compétition, résultats complets par course et bulles</p></div></header>
      <div class="deskbar"><div class="seg" role="tablist" aria-label="Data room">${tab('comp', 'Compétitions')}${tab('course', 'Par course')}${tab('bub', 'Bulles')}${tab('past', '2025-26', ' seg__btn--past')}</div></div>${body}</section>`;
  }
  /** Classements du coureur dans la saison en cours : total et par série (barème du jeu), dans sa catégorie : [{ label, rank, of, pts }]. */
  function seriesRanks(id) {
    const H = H_(SEASONS[0]); if (!H) return [];
    const mine = H.races.filter((r) => !r.nowc && r.res.some((x) => x[0] === id));
    const groups = [...new Set(mine.map((r) => r.g + '|' + r.cat))], out = [];
    groups.forEach((gk) => {
      const [g, cat] = gk.split('|'), base = H.races.filter((r) => !r.nowc && r.g === g && r.cat === cat);
      const tag = groups.length > 1 ? ' ' + C.D.CATS[cat].short : '';
      [['all', 'Total saison']].concat(['CdM', 'SP', 'XO', 'HG'].map((k) => [k, SER[k]])).forEach(([k, label]) => {
        const rs = k === 'all' ? base : base.filter((r) => r.series === k), by = {};
        rs.forEach((r) => r.res.forEach(([x, e]) => { const o = (by[x] = by[x] || { pts: 0 }); o.pts += pts(e); }));
        if (!by[id]) return;
        const list = Object.values(by), me = by[id].pts;
        out.push({ label: label + tag, rank: 1 + list.filter((o) => o.pts > me).length, of: list.length, pts: me });
      });
    });
    return out;
  }
  /** Saison 2025-26 d'un coureur : [{race, e}] (toutes catégories). */
  function historyOf(id, y) {
    const H = H_(y);
    if (!H) return [];
    return H.races.filter((r) => !r.nowc).map((r) => { const x = r.res.find((y) => y[0] === id); return x ? { race: r, e: x[1] } : null; }).filter(Boolean);
  }
  function histHtml(id) {
    return SEASONS.map((y) => { load(y); return seasonHtml(id, y); }).join('');
  }
  function seasonHtml(id, y) {
    const h = historyOf(id, y);
    if (!h.length) return '';
    const num = h.filter((x) => typeof x.e === 'number');
    const st = { n: h.length, w: num.filter((x) => x.e === 1).length, p: num.filter((x) => x.e <= 3).length, t: num.filter((x) => x.e <= 10).length, d: h.length - num.length };
    const tile = (v, l, c) => `<span class="hs hs--${c}${v ? '' : ' is-zero'}"><b>${v}</b><small>${l}</small></span>`;
    const tier = (e) => (typeof e !== 'number' ? 'st' : e === 1 ? 'g' : e === 2 ? 's' : e === 3 ? 'b' : e <= 10 ? 't' : 'o');
    const row = (x) => {
      const n = x.race.res.length, num_ = typeof x.e === 'number', bar = num_ ? Math.max(6, Math.round(100 * (1 - (x.e - 1) / Math.max(n, x.e)))) : 0;
      return `<li class="hr hr--${tier(x.e)}"><span class="hr__b">${num_ ? x.e : C.esc(x.e)}</span>
        <span class="hr__m"><strong>${C.esc(x.race.place)}</strong><span class="hr__s"><i class="sc sc--${C.esc(x.race.series)}">${C.esc(SER[x.race.series] || '')}</i> ${frDate(x.race)} · ${C.esc(C.D.CATS[x.race.cat].short)}</span>
        ${num_ ? `<span class="hr__bar" title="${x.e}e sur ${n}"><u style="width:${bar}%"></u></span>` : ''}</span>
        <span class="hr__n">${num_ ? `${x.e}<sup>${x.e === 1 ? 'er' : 'e'}</sup><small>/ ${n}</small>` : ''}</span></li>`;
    };
    return `<h3 class="fh">Saison ${short(y)}</h3><div class="hss">${tile(st.n, 'courses', 'n')}${tile(st.w, st.w > 1 ? 'victoires' : 'victoire', 'g')}${tile(st.p, 'podiums', 's')}${tile(st.t, 'top 10', 't')}${st.d ? tile(st.d, 'abandons', 'd') : ''}</div><ol class="hrs">${h.map(row).join('')}</ol>`;
  }
  function histModal(id) {
    load();
    const a = allH().map((h) => h.ath[id]).find(Boolean);
    C.openModal(`<h2>${C.esc(nameOf(id))}</h2><p class="hint">${C.flag(natOf(id))} ${C.esc(natOf(id))}${a ? ' · ' + C.esc(C.D.CATS[a.cat].fr) : ''}</p>${histHtml(id) || '<p class="hint">Aucun résultat enregistré.</p>'}`);
  }
  /** Clic dans la Data room : true si traité. */
  function click(t) {
    const d = t.closest('[data-dr]');
    if (d) { const [k, v] = d.dataset.dr.split(':'); if (k === 'fs') { const w = d.closest('.fswrap'); if (w) { const on = w.classList.toggle('is-fs'); document.body.classList.toggle('fs-lock', on); if (w.dataset.keep && C.share) C.share.fsOn(on); d.setAttribute('aria-pressed', on); } return true; } if (k === 'g') ui.g = v; else if (k === 'sub') { ui.sub = v; ui.s = 'all'; ui.more = false; } else if (k === 'open') ui.open[v] = !ui.open[v]; else if (k === 'y') { ui.y = v; ui.s = 'all'; } else if (k === 'cat') ui.cat = v; else if (k === 's') ui.s = v; else if (k === 'more') ui.more = !ui.more; ui.more = k === 'more' ? ui.more : false; C.rerender(); return true; }
    const h = t.closest('[data-hist]'); if (h) { if (C.rider) C.rider(h.dataset.hist); else histModal(h.dataset.hist); return true; }
    return false;
  }
  /** Un onglet par saison (2026-27, 2025-26) : { id, label, html }. */
  const seasonTabs = (id) => SEASONS.map((y) => { load(y); return { id: 's' + y, label: short(y).replace('-', '-'), html: seasonHtml(id, y) }; });
  const api = { init, render, click, histHtml, historyOf, seriesRanks, seasonTabs, preload, ready };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CX_DATAROOM = api;
})(typeof self !== 'undefined' ? self : this);
