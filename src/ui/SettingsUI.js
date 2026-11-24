// =============================================================
// EXTREME RACING — SettingsUI
// Gráficos (Auto/Baixo/Médio/Alto/Ultra), controles (volante,
// setas ou inclinação; sensibilidade), assistências (ABS, TC,
// estabilidade, câmbio), câmera, horário/clima e áudio.
// =============================================================
import { h, clear, toast } from './dom.js';
import { PRESETS, PRESET_ORDER } from '../systems/GraphicsSettings.js';
import { MobileControls } from './MobileControls.js';
import { AI_DIFFICULTY } from '../ai/RacingAI.js';

export class SettingsUI {
  constructor(game) {
    this.game = game;
    this.root = game.uiRoot;
  }

  click() { this.game.audio.unlock(); this.game.audio.ui(); }

  show(onClose, { overlay = false } = {}) {
    this.onClose = onClose;
    this.el = h('div', { class: overlay ? 'modal' : 'screen full' });
    this.root.appendChild(this.el);
    this.overlay = overlay;
    this.render();
  }

  close() {
    this.el?.remove();
    this.el = null;
    this.onClose?.();
  }

  render() {
    const g = this.game;
    const s = g.save.settings;
    const set = (k, v) => { g.save.setSetting(k, v); this.render(); };
    const seg = (key, items) => {
      const el = h('div', { class: 'seg' });
      for (const [k, label] of items) el.appendChild(h('button', { class: s[key] === k ? 'on' : '', onclick: () => { this.click(); set(key, k); this._after(key, k); } }, label));
      return el;
    };
    const toggle = (key) => seg(key, [[true, 'Ligado'], [false, 'Desligado']]);
    const slider = (key, min, max, step) => {
      const input = h('input', { type: 'range', min, max, step, value: s[key] });
      input.addEventListener('input', () => { g.save.setSetting(key, parseFloat(input.value)); this._after(key, parseFloat(input.value)); });
      return input;
    };
    const row = (label, ctl) => h('div', { class: 'set-row' }, h('span', {}, label), ctl);
    const detected = PRESETS[g.graphics.detected].label;
    const grid = h('div', { class: 'settings-grid' },
      h('div', { class: 'set-section' }, 'GRÁFICOS'),
      row(`Qualidade (detectado: ${detected})`, seg('graphics', [['auto', 'Auto'], ...PRESET_ORDER.map((k) => [k, PRESETS[k].label])])),
      row('Resolução adaptativa', toggle('adaptiveResolution')),
      row('Mostrar FPS', toggle('showFps')),
      h('div', { class: 'set-section' }, 'CONTROLES'),
      row('Direção', seg('steering', [['wheel', 'Volante'], ['buttons', 'Setas'], ['tilt', 'Inclinação']])),
      row('Sensibilidade da direção', slider('steeringSensitivity', 0.5, 1.6, 0.05)),
      row('Sensibilidade da inclinação', slider('tiltSensitivity', 0.5, 2, 0.05)),
      row('Inverter inclinação', toggle('tiltInvert')),
      h('div', { class: 'set-section' }, 'CONDUÇÃO'),
      row('Câmbio', seg('transmission', [['auto', 'Automático'], ['manual', 'Manual']])),
      row('ABS', toggle('abs')),
      row('Controle de tração', toggle('tc')),
      row('Controle de estabilidade', toggle('stability')),
      row('Dificuldade da IA', seg('difficulty', Object.entries(AI_DIFFICULTY).map(([k, v]) => [k, v.label]))),
      h('div', { class: 'set-section' }, 'CÂMERA'),
      row('Câmera inicial', seg('startCamera', [['chase', 'Terceira pessoa'], ['cockpit', 'Cockpit']])),
      row('Distância (3ª pessoa)', slider('cameraDistance', 0.7, 1.6, 0.05)),
      row('Vibração da câmera', toggle('cameraShake')),
      h('div', { class: 'set-section' }, 'AMBIENTE'),
      row('Horário', seg('dayNight', [['track', 'Da pista'], ['day', 'Dia'], ['sunset', 'Pôr do sol'], ['night', 'Noite'], ['dynamic', 'Ciclo']])),
      row('Clima', seg('weather', [['clear', 'Limpo'], ['rain', 'Chuva'], ['sandstorm', 'Areia*'], ['random', 'Aleatório']])),
      h('div', { class: 'label', style: { gridColumn: '1 / -1' } }, '* Tempestade de areia acontece no Desert Speedway; nas outras pistas o clima fica limpo.'),
      h('div', { class: 'set-section' }, 'ÁUDIO'),
      row('Volume geral', slider('masterVolume', 0, 1, 0.05)),
      row('Motor', slider('engineVolume', 0, 1, 0.05)),
      row('Efeitos', slider('effectsVolume', 0, 1, 0.05)),
      row('Ambiente', slider('ambienceVolume', 0, 1, 0.05)),
      h('div', { class: 'set-section' }, 'DADOS'),
      row('Apagar progresso salvo', h('button', { class: 'small-btn', onclick: () => {
        this.click();
        if (this._confirmReset) { g.save.resetAll(); this._confirmReset = false; toast(this.root, 'Progresso apagado.'); g.reloadMenu(); return; }
        this._confirmReset = true;
        toast(this.root, 'Toque de novo para confirmar.');
        setTimeout(() => { this._confirmReset = false; }, 3000);
      } }, 'APAGAR')),
      h('div', { class: 'set-section' }, 'CRÉDITOS'),
      h('div', { class: 'label', style: { gridColumn: '1 / -1' } },
        'Modelo 3D do carro: "Car Concept" de Eric Chadwick / Darmstadt Graphics Group, licença CC BY 4.0 (creativecommons.org/licenses/by/4.0), adaptado para o jogo (pintura, rodas e detalhes).'));
    clear(this.el);
    const content = [
      h('div', { class: 'topbar' },
        h('button', { class: 'back-btn', onclick: () => { this.click(); this.close(); } }, '‹ VOLTAR'),
        h('h1', { class: 'title' }, 'CONFIGU', h('em', {}, 'RAÇÕES'))),
      grid,
    ];
    if (this.overlay) {
      const box = h('div', { class: 'modal-box', style: { width: 'min(92vw, 1100px)' } }, ...content);
      this.el.appendChild(box);
    } else this.el.append(...content);
  }

  async _after(key, value) {
    const g = this.game;
    if (key === 'graphics') g.graphics.set(value);
    if (key === 'masterVolume' || key.endsWith('Volume')) g.audio.applyVolumes();
    if (key === 'steering' && value === 'tilt') {
      const ok = await MobileControls.requestTiltPermission();
      if (!ok) toast(this.root, 'Permissão de sensores negada.');
    }
    if (key === 'graphics') toast(this.root, 'Qualidade aplicada. Sombras e vegetação mudam na próxima corrida.');
  }
}
