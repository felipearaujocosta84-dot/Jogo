// =============================================================
// EXTREME RACING — MainMenu
// Tela inicial cinematográfica (JOGAR, GARAGEM, SELECIONAR PISTA,
// CAMPEONATO, CONTRA O RELÓGIO, CONFIGURAÇÕES), seleção de pista
// e modo, e tela do campeonato.
// =============================================================
import { h, clear, fmtCredits } from './dom.js';
import { TRACKS, getTrackGeometry } from '../tracks/TrackManager.js';
import { AI_DIFFICULTY } from '../ai/RacingAI.js';
import { formatTime } from '../race/RaceManager.js';
import { getCar } from '../vehicles/VehicleCatalog.js';
import { AchievementsUI } from './AchievementsUI.js';

export class MainMenu {
  constructor(game) {
    this.game = game;
    this.root = game.uiRoot;
    this.el = null;
    this.selectedTrack = game.save.data.lastTrack ?? 'grand';
  }

  _mount(el) {
    this.close();
    this.el = el;
    this.root.appendChild(el);
  }

  close() {
    this.el?.remove();
    this.el = null;
  }

  click() { this.game.audio.unlock(); this.game.audio.ui(); }

  /** Tela inicial. */
  showMain() {
    const g = this.game;
    g.showroom?.setFraming('menu');
    const car = getCar(g.garage.selectedId);
    const btn = (label, sub, fn, primary = false) => h('button', { class: `menu-btn${primary ? ' primary' : ''}`, onclick: () => { this.click(); fn(); } }, label, sub ? h('small', {}, sub) : null);
    const champ = g.save.data.championship;
    const el = h('div', { class: 'screen' },
      h('div', { class: 'menu-col' },
        h('div', { class: 'brand' }, h('span', { class: 'b1' }, 'EXTREME'), h('span', { class: 'b2' }, 'RACING'), h('small', {}, `${car.name} • ${car.class}`)),
        h('div', { class: 'menu-list' },
          btn('JOGAR', `Corrida rápida • ${TRACKS.find((t) => t.id === this.selectedTrack)?.shortName}`, () => g.startQuickRace(this.selectedTrack), true),
          btn('GARAGEM', null, () => g.openGarage()),
          btn('SELECIONAR PISTA', 'Corrida, treino ou tempo', () => this.showTrackSelect('quick')),
          btn('CAMPEONATO', champ ? `Etapa ${champ.round + 1} de ${champ.tracks.length}` : '4 etapas', () => this.showChampionship()),
          btn('CONTRA O RELÓGIO', null, () => this.showTrackSelect('timetrial')),
          btn('CONFIGURAÇÕES', null, () => g.openSettings(() => this.showMain())))),
      h('div', { class: 'credits-badge', html: `<b>${fmtCredits(g.garage.credits)}</b>` }),
      h('button', { class: 'trophy-btn', onclick: () => {
        this.click();
        this.close();
        const ui = new AchievementsUI(g);
        g.achievementsUI = ui;
        ui.show(() => this.showMain());
      } }, `🏆 ${g.achievements.count}/${g.achievements.total}`),
      h('div', { class: 'menu-footer' }, `Gráficos: ${g.graphics.preset.label} (${g.save.settings.graphics === 'auto' ? 'auto' : 'manual'})`));
    this._mount(el);
  }

