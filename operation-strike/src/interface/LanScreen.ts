// Tela WI-FI LOCAL: jogar com amigos na mesma rede (Wi-Fi da casa ou roteador de um dos celulares), sem internet.
// Anfitrião: escolhe modo/mapa/armas, abre a sala e mostra o IP; a partida roda no aparelho dele.
// Convidado: digita o IP do anfitrião e entra.
import { MAPS, mapAllows } from '../maps/maps';
import { WEAPONS, BUY_CATEGORIES } from '../weapons/WeaponData';
import { OnlineSession, type Session } from '../core/Session';
import { LanHost, LAN_PORT } from '../multiplayer/lan/LanHost';
import { LanClient } from '../multiplayer/lan/LanClient';
import { canHost, clientUrl } from '../multiplayer/lan/LanTransport';
import { Storage } from '../save/Storage';
import type { Team } from '../sim/types';
import { esc } from './Hud';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const MODE: Record<string, string> = { x1: 'X1 (duelo)', tdm: 'Mata-mata em equipe', competitive: 'Desarme de bomba 5v5', casual: 'Casual' };

export class LanScreen {
  host: LanHost | null = null;
  client: LanClient | null = null;
  getName: () => string = () => 'Jogador';
  getSkins: () => Record<string, string> = () => ({});
  getTeam: () => Team = () => 'T';
  prepareMap: (mapId: string) => Promise<void> = async () => {};
  onLaunch: (s: Session) => void = () => {};
  onToast: (m: string, ms?: number) => void = () => {};

  constructor() {
    $('lanScreen').addEventListener('click', e => void this.onClick(e));
    $('lanScreen').addEventListener('change', e => this.onChange(e));
  }

  open(): void {
    this.render();
  }

  private onChange(e: Event): void {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    const k = t.dataset.lset;
    if (!k || !this.host) return;
    const v = t instanceof HTMLInputElement && t.type === 'number' ? Number(t.value) : t.value === 'true' ? true : t.value === 'false' ? false : t.value;
    this.host.setSettings({ [k]: v } as never);
    this.render();
  }

