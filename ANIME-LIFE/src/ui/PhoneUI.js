// Smartphone do protagonista. Duas funções:
//  1) Conversas da HISTÓRIA (com escolhas) — abertas pelo roteiro (playConversation).
//  2) Celular livre — Mensagens (chat com IA), Contatos, Perfis, Histórico, Notificações e Hoshigram.
import { h, esc, wait } from './dom.js';
import { Characters } from '../characters/CharacterRegistry.js';
import { game } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';
import { Phone } from '../smartphone/PhoneSystem.js';
import { Chat } from '../smartphone/ChatSystem.js';
import { errorText } from '../smartphone/ai/AIClient.js';
import { Relationships, STATS } from '../relationships/RelationshipManager.js';
import { backgroundThumb } from '../scenes/backgrounds.js';
import { audio } from '../audio/AudioManager.js';

const hhmm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const when = (t) => {
  if (!t) return '';
  const d = new Date(t), now = new Date();
  if (d.toDateString() === now.toDateString()) return hhmm(t);
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};
const MOOD_ICON = { feliz: '😊', neutro: '😐', triste: '😢', irritado: '😠', envergonhado: '😳', carinhoso: '🥰', animado: '🤩', cansado: '😪', pensativo: '🤔' };
const avatar = (id, cls = '') => `<span class="av ${cls}"><img src="${Characters.portrait(id)}" alt=""><i class="dot ${Chat.online(id) ? 'on' : ''}"></i></span>`;

