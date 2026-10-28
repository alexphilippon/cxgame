#!/usr/bin/env node
/* CX GAME – dessine le bandeau : scène de cyclo-cross (arbres nus, rubalise, barrières, coureur couvert de boue)
   et projections de boue « sur la vitre » (éclaboussures, gouttes, coulures). Déterministe (graine fixe).
   Réécrit le bloc entre <!--hdr:start--> et <!--hdr:end--> de index.html.   Usage : node tools/make-header.js */
'use strict';
const fs = require('fs'), path = require('path');
let s = 20261031;
const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const R = (a, b) => a + (b - a) * rnd(), f1 = (v) => Math.round(v * 10) / 10;

/* Courbe fermée lisse (Catmull-Rom -> Bézier) */
function smooth(pts) {
  const n = pts.length; let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d + 'Z';
}
/* Tache irrégulière : rayon bruité, quelques « doigts » */
function blob(cx, cy, r, jag, fingers) {
  const n = r < 4 ? 7 : r < 9 ? 10 : 14 + Math.floor(r / 4), pts = [];
  const fa = []; for (let k = 0; k < (fingers || 0); k++) fa.push([R(0, Math.PI * 2), R(1.4, 2.4)]);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2; let rr = r * (1 + jag * (rnd() - .5));
    fa.forEach(([fa0, m]) => { const da = Math.abs(((a - fa0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (da < .22) rr *= 1 + (m - 1) * (1 - da / .22); });
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return smooth(pts);
}
/* Goutte projetée : tête ronde, queue effilée vers le point d'impact */
function streak(x, y, ang, len, w) {
  const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
  const hx = x, hy = y, tx = x - ca * len, ty = y - sa * len;
  return `M${f1(tx)} ${f1(ty)}C${f1(tx + ca * len * .45 + nx * w * .55)} ${f1(ty + sa * len * .45 + ny * w * .55)} ${f1(hx - ca * w * .9 + nx * w)} ${f1(hy - sa * w * .9 + ny * w)} ${f1(hx + nx * w)} ${f1(hy + ny * w)}` +
    `A${f1(w)} ${f1(w)} 0 0 1 ${f1(hx - nx * w)} ${f1(hy - ny * w)}C${f1(hx - ca * w * .9 - nx * w)} ${f1(hy - sa * w * .9 - ny * w)} ${f1(tx + ca * len * .45 - nx * w * .55)} ${f1(ty + sa * len * .45 - ny * w * .55)} ${f1(tx)} ${f1(ty)}Z`;
}
const mud = [], hi = [], glint = [];
function circ(x, y, r) { return `M${f1(x - r)} ${f1(y)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0`; }
function drop(x, y, r, jag, fing) { mud.push(r < 2.4 ? circ(x, y, r) : blob(x, y, r, jag == null ? .35 : jag, fing)); if (r > 5) hi.push(blob(x - r * .22, y - r * .26, r * .5, .3)); if (r > 8) glint.push([x - r * .34, y - r * .4, r * .16, r * .09]); }
/* Impact : masse centrale + bras + gouttes projetées + semis fin */
function splash(cx, cy, Rr, opt) {
  opt = opt || {}; const spread = opt.spread || 1;
  mud.push(blob(cx, cy, Rr, .55, 4 + Math.floor(Rr / 14))); mud.push(blob(cx + Rr * R(-.5, .5), cy + Rr * R(-.4, .4), Rr * .6, .5, 2));
  hi.push(blob(cx - Rr * .22, cy - Rr * .28, Rr * .5, .5)); glint.push([cx - Rr * .4, cy - Rr * .44, Rr * .2, Rr * .1], [cx + Rr * .12, cy - Rr * .58, Rr * .09, Rr * .05]);
  const arms = 5 + Math.floor(Rr / 9);
  for (let i = 0; i < arms; i++) {
    const a = R(0, Math.PI * 2), dist = Rr * R(1.1, 1.8) * spread, w = R(2.8, 5.4) * (Rr / 30 + .6), len = R(Rr * .3, Rr * .7);
    const x = cx + Math.cos(a) * dist, y = cy + Math.sin(a) * dist; mud.push(streak(x, y, a, Math.max(8, len), w)); hi.push(streak(x - w * .25, y - w * .3, a, Math.max(5, len * .5), w * .45));
  }
  const sat = 10 + Math.floor(Rr * .8);
  for (let i = 0; i < sat; i++) { const a = R(0, Math.PI * 2), dist = Rr * (1.3 + Math.pow(rnd(), 1.5) * 4.2) * spread, r = Math.max(1.1, R(1.4, 6.5) * (1 - dist / (Rr * 7)) * (Rr / 26 + .55)); drop(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, r, .3); }
}
/* Coulure : traînée verticale qui part d'une masse, bulbe au bout */
function drip(x, y, len, w) {
  const d = `M${f1(x - w)} ${f1(y - 3)}C${f1(x - w * .9)} ${f1(y + len * .35)} ${f1(x - w * .35)} ${f1(y + len * .7)} ${f1(x - w * .6)} ${f1(y + len - w * .8)}A${f1(w * 1.15)} ${f1(w * 1.15)} 0 1 0 ${f1(x + w * .6)} ${f1(y + len - w * .8)}C${f1(x + w * .35)} ${f1(y + len * .7)} ${f1(x + w * .9)} ${f1(y + len * .35)} ${f1(x + w)} ${f1(y - 3)}Z`;
  mud.push(d); hi.push(`M${f1(x - w * .45)} ${f1(y + 2)}L${f1(x - w * .35)} ${f1(y + len * .6)}L${f1(x - w * .05)} ${f1(y + len * .6)}L${f1(x - w * .1)} ${f1(y + 2)}Z`); glint.push([x - w * .3, y + len - w * 1.2, w * .3, w * .22]);
}
/* --- Composition (repère 1000 × 300 ; sur mobile seule la moitié droite est visible) --- */
splash(952, 82, 44, { spread: 1.1 });              // gros impact en haut à droite
splash(640, 74, 34);
splash(985, 232, 28);
splash(598, 238, 20, { spread: .9 });
splash(930, 244, 14, { spread: .8 });
splash(46, 52, 28, { spread: .9 });                // coins : le bloc du texte reste dégagé
splash(262, 52, 16, { spread: .8 });
splash(50, 246, 16, { spread: .7 });
splash(415, 248, 18, { spread: .8 });
splash(520, 60, 14, { spread: .8 });
for (let i = 0; i < 160; i++) { const x = R(10, 995), y = R(44, 258); if (x < 450 && y > 82 && y < 228) continue; if (x < 450 && rnd() < .5) continue; drop(x, y, Math.pow(rnd(), 2.2) * 3.4 + .9, .3); }
drip(952, 112, 50, 4.2); drip(930, 118, 26, 2.6); drip(975, 116, 36, 3.2);
drip(640, 100, 54, 3.8); drip(622, 104, 26, 2.4); drip(978, 250, 8, 2.6);
drip(46, 76, 24, 3.4); drip(30, 78, 12, 2.2); drip(262, 66, 22, 2.6); drip(520, 70, 30, 2.5); drip(780, 46, 36, 2.6); drip(985, 20, 40, 3.2); drip(560, 46, 22, 2.2);

/* --- Scène --- */
function tree(x, y, h, depth, ang, w, out) {
  if (depth === 0 || h < 5) return;
  const x2 = x + Math.sin(ang) * h, y2 = y - Math.cos(ang) * h; out.push(`<path d="M${f1(x)} ${f1(y)}L${f1(x2)} ${f1(y2)}" stroke-width="${f1(w)}"/>`);
  const k = depth > 2 ? 2 : 3; for (let i = 0; i < k; i++) tree(x2, y2, h * R(.62, .78), depth - 1, ang + R(-.7, .7), w * .66, out);
}
const trees = []; [[470, 262, 105], [528, 262, 128], [592, 262, 92], [676, 262, 118], [744, 262, 140], [905, 262, 110], [968, 262, 130], [818, 262, 88]].forEach(([x, y, h]) => tree(x, y, h * .42, 5, R(-.15, .15), 4.2, trees));
const scene = `
      <g transform="translate(0 -30)">
      <g class="stars"><circle cx="470" cy="24" r="1.6"/><circle cx="540" cy="60" r="1.2"/><circle cx="610" cy="18" r="1.8"/><circle cx="700" cy="30" r="1.5"/><circle cx="830" cy="26" r="1.2"/><circle cx="905" cy="62" r="1.6"/></g>
      <circle class="sun" cx="868" cy="140" r="42" opacity=".35"/>
      <path class="mt-back" d="M430 300V236C520 226 600 238 690 230S850 226 1000 236V345Z" opacity=".55"/>
      <g class="tr" fill="none" stroke-linecap="round" opacity=".8">${trees.join('')}</g>
      <path class="mt-mid" d="M440 300V250C560 238 680 252 800 246S950 244 1000 248V345Z"/>
      <g class="tape" fill="none" stroke-linecap="round"><path d="M520 258C560 226 600 262 640 232S720 236 760 224" stroke-width="2.6"/><path d="M880 252C910 224 940 250 1000 228" stroke-width="2.6"/></g>
      <g class="mt-tree"><rect x="518" y="228" width="4" height="34"/><rect x="638" y="212" width="4" height="40"/><rect x="758" y="200" width="4" height="30"/><rect x="878" y="224" width="4" height="34"/>
        <rect x="596" y="236" width="74" height="7" rx="1.5"/><rect x="596" y="248" width="74" height="7" rx="1.5"/><rect x="602" y="236" width="5" height="26"/><rect x="660" y="236" width="5" height="26"/></g>
      <path class="ground" d="M430 300V274C520 262 640 280 760 270S930 262 1000 272V345Z"/>
      <g class="ruts" fill="none" stroke-linecap="round"><path d="M446 290C560 276 700 292 860 280S960 280 1000 284" stroke-width="2.4"/><path d="M470 298C600 286 740 298 900 289" stroke-width="1.8"/></g>
      <ellipse class="puddle" cx="905" cy="288" rx="38" ry="5"/><ellipse class="puddle" cx="548" cy="286" rx="26" ry="3.6"/>
      <g class="rider" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(800 200) scale(1.18)">
        <circle cx="0" cy="38" r="21" stroke-width="5"/><circle cx="0" cy="38" r="24.5" stroke-width="3.6" stroke-dasharray="3 3.4" class="knob"/>
        <circle cx="64" cy="38" r="21" stroke-width="5"/><circle cx="64" cy="38" r="24.5" stroke-width="3.6" stroke-dasharray="3 3.4" class="knob"/>
        <path d="M0 38L14 4M14 4L52 2M52 2L27 38M27 38L0 38M52 2L64 38M14 4L27 38" stroke-width="4"/>
        <path d="M11 -4L14 4" stroke-width="4"/><path d="M5 -5L19 -5" stroke-width="5"/><path d="M52 2L55 -6C62 -6 66 0 63 8" stroke-width="3.6"/>
        <path d="M13 -8L47 -29" stroke-width="9"/><path d="M45 -27L58 -6" stroke-width="5"/><path d="M13 -8L36 12L29 36" stroke-width="6"/><path d="M26 30L36 38" stroke-width="5"/>
        <circle cx="55" cy="-38" r="7.5" class="riderf" stroke="none"/><path d="M47 -41C50 -50 62 -50 64 -42Z" class="riderf" stroke="none"/>
      </g>
      <g class="spray">${(() => { const o = []; for (let i = 0; i < 34; i++) { const t = i / 34, x = 800 - t * 170 + R(-8, 8), y = 232 - Math.sin(t * Math.PI * .9) * 74 * R(.7, 1.1) + t * 30 + R(-9, 9), r = Math.max(1, (1 - t) * R(2, 6)); o.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}"/>`); } for (let i = 0; i < 10; i++) { const a = R(-2.6, -.5); o.push(`<circle cx="${f1(873 + Math.cos(a) * R(6, 34))}" cy="${f1(246 + Math.sin(a) * R(6, 30))}" r="${f1(R(1, 2.8))}"/>`); } return o.join(''); })()}</g>
      </g>`;

const mudSvg = `<svg class="masthead__mud" viewBox="0 0 1000 300" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
      <defs><radialGradient id="mudg" cx="34%" cy="28%" r="80%"><stop offset="0" style="stop-color:var(--mud-hi)"/><stop offset=".5" style="stop-color:var(--mud-mid)"/><stop offset="1" style="stop-color:var(--mud-lo)"/></radialGradient></defs>
      <defs><path id="mudp" d="${mud.join('')}"/></defs>
      <use href="#mudp" class="mud__shade" transform="translate(2.2 3)"/>
      <use href="#mudp" class="mud__body" fill="url(#mudg)"/>
      <path class="mud__hi" d="${hi.join('')}"/>
      <g class="mud__glint">${glint.map(([x, y, rx, ry]) => `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rx)}" ry="${f1(ry)}" transform="rotate(-32 ${f1(x)} ${f1(y)})"/>`).join('')}</g>
    </svg>`;
const block = `<!--hdr:start-->
    <svg class="masthead__art" viewBox="0 0 1000 300" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">${scene}
    </svg>
    ${mudSvg}
    <!--hdr:end-->`;
const p = path.join(__dirname, '..', 'index.html'); let h = fs.readFileSync(p, 'utf8');
if (h.includes('<!--hdr:start-->')) h = h.replace(/<!--hdr:start-->[\s\S]*?<!--hdr:end-->/, () => block);
else h = h.replace(/<svg class="masthead__art"[\s\S]*?<\/svg>/, () => block);
fs.writeFileSync(p, h); console.log('bandeau réécrit :', mud.length, 'taches,', block.length, 'octets');
