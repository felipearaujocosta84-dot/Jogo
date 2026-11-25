// Celular na tela: conversas com escolhas (durante a história) e apps para consultar depois
// (Mensagens, Contatos, Hoshigram).
import { h, esc, wait } from './dom.js';
import { Characters } from '../characters/CharacterRegistry.js';
import { game } from '../core/GameState.js';
import { Phone } from '../smartphone/PhoneSystem.js';
import { Relationships, STATS } from '../relationships/RelationshipManager.js';
import { backgroundThumb } from '../scenes/backgrounds.js';
import { audio } from '../audio/AudioManager.js';

const clock = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export class PhoneUI {
  constructor(ui) {
    this.ui = ui;
    this.el = h(`<div id="phone" class="hidden"><div class="phone">
      <div class="ph-status"><span class="ph-clock"></span><span>📶 🔋</span></div>
      <div class="ph-head"><button class="ph-back" aria-label="Voltar">‹</button><div class="ph-title"></div><button class="ph-close" aria-label="Fechar">✕</button></div>
      <div class="ph-body"></div>
      <div class="ph-replies"></div>
    </div></div>`);
    ui.root.appendChild(this.el);
    this.body = this.el.querySelector('.ph-body');
    this.replies = this.el.querySelector('.ph-replies');
    this.el.querySelector('.ph-close').addEventListener('click', () => this.close());
    this.el.querySelector('.ph-back').addEventListener('click', () => this.back?.());
  }

  title(id) { return Phone.conversation(id)?.title ?? id; }

  async open() {
    this.el.querySelector('.ph-clock').textContent = clock();
    this.el.classList.remove('hidden');
    await new Promise(requestAnimationFrame);
    this.el.classList.add('show');
    audio.sfx('open');
  }

  async close() {
    if (this.locked) return;
    this.el.classList.remove('show');
    audio.sfx('close');
    await wait(300);
    this.el.classList.add('hidden');
    if (this.counted) { this.counted = false; this.ui.modalCount(-1); }
    this.onClosed?.(); this.onClosed = null;
  }

  head(title, { back = null, closable = true } = {}) {
    this.el.querySelector('.ph-title').textContent = title;
    this.back = back;
    this.el.querySelector('.ph-back').style.visibility = back ? 'visible' : 'hidden';
    this.el.querySelector('.ph-close').style.visibility = closable ? 'visible' : 'hidden';
    this.replies.innerHTML = '';
  }

  // ---------------- conversa da história ----------------
  async playConversation(id, hooks, runner) {
    const def = Phone.conversation(id);
    this.locked = true;
    this.head(def.title, { closable: false });
    this.body.innerHTML = '<div class="chat"></div>';
    const chat = this.body.querySelector('.chat');
    await this.open();
    const view = {
      message: (m, restoring) => { chat.appendChild(this.bubble(m, def)); this.scroll(restoring); if (!restoring && m.from !== 'player') audio.sfx('blip'); },
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
    // fim da conversa: o jogador fecha o celular
    this.locked = false;
    this.replies.innerHTML = '<button class="ph-done">Fechar o celular</button>';
    await new Promise((resolve) => {
      this.onClosed = resolve;
      this.replies.querySelector('.ph-done').addEventListener('click', () => this.close());
      if (this.ui.dialogue.skipping) setTimeout(() => this.close(), 200);
    });
  }

  bubble(m, def) {
    if (m.invite) {
      return h(`<div class="msg in">${def.group ? `<img src="${Characters.portrait(m.from)}" alt="">` : ''}<div>
        ${def.group ? `<b style="color:${Characters.color(m.from)}">${esc(Characters.name(m.from))}</b>` : ''}${esc(m.t)}
        <div class="invite"><div class="iv-t">📩 ${esc(m.invite.title)}</div><div>🗓 ${esc(m.invite.when)}</div><div>📍 ${esc(m.invite.where)}</div></div></div></div>`);
    }
    if (m.from === 'player') return h(`<div class="msg out"><div>${esc(m.t)}</div></div>`);
    return h(`<div class="msg in">${def.group ? `<img src="${Characters.portrait(m.from)}" alt="">` : ''}<div>${def.group ? `<b style="color:${Characters.color(m.from)}">${esc(Characters.name(m.from))}</b>` : ''}${esc(m.t)}</div></div>`);
  }

  scroll(instant) { this.body.scrollTo({ top: this.body.scrollHeight, behavior: instant ? 'auto' : 'smooth' }); }

  // ---------------- apps (consulta a qualquer momento) ----------------
  async openApp() {
    if (!game.state) return;
    this.locked = false;
    this.ui.modalCount(+1); this.counted = true;
    game.state.phone.unread = 0;
    this.home();
    await this.open();
  }

  home() {
    this.head('Início');
    const s = game.state.phone;
    this.body.innerHTML = `<div class="ph-home">
      <div class="ph-big-clock">${clock()}</div><div class="ph-date">${esc(game.p.displayName)}</div>
      <div class="apps">
        <button class="app" data-a="msgs"><i>💬</i>Mensagens</button>
        <button class="app" data-a="contacts"><i>👥</i>Contatos<small>${s.contacts.length}</small></button>
        <button class="app" data-a="feed"><i>📸</i>Hoshigram<small>${s.posts.length}</small></button>
      </div></div>`;
    this.body.querySelectorAll('.app').forEach((b) => b.addEventListener('click', () => { audio.sfx('click'); this[b.dataset.a](); }));
  }

  msgs() {
    this.head('Mensagens', { back: () => this.home() });
    const threads = Phone.threads();
    this.body.innerHTML = threads.length ? threads.map((t) => {
      const last = t.log[t.log.length - 1];
      const icon = t.group ? '<span class="gicon">👥</span>' : `<img src="${Characters.portrait(t.members[0])}" alt="">`;
      return `<button class="thread" data-id="${t.id}">${icon}<div><b>${esc(t.title)}</b><small>${esc(last ? (last.from === 'player' ? 'Você: ' : '') + (last.t || '📩 convite') : '')}</small></div></button>`;
    }).join('') : '<p class="ph-empty">Nenhuma conversa ainda.</p>';
    this.body.querySelectorAll('.thread').forEach((b) => b.addEventListener('click', () => this.thread(b.dataset.id)));
  }

  thread(id) {
    const def = Phone.conversation(id);
    this.head(def.title, { back: () => this.msgs() });
    this.body.innerHTML = '<div class="chat"></div>';
    const chat = this.body.querySelector('.chat');
    Phone.progress(id).msgs.forEach((m) => chat.appendChild(this.bubble(m, def)));
    this.scroll(true);
  }

  contacts() {
    this.head('Contatos', { back: () => this.home() });
    const list = Phone.contacts();
    this.body.innerHTML = list.length ? list.map((id) => {
      const c = Characters.get(id), r = Relationships.get(id);
      return `<div class="contact"><img src="${Characters.portrait(id)}" alt=""><div><b>${esc(c.name)}</b><small>${esc(c.role || c.occupation || '')}</small>
        <div class="mini-stats">${STATS.map((s) => `<span title="${s.label}">${s.icon} ${r[s.key]}</span>`).join('')}</div></div></div>`;
    }).join('') : '<p class="ph-empty">Nenhum contato ainda.</p>';
  }

  feed() {
    this.head('Hoshigram', { back: () => this.home() });
    const posts = Phone.posts();
    this.body.innerHTML = posts.length ? posts.map((p) => `<div class="post">
      <div class="p-head"><img src="${Characters.portrait(p.author)}" alt=""><b>${esc(Characters.name(p.author))}</b><small>${esc(p.time)}</small></div>
      <img class="p-img" src="${backgroundThumb(p.art, 360)}" alt="">
      <div class="p-foot"><button class="like ${p.liked ? 'on' : ''}" data-id="${p.id}">${p.liked ? '♥' : '♡'} ${p.likes + (p.liked ? 1 : 0)}</button></div>
      <p>${esc(p.text)}</p></div>`).join('') : '<p class="ph-empty">Nada por aqui ainda.</p>';
    this.body.querySelectorAll('.like').forEach((b) => b.addEventListener('click', () => { Phone.toggleLike(b.dataset.id); audio.sfx('sparkle'); this.feed(); }));
  }
}
