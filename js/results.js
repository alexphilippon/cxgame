/* CX GAME – lecture des start lists et des résultats (texte « rang|NOM Prénom|pays|temps »).
   Fonctions pures, utilisables sous Node (tools/startlist.js, tools/results.js) et dans le navigateur.
   Rapprochement des noms par clé normalisée (sans accents, minuscules, mots triés). */
(function (root) {
  'use strict';
  const N = typeof module !== 'undefined' && module.exports ? require('./names.js') : root.CX_NAMES;
  const STATUS = new Set(['DNF', 'DNS', 'DSQ']);
  const lines = (t) => String(t || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

  /** Start list : lignes « dossard|NOM Prénom|pays ». */
  function startRows(text) {
    return lines(text).map((l) => {
      const f = l.split('|'), bib = Number(f[0]);
      if (f.length < 2 || !Number.isInteger(bib) || bib < 1 || !f[1].trim()) throw new Error('Ligne de départ illisible : ' + l);
      return { bib, name: f[1].trim(), nat: (f[2] || '').trim() };
    });
  }
  /** Classement : « rang|NOM Prénom|pays|temps » ou « DNF|NOM Prénom|pays » (DNF, DNS, DSQ). Un temps vide est permis (coureur doublé : il garde son rang). */
  function rankRows(text) {
    return lines(text).map((l) => {
      const f = l.split('|'), head = f[0].trim().toUpperCase();
      if (STATUS.has(head)) {
        if (!f[1] || !f[1].trim()) throw new Error('Ligne de statut illisible : ' + l);
        return { status: head, name: f[1].trim(), nat: (f[2] || '').trim() };
      }
      const rank = Number(f[0]);
      if (!Number.isInteger(rank) || rank < 1 || f.length < 2 || !f[1].trim()) throw new Error('Ligne de classement illisible : ' + l);
      return { rank, name: f[1].trim(), nat: (f[2] || '').trim(), time: (f[3] || '').trim() };
    });
  }

  /** Coureurs de la liste du jeu pour un genre, toutes catégories confondues (un U23 peut courir en Élite), sans doublon de clé. */
  function athletesOf(A, gender) {
    const out = [], seen = new Set();
    Object.keys(A.lists).filter((k) => k.endsWith('-' + gender)).forEach((k) => A.lists[k].forEach((a) => { if (!seen.has(a.key)) { seen.add(a.key); out.push(a); } }));
    return out;
  }

  function resolver(athletes, unknown) {
    const byKey = {}; athletes.forEach((a) => { byKey[a.key] = a; });
    return (name) => {
      const a = byKey[N.nameKey(name)];
      if (a) return { id: a.id };
      unknown.push(name);
      return { id: N.slug(N.displayName(name)), name: N.displayName(name) }; // hors liste du jeu : identifiant stable créé depuis le nom
    };
  }

  /** Start list → [{bib, ath, name?}] triée par dossard. Refuse les dossards ou coureurs en double. */
  function buildStart(text, athletes) {
    const unknown = [], resolve = resolver(athletes, unknown);
    const rows = startRows(text);
    if (!rows.length) throw new Error('Start list vide.');
    if (new Set(rows.map((r) => r.bib)).size !== rows.length) throw new Error('Dossards en double.');
    if (new Set(rows.map((r) => N.nameKey(r.name))).size !== rows.length) throw new Error('Coureur en double dans la start list.');
    const start = rows.slice().sort((a, b) => a.bib - b.bib).map((r) => {
      const x = resolve(r.name);
      return { bib: r.bib, ath: x.id, name: r.name }; // name = écriture de la source, pour rapprocher le classement
    });
    return { start, unknown: [...new Set(unknown)] };
  }

  /**
   * raw : { race, start (texte, facultatif), ranked (texte), confirmedDns: [noms] }
   * Retourne { race, entries, start, warnings, unknown, pendingDns }.
   * Un partant de la start list absent du classement est un DNS POSSIBLE (la source ne le dit pas) : il reste en attente
   * tant qu'il n'est pas dans confirmedDns. Tant que pendingDns n'est pas vide, entries est vide : rien à écrire.
   */
  function buildRace(raw, athletes) {
    const unknown = [], warnings = [], resolve = resolver(athletes, unknown);
    const start = raw.start ? startRows(raw.start) : [];
    if (new Set(start.map((r) => r.bib)).size !== start.length) throw new Error('Dossards en double.');
    const startByKey = {}; start.forEach((r) => { startByKey[N.nameKey(r.name)] = r; });
    if (start.length && Object.keys(startByKey).length !== start.length) throw new Error('Coureur en double dans la start list.');
    if (!start.length) warnings.push('Pas de start list : les DNS ne peuvent pas être détectés.');

    const rows = rankRows(raw.ranked);
    if (!rows.length) throw new Error('Classement vide.');
    const seen = new Set(), entries = [], dnsCandidates = [];
    let prev = 0;
    const base = (r) => {
      const x = resolve(r.name), s = startByKey[N.nameKey(r.name)], o = { ath: x.id };
      if (s) o.bib = s.bib; else if (start.length) warnings.push(`« ${r.name} » absent de la start list.`);
      if (x.name) o.name = x.name;
      return o;
    };
    rows.forEach((r) => {
      const k = N.nameKey(r.name);
      if (seen.has(k)) throw new Error(`« ${r.name} » apparaît deux fois.`);
      seen.add(k);
      if (r.status === 'DNS') { dnsCandidates.push({ name: r.name, bib: (startByKey[k] || {}).bib, why: 'DNS annoncé par la source' }); return; }
      const o = base(r);
      if (r.status) { o.status = r.status; entries.push(o); return; }
      if (r.rank <= prev) throw new Error(`Rangs non croissants à « ${r.name} » (${r.rank}).`);
      if (r.rank !== prev + 1) warnings.push(`Rang ${prev + 1} manquant avant « ${r.name} » (${r.rank}).`);
      prev = r.rank;
      const e = Object.assign({ ath: o.ath, rank: r.rank }, o); if (r.time) e.time = r.time;
      entries.push(e);
    });
    start.forEach((s) => { if (!seen.has(N.nameKey(s.name))) dnsCandidates.push({ name: s.name, bib: s.bib, why: 'au départ, absent du classement : DNS ?' }); });

    const confirmed = new Set((raw.confirmedDns || []).map(N.nameKey));
    const candKeys = new Set(dnsCandidates.map((c) => N.nameKey(c.name)));
    (raw.confirmedDns || []).forEach((n) => { if (!candKeys.has(N.nameKey(n))) warnings.push(`DNS confirmé « ${n} » : pas dans les DNS possibles, ignoré.`); });
    const pendingDns = dnsCandidates.filter((c) => !confirmed.has(N.nameKey(c.name)));
    dnsCandidates.filter((c) => confirmed.has(N.nameKey(c.name))).forEach((c) => {
      const x = resolve(c.name), o = { ath: x.id, status: 'DNS', confirmed: true };
      if (c.bib) o.bib = c.bib; if (x.name) o.name = x.name;
      entries.push(o);
    });
    const startOut = start.slice().sort((a, b) => a.bib - b.bib).map((r) => ({ bib: r.bib, ath: resolve(r.name).id }));
    return { race: raw.race, entries: pendingDns.length ? [] : entries, start: startOut, warnings, unknown: [...new Set(unknown)], pendingDns };
  }

  const api = { startRows, rankRows, athletesOf, buildStart, buildRace };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CX_RESULTS = api;
})(typeof window !== 'undefined' ? window : globalThis);
