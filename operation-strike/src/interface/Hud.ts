// HUD de FPS competitivo.
import type { MapRuntime } from '../maps/MapRuntime';
import { Radar, type RadarDot } from './Radar';
import type { PlayerView, RoundView, Team } from '../sim/types';
import { WEAPONS } from '../weapons/WeaponData';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export const SLOT_LABEL: Record<string, string> = { primary: '1', secondary: '2', knife: '3', he: '4', flash: '4', smoke: '4', c4: '5' };

export class Hud {
  private root = $('hud');
  private radar: Radar | null = null;
  private last: Record<string, string> = {};
  private toastTimer = 0;
  private bannerTimer = 0;
  private hitTimer = 0;
  private dmgTimer = 0;
  private feed: { el: HTMLElement; t: number }[] = [];
  private tags: HTMLElement[] = [];

  show(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
    // o botão de pausa fica fora do HUD, acima dos controles de toque
    $('btnPause').classList.toggle('hidden', !v);
  }

  setMap(map: MapRuntime): void {
    this.radar = new Radar($('radar') as HTMLCanvasElement, map);
  }

  private text(id: string, value: string): void {
    if (this.last[id] === value) return;
    this.last[id] = value;
    $(id).textContent = value;
  }

  private toggle(id: string, show: boolean): void {
    const key = id + ':vis';
    const v = show ? '1' : '0';
    if (this.last[key] === v) return;
    this.last[key] = v;
    $(id).classList.toggle('hidden', !show);
  }

  setVitals(hp: number, armor: number, helmet: boolean, kit: boolean, c4: boolean, money: number): void {
    this.text('hudHealth', String(Math.max(0, Math.ceil(hp))));
    this.text('hudArmor', String(Math.ceil(armor)));
    this.toggle('hudHelmet', helmet);
    this.toggle('hudKit', kit);
    this.toggle('hudC4', c4);
    this.text('hudMoney', '$ ' + money);
    $('hudHealth').classList.toggle('low', hp <= 25);
  }

  setAmmo(weaponId: string, ammo: number, reserve: number, reloading: boolean, slots: { slot: string; id: string; ammo: number }[], active: string): void {
    const def = WEAPONS[weaponId];
    this.text('hudWeapon', def?.name.toUpperCase() ?? '');
    const showAmmo = def && (def.magazine > 0 || def.cls === 'grenade');
    this.text('hudAmmo', !showAmmo ? '—' : reloading ? '··' : String(ammo));
    this.text('hudReserve', def && def.magazine > 0 ? '/ ' + reserve : def?.cls === 'grenade' ? 'x' : '');
    $('hudAmmo').classList.toggle('low', !!def && def.magazine > 0 && ammo <= Math.ceil(def.magazine * 0.2));
    const key = slots.map(s => s.slot + s.id + (s.slot === active ? '*' : '')).join(',');
    if (this.last.slots !== key) {
      this.last.slots = key;
      $('hudSlots').innerHTML = slots
        .map(s => `<span class="${s.slot === active ? 'on' : ''}"><i>${SLOT_LABEL[s.slot]}</i>${WEAPONS[s.id]?.name ?? s.id}${WEAPONS[s.id]?.cls === 'grenade' ? ' x' + s.ammo : ''}</span>`)
        .join('');
    }
  }

  setRound(r: RoundView, bombPlanted: boolean): void {
    const t = Math.max(0, r.timeLeft);
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    this.text('hudTimer', r.mode === 'training' ? 'TREINO' : `${m}:${s.toString().padStart(2, '0')}`);
    $('hudTimer').classList.toggle('urgent', bombPlanted || (r.phase === 'live' && t < 10));
    const phase = r.phase === 'freeze' ? 'COMPRA' : r.phase === 'end' ? (r.mode === 'tdm' ? 'FIM DA PARTIDA' : 'FIM DA RODADA') : r.phase === 'over' ? 'FIM DE JOGO' : r.mode === 'tdm' ? `META ${r.winRounds} ABATES` : `RODADA ${r.number}/${r.maxRounds}`;
    this.text('hudRound', r.mode === 'training' ? 'LIVRE' : phase);
    this.text('scoreT', String(r.scoreT));
    this.text('scoreCT', String(r.scoreCT));
    this.toggle('bombIcon', bombPlanted);
  }

  setAlive(players: PlayerView[]): void {
    for (const team of ['T', 'CT'] as Team[]) {
      const list = players.filter(p => p.team === team);
      const key = list.map(p => (p.alive ? '1' : '0') + Math.round(p.hp / 10)).join('');
      if (this.last['alive' + team] === key) continue;
      this.last['alive' + team] = key;
      $('alive' + team).innerHTML = list.map(p => `<i class="${p.alive ? '' : 'dead'}" title="${p.name}"><b style="height:${p.alive ? p.hp : 0}%"></b></i>`).join('');
    }
  }

  setZone(name: string): void {
    this.text('hudZone', name);
  }

  setFps(v: number | null): void {
    this.toggle('hudFps', v !== null);
    if (v !== null) this.text('hudFps', Math.round(v) + ' FPS');
  }

  setNet(text: string | null): void {
    this.toggle('netInfo', !!text);
    if (text) this.text('netInfo', text);
  }

  setPrompt(text: string | null): void {
    this.toggle('hudPrompt', !!text);
    if (text) this.text('hudPrompt', text);
  }

