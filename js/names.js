/* CX GAME – noms de coureurs : clé de rapprochement, affichage, identifiant (fonctions pures) */
(function (root) {
  'use strict';

  // Lettres que la décomposition Unicode ne ramène pas à l'ASCII.
  const FOLD = { 'ø': 'o', 'ß': 'ss', 'đ': 'd', 'ł': 'l', 'æ': 'ae', 'œ': 'oe', 'ð': 'd', 'þ': 'th', 'ı': 'i' };

  /** Retire accents et casse : « Zemanová Kristyna » → « zemanova kristyna ». */
  function plain(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
      .replace(/[øßđłæœðþı]/g, (c) => FOLD[c]);
  }
  /** Clé de rapprochement : sans accents, minuscules, mots triés. « VAN DER POEL Mathieu » et « Mathieu van der Poel » donnent la même clé. */
  function nameKey(s) {
    return plain(s).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).sort().join(' ');
  }

  const PARTICLES = new Set(['van', 'der', 'den', 'de', 'del', 'della', 'di', 'da', 'du', 'von', 'ten', 'ter', 'la', 'le', 'dos', 'do']);
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const isUpper = (t) => t === t.toUpperCase() && t !== t.toLowerCase();
  /** « NOM Prénom » (écriture des classements) → « Prénom Nom ». « VAN DER POEL Mathieu » → « Mathieu van der Poel ». */
  function displayName(src) {
    const tok = String(src || '').trim().split(/\s+/).filter(Boolean);
    let i = 0;
    while (i < tok.length && isUpper(tok[i])) i++;
    if (i === 0 || i === tok.length) return tok.map(cap).join(' '); // pas de partie NOM détectable : on ne devine pas
    const surname = tok.slice(0, i).map((w, k) => {
      const lw = w.toLowerCase();
      if (k > 0 && PARTICLES.has(lw)) return lw;
      if (k === 0 && PARTICLES.has(lw) && i > 1) return lw;
      return w.split('-').map((p) => (/^mc[a-z]/i.test(p) ? 'Mc' + cap(p.slice(2)) : cap(p))).join('-');
    });
    return tok.slice(i).concat(surname).join(' ');
  }
  /** Identifiant stable : « Mathieu van der Poel » → « mathieu-van-der-poel ». */
  function slug(name) {
    return plain(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  const api = { nameKey, displayName, slug, plain };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CX_NAMES = api;
})(typeof window !== 'undefined' ? window : globalThis);
