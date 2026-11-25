// HUD de jogo: joystick (inferior esquerdo), botão de interação contextual (inferior direito),
// celular e inventário (acima dele), menu (superior direito), nome + dia/hora (superior esquerdo).
import { h, esc } from './dom.js';
import { bus } from '../core/EventBus.js';
import { game } from '../core/GameState.js';
import { VirtualJoystick } from '../controls/VirtualJoystick.js';
import { audio } from '../audio/AudioManager.js';

export class HUD {
  constructor(ui) {
    this.ui = ui;
    this.el = h(`<div id="hud" class="hidden">
      <div class="chip"><b class="h-name"></b><br><span class="h-time"></span></div>
      <button id="btn-menu" class="hbtn" aria-label="Menu">☰</button>
      <div class="side">
        <button id="btn-phone" class="hbtn" aria-label="Celular">📱<span class="badge hidden">!</span></button>
        <button id="btn-bag" class="hbtn" aria-label="Inventário">🎒<span class="badge hidden">!</span></button>
      </div>
      <button id="btn-act" aria-label="Interagir"><i></i><span></span></button>
    </div>`);
    ui.root.appendChild(this.el);
    this.joystick = new VirtualJoystick(this.el);
    this.act = this.el.querySelector('#btn-act');
    // pointerdown = resposta imediata ao toque
    this.act.addEventListener('pointerdown', (e) => { e.preventDefault(); bus.emit('ui:interact'); });
    this.el.querySelector('#btn-menu').addEventListener('click', () => { audio.sfx('open'); ui.openPause(); });
    this.el.querySelector('#btn-phone').addEventListener('click', () => { audio.sfx('open'); this.badge('phone', false); ui.openPhone(); });
    this.el.querySelector('#btn-bag').addEventListener('click', () => { audio.sfx('open'); this.badge('bag', false); ui.openInventory(); });
    bus.on('hud:context', (t) => this.setContext(t));
    bus.on('time:changed', () => this.refresh());
    bus.on('phone:contact', () => this.badge('phone', true));
    bus.on('inventory:added', (_id, item) => { this.badge('bag', true); ui.toast(`${item?.icon || ''} ${item?.name || ''} adicionado ao inventário`); });
    bus.on('phone:contact', (id) => ui.toast(`📱 Novo contato salvo no celular`));
  }

  badge(which, on) { this.el.querySelector(`#btn-${which} .badge`).classList.toggle('hidden', !on); }

  setContext(t) {
    if (t) {
      this.act.querySelector('i').textContent = t.icon || '✋';
      this.act.querySelector('span').textContent = t.label;
      this.act.classList.add('show');
    } else this.act.classList.remove('show');
  }

  refresh() {
    if (!game.state) return;
    this.el.querySelector('.h-name').textContent = game.p.displayName;
    const per = game.period();
    this.el.querySelector('.h-time').textContent = `Dia ${game.state.time.day} · ${game.clockText()} · ${per[0].toUpperCase()}${per.slice(1)}`;
  }

  show() { this.refresh(); this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); this.joystick.reset(); this.setContext(null); }
  /** Durante diálogos: some com os controles para não cobrir nada. */
  setControlsVisible(v) {
    ['.side', '#btn-menu', '.joystick', '.chip'].forEach((s) => { this.el.querySelector(s).style.visibility = v ? '' : 'hidden'; });
    if (!v) { this.joystick.reset(); this.act.classList.remove('show'); }
  }
}
