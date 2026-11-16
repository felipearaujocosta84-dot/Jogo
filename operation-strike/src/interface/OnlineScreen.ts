// Tela MULTIPLAYER (tema militar escuro e dourado): conta (cadastro/login), jogar online (partida rápida,
// salas públicas, entrar por código), criar sala, X1, amigos, convites e a sala atual (lobby com as
// configurações do dono, equipes, convidar amigos, expulsar, encerrar, iniciar).
import { MAPS, mapAllows } from '../maps/maps';
import { WEAPONS, BUY_CATEGORIES } from '../weapons/WeaponData';
import { rankName } from '../save/Profile';
import type { RoomInfo } from '../multiplayer/Protocol';
import type { NetClient, PublicRoom, SocialEvent } from '../multiplayer/NetClient';
import { esc } from './Hud';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export type OnlineTab = 'account' | 'play' | 'create' | 'x1' | 'friends' | 'invites' | 'room';

const MODE_NAME: Record<string, string> = { competitive: 'Desarme de bomba 5v5', casual: 'Casual', tdm: 'Mata-mata em equipe', x1: 'X1 (duelo)', br: 'Battle Royale', training: 'Treino' };
const STATUS_COLOR: Record<string, string> = { online: '#5ee08f', 'na sala': '#f2c14e', 'em partida': '#ff8a5c', offline: '#6c6a66' };

export class OnlineScreen {
  tab: OnlineTab = 'play';
  private rooms: PublicRoom[] = [];
  private room: RoomInfo | null = null;
  private notes: { kind: string; text: string; at: number }[] = [];
  private partyInvites: { id: string; from: string }[] = [];
  private busy = false;
  /** Rascunho do formulário de criação. */
  private draft: Record<string, unknown> = { mode: 'tdm', mapId: 'dust_zone', maxPlayers: 10, isPublic: false, bots: true, difficulty: 'normal', rounds: 5, primary: 'ak47', secondary: 'deagle', timeLimit: 10, killLimit: 50, password: '' };
  onBadge: (n: number) => void = () => {};
  onToast: (msg: string, ms?: number) => void = () => {};
  /** Endereço do servidor salvo nas configurações. */
  getServer: () => string = () => '';
  setServer: (v: string) => void = () => {};

  constructor(private getNet: () => NetClient | null, private ensureNet: () => Promise<NetClient>) {
    $('onlineScreen').addEventListener('click', e => void this.onClick(e));
    $('onlineScreen').addEventListener('change', e => this.onChange(e));
  }

  // ------------------------------------------------------------------ eventos da rede

  bind(net: NetClient): void {
    net.onSocial(e => this.onSocial(e));
  }

  private onSocial(e: SocialEvent): void {
    if (e.type === 'rooms') this.rooms = e.rooms;
    if (e.type === 'notify') {
      this.notes.unshift({ kind: e.kind, text: e.text, at: Date.now() });
      this.notes = this.notes.slice(0, 20);
      this.onToast(e.text);
    }
    if (e.type === 'invite') this.onToast(`${e.from} convidou você para uma partida (${MODE_NAME[e.mode ?? ''] ?? ''})`, 5000);
    if (e.type === 'party:invite') {
      this.partyInvites.push({ id: e.id, from: e.from });
      this.onToast(`${e.from} chamou você para o grupo`, 5000);
    }
    if (e.type === 'closed') {
      this.room = null;
      this.onToast(e.reason, 4000);
      if (this.tab === 'room') this.tab = 'play';
    }
    this.updateBadge();
    this.render();
  }

  setRoom(r: RoomInfo | null): void {
    this.room = r;
    if (r && this.tab !== 'room' && r.state === 'lobby') this.tab = 'room';
    this.render();
  }

  private updateBadge(): void {
    const n = this.getNet();
    const inc = n?.state?.friends.filter(f => f.state === 'incoming').length ?? 0;
    const inv = (n?.state?.invites.length ?? 0) + this.partyInvites.length;
    this.onBadge(inc + inv);
  }

