/* CX GAME – interface */
(function () {
  'use strict';
  const D = window.CX_DATA, G = window.CX_GAME, N = window.CX_NAMES, A = window.CX_ATHLETES, CONFIG = window.CX_CONFIG || {};
  const TZ = 'Europe/Paris';
  const store = window.CX_STORE.create(CONFIG);

  const state = {
    tab: 'next', rank: 'gen', takenDesk: 1, takenG: 'H', takenCat: 'ELI',
    sim: null, user: null, authMode: 'in', authReady: false, authError: '',
    players: [], me: null,
    raw: { picks: {}, results: {} }, picks: {}, results: {}, draws: {},
    file: null, startlists: null, overrides: {}, loaded: false,
  };

  /* ---------- Utilitaires ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const now = () => state.sim || new Date();
  const fmt = (o) => new Intl.DateTimeFormat('fr-FR', Object.assign({ timeZone: TZ }, o));
  const F_DAY = fmt({ weekday: 'short', day: 'numeric', month: 'short' }), F_HOUR = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const at = (date) => G.parisInstant(date, '12:00');
  const dayOf = (date) => F_DAY.format(at(date));
  const hourText = (d) => { const [h, m] = F_HOUR.format(d).split(':'); return m === '00' ? `${+h} h` : `${+h} h ${m}`; };
  const dlShort = (d) => `${F_DAY.format(d)} à ${hourText(d)}`;
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  const ordinal = (n) => (n === 1 ? '1er' : `${n}e`);
  const NAT_CC = { BEL: 'be', NED: 'nl', FRA: 'fr', GBR: 'gb', ITA: 'it', SUI: 'ch', CZE: 'cz', GER: 'de', USA: 'us', CAN: 'ca', ESP: 'es', LUX: 'lu', DEN: 'dk', POL: 'pl', SWE: 'se', AUT: 'at', HUN: 'hu', SVK: 'sk', IRL: 'ie', NOR: 'no', AUS: 'au', NZL: 'nz', JPN: 'jp', BRA: 'br', POR: 'pt', SLO: 'si', ISR: 'il', COL: 'co', ARG: 'ar', LAT: 'lv', EST: 'ee', FIN: 'fi', UKR: 'ua', ROU: 'ro', CRO: 'hr' };
  const flagOf = (nat) => { const cc = NAT_CC[String(nat || '').toUpperCase()]; return cc ? `<img class="fl" src="https://flagcdn.com/w40/${cc}.png" width="20" height="15" alt="${esc(nat)}" title="${esc(nat)}" loading="lazy" onerror="this.style.display='none'">` : ''; };
  const info = (text) => `<button type="button" class="info" data-info="${esc(text)}" aria-label="Aide : ${esc(text)}">i</button>`;
  const myPicks = () => state.picks[state.me] || (state.picks[state.me] = {});
  const isAdmin = () => !!state.user && (store.mode === 'local' || (!!CONFIG.adminEmail && state.user.email.toLowerCase() === CONFIG.adminEmail.toLowerCase()));
  const allSessions = () => [...D.SESSIONS, D.WORLDS].sort((a, b) => G.sessionDeadline(a) - G.sessionDeadline(b));
  const lockedRace = (race) => G.raceLocked(race, now());
  const active = (races) => races.filter((r) => !r.cancelled);
  const sortedRaces = (s) => G.sessionRaces(s).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.gender.localeCompare(b.gender));
  const upcomingSession = () => allSessions().find((s) => G.sessionState(s, now()) !== 'terminée');
  const genderLabel = (g) => (g === 'H' ? 'Hommes' : 'Femmes');
  const raceName = (r) => `${D.CATS[r.cat].short} ${genderLabel(r.gender).toLowerCase()}`;

  /* ---------- Noms et listes de coureurs ---------- */
  const NAMES = {};
  Object.keys(A.lists).forEach((k) => A.lists[k].forEach((a) => { NAMES[a.id] = a.name; }));
  const nameOf = (id) => NAMES[id] || id;
  const startOf = (race) => { const s = state.startlists && state.startlists.races && state.startlists.races[race.id]; return s && s.start && s.start.length ? s : null; };
  /** Coureurs proposables pour une course : la start list si elle est publiée, sinon le classement UCI de la catégorie (vide pour U23/U19 tant qu'il n'y a pas de start list : saisie libre). */
  function poolOf(race) {
    const sl = startOf(race);
    if (sl) {
      const natOf = {}; (A.lists[`${race.cat}-${race.gender}`] || []).concat(A.lists[`ELI-${race.gender}`] || []).forEach((a) => { natOf[a.id] = a.nat; });
      return { start: true, rows: sl.start.map((r) => { const nm = N.displayName(r.name); if (!NAMES[r.ath]) NAMES[r.ath] = nm; return { id: r.ath, name: NAMES[r.ath], bib: r.bib, nat: natOf[r.ath] || '' }; }) };
    }
    const list = A.lists[`${race.cat}-${race.gender}`] || [];
    return { start: false, rows: list.slice().sort((a, b) => norm(a.src).localeCompare(norm(b.src))).map((a) => ({ id: a.id, name: a.name, nat: a.nat, bib: null })) };
  }

  /* ---------- Données du dépôt et stockage ---------- */
  const getJSON = (url) => fetch(url, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  function recompute() {
    G.setOverrides(Object.assign({}, state.overrides, state.ovStore));
    const picks = {};
    Object.keys(state.raw.picks).forEach((uid) => {
      picks[uid] = {};
      Object.entries(state.raw.picks[uid] || {}).forEach(([rid, p]) => { if (p && typeof p === 'object') { picks[uid][rid] = Object.assign({}, p); [['a', 'na'], ['b', 'nb'], ['d', 'nd']].forEach(([k, n]) => { if (p[k] && p[n] && !NAMES[p[k]]) NAMES[p[k]] = p[n]; }); } });
    });
    const res = {}, meta = {};
    Object.entries((state.file && state.file.races) || {}).forEach(([rid, r]) => {
      res[rid] = r.entries || [];
      (r.entries || []).forEach((e) => { if (e.name && !NAMES[e.ath]) NAMES[e.ath] = e.name; });
      if (r.start) meta[rid] = { start: r.start };
    });
    Object.entries(state.raw.results).forEach(([rid, entries]) => { res[rid] = entries || []; delete meta[rid]; });
    state.results = res;
    state.draws = G.autoDraws(res, meta, picks);
    Object.entries(state.draws).forEach(([rid, byP]) => Object.entries(byP).forEach(([pid, d]) => { picks[pid][rid] = Object.assign({}, picks[pid][rid], { d: d.ath, auto: true }); }));
    state.picks = picks;
    render();
  }
  function startStore() {
    store.onAuth((u) => { state.authReady = true; state.user = u; state.me = u ? u.uid : null; render(true); maybeStartPopup(); });
    store.listen({
      players: (list) => { state.players = list.map((x) => ({ id: x.id, name: x.name || x.id })).sort((a, b) => a.name.localeCompare(b.name, 'fr')); render(); },
      picks: (m) => { state.raw.picks = m; recompute(); },
      results: (m) => { state.raw.results = m; recompute(); },
      overrides: (m) => { state.ovStore = m || {}; recompute(); },
      athletes: () => {},
    });
  }
  const fail = (e) => alert('Enregistrement impossible : ' + (e && e.message ? e.message : e));

  /* ---------- Choix ---------- */
  function savePick(raceId, next) {
    const race = G.raceOf(raceId);
    if (!race || lockedRace(race)) { alert('Les choix de cette course sont verrouillés.'); return; }
    const clean = {};
    ['a', 'b', 'na', 'nb'].forEach((k) => { if (next[k]) clean[k] = next[k]; });
    if (!clean.a) { delete clean.b; delete clean.nb; }
    const p = myPicks();
    if (clean.a) p[raceId] = clean; else delete p[raceId];
    store.setPick(state.me, raceId, clean.a ? clean : null).catch(fail);
    comboClose(); render(true);
  }
  function choose(raceId, slot, id, label) {
    const cur = Object.assign({}, myPicks()[raceId] || {});
    const k = slot === 'a' ? ['a', 'na'] : ['b', 'nb'];
    if (id) { cur[k[0]] = id; if (label && !A.lists['ELI-H'].concat(A.lists['ELI-F']).some((a) => a.id === id)) cur[k[1]] = label; else delete cur[k[1]]; if (label) NAMES[id] = NAMES[id] || label; }
    else { delete cur[k[0]]; delete cur[k[1]]; }
    if (slot === 'b' && cur.b && cur.b === cur.a) return;
    savePick(raceId, cur);
  }

  /* ---------- Liste déroulante ---------- */
  function combo(race, slot) {
    const picks = myPicks(), cur = picks[race.id] || {};
    const used = G.usedInDesk(G.deskIdOf(race.id), race.gender, race.cat, picks, race.id, state.results);
    const pool = poolOf(race);
    const items = pool.rows.map((a) => {
      const isCur = cur[slot] === a.id, taken = used.has(a.id);
      const dis = !isCur && (taken || (slot === 'b' && cur.a === a.id));
      const meta = [a.nat, taken ? 'déjà pris' : ''].filter(Boolean).join(', ');
      return { a, isCur, dis, label: (a.bib ? a.bib + ' · ' : '') + a.name + (meta ? ` (${meta})` : '') };
    });
    const curId = cur[slot], curItem = items.find((x) => x.isCur);
    const curLabel = curItem ? curItem.label : curId ? nameOf(curId) : '';
    const ph = slot === 'a' ? 'Choisir un coureur (tape quelques lettres)' : 'Remplaçant (facultatif)';
    const dis = slot === 'b' && !cur.a;
    return `<div class="combo" data-race="${race.id}" data-slot="${slot}">
      <label class="sr" for="p${slot}-${race.id}">${slot === 'a' ? 'Coureur' : 'Remplaçant'}, ${esc(raceName(race))}</label>
      <input type="text" id="p${slot}-${race.id}" class="pick combo__in" role="combobox" aria-expanded="false" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(ph)}" value="${esc(curLabel)}" data-cur="${esc(curLabel)}"${dis ? ' disabled' : ''}>
      ${curId && !dis ? '<button type="button" class="combo__x" data-cx aria-label="Retirer ce choix">×</button>' : ''}
      <ul class="combo__list" role="listbox" hidden>
        ${pool.start ? '<li class="combo__hd">Par ordre de dossard (start list)</li>' : ''}
        ${items.map((x) => `<li role="option" class="combo__opt${x.dis ? ' is-off' : ''}" data-v="${esc(x.a.id)}" data-n="${esc(x.a.name)}" data-s="${esc(norm(x.a.name))}"${x.dis ? ' aria-disabled="true"' : ''}>${esc(x.label)}</li>`).join('')}
      </ul>
    </div>`;
  }
  const comboClose = () => document.querySelectorAll('.combo__list').forEach((l) => { l.hidden = true; const i = l.parentElement.querySelector('.combo__in'); if (i) { i.setAttribute('aria-expanded', 'false'); i.value = i.dataset.cur; } });
  function comboFilter(box) {
    const q = norm(box.querySelector('.combo__in').value.trim()), list = box.querySelector('.combo__list');
    let n = 0;
    list.querySelectorAll('.combo__opt').forEach((li) => { const ok = !q || li.dataset.s.includes(q); li.hidden = !ok; li.classList.remove('is-hl'); if (ok) n++; });
    const first = list.querySelector('.combo__opt:not([hidden]):not(.is-off)'); if (first && q) first.classList.add('is-hl');
    let none = list.querySelector('.combo__none');
    if (!n) { if (!none) { none = document.createElement('li'); none.className = 'combo__none'; list.appendChild(none); } none.textContent = 'Aucun coureur ne correspond.'; } else if (none) none.remove();
  }
  function comboOpen(box) { comboClose(); const i = box.querySelector('.combo__in'); i.value = ''; box.querySelector('.combo__list').hidden = false; i.setAttribute('aria-expanded', 'true'); comboFilter(box); }
  function comboChoose(box, li) { if (!li || li.classList.contains('is-off')) return; box.querySelector('.combo__list').hidden = true; choose(box.dataset.race, box.dataset.slot, li.dataset.v, li.dataset.n); }
  document.addEventListener('focusin', (e) => { const i = e.target.closest('.combo__in'); if (i) comboOpen(i.parentElement); });
  document.addEventListener('pointerdown', (e) => { const li = e.target.closest('.combo__opt'); if (li) { e.preventDefault(); comboChoose(li.closest('.combo'), li); } });
  document.addEventListener('input', (e) => { const i = e.target.closest('.combo__in'); if (i) comboFilter(i.parentElement); });
  document.addEventListener('keydown', (e) => {
    const i = e.target.closest && e.target.closest('.combo__in'); if (!i) return;
    const box = i.parentElement, list = box.querySelector('.combo__list'), vis = () => [...list.querySelectorAll('.combo__opt:not([hidden]):not(.is-off)')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); const v = vis(), k = v.findIndex((x) => x.classList.contains('is-hl')), n = e.key === 'ArrowDown' ? Math.min(v.length - 1, k + 1) : Math.max(0, k - 1);
      v.forEach((x) => x.classList.remove('is-hl')); if (v[n]) { v[n].classList.add('is-hl'); v[n].scrollIntoView({ block: 'nearest' }); }
    } else if (e.key === 'Enter') { e.preventDefault(); comboChoose(box, list.querySelector('.is-hl')); }
    else if (e.key === 'Escape') { comboClose(); i.blur(); }
  });

  /* ---------- Courses et sessions ---------- */
  function freeLink(race) { return `<button type="button" class="linkbtn" data-free="${race.id}">Coureur absent de la liste ? Saisir son nom</button>`; }
  function pickEditor(race) {
    const pool = poolOf(race);
    const note = !pool.start && !pool.rows.length ? '<p class="hint">Start list et classement non disponibles pour cette catégorie : saisie du nom à la main.</p>' : !pool.start ? '<p class="hint">Start list pas encore publiée : liste d’après le classement UCI.</p>' : '';
    return `<div class="pickbox">${pool.rows.length ? combo(race, 'a') + combo(race, 'b') : ''}${note}
      <span class="hint">${info('Le remplaçant est facultatif. Il joue à la place du titulaire seulement si celui-ci ne prend pas le départ (DNS).')} ${freeLink(race)}</span></div>`;
  }
  function pickSummary(playerId, race) {
    const p = (state.picks[playerId] || {})[race.id];
    if (!p || !p.a) return '<span class="none">Aucun choix</span>';
    const eff = G.effectiveAthlete(p, state.results, race.id);
    const drawn = p.d && eff === p.d, swapped = p.b && eff === p.b;
    if (drawn) return `<span class="who"><s class="who--out">${esc(nameOf(p.a))}</s>${p.b ? ` <s class="who--out">${esc(nameOf(p.b))}</s>` : ''} ${esc(nameOf(p.d))}</span><span class="sub">Tiré au sort</span>`;
    if (swapped) return `<span class="who"><s class="who--out">${esc(nameOf(p.a))}</s> ${esc(nameOf(p.b))}</span><span class="sub">Remplaçant en piste</span>`;
    return `<span class="who">${esc(nameOf(p.a))}</span>${p.b && !state.results[race.id] ? `<span class="sub">Remplaçant : ${esc(nameOf(p.b))}</span>` : ''}`;
  }
  function outcome(race, playerId) {
    const res = state.results[race.id];
    if (race.cancelled) return '<span class="none">Annulée</span>';
    if (!res) return lockedRace(race) ? '<span class="none">Résultat en attente</span>' : '';
    const pk = (state.picks[playerId] || {})[race.id], sc = G.scoreRace(race, pk, state.results);
    const eff = pk && G.effectiveAthlete(pk, state.results, race.id), e = eff && res.find((x) => x.ath === eff);
    const how = e ? (e.status || ordinal(e.rank)) : '';
    const w = res.find((x) => !x.status && x.rank === 1);
    return `<div class="out"><span class="pill ${sc > 0 ? 'pill--on' : 'pill--off'}">${sc > 0 ? '+' : ''}${sc}</span>${how ? `<span>${how}</span>` : ''}${w ? `<span class="hint">Vainqueur : ${esc(nameOf(w.ath))}</span>` : ''}</div>`;
  }
  function raceRow(race) {
    const doneCls = !race.cancelled && state.results[race.id] ? ((G.scoreRace(race, myPicks()[race.id], state.results) || 0) > 0 ? ' race--done race--hot' : ' race--done race--cold') : '';
    const when = `${dayOf(race.date)}, ${hourText(G.raceStart(race))}${race.timeKnown ? '' : ' (heure provisoire)'}${race.dateKnown ? '' : ' (date à confirmer)'}`;
    const flag = race.cancelled ? ' <span class="state">Annulée</span>' : race.moved ? ' <span class="state">Reportée</span>' : '';
    const body = race.cancelled ? '<span class="none">Course annulée : aucun choix</span>' : lockedRace(race) ? pickSummary(state.me, race) : pickEditor(race);
    return `<li class="race${race.cancelled ? ' race--off' : ''}${doneCls}">
      <div class="race__head"><span class="cat cat--${race.cat}">${D.CATS[race.cat].short}</span><span class="race__t">${genderLabel(race.gender)}</span>${race.mult > 1 || race.kind !== 'cx' ? `<span class="mult" title="Barème multiplié">×${+(race.mult).toFixed(2)}</span>` : ''}<span class="race__when">${esc(when)}</span>${flag}</div>
      <div>${body}</div>${outcome(race, state.me) ? `<div>${outcome(race, state.me)}</div>` : ''}</li>`;
  }
  const stateBadge = (s) => { const x = G.sessionState(s, now()); return `<span class="state state--${x.replace(' ', '-')}">${x === 'ouverte' ? 'Choix ouverts' : x === 'en cours' ? 'Choix verrouillés' : 'Terminée'}</span>`; };
  function sessionCard(session) {
    const races = sortedRaces(session), live = active(races), dl = G.sessionDeadline(session);
    const n = live.filter((r) => (myPicks()[r.id] || {}).a).length, open = live.some((r) => !lockedRace(r));
    const mine = G.sessionScore(session, myPicks(), state.results);
    let mood = '';
    if (G.sessionState(session, now()) === 'terminée' && state.players.length > 1) {
      const avg = state.players.reduce((s, p) => s + G.sessionScore(session, state.picks[p.id] || {}, state.results), 0) / state.players.length;
      mood = mine > avg ? ' session--hot' : mine < avg ? ' session--cold' : '';
    }
    const euro = session.races.some((id) => G.raceOf(id).kind !== 'cx');
    return `<article class="session${mood}" id="s-${session.id}"><header class="session__head"><div><h3 class="session__name">${esc(session.name)}</h3>
      <p class="session__meta">Deadline ${dlShort(dl)}</p></div>
      <div class="session__side">${stateBadge(session)}${open ? `<span class="count${n === live.length ? ' count--ok' : ''}">${n}/${live.length} choisis</span>` : `<span class="count count--pts">${mine} pts</span>`}</div></header>
      ${euro ? `<p class="hint" style="padding:8px 14px 0">${session.id === 'MO' ? 'Mondiaux : Élite ×3, U23 ×2, U19 ×1, hors desks (pool de coureurs propre), plus les bonus des 6 titres.' : 'Euros : Élite ×2, U23 ×4/3, U19 ×2/3.'}</p>` : ''}
      <ul class="races">${races.map(raceRow).join('')}</ul></article>`;
  }

  /* ---------- Onglets ---------- */
  const TABS = [
    { id: 'next', ic: '🚴', tx: 'Session à venir' }, { id: 'd1', ic: '1️⃣', tx: 'Desk 1' }, { id: 'd2', ic: '2️⃣', tx: 'Desk 2' }, { id: 'd3', ic: '3️⃣', tx: 'Desk 3' },
    { id: 'mo', ic: '🌈', tx: 'Mondiaux' }, { id: 'gen', ic: '🏆', tx: 'Classements' }, { id: 'taken', ic: '🔒', tx: 'Athlètes pris' }, { id: 'adm', ic: '⚙️', tx: 'Admin', admin: true },
  ];
  function renderTabs() {
    $('#tabs').innerHTML = !state.user ? '' : TABS.filter((t) => !t.admin || isAdmin()).map((t) => `<button type="button" role="tab" class="tab" data-tab="${t.id}" aria-selected="${state.tab === t.id}" aria-label="${t.tx}" title="${t.tx}"><span class="tab__ic">${t.ic}</span><span class="tab__tx">${t.tx}</span></button>`).join('');
  }
  function renderUserbar() {
    const el = $('#userbar');
    if (!state.user) { el.hidden = true; return; }
    el.hidden = false;
    const total = G.generalScore(myPicks(), state.results).total;
    el.innerHTML = `<span class="userbar__name">${esc(state.user.name)}</span><button type="button" class="linkbtn" data-logout>Déconnexion</button><span class="userbar__pts">${total} pts</span>`;
  }

  function viewNext() {
    const s = upcomingSession();
    if (!s) return '<p class="none">La saison est terminée.</p>';
    const live = active(G.sessionRaces(s)), n = live.filter((r) => (myPicks()[r.id] || {}).a).length, dl = G.sessionDeadline(s), ms = dl - now();
    const left = ms <= 0 ? 'Choix verrouillés' : ms > 86400000 ? `Il reste ${plural(Math.floor(ms / 86400000), 'jour', 'jours')}` : `Il reste ${Math.floor(ms / 3600000)} h ${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}`;
    return `<div class="next"><span class="next__l1">${esc(s.name)}</span><span class="next__l2">Deadline ${dlShort(dl)}</span><span class="next__l3">${n}/${live.length} choisis · ${left}</span></div>${sessionCard(s)}`;
  }
  function viewDesk(id) {
    const d = D.DESKS.find((x) => x.id === id), list = D.SESSIONS.filter((s) => s.desk === id).sort((a, b) => G.sessionDeadline(a) - G.sessionDeadline(b));
    return `<h2 class="title">${d.name} <span class="hint">· ${G.deskScore(id, myPicks(), state.results)} pts</span></h2><p class="hint">Un coureur une seule fois par desk, par genre et par catégorie. ${info('DNS : le titulaire est libéré et peut être rejoué. DNF ou disqualifié : 0 point et le coureur reste grillé jusqu’au desk suivant.')}</p>${list.map(sessionCard).join('')}`;
  }
  function viewWorlds() {
    const w = G.worldsScore(myPicks(), state.results), B = D.WORLDS_BONUS;
    return `<h2 class="title">Mondiaux d’Ostende <span class="hint">· ${w.total} pts</span></h2>
      <p class="hint">Joués pendant le desk 3, avec leur propre pool de coureurs. Bonus si tu as le vainqueur des deux courses (H et F) : Élite +${B.pair.ELI}, U23 +${B.pair.U23}, U19 +${B.pair.U19} ; +${B.all} si tu as les 6 titres.</p>${sessionCard(D.WORLDS)}`;
  }
  function playersRanked(fn) {
    return state.players.map((p) => ({ p, v: fn(state.picks[p.id] || {}) })).sort((a, b) => b.v - a.v || a.p.name.localeCompare(b.p.name, 'fr'));
  }
  function viewRank() {
    const opts = [['gen', 'Général'], ['1', 'Desk 1'], ['2', 'Desk 2'], ['3', 'Desk 3'], ['mo', 'Mondiaux']];
    const fn = state.rank === 'gen' ? (pk) => G.generalScore(pk, state.results).total : state.rank === 'mo' ? (pk) => G.worldsScore(pk, state.results).total : (pk) => G.deskScore(+state.rank, pk, state.results);
    const rows = playersRanked(fn); let prev = null, r = 0;
    return `<h2 class="title">Classements</h2><div class="seg">${opts.map(([k, l]) => `<button type="button" data-rank="${k}" aria-pressed="${state.rank === k}">${l}</button>`).join('')}</div>
      <div class="tablewrap"><table class="grid"><thead><tr><th class="num">#</th><th>Joueur</th><th class="num">Points</th></tr></thead><tbody>${rows.map((x, i) => { if (x.v !== prev) { r = i + 1; prev = x.v; } return `<tr class="${x.p.id === state.me ? 'me' : ''}"><td class="num">${r}</td><td>${esc(x.p.name)}</td><td class="num"><strong>${x.v}</strong></td></tr>`; }).join('') || '<tr><td colspan="3" class="none">Aucun joueur.</td></tr>'}</tbody></table></div>
      ${state.rank === 'gen' ? '<p class="hint">Général = desks 1 à 3 + Mondiaux (bonus compris).</p>' : ''}`;
  }
  /** Coureurs pris, par desk / genre / catégorie. Les choix des autres ne sont visibles qu'après la deadline de la course. */
  function viewTaken() {
    const g = state.takenG, c = state.takenCat, dk = state.takenDesk;
    const sessions = dk === 0 ? [D.WORLDS] : D.SESSIONS.filter((s) => s.desk === dk);
    const by = {};
    sessions.forEach((s) => G.sessionRaces(s).filter((r) => r.gender === g && r.cat === c && !r.cancelled).forEach((r) => {
      state.players.forEach((p) => {
        if (p.id !== state.me && !lockedRace(r)) return;
        const pk = (state.picks[p.id] || {})[r.id]; if (!pk || !pk.a) return;
        const eff = G.effectiveAthlete(pk, state.results, r.id) || pk.a;
        (by[eff] = by[eff] || []).push(`${p.name} (${s.name})`);
      });
    }));
    const seg = (key, vals) => `<div class="seg">${vals.map(([v, l]) => `<button type="button" data-taken="${key}:${v}" aria-pressed="${String(state['taken' + key]) === String(v)}">${l}</button>`).join('')}</div>`;
    const rows = Object.entries(by).sort((a, b) => nameOf(a[0]).localeCompare(nameOf(b[0]), 'fr'));
    return `<h2 class="title">Athlètes pris</h2>${seg('Desk', [[1, 'Desk 1'], [2, 'Desk 2'], [3, 'Desk 3'], [0, 'Mondiaux']])}${seg('G', [['H', 'Hommes'], ['F', 'Femmes']])}${seg('Cat', D.CAT_ORDER.map((k) => [k, D.CATS[k].short]))}
      <div class="tablewrap"><table class="grid"><thead><tr><th>Coureur</th><th>Pris par</th></tr></thead><tbody>${rows.map(([id, who]) => `<tr><td>${esc(nameOf(id))}</td><td>${who.map(esc).join('<br>')}</td></tr>`).join('') || '<tr><td colspan="2" class="none">Rien à montrer pour l’instant : les choix des autres apparaissent à la deadline.</td></tr>'}</tbody></table></div>`;
  }
  function viewAdmin() {
    const nRes = Object.keys(state.results).length, nSl = Object.keys((state.startlists && state.startlists.races) || {}).length;
    const pend = Object.entries(state.results).filter(([, l]) => G.dnsPending(l).length).map(([id]) => id);
    return `<h2 class="title">Admin</h2>
      <p>Résultats chargés : <strong>${nRes}</strong> course(s) · start lists : <strong>${nSl}</strong> course(s)${pend.length ? ` · <span class="err">DNS à confirmer : ${pend.join(', ')}</span>` : ''}.</p>
      <p class="hint">Les résultats et start lists s’écrivent dans le dépôt avec tools/results.js et tools/startlist.js, après ta validation. Les écrans de saisie arrivent à l’étape 6.</p>
      <div class="field"><label for="sim">Simuler une date (essais) ${info('Change l’heure vue par l’appli pour tester verrous et affichages. Rien n’est enregistré.')}</label>
        <input type="datetime-local" id="sim" value="${state.sim ? state.sim.toISOString().slice(0, 16) : ''}"><span><button type="button" class="btn btn--ghost" data-sim-clear>Heure réelle</button></span></div>`;
  }
  function viewAuth() {
    const up = state.authMode === 'up';
    return `<form class="auth" id="auth"><h2>${up ? 'Créer un compte' : 'Connexion'}</h2>
      ${up ? '<div class="field"><label for="au-name">Ton nom de joueur</label><input id="au-name" required autocomplete="nickname"></div>' : ''}
      <div class="field"><label for="au-mail">Adresse e-mail</label><input id="au-mail" type="email" required autocomplete="email"></div>
      <div class="field"><label for="au-pw">Mot de passe</label><input id="au-pw" type="password" required minlength="6" autocomplete="${up ? 'new-password' : 'current-password'}"></div>
      ${state.authError ? `<p class="err">${esc(state.authError)}</p>` : ''}
      <p><button class="btn" type="submit">${up ? 'Créer mon compte' : 'Me connecter'}</button> <button type="button" class="linkbtn" data-auth-mode="${up ? 'in' : 'up'}">${up ? 'J’ai déjà un compte' : 'Créer un compte'}</button></p>
      ${store.mode === 'local' ? '<p class="hint">Mode essai : comptes et choix restent dans ce navigateur.</p>' : ''}</form>`;
  }

  function render(force) {
    if (!force && document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('combo__in')) return;   // pas de redessin pendant la saisie
    renderTabs(); renderUserbar();
    const el = $('#panel');
    if (!state.authReady || !state.loaded) { el.innerHTML = '<p class="none">Chargement…</p>'; return; }
    if (!state.user) { el.innerHTML = viewAuth(); return; }
    const t = state.tab;
    el.innerHTML = t === 'next' ? viewNext() : t === 'd1' ? viewDesk(1) : t === 'd2' ? viewDesk(2) : t === 'd3' ? viewDesk(3) : t === 'mo' ? viewWorlds() : t === 'gen' ? viewRank() : t === 'taken' ? viewTaken() : isAdmin() ? viewAdmin() : '';
  }

  /* ---------- « Ligne de départ » : fenêtre la veille à partir de 21 h ---------- */
  function maybeStartPopup() {
    if (!state.user || !state.loaded || !state.picksReadyOnce) return;
    const s = upcomingSession(); if (!s || G.sessionState(s, now()) !== 'ouverte') return;
    const first = sortedRaces(s).find((r) => !r.cancelled); if (!first) return;
    const prev = new Date(at(first.date).getTime() - 86400000), eveDate = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(prev);
    if (now() < G.parisInstant(eveDate, '21:00')) return;
    const key = 'cxgame.startpopup.' + s.id; try { if (localStorage.getItem(key)) return; } catch (e) { /* ignoré */ }
    const rows = sortedRaces(s).filter((r) => !r.cancelled).map((r) => ({ r, sl: startOf(r) }));
    const body = rows.map(({ r, sl }) => `<h4>${D.CATS[r.cat].short} ${genderLabel(r.gender)}</h4>${sl ? `<div class="startgrid">${sl.start.slice(0, 30).map((x) => `<div>${x.bib}. ${esc(nameOf(x.ath) !== x.ath ? nameOf(x.ath) : N.displayName(x.name || x.ath))}</div>`).join('')}</div>` : '<p class="none">Start list pas encore publiée : rien d’inventé. Choix possibles d’après le classement UCI.</p>'}`).join('');
    showModal(`<h3>Ligne de départ · ${esc(s.name)}</h3><p>La session se verrouille ${dlShort(G.sessionDeadline(s))}.</p>${body}<p><button class="btn" data-close data-never="${key}">OK</button></p>`);
  }
  function showModal(html) { const m = $('#modal'); m.innerHTML = `<div class="modal__box" role="dialog" aria-modal="true">${html}</div>`; m.hidden = false; }

  /* ---------- Événements ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target;
    const tab = t.closest('[data-tab]'); if (tab) { state.tab = tab.dataset.tab; render(true); window.scrollTo({ top: 0 }); return; }
    const rk = t.closest('[data-rank]'); if (rk) { state.rank = rk.dataset.rank; render(true); return; }
    const tk = t.closest('[data-taken]'); if (tk) { const [k, v] = tk.dataset.taken.split(':'); state['taken' + k] = k === 'Desk' ? +v : v; render(true); return; }
    if (t.closest('[data-logout]')) { store.signOut(); return; }
    const am = t.closest('[data-auth-mode]'); if (am) { state.authMode = am.dataset.authMode; state.authError = ''; render(true); return; }
    if (t.closest('[data-sim-clear]')) { state.sim = null; render(true); return; }
    const cx = t.closest('[data-cx]'); if (cx) { const box = cx.closest('.combo'); comboClose(); choose(box.dataset.race, box.dataset.slot, ''); return; }
    const fr = t.closest('[data-free]');
    if (fr) { const race = G.raceOf(fr.dataset.free), nm = (prompt('Nom du coureur (Prénom Nom) :') || '').trim(); if (!nm) return;
      const id = N.slug(N.displayName(nm)), used = G.usedInDesk(G.deskIdOf(race.id), race.gender, race.cat, myPicks(), race.id, state.results);
      if (used.has(id)) { alert('Ce coureur est déjà pris dans ce desk.'); return; }
      const cur = myPicks()[race.id] || {}, slot = cur.a ? 'b' : 'a'; choose(race.id, slot, id, N.displayName(nm)); return; }
    const inf = t.closest('[data-info]');
    if (inf) { const tip = $('#tip'), r = inf.getBoundingClientRect(); tip.textContent = inf.dataset.info; tip.hidden = false; tip.style.left = Math.max(8, Math.min(window.innerWidth - 290, r.left)) + 'px'; tip.style.top = (r.bottom + 6) + 'px'; return; }
    $('#tip').hidden = true;
    if (t.closest('[data-close]')) { const nv = t.closest('[data-never]'); if (nv) { try { localStorage.setItem(nv.dataset.never, '1'); } catch (er) { /* ignoré */ } } $('#modal').hidden = true; return; }
    if (t === $('#modal')) $('#modal').hidden = true;
    if (!t.closest('.combo')) comboClose();
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'sim') { state.sim = e.target.value ? new Date(e.target.value) : null; render(true); } });
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'auth') return; e.preventDefault();
    const mail = $('#au-mail').value, pw = $('#au-pw').value, name = state.authMode === 'up' ? $('#au-name').value.trim() : '';
    try { state.authError = ''; if (state.authMode === 'up') await store.signUp(mail, pw, name); else await store.signIn(mail, pw); } catch (er) { state.authError = er.message; render(true); }
  });
  const theme = $('#theme');
  try { theme.value = localStorage.getItem('cxgame.theme') || 'flandre'; } catch (e) { /* ignoré */ }
  theme.addEventListener('change', () => { document.documentElement.setAttribute('data-theme', theme.value); const m = document.querySelector('meta[name=theme-color]'); try { localStorage.setItem('cxgame.theme', theme.value); } catch (e) { /* ignoré */ } if (state.user && store.setPlayerTheme) store.setPlayerTheme(state.me, theme.value).catch(() => {}); });

  /* ---------- Démarrage ---------- */
  Promise.all([getJSON('data/results.json'), getJSON('data/startlists.json'), getJSON('data/calendar-overrides.json')]).then(([r, s, o]) => {
    state.file = r; state.startlists = s; state.overrides = o || {}; state.loaded = true; state.picksReadyOnce = true;
    startStore(); recompute(); maybeStartPopup();
  });
  window.CX_APP = { state, G, D };
})();