  private async onClick(e: Event): Promise<void> {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-lan]');
    if (!el) return;
    const act = el.dataset.lan!;
    try {
      switch (act) {
        case 'host': {
          if (!canHost()) return this.onToast('Hospedar a sala só funciona no app Android (no navegador, entre como convidado).', 5000);
          this.host = new LanHost(this.getName(), this.getTeam(), this.getSkins());
          this.host.onChange = () => this.render();
          this.host.onNotice = m => this.onToast(m);
          await this.host.open();
          this.render();
          return;
        }
        case 'join': {
          const ip = $<HTMLInputElement>('lanIp').value.trim();
          if (!ip) return this.onToast('Digite o IP mostrado no celular do anfitrião');
          Storage.save('lanIp', ip);
          const c = new LanClient(this.getName(), this.getSkins());
          c.onLobby = () => this.render();
          c.onClosed = r => {
            this.onToast(r, 4000);
            this.client = null;
            this.render();
          };
          c.on(m => {
            if (m.t === 'start') {
              void this.prepareMap(m.mapId).then(() => {
                const sess = new OnlineSession(c, m.mapId, m.mode, m.you);
                sess.lan = true;
                this.onLaunch(sess);
              });
            } else if (m.t === 'error') this.onToast(m.msg);
          });
          const [host, port] = ip.includes(':') ? ip.split(':') : [ip, String(LAN_PORT)];
          await c.connect(clientUrl(host, Number(port) || LAN_PORT));
          this.client = c;
          this.render();
          return;
        }
        case 'start': {
          if (!this.host) return;
          await this.prepareMap(this.host.settings.mapId);
          this.onLaunch(this.host.start());
          return;
        }
        case 'team':
          if (this.host) this.host.setTeam(el.dataset.id!, el.dataset.team as Team);
          else this.client?.send({ t: 'team', team: el.dataset.team as Team });
          return this.render();
        case 'close':
          await this.host?.close();
          this.host = null;
          return this.render();
        case 'leave':
          this.client?.close();
          this.client = null;
          return this.render();
      }
    } catch (err) {
      this.onToast((err as Error).message, 5000);
    }
  }

  private weaponOptions(slot: 'primary' | 'secondary', cur: string): string {
    return BUY_CATEGORIES.flatMap(c => c.items).filter(id => WEAPONS[id]?.slot === slot).map(id => `<option value="${id}" ${id === cur ? 'selected' : ''}>${WEAPONS[id].name}</option>`).join('');
  }

  render(): void {
    const body = $('lanBody');
    if (this.host?.running) {
      const h = this.host, s = h.settings;
      const sel = (k: string, opts: [string, string][], cur: unknown) => `<select data-lset="${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(cur) === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
      const maps = Object.values(MAPS).filter(m => mapAllows(m, s.mode)).map(m => [m.id, m.name] as [string, string]);
      const ip = h.ips.length ? h.ips.join(' ou ') : 'IP não encontrado — confira o Wi-Fi/roteador';
      const row = (p: (typeof h.players)[number]) => `<li>${esc(p.name)}${p.host ? ' <small>anfitrião</small>' : ''}${s.mode !== 'x1' ? `<button class="ol-x" data-lan="team" data-id="${p.id}" data-team="${p.team === 'T' ? 'CT' : 'T'}">trocar</button>` : ''}</li>`;
      body.innerHTML = `<div class="ol-card"><h3>SALA ABERTA</h3>
        <p>Peça para o amigo abrir <b>Wi-Fi local → Entrar</b> e digitar: <b class="ol-code">${esc(ip)}</b></p>
        <p class="roadmap">Os dois precisam estar na mesma rede (mesmo Wi-Fi, ou um celular com o roteador ligado e o outro conectado nele). Não usa internet.</p></div>
        <div class="ol-settings">
          <label>Modo ${sel('mode', [['x1', 'X1 (duelo)'], ['tdm', 'Mata-mata'], ['competitive', 'Desarme 5v5'], ['casual', 'Casual']], s.mode)}</label>
          <label>Mapa ${sel('mapId', maps, s.mapId)}</label>
          ${s.mode === 'x1' ? `<label>Rodadas <input type="number" data-lset="rounds" min="1" max="15" value="${s.rounds}" /></label>` : `<label>Jogadores <input type="number" data-lset="maxPlayers" min="2" max="10" value="${s.maxPlayers}" /></label><label>Bots ${sel('bots', [['true', 'Completar com bots'], ['false', 'Sem bots']], s.bots)}</label><label>Dificuldade ${sel('difficulty', [['easy', 'Fácil'], ['normal', 'Normal'], ['hard', 'Difícil']], s.difficulty)}</label>`}
          ${s.mode === 'x1' || s.mode === 'tdm' ? `<label>Armas <select data-lset="primary">${this.weaponOptions('primary', s.primary)}</select><select data-lset="secondary">${this.weaponOptions('secondary', s.secondary)}</select></label>` : ''}
        </div>
        <div class="lobby">${(['T', 'CT'] as Team[]).map(t => `<div class="lobby-team ${t === 'T' ? 't' : 'ct'}"><h3>${t === 'T' ? 'TERRORISTAS' : 'CONTRATERRORISTAS'}</h3><ul>${h.players.filter(p => p.team === t).map(row).join('') || '<li class="empty">— vazio —</li>'}</ul></div>`).join('')}</div>
        <div class="row ol-roomacts"><button class="btn" data-lan="close">FECHAR SALA</button><button class="btn primary" data-lan="start" ${h.session ? 'disabled' : ''}>${h.session ? 'PARTIDA EM ANDAMENTO' : 'INICIAR PARTIDA'}</button></div>`;
      return;
    }
    if (this.client?.connected) {
      const c = this.client, s = c.settings;
      body.innerHTML = `<div class="ol-card"><h3>CONECTADO AO ANFITRIÃO</h3><p>${s ? `${MODE[s.mode] ?? s.mode} · ${esc(MAPS[s.mapId]?.name ?? s.mapId)}${s.mode === 'x1' ? ` · primeiro a ${s.rounds}` : ''}` : ''}</p>
        <p class="roadmap">Aguardando o anfitrião iniciar a partida…</p></div>
        <div class="lobby">${(['T', 'CT'] as Team[]).map(t => `<div class="lobby-team ${t === 'T' ? 't' : 'ct'}"><h3>${t === 'T' ? 'TERRORISTAS' : 'CONTRATERRORISTAS'}</h3><ul>${c.players.filter(p => p.team === t).map(p => `<li class="${p.id === c.you ? 'me' : ''}">${esc(p.name)}${p.host ? ' <small>anfitrião</small>' : ''}</li>`).join('') || '<li class="empty">— vazio —</li>'}</ul>${s?.mode !== 'x1' ? `<button class="btn small" data-lan="team" data-team="${t}">ENTRAR NOS ${t === 'T' ? 'TR' : 'CT'}</button>` : ''}</div>`).join('')}</div>
        <div class="row ol-roomacts"><button class="btn" data-lan="leave">SAIR</button></div>`;
      return;
    }
    const native = canHost();
    body.innerHTML = `<p class="roadmap">Jogue com amigos por perto sem internet: os dois no mesmo Wi-Fi, ou um celular liga o <b>roteador (ponto de acesso)</b> e o outro se conecta nele.</p>
      <div class="ol-quicks">
        <div class="ol-card"><h3>CRIAR SALA</h3><p class="roadmap">Seu celular hospeda a partida (X1, mata-mata ou 5v5 com bots).</p>
          <button class="btn primary" data-lan="host" ${native ? '' : 'disabled'}>CRIAR SALA</button>${native ? '' : '<p class="roadmap">Disponível no app Android.</p>'}</div>
        <div class="ol-card"><h3>ENTRAR NA SALA</h3><p class="roadmap">Digite o IP que aparece no celular do anfitrião.</p>
          <div class="row ol-join"><input id="lanIp" placeholder="ex.: 192.168.43.1" value="${esc(Storage.load<string>('lanIp', ''))}" /><button class="btn primary" data-lan="join">ENTRAR</button></div></div>
      </div>`;
  }
}