  open(tab?: OnlineTab): void {
    const net = this.getNet();
    if (tab) this.tab = tab;
    if (!net?.loggedIn) this.tab = 'account';
    else if (!net.connected) void this.ensureNet().then(() => this.render()).catch(e => this.onToast((e as Error).message, 4000));
    if (this.tab === 'play') net?.sendSocial('rooms');
    this.render();
  }

  // ------------------------------------------------------------------ ações

  private onChange(e: Event): void {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    const k = t.dataset.draft;
    if (k) {
      const v = t instanceof HTMLInputElement && t.type === 'checkbox' ? t.checked : t instanceof HTMLInputElement && t.type === 'number' ? Number(t.value) : t.value;
      this.draft[k] = ['maxPlayers', 'rounds', 'timeLimit', 'killLimit'].includes(k) ? Number(v) : v === 'true' ? true : v === 'false' ? false : v;
      if (k === 'mode' && !mapAllows(MAPS[String(this.draft.mapId)], String(v))) this.draft.mapId = Object.keys(MAPS).find(id => mapAllows(MAPS[id], String(v))) ?? 'dust_zone';
      if (k === 'mode') this.draft.maxPlayers = v === 'br' ? 30 : v === 'x1' ? 2 : 10;
      this.render();
    }
    const s = t.dataset.rset;
    if (s) {
      // dono alterando a sala ao vivo
      const v = t instanceof HTMLInputElement && t.type === 'checkbox' ? t.checked : t instanceof HTMLInputElement && t.type === 'number' ? Number(t.value) : t.value;
      this.getNet()?.gameSend('settings', { [s]: ['maxPlayers', 'rounds', 'timeLimit', 'killLimit'].includes(s) ? Number(v) : v === 'true' ? true : v === 'false' ? false : v });
    }
    if (t.id === 'olServer') this.setServer(t.value.trim());
  }

