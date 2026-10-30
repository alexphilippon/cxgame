/* CX GAME – interface (clone de l'interface du SKI GAME, adapté au cyclo-cross) */
(function () {
  'use strict';
  const D = window.CX_DATA, G = window.CX_GAME, N = window.CX_NAMES, BASE = window.CX_ATHLETES, SHARE = window.CX_SHARE, STATS = window.CX_STATS, CONFIG = window.CX_CONFIG || {};
  const TZ = 'Europe/Paris';
  const PHOTO_DIR = 'img/athletes/'; // une photo par coureur : img/athletes/<id>.jpg (facultatif)

  /* ---------- Coureurs : classement UCI (js/athletes.js) + noms lus dans les start lists, résultats et choix libres ---------- */
  const NAMES = {}, ATH = {}, LIST = { H: [], F: [] };
  Object.keys(BASE.lists).forEach((k) => {
    const [cat, g] = k.split('-');
    BASE.lists[k].forEach((a) => {
      NAMES[a.id] = a.name;
      if (!ATH[a.id]) { ATH[a.id] = Object.assign({}, a, { gender: g, cat }); LIST[g].push(ATH[a.id]); }
    });
  });
  const freshSubs = () => ({ 1: 'mine', 2: 'mine', 3: 'mine', 0: 'mine' });
  const state = {
    tab: 'next',
    ff: { cat: [], gender: [] },   // filtres d'affichage des desks (vide = tout)
    sub: freshSubs(), sim: null, demo: false,
    user: null, authMode: 'up', authReady: false, authError: '',
    players: [], me: null, picks: {}, results: {},
    tq: '', major: true, tf: 'all',
    raw: { picks: {}, results: {} }, file: null, draws: {}, startlists: null,
    overrides: {}, ovStore: {}, gsub: 'globes', extra: [], aliases: {}, contacts: {},
  };

  /* ---------- Utilitaires ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => state.sim || new Date();
  const fmt = (opts) => new Intl.DateTimeFormat('fr-FR', Object.assign({ timeZone: TZ }, opts));
  const F_DAY = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
  const F_HM = fmt({ hour: '2-digit', minute: '2-digit' });
  const F_MO = fmt({ month: 'short' });
  const F_NUM = fmt({ day: 'numeric' });
  const F_DM = fmt({ day: '2-digit', month: '2-digit' });
  const dmOf = (date) => F_DM.format(at(date));
  const F_HOUR = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const F_SHORT = fmt({ day: 'numeric', month: 'short' });
  const at = (date) => G.parisInstant(date, '12:00');
  const dayOf = (date) => F_DAY.format(at(date));
  const shortOf = (date) => F_SHORT.format(at(date));
  const hourText = (d) => { const [h, m] = F_HOUR.format(d).split(':'); return m === '00' ? `${+h} h` : `${+h} h ${m}`; };
  const dlShort = (d) => `${F_DAY.format(d)} à ${hourText(d)}`;
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  const surname = (name) => { const p = name.split(' '); return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : name; };
  const ordinal = (n) => (n === 1 ? '1er' : `${n}e`);
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  /* Drapeaux : images (les emoji de drapeaux ne s'affichent pas sous Windows). */
  const PLACE_CC = { 'Oudenaarde': 'be', 'Middelkerke': 'be', 'Zeddam': 'nl', 'Niel': 'be', 'Merksplas': 'be', 'Hamme-Zogge': 'be', 'Lokeren': 'be', 'Beringen': 'be', 'Ostrava': 'cz', 'Tábor': 'cz', 'Ruddervoorde': 'be', 'Glasgow': 'gb', 'Mol': 'be', 'Antwerpen': 'be', 'Koksijde': 'be', 'Hofstade': 'be', 'Loenhout': 'be', 'Heusden-Zolder': 'be', 'Gavere': 'be', 'Namur': 'be', 'Besançon': 'fr', 'Diegem': 'be', 'Baal': 'be', 'Gullegem': 'be', 'Zonhoven': 'be', 'Benidorm': 'es', 'Hamme': 'be', 'Hoogerheide': 'nl', 'Maldegem': 'be', 'Lille': 'be', 'Sint-Niklaas': 'be', 'Brussel': 'be', 'Oostende': 'be' };
  const PLACE_RE = new RegExp(Object.keys(PLACE_CC).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  const NAT_CC = { BEL: 'be', NED: 'nl', FRA: 'fr', GBR: 'gb', ITA: 'it', SUI: 'ch', CZE: 'cz', GER: 'de', USA: 'us', CAN: 'ca', ESP: 'es', LUX: 'lu', DEN: 'dk', POL: 'pl', SWE: 'se', AUT: 'at', HUN: 'hu', SVK: 'sk', IRL: 'ie', NOR: 'no', AUS: 'au', NZL: 'nz', JPN: 'jp', BRA: 'br', POR: 'pt', SLO: 'si', ISR: 'il', COL: 'co', ARG: 'ar', LAT: 'lv', EST: 'ee', FIN: 'fi', UKR: 'ua', ROU: 'ro', CRO: 'hr' };
  const flagOf = (nat) => { const cc = NAT_CC[String(nat || '').toUpperCase()]; return cc ? `<img class="fl dr__flag" src="https://flagcdn.com/w40/${cc}.png" srcset="https://flagcdn.com/w80/${cc}.png 2x" width="20" height="15" alt="${esc(nat)}" title="${esc(nat)}" loading="lazy" onerror="this.style.display='none'">` : ''; };
  /** Texte HTML échappé avec un drapeau devant chaque lieu de course connu. */
  function fl(text) {
    let out = '', last = 0, m;
    PLACE_RE.lastIndex = 0;
    while ((m = PLACE_RE.exec(text))) {
      const cc = PLACE_CC[m[0]];
      out += esc(text.slice(last, m.index)) + `<img class="fl" src="https://flagcdn.com/w40/${cc}.png" srcset="https://flagcdn.com/w80/${cc}.png 2x" width="20" height="15" alt="" loading="lazy" onerror="this.style.display='none'">` + esc(m[0]);
      last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  }
  /** Bouton « i » qui ouvre une petite bulle d'aide. */
  const info = (text) => `<button type="button" class="info" data-info="${esc(text)}" aria-label="Aide : ${esc(text)}">i</button>`;
  const myPicks = () => state.picks[state.me] || (state.picks[state.me] = {});
  const seenIds = () => { try { return JSON.parse(localStorage.getItem('cxgame.seenPlayers') || '[]'); } catch (e) { return []; } };
  const newPlayers = () => { const seen = new Set(seenIds()); return state.players.filter((p) => p.id !== state.me && !seen.has(p.id)); };
  const isAdmin = () => !!state.user && !state.demo && (store.mode === 'local' || (!!CONFIG.adminEmail && state.user.email.toLowerCase() === CONFIG.adminEmail.toLowerCase()));

  const allSessions = () => [...D.SESSIONS, D.WORLDS].sort((a, b) => G.sessionDeadline(a) - G.sessionDeadline(b));
  const scopeSessions = (key) => D.SESSIONS.filter((s) => s.desk === key).concat(D.WORLDS.desk === key ? [D.WORLDS] : [])   // le Desk 3 inclut les Mondiaux, rangés dans l'ordre chronologique
    .sort((a, b) => G.sessionDeadline(a) - G.sessionDeadline(b));
  const locked = (session) => G.sessionState(session, now()) !== 'ouverte';
  const lockedRace = (race) => G.raceLocked(race, now());
  const visible = (playerId, race) => playerId === state.me || lockedRace(race);
  const active = (races) => races.filter((r) => !r.cancelled);
  const passF = (r) => (!state.ff.cat.length || state.ff.cat.includes(r.cat)) && (!state.ff.gender.length || state.ff.gender.includes(r.gender));
  const sortedRaces = (session) => G.sessionRaces(session)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.gender.localeCompare(b.gender));
  const upcomingSession = () => allSessions().find((s) => G.sessionState(s, now()) !== 'terminée');
  const sessionOf = (race) => G.sessionOfRace(race.id);
  const nameOf = (id) => NAMES[id] || id;

  /* ---------- Stockage partagé (Firebase) ou local ---------- */
  const store = window.CX_STORE.create(CONFIG);
  let rafId = 0, pendingRender = false;
  const editing = () => { const el = document.activeElement; return !!el && el !== document.body && !!el.closest('#panel') && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName); };
  function scheduleRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; if (editing()) { pendingRender = true; return; } render(); setTimeout(dnsCheck, 400); });
  }
  document.addEventListener('focusout', () => { if (pendingRender) setTimeout(() => { if (!editing()) { pendingRender = false; render(); } }, 0); });

  /** Coureurs ajoutés (Firestore) : intégrés aux noms et aux listes, sauf s'ils ont été fusionnés avec un autre. */
  const ADDED = {};
  function rebuildAthletes() {
    Object.keys(ADDED).forEach((id) => { delete NAMES[id]; delete ATH[id]; });
    ['H', 'F'].forEach((g) => { LIST[g] = LIST[g].filter((a) => !ADDED[a.id]); });
    Object.keys(ADDED).forEach((k) => delete ADDED[k]);
    state.extra.forEach((x) => {
      if (state.aliases[x.id]) return;
      ADDED[x.id] = true; NAMES[x.id] = x.name;
      ATH[x.id] = Object.assign({ cat: 'ELI', nat: '' }, x); LIST[x.gender].push(ATH[x.id]);
    });
  }
  const canon = (id) => { let n = 0; while (id && state.aliases[id] && n++ < 5) id = state.aliases[id]; return id; };
  const markPlayersSeen = () => { try { localStorage.setItem('cxgame.seenPlayers', JSON.stringify(state.players.map((p) => p.id))); } catch (e) { /* ignoré */ } scheduleRender(); };
  /** Recalcule tout ce qui dérive des données brutes : surcharges du calendrier, choix et résultats. */
  function recompute() {
    if (state.demo) return;
    G.setOverrides(Object.assign({}, state.overrides, state.ovStore));
    const picks = {};
    Object.keys(state.raw.picks).forEach((uid) => {
      picks[uid] = {};
      Object.entries(state.raw.picks[uid] || {}).forEach(([rid, p]) => {
        if (!p || typeof p !== 'object') return;
        picks[uid][rid] = Object.assign({}, p);
        ['a', 'b', 'd'].forEach((k) => { if (p[k]) picks[uid][rid][k] = canon(p[k]); });
      });
    });
    const res = {}, meta = {};
    Object.entries((state.file && state.file.races) || {}).forEach(([rid, r]) => {   // résultats officiels du dépôt (data/results.json)
      res[rid] = (r.entries || []).map((e) => Object.assign({}, e, { ath: canon(e.ath) }));
      (r.entries || []).forEach((e) => { if (e.name && !NAMES[e.ath]) NAMES[e.ath] = e.name; });
      if (r.start) meta[rid] = { start: r.start };
    });
    Object.entries(state.raw.results).forEach(([rid, entries]) => { res[rid] = (entries || []).map((e) => Object.assign({}, e, { ath: canon(e.ath) })); delete meta[rid]; });
    state.results = res;
    state.draws = G.autoDraws(res, meta, picks); // tirages au sort : fonction pure des données publiques, donc vérifiables
    Object.entries(state.draws).forEach(([rid, byPlayer]) => Object.entries(byPlayer).forEach(([pid, d]) => { picks[pid][rid] = Object.assign({}, picks[pid][rid], { d: d.ath, auto: true }); }));
    state.picks = picks;
    scheduleRender();
  }
  function startStore() {
    store.onAuth((u) => { state.authReady = true; state.user = u; state.me = u ? u.uid : null; if (u && !state.picks[u.uid]) state.picks[u.uid] = {}; introRules(); if (u && isAdmin() && store.listenContacts && !state.contactsOn) { state.contactsOn = true; store.listenContacts((o) => { state.contacts = o || {}; scheduleRender(); }); } if (!state.demo) { state.authError = ''; scheduleRender(); } });
    setTimeout(() => { if (!state.picksReady) { state.picksLate = true; scheduleRender(); } }, 12000);
    store.listen({
      players: (list) => { state.players = list.map((x) => ({ id: x.id, name: x.name || x.email || x.id, photo: x.photo || '', blocked: !!x.photoBlocked, lastSeen: Number(x.lastSeen) || 0, theme: x.theme || '' })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        const sig = JSON.stringify(state.players.map((p) => [p.id, p.name, p.photo, p.blocked])), same = sig === state.playersSig; state.playersSig = sig;
        if (!same || state.tab === 'adm') scheduleRender(); },
      picks: (m) => { state.raw.picks = m; state.picksReady = true; state.syncErr = false; recompute(); },
      error: () => { state.syncErr = true; scheduleRender(); },
      results: (m) => { state.raw.results = m; recompute(); },
      overrides: (m) => { state.ovStore = m || {}; recompute(); },
      athletes: (l) => { state.extra = l || []; rebuildAthletes(); recompute(); },
      aliases: (m) => { state.aliases = m || {}; rebuildAthletes(); recompute(); },
    });
  }
  const fail = (e) => { alert('Enregistrement impossible : ' + (e && e.message ? e.message : e) + '\nVérifie ta connexion et réessaie.'); };

  /* ---------- Éléments récurrents ---------- */
  const catLabel = (r) => D.CATS[r.cat].short;                       // Élite, U23, U19
  const discLabel = catLabel;                                        // nom attendu par share.js
  const genderLabel = (r) => (r.gender === 'H' ? 'Hommes' : 'Femmes');
  const raceName = (r) => `${catLabel(r)} ${genderLabel(r).toLowerCase()}`;
  const placeLabel = (r) => r.place;
  const raceTag = (r) => `${placeLabel(r)} ${r.cat === 'ELI' ? '' : r.cat + ' '}${r.gender}`.replace(/\s+/g, ' ');
  const multTxt = (m) => (Number.isInteger(m) ? `×${m}` : `×${Math.round(m * 3)}/3`);
  function discBadge(r) {
    const mult = r.mult !== 1
      ? `<span class="mult" title="${r.kind === 'mondial' ? 'Barème des Mondiaux : Élite ×3, U23 ×2, U19 ×1' : 'Barème des Euros : Élite ×2, U23 ×1, U19 ×2/3'}">${multTxt(r.mult)}</span>` : '';
    return `<span class="disc disc--${r.cat}">${esc(catLabel(r))}</span>${mult}`;
  }
  function stateBadge(session) {
    const s = G.sessionState(session, now());
    return `<span class="state state--${s.replace(' ', '-')}">${s === 'ouverte' ? 'Choix ouverts' : s === 'en cours' ? 'Choix verrouillés' : 'Terminée'}</span>`;
  }
  /** Avatar : initiales par défaut, photo par-dessus si le fichier existe (sinon l'image est retirée). */
  function avatar(a, on, size) {
    const caps = a.name.split(' ').filter((w) => /^[A-ZÀ-ÝÖÜÄ]/.test(w));
    const initials = (caps.length > 1 ? caps[0][0] + caps[caps.length - 1][0] : (caps[0] || a.name).slice(0, 2)).toUpperCase();
    return `<span class="avatar avatar--${a.gender}${size ? ' avatar--' + size : ''}${on === false ? ' is-off' : ''}" aria-hidden="true"><span class="avatar__in">${esc(initials)}</span><img class="avatar__img" src="${PHOTO_DIR}${a.id}.jpg" alt="" loading="lazy" onerror="this.style.display='none'"></span>`;
  }
  const avatarOf = (id, size) => (ATH[id] ? avatar(ATH[id], true, size) : '');
  /** Nom de coureur cliquable (ouvre « qui l'a pris ») et nom de joueur. */
  const skn = (id, label) => `<button type="button" class="lnk" data-rider="${esc(id)}" title="Voir qui l’a pris">${esc(label != null ? label : nameOf(id))}</button>`;
  const pln = (p) => `<button type="button" class="lnk" data-player="${esc(p.id)}" title="${FICHE_ON ? 'Voir la fiche' : ''}">${esc(p.name)}</button>`;
  const listName = (a) => (a.src || a.name);                          // « NOM Prénom » : tri et liste déroulante
  const norm2 = (s) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim();

  /** Start list d'une course (data/startlists.json), ou null si elle n'est pas publiée : on n'invente rien. */
  function startListOf(race) {
    const s = state.startlists && state.startlists.races && state.startlists.races[race.id];
    if (!s || !s.start || !s.start.length) return null;
    return { rows: s.start.map((r) => { const nm = r.name ? N.displayName(r.name) : nameOf(r.ath); if (!NAMES[r.ath]) NAMES[r.ath] = nm; return { bib: r.bib, name: r.name ? N.displayName(r.name) : nameOf(r.ath), nat: (ATH[r.ath] || {}).nat || '', ath: r.ath }; }), fetched: s.fetched };
  }
  /** Coureurs proposables pour une course : la start list si elle est publiée, sinon le classement UCI de la catégorie (vide en U23 et U19 : saisie libre). */
  function poolOf(race) {
    const sl = startListOf(race);
    const extras = state.extra.filter((x) => !x.pending && !state.aliases[x.id] && x.gender === race.gender && (x.cat || 'ELI') === race.cat && !(BASE.lists[`${race.cat}-${race.gender}`] || []).some((a) => a.id === x.id));
    const list = (BASE.lists[`${race.cat}-${race.gender}`] || []).concat(extras).slice().sort((a, b) => norm(listName(a)).localeCompare(norm(listName(b))));
    const full = list.map((a) => ({ id: a.id, name: a.name, nat: a.nat, bib: null, src: listName(a) }));
    if (sl) {
      const inSl = new Set(sl.rows.map((r) => r.ath));
      return { start: true, rows: sl.rows.map((r) => ({ id: r.ath, name: r.name, nat: r.nat, bib: r.bib, src: r.name })), out: full.filter((a) => !inSl.has(a.id)) };
    }
    return { start: false, rows: full, out: [] };
  }
  /** Choix (titulaire ou remplaçant) qui ne figurent pas sur la start list publiée : [{race, slot, ath}] */
  function dnsPicks() {
    const out = [];
    Object.keys(myPicks()).forEach((rid) => {
      const race = G.raceOf(rid), pk = myPicks()[rid];
      if (!race || race.cancelled || lockedRace(race) || !pk) return;
      const sl = startListOf(race); if (!sl) return;
      const inSl = new Set(sl.rows.map((r) => r.ath));
      ['a', 'b'].forEach((slot) => { if (pk[slot] && !inSl.has(pk[slot])) out.push({ race, slot, ath: pk[slot] }); });
    });
    return out;
  }
  const resOf = (race) => state.results[race.id];
  function winnerOf(raceId) {
    const res = state.results[raceId], w = res && res.find((e) => !e.status && e.rank === 1);
    return w ? nameOf(w.ath) : '';
  }

  /* ---------- Sélecteurs de choix ---------- */
  function freeLink(race, slot) { return `<button type="button" class="freelink" data-free="${race.id}" data-slot="${slot}">${race.gender === 'F' ? 'Coureuse absente de la liste ? Saisir son nom' : 'Coureur absent de la liste ? Saisir son nom'}</button>`; }
  /** Liste déroulante avec recherche : on tape quelques lettres, la liste ne garde que les noms qui les contiennent. */
  function combo(race, session, slot) {
    const picks = myPicks();
    const used = G.usedInDesk(G.deskIdOf(race.id), race.gender, race.cat, picks, race.id, state.results);
    const cur = picks[race.id] || {};
    const pool = poolOf(race);
    const items = pool.rows.concat(pool.out || []).map((a, i) => {
      const off = i >= pool.rows.length;
      const isCur = cur[slot] === a.id, taken = used.has(a.id);
      const dis = !isCur && (taken || (slot === 'b' && cur.a === a.id));
      const meta = [a.nat, taken && slot === 'a' ? 'déjà pris' : ''].filter(Boolean).join(', ');
      return { a, isCur, dis, off, label: (a.bib ? a.bib + ' · ' : off ? 'DNS · ' : '') + a.src + (meta ? ` (${meta})` : '') };
    });
    const curItem = items.find((x) => x.isCur), curId = cur[slot];
    const curLabel = curItem ? curItem.label : curId ? (pool.start ? 'DNS · ' : '') + nameOf(curId) : '';
    const ph = slot === 'a' ? (race.gender === 'F' ? 'Choisir une coureuse (tape quelques lettres)' : 'Choisir un coureur (tape quelques lettres)') : 'Remplaçant (facultatif)';
    const id = `p${slot}-${race.id}`;
    const dis = slot === 'b' && !cur.a;
    return `<div class="combo${slot === 'b' ? ' combo--sub' : ''}" data-race="${race.id}" data-slot="${slot}">
      <input type="text" id="${id}" class="pick${slot === 'b' ? ' pick--sub' : ''} combo__in" role="combobox" aria-expanded="false" aria-autocomplete="list" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(ph)}" value="${esc(curLabel)}" data-cur="${esc(curLabel)}"${dis ? ' disabled' : ''}>
      ${curId && !dis ? '<button type="button" class="combo__x" data-cx aria-label="Retirer ce choix" title="Retirer ce choix">×</button>' : ''}
      <ul class="combo__list" role="listbox" hidden>${curId ? '<li role="option" class="combo__opt combo__opt--clear" data-v="">— Aucun —</li>' : ''}${pool.start ? '<li class="combo__hd" aria-hidden="true">Par ordre de dossard (start list)</li>' : ''}${items.map((x, k) => `${x.off && !items[k - 1].off ? '<li class="combo__hd combo__hd--out" aria-hidden="true">Hors start list (DNS)</li>' : ''}<li role="option" class="combo__opt${x.off ? ' combo__opt--out' : ''}${x.dis ? ' is-off' : ''}${x.isCur ? ' is-cur' : ''}" data-v="${esc(x.a.id)}" data-n="${esc(x.a.name)}" data-l="${esc(norm(x.a.src))}" data-s="${esc(norm(x.a.name + ' ' + x.a.src + ' ' + (x.a.nat || '')))}"${x.dis ? ' aria-disabled="true"' : ''}>${esc(x.label)}</li>`).join('')}</ul>
    </div>`;
  }
  const comboClose = () => document.querySelectorAll('.combo__list').forEach((l) => { l.hidden = true; const i = l.parentElement.querySelector('.combo__in'); if (i) { i.setAttribute('aria-expanded', 'false'); i.value = i.dataset.cur; } });
  function comboFilter(box) {
    const q = norm(box.querySelector('.combo__in').value.trim());
    const list = box.querySelector('.combo__list');
    let n = 0;
    const opts = [...list.querySelectorAll('.combo__opt:not(.combo__opt--clear)')];
    if (list.dataset.sorted !== '1') { opts.forEach((li, k) => { li.dataset.k = k; }); list.dataset.sorted = '1'; }
    const outc = (li) => (li.classList.contains('combo__opt--out') ? 1 : 0);
    opts.sort((x, y) => (outc(x) - outc(y)) || ((q && y.dataset.l.startsWith(q) ? 1 : 0) - (q && x.dataset.l.startsWith(q) ? 1 : 0)) || x.dataset.k - y.dataset.k).forEach((li) => list.appendChild(li));
    const hdOut = list.querySelector('.combo__hd--out'), firstOut = list.querySelector('.combo__opt--out');
    if (hdOut && firstOut) list.insertBefore(hdOut, firstOut);
    const none0 = list.querySelector('.combo__none'); if (none0) list.appendChild(none0);
    list.querySelectorAll('.combo__opt').forEach((li) => {
      const ok = li.classList.contains('combo__opt--clear') || !q || li.dataset.s.includes(q);
      li.hidden = !ok; li.classList.remove('is-hl'); if (ok && !li.classList.contains('combo__opt--clear')) n++;
    });
    if (hdOut) hdOut.hidden = !list.querySelector('.combo__opt--out:not([hidden])');
    const first = [...list.querySelectorAll('.combo__opt:not([hidden]):not(.is-off):not(.combo__opt--clear)')][0];
    if (first && q) first.classList.add('is-hl');
    let none = list.querySelector('.combo__none');
    if (!n) { if (!none) { none = document.createElement('li'); none.className = 'combo__none'; list.appendChild(none); } none.textContent = 'Aucun coureur ne correspond. Utilise le lien « absent de la liste » ci-dessous.'; } else if (none) none.remove();
  }
  function comboOpen(box) {
    comboClose();
    const i = box.querySelector('.combo__in'), list = box.querySelector('.combo__list');
    i.value = ''; list.hidden = false; i.setAttribute('aria-expanded', 'true'); comboFilter(box);
    const cur = list.querySelector('.is-cur'); if (cur) cur.scrollIntoView({ block: 'center' });
  }
  function comboChoose(box, li) {
    if (!li || li.classList.contains('is-off')) return;
    box.querySelector('.combo__list').hidden = true;
    onPick({ dataset: { race: box.dataset.race, slot: box.dataset.slot }, value: li.dataset.v, label: li.dataset.n, id: box.querySelector('.combo__in').id });
  }
  document.addEventListener('focusin', (e) => { const i = e.target.closest('.combo__in'); if (i) comboOpen(i.parentElement); });
  document.addEventListener('click', (e) => {
    const cx = e.target.closest('[data-cx]');
    if (cx) { const box = cx.closest('.combo'); comboClose(); onPick({ dataset: { race: box.dataset.race, slot: box.dataset.slot }, value: '', id: box.querySelector('.combo__in').id }); return; }
    const i = e.target.closest('.combo__in');
    if (i && i.parentElement.querySelector('.combo__list').hidden && !i.disabled) comboOpen(i.parentElement);
    if (!e.target.closest('.combo')) comboClose();
  });
  document.addEventListener('pointerdown', (e) => { const li = e.target.closest('.combo__opt'); if (li) { e.preventDefault(); comboChoose(li.closest('.combo'), li); } });
  document.addEventListener('input', (e) => { const i = e.target.closest('.combo__in'); if (i) comboFilter(i.parentElement); });
  document.addEventListener('keydown', (e) => {
    const i = e.target.closest && e.target.closest('.combo__in'); if (!i) return;
    const box = i.parentElement, list = box.querySelector('.combo__list');
    const vis = () => [...list.querySelectorAll('.combo__opt:not([hidden]):not(.is-off)')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (list.hidden) { comboOpen(box); return; }
      const v = vis(), k = v.findIndex((x) => x.classList.contains('is-hl')), n = e.key === 'ArrowDown' ? Math.min(v.length - 1, k + 1) : Math.max(0, k - 1);
      v.forEach((x) => x.classList.remove('is-hl')); if (v[n]) { v[n].classList.add('is-hl'); v[n].scrollIntoView({ block: 'nearest' }); }
    } else if (e.key === 'Enter') { e.preventDefault(); const h = list.querySelector('.is-hl'); if (h) comboChoose(box, h); }
    else if (e.key === 'Escape') { comboClose(); i.blur(); }
  });
  /* ---------- Brouillons : choix posés à l'avance, pas encore confirmés ----------
     Un brouillon (pick.draft) réserve le coureur dans le desk mais n'est pas compté comme « choix fait ».
     À la deadline il est pris tel quel (le drapeau est alors ignoré). */
  const isDraft = (pk, race) => !!(pk && pk.a && pk.draft && !lockedRace(race));
  const isConfirmed = (pk, race) => !!(pk && pk.a && !isDraft(pk, race));
  const confirmedN = (races) => races.filter((r) => isConfirmed(myPicks()[r.id], r)).length;
  const draftN = (races) => races.filter((r) => isDraft(myPicks()[r.id], r)).length;
  const sessionDraftMode = (session) => { const l = active(G.sessionRaces(session)).filter((r) => !lockedRace(r) && (myPicks()[r.id] || {}).a); return l.length > 0 && l.every((r) => myPicks()[r.id].draft); };
  function setDraft(raceIds, on) {
    const picks = myPicks();
    raceIds.forEach((rid) => {
      const race = G.raceOf(rid), pk = picks[rid]; if (!race || lockedRace(race) || !pk || !pk.a) return;
      const n = Object.assign({}, pk); delete n.ts; if (on) n.draft = true; else delete n.draft;
      picks[rid] = n;
      if (!state.demo) store.setPick(state.me, rid, n).catch(fail);
    });
    const y = window.scrollY; renderPanel(); window.scrollTo({ top: y });
  }
  function pickEditor(race, session) {
    const label = `${placeLabel(race)}, ${raceName(race)}`;
    const cur = myPicks()[race.id] || {};
    const face = cur.a ? avatarOf(cur.a) : `<span class="avatar avatar--empty" aria-hidden="true"></span>`;
    const pool = poolOf(race);
    const note = !pool.start && !pool.rows.length ? '<p class="hint">Pas de classement ni de start list pour cette catégorie pour l’instant : saisis le nom à la main.</p>' : '';
    return `<div class="pickbox">
      ${face}
      <div class="pickbox__sel">
        <label class="sr" for="pa-${race.id}">${race.gender === 'F' ? 'Coureuse' : 'Coureur'}, ${esc(label)}</label>
        ${pool.rows.length ? combo(race, session, 'a') : ''}
        <label class="sr" for="pb-${race.id}">Remplaçant, ${esc(label)}</label>
        ${pool.rows.length ? `<span class="pickhelp">${combo(race, session, 'b')}${info('Le remplaçant est facultatif. Il joue à la place du titulaire que si ce dernier ne prend pas le départ (DNS).')}</span>` : ''}
        ${note}${freeLink(race, 'auto')}
        ${cur.a ? `<button type="button" class="draftbtn${cur.draft ? ' is-on' : ''}" data-draft="${race.id}" aria-pressed="${!!cur.draft}" title="${cur.draft ? 'Ce choix est un brouillon : touche pour le confirmer' : 'Ce choix est confirmé : touche pour le repasser en brouillon'}">${cur.draft ? 'Confirmer le choix' : 'Basculer en brouillon'}</button>` : ''}
      </div>
    </div>`;
  }
  function pickSummary(playerId, race) {
    const p = (state.picks[playerId] || {})[race.id];
    if (!p || !p.a) return '<span class="none">Aucun choix</span>';
    const eff = G.effectiveAthlete(p, state.results, race.id);
    const swapped = p.b && eff === p.b, drawn = p.d && eff === p.d;
    const fin = !!state.results[race.id];
    const text = drawn
      ? `<span class="who"><s class="who--out">${skn(p.a)}</s>${p.b ? ` <s class="who--out">${skn(p.b)}</s>` : ''} ${skn(p.d)}</span><span class="sub">Tiré au sort</span>`
      : swapped
      ? `<span class="who"><s class="who--out">${skn(p.a)}</s> ${skn(p.b)}</span><span class="sub">Remplaçant en piste</span>`
      : `<span class="who">${skn(p.a)}</span>${p.b && !fin ? `<span class="sub">Remplaçant : ${skn(p.b)}</span>` : ''}`;
    return `<div class="pickline">${avatarOf(eff)}<div class="pickline__txt">${text}</div></div>`;
  }
  function outcome(race, playerId) {
    const res = state.results[race.id];
    if (race.cancelled) return '<span class="soon">Annulée</span>';
    if (!res) {
      if (!lockedRace(race)) return '';
      const late = now() - G.raceStart(race) > 2 * 3600 * 1000;
      return `<span class="soon">Résultat en attente</span>${late ? '<button type="button" class="linkbtn rcbtn" data-refresh-results>↻ Vérifier le résultat officiel</button>' : ''}`;
    }
    const pk = (state.picks[playerId] || {})[race.id];
    const sc = G.scoreRace(race, pk, state.results);
    const eff = pk && G.effectiveAthlete(pk, state.results, race.id);
    const e = eff && res.find((x) => x.ath === eff);
    const how = e ? (e.status || ordinal(e.rank)) : '';
    const win = winnerOf(race.id);
    return `<div class="out"><span class="pill ${sc > 0 ? 'pill--on' : 'pill--off'}">${sc > 0 ? '+' : ''}${sc}</span>${how ? `<span class="rank">${how}</span>` : ''}<span class="flag flag--ok">Terminé</span></div>
      ${win ? `<span class="winner">Vainqueur ${esc(surname(win))}</span>` : ''}`;
  }

  /* ---------- Courses d'une session (vue « Mon desk ») ---------- */
  /** Course terminée : la ligne prend la couleur de l'ambiance (chaude si j'ai marqué, froide sinon). */
  function doneCls(race) {
    if (race.cancelled || !resOf(race)) return '';
    const sc = G.scoreRace(race, (state.picks[state.me] || {})[race.id], state.results) || 0;
    return sc > 0 ? ' race--done race--hot' : ' race--done race--cold';
  }

  /* ---------- Classements & récap ---------- */
  const FICHE_ON = false;
  const rnkCell = (rk) => `<span class="rnk rnk--${rk <= 3 ? rk : rk <= 10 ? 'c' : 'n'}">${rk}</span>`;
  function rankRows(scoreFn) {
    const rows = state.players.map((p) => ({ p, v: scoreFn(state.picks[p.id] || {}) })).sort((a, b) => b.v.total - a.v.total);
    let last = null, rank = 0;
    rows.forEach((r, i) => { if (r.v.total !== last) { rank = i + 1; last = r.v.total; } r.rank = rank; });
    return rows;
  }
  const playersRanked = () => rankRows((pk) => G.generalScore(pk, state.results)).map((r) => r.p);
  const playerOf = (id) => state.players.find((p) => p.id === id) || { id, name: '', photo: '' };
  function pav(p, size) {
    const ini = (p.name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    return `<span class="pav pav--${size || 'md'}${p.theme ? ' pav--' + p.theme : ''}" aria-hidden="true">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : esc(ini)}</span>`;
  }
  const pname = (p) => `<span class="pn">${pav(p, 'xs')}<span>${esc(p.name)}</span></span>`;
  const ptsBtn = (v, scope, pid) => (scope && v ? `<button type="button" class="numbtn" data-bd="${esc('pts|' + pid + '|' + scope)}" title="Voir le détail">${v}</button>` : v);

  function recapTable(session) {
    const races = sortedRaces(session).filter(passF);
    const order = playersRanked();
    const head = order.map((p) => `<th scope="col" class="${p.id === state.me ? 'me' : ''}">${pname(p)}</th>`).join('');
    const rows = races.map((r) => {
      const cells = order.map((p) => {
        const pk = (state.picks[p.id] || {})[r.id];
        const cls = p.id === state.me ? 'me' : '';
        if (r.cancelled) return `<td class="${cls}"><span class="none">Annulée</span></td>`;
        if (!visible(p.id, r)) return `<td class="${cls}"><span class="none">Révélé au départ</span></td>`;
        if (!pk || !pk.a) return `<td class="${cls}"><span class="none">Aucun choix</span></td>`;
        const eff = G.effectiveAthlete(pk, state.results, r.id);
        const sc = G.scoreRace(r, pk, state.results);
        return `<td class="${cls}"><div class="cell">${avatarOf(eff, 'sm')}<div class="cell__txt"><span class="who" title="${esc(nameOf(eff))}">${skn(eff, surname(nameOf(eff)))}</span>${eff !== pk.a ? '<span class="sub">Remplaçant</span>' : ''}${sc === null || sc === undefined ? '' : `<span class="cellpts ${sc > 0 ? 'on' : 'off'}">${sc > 0 ? '+' : ''}${sc}</span>`}</div></div></td>`;
      }).join('');
      return `<tr><th scope="row"><span class="rowhead__day">${dayOf(r.date)}</span> ${fl(placeLabel(r))}<br>${discBadge(r)}<span class="gender gender--${r.gender}">${genderLabel(r)}</span>${r.cancelled || !lockedRace(r) ? '' : `<br><button type="button" class="linkbtn rcbtn" data-racecard="${r.id}">Voir plus…</button>`}</th>${cells}</tr>`;
    }).join('');
    const totals = order.map((p) => `<td class="${p.id === state.me ? 'me' : ''}"><strong>${G.sessionScore(session, state.picks[p.id] || {}, state.results)} pts</strong></td>`).join('');
    return `${SHARE.fsOpen()}<div class="tablewrap"><table class="grid grid--fx grid--fxrecap" style="--n:${state.players.length}">
      <caption>${fl(session.name)}</caption>
      <thead><tr><th scope="col">Course</th>${head}</tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th scope="row">Total de la session</th>${totals}</tr></tfoot>
    </table></div></div>`;
  }
  function recapView(key) {
    const ss = scopeSessions(key);
    if (state.players.length < 1) return '<p class="empty">Aucun joueur.</p>';
    return ss.map((s) => `<h3 class="subtitle">${fl(s.name)}</h3>${recapTable(s)}`).join('') + '<p class="hint">Les choix des autres joueurs apparaissent au départ de chaque course.</p>';
  }
  /** Coureurs déjà pris par le joueur, par catégorie et genre (rien de caché : ce sont mes propres choix). */
  function takenView(key) {
    const ids = new Set(scopeSessions(key).flatMap((s) => active(G.sessionRaces(s))).map((r) => r.id));
    const mine = myPicks();
    const by = {};
    Object.keys(mine).forEach((rid) => {
      if (!ids.has(rid)) return;
      const race = G.raceOf(rid), pk = mine[rid]; if (!race || !pk || !pk.a) return;
      const eff = G.effectiveAthlete(pk, state.results, rid), k = `${race.cat}-${race.gender}`;
      (by[k] = by[k] || []).push({ race, eff, draft: isDraft(pk, race) });
    });
    const blocks = Object.keys(by).sort().map((k) => {
      const [cat, g] = k.split('-');
      return `<div class="tablewrap"><table class="grid grid--rank"><caption>${esc(D.CATS[cat].short)} ${g === 'H' ? 'hommes' : 'femmes'}</caption>
        <thead><tr><th scope="col">Coureur</th><th scope="col">Course</th></tr></thead>
        <tbody>${by[k].sort((a, b) => a.race.date.localeCompare(b.race.date)).map((x) => `<tr><th scope="row">${avatarOf(x.eff, 'sm')} ${skn(x.eff)}${x.draft ? ' <span class="draftflag">📝</span>' : ''}</th><td>${fl(placeLabel(x.race))} <span class="sub">${esc(dayOf(x.race.date))}</span></td></tr>`).join('')}</tbody></table></div>`;
    }).join('');
    return blocks ? `<p class="hint">Les coureurs que tu as déjà utilisés dans ce desk ne sont plus disponibles dans leur catégorie.</p><div class="grid2">${blocks}</div>` : '<p class="hint">Tu n’as encore choisi personne dans ce desk.</p>';
  }

  /* ---------- Courses d'une session (suite) ---------- */
  const slLink = (race) => (startListOf(race) && !resOf(race) ? `<button type="button" class="linkbtn slbtn" data-startlist="${race.id}">Consulter la start list</button>` : '');
  function raceCard(race, opts) {
    opts = opts || {};
    const done = !race.cancelled && !!resOf(race), start = G.raceStart(race);
    const wait = !opts.noWait && !done && start <= now() ? '<span class="rcard__st rcard__st--wait">Résultat en attente</span>' : '';
    return `<div class="rcard rcard--${race.gender}">
      <span class="rcard__date">${esc(dayOf(race.date))}</span>
      <strong class="rcard__place">${fl(placeLabel(race))}</strong>
      <span class="rcard__race">${discBadge(race)} <span class="gender gender--${race.gender}">${genderLabel(race)}</span></span>
      <span class="rcard__time">Départ ${esc(hourText(start))}${race.timeKnown ? '' : ' <em class="sub">(provisoire)</em>'}</span>${wait}${opts.extra ? `<span class="rcard__x">${opts.extra}</span>` : ''}
      ${race.cancelled || !lockedRace(race) ? '' : `<button type="button" class="morebtn" data-racecard="${race.id}">${done ? 'Résultat détaillé' : 'Stats'}</button>`}${!done && !race.cancelled && startListOf(race) ? `<button type="button" class="morebtn morebtn--sl" data-startlist="${race.id}">Start list</button>` : ''}</div>`;
  }
  function raceRow(race, session) {
    const pick = race.cancelled ? '<span class="none">Course annulée : aucun choix</span>' : lockedRace(race) ? pickSummary(state.me, race) : pickEditor(race, session);
    return `<li class="race race--card race--${race.gender}${race.cancelled ? ' race--off' : ''}${doneCls(race)}">
      ${raceCard(race, { noWait: true, extra: race.cancelled ? '<span class="flag flag--off">Annulée</span>' : slLink(race) })}
      <div class="race__main"><div class="race__pick">${pick}</div>
      <div class="race__out">${outcome(race, state.me)}</div></div>
    </li>`;
  }
  function sessionCard(session, indexLabel) {
    const races = sortedRaces(session);
    const live = active(races);
    const dl = G.sessionDeadline(session);
    const n = confirmedN(live), nd = draftN(live);
    const open = live.some((r) => !lockedRace(r));
    const mine = G.sessionScore(session, myPicks(), state.results);
    let mood = '', avgTxt = '';
    if (G.sessionState(session, now()) === 'terminée' && state.players.length > 1) {
      const all = state.players.map((p) => G.sessionScore(session, state.picks[p.id] || {}, state.results));
      const avg = all.reduce((a, b) => a + b, 0) / all.length;
      mood = mine > avg ? ' session--hot' : mine < avg ? ' session--cold' : '';
      avgTxt = `, moyenne des joueurs ${Math.round(avg)} pts`;
    }
    return `<article class="session${mood}" id="s-${session.id}">
      <header class="session__head">
        <div>
          <h3 class="session__name">${fl(session.name)}</h3>
          <p class="session__meta">${indexLabel ? indexLabel + ', ' : ''}deadline ${dlShort(dl)}${avgTxt}</p>
        </div>
        <div class="session__side">${stateBadge(session)}${open
    ? `<span class="count${n === live.length ? ' count--ok' : ''}">${n}/${live.length} choisis</span>${nd ? `<span class="count count--draft">${nd} brouillon${nd > 1 ? 's' : ''}</span>` : ''}`
    : `<span class="count count--pts">${mine} pts</span>`}</div>
      </header>
      ${open && live.some((r) => (myPicks()[r.id] || {}).a) ? `<p class="session__draft">${nd === live.filter((r) => (myPicks()[r.id] || {}).a).length ? '📝 Cette session est en brouillon : ses choix ne comptent pas comme faits (ils seront confirmés automatiquement à la deadline).' : ''} <button type="button" class="linkbtn" data-draft-session="${session.id}|${sessionDraftMode(session) ? 0 : 1}">${sessionDraftMode(session) ? 'Tout confirmer' : 'Tout passer en brouillon'}</button></p>` : ''}
      <ul class="races">${races.filter(passF).map((r) => raceRow(r, session)).join('') || '<li class="race"><span class="none">Aucune course avec ces filtres.</span></li>'}</ul>
    </article>`;
  }

  /* ---------- Desks ---------- */
  function worldsBox() {
    const b = G.worldsBonus(myPicks(), state.results);
    const lines = b.lines.length ? `<ul class="bonus__lines">${b.lines.map((l) => `<li><span>${esc(l.label)}</span><strong>+${l.pts}</strong></li>`).join('')}</ul>` : '';
    return `<aside class="bonus">
      <h3>Bonus des vainqueurs ${info('Aux Mondiaux, tu gagnes un bonus si tes choix remportent les deux épreuves (hommes et femmes) d’une catégorie : Élite +200, U23 +130, U19 +70, et +600 pour les six titres.')}</h3>
      <ul class="bonus__rules">
        <li><strong>+200</strong><span>les deux titres Élite (hommes et femmes)</span></li>
        <li><strong>+130</strong><span>les deux titres U23</span></li>
        <li><strong>+70</strong><span>les deux titres U19</span></li>
        <li><strong>+600</strong><span>les six titres (en plus des précédents)</span></li>
      </ul>${lines}
    </aside>`;
  }
  function deskStats(key, chosen, total, drafts, score) {
    const R = state.results, ids = new Set(scopeSessions(key).flatMap((s) => active(G.sessionRaces(s))).map((r) => r.id));
    const played = Object.keys(R).some((id) => ids.has(id));
    const R0 = Object.assign({}, R); ids.forEach((id) => { delete R0[id]; });
    const dRank = played ? (rankRows((pk) => ({ total: G.deskScore(key, pk, R) })).find((r) => r.p.id === state.me) || {}).rank : null;
    const g1 = (rankRows((pk) => ({ total: G.generalScore(pk, R).total })).find((r) => r.p.id === state.me) || {}).rank;
    const g0 = (rankRows((pk) => ({ total: G.generalScore(pk, R0).total })).find((r) => r.p.id === state.me) || {}).rank;
    const mv = played && g0 && g1 ? g0 - g1 : 0;
    const mvHtml = !played ? '' : mv > 0 ? `<span class="mv mv--up">▲ ${mv}</span>` : mv < 0 ? `<span class="mv mv--dn">▼ ${-mv}</span>` : '<span class="mv">=</span>';
    return `<div><dt>Choix faits ${info('Nombre de courses de ce desk pour lesquelles tu as confirmé un coureur. Les brouillons sont comptés à part.')}</dt><dd>${chosen}/${total}${drafts ? `<span class="draftn"> + ${drafts} brouillon${drafts > 1 ? 's' : ''}</span>` : ''}</dd></div>
      <div><dt>Points ${info('Total de tes points sur ce desk et ton classement parmi les joueurs sur ce desk.')}</dt><dd>${score}<span class="sub"> pts</span><span class="deskrk">${dRank ? ordinal(dRank) + ' du desk' : 'pas encore de classement'}</span></dd></div>
      <div><dt>Classement général ${info('Ta place au classement général et les places gagnées ou perdues depuis le début de ce desk.')}</dt><dd>${played && g1 ? ordinal(g1) : '-'} ${mvHtml}<span class="deskrk">${played ? 'depuis le début du desk' : 'pas encore de classement'}</span></dd></div>`;
  }
  function filterBar() {
    const chip = (kind, v, label, cls) => `<button type="button" class="ffc ${cls}" data-ff="${kind}:${v}" aria-pressed="${state.ff[kind].includes(v)}">${label}</button>`;
    const any = state.ff.cat.length || state.ff.gender.length;
    return `<div class="ff" role="group" aria-label="Filtrer les courses">
      <span class="ff__g">${['ELI', 'U23', 'U19'].map((c) => chip('cat', c, D.CATS[c].short, 'ffc--' + c)).join('')}</span>
      <span class="ff__g">${chip('gender', 'F', 'F', 'ffc--F')}${chip('gender', 'H', 'H', 'ffc--H')}</span>
      ${any ? '<button type="button" class="ff__x" data-ff="clear">Tout afficher</button>' : ''}</div>`;
  }
  function deskPanel(key) {
    const hasW = D.WORLDS.desk === key;
    const sessions = scopeSessions(key);
    const sub = state.sub[key];
    const dk = D.DESKS[key - 1];
    const score = G.deskScore(key, myPicks(), state.results);
    const total = sessions.reduce((n, s) => n + active(G.sessionRaces(s)).length, 0);
    const chosen = sessions.reduce((n, s) => n + confirmedN(active(G.sessionRaces(s))), 0), drafts = sessions.reduce((n, s) => n + draftN(active(G.sessionRaces(s))), 0);
    const title = dk.name;
    const meta = `${dmOf(dk.from)} au ${dmOf(dk.to)}, ${total} courses${hasW ? ' dont les Mondiaux d’Oostende (29 au 31 janvier)' : ''}`;
    const tabs = [['mine', 'Mon desk'], ['recap', 'Récap des joueurs'], ['taken', 'Coureurs pris']].map(([id, label]) =>
      `<button type="button" role="tab" class="seg__btn" aria-selected="${sub === id}" data-sub="${id}" data-key="${key}">${label}</button>`).join('');
    let body;
    if (sub === 'mine') {
      const hasF = (s) => sortedRaces(s).some(passF);
      body = (sessions.some(hasF) ? sessions.map((s) => hasF(s) ? (s === D.WORLDS ? worldsBox() : '') + sessionCard(s, s === D.WORLDS ? 'Championnats du monde, Oostende' : `session ${sessions.filter((x) => x !== D.WORLDS).indexOf(s) + 1} sur ${sessions.filter((x) => x !== D.WORLDS).length}`) : '').join('') : '<p class="empty">Aucune course avec ces filtres.</p>')
        + '<p class="hint">Heures de départ provisoires tant qu’elles ne sont pas confirmées.</p>';
    } else if (sub === 'recap') body = (hasW ? worldsBox() : '') + recapView(key);
    else body = takenView(key);
    return `<section>
      <header class="deskhead">
        <div><h2>${esc(title)}</h2><p class="deskhead__meta">${esc(meta)}</p>
          <p class="rule">Un coureur ne peut être choisi qu’une fois par catégorie dans un desk${hasW ? ', Mondiaux compris' : ''}. ${info('Dans un même desk, un coureur ne peut être choisi qu’une seule fois chez les hommes et une seule fois chez les femmes, par catégorie (Élite, U23, U19)' + (hasW ? ', y compris aux Mondiaux (points ×3 en Élite, ×2 en U23, ×1 en U19)' : '') + '. Un coureur déjà pris apparaît grisé.')}</p></div>
        <dl class="deskhead__stats">${deskStats(key, chosen, total, drafts, score)}</dl>
      </header>
      <div class="deskbar"><div class="seg" role="tablist" aria-label="Vue du desk">${tabs}</div>${filterBar()}</div>
      <div class="deskbody">${body}</div>
    </section>`;
  }

  /* ---------- Onglet « À venir / En cours / Dernière session » ---------- */
  const LS = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignoré */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignoré */ } },
  };
  const H24 = 24 * 3600 * 1000;
  function finishedWindow(s) { return !LS.get('cxgame.skip.' + s.id) && finishedWindowIgnoringSkip(s); }
  function finishedWindowIgnoringSkip(s) {
    const seen = Number(LS.get('cxgame.seen.' + s.id)) || 0;
    const end = G.sessionEnd(s).getTime();
    return now().getTime() < (seen && seen <= end + H24 ? end + H24 : end + 2 * H24);
  }
  function homeMode() {
    const all = allSessions(), st = (s) => G.sessionState(s, now());
    const cur = all.find((s) => st(s) === 'en cours');
    if (cur) return { kind: 'cours', session: cur };
    const next = all.find((s) => st(s) === 'ouverte');
    const done = all.filter((s) => st(s) === 'terminée');
    const last = done[done.length - 1];
    if (last && (!next || finishedWindow(last))) return { kind: 'fin', session: last, next };
    return { kind: 'avenir', session: next || upcomingSession(), back: last && next && finishedWindowIgnoringSkip(last) ? last : null };
  }
  function countdownText(dl) {
    let s = Math.max(0, Math.floor((dl - now()) / 1000));
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60);
    return `<span><b>${d}</b> j</span> <span><b>${h}</b> h</span> <span><b>${m}</b> min</span>`;
  }
  function liveRaceRow(race) {
    const lines = state.players.filter((p) => visible(p.id, race) && ((state.picks[p.id] || {})[race.id] || {}).a).map((p) => `<li>${pname(p)} ${pickSummary(p.id, race)}</li>`).join('');
    return `<li class="race race--live race--${race.gender}${race.cancelled ? ' race--off' : ''}${doneCls(race)}">
      ${raceCard(race)}
      <div class="race__pick">${race.cancelled ? '<span class="none">Course annulée</span>' : lockedRace(race) ? `<ul class="who-picked">${lines || '<li class="none">Aucun choix</li>'}</ul>${outcome(race, state.me)}` : ''}</div></li>`;
  }
  function coursPanel(s) {
    const races = sortedRaces(s);
    const todo = races.filter((r) => !resOf(r)), done = races.filter((r) => resOf(r)).sort((a, b) => G.raceStart(b) - G.raceStart(a));
    return `<section>
      <div class="lockbar"><div class="lockbar__t"><strong>${fl(s.name)}</strong><span class="lock" role="img" aria-label="Choix verrouillés" title="Choix verrouillés">🔒</span></div></div>
      <h3 class="subtitle">${done.length ? 'Courses à venir' : 'Qui a pris qui'}</h3>
      ${todo.length ? `<div class="session"><ul class="races">${todo.map(liveRaceRow).join('')}</ul></div>` : '<p class="hint">Toutes les courses sont terminées.</p>'}
      ${done.length ? `<h3 class="subtitle">Courses passées</h3><div class="session"><ul class="races">${done.map(liveRaceRow).join('')}</ul></div>` : ''}
    </section>`;
  }
  function termineePanel(hm) {
    const s = hm.session;
    const mine = G.sessionScore(s, myPicks(), state.results);
    LS.set('cxgame.seen.' + s.id, String(Date.now()));
    return `<section>
      <p class="backlink">${hm.next ? `<button type="button" class="linkbtn" data-skip="${s.id}">Passer à la session suivante →</button>` : ''}</p>
      <article class="forfait forfait--done"><div class="forfait__main">${stateBadge(s)}<h2 class="forfait__name">${fl(s.name)}</h2><p class="forfait__where">Tu as marqué <strong>${mine} pts</strong> sur cette session.</p></div></article>
      <h3 class="subtitle">Choix de tous les joueurs</h3>${recapTable(s)}
    </section>`;
  }
  function nextPanel() {
    const hm = homeMode();
    if (hm.kind === 'cours') return coursPanel(hm.session);
    if (hm.kind === 'fin') return termineePanel(hm);
    const up = hm.session;
    if (!up) return '<p class="empty">La saison est terminée.</p>';
    const isW = up.id === 'MO';
    const races = sortedRaces(up);
    const dl = G.sessionDeadline(up);
    const live = active(races);
    const open = live.some((r) => !lockedRace(r));
    const n = confirmedN(live);
    const inDesk = scopeSessions(up.desk).filter((x) => x !== D.WORLDS);
    const where = isW ? 'Desk 3, Mondiaux (barème ×3 / ×2 / ×1)' : `Desk ${up.desk}, session ${inDesk.indexOf(up) + 1} sur ${inDesk.length}`;
    const list = races.map((r) => {
      const d = at(r.date);
      return `<li class="mini">
        <span class="mini__when"><b>${F_NUM.format(d)}</b> ${F_MO.format(d)}</span>
        <span class="mini__what"><strong class="mini__place">${fl(placeLabel(r))}</strong><span class="mini__tags">${discBadge(r)}<span class="gender gender--${r.gender}">${genderLabel(r)}</span></span></span>
        <span class="mini__pick">${r.cancelled ? '<span class="none">Annulée</span>' : (myPicks()[r.id] || {}).a ? `${pickSummary(state.me, r)}${isDraft(myPicks()[r.id], r) ? '<span class="draftflag">📝 brouillon</span>' : ''}` : '<span class="todo">À choisir</span>'}${r.cancelled ? '' : slLink(r)}</span></li>`;
    }).join('');
    const stub = open
      ? `<p class="forfait__label">Deadline dans ${info('Tes choix se modifient librement jusqu’au départ de la première course de la session. Ensuite ils sont verrouillés, et les choix de tous les joueurs deviennent visibles.')}</p><p class="countdown" id="countdown" data-dl="${dl.toISOString()}">${countdownText(dl)}</p><p class="forfait__dl">${dlShort(dl)}</p>`
      : '<p class="forfait__label">Choix verrouillés</p><p class="countdown countdown--shut">Course en cours</p>';
    return `<section>
      ${hm.back ? `<p class="backlink"><button type="button" class="linkbtn" data-unskip="${hm.back.id}">← Revoir la dernière session (${esc(hm.back.name)})</button></p>` : ''}
      <article class="forfait">
        <div class="forfait__main">
          ${stateBadge(up)}
          <h2 class="forfait__name">${fl(up.name)}</h2>
          <p class="forfait__where">${esc(where)}</p>
          <ul class="minis">${list}</ul>
          <button type="button" class="btn btn--brique" data-goto="${up.desk}">${open ? (n === live.length ? 'Modifier mes choix' : 'Faire mes choix') : 'Voir le desk'}</button>
        </div>
        <div class="forfait__stub">${stub}</div>
      </article>
      ${open ? '' : `<h3 class="subtitle">Choix de tous les joueurs</h3>${recapTable(up)}`}
    </section>`;
  }

  /* ---------- Classements ---------- */
  function smallRanking(title, scoreFn, cls, scope) {
    const rows = rankRows((pk) => ({ total: scoreFn(pk) }));
    return `<div class="tablewrap"><table class="grid grid--rank ${cls || ''}"><caption>${esc(title)}</caption>
      <thead><tr><th scope="col" class="num">Rang</th><th scope="col">Joueur</th><th scope="col" class="num">Points</th></tr></thead>
      <tbody>${rows.map((r) => `<tr class="${r.p.id === state.me ? 'me' : ''}"><td class="num">${rnkCell(r.rank)}</td><th scope="row">${pln(r.p)}</th><td class="num">${ptsBtn(r.v.total, scope, r.p.id)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function playerRows(pid) {
    const picks = state.picks[pid] || {};
    return Object.keys(state.results).map((rid) => G.raceOf(rid)).filter((r) => r && !r.cancelled)
      .sort((a, b) => G.raceStart(a) - G.raceStart(b))
      .map((r) => { const pk = picks[r.id], eff = pk && pk.a ? G.effectiveAthlete(pk, state.results, r.id) : null; return { r, pk, has: !!eff, eff, e: eff && (state.results[r.id] || []).find((x) => x.ath === eff), pts: G.scoreRace(r, pk, state.results) || 0 }; });
  }
  function pointsModal(pid, scope) {
    const p = state.players.find((x) => x.id === pid); if (!p) return;
    const inScope = (r) => scope === 'tot' || (scope === 'w' ? r.kind === 'mondial' : scope.startsWith('g:') ? r.gender === scope.slice(2) : scope.startsWith('d') ? String((sessionOf(r) || {}).desk) === scope.slice(1) : false);
    const rows = playerRows(pid).filter((x) => inScope(x.r));
    const label = scope === 'tot' ? 'Classement général' : scope === 'w' ? 'Mondiaux' : scope.startsWith('g:') ? (scope === 'g:H' ? 'Classement hommes' : 'Classement femmes') : 'Desk ' + scope.slice(1);
    const li = rows.map((x) => `<li class="dtl"><span class="dtl__r"><strong>${fl(placeLabel(x.r))}</strong> <span class="sub">${esc(raceName(x.r))} · ${esc(dayOf(x.r.date))}</span></span><span class="dtl__a">${x.has ? skn(x.eff) : '<span class="none">Pas de choix</span>'}</span><span class="dtl__k ${x.pts > 0 ? '' : 'bad'}">${x.e ? esc(x.e.status || ordinal(x.e.rank)) : ''} <b>${x.pts > 0 ? '+' : ''}${x.pts}</b></span></li>`).join('');
    const bonus = (scope === 'd' + D.WORLDS.desk || scope === 'tot') ? G.worldsBonus(state.picks[pid] || {}, state.results).lines : [];
    const bl = bonus.map((b) => `<li class="dtl"><span class="dtl__r"><strong>Bonus Mondiaux</strong> <span class="sub">${esc(b.label)}</span></span><span class="dtl__a"></span><span class="dtl__k"><b>+${b.pts}</b></span></li>`).join('');
    const total = rows.reduce((a, x) => a + x.pts, 0) + bonus.reduce((a, b) => a + b.pts, 0);
    openModal(`<h2>${esc(p.name)} · ${esc(label)}</h2><ul class="dtls">${li}${bl}${!li && !bl ? '<li class="none">Aucun point.</li>' : ''}</ul><p class="dtl__tot">Total : <b>${total} pts</b></p>`);
  }
  function generalPanel() {
    const R = state.results;
    const none = Object.keys(R).length === 0 ? '<p class="hint">Aucun résultat pour l’instant.</p>' : '';
    const rows = rankRows((pk) => G.generalScore(pk, R));
    const main = `${SHARE.fsOpen()}<div class="tablewrap"><table class="grid grid--rank grid--general cap--gen"><caption>Classement général ${info('Somme des points des trois desks. Les Mondiaux (bonus compris) comptent dans le Desk 3.')}</caption>
      <thead><tr><th scope="col" class="num">Rang</th><th scope="col">Joueur</th><th scope="col" class="num th--tot">Total</th><th scope="col" class="num th--d1">Desk 1</th><th scope="col" class="num th--d2">Desk 2</th><th scope="col" class="num th--d3">Desk 3 <small>(avec Mondiaux)</small></th></tr></thead>
      <tbody>${rows.map((r) => `<tr class="${r.p.id === state.me ? 'me' : ''}"><td class="num">${rnkCell(r.rank)}</td><th scope="row">${pname(r.p)}</th><td class="num total">${ptsBtn(r.v.total, 'tot', r.p.id)}</td>${r.v.desks.map((d, i) => `<td class="num">${ptsBtn(d, 'd' + D.DESKS[i].id, r.p.id)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    const cats = [['H', 'hommes', 'ELI'], ['F', 'femmes', 'U19']].map(([g, n, k]) => smallRanking(`Classement ${n}`, (pk) => G.genderScore(g, pk, R), 'cap--' + k, 'g:' + g)).join('');
    const dk = (d) => smallRanking(`Classement du ${d.name}`, (pk) => G.deskScore(d.id, pk, R), 'cap--d' + d.id, 'd' + d.id);
    return `<section class="genpanel"><header class="deskhead"><div><h2>Classements</h2>
      <p class="deskhead__meta">Général : trois desks (Mondiaux et bonus dans le Desk 3)</p></div></header>${none}${main}
      <h3 class="subtitle">Quête annexe : hommes et femmes</h3><div class="grid2">${cats}</div>
      <h3 class="subtitle">Par desk</h3><div class="grid2">${dk(D.DESKS[0])}${dk(D.DESKS[1])}</div><div class="grid2">${dk(D.DESKS[2])}</div></section>`;
  }

  /* ---------- Onglets ---------- */
  function tabs() {
    const hk = homeMode().kind;
    const label = hk === 'cours' ? 'En cours' : hk === 'fin' ? 'Dernière session' : 'Session à venir';
    return [
      { id: 'next', label, note: '' },
      { id: '1', label: 'Desk 1', note: `${dmOf(D.DESKS[0].from)} au ${dmOf(D.DESKS[0].to)}` },
      { id: '2', label: 'Desk 2', note: `${dmOf(D.DESKS[1].from)} au ${dmOf(D.DESKS[1].to)}` },
      { id: '3', label: 'Desk 3', note: `${dmOf(D.DESKS[2].from)} au ${dmOf(D.DESKS[2].to)}` },
      { id: 'gen', label: 'Classements', note: '' },
      { id: 'data', label: 'Data room', note: '' },
    ];
  }
  const TAB_IDS = ['next', '1', '2', '3', 'gen', 'data', 'adm'];
  const TAB_ICO = {
    home: '<path d="M3.5 11.5 12 4l8.5 7.5"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>',
    next: '<path d="M6 21V4"/><path d="M6 5h11l-2.5 3.5L17 12H6"/>',
    1: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><text x="12" y="16.6" text-anchor="middle" font-size="12" font-weight="800" fill="currentColor" stroke="none">1</text>',
    2: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><text x="12" y="16.6" text-anchor="middle" font-size="12" font-weight="800" fill="currentColor" stroke="none">2</text>',
    3: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><text x="12" y="16.6" text-anchor="middle" font-size="12" font-weight="800" fill="currentColor" stroke="none">3</text>',
    w: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c3.2 3 3.2 14 0 17c-3.2-3-3.2-14 0-17z"/>',
    data: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
    gen: '<path d="M3 20.5h18"/><rect x="9" y="7.5" width="6" height="13"/><rect x="3" y="13" width="6" height="7.5"/><rect x="15" y="15.5" width="6" height="5"/>',
  };
  const TAB_SHORT = { next: 'À venir', 1: 'Desk 1', 2: 'Desk 2', 3: 'Desk 3', gen: 'Général', data: 'Data' };
  function renderTabs() {
    $('#tabs').innerHTML = tabs().map((t) => {
      const cours = t.id === 'next' && t.label === 'En cours';
      const short = t.id === 'next' && cours ? 'En cours' : t.id === 'next' && /Dernière/.test(t.label) ? 'Terminée' : TAB_SHORT[t.id];
      return `<button type="button" role="tab" class="plate plate--${t.id}" id="tab-${t.id}" data-tab="${t.id}" aria-selected="${state.tab === t.id}" aria-label="${esc(t.label + (t.note ? ', ' + t.note : ''))}">
      <svg class="plate__ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${TAB_ICO[cours ? 'home' : t.id]}</svg><span class="plate__short">${short}</span>
      <span class="plate__label">${t.label}</span>${t.note ? `<span class="plate__note">${t.note}</span>` : ''}</button>`;
    }).join('');
  }

  /* ---------- Règles, fenêtres, bulles d'aide ---------- */
  function rulesHtml() {
    return `<div class="rules">
      <h3>Le principe</h3>
      <p>À chaque course, tu choisis <strong>un coureur ou une coureuse</strong> (et, si tu veux, un remplaçant). Il te rapporte des points : <strong>100 pour le 1er, 80, 60, 50, 45…</strong> jusqu’à 1 point pour le 30ᵉ.</p>
      <h3>L’organisation</h3>
      <ul>
        <li><strong>3 desks</strong> (novembre, décembre, janvier-février) dont les <strong>Mondiaux</strong> d’Oostende (29-31 janvier 2027), qui font partie du Desk 3. Chaque session regroupe les courses d’un même week-end.</li>
        <li>Hommes et femmes sont chacun à part : un choix par course.</li>
        <li>Championnats d’Europe (Zeddam, 7-8 novembre) : <strong>×2</strong> en Élite, ×1 en U23, ×2/3 en U19. Mondiaux : <strong>×3</strong> en Élite, ×2 en U23, ×1 en U19.</li>
        <li><strong>Bonus des Mondiaux</strong> : +200 si tes deux choix Élite gagnent, +130 en U23, +70 en U19, et +600 pour les six titres.</li>
      </ul>
      <h3>La règle d’or</h3>
      <p>Dans un desk, <strong>un coureur ne peut être choisi qu’une seule fois</strong> par genre et par catégorie. Les Mondiaux comptent dans le Desk 3 : un coureur déjà pris au Desk 3 ne peut plus l’être aux Mondiaux, et inversement. Il faut donc gérer ses atouts sur la durée.</p>
      <h3>Les délais</h3>
      <ul>
        <li>Tu peux changer tes choix jusqu’au <strong>départ de la première course de la session</strong>.</li>
        <li>Ensuite tout est verrouillé, et les choix des autres joueurs deviennent visibles (avant, ils sont cachés).</li>
      </ul>
      <h3>Quand ça ne se passe pas comme prévu</h3>
      <ul>
        <li><strong>Chute, abandon, disqualification</strong> : 0 point, et le coureur reste « grillé » dans ce desk.</li>
        <li><strong>Non-partant (DNS)</strong> : ton remplaçant prend la place. Sans remplaçant, un tirage au sort est fait. Le titulaire non-partant est libéré et peut être rejoué.</li>
        <li><strong>Course annulée</strong> : personne ne marque, ton coureur est libéré.</li>
      </ul>
    </div>`;
  }
  function openModal(html, cls) {
    const m = $('#modal');
    m.innerHTML = `<div class="modal__card${cls ? ' ' + cls : ''}" role="dialog" aria-modal="true"><button type="button" class="modal__x" data-close aria-label="Fermer">×</button>${html}</div>`;
    m.hidden = false; document.body.classList.add('noscroll');
    const f = m.querySelector('textarea, button:not(.modal__x)'); if (f) f.focus({ preventScroll: true });
  }
  function closeModal() { const m = $('#modal'); m.hidden = true; m.dataset.lock = ''; m.innerHTML = ''; document.body.classList.remove('noscroll'); }
  const rulesSeen = () => !!LS.get('cxgame.rulesSeen');
  function rulesModal(intro) {
    openModal(`<h2>${intro ? 'Bienvenue sur CX GAME' : 'Les règles du jeu'}</h2>${intro ? '<p class="hint">Voici le jeu en deux minutes. Tu les retrouveras à tout moment via « Règles du jeu » en haut de la page.</p>' : ''}${rulesHtml()}
      <div class="remindbtns"><button type="button" class="btn btn--brique" data-rules-ok>Ok, j’ai compris</button></div>`);
    $('#modal').dataset.lock = intro ? '1' : '';
  }
  function introRules() { if (state.user && !state.demo && !rulesSeen() && $('#modal').hidden) rulesModal(true); }
  const ideasModal = () => openModal(`<h2>Boîte à idées</h2><p class="hint">Une idée, un bug, une question ? Écris-la ici.</p>
    <textarea id="idea-t" rows="5" maxlength="1000" placeholder="Ton message…" style="width:100%"></textarea>
    <div class="remindbtns"><button type="button" class="btn btn--brique" data-idea-send>Envoyer</button></div>`);
  function startListModal(raceId, keep) {
    const race = G.raceOf(raceId), sl = race && startListOf(race);
    if (!sl) return;
    const canPick = !race.cancelled && !lockedRace(race) && !!state.me;
    const picks = myPicks()[race.id] || {};
    const used = canPick ? G.usedInDesk(G.deskIdOf(race.id), race.gender, race.cat, myPicks(), race.id, state.results) : new Set();
    const when = sl.fetched ? `${F_DAY.format(new Date(sl.fetched))}, ${F_HOUR.format(new Date(sl.fetched))}` : '';
    const act = (r) => {
      if (picks.a === r.ath) return `<span class="sl__me">Ton choix</span>${canPick ? `<button type="button" class="sl__btn sl__btn--off" data-slclear="${race.id}|a">Retirer</button>` : ''}`;
      if (picks.b === r.ath) return `<span class="sl__me">Remplaçant</span>${canPick ? `<button type="button" class="sl__btn sl__btn--off" data-slclear="${race.id}|b">Retirer</button>` : ''}`;
      if (!canPick) return '';
      if (used.has(r.ath)) return '<span class="sl__tag sl__tag--used">déjà pris</span>';
      if (!picks.a) return `<button type="button" class="sl__btn" data-slpick="${race.id}|a|${r.ath}">Choisir</button>`;
      if (!picks.b) return `<button type="button" class="sl__btn sl__btn--sub" data-slpick="${race.id}|b|${r.ath}">Remplaçant</button>`;
      return '';
    };
    const rows = sl.rows.map((r) => `<li class="sl__row${picks.a === r.ath || picks.b === r.ath ? ' is-mine' : ''}"><b class="sl__bib">${esc(r.bib)}</b>${avatarOf(r.ath, 'sm')}<span class="sl__n">${esc(r.name)}<em class="sub">${esc(r.nat)}</em></span><span class="sl__act">${act(r)}</span></li>`).join('');
    const mo = $('#modal'), prevM = keep && !mo.hidden ? mo.scrollTop : 0;
    openModal(`<h2 class="rc__title">Start list</h2>
      <p class="hint">${esc(placeLabel(race))}, ${esc(raceName(race))} · ${sl.rows.length} partants${when ? `<br>Relevée le ${esc(when)}.` : ''} Elle peut encore évoluer avant le départ.${canPick ? '' : lockedRace(race) ? ' Les choix sont verrouillés.' : ''}</p>
      <ol class="sl">${rows}</ol>`);
    if (keep) mo.scrollTop = prevM;
  }
  function riderModal(id) {
    const rows = [];
    state.players.forEach((p) => Object.keys(state.picks[p.id] || {}).forEach((rid) => {
      const race = G.raceOf(rid), pk = state.picks[p.id][rid];
      if (!race || race.cancelled || !visible(p.id, race) || !pk || !pk.a) return;
      if (G.effectiveAthlete(pk, state.results, rid) === id) rows.push({ p, race, sc: G.scoreRace(race, pk, state.results) });
    }));
    rows.sort((a, b) => G.raceStart(a.race) - G.raceStart(b.race));
    openModal(`<h2>${esc(nameOf(id))}</h2>${ATH[id] ? `<p class="hint">${flagOf(ATH[id].nat)} ${esc(ATH[id].nat)} · rang UCI ${esc(ATH[id].rank || '–')}${ATH[id].team ? ' · ' + esc(ATH[id].team) : ''}</p>` : ''}
      <ul class="dtls">${rows.map((x) => `<li class="dtl"><span class="dtl__r"><strong>${fl(placeLabel(x.race))}</strong> <span class="sub">${esc(raceName(x.race))}</span></span><span class="dtl__a">${esc(x.p.name)}</span><span class="dtl__k">${x.sc === null || x.sc === undefined ? '' : `<b>${x.sc > 0 ? '+' : ''}${x.sc}</b>`}</span></li>`).join('') || '<li class="none">Pas encore choisi (les choix se révèlent au départ).</li>'}</ul>${window.CX_DATAROOM.histHtml(id)}`);
  }
  function showTip(btn) {
    const tip = $('#tip');
    if (!tip.hidden && tip._for === btn) { hideTip(); return; }
    tip.textContent = btn.dataset.info; tip._for = btn; tip.hidden = false;
    const r = btn.getBoundingClientRect(), w = Math.min(280, window.innerWidth - 24);
    tip.style.width = w + 'px';
    tip.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px';
    const h = tip.offsetHeight;
    tip.style.top = (r.bottom + h + 14 > window.innerHeight && r.top > h + 14 ? r.top - h - 8 : r.bottom + 8) + 'px';
  }
  function hideTip() { const t = $('#tip'); t.hidden = true; t._for = null; }
  window.addEventListener('scroll', hideTip, { passive: true });

  /* ---------- Connexion, barre du compte, ambiances (pastilles de couleur, sans nom affiché) ---------- */
  function authPanel() {
    const up = state.authMode === 'up';
    return `<section class="auth"><form class="authcard" id="auth-form" novalidate>
      <h2>${up ? 'Créer mon compte' : 'Connexion'}</h2>
      <p class="auth__intro">${up ? 'Une adresse e-mail et un mot de passe suffisent. Choisis le nom qui s’affichera dans les classements.' : 'Connecte-toi pour faire tes choix et voir le classement.'}</p>
      ${up ? '<label for="au-name">Ton nom dans le jeu</label><input id="au-name" name="name" type="text" autocomplete="nickname" maxlength="24" required>' : ''}
      <label for="au-mail">Adresse e-mail</label><input id="au-mail" name="email" type="email" autocomplete="email" required>
      <label for="au-pw">Mot de passe${up ? ' (6 caractères minimum)' : ''}</label><input id="au-pw" name="pw" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" required>
      <p class="auth__err" id="auth-err" role="alert">${esc(state.authError)}</p>
      <button type="submit" class="btn btn--brique">${up ? 'Créer mon compte' : 'Me connecter'}</button>
      <p class="auth__alt">${up ? 'Déjà un compte ?' : 'Pas encore de compte ?'} <button type="button" class="linkbtn" data-auth="${up ? 'in' : 'up'}">${up ? 'Me connecter' : 'Créer un compte'}</button> · <button type="button" class="linkbtn" data-rules>Revoir les règles</button>${up ? '' : ' · <button type="button" class="linkbtn" data-auth="reset">Mot de passe oublié</button>'}</p>
      ${store.mode === 'local' ? '<p class="auth__local">Mode local : les comptes et les choix restent dans ce navigateur (pas de partage entre joueurs).</p>' : ''}
    </form></section>`;
  }
  const THEMES = [['flandre', 'Flandre'], ['boue', 'Boue'], ['neige', 'Neige'], ['foret', 'Forêt'], ['tomorrowland', 'Fête']];
  const THEMESW = `<div class="themesw" role="group" aria-label="Ambiance du site"><span class="themesw__dots">${THEMES.map(([k, l]) => `<button type="button" class="th--${k}" data-theme-set="${k}" aria-pressed="false" aria-label="Ambiance ${l}"></button>`).join('')}</span></div>`;
  const THEME_COLOR = { flandre: '#12100a', boue: '#2b2118', neige: '#a8cfe4', foret: '#17261b', tomorrowland: '#120a24' };
  let curTheme = 'flandre';
  function setTheme(t, save) {
    if (!THEME_COLOR[t]) t = 'flandre';
    const de = document.documentElement;
    if (t === 'flandre') de.removeAttribute('data-theme'); else de.setAttribute('data-theme', (t === 'boue' || t === 'tomorrowland') ? 'nuit' : t);
    if (t === 'boue' || t === 'tomorrowland') de.setAttribute('data-skin', t); else de.removeAttribute('data-skin');
    document.querySelectorAll('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === t)));
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', THEME_COLOR[t]);
    curTheme = t;
    if (save) { LS.set('cxgame.theme', t); syncTheme(); }
  }
  function syncTheme() {
    if (state.demo || !state.user || !store.setPlayerTheme) return;
    const p = state.players.find((x) => x.id === state.me);
    if (!p || p.theme === curTheme) return;
    p.theme = curTheme;
    Promise.resolve(store.setPlayerTheme(state.me, curTheme)).catch(() => {});
  }
  function globeSvg(kind) {
    const id = 'g' + kind + Math.random().toString(36).slice(2, 6);
    const [c1, c2, c3] = kind === 'big' ? ['#fff6d6', '#f1d78a', '#c8962e'] : ['#ffffff', '#d4e6ef', '#8faec0'];
    return `<svg class="globe globe--${kind}" viewBox="0 0 48 56" aria-hidden="true" focusable="false"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${c1}"/><stop offset=".55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></radialGradient></defs>
      <rect x="12" y="45" width="24" height="7" rx="2" fill="#1b2b44"/><rect x="17" y="40" width="14" height="6" fill="#2b3f5f"/>
      <circle cx="24" cy="22" r="19" fill="url(#${id})" stroke="#1b2b44" stroke-width="1.6"/><path d="M12 14c4-6 10-8 15-7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/></svg>`;
  }
  function myRanks() {
    const R = state.results, n = state.players.length;
    if (!Object.keys(R).length || !n) return null;
    const rankOf = (fn) => { const r = rankRows((pk) => ({ total: fn(pk) })).find((x) => x.p.id === state.me); return r ? { rank: r.rank, pts: r.v.total } : null; };
    const done = Object.keys(R).map((rid) => G.raceOf(rid)).filter((r) => r && !r.cancelled);
    return { n, gen: done.length ? rankOf((pk) => G.generalScore(pk, R).total) : null, cats: ['H', 'F'].map((g) => (done.some((r) => r.gender === g) ? rankOf((pk) => G.genderScore(g, pk, R)) : null)) };
  }
  const globeBoard = (rk) => {
    const nth = (r) => (r ? ordinal(r.rank) : '-');
    return `<div class="acct__board">
      <button type="button" class="gl gl--big" data-tab="gen" title="Voir le classement général">${globeSvg('big')}<span class="gl__t"><b>${rk ? nth(rk.gen) : '-'}</b><span title="Classement général">GEN</span></span></button>
      <div class="gl-row">${[['H', 'Hommes'], ['F', 'Femmes']].map(([c, t], i) => `<button type="button" class="gl gl--sm" data-tab="gen" title="Classement ${t.toLowerCase()}">${globeSvg('sm')}<span class="gl__t"><b>${rk ? nth(rk.cats[i]) : '-'}</b><span>${c}</span></span></button>`).join('')}</div>
    </div>`;
  };
  function accountBar() {
    const name = state.user.name || '', rk = myRanks(), me = playerOf(state.me);
    return `<div class="acct"><div class="acct__who"><span class="acct__avw">${pav(Object.assign({}, me, { name }), 'lg')}</span>
      <div class="acct__id"><span class="acct__hi">Mon compte</span><strong class="acct__name">${esc(name)}</strong></div></div>
      ${globeBoard(rk)}
      <div class="acct__btns"><button type="button" class="btn btn--sm btn--ghost acct__ib" data-settings aria-label="Mes réglages" title="Mes réglages"><span class="lbl-lg">Mes réglages</span><svg class="ico-sm" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg></button></div></div>`;
  }
  function renderUserbar() {
    const el = $('#userbar'); if (!el) return;
    const ma = $('#mastact');
    if (ma) {
      ma.hidden = !state.user && !state.demo;
      ma.innerHTML = '<span class="mast-actions__row">' + THEMESW + '<button type="button" class="mastbtn" data-rules>Règles du jeu</button><button type="button" class="mastbtn" data-ideas>Boîte à idées</button></span>' + (isAdmin() ? `<button type="button" class="mastbtn mastbtn--admin" data-tab="adm" aria-pressed="${state.tab === 'adm'}">Admin</button>` : '');
      ma.querySelectorAll('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === curTheme)));
    }
    el.hidden = !state.user;
    if (!el.hidden) el.innerHTML = accountBar();
  }
  function settingsModal() {
    const dot = (k, l) => `<button type="button" class="th--${k}" data-theme-set="${k}" aria-pressed="${curTheme === k}" aria-label="Ambiance ${l}"></button>`;
    openModal(`<h2>Mes réglages</h2>
      <section class="set"><h3>Mon profil</h3>
        <div class="set__row"><span>Nom affiché<strong>${esc(state.user.name || '')}</strong></span><button type="button" class="btn btn--ghost btn--sm" data-auth="rename">Changer</button></div>
        ${state.user.email ? `<div class="set__row"><span>Adresse e-mail<strong>${esc(state.user.email)}</strong></span></div>` : ''}
      </section>
      <section class="set"><h3>Ambiance du site</h3><div class="set__themes">${THEMES.map(([k, l]) => dot(k, l)).join('')}</div></section>
      <section class="set"><h3>Aide et compte</h3>
        <div class="set__links"><button type="button" class="btn btn--ghost btn--sm" data-rules>Revoir les règles</button><button type="button" class="btn btn--ghost btn--sm" data-ideas>Boîte à idées</button><button type="button" class="btn btn--ghost btn--sm" data-auth="out">Me déconnecter</button></div>
      </section>`);
  }
  function beat() {
    if (!state.user || document.visibilityState !== 'visible' || !store.touchPresence) return;
    syncTheme();
    Promise.resolve(store.touchPresence(state.me)).catch(() => {});
  }
  setInterval(beat, 2 * 60 * 1000);
  document.addEventListener('visibilitychange', beat);
  setTimeout(beat, 3000);

  /* ---------- Recherche d'un coureur ---------- */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#skfind')) return;
    openModal('<h2>Chercher un coureur</h2><input id="skq" class="skq" type="search" placeholder="Nom ou prénom…" autocomplete="off" aria-label="Chercher un coureur ou une coureuse"><ul class="skres" id="skres"></ul>');
    setTimeout(() => { const q = $('#skq'); if (q) q.focus(); }, 50);
  });
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'skq') return;
    const t = norm(e.target.value.trim()).split(/\s+/).filter(Boolean), hits = [];
    if (t.length) ['F', 'H'].forEach((g) => LIST[g].forEach((a) => { const n = norm(a.name + ' ' + (a.src || '')); if (t.every((x) => n.includes(x))) hits.push(a); }));
    $('#skres').innerHTML = t.length ? hits.slice(0, 12).map((a) => `<li><button type="button" data-rider="${esc(a.id)}">${avatarOf(a.id, 'sm')}${flagOf(a.nat)}<span>${esc(a.name)}</span></button></li>`).join('') || '<li class="none">Aucun coureur trouvé.</li>' : '';
  });

  /* ---------- Rendu ---------- */
  function applyTakenFilter() {}
  function renderPanel() {
    if (!state.authReady && !state.demo) { $('#panel').innerHTML = '<p class="hint">Chargement…</p>'; return; }
    if (!state.user) { $('#panel').innerHTML = authPanel(); return; }
    if (state.tab === 'adm' && !isAdmin()) state.tab = 'next';
    const html = state.tab === 'adm' ? window.CX_ADMIN.render(adminCtx()) : state.tab === 'next' ? nextPanel() : state.tab === 'gen' ? generalPanel() : state.tab === 'data' ? window.CX_DATAROOM.render() : state.tab === 'w' ? deskPanel(0) : deskPanel(Number(state.tab));
    const syncWarn = state.user && !state.picksReady && (state.syncErr || state.picksLate) ? '<div class="syncwarn" role="alert"><strong>Tes choix et ceux des autres ne se chargent pas.</strong> Recharge la page ; si ça persiste, désactive ton bloqueur de publicités pour ce site ou essaie un autre navigateur.</div>' : '';
    $('#panel').innerHTML = syncWarn + html;
    $('#panel').setAttribute('aria-labelledby', 'tab-' + state.tab);
  }
  function fitTabs() {
    const nav = document.querySelector('.tabs'), row = $('#tabs');
    if (!nav || !row || nav.hidden) return;
    const steps = ['tabs--nolabel', 'tabs--nodots', 'tabs--ico'];
    nav.classList.remove(...steps);
    const over = () => row.scrollWidth > row.clientWidth + 1;
    for (const c of steps) { if (!over()) break; nav.classList.add(c); }
  }
  let fitT = 0;
  window.addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(fitTabs, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTabs);
  function syncSim() {
    const el = $('#sim-date'); if (!el) return;
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(now()).map((x) => [x.type, x.value]));
    el.value = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  }
  function render() {
    $('#tabs').closest('nav').hidden = !state.user;
    renderTabs(); fitTabs(); renderUserbar(); renderPanel(); syncSim();
    const f = document.querySelector('.atelier'); if (f) f.hidden = store.mode !== 'local';
    const ir = $('#installrow'); if (ir) ir.hidden = !(window.__cxInstall) || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function setTab(id) {
    state.tab = id; state.sub = freshSubs();
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignoré */ }
    render(); window.scrollTo({ top: 0 });
  }
  setInterval(() => { const c = $('#countdown'); if (c) c.innerHTML = countdownText(new Date(c.dataset.dl)); }, 30000);

  /* ---------- Actions ---------- */
  async function authAction(kind) {
    if (kind === 'in' || kind === 'up') { state.authMode = kind; state.authError = ''; render(); return; }
    if (kind === 'out') { closeModal(); await store.signOut(); state.tab = 'next'; state.authMode = 'in'; state.authError = ''; render(); return; }
    if (kind === 'rename') {
      const n = (window.prompt('Ton nom dans le jeu :', state.user.name) || '').trim().slice(0, 24);
      if (n) store.setPlayerName(state.user.uid, n).catch(fail);
      return;
    }
    if (kind === 'reset') {
      const f = $('#au-mail'), mail = (f && f.value.trim()) || window.prompt('Adresse e-mail du compte :') || '';
      if (!mail) return;
      try { await store.resetPassword(mail); state.authError = 'Un e-mail de réinitialisation vient d’être envoyé.'; } catch (err) { state.authError = err.message; }
      render();
    }
  }
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'auth-form') return;
    e.preventDefault();
    const f = e.target, v = (n) => (f.elements[n] ? f.elements[n].value.trim() : '');
    state.authError = '';
    try {
      if (state.authMode === 'up') { if (!v('name')) throw new Error('Choisis un nom pour le jeu.'); await store.signUp(v('email'), f.elements.pw.value, v('name')); }
      else await store.signIn(v('email'), f.elements.pw.value);
    } catch (err) { state.authError = err.message || String(err); }
    render();
  });
  const slugOf = (n) => norm(n).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  async function onPick(sel) {
    const race = G.raceOf(sel.dataset.race);
    if (lockedRace(race)) { render(); return; }
    const cur = Object.assign({}, myPicks()[race.id] || {});
    const slot = sel.dataset.slot === 'auto' ? (cur.a ? 'b' : 'a') : sel.dataset.slot;
    let value = sel.value;
    if (value === '__free__') {
      const name = (window.prompt('Vérifie d’abord que le coureur n’est pas dans la liste déroulante (cherche-le par son nom de famille).\n\nNom du coureur (prénom et nom) :') || '').trim();
      if (!name) { render(); return; }
      const k = norm(name).replace(/[^a-z0-9]/g, '');
      const known = LIST[race.gender].find((a) => norm(a.name).replace(/[^a-z0-9]/g, '') === k);
      if (known) value = known.id;
      else {
        const id = 'x-' + slugOf(name) + '-' + Math.random().toString(36).slice(2, 6);
        const a = { id, name, gender: race.gender, cat: race.cat, nat: '', pending: true, createdBy: state.me };
        state.extra.push(a); rebuildAthletes();
        try { await store.addAthlete(a); } catch (err) { fail(err); return; }
        value = id;
      }
    }
    if (value) cur[slot] = value; else delete cur[slot];
    if (slot === 'a') { if (!cur.a || cur.b === cur.a) delete cur.b; }
    delete cur.ts;
    if (cur.a && !('draft' in cur) && !(myPicks()[race.id] || {}).a && sessionDraftMode(sessionOf(race))) cur.draft = true;
    const out = cur.a ? cur : null;
    const picks = myPicks();
    if (out) picks[race.id] = out; else delete picks[race.id];
    const y = window.scrollY; renderPanel(); window.scrollTo({ top: y });
    if (!state.demo) await store.setPick(state.me, race.id, out).catch(fail);
  }
  document.addEventListener('click', (e) => {
    const i = e.target.closest('.info');
    if (i) { e.preventDefault(); showTip(i); return; }
    if (!e.target.closest('#tip')) hideTip();
    if (e.target.closest('[data-rules-ok]')) { LS.set('cxgame.rulesSeen', '1'); closeModal(); return; }
    const lk = $('#modal').dataset.lock === '1';
    if (e.target.closest('[data-close]') || (e.target.id === 'modal' && !lk)) closeModal();
    if (e.target.closest('[data-rules]')) { rulesModal(false); return; }
    if (e.target.closest('[data-ideas]')) { ideasModal(); return; }
    const sendIdea = e.target.closest('[data-idea-send]');
    if (sendIdea) { const t = ($('#idea-t') || {}).value; if (t && t.trim() && store.addIdea) store.addIdea({ uid: state.me, name: state.user.name, text: t.trim() }).then(closeModal).catch(fail); return; }
    const th = e.target.closest('[data-theme-set]'); if (th) { setTheme(th.dataset.themeSet, true); return; }
    if (window.CX_DATAROOM.click(e.target)) return;
    const rid = e.target.closest('[data-rider]'); if (rid) { riderModal(rid.dataset.rider); return; }
    const rc = e.target.closest('[data-racecard]'); if (rc) { SHARE.open(rc.dataset.racecard); return; }
    if (e.target.closest('[data-settings]')) { settingsModal(); return; }
    if (e.target.closest('[data-install]')) { if (window.__cxInstall) { window.__cxInstall.prompt(); window.__cxInstall = null; } return; }
    if (e.target.closest('#modal [data-auth="out"]')) closeModal();
    const slp = e.target.closest('[data-slpick]');
    if (slp) { const [r, slot, ath] = slp.dataset.slpick.split('|'); onPick({ dataset: { race: r, slot }, value: ath, id: 'sl' }).then(() => startListModal(r, true)); return; }
    const slc = e.target.closest('[data-slclear]');
    if (slc) { const [r, slot] = slc.dataset.slclear.split('|'); onPick({ dataset: { race: r, slot }, value: '', id: 'sl' }).then(() => startListModal(r, true)); return; }
    const slb = e.target.closest('[data-startlist]'); if (slb) { startListModal(slb.dataset.startlist); return; }
    const dr1 = e.target.closest('[data-draft]'); if (dr1) { const pk = myPicks()[dr1.dataset.draft]; setDraft([dr1.dataset.draft], !(pk && pk.draft)); return; }
    const dr2 = e.target.closest('[data-draft-session]'); if (dr2) { const [sid, on] = dr2.dataset.draftSession.split('|'); const ss = allSessions().find((x) => String(x.id) === sid); if (ss) setDraft(active(G.sessionRaces(ss)).map((r) => r.id), on === '1'); return; }
    if (e.target.closest('[data-refresh-results]')) { loadResults(true); return; }
    const rgc = e.target.closest('[data-rc-gcopy]'); if (rgc) { SHARE.copyGeneral(rgc.dataset.rcGcopy); return; }
    const rgj = e.target.closest('[data-rc-gjpg]'); if (rgj) { SHARE.jpgGeneral(rgj.dataset.rcGjpg); return; }
    const rcc = e.target.closest('[data-rc-copy]'); if (rcc) { SHARE.copy(rcc.dataset.rcCopy); return; }
    const rcj = e.target.closest('[data-rc-jpg]'); if (rcj) { SHARE.jpg(rcj.dataset.rcJpg); return; }
    if (e.target.closest('.brand')) { setTab('next'); return; }
    const tab = e.target.closest('[data-tab]'); if (tab) { setTab(tab.dataset.tab); return; }
    const go = e.target.closest('[data-goto]'); if (go) { setTab(go.dataset.goto === '0' ? '3' : go.dataset.goto); return; }
    const skp = e.target.closest('[data-skip]'); if (skp) { LS.set('cxgame.skip.' + skp.dataset.skip, '1'); render(); window.scrollTo(0, 0); return; }
    const usk = e.target.closest('[data-unskip]'); if (usk) { LS.del('cxgame.skip.' + usk.dataset.unskip); render(); window.scrollTo(0, 0); return; }
    const ffb = e.target.closest('[data-ff]');
    if (ffb) {
      const v = ffb.dataset.ff;
      if (v === 'clear') state.ff = { cat: [], gender: [] };
      else { const [k, x] = v.split(':'); const a = state.ff[k]; state.ff[k] = a.includes(x) ? a.filter((y) => y !== x) : a.concat(x); }
      renderPanel(); return;
    }
    const bdb = e.target.closest('[data-bd]'); if (bdb) { const [, pp, sc] = bdb.dataset.bd.split('|'); pointsModal(pp, sc); return; }
    const sub = e.target.closest('[data-sub]'); if (sub) { state.sub[Number(sub.dataset.key)] = sub.dataset.sub; renderPanel(); return; }
    const fr = e.target.closest('[data-free]'); if (fr) { onPick({ dataset: { race: fr.dataset.free, slot: fr.dataset.slot }, value: '__free__', id: `pa-${fr.dataset.free}` }); return; }
    const au = e.target.closest('[data-auth]'); if (au) { authAction(au.dataset.auth); return; }
    if (e.target.closest('#btn-reset') && state.me) {
      if (window.confirm('Effacer tous tes choix des courses encore ouvertes ?')) Object.keys(myPicks()).forEach((r) => { if (!lockedRace(G.raceOf(r))) store.setPick(state.me, r, null).catch(fail); });
    }
    if (e.target.closest('#btn-now')) { state.sim = null; render(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'sim-date' && e.target.value) { const [d, t] = e.target.value.split('T'); state.sim = G.parisInstant(d, t); render(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideTip(); if ($('#modal').dataset.lock !== '1') closeModal(); } });
  document.addEventListener('error', (e) => { if (e.target && e.target.classList && e.target.classList.contains('avatar__img')) e.target.remove(); }, true);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__cxInstall = e; render(); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});

  /* ---------- « Ligne de départ » : la veille de la deadline, dès 21 h ---------- */
  function gateCheck() {
    if (!state.user || !$('#modal').hidden) return;
    const s = allSessions().find((x) => G.sessionState(x, now()) === 'ouverte'); if (!s) return;
    const dl = G.sessionDeadline(s), start = new Date(dl.getTime() - 3 * H24);
    const evening = G.parisInstant(F_YMD(dl, -1), '21:00');
    if (now() < evening || now() >= dl || LS.get('cxgame.gate.' + s.id) || start > now()) return;
    const todo = active(sortedRaces(s)).filter((r) => !lockedRace(r) && !isConfirmed(myPicks()[r.id], r));
    if (!todo.length) return;
    openModal(`<h2>Ligne de départ</h2><p>Demain, ça part : <strong>${fl(s.name)}</strong>. Il te reste ${plural(todo.length, 'choix', 'choix')} à confirmer avant ${esc(dlShort(dl))}.</p>
      <ul class="dtls">${todo.map((r) => `<li class="dtl"><span class="dtl__r"><strong>${fl(placeLabel(r))}</strong> <span class="sub">${esc(raceName(r))}</span></span></li>`).join('')}</ul>
      <div class="remindbtns"><button type="button" class="btn btn--brique" data-goto="${s.id === 'MO' ? 0 : s.desk}" data-close>Faire mes choix</button><button type="button" class="btn btn--ghost" data-gate-off="${s.id}" data-close>Plus tard</button></div>`);
  }
  function F_YMD(d, offsetDays) { const t = new Date(d.getTime() + offsetDays * H24); return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t); }
  document.addEventListener('click', (e) => { const g = e.target.closest('[data-gate-off]'); if (g) LS.set('cxgame.gate.' + g.dataset.gateOff, '1'); });
  setInterval(gateCheck, 60000);

  /* ---------- Chargement des données publiques ---------- */
  function loadResults(manual) {
    const btns = manual ? Array.from(document.querySelectorAll('[data-refresh-results]')) : [];
    btns.forEach((b) => { b.disabled = true; b.textContent = 'Vérification…'; });
    return fetch('data/results.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
      const sg = JSON.stringify((j && j.races) || {}), changed = !!j && j.races && sg !== state.fileSig;
      if (changed) { state.fileSig = sg; state.file = j; recompute(); }
      if (manual) setTimeout(() => { btns.forEach((b) => { if (b.isConnected) { b.disabled = false; b.textContent = changed ? 'Résultat officiel chargé ✓' : 'Pas encore officiel : réessaie dans quelques minutes'; } }); }, 50);
    }).catch(() => { btns.forEach((b) => { b.disabled = false; b.textContent = '↻ Vérifier le résultat officiel'; }); });
  }
  SHARE.init({ state, G, D, esc, nameOf, surname, skn, pln, pname, flagOf: (id) => flagOf((ATH[id] || {}).nat), avatarOf, placeLabel, genderLabel, discLabel, dayOf, lockedRace, ordinal, openModal });
  window.CX_DATAROOM.init({ esc, ATH: () => ATH, G, D, flag: flagOf, ordinal, openModal, rerender: () => render() });
  const adminCtx = () => ({ state, G, D, store, LIST, ATH, esc, norm, at, F_DAY, hourText, dlShort, shortOf, placeLabel, discLabel, genderLabel, nameOf, avatarOf, sortedRaces, lockedRace, active, canon, newPlayers, markPlayersSeen, rerender: render, fail, isAdmin, ov: () => Object.assign({}, state.overrides, state.ovStore) });
  const hash = location.hash.replace('#', '');
  if (TAB_IDS.includes(hash)) state.tab = hash;
  setTheme(LS.get('cxgame.theme') || 'flandre', false);
  startStore();
  loadResults(); setInterval(() => { if (document.visibilityState === 'visible') loadResults(); }, 60000);
  /** Prévient (une fois par coureur et course) quand un choix n'est pas sur la start list publiée. */
  function dnsCheck() {
    if (!state.me || !state.startlists) return;
    const seen = JSON.parse(LS.get('cxgame.dnsSeen') || '{}'), now_ = dnsPicks(), keys = new Set(now_.map((x) => x.race.id + '|' + x.ath));
    Object.keys(seen).forEach((k) => { if (!keys.has(k)) delete seen[k]; });              // revenu sur la liste : on re-préviendra s'il en sort encore
    const fresh = now_.filter((x) => !seen[x.race.id + '|' + x.ath]);
    if (!fresh.length || !$('#modal').hidden) return;
    LS.set('cxgame.dnsSeen', JSON.stringify(Object.assign(seen, ...fresh.map((x) => ({ [x.race.id + '|' + x.ath]: 1 })))));
    openModal(`<h2>Attention : DNS probable</h2><p>${fresh.length > 1 ? 'Ces choix ne figurent' : 'Ce choix ne figure'} pas sur la start list publiée :</p>
      <ul class="dtls">${fresh.map((x) => `<li class="dtl"><span class="dtl__r"><strong>${esc(nameOf(x.ath))}</strong> <span class="sub">${x.slot === 'b' ? 'remplaçant' : 'titulaire'} · ${esc(placeLabel(x.race))}, ${esc(raceName(x.race))}</span></span><span class="dtl__k bad">DNS</span></li>`).join('')}</ul>
      <p class="hint">Elle ne prendra pas le départ. Tu peux changer ton choix tant que la course n’est pas lancée.</p>`);
  }
  function loadStartlists() {
    fetch('data/startlists.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.races) { const same = JSON.stringify(j) === JSON.stringify(state.startlists); state.startlists = j; if (!same) { scheduleRender(); setTimeout(dnsCheck, 600); } } }).catch(() => {});
  }
  loadStartlists(); setInterval(() => { if (document.visibilityState === 'visible') loadStartlists(); }, 300000);
  render();
  setTimeout(gateCheck, 1500);
  window.CX_APP = { state, render, store };
})();