  _trackCanvas(def) {
    const c = h('canvas', { width: 320, height: 200 });
    requestAnimationFrame(() => {
      const geo = getTrackGeometry(def.id);
      const ctx = c.getContext('2d');
      const b = geo.bounds();
      const pad = 18;
      const s = Math.min((320 - pad * 2) / (b.maxX - b.minX), (200 - pad * 2) / (b.maxZ - b.minZ));
      const ox = (320 - (b.maxX - b.minX) * s) / 2, oz = (200 - (b.maxZ - b.minZ) * s) / 2;
      ctx.fillStyle = '#0a0e14'; ctx.fillRect(0, 0, 320, 200);
      ctx.lineJoin = 'round';
      for (const [w, col] of [[7, '#1c2430'], [3, '#e9eef3']]) {
        ctx.lineWidth = w; ctx.strokeStyle = col; ctx.beginPath();
        geo.samples.forEach((sm, i) => {
          const x = ox + (sm.p.x - b.minX) * s, y = 200 - (oz + (sm.p.z - b.minZ) * s);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath(); ctx.stroke();
      }
      // Trechos especiais: túnel (laranja), ponte (azul), desfiladeiro (cinza), cidade (verde)
      const colors = { tunnel: '#ff9a2e', bridge: '#3aa0ff', gorge: '#9aa4b0', city: '#4fd17a' };
      ctx.lineWidth = 4;
      for (const f of def.features ?? []) {
        ctx.strokeStyle = colors[f.type] ?? '#fff';
        ctx.beginPath();
        for (let sPos = f.from; sPos <= f.to; sPos += 6) {
          const pt = geo.pointAt(sPos).p;
          const x = ox + (pt.x - b.minX) * s, y = 200 - (oz + (pt.z - b.minZ) * s);
          if (sPos === f.from) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      const st = geo.samples[0].p;
      ctx.fillStyle = '#e3122e';
      ctx.beginPath(); ctx.arc(ox + (st.x - b.minX) * s, 200 - (oz + (st.z - b.minZ) * s), 5, 0, Math.PI * 2); ctx.fill();
    });
    return c;
  }

  /** Seleção de pista e modo. */
  showTrackSelect(mode = 'quick') {
    const g = this.game;
    const s = g.save.settings;
    let cur = { mode, laps: s.laps, difficulty: s.difficulty, opponents: s.opponents };
    const cards = h('div', { class: 'cards' });
    const renderCards = () => {
      clear(cards);
      for (const def of TRACKS) {
        const geo = getTrackGeometry(def.id);
        const rec = g.save.getTrackRecord(def.id);
        const card = h('button', { class: `card${def.id === this.selectedTrack ? ' sel' : ''}`, onclick: () => { this.click(); this.selectedTrack = def.id; renderCards(); } },
          this._trackCanvas(def),
          h('span', { class: `tag${def.status === 'preview' ? ' preview' : ''}` }, def.status === 'preview' ? 'AMBIENTE BÁSICO' : 'COMPLETA'),
          h('div', { class: 'info' },
            h('h3', {}, def.name),
            h('p', {}, def.description),
            h('div', { class: 'meta' }, h('span', {}, `${(geo.length / 1000).toFixed(2)} km`), h('span', {}, `${def.width} m larg.`), h('span', {}, `Recorde ${rec ? formatTime(rec.time) : '—'}`))));
        cards.appendChild(card);
      }
    };
    renderCards();
    const seg = (items, value, onPick) => {
      const el = h('div', { class: 'seg' });
      for (const [k, label] of items) {
        el.appendChild(h('button', { class: k === value ? 'on' : '', onclick: () => { this.click(); onPick(k); render(); } }, label));
      }
      return el;
    };
    const bar = h('div', { class: 'bottombar' });
    const render = () => {
      clear(bar);
      bar.append(
        h('span', { class: 'label' }, 'Modo'),
        seg([['quick', 'Corrida'], ['training', 'Treino'], ['timetrial', 'Tempo']], cur.mode, (k) => { cur.mode = k; }));
      if (cur.mode !== 'training') {
        bar.append(h('span', { class: 'label' }, 'Voltas'), seg([[1, '1'], [2, '2'], [3, '3'], [5, '5']], cur.laps, (k) => { cur.laps = k; s.laps = k; g.save.save(); }));
      }
      if (cur.mode === 'quick') {
        bar.append(h('span', { class: 'label' }, 'IA'), seg(Object.entries(AI_DIFFICULTY).map(([k, v]) => [k, v.label]), cur.difficulty, (k) => { cur.difficulty = k; s.difficulty = k; g.save.save(); }));
        bar.append(h('span', { class: 'label' }, 'Rivais'), seg([[3, '3'], [5, '5'], [7, '7']], cur.opponents, (k) => { cur.opponents = k; s.opponents = k; g.save.save(); }));
      }
      bar.append(h('button', { class: 'go-btn', onclick: () => {
        this.click();
        g.save.data.lastTrack = this.selectedTrack;
        g.save.save();
        g.startRace({ trackId: this.selectedTrack, mode: cur.mode, laps: cur.laps, difficulty: cur.difficulty, opponents: cur.opponents });
      } }, 'LARGAR'));
    };
    render();
    const el = h('div', { class: 'screen full' },
      h('div', { class: 'topbar' },
        h('button', { class: 'back-btn', onclick: () => { this.click(); this.showMain(); } }, '‹ VOLTAR'),
        h('h1', { class: 'title' }, ...(mode === 'timetrial' ? ['CONTRA O ', h('em', {}, 'RELÓGIO')] : ['SELECIONAR ', h('em', {}, 'PISTA')])),
        h('div', { class: 'spacer' })),
      cards, bar);
    this._mount(el);
  }

  /** Campeonato: 4 etapas, pontuação estilo GP. */
  showChampionship() {
    const g = this.game;
    const c = g.save.data.championship;
    const s = g.save.settings;
    const body = h('div', { class: 'panel', style: { flex: '1' } });
    if (!c) {
      let diff = s.difficulty;
      const renderNew = () => {
        clear(body);
        body.append(
          h('p', {}, 'Dispute as quatro pistas em sequência contra 5 rivais. Pontos: 25, 18, 15, 12, 10, 8. O campeão recebe um prêmio extra de créditos.'),
          h('div', { class: 'bottombar' },
            h('span', { class: 'label' }, 'Dificuldade'),
            (() => {
              const seg = h('div', { class: 'seg' });
              for (const [k, v] of Object.entries(AI_DIFFICULTY)) seg.appendChild(h('button', { class: k === diff ? 'on' : '', onclick: () => { this.click(); diff = k; renderNew(); } }, v.label));
              return seg;
            })(),
            h('button', { class: 'go-btn', onclick: () => { this.click(); g.startChampionship(diff); } }, 'INICIAR')));
        const list = h('ol', {}, ...TRACKS.map((t) => h('li', { style: { margin: '1vh 0', fontSize: '2.2vh' } }, t.name)));
        body.appendChild(list);
      };
      renderNew();
    } else {
      const rows = Object.entries(c.standings).sort((a, b) => b[1] - a[1]);
      body.innerHTML = `<p>Etapa <b>${c.round + 1}</b> de ${c.tracks.length}: <b>${TRACKS.find((t) => t.id === c.tracks[c.round])?.name}</b> • ${AI_DIFFICULTY[c.difficulty].label}</p>
        <table class="table"><thead><tr><th>POS</th><th>PILOTO</th><th class="num">PONTOS</th></tr></thead><tbody>
        ${rows.map(([n, p], i) => `<tr class="${n === 'VOCÊ' ? 'me' : ''}"><td>${i + 1}º</td><td>${n}</td><td class="num">${p}</td></tr>`).join('')}
        </tbody></table>`;
      body.appendChild(h('div', { class: 'bottombar' },
        h('button', { class: 'small-btn', onclick: () => { this.click(); g.save.data.championship = null; g.save.save(); this.showChampionship(); } }, 'ABANDONAR'),
        h('button', { class: 'go-btn', onclick: () => { this.click(); g.continueChampionship(); } }, `CORRER ETAPA ${c.round + 1}`)));
    }
    const el = h('div', { class: 'screen full' },
      h('div', { class: 'topbar' },
        h('button', { class: 'back-btn', onclick: () => { this.click(); this.showMain(); } }, '‹ VOLTAR'),
        h('h1', { class: 'title' }, 'CAMPEO', h('em', {}, 'NATO'))),
      body);
    this._mount(el);
  }
}
