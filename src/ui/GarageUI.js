// =============================================================
// EXTREME RACING — GarageUI
// Seleção/compra de carros, ficha técnica, melhorias de
// desempenho e personalização visual (pintura, acabamento, aros,
// cor dos aros) com prévia 3D ao vivo no showroom.
// =============================================================
import { h, clear, fmtCredits, toast } from './dom.js';
import { GarageManager, PAINT_COLORS, RIM_COLORS, RIM_STYLES, FINISHES } from '../garage/GarageManager.js';
import { UPGRADES, SETUP_DEFAULT } from '../vehicles/VehicleCatalog.js';

// Itens de setup: [chave, rótulo, mín, máx, passo, formatação, dica]
const SETUP_ITEMS = [
  ['finalDrive', 'Relação final', -2, 2, 1, (v) => ['Bem longa', 'Longa', 'Padrão', 'Curta', 'Bem curta'][v + 2], 'Curta acelera mais; longa dá mais velocidade final.'],
  ['brakeBias', 'Freio na dianteira', 0.56, 0.76, 0.02, (v) => `${Math.round(v * 100)}%`, 'Mais na traseira gira o carro na freada (cuidado: instável).'],
  ['springs', 'Molas e amortecedores', -2, 2, 1, (v) => ['Muito macia', 'Macia', 'Padrão', 'Dura', 'Muito dura'][v + 2], 'Dura responde rápido; macia absorve zebras.'],
  ['rideHeight', 'Altura do carro', -2, 2, 1, (v) => `${v > 0 ? '+' : ''}${v} cm`, 'Mais baixo = menos rolagem.'],
  ['camberFront', 'Cambagem dianteira', 0.5, 4, 0.5, (v) => `−${v.toFixed(1)}°`, 'Perto de −2,5° dá mais aderência nas curvas.'],
  ['camberRear', 'Cambagem traseira', 0.5, 4, 0.5, (v) => `−${v.toFixed(1)}°`, 'Menos cambagem atrás ajuda a tracionar.'],
  ['aeroBalance', 'Balanço aerodinâmico', -2, 2, 1, (v) => ['Traseira ++', 'Traseira +', 'Neutro', 'Dianteira +', 'Dianteira ++'][v + 2], 'Mais na dianteira = carro mais ágil (e solto) em alta.'],
  ['lsd', 'Autoblocante', -2, 2, 1, (v) => ['Bem aberto', 'Aberto', 'Padrão', 'Travado', 'Bem travado'][v + 2], 'Travado traciona melhor; aberto vira mais fácil.'],
  ['tirePressure', 'Pressão dos pneus', -2, 2, 1, (v) => `${v > 0 ? '+' : ''}${v * 2} psi`, 'Alta: resposta rápida; baixa: mais aderência.'],
];

export class GarageUI {
  constructor(game) {
    this.game = game;
    this.root = game.uiRoot;
    this.garage = game.garage;
    this.viewId = this.garage.selectedId;
    this.tab = 'upgrades';
  }

  click() { this.game.audio.unlock(); this.game.audio.ui(); }

  async show(onBack) {
    this.onBack = onBack;
    this.game.showroom.setFraming('garage');
    this.el = h('div', { class: 'screen garage' });
    this.root.appendChild(this.el);
    this.render();
    await this._preview();
  }

  close() {
    this.el?.remove();
    this.el = null;
    this.game.showroom?.setFraming('menu');
  }

  async _preview() {
    const g = this.garage;
    await this.game.showroom.setCar(g.spec(this.viewId), g.look(this.viewId));
  }

