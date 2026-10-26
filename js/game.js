/* CX GAME – règles du jeu (fonctions pures, testables sous Node)
   Adapté du Ski game. Différences voulues :
   - un coureur ne peut être pris qu'une fois par desk, par genre ET par catégorie d'âge ;
   - DNF / DSQ : 0 point et le coureur reste grillé jusqu'au desk suivant ; DNS : 0 point mais le titulaire est LIBÉRÉ (rejouable), le remplaçant joué est grillé ;
   - « pulled » (retiré par les commissaires) : garde son rang officiel ;
   - tirage au sort parmi les 20 premiers dossards ; plus de finales ×2 ;
   - Euros ×2 et Mondiaux ×3 pour les Élites, U23 aux 2/3 et U19 au 1/3 de ces points (points arrondis à l'entier par course) ; bonus des Mondiaux par catégorie d'âge. */
(function (root) {
  'use strict';
  const D = typeof module !== 'undefined' && module.exports ? require('./data.js') : root.CX_DATA;

  /* ---------- Dates : heure de Paris ---------- */
  function parisInstant(date, time) {
    const [y, m, d] = date.split('-').map(Number);
    const [h, mi] = (time || '00:00').split(':').map(Number);
    const guess = Date.UTC(y, m - 1, d, h, mi);
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    const asParis = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    const offset = asParis - guess;
    return new Date(guess - offset);
  }

  /* ---------- Calendrier vivant : annulations, reports, heures confirmées ---------- */
  // Surcharges posées par l'admin : { raceId: { status:'cancelled', date, time, place, moved:true } }
  let OVR = {};
  function setOverrides(o) { OVR = o || {}; }
  /** Course avec ses éventuelles surcharges. `cancelled` : annulée. `moved` : reportée (elle a alors sa propre deadline). */
  function raceOf(id) {
    const r = D.RACES[id], o = OVR[id];
    if (!r || !o) return r;
    return Object.assign({}, r, {
      date: o.date || r.date, time: o.time || r.time, place: o.place || r.place,
      timeKnown: o.time ? true : r.timeKnown, dateKnown: o.date ? true : r.dateKnown,
      cancelled: o.status === 'cancelled', moved: !!o.moved, note: o.note || '',
      originalDate: r.date,
    });
  }
  const raceStart = (race) => parisInstant(race.date, race.time);

  function sessionRaces(session) { return session.races.map(raceOf); }
  const activeRaces = (session) => sessionRaces(session).filter((r) => !r.cancelled);
  /** Courses qui fixent le calendrier de la session : ni annulées ni reportées (sauf si toutes le sont). */
  function anchorRaces(session) {
    const act = activeRaces(session);
    const fixed = act.filter((r) => !r.moved);
    return fixed.length ? fixed : act.length ? act : sessionRaces(session);
  }
  /** Deadline d'une session = départ de sa première course. */
  function sessionDeadline(session) {
    return new Date(Math.min(...anchorRaces(session).map((r) => raceStart(r).getTime())));
  }
  function sessionEnd(session) {
    const last = anchorRaces(session).map((r) => raceStart(r).getTime());
    return new Date(Math.max(...last) + 12 * 3600 * 1000);
  }
  const sessionOfRace = (id) => D.SESSIONS.concat([D.WORLDS]).find((s) => s.races.includes(id));
  /** Moment où les choix d'une course se verrouillent : la deadline de la session, ou le nouveau départ si la course est reportée. */
  function raceLockTime(race) {
    return race.moved ? raceStart(race) : sessionDeadline(sessionOfRace(race.id));
  }
  const raceLocked = (race, now) => now >= raceLockTime(race);
  /** 'ouverte' (choix possibles) | 'en cours' (choix verrouillés, choix des autres visibles) | 'terminée' */
  function sessionState(session, now) {
    if (now < sessionDeadline(session)) return 'ouverte';
    if (now < sessionEnd(session)) return 'en cours';
    return 'terminée';
  }

  /* ---------- Points ---------- */
  function pointsForRank(rank) {
    return rank >= 1 && rank <= D.POINTS.length ? D.POINTS[rank - 1] : 0;
  }
  function findEntry(results, raceId, athId) {
    return ((results && results[raceId]) || []).find((e) => e.ath === athId) || null;
  }
  // Statuts qui font 0 point. Tout autre statut (ex. « pulled ») n'en retire pas : le rang officiel compte.
  const OUT = new Set(['DNS', 'DNF', 'DSQ']);
  const isDNS = (results, raceId, ath) => { const e = findEntry(results, raceId, ath); return !!e && e.status === 'DNS'; };
  /** DNS à confirmer par Alexandre avant d'écrire les résultats : { ath, status:'DNS' } sans confirmed:true. */
  const dnsPending = (entries) => (entries || []).filter((e) => e.status === 'DNS' && e.confirmed !== true);

  /** Coureur qui remplace un titulaire DNS : le remplaçant s'il a pris le départ, sinon le coureur tiré au sort (d), sinon personne. */
  function substitute(pick, results, raceId) {
    if (pick.b && !isDNS(results, raceId, pick.b)) return pick.b;
    return pick.d || null;
  }
  /** Coureur effectivement compté : le titulaire ; s'il ne part pas (DNS), le remplaçant ; si lui non plus, le coureur tiré au sort. */
  function effectiveAthlete(pick, results, raceId) {
    if (!pick || !pick.a) return null;
    if (isDNS(results, raceId, pick.a)) return substitute(pick, results, raceId) || pick.a;
    return pick.a;
  }

  /* ---------- Tirage au sort reproductible ---------- */
  function hash53(str) { // cyrb53, identique au ski
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  /** candidates : identifiants triés par dossard. Retourne { ath, index, n } ou null s'il n'y a personne. */
  function drawRider(seed, candidates) {
    if (!candidates.length) return null;
    const index = hash53(seed) % candidates.length;
    return { ath: candidates[index], index, n: candidates.length };
  }
  const DRAW_TOP = 20;
  const deskIdOf = (raceId) => { const s = sessionOfRace(raceId); return s === D.WORLDS ? 0 : s.desk; };

  /** PROPOSITIONS de tirage (rien n'est appliqué sans la confirmation d'Alexandre pour chaque DNS).
      Un tirage par joueur dont le titulaire ET le remplaçant sont DNS, parmi les 20 premiers dossards de la grille,
      hors coureurs déjà grillés par ce joueur (desk, genre, catégorie) et hors non-partants.
      meta : { raceId: { start:[{bib,ath}] } }. Graine = course|joueur|20 premiers de la grille (par dossard).
      Retourne { raceId: { playerId: { ath, index, n, seed, candidates } } }. */
  function autoDraws(results, meta, picksByPlayer) {
    const out = {};
    Object.keys(meta || {}).forEach((raceId) => {
      const m = meta[raceId], race = raceOf(raceId);
      if (!race || race.cancelled || !results || !results[raceId] || !m.start) return;
      Object.keys(picksByPlayer).forEach((pid) => {
        const pk = (picksByPlayer[pid] || {})[raceId];
        if (!pk || !pk.a || pk.d || !isDNS(results, raceId, pk.a)) return;
        if (pk.b && !isDNS(results, raceId, pk.b)) return;
        const burnt = usedInDesk(deskIdOf(raceId), race.gender, race.cat, picksByPlayer[pid], raceId, results);
        const top = m.start.slice().sort((x, y) => x.bib - y.bib).slice(0, DRAW_TOP);
        const cands = top.map((x) => x.ath).filter((id) => id && !burnt.has(id) && !isDNS(results, raceId, id));
        const seed = `${raceId}|${pid}|${top.map((x) => x.ath || '?').join(',')}`;
        const d = drawRider(seed, cands);
        if (d) (out[raceId] = out[raceId] || {})[pid] = Object.assign({ seed, candidates: cands }, d);
      });
    });
    return out;
  }

  function scoreRace(race, pick, results) {
    if (race.cancelled) return null; // course annulée : personne ne marque
    if (!results || !results[race.id]) return null; // pas encore de résultat
    const ath = effectiveAthlete(pick, results, race.id);
    if (!ath) return 0;
    const e = findEntry(results, race.id, ath);
    if (!e || OUT.has(e.status) || !e.rank) return 0; // DNS, DNF, DSQ ou absent du classement
    return Math.round(pointsForRank(e.rank) * race.mult); // U23/U19 aux Euros : 2/3 et 1/3 → arrondi à l'entier
  }

  /* ---------- Bonus des Mondiaux ---------- */
  function worldsWinner(results, raceId) {
    const e = ((results && results[raceId]) || []).find((x) => !OUT.has(x.status) && x.rank === 1);
    return e ? e.ath : null;
  }
  /** Par catégorie d'âge : les deux vainqueurs H+F → +pair[cat] (Élite 200, U23 130, U19 70 par défaut). Les six titres → +all (600). Cumulables.
      opts : { pair: { ELI, U23, U19 } (partiel accepté), all }. */
  function worldsBonus(picksOfPlayer, results, opts) {
    const o = opts || {};
    const cfg = { pair: Object.assign({}, D.WORLDS_BONUS.pair, o.pair), all: o.all !== undefined ? o.all : D.WORLDS_BONUS.all };
    const won = {};
    D.WORLDS.races.forEach((id) => {
      const w = worldsWinner(results, id);
      won[id] = !!w && effectiveAthlete(picksOfPlayer && picksOfPlayer[id], results, id) === w;
    });
    const lines = [];
    D.CAT_ORDER.forEach((c) => {
      if (won[`MO-${c}-H`] && won[`MO-${c}-F`]) lines.push({ label: D.CATS[c].fr + ' : les deux vainqueurs', pts: cfg.pair[c] });
    });
    if (D.WORLDS.races.every((id) => won[id])) lines.push({ label: 'Les six titres', pts: cfg.all });
    return { lines, total: lines.reduce((s, l) => s + l.pts, 0) };
  }

  /* ---------- Totaux ---------- */
  function sessionScore(session, picksOfPlayer, results) {
    return sessionRaces(session).reduce((s, r) => s + (scoreRace(r, picksOfPlayer && picksOfPlayer[r.id], results) || 0), 0);
  }
  function deskScore(deskId, picksOfPlayer, results) {
    return D.SESSIONS.filter((s) => s.desk === deskId).reduce((s, x) => s + sessionScore(x, picksOfPlayer, results), 0);
  }
  function worldsScore(picksOfPlayer, results, opts) {
    const races = D.WORLDS.races.reduce((s, id) => s + (scoreRace(raceOf(id), picksOfPlayer && picksOfPlayer[id], results) || 0), 0);
    const bonus = worldsBonus(picksOfPlayer, results, opts).total;
    return { races, bonus, total: races + bonus };
  }
  /** « Petit globe » : points d'une catégorie d'âge (Élite, U23, U19), hommes et femmes, desks et Mondiaux (courses seulement, sans bonus). */
  function categoryScore(cat, picksOfPlayer, results) {
    return Object.keys(D.RACES).reduce((s, id) => { const r = raceOf(id); return r.cat === cat ? s + (scoreRace(r, picksOfPlayer && picksOfPlayer[id], results) || 0) : s; }, 0);
  }
  /** Quête annexe : classement hommes / femmes (toutes catégories d'âge, desks et Mondiaux, courses seulement, sans bonus). */
  function genderScore(gender, picksOfPlayer, results) {
    return Object.keys(D.RACES).reduce((s, id) => { const r = raceOf(id); return r.gender === gender ? s + (scoreRace(r, picksOfPlayer && picksOfPlayer[id], results) || 0) : s; }, 0);
  }
  /** Classements : général (desks + Mondiaux) et par desk. */
  function generalScore(picksOfPlayer, results, opts) {
    const desks = D.DESKS.map((d) => deskScore(d.id, picksOfPlayer, results));
    const w = worldsScore(picksOfPlayer, results, opts);
    return { desks, worlds: w.total, total: desks.reduce((a, b) => a + b, 0) + w.total };
  }

  /* ---------- Contrainte « un coureur une seule fois par desk, par genre et par catégorie d'âge » ---------- */
  /** Coureurs déjà « grillés » dans le desk (deskId 0 = bloc Mondiaux), pour un genre et une catégorie de COURSE, hors la course `exceptRaceId`.
      Le titulaire reste grillé s'il est DNF ou DSQ. S'il est DNS (résultat connu), il est libéré et rejouable : seul compte celui qui a pris le départ
      (remplaçant, sinon tiré au sort). Une course annulée libère son coureur. */
  function usedInDesk(deskId, gender, cat, picksOfPlayer, exceptRaceId, results) {
    const used = new Set();
    const scope = deskId === 0 ? [D.WORLDS] : D.SESSIONS.filter((s) => s.desk === deskId);
    scope.forEach((s) => {
      sessionRaces(s).forEach((r) => {
        if (r.gender !== gender || r.cat !== cat || r.id === exceptRaceId || r.cancelled) return;
        const p = picksOfPlayer && picksOfPlayer[r.id];
        if (!p || !p.a) return;
        if (isDNS(results, r.id, p.a)) { const sub = substitute(p, results, r.id); if (sub) used.add(sub); return; }
        used.add(p.a);
      });
    });
    return used;
  }

  /* ---------- Rentabilité d'un choix (onglet desk) ---------- */
  const ANA_MIN = 2;   // autres joueurs nécessaires pour qu'une comparaison ait un sens
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  /** Comparaison de mon choix sur une course terminée.
      rider : mes points vs la moyenne des autres joueurs ayant pris ce coureur dans le même desk (même genre et catégorie).
      race  : mes points vs la moyenne des autres joueurs sur cette course, quel que soit leur coureur.
      rating : note de 0 à 5 par demi-point = 5 × (0,5 × √(points / max) + 0,25 × écart à la course + 0,25 × écart au coureur), les écarts valant 0,5 + (moi − moyenne) / max borné à [0 ; 1].
      Sans comparaison « coureur » disponible : 0,65 / 0,35 et provisional = true. Sans comparaison « course » : rating = null. 0 point = 0. */
  function pickAnalysis(race, meId, picksByPlayer, results, playerIds) {
    const mp = picksByPlayer && picksByPlayer[meId] && picksByPlayer[meId][race.id];
    if (!mp || !mp.a || race.cancelled || !results || !results[race.id]) return null;
    const ath = effectiveAthlete(mp, results, race.id);
    if (!ath) return null;
    const max = pointsForRank(1) * (race.mult || 1), mine = scoreRace(race, mp, results) || 0;
    const others = (playerIds || []).filter((id) => id !== meId);
    const rPts = others.map((id) => picksByPlayer[id] && picksByPlayer[id][race.id]).filter((pk) => pk && pk.a).map((pk) => scoreRace(race, pk, results) || 0);
    const dk = deskIdOf(race.id);
    const scope = dk === 0 ? [D.WORLDS] : D.SESSIONS.filter((x) => x.desk === dk);
    const sPts = [];
    others.forEach((id) => {
      for (const s of scope) for (const r of sessionRaces(s)) {
        if (r.gender !== race.gender || r.cat !== race.cat || r.cancelled || !results[r.id]) continue;
        const pk = picksByPlayer[id] && picksByPlayer[id][r.id];
        if (pk && pk.a && effectiveAthlete(pk, results, r.id) === ath) { sPts.push(scoreRace(r, pk, results) || 0); return; }
      }
    });
    const raceOk = rPts.length >= ANA_MIN, riderOk = sPts.length >= ANA_MIN;
    const rAvg = rPts.length ? avg(rPts) : null, sAvg = sPts.length ? avg(sPts) : null;
    let rating = null;
    if (raceOk) {
      const abs = Math.sqrt(clamp01(mine / max)), rel = (m) => clamp01(0.5 + (mine - m) / max);
      const score = riderOk ? 0.5 * abs + 0.25 * rel(rAvg) + 0.25 * rel(sAvg) : 0.65 * abs + 0.35 * rel(rAvg);
      rating = mine <= 0 ? 0 : Math.max(0.5, Math.round(score * 10) / 2);
    }
    return { ath, mine, max, rider: { ok: riderOk, n: sPts.length, avg: sAvg }, race: { ok: raceOk, n: rPts.length, avg: rAvg }, rating, provisional: raceOk && !riderOk, min: ANA_MIN };
  }

  const api = {
    parisInstant, setOverrides, raceOf, raceStart, activeRaces, sessionOfRace, raceLockTime, raceLocked, sessionRaces, sessionDeadline, sessionEnd, sessionState,
    pointsForRank, effectiveAthlete, substitute, dnsPending, hash53, drawRider, DRAW_TOP, autoDraws, scoreRace, worldsWinner, worldsBonus,
    pickAnalysis, sessionScore, deskScore, worldsScore, generalScore, categoryScore, genderScore, usedInDesk, deskIdOf,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CX_GAME = api;
})(typeof window !== 'undefined' ? window : globalThis);