  private async onClick(e: Event): Promise<void> {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-ol]');
    if (!el || this.busy) return;
    const act = el.dataset.ol!;
    const arg = el.dataset.arg ?? '';
    const net = this.getNet();
    const run = async (fn: () => Promise<unknown>) => {
      this.busy = true;
      try {
        await fn();
      } catch (err) {
        this.onToast((err as Error).message, 4000);
      } finally {
        this.busy = false;
        this.render();
      }
    };
    switch (act) {
      case 'tab':
        this.tab = arg as OnlineTab;
        if (this.tab === 'play') net?.sendSocial('rooms');
        return this.render();
      case 'login':
      case 'register': {
        const u = $<HTMLInputElement>('olUser').value.trim(), p = $<HTMLInputElement>('olPass').value;
        return run(async () => {
          const n = this.getNet();
          if (!n) throw new Error('Informe o endereço do servidor');
          if (act === 'login') await n.login(u, p);
          else await n.register(u, p);
          await this.ensureNet();
          this.tab = 'play';
          n.sendSocial('rooms');
          this.onToast(act === 'login' ? 'Bem-vindo de volta!' : 'Conta criada!');
        });
      }
      case 'logout':
        return run(async () => {
          await net?.logout();
          this.room = null;
          this.tab = 'account';
        });
      case 'connect':
        return run(() => this.ensureNet());
      case 'quick':
        return run(async () => {
          const n = await this.ensureNet();
          n.sendSocial('quick', { mode: arg });
          this.onToast('Procurando partida…');
        });
      case 'refresh':
        net?.sendSocial('rooms');
        return;
      case 'join':
        return run(async () => {
          const n = await this.ensureNet();
          const r = this.rooms.find(x => x.code === arg);
          const pw = r?.hasPassword ? prompt('Senha da sala') ?? '' : '';
          await n.joinGame(arg, { password: pw });
          this.tab = 'room';
        });
      case 'join-code':
        return run(async () => {
          const code = $<HTMLInputElement>('olCode').value.trim().toUpperCase();
          if (code.length < 4) throw new Error('Digite o código da sala');
          const n = await this.ensureNet();
          await n.joinGame(code, { password: $<HTMLInputElement>('olCodePass').value });
          this.tab = 'room';
        });
      case 'create':
      case 'create-x1': {
        const d = { ...this.draft };
        if (act === 'create-x1') {
          d.mode = 'x1';
          d.isPublic = false;
          d.maxPlayers = 2;
          d.bots = false;
        }
        const pw = String(d.password ?? '');
        delete d.password;
        return run(async () => {
          const n = await this.ensureNet();
          await n.createGame(d, pw);
          this.tab = 'room';
          this.onToast(`Sala criada${pw ? ' (com senha)' : ''}. Convide seus amigos!`);
        });
      }
      case 'team':
        net?.gameSend('team', { team: arg });
        return;
      case 'start':
        net?.gameSend('start');
        return;
      case 'leave':
        await net?.leaveGame();
        this.room = null;
        this.tab = 'play';
        return this.render();
      case 'close':
        if (confirm('Encerrar a sala para todos?')) net?.gameSend('close');
        return;
      case 'kick':
        net?.gameSend('kick', { userId: arg });
        return;
      case 'set-password': {
        const pw = prompt('Nova senha da sala (vazio = sem senha)') ?? null;
        if (pw !== null) net?.gameSend('settings', { password: pw });
        return;
      }
      case 'copy':
        void navigator.clipboard?.writeText(arg).then(() => this.onToast('Copiado: ' + arg));
        return;
      case 'friend-add': {
        const q = $<HTMLInputElement>('olFriend').value.trim();
        if (q) net?.sendSocial('friend:request', { query: q });
        return;
      }
      case 'friend-accept':
        net?.sendSocial('friend:accept', { userId: arg });
        return;
      case 'friend-decline':
        net?.sendSocial('friend:decline', { userId: arg });
        return;
      case 'friend-remove':
        if (confirm('Remover este amigo?')) net?.sendSocial('friend:remove', { userId: arg });
        return;
      case 'invite':
        if (!net?.game) return this.onToast('Crie ou entre numa sala primeiro');
        net.sendSocial('invite', { userId: arg });
        return;
      case 'party-invite':
        net?.sendSocial('party:invite', { userId: arg });
        return;
      case 'party-leave':
        net?.sendSocial('party:leave');
        return;
      case 'invite-accept':
      case 'invite-decline': {
        net?.sendSocial('invite:respond', { id: arg, accept: act === 'invite-accept' });
        if (net?.state) net.state.invites = net.state.invites.filter(i => i.id !== arg);
        this.updateBadge();
        return this.render();
      }
      case 'rematch':
        net?.gameSend('rematch');
        return;
      case 'party-accept':
        net?.sendSocial('party:accept', { id: arg });
        this.partyInvites = this.partyInvites.filter(i => i.id !== arg);
        this.updateBadge();
        return this.render();
    }
  }

  // ------------------------------------------------------------------ interface

  render(): void {
    const net = this.getNet();
    const logged = !!net?.loggedIn;
    const st = net?.state;
    const incoming = st?.friends.filter(f => f.state === 'incoming').length ?? 0;
    const invites = (st?.invites.length ?? 0) + this.partyInvites.length;
    const tabs: [OnlineTab, string, number][] = [
      ['play', 'JOGAR ONLINE', 0], ['create', 'CRIAR SALA', 0], ['x1', 'MODO X1', 0], ['friends', 'AMIGOS', incoming],
      ['invites', 'CONVITES', invites], ['room', 'SALA' + (net?.game ? ' ' + net.game.roomId : ''), 0], ['account', 'CONTA', 0]
    ];
    $('olTabs').innerHTML = tabs
      .filter(([id]) => logged || id === 'account')
      .map(([id, n, c]) => `<button class="tab ${this.tab === id ? 'on' : ''}" data-ol="tab" data-arg="${id}">${n}${c ? ` <em class="ol-badge">${c}</em>` : ''}</button>`)
      .join('');
    $('olStatus').innerHTML = logged
      ? `<span class="dot" style="background:${net!.connected ? '#5ee08f' : '#d96a5a'}"></span>${esc(st?.me.name ?? '')} · ${net!.connected ? `conectado · ${Math.round(net!.rtt) || '—'} ms` : esc(net!.status)}`
      : 'Faça login para jogar online';
    const body = $('olBody');
    // preserva o que está sendo digitado (e o foco) ao redesenhar
    const keep = new Map<string, string>();
    for (const el of body.querySelectorAll<HTMLInputElement>('input[id]')) keep.set(el.id, el.value);
    const focus = (document.activeElement as HTMLElement | null)?.id ?? '';
    const view = this.tab;
    if (!logged || this.tab === 'account') body.innerHTML = this.accountView();
    else if (this.tab === 'play') body.innerHTML = this.playView();
    else if (this.tab === 'create') body.innerHTML = this.createView(false);
    else if (this.tab === 'x1') body.innerHTML = this.createView(true);
    else if (this.tab === 'friends') body.innerHTML = this.friendsView();
    else if (this.tab === 'invites') body.innerHTML = this.invitesView();
    else body.innerHTML = this.roomView();
    if (view === this.lastView) {
      for (const [id, v] of keep) {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el && el.type !== 'password' && el.id !== 'olServer') el.value = v;
        else if (el && el.type === 'password') el.value = v;
      }
      if (focus) (document.getElementById(focus) as HTMLInputElement | null)?.focus();
    }
    this.lastView = view;
  }

  private lastView: OnlineTab | null = null;

  /** Só a linha de status (ping), sem redesenhar formulários. */
  renderStatus(): void {
    const net = this.getNet();
    if (!net?.loggedIn) return;
    $('olStatus').innerHTML = `<span class="dot" style="background:${net.connected ? '#5ee08f' : '#d96a5a'}"></span>${esc(net.state?.me.name ?? '')} · ${net.connected ? `conectado · ${Math.round(net.rtt) || '—'} ms` : esc(net.status)}`;
  }

  private accountView(): string {
    const net = this.getNet();
    const st = net?.state;
    const server = `<label class="ol-field">Servidor <input id="olServer" value="${esc(this.getServer())}" placeholder="https://seu-dominio.com.br ou http://192.168.0.10:8080" /></label>
      <p class="roadmap">Use o endereço do seu servidor (HTTPS/WSS em produção). Pelo navegador servido pelo próprio servidor pode deixar vazio.</p>`;
    if (net?.loggedIn && st)
      return `<div class="ol-card"><h3>${esc(st.me.name)}</h3><p>Seu código de amigo: <b class="ol-code">${st.me.code}</b> <button class="btn small" data-ol="copy" data-arg="${st.me.code}">COPIAR</button></p>
        <p>Nível ${st.me.level} · ${rankName(st.profile.mmr)} · ${st.profile.mmr} MMR · ${st.profile.wins} vitórias em ${st.profile.matches} partidas online</p>
        <button class="btn" data-ol="logout">SAIR DA CONTA</button></div>${server}`;
    if (net?.loggedIn) return `<div class="ol-card"><p>Conta salva neste aparelho.</p><button class="btn primary" data-ol="connect">CONECTAR</button> <button class="btn" data-ol="logout">SAIR DA CONTA</button></div>${server}`;
    return `<div class="ol-card ol-auth"><h3>ENTRAR</h3>
      <label class="ol-field">Nome de jogador <input id="olUser" maxlength="16" autocomplete="username" placeholder="3 a 16 caracteres" /></label>
      <label class="ol-field">Senha <input id="olPass" type="password" maxlength="128" autocomplete="current-password" placeholder="mínimo 6 caracteres" /></label>
      <div class="row"><button class="btn primary" data-ol="login">ENTRAR</button><button class="btn" data-ol="register">CRIAR CONTA</button></div>
      <p class="roadmap">A senha é enviada só ao servidor (protegida por HTTPS) e guardada com criptografia; o aparelho guarda apenas um token de sessão.</p></div>${server}`;
  }

  private playView(): string {
    const q = (mode: string, title: string, sub: string) => `<button class="ol-quick" data-ol="quick" data-arg="${mode}"><b>${title}</b><small>${sub}</small></button>`;
    const rooms = this.rooms.length
      ? this.rooms.map(r => `<button class="ol-room" data-ol="join" data-arg="${r.code}"><b>${r.code}</b><span>${esc(MODE_NAME[r.mode] ?? r.mode)} · ${esc(r.mapName ?? r.mapId)}</span><span>${r.clients}/${r.max} · ${r.state === 'lobby' ? 'no lobby' : 'em jogo'}${r.hasPassword ? ' · 🔒' : ''}${r.owner ? ' · ' + esc(r.owner) : ''}</span></button>`).join('')
      : '<p class="roadmap">Nenhuma sala pública agora. Use a partida rápida ou crie uma sala.</p>';
    return `<h4>PARTIDA RÁPIDA</h4><div class="ol-quicks">
        ${q('competitive', 'DESARME DE BOMBA 5v5', 'rodadas, economia, bomba')}${q('tdm', 'MATA-MATA 5v5', 'renascimento, 50 abates')}${q('br', 'BATTLE ROYALE', 'até 50 · humanos e bots')}${q('casual', 'CASUAL', 'partida mais curta')}
      </div>
      <h4>ENTRAR POR CÓDIGO</h4><div class="row ol-join"><input id="olCode" maxlength="5" placeholder="CÓDIGO" /><input id="olCodePass" type="password" maxlength="64" placeholder="senha (se tiver)" /><button class="btn primary" data-ol="join-code">ENTRAR</button></div>
      <h4>SALAS PÚBLICAS <button class="btn small" data-ol="refresh">ATUALIZAR</button></h4><div class="ol-rooms">${rooms}</div>`;
  }

  private weaponOptions(slot: 'primary' | 'secondary', cur: unknown): string {
    const ids = BUY_CATEGORIES.flatMap(c => c.items).filter(id => WEAPONS[id]?.slot === slot);
    return ids.map(id => `<option value="${id}" ${id === cur ? 'selected' : ''}>${WEAPONS[id].name}</option>`).join('');
  }

  private createView(x1: boolean): string {
    const d = this.draft;
    const mode = x1 ? 'x1' : String(d.mode);
    const maps = Object.values(MAPS).filter(m => mapAllows(m, mode)).map(m => `<option value="${m.id}" ${m.id === d.mapId ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
    const sel = (k: string, opts: [string, string][]) => `<select data-draft="${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(d[k]) === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
    const f = (label: string, html: string) => `<label class="ol-field">${label}${html}</label>`;
    const common = f('Mapa', `<select data-draft="mapId">${maps}</select>`) + f('Senha (opcional)', `<input data-draft="password" type="password" maxlength="64" value="${esc(String(d.password ?? ''))}" placeholder="sem senha" />`);
    if (x1)
      return `<div class="ol-card"><h3>DUELO X1</h3><p class="roadmap">Sala privada para dois jogadores: crie, convide um amigo (ou passe o código) e comece. Melhor de 2N−1 rodadas, mesmas armas para os dois, contagem regressiva a cada rodada e revanche no fim.</p>
        <div class="ol-form">${common}
        ${f('Rodadas para vencer', sel('rounds', [['1', '1'], ['2', '2 (melhor de 3)'], ['3', '3 (melhor de 5)'], ['5', '5 (melhor de 9)'], ['8', '8 (melhor de 15)']]))}
        ${f('Arma principal', `<select data-draft="primary">${this.weaponOptions('primary', d.primary)}</select>`)}
        ${f('Pistola', `<select data-draft="secondary">${this.weaponOptions('secondary', d.secondary)}</select>`)}</div>
        <button class="btn primary" data-ol="create-x1">CRIAR DUELO</button></div>`;
    const max = mode === 'br' ? 50 : 10;
    return `<div class="ol-card"><h3>CRIAR SALA</h3><div class="ol-form">
      ${f('Modo', sel('mode', [['competitive', 'Desarme de bomba 5v5'], ['casual', 'Casual'], ['tdm', 'Mata-mata em equipe'], ['br', 'Battle Royale'], ['x1', 'X1 (duelo)']]))}
      ${common}
      ${f(`Jogadores (máx. ${max})`, `<input data-draft="maxPlayers" type="number" min="2" max="${max}" value="${Number(d.maxPlayers)}" />`)}
      ${f('Visibilidade', sel('isPublic', [['false', 'Privada (só por código/convite)'], ['true', 'Pública (aparece na lista)']]))}
      ${mode !== 'x1' ? f('Completar com bots', sel('bots', [['true', 'Sim'], ['false', 'Não']])) + f('Dificuldade dos bots', sel('difficulty', [['easy', 'Fácil'], ['normal', 'Normal'], ['hard', 'Difícil']])) : ''}
      ${mode === 'tdm' ? f('Tempo (min)', `<input data-draft="timeLimit" type="number" min="3" max="30" value="${Number(d.timeLimit)}" />`) + f('Abates para vencer', `<input data-draft="killLimit" type="number" min="10" max="200" value="${Number(d.killLimit)}" />`) : ''}
      ${mode === 'tdm' || mode === 'x1' ? f('Arma principal', `<select data-draft="primary">${this.weaponOptions('primary', d.primary)}</select>`) + f('Pistola', `<select data-draft="secondary">${this.weaponOptions('secondary', d.secondary)}</select>`) : ''}
      ${mode === 'x1' ? f('Rodadas para vencer', `<input data-draft="rounds" type="number" min="1" max="15" value="${Number(d.rounds)}" />`) : ''}
      </div><button class="btn primary" data-ol="create">CRIAR SALA</button></div>`;
  }

  private friendsView(): string {
    const st = this.getNet()?.state;
    if (!st) return '<p class="roadmap">Conectando…</p>';
    const inGame = !!this.getNet()?.game;
    const row = (f: (typeof st.friends)[number]) => {
      const color = STATUS_COLOR[f.status] ?? '#6c6a66';
      const acts = f.state === 'incoming'
        ? `<button data-ol="friend-accept" data-arg="${f.id}">ACEITAR</button><button data-ol="friend-decline" data-arg="${f.id}">RECUSAR</button>`
        : f.state === 'outgoing'
          ? `<span class="ol-muted">pedido enviado</span><button data-ol="friend-decline" data-arg="${f.id}">CANCELAR</button>`
          : `${f.status !== 'offline' && inGame ? `<button data-ol="invite" data-arg="${f.id}">CONVIDAR</button>` : ''}${f.status !== 'offline' ? `<button data-ol="party-invite" data-arg="${f.id}">GRUPO</button>` : ''}<button data-ol="friend-remove" data-arg="${f.id}">✕</button>`;
      return `<div class="ol-friend"><span class="dot" style="background:${color}"></span><div><b>${esc(f.name)}</b><small>${f.state === 'accepted' ? f.status + (f.roomId ? ' · sala ' + f.roomId : '') : f.code}</small></div><div class="ol-acts">${acts}</div></div>`;
    };
    const acc = st.friends.filter(f => f.state === 'accepted').sort((a, b) => (a.status === 'offline' ? 1 : 0) - (b.status === 'offline' ? 1 : 0));
    const pend = st.friends.filter(f => f.state !== 'accepted');
    const party = st.party
      ? `<div class="ol-card"><h4>GRUPO (${st.party.members.length}/5)</h4>${st.party.members.map(m => `<div class="ol-friend"><span class="dot" style="background:${STATUS_COLOR[m.status] ?? '#666'}"></span><div><b>${esc(m.name)}</b><small>${m.id === st.party!.leader ? 'líder' : 'membro'} · ${m.status}</small></div></div>`).join('')}
         <p class="roadmap">Quando o líder entra numa sala, o grupo entra junto.</p><button class="btn small" data-ol="party-leave">SAIR DO GRUPO</button></div>`
      : '';
    return `<div class="row ol-join"><input id="olFriend" maxlength="32" placeholder="nome do jogador ou código OS-XXXXXX" /><button class="btn primary" data-ol="friend-add">ADICIONAR</button></div>
      <p class="roadmap">Seu código: <b class="ol-code">${st.me.code}</b></p>
      ${party}
      ${pend.length ? `<h4>PEDIDOS</h4>${pend.map(row).join('')}` : ''}
      <h4>AMIGOS (${acc.length})</h4>${acc.length ? acc.map(row).join('') : '<p class="roadmap">Adicione amigos pelo nome ou pelo código.</p>'}`;
  }

  private invitesView(): string {
    const net = this.getNet();
    const inv = net?.state?.invites ?? [];
    const list = inv.map(i => `<div class="ol-friend"><span class="dot" style="background:#f2c14e"></span><div><b>${esc(i.from)}</b><small>convidou você para a sala ${i.roomId}</small></div><div class="ol-acts"><button data-ol="invite-accept" data-arg="${i.id}">ACEITAR</button><button data-ol="invite-decline" data-arg="${i.id}">RECUSAR</button></div></div>`).join('');
    const party = this.partyInvites.map(i => `<div class="ol-friend"><span class="dot" style="background:#7ab8ff"></span><div><b>${esc(i.from)}</b><small>chamou você para o grupo</small></div><div class="ol-acts"><button data-ol="party-accept" data-arg="${i.id}">ACEITAR</button></div></div>`).join('');
    const notes = this.notes.map(n => `<div class="ol-note"><small>${new Date(n.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small> ${esc(n.text)}</div>`).join('');
    return `<h4>CONVITES RECEBIDOS</h4>${list || party ? list + party : '<p class="roadmap">Nenhum convite agora.</p>'}<h4>NOTIFICAÇÕES</h4>${notes || '<p class="roadmap">Nada por aqui.</p>'}`;
  }

  private roomView(): string {
    const net = this.getNet();
    const r = this.room;
    if (!net?.game || !r) return '<p class="roadmap">Você não está numa sala. Crie uma, entre por código ou aceite um convite.</p>';
    const s = r.settings;
    const owner = r.owner === net.clientId;
    const meUser = net.clientId;
    const playerRow = (p: RoomInfo['players'][number]) => `<li class="${p.userId === meUser ? 'me' : ''}">${esc(p.name)} <small>${p.bot ? 'BOT' : rankName(p.mmr)}${p.connected ? '' : ' (caiu)'}${p.userId === r.owner ? ' · dono' : ''}</small>${owner && p.userId && p.userId !== meUser && r.state === 'lobby' ? `<button class="ol-x" data-ol="kick" data-arg="${p.userId}" title="Remover">✕</button>` : ''}</li>`;
    const teams = s?.mode === 'br'
      ? `<div class="lobby-team"><h3>PARTICIPANTES (${r.players.length}/${s.maxPlayers})</h3><ul>${r.players.map(playerRow).join('')}</ul></div>`
      : (['T', 'CT'] as const).map(t => `<div class="lobby-team ${t === 'T' ? 't' : 'ct'}"><h3>${t === 'T' ? 'TERRORISTAS' : 'CONTRATERRORISTAS'}</h3><ul>${r.players.filter(p => p.team === t).map(playerRow).join('') || '<li class="empty">— vazio —</li>'}</ul>${r.state === 'lobby' ? `<button class="btn small" data-ol="team" data-arg="${t}">ENTRAR NOS ${t === 'T' ? 'TR' : 'CT'}</button>` : ''}</div>`).join('');
    const opt = (k: string, opts: [string, string][], cur: unknown) => owner && r.state === 'lobby'
      ? `<select data-rset="${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(cur) === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`
      : `<b>${esc(opts.find(o => o[0] === String(cur))?.[1] ?? String(cur))}</b>`;
    const maps = Object.values(MAPS).filter(m => !s || mapAllows(m, s.mode)).map(m => [m.id, m.name] as [string, string]);
    const friendsOnline = net.state?.friends.filter(f => f.state === 'accepted' && f.status !== 'offline' && f.roomId !== r.code) ?? [];
    const rematch = r.state === 'over' && s?.mode === 'x1' ? `<button class="btn primary" data-ol="rematch">REVANCHE (${r.rematch?.length ?? 0}/2)</button>` : '';
    return `<div class="ol-roomhead"><h3>SALA <b class="ol-code" data-ol="copy" data-arg="${r.code}">${r.code}</b> ${r.hasPassword ? '🔒' : ''}</h3><span>${r.isPublic ? 'Pública' : 'Privada'} · dono: ${esc(r.ownerName || 'servidor')} · ${r.state === 'lobby' ? r.countdown > 0 ? `começa em ${r.countdown}s` : 'aguardando' : r.state === 'playing' ? 'em jogo' : 'encerrada'}</span></div>
      ${s ? `<div class="ol-settings">
        <label>Modo ${opt('mode', [['competitive', 'Desarme 5v5'], ['casual', 'Casual'], ['tdm', 'Mata-mata'], ['br', 'Battle Royale'], ['x1', 'X1']], s.mode)}</label>
        <label>Mapa ${opt('mapId', maps, s.mapId)}</label>
        <label>Jogadores ${owner && r.state === 'lobby' ? `<input type="number" data-rset="maxPlayers" min="2" max="${s.mode === 'br' ? 50 : 10}" value="${s.maxPlayers}" />` : `<b>${s.maxPlayers}</b>`}</label>
        <label>Visibilidade ${opt('isPublic', [['false', 'Privada'], ['true', 'Pública']], s.isPublic)}</label>
        ${s.mode !== 'x1' ? `<label>Bots ${opt('bots', [['true', 'Sim'], ['false', 'Não']], s.bots)}</label><label>Dificuldade ${opt('difficulty', [['easy', 'Fácil'], ['normal', 'Normal'], ['hard', 'Difícil']], s.difficulty)}</label>` : ''}
        ${s.mode === 'x1' ? `<label>Rodadas ${owner && r.state === 'lobby' ? `<input type="number" data-rset="rounds" min="1" max="15" value="${s.rounds}" />` : `<b>${s.rounds}</b>`}</label>` : ''}
        ${s.mode === 'x1' || s.mode === 'tdm' ? `<label>Armas ${owner && r.state === 'lobby' ? `<select data-rset="primary">${this.weaponOptions('primary', s.primary)}</select><select data-rset="secondary">${this.weaponOptions('secondary', s.secondary)}</select>` : `<b>${WEAPONS[s.primary]?.name} + ${WEAPONS[s.secondary]?.name}</b>`}</label>` : ''}
        ${owner && r.state === 'lobby' ? '<button class="btn small" data-ol="set-password">SENHA…</button>' : ''}
      </div>` : ''}
      <div class="lobby">${teams}</div>
      ${friendsOnline.length && r.state !== 'over' ? `<h4>CONVIDAR AMIGOS</h4><div class="ol-chips">${friendsOnline.map(f => `<button class="ol-chip" data-ol="invite" data-arg="${f.id}">+ ${esc(f.name)}</button>`).join('')}</div>` : ''}
      <div class="row ol-roomacts">
        <button class="btn" data-ol="leave">SAIR DA SALA</button>
        ${owner && r.state === 'lobby' ? `<button class="btn" data-ol="close">ENCERRAR SALA</button><button class="btn primary" data-ol="start">INICIAR PARTIDA</button>` : ''}
        ${rematch}
      </div>`;
  }
}