export class PhoneUI {
  constructor(ui) {
    this.ui = ui;
    this.el = h(`<div id="phone" class="hidden"><div class="phone">
      <div class="ph-status"><span class="ph-clock"></span><span class="ph-mode"></span><span>📶 🔋</span></div>
      <div class="ph-head"><button class="ph-back" aria-label="Voltar">‹</button><div class="ph-title"></div><button class="ph-close" aria-label="Fechar">✕</button></div>
      <div class="ph-body"></div>
      <div class="ph-replies"></div>
    </div></div>`);
    this.banner = h('<button id="notif-banner" class="hidden"></button>');
    ui.root.append(this.el, this.banner);
    this.body = this.el.querySelector('.ph-body');
    this.replies = this.el.querySelector('.ph-replies');
    this.el.querySelector('.ph-close').addEventListener('click', () => this.close());
    this.el.querySelector('.ph-back').addEventListener('click', () => { audio.sfx('back'); this.back?.(); });
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el && !this.locked) this.close(); });
    // atualizações do chat em tempo real
    bus.on('chat:update', (id) => { if (this.current?.view === 'chat' && this.current.id === id) this.renderMessages(); if (this.current?.view === 'msgs') this.msgs(0, true); });
    bus.on('chat:typing', (id) => { if (this.current?.view === 'chat' && this.current.id === id) { this.renderMessages(); this.renderChatHead(); } });
    bus.on('chat:error', (id, code) => { if (this.current?.view === 'chat' && this.current.id === id) this.ui.toast(`⚠️ ${errorText(code)}`); });
    bus.on('phone:notify', (n) => this.onNotify(n));
    // teclado virtual do Android: ajusta a altura do celular à área visível
    window.visualViewport?.addEventListener('resize', () => document.documentElement.style.setProperty('--vvh', `${window.visualViewport.height}px`));
  }

  title(id) { return Phone.conversation(id)?.title ?? id; }
  get isOpen() { return !this.el.classList.contains('hidden'); }

  async open() {
    this.el.querySelector('.ph-clock').textContent = hhmm(Date.now());
    const mode = Chat.mode();
    const m = this.el.querySelector('.ph-mode');
    m.textContent = mode === 'ia' ? '✨ IA' : '◌ local'; m.className = `ph-mode ${mode}`;
    this.el.classList.remove('hidden');
    await new Promise(requestAnimationFrame);
    this.el.classList.add('show');
    audio.sfx('open');
  }

  async close() {
    if (this.locked) return;
    this.el.classList.remove('show');
    audio.sfx('close');
    Chat.viewing = null; this.current = null;
    await wait(300);
    this.el.classList.add('hidden');
    if (this.counted) { this.counted = false; this.ui.modalCount(-1); }
    this.onClosed?.(); this.onClosed = null;
  }

  head(title, { back = null, closable = true, html = null, keepReplies = false } = {}) {
    const t = this.el.querySelector('.ph-title');
    if (html) t.innerHTML = html; else t.textContent = title;
    this.back = back;
    this.el.querySelector('.ph-back').style.visibility = back ? 'visible' : 'hidden';
    this.el.querySelector('.ph-close').style.visibility = closable ? 'visible' : 'hidden';
    if (!keepReplies) this.replies.innerHTML = '';
  }

  /** Troca de tela com transição (para frente/para trás). */
  view(html, dir = 1) {
    const v = h(`<div class="ph-view ${dir > 0 ? 'in-right' : dir < 0 ? 'in-left' : ''}">${html}</div>`);
    this.body.innerHTML = '';
    this.body.appendChild(v);
    requestAnimationFrame(() => v.classList.remove('in-right', 'in-left'));
    this.body.scrollTop = 0;
    return v;
  }

  // ================= conversa da HISTÓRIA (com escolhas) =================
  async playConversation(id, hooks, runner) {
    const def = Phone.conversation(id);
    this.locked = true; this.current = { view: 'story', id };
    this.head(def.title, { closable: false });
    const v = this.view('<div class="chat"></div>', 0);
    const chat = v.querySelector('.chat');
    await this.open();
    const view = {
      message: (m, restoring) => { chat.appendChild(this.storyBubble(m, def)); this.scroll(restoring); if (!restoring && m.from !== 'player') audio.sfx('blip'); },
      typing: async (from, ms) => {
        const t = h(`<div class="msg in typing">${def.group ? `<img src="${Characters.portrait(from)}" alt="">` : ''}<div><i></i><i></i><i></i></div></div>`);
        chat.appendChild(t); this.scroll();
        await wait(this.ui.dialogue.skipping ? 60 : ms);
        t.remove();
      },
      ask: (options) => new Promise((resolve) => {
        this.replies.innerHTML = options.map((o, i) => `<button data-i="${i}" ${o.locked ? 'disabled' : ''}>${o.locked ? '🔒 ' : ''}${esc(o.text)}</button>`).join('');
        this.replies.querySelectorAll('button:not([disabled])').forEach((b) => b.addEventListener('click', () => {
          audio.sfx('confirm'); this.replies.innerHTML = ''; resolve(Number(b.dataset.i));
        }));
        this.scroll();
      }),
    };
    await runner(id, view, hooks);
    this.locked = false;
    this.replies.innerHTML = '<button class="ph-done">Fechar o celular</button>';
    await new Promise((resolve) => {
      this.onClosed = resolve;
      this.replies.querySelector('.ph-done').addEventListener('click', () => this.close());
      if (this.ui.dialogue.skipping) setTimeout(() => this.close(), 200);
    });
  }

  storyBubble(m, def) {
    const who = def.group && m.from !== 'player' ? `<b style="color:${Characters.color(m.from)}">${esc(Characters.name(m.from))}</b>` : '';
    const img = def.group && m.from !== 'player' ? `<img src="${Characters.portrait(m.from)}" alt="">` : '';
    if (m.from === 'player') return h(`<div class="msg out"><div>${esc(m.t)}</div></div>`);
    const invite = m.invite ? `<div class="invite"><div class="iv-t">📩 ${esc(m.invite.title)}</div><div>🗓 ${esc(m.invite.when)}</div><div>📍 ${esc(m.invite.where)}</div></div>` : '';
    return h(`<div class="msg in">${img}<div>${who}${esc(m.t)}${invite}</div></div>`);
  }

  scroll(instant) { requestAnimationFrame(() => this.body.scrollTo({ top: this.body.scrollHeight, behavior: instant ? 'auto' : 'smooth' })); }

  // ================= CELULAR LIVRE =================
  async openApp(target = null) {
    if (!game.state) return;
    this.locked = false;
    if (!this.counted) { this.ui.modalCount(+1); this.counted = true; }
    game.state.phone.unread = 0;
    this.ui.dialogue.badge(false);
    if (target?.chat) this.chat(target.chat, 0); else this.home(0);
    if (!this.isOpen) await this.open();
  }

  home(dir = -1) {
    this.current = { view: 'home' }; Chat.viewing = null;
    this.head('');
    const s = game.state.phone;
    const unread = Chat.unreadTotal();
    const notif = (s.notifications || []).filter((n) => !n.read).length;
    const app = (a, icon, label, badge = 0) => `<button class="app" data-a="${a}"><i>${icon}${badge ? `<b class="app-badge">${badge}</b>` : ''}</i>${label}</button>`;
    const v = this.view(`<div class="ph-home">
      <div class="ph-big-clock">${hhmm(Date.now())}</div>
      <div class="ph-date">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      <div class="apps">
        ${app('msgs', '💬', 'Mensagens', unread)}${app('contacts', '👥', 'Contatos')}${app('profiles', '🪪', 'Perfis')}
        ${app('history', '🗂️', 'Histórico')}${app('notifs', '🔔', 'Notificações', notif)}${app('feed', '📸', 'Hoshigram')}
      </div>
      <p class="ph-mode-note">${Chat.mode() === 'ia' ? '✨ Conversas com IA conectadas.' : '◌ Modo local: respostas limitadas, sem IA. Configure um servidor em Ajustes → Celular e IA.'}</p>
    </div>`, dir);
    v.querySelectorAll('.app').forEach((b) => b.addEventListener('click', () => { audio.sfx('click'); this[b.dataset.a](1); }));
  }

  // ---------- Mensagens ----------
  msgs(dir = -1, refresh = false) {
    if (refresh && this.current?.view !== 'msgs') return;
    this.current = { view: 'msgs' }; Chat.viewing = null;
    if (!refresh) this.head('Mensagens', { back: () => this.home(-1) });
    const contacts = Chat.contacts().map((id) => ({ id, m: Chat.mem(id) }))
      .sort((a, b) => (b.m.history.at(-1)?.at || 0) - (a.m.history.at(-1)?.at || 0));
    const groups = Phone.threads().filter((t) => t.group);
    const rowC = ({ id, m }) => {
      const last = m.history.at(-1);
      const preview = Chat.typing.has(id) ? '<em>digitando…</em>' : esc(last ? `${last.from === 'player' ? 'Você: ' : ''}${last.text}` : 'Toque para conversar');
      return `<button class="thread" data-id="${id}">${avatar(id)}<div><b>${esc(Characters.get(id).name)}</b><small>${preview}</small></div>
        <span class="t-side"><small>${when(last?.at)}</small>${m.unread ? `<b class="unread">${m.unread}</b>` : ''}</span></button>`;
    };
    const rowG = (t) => `<button class="thread" data-group="${t.id}"><span class="av gicon">👥</span><div><b>${esc(t.title)}</b><small>${esc(t.log.at(-1)?.t || '')}</small></div><span class="t-side"><small>grupo</small></span></button>`;
    const html = (contacts.length || groups.length) ? contacts.map(rowC).join('') + groups.map(rowG).join('') : '<p class="ph-empty">Nenhum contato ainda.<br><small>Os personagens passam o número durante a história.</small></p>';
    const v = refresh ? this.body.querySelector('.ph-view') : this.view(html, dir);
    if (refresh) v.innerHTML = html;
    v.querySelectorAll('.thread[data-id]').forEach((b) => b.addEventListener('click', () => { audio.sfx('click'); this.chat(b.dataset.id); }));
    v.querySelectorAll('.thread[data-group]').forEach((b) => b.addEventListener('click', () => { audio.sfx('click'); this.groupThread(b.dataset.group); }));
  }

  renderChatHead(keepReplies = true) {
    const id = this.current.id;
    const status = Chat.typing.has(id) ? 'digitando…' : Chat.online(id) ? 'online' : `visto por último ${when(Chat.mem(id).lastTalk) || 'há algum tempo'}`;
    this.head('', { back: () => this.msgs(-1), keepReplies, html: `<span class="chat-head">${avatar(id, 'sm')}<span><b>${esc(Characters.name(id))}</b><small class="${Chat.typing.has(id) ? 'typing-txt' : ''}">${status}</small></span></span>` });
    this.el.querySelector('.chat-head').addEventListener('click', () => this.profile(id, 1, () => this.chat(id, -1)));
  }

  chat(id, dir = 1) {
    this.current = { view: 'chat', id };
    Chat.viewing = id;
    const m = Chat.mem(id); m.unread = 0;
    (game.state.phone.notifications || []).forEach((n) => { if (n.charId === id) n.read = true; });
    this.renderChatHead(false);
    const local = Chat.mode() === 'local';
    const v = this.view(`<div class="chat free"></div>`, dir);
    this.replies.innerHTML = `${local ? '<div class="ph-local">◌ Modo local: respostas simples, sem IA real.</div>' : ''}
      <form class="ph-input"><input type="text" maxlength="500" placeholder="Mensagem para ${esc(Characters.name(id))}…" autocomplete="off" enterkeyhint="send" aria-label="Escrever mensagem"><button type="submit" aria-label="Enviar">➤</button></form>`;
    const form = this.replies.querySelector('form'), input = form.querySelector('input');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim(); if (!text) return;
      input.value = ''; audio.sfx('confirm');
      Chat.send(id, text);
    });
    // não deixar as teclas do jogo (espaço/enter) avançarem o diálogo enquanto digita
    input.addEventListener('keydown', (e) => e.stopPropagation());
    this.renderMessages(true);
    bus.emit('chat:save');
    return v;
  }

  renderMessages(instant = false) {
    const box = this.body.querySelector('.chat.free'); if (!box) return;
    const id = this.current.id, m = Chat.mem(id);
    let lastDay = '', storyShown = false, html = '';
    for (const [i, x] of m.history.entries()) {
      const day = new Date(x.at).toDateString();
      if (x.story && !storyShown) { html += '<div class="day-sep">📖 conversa da história</div>'; storyShown = true; }
      else if (!x.story && day !== lastDay) html += `<div class="day-sep">${when(x.at) === hhmm(x.at) ? 'hoje' : when(x.at)}</div>`;
      lastDay = x.story ? lastDay : day;
      if (x.from === 'player') {
        const tick = x.status === 'error' ? '<em class="err">⚠ não enviada · tocar para reenviar</em>' : x.status === 'read' ? '<em class="tk read">✓✓</em>' : '<em class="tk">✓</em>';
        html += `<div class="msg out ${x.status === 'error' ? 'failed' : ''}" data-i="${i}"><div>${esc(x.text)}<span class="meta">${hhmm(x.at)} ${tick}</span></div></div>`;
      } else {
        html += `<div class="msg in"><div>${esc(x.text)}<span class="meta">${hhmm(x.at)}${x.local ? ' · local' : ''}</span></div></div>`;
      }
    }
    if (Chat.typing.has(id)) html += '<div class="msg in typing"><div><i></i><i></i><i></i></div></div>';
    if (!m.history.length) html = `<p class="ph-empty">Diga oi para ${esc(Characters.name(id))}! 👋</p>`;
    box.innerHTML = html;
    box.querySelectorAll('.msg.failed').forEach((b) => b.addEventListener('click', () => Chat.retry(id, m.history[Number(b.dataset.i)])));
    this.scroll(instant);
  }

  groupThread(cid) {
    const def = Phone.conversation(cid);
    this.current = { view: 'group', id: cid }; Chat.viewing = null;
    this.head(def.title, { back: () => this.msgs(-1) });
    const v = this.view('<div class="chat"></div>', 1);
    const chat = v.querySelector('.chat');
    Phone.progress(cid).msgs.forEach((m) => chat.appendChild(this.storyBubble(m, def)));
    this.replies.innerHTML = '<div class="ph-local">Conversa em grupo da história (somente leitura).</div>';
    this.scroll(true);
  }

  // ---------- Contatos e perfis ----------
  contacts(dir = 1) {
    this.current = { view: 'contacts' }; Chat.viewing = null;
    this.head('Contatos', { back: () => this.home(-1) });
    const list = Chat.contacts();
    const v = this.view(list.length ? list.map((id) => {
      const c = Characters.get(id);
      return `<div class="contact">${avatar(id)}<div><b>${esc(c.name)}</b><small>${esc(c.role || c.occupation || '')} · ${Chat.online(id) ? 'online' : 'offline'}</small></div>
        <span class="c-actions"><button data-chat="${id}" aria-label="Conversar">💬</button><button data-prof="${id}" aria-label="Perfil">🪪</button></span></div>`;
    }).join('') : '<p class="ph-empty">Nenhum contato ainda.</p>', dir);
    v.querySelectorAll('[data-chat]').forEach((b) => b.addEventListener('click', () => this.chat(b.dataset.chat)));
    v.querySelectorAll('[data-prof]').forEach((b) => b.addEventListener('click', () => this.profile(b.dataset.prof, 1, () => this.contacts(-1))));
  }

  profiles(dir = 1) {
    this.current = { view: 'profiles' }; Chat.viewing = null;
    this.head('Perfis', { back: () => this.home(-1) });
    const met = Characters.all().filter((c) => game.state.rel[c.id]?.met);
    const v = this.view(`<div class="prof-grid">${met.map((c) => `<button class="prof-card" data-id="${c.id}" style="--nc:${c.color}"><img src="${Characters.portrait(c.id)}" alt=""><b>${esc(c.displayName)}</b><small>${MOOD_ICON[Relationships.mood(c.id)] || ''}</small></button>`).join('') || '<p class="ph-empty">Ninguém por aqui ainda.</p>'}</div>`, dir);
    v.querySelectorAll('.prof-card').forEach((b) => b.addEventListener('click', () => this.profile(b.dataset.id, 1, () => this.profiles(-1))));
  }

  profile(id, dir = 1, back = () => this.profiles(-1)) {
    this.current = { view: 'profile', id }; Chat.viewing = null;
    const c = Characters.get(id), r = Relationships.get(id), m = Chat.mem(id);
    const mood = Relationships.mood(id);
    this.head(c.displayName, { back });
    const bars = STATS.filter((s) => s.key !== 'romance' || Characters.canRomance(id)).map((s) => `<div class="bar"><span>${s.icon} ${s.label}</span><div><i style="width:${Math.min(100, (r[s.key] || 0) * 2)}%"></i></div><em>${r[s.key] || 0}</em></div>`).join('');
    const facts = m.facts.slice().reverse().slice(0, 8);
    const v = this.view(`<div class="profile" style="--nc:${c.color}">
      <div class="p-top"><img src="${Characters.portrait(id)}" alt=""><div><b>${esc(c.name)}</b><small>${c.age ? `${c.age} anos · ` : ''}${esc(c.occupation)}</small><small>${Chat.online(id) ? '🟢 online' : '⚪ offline'} · humor: ${MOOD_ICON[mood] || ''} ${mood}</small></div></div>
      <p class="p-bio">${esc(c.bio)}</p>
      <div class="p-bars">${bars}</div>
      <h4>O que ${esc(c.displayName)} lembra sobre você</h4>
      ${facts.length ? `<ul class="p-facts">${facts.map((f) => `<li><span>${{ preferencia: '💛', promessa: '🤝', momento: '✨', fato: '📝' }[f.kind] || '📝'}</span>${esc(f.text)}</li>`).join('')}</ul>` : '<p class="ph-empty sm">Ainda nada. Converse para criar memórias.</p>'}
      ${Chat.contacts().includes(id) ? `<button class="pbtn p-chat">💬 Conversar</button>` : '<p class="ph-empty sm">Vocês ainda não trocaram números.</p>'}
    </div>`, dir);
    v.querySelector('.p-chat')?.addEventListener('click', () => this.chat(id));
  }

  // ---------- Histórico e notificações ----------
  history(dir = 1) {
    this.current = { view: 'history' }; Chat.viewing = null;
    this.head('Histórico', { back: () => this.home(-1) });
    const rows = [];
    for (const id of Chat.contacts()) { const m = Chat.mem(id); if (m.history.length) rows.push({ at: m.history.at(-1).at, html: `<button class="thread" data-id="${id}">${avatar(id)}<div><b>${esc(Characters.name(id))}</b><small>${m.history.length} mensagens · desde ${when(m.history[0].at)}</small></div><span class="t-side"><small>${when(m.history.at(-1).at)}</small></span></button>` }); }
    for (const t of Phone.threads()) rows.push({ at: t.updatedAt || 0, html: `<button class="thread" data-group="${t.id}"><span class="av gicon">${t.group ? '👥' : '📖'}</span><div><b>${esc(t.title)}</b><small>${t.log.length} mensagens · história</small></div></button>` });
    rows.sort((a, b) => b.at - a.at);
    const v = this.view(rows.map((r) => r.html).join('') || '<p class="ph-empty">Nenhuma conversa ainda.</p>', dir);
    v.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => this.chat(b.dataset.id)));
    v.querySelectorAll('[data-group]').forEach((b) => b.addEventListener('click', () => this.groupThread(b.dataset.group)));
  }

  notifs(dir = 1) {
    this.current = { view: 'notifs' }; Chat.viewing = null;
    this.head('Notificações', { back: () => this.home(-1) });
    const list = game.state.phone.notifications || [];
    const v = this.view(list.length ? list.map((n, i) => `<button class="notif ${n.read ? '' : 'new'}" data-i="${i}">${n.charId ? `<img src="${Characters.portrait(n.charId)}" alt="">` : '<span class="gicon">🔔</span>'}
      <div><b>${n.charId ? esc(Characters.name(n.charId)) : 'Aviso'}</b><small>${esc(n.text)}</small></div><span class="t-side"><small>${when(n.at)}</small></span></button>`).join('') : '<p class="ph-empty">Sem notificações.</p>', dir);
    v.querySelectorAll('.notif').forEach((b) => b.addEventListener('click', () => { const n = list[Number(b.dataset.i)]; n.read = true; if (n.charId && n.kind === 'msg') this.chat(n.charId); }));
  }

  feed(dir = 1) {
    this.current = { view: 'feed' }; Chat.viewing = null;
    this.head('Hoshigram', { back: () => this.home(-1) });
    const posts = Phone.posts();
    const v = this.view(posts.length ? posts.map((p) => `<div class="post">
      <div class="p-head"><img src="${Characters.portrait(p.author)}" alt=""><b>${esc(Characters.name(p.author))}</b><small>${esc(p.time)}</small></div>
      <img class="p-img" src="${backgroundThumb(p.art, 360)}" alt="">
      <div class="p-foot"><button class="like ${p.liked ? 'on' : ''}" data-id="${p.id}">${p.liked ? '♥' : '♡'} ${p.likes + (p.liked ? 1 : 0)}</button></div>
      <p>${esc(p.text)}</p></div>`).join('') : '<p class="ph-empty">Nada por aqui ainda.</p>', dir);
    v.querySelectorAll('.like').forEach((b) => b.addEventListener('click', () => { Phone.toggleLike(b.dataset.id); audio.sfx('sparkle'); this.feed(0); }));
  }

  // ---------- notificação dentro do jogo ----------
  onNotify(n) {
    this.ui.dialogue.badge(true);
    if (n.kind !== 'msg' || (this.current?.view === 'chat' && this.current.id === n.charId)) return;
    audio.sfx('sparkle');
    const b = this.banner;
    b.innerHTML = `<img src="${Characters.portrait(n.charId)}" alt=""><span><b>${esc(Characters.name(n.charId))}</b><small>${esc(n.text)}</small></span>`;
    b.classList.remove('hidden'); requestAnimationFrame(() => b.classList.add('show'));
    b.onclick = () => { b.classList.remove('show'); this.openApp({ chat: n.charId }); };
    clearTimeout(this._bt);
    this._bt = setTimeout(() => { b.classList.remove('show'); setTimeout(() => b.classList.add('hidden'), 400); }, 4200);
  }
}