  render() {
    const g = this.garage;
    const id = this.viewId;
    const owned = g.isOwned(id);
    const car = GarageManager.cars.find((c) => c.id === id);
    const st = g.stats(id);
    clear(this.el);

    // Lista de carros
    const list = h('div', { class: 'panel' }, h('div', { class: 'car-list' },
      ...GarageManager.cars.map((c) => h('button', {
        class: `car-item${c.id === id ? ' sel' : ''}`,
        onclick: async () => { this.click(); this.viewId = c.id; if (g.isOwned(c.id)) g.select(c.id); this.render(); await this._preview(); },
      }, h('div', {}, h('b', {}, c.name), h('br'), h('span', {}, c.class)),
      h('span', {}, g.isOwned(c.id) ? (g.selectedId === c.id ? 'SELECIONADO' : 'POSSUÍDO') : fmtCredits(c.price))))),
    h('div', { style: { marginTop: '1.6vh' } },
      h('p', { class: 'label' }, car.description),
      ...[
        ['Potência', `${st.powerCv} cv`, st.powerCv / 1000],
        ['Torque', `${st.torque} N·m`, st.torque / 1200],
        ['Peso', `${st.mass} kg`, 1 - (st.mass - 1200) / 600],
        ['Relação peso/potência', `${st.powerToWeight.toFixed(0)} cv/t`, st.powerToWeight / 650],
        ['Aderência', st.grip.toFixed(2), (st.grip - 0.9) / 0.6],
        ['Downforce', st.downforce.toFixed(2), st.downforce / 4.5],
      ].map(([k, v, f]) => h('div', {}, h('div', { class: 'stat-row' }, h('span', {}, k), h('b', {}, v)), h('div', { class: 'bar' }, h('i', { style: { width: `${Math.max(4, Math.min(100, f * 100))}%` } })))),
      h('div', { class: 'stat-row' }, h('span', {}, 'Tração / marchas'), h('b', {}, `${st.drive} • ${st.gears}`))));

    // Painel direito: melhorias / visual
    const right = h('div', { class: 'panel' });
    const tabs = h('div', { class: 'tabs' },
      h('button', { class: this.tab === 'upgrades' ? 'on' : '', onclick: () => { this.click(); this.tab = 'upgrades'; this.render(); } }, 'DESEMPENHO'),
      h('button', { class: this.tab === 'paint' ? 'on' : '', onclick: () => { this.click(); this.tab = 'paint'; this.render(); } }, 'PINTURA'),
      h('button', { class: this.tab === 'wheels' ? 'on' : '', onclick: () => { this.click(); this.tab = 'wheels'; this.render(); } }, 'RODAS'),
      h('button', { class: this.tab === 'setup' ? 'on' : '', onclick: () => { this.click(); this.tab = 'setup'; this.render(); } }, 'SETUP'));
    right.appendChild(tabs);
    const cfg = g.config(id);
    if (!owned) {
      right.append(
        h('p', {}, `Este carro custa ${fmtCredits(car.price)}. Você tem ${fmtCredits(g.credits)}.`),
        h('button', { class: 'buy-btn', disabled: g.credits < car.price, onclick: async () => {
          this.click();
          const r = g.buy(id);
          toast(this.root, r.ok ? `${car.name} comprado!` : r.reason);
          this.render();
          await this._preview();
        } }, `COMPRAR ${fmtCredits(car.price)}`));
    } else if (this.tab === 'upgrades') {
      for (const [key, up] of Object.entries(UPGRADES)) {
        const lvl = cfg.upgrades[key];
        const cost = g.upgradeCost(id, key);
        right.appendChild(h('div', { class: 'upg' },
          h('div', {}, h('div', { style: { fontWeight: 800, fontSize: '2.1vh' } }, up.label), h('div', { class: 'lv' }, ...[1, 2, 3].map((n) => h('i', { class: n <= lvl ? 'on' : '' })))),
          h('button', { class: 'small-btn', disabled: cost == null || g.credits < cost, onclick: async () => {
            this.click();
            const r = g.buyUpgrade(id, key);
            toast(this.root, r.ok ? `${up.label}: nível ${cfg.upgrades[key]}` : r.reason);
            this.render();
            if (key === 'aero') await this._preview();
          } }, cost == null ? 'MÁX' : fmtCredits(cost))));
      }
    } else if (this.tab === 'setup') {
      const spec = g.spec(id);
      for (const [key, label, min, max, step, fmt, hint] of SETUP_ITEMS) {
        const cur = cfg.setup[key] ?? (key === 'brakeBias' ? Math.round(spec.brakeBias * 50) / 50 : SETUP_DEFAULT[key]);
        const change = (dir) => {
          this.click();
          const next = Math.round(Math.min(max, Math.max(min, cur + dir * step)) * 100) / 100;
          g.setSetup(id, key, next);
          this.render();
        };
        right.appendChild(h('div', { class: 'upg' },
          h('div', {}, h('div', { style: { fontWeight: 800, fontSize: '2.1vh' } }, label), h('div', { class: 'label', style: { fontSize: '1.6vh' } }, hint)),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '0.8vh' } },
            h('button', { class: 'small-btn', disabled: cur <= min, onclick: () => change(-1) }, '−'),
            h('b', { style: { minWidth: '11vh', textAlign: 'center', fontSize: '1.9vh' } }, fmt(cur)),
            h('button', { class: 'small-btn', disabled: cur >= max, onclick: () => change(1) }, '+'))));
      }
      right.appendChild(h('button', { class: 'buy-btn', onclick: () => { this.click(); g.resetSetup(id); toast(this.root, 'Setup restaurado'); this.render(); } }, 'RESTAURAR PADRÃO'));
    } else if (this.tab === 'paint') {
      right.append(h('p', { class: 'label' }, 'Cor da carroceria'),
        h('div', { class: 'swatches' }, ...PAINT_COLORS.map((c) => h('button', { class: `swatch${cfg.paint === c ? ' on' : ''}`, style: { background: c }, 'aria-label': c, onclick: () => {
          this.click(); g.setPaint(id, c); this._livePaint(); this.render();
        } }))),
        h('p', { class: 'label', style: { marginTop: '1.6vh' } }, 'Acabamento'),
        h('div', { class: 'seg' }, ...Object.entries(FINISHES).map(([k, v]) => h('button', { class: cfg.finish === k ? 'on' : '', onclick: () => { this.click(); g.setFinish(id, k); this._livePaint(); this.render(); } }, v))));
    } else {
      right.append(h('p', { class: 'label' }, 'Desenho dos aros'),
        h('div', { class: 'seg' }, ...RIM_STYLES.map((name, i) => h('button', { class: cfg.rimStyle === i ? 'on' : '', onclick: async () => { this.click(); g.setRimStyle(id, i); this.render(); await this._preview(); } }, name))),
        h('p', { class: 'label', style: { marginTop: '1.6vh' } }, 'Cor dos aros'),
        h('div', { class: 'swatches' }, ...RIM_COLORS.map((c) => h('button', { class: `swatch${cfg.rim === c ? ' on' : ''}`, style: { background: c }, 'aria-label': c, onclick: () => {
          this.click(); g.setRim(id, c); this._livePaint(); this.render();
        } }))));
    }

    this.el.append(
      h('div', { class: 'topbar' },
        h('button', { class: 'back-btn', onclick: () => { this.click(); this.close(); this.onBack?.(); } }, '‹ VOLTAR'),
        h('h1', { class: 'title' }, 'GARA', h('em', {}, 'GEM')),
        h('div', { class: 'spacer' }),
        h('div', { class: 'credits-badge', style: { position: 'static' }, html: `<b>${fmtCredits(g.credits)}</b>` })),
      h('div', { class: 'garage-body' }, list, h('div'), right));
  }

  /** Atualiza cores no modelo exibido sem recarregar. */
  _livePaint() {
    const m = this.game.showroom.car?.materials;
    if (!m) return;
    const cfg = this.garage.config(this.viewId);
    m.paint.albedoColor = hexToColor(m.paint.albedoColor, cfg.paint);
    m.paint.metallic = cfg.finish === 'matte' ? 0.1 : 0.55;
    m.paint.roughness = cfg.finish === 'matte' ? 0.6 : 0.28;
    m.paint.clearCoat.isEnabled = cfg.finish !== 'matte';
    m.rim.albedoColor = hexToColor(m.rim.albedoColor, cfg.rim);
  }
}

function hexToColor(color3, hex) {
  const n = parseInt(hex.slice(1), 16);
  color3.r = ((n >> 16) & 255) / 255;
  color3.g = ((n >> 8) & 255) / 255;
  color3.b = (n & 255) / 255;
  // PBR usa espaço linear para albedoColor
  color3.r = Math.pow(color3.r, 2.2); color3.g = Math.pow(color3.g, 2.2); color3.b = Math.pow(color3.b, 2.2);
  return color3;
}
