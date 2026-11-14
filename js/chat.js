/* CX GAME – messages privés entre joueurs (1 à 1). Pastille de non-lus dans « Mon compte », pas de notification push.
   Un joueur peut supprimer ses propres messages et signaler celui d'un autre à l'organisateur (onglet Admin > Signalements). */
(function (root) {
  'use strict';
  let C = null, chats = [], unsubC = null, cur = null, armed = null, me = null;
  const MAX = 600;
  const init = (ctx) => { C = ctx; };
  const seenOf = (c) => ((c.seen || {})[me]) || 0;
  const isUnread = (c) => !!c.last && c.last.from !== me && c.last.ts > seenOf(c);
  const count = () => chats.filter(isUnread).length;
  const isOpen = () => !!document.querySelector('#modal .chat');
  const nameOf = (id) => (C.players().find((p) => p.id === id) || {}).name || 'Joueur';
  const fmt = (ts) => { const d = new Date(ts), t = new Date(); const same = d.toDateString() === t.toDateString(); return d.toLocaleString('fr-FR', same ? { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }); };

  function start(uid) {
    if (me === uid && unsubC) return;
    stop(); me = uid; if (!uid) return;
    unsubC = C.store.listenChats(uid, (l) => {
      chats = l.sort((a, b) => ((b.last || {}).ts || 0) - ((a.last || {}).ts || 0));
      C.refresh();
      if (isOpen()) { if (cur) markSeen(); else renderListInto(); }
    });
  }
  function stop() { if (unsubC) unsubC(); unsubC = null; closeConv(); chats = []; me = null; }
  function closeConv() { if (cur && cur.unsub) cur.unsub(); cur = null; armed = null; }
  function markSeen() { if (!cur) return; const c = chats.find((x) => x.id === cur.cid); if (c && isUnread(c)) C.store.markSeen(cur.cid, me); }

  function convRow(c) {
    const other = c.members.find((x) => x !== me), p = C.players().find((x) => x.id === other) || { id: other, name: nameOf(other) }, un = isUnread(c);
    return `<li><button type="button" class="chat__conv${un ? ' is-unread' : ''}" data-chat-open="${C.esc(other)}">${C.pav(p, 'sm')}<span class="chat__ct"><strong>${C.esc(p.name)}</strong><span class="chat__last">${c.last ? (c.last.from === me ? 'Toi : ' : '') + C.esc(String(c.last.text).slice(0, 70)) : ''}</span></span><span class="chat__when">${c.last ? fmt(c.last.ts) : ''}</span>${un ? '<i class="chat__dot" aria-label="Non lu"></i>' : ''}</button></li>`;
  }
  function listHtml() {
    const others = C.players().filter((p) => p.id !== me);
    return `<div class="chat"><h2>Messages</h2><p class="hint">Conversations privées entre joueurs : seuls vous deux les voyez. Un message problématique peut être signalé à l’organisateur.</p>
      <ul class="chat__convs" id="chat-convs">${chats.filter((c) => c.last).map(convRow).join('') || '<li class="none">Aucune conversation pour l’instant.</li>'}</ul>
      <div class="chat__new"><label for="chat-new">Nouveau message à</label><select id="chat-new">${others.map((p) => `<option value="${C.esc(p.id)}">${C.esc(p.name)}</option>`).join('')}</select><button type="button" class="btn btn--sm" data-chat-new>Écrire</button></div></div>`;
  }
  function renderListInto() { const u = document.querySelector('#modal #chat-convs'); if (u) u.innerHTML = chats.filter((c) => c.last).map(convRow).join('') || '<li class="none">Aucune conversation pour l’instant.</li>'; }
  function msgsHtml() {
    const ms = (cur && cur.msgs) || [];
    return ms.map((m) => {
      const mine = m.from === me, rep = armed === m.id;
      return `<li class="cm cm--${mine ? 'me' : 'you'}"><span class="cm__t">${C.esc(m.text).replace(/\n/g, '<br>')}</span><span class="cm__m">${fmt(m.ts)} ${mine ? `<button type="button" class="linkbtn" data-chat-del="${C.esc(m.id)}">Supprimer</button>` : `<button type="button" class="linkbtn${rep ? ' is-armed' : ''}" data-chat-rep="${C.esc(m.id)}">${rep ? 'Confirmer le signalement' : 'Signaler'}</button>`}</span></li>`;
    }).join('') || '<li class="none">Aucun message. Écris le premier !</li>';
  }
  function paintMsgs(stick) {
    const box = document.querySelector('#modal .chat__msgs'); if (!box) return;
    const near = stick || box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    box.innerHTML = msgsHtml(); if (near) box.scrollTop = box.scrollHeight;
  }
  function openList() { closeConv(); C.openModal(listHtml(), 'modal__card--chat'); }
  function openConv(other) {
    if (!other || other === me) return;
    closeConv(); const cid = C.store.chatId(me, other), p = C.players().find((x) => x.id === other) || { id: other, name: nameOf(other) };
    cur = { cid, other, msgs: [] };
    C.openModal(`<div class="chat chat--conv"><div class="chat__head"><button type="button" class="linkbtn" data-chat-list>← Messages</button><strong>${C.esc(p.name)}</strong><button type="button" class="linkbtn" data-player="${C.esc(other)}">Fiche</button></div>
      <ul class="chat__msgs" aria-live="polite"></ul>
      <form class="chat__form" data-chat-send><textarea id="chat-in" rows="2" maxlength="${MAX}" placeholder="Ton message…" aria-label="Ton message"></textarea><button type="submit" class="btn btn--sm">Envoyer</button></form>
      <p class="hint chat__note" id="chat-note">Privé entre vous deux. Tu peux supprimer tes messages ; « Signaler » prévient l’organisateur.</p></div>`, 'modal__card--chat');
    cur.unsub = C.store.listenMsgs(cid, (ms) => { if (!cur || cur.cid !== cid) return; cur.msgs = ms; paintMsgs(true); markSeen(); });
    markSeen();
  }
  const say = (t) => { const n = document.querySelector('#modal #chat-note'); if (n) n.textContent = t; };
  async function send(form) {
    const ta = form.querySelector('textarea'), text = ta.value.trim(); if (!text || !cur) return;
    ta.value = ''; try { await C.store.sendMsg(cur.cid, me, cur.other, text.slice(0, MAX)); } catch (e) { ta.value = text; say('Envoi impossible, réessaie.'); }
  }
  async function report(mid) {
    const m = cur.msgs.find((x) => x.id === mid); if (!m) return;
    if (armed !== mid) { armed = mid; paintMsgs(); return; }
    armed = null; const i = cur.msgs.indexOf(m), ctx = cur.msgs.slice(Math.max(0, i - 5), i + 1).map((x) => ({ from: nameOf(x.from), text: x.text, ts: x.ts }));
    try { await C.store.reportMsg({ by: me, byName: nameOf(me), from: m.from, fromName: nameOf(m.from), cid: cur.cid, mid, text: m.text, ctx }); say('Message signalé à l’organisateur. Merci.'); } catch (e) { say('Signalement impossible, réessaie.'); }
    paintMsgs();
  }
  document.addEventListener('click', (e) => {
    if (!C) return;
    const t = e.target;
    let b;
    if ((b = t.closest('[data-chat-open]'))) { openConv(b.dataset.chatOpen); return; }
    if (t.closest('[data-chat-list]')) { openList(); return; }
    if (t.closest('[data-chat-new]')) { const s = document.querySelector('#chat-new'); if (s && s.value) openConv(s.value); return; }
    if ((b = t.closest('[data-chat-del]'))) { C.store.deleteMsg(cur.cid, b.dataset.chatDel); return; }
    if ((b = t.closest('[data-chat-rep]'))) { report(b.dataset.chatRep); return; }
    if ((b = t.closest('[data-chat-with]'))) { openConv(b.dataset.chatWith); return; }
    if (t.closest('[data-chat-inbox]')) { openList(); return; }
    if (t.closest('[data-close]') || t.id === 'modal') closeConv();
  });
  document.addEventListener('submit', (e) => { const f = e.target.closest && e.target.closest('[data-chat-send]'); if (f) { e.preventDefault(); send(f); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && e.target && e.target.id === 'chat-in') { e.preventDefault(); const f = e.target.closest('form'); if (f) send(f); } });

  const api = { init, start, stop, count, openConv, openList };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CX_CHAT = api;
})(typeof self !== 'undefined' ? self : this);
