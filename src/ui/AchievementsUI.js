// =============================================================
// EXTREME RACING — AchievementsUI
// Lista de conquistas com progresso e recompensa.
// =============================================================
import { h } from './dom.js';
import { ACHIEVEMENTS } from '../systems/Achievements.js';

export class AchievementsUI {
  constructor(game) {
    this.game = game;
  }

  show(onBack) {
    const ach = this.game.achievements;
    const grid = h('div', { class: 'ach-grid' }, ...ACHIEVEMENTS.map((a) => {
      const done = ach.isUnlocked(a.id);
      const prog = a.goal && !done ? ` (${ach.progress(a.id)}/${a.goal})` : '';
      return h('div', { class: `ach${done ? ' done' : ''}` },
        h('div', { class: 'medal' }, done ? '✓' : ''),
        h('div', {}, h('b', {}, a.title), h('span', {}, a.desc + prog)),
        h('em', {}, `${a.reward.toLocaleString('pt-BR')} CR`));
    }));
    this.el = h('div', { class: 'screen full' },
      h('div', { class: 'topbar' },
        h('button', { class: 'back-btn', onclick: () => { this.game.audio.ui(); this.close(); onBack?.(); } }, '‹ VOLTAR'),
        h('h1', { class: 'title' }, 'CONQUIS', h('em', {}, 'TAS')),
        h('div', { class: 'spacer' }),
        h('div', { class: 'label', style: { fontSize: '2.2vh' } }, `${ach.count} de ${ach.total} desbloqueadas`)),
      grid);
    this.game.uiRoot.appendChild(this.el);
  }

  close() {
    this.el?.remove();
    this.el = null;
  }
}