  setBuyHint(text: string | null): void {
    this.toggle('buyHint', !!text);
    if (text) this.text('buyHint', text);
  }

  setProgress(label: string | null, v: number): void {
    this.toggle('progress', !!label);
    if (!label) return;
    this.text('progressLabel', label);
    $('progressFill').style.width = Math.round(Math.min(1, v) * 100) + '%';
  }

  setSpectate(name: string | null): void {
    this.toggle('spectate', !!name);
    if (name) this.text('spectate', 'ASSISTINDO: ' + name);
  }

  setCrosshair(gapPx: number, color: string, hidden: boolean): void {
    const c = $('crosshair');
    c.style.setProperty('--gap', gapPx.toFixed(1) + 'px');
    c.style.setProperty('--cross-color', color);
    this.toggle('crosshair', !hidden);
  }

  setScope(on: boolean): void {
    this.toggle('scopeOverlay', on);
  }

  setFlash(v: number): void {
    const o = Math.max(0, Math.min(1, v)).toFixed(2);
    if (this.last.flash !== o) {
      this.last.flash = o;
      $('flashOverlay').style.opacity = o;
    }
  }

  hit(head: boolean): void {
    const el = $('hitmarker');
    el.classList.toggle('head', head);
    el.classList.add('on');
    this.hitTimer = 0.18;
  }

  damage(angle: number): void {
    const el = $('damageDir');
    el.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    el.classList.add('on');
    $('damageOverlay').classList.add('on');
    this.dmgTimer = 0.6;
  }

  message(text: string, seconds = 2.5): void {
    $('hudToast').textContent = text;
    $('hudToast').classList.remove('hidden');
    this.toastTimer = seconds;
  }

  banner(title: string, sub: string, cls: string, seconds = 4): void {
    $('bannerTitle').textContent = title;
    $('bannerSub').textContent = sub;
    const b = $('banner');
    b.className = 'banner ' + cls;
    this.bannerTimer = seconds;
  }

  kill(killer: string | null, killerTeam: Team | null, victim: string, victimTeam: Team, weapon: string, hs: boolean, local: boolean): void {
    const el = document.createElement('div');
    el.className = 'kf' + (local ? ' local' : '');
    const w = WEAPONS[weapon]?.name ?? (weapon === 'c4' ? 'Bomba' : weapon);
    el.innerHTML = `${killer ? `<b class="${killerTeam}">${esc(killer)}</b>` : ''}<span class="w">${esc(w)}${hs ? ' ◎' : ''}</span><b class="${victimTeam}">${esc(victim)}</b>`;
    $('killfeed').prepend(el);
    this.feed.unshift({ el, t: 6 });
    while (this.feed.length > 5) this.feed.pop()!.el.remove();
  }

  private radioFeed: { el: HTMLElement; t: number }[] = [];

  /** Mensagem de rádio de um companheiro (bots avisam posições, recuos, abates). */
  radio(name: string, team: Team, text: string): void {
    let box = document.getElementById('radioFeed');
    if (!box) {
      box = document.createElement('div');
      box.id = 'radioFeed';
      box.className = 'radio-feed';
      $('killfeed').parentElement!.appendChild(box);
    }
    const el = document.createElement('div');
    el.innerHTML = `<b class="${team}">📻 ${esc(name)}:</b> ${esc(text)}`;
    box.appendChild(el);
    this.radioFeed.push({ el, t: 5 });
    while (this.radioFeed.length > 4) this.radioFeed.shift()!.el.remove();
  }

  /** Nomes sobre os companheiros (posições de tela já calculadas). */
  setTags(tags: { x: number; y: number; name: string; hp: number; team?: string }[]): void {
    const box = $('nameTags');
    while (this.tags.length < tags.length) {
      const el = document.createElement('div');
      el.className = 'tag';
      box.appendChild(el);
      this.tags.push(el);
    }
    this.tags.forEach((el, i) => {
      const t = tags[i];
      if (!t) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      el.style.transform = `translate(${t.x.toFixed(0)}px, ${t.y.toFixed(0)}px) translate(-50%, -100%)`;
      const txt = `${t.name}`;
      if (el.dataset.txt !== txt) {
        el.dataset.txt = txt;
        el.innerHTML = `<span>${esc(txt)}</span><i>▼</i>`;
      }
      el.classList.toggle('ct', t.team === 'CT');
    });
  }

  update(dt: number, x: number, z: number, yaw: number, dots: RadarDot[]): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) $('hudToast').classList.add('hidden');
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) $('banner').classList.add('hidden');
    }
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) $('hitmarker').classList.remove('on');
    }
    if (this.dmgTimer > 0) {
      this.dmgTimer -= dt;
      if (this.dmgTimer <= 0) {
        $('damageDir').classList.remove('on');
        $('damageOverlay').classList.remove('on');
      }
    }
    for (const f of this.feed) {
      f.t -= dt;
      if (f.t <= 0) f.el.remove();
    }
    this.feed = this.feed.filter(f => f.t > 0);
    for (const f of this.radioFeed) if ((f.t -= dt) <= 0) f.el.remove();
    this.radioFeed = this.radioFeed.filter(f => f.t > 0);
    this.radar?.draw(x, z, yaw, dots);
  }

  clearFeed(): void {
    for (const f of this.feed) f.el.remove();
    this.feed = [];
    for (const f of this.radioFeed) f.el.remove();
    this.radioFeed = [];
  }
}

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
