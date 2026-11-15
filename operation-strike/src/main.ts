// Ponto de entrada: carregamento, todos os menus e a ligação entre interface, sessões e servidor.
import { Game } from './core/Game';
import { Settings, type SettingsData } from './core/Settings';
import { LocalSession, OnlineSession, type Session } from './core/Session';
import { NetClient } from './multiplayer/NetClient';
import type { RoomInfo } from './multiplayer/Protocol';
import { MAP_LIST, MAPS } from './maps/maps';
import { BUY_CATEGORIES, WEAPONS, EQUIPMENT, itemName } from './weapons/WeaponData';
import { applyMatch, BOT_MMR, levelFor, rankName, type ProfileData } from './save/Profile';
import { loadLocalProfile, saveLocalProfile } from './save/LocalProfile';
import { Storage } from './save/Storage';
import type { Difficulty, GameMode, Team } from './sim/types';
import { esc } from './interface/Hud';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const settings = new Settings();
const canvas = $<HTMLCanvasElement>('renderCanvas');
const game = new Game(canvas, settings);
document.body.classList.toggle('touch', game.isTouch);

const SCREENS = ['loading', 'mainMenu', 'playMenu', 'lobbyScreen', 'trainingMenu', 'arsenalScreen', 'profileScreen', 'rankingScreen', 'pauseMenu', 'endScreen', 'settingsMenu'] as const;
type ScreenId = (typeof SCREENS)[number] | null;
let current: ScreenId = 'loading';
let settingsReturn: ScreenId = 'mainMenu';
let net: NetClient | null = null;
let profile = loadLocalProfile(settings.get('playerName'));

function show(id: ScreenId): void {
  current = id;
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  document.body.classList.toggle('in-menu', id !== null);
  if (id === 'mainMenu') refreshMenuRank();
  if (id === 'profileScreen') renderProfile(profileTab);
  if (id === 'rankingScreen') void loadRanking();
  if (id === 'arsenalScreen') renderArsenal();
}

let toastTimer = 0;
function toast(text: string, ms = 2500): void {
  const el = $('menuToast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.add('hidden'), ms);
}

async function enterFullscreen(): Promise<void> {
  if (!game.isTouch) return;
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.('landscape');
  } catch {
    /* sem suporte: o aviso de girar o celular cuida disso */
  }
}

function refreshMenuRank(): void {
  const lv = levelFor(profile.xp);
  $('menuRank').textContent = `${profile.name} · Nível ${lv.level} · ${rankName(profile.mmr)} (${profile.mmr} MMR)`;
}

// ------------------------------------------------------------ escolhas (botões segmentados)

const picks: Record<string, string> = { mode: 'competitive', map: 'dust_zone', difficulty: 'normal', side: 'T', tmap: 'dust_zone', tside: 'T' };
Object.assign(picks, Storage.load<Record<string, string>>('picks', {}));

function renderMapCards(): void {
  for (const box of document.querySelectorAll<HTMLElement>('.maps')) {
    const key = box.dataset.pick!;
    box.innerHTML = MAP_LIST.map(m => `<button data-v="${m.id}" class="mapcard ${picks[key] === m.id ? 'on' : ''}" style="--sky:${m.ambience.sky[1]};--ground:${m.ambience.fog}"><b>${m.name}</b><small>${m.description}</small></button>`).join('');
  }
}

function syncPicks(): void {
  for (const box of document.querySelectorAll<HTMLElement>('[data-pick]')) {
    const key = box.dataset.pick!;
    for (const b of box.querySelectorAll<HTMLElement>('[data-v]')) b.classList.toggle('on', b.dataset.v === picks[key]);
  }
}

document.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-v]');
  const box = b?.closest<HTMLElement>('[data-pick]');
  if (b && box) {
    picks[box.dataset.pick!] = b.dataset.v!;
    Storage.save('picks', picks);
    syncPicks();
    game.audio.unlock();
    game.audio.play('click');
  }
});

// abas
document.addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
  if (t && t.classList.contains('tab')) {
    const name = t.dataset.tab!;
    for (const x of document.querySelectorAll<HTMLElement>('.tab[data-tab]')) x.classList.toggle('active', x.dataset.tab === name);
    for (const x of document.querySelectorAll<HTMLElement>('[data-tab-body]')) x.classList.toggle('hidden', x.dataset.tabBody !== name);
    if (name === 'online') void ensureNet().then(() => net?.send({ t: 'list' })).catch(() => {});
  }
  const pt = (e.target as HTMLElement).closest<HTMLElement>('[data-ptab]');
  if (pt) {
    profileTab = pt.dataset.ptab as 'local' | 'online';
    for (const x of document.querySelectorAll<HTMLElement>('[data-ptab]')) x.classList.toggle('active', x === pt);
    renderProfile(profileTab);
  }
});

// ------------------------------------------------------------ partidas

function startLocal(mode: GameMode, mapId: string, difficulty: Difficulty, side: string): void {
  void enterFullscreen();
  const team: Team = side === 'random' ? (Math.random() < 0.5 ? 'T' : 'CT') : (side as Team);
  const session = new LocalSession({ mapId, mode, difficulty, teamSize: 5 }, settings.get('playerName'), team);
  launch(session);
}

function launch(session: Session): void {
  show(null);
  game.onMatchOver = s => showEnd(s);
  game.startSession(session);
}

function showEnd(s: Session): void {
  const res = s.result;
  if (!res) return;
  game.pause();
  game.setMenuView();
  const me = res.players.find(p => p.id === s.localId);
  const won = me ? me.won : null;
  $('endTitle').textContent = won === null ? 'EMPATE' : won ? 'VITÓRIA' : 'DERROTA';
  $('endTitle').className = won === null ? '' : won ? 'win' : 'loss';
  $('endScore').textContent = `TR ${res.scoreT} x ${res.scoreCT} CT · ${s.mode === 'competitive' ? 'Competitivo' : 'Casual'} · ${MAPS[s.map.def.id].name}`;
  const rows = (team: Team) =>
    res.players
      .filter(p => p.team === team)
      .sort((a, b) => b.score - a.score)
      .map(p => `<tr class="${p.id === s.localId ? 'me' : ''}"><td class="n">${esc(p.name)}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.assists}</td><td>${p.headshots}</td><td>${p.mvps}</td><td>${p.score}</td></tr>`)
      .join('');
  const head = '<tr><th class="n">JOGADOR</th><th>A</th><th>M</th><th>AS</th><th>HS</th><th>MVP</th><th>PTS</th></tr>';
  $('endStats').innerHTML = `<div class="t"><h3>TERRORISTAS ${res.scoreT}</h3><table>${head}${rows('T')}</table></div><div class="ct"><h3>CONTRATERRORISTAS ${res.scoreCT}</h3><table>${head}${rows('CT')}</table></div>`;
  let pdata: ProfileData | null = null;
  let rec = null;
  if (!s.online && me) {
    const own = me.team === 'T' ? res.scoreT : res.scoreCT;
    const enemy = me.team === 'T' ? res.scoreCT : res.scoreT;
    const diff = (s as LocalSession).sim.config.difficulty;
    rec = applyMatch(profile, me, { mode: s.mode, mapId: s.map.def.id, online: false, scoreOwn: own, scoreEnemy: enemy, teamMmr: (profile.mmr + BOT_MMR[diff] * 4) / 5, enemyMmr: BOT_MMR[diff] });
    saveLocalProfile(profile);
    pdata = profile;
  } else if (s.online && net?.profile) {
    pdata = net.profile;
    rec = pdata.history[0];
  }
  if (pdata && rec) {
    const lv = levelFor(pdata.xp);
    $('endProfile').innerHTML = `<div><b>+${rec.xp} XP</b> · Nível ${lv.level} <div class="xpbar"><i style="width:${Math.round((lv.into / lv.need) * 100)}%"></i></div></div>
      <div>${s.mode === 'competitive' ? `MMR ${rec.mmrDelta >= 0 ? '+' : ''}${rec.mmrDelta} → <b>${pdata.mmr}</b> · ${rankName(pdata.mmr)}` : 'Partida casual não altera o MMR'}</div>`;
  } else $('endProfile').innerHTML = '';
  if (s.online) net?.send({ t: 'leave' });
  show('endScreen');
}

// ------------------------------------------------------------ online

function httpBase(): string {
  const url = net?.url ?? NetClient.defaultUrl();
  return url.replace(/^ws/, 'http').replace(/\/ws$/, '');
}

async function ensureNet(): Promise<NetClient> {
  if (net && net.connected) return net;
  const url = settings.get('serverUrl') || NetClient.defaultUrl();
  if (!net || net.url !== url) {
    net?.close();
    net = new NetClient(url, settings.get('playerName'), profile.id);
    net.onStatus = st => ($('netStatus').textContent = st);
    net.on(msg => {
      switch (msg.t) {
        case 'rooms':
          renderRooms(msg.rooms);
          break;
        case 'room':
          renderLobby(msg.room);
          if (msg.room.state === 'lobby' && current !== 'lobbyScreen' && !game.session) show('lobbyScreen');
          break;
        case 'start': {
          if (game.session?.online && (game.session as OnlineSession).localId === msg.you) {
            game.resume();
            show(null);
            break;
          }
          const session = new OnlineSession(net!, msg.mapId, msg.mode, msg.you);
          void enterFullscreen();
          launch(session);
          break;
        }
        case 'error':
          if (game.session && !game.paused) game.hud.message(msg.msg, 2);
          else toast(msg.msg);
          break;
        case 'chat':
          if (game.session) game.hud.message((msg.from ? msg.from + ': ' : '') + msg.text, 3);
          break;
        case 'welcome':
          if (msg.resumed) toast('Reconectado à partida');
          break;
      }
    });
  }
  try {
    await net.connect();
  } catch (e) {
    toast((e as Error).message + '. Rode o servidor com "npm start".', 4000);
    throw e;
  }
  return net;
}

function renderRooms(rooms: RoomInfo[]): void {
  $('roomList').innerHTML = rooms.length
    ? rooms
        .map(r => `<button class="room" data-room="${r.code}"><b>${r.code}</b> ${MAPS[r.mapId]?.name ?? r.mapId} · ${r.mode === 'competitive' ? 'Competitivo' : 'Casual'} · ${r.humans}/10 humanos · ${r.state === 'lobby' ? 'no lobby' : 'em jogo'} · MMR ${r.avgMmr}</button>`)
        .join('')
    : '<p class="roadmap">Nenhuma sala pública. Use “Encontrar partida” ou crie uma.</p>';
}

$('roomList').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-room]');
  if (b) void ensureNet().then(n => n.send({ t: 'join', code: b.dataset.room! }));
});

function renderLobby(r: RoomInfo): void {
  $('lobbyCode').textContent = r.code;
  const diff = { easy: 'Fácil', normal: 'Normal', hard: 'Difícil' }[r.difficulty];
  $('lobbyInfo').textContent = `${MAPS[r.mapId]?.name} · ${r.mode === 'competitive' ? 'Competitivo' : 'Casual'} · bots ${diff}${r.countdown > 0 && r.state === 'lobby' ? ` · começa em ${r.countdown}s` : ''}`;
  const li = (team: Team) =>
    r.players
      .filter(p => p.team === team)
      .map(p => `<li class="${p.id === net?.you ? 'me' : ''}">${esc(p.name)} <small>${p.bot ? 'BOT' : rankName(p.mmr)}${p.connected ? '' : ' (caiu)'}</small></li>`)
      .join('') || '<li class="empty">— vazio (bots entram) —</li>';
  $('lobbyT').innerHTML = li('T');
  $('lobbyCT').innerHTML = li('CT');
  const isHost = !!net && r.host === net.clientId;
  $('btnStartRoom').classList.toggle('hidden', r.isPublic || !isHost);
}

// ------------------------------------------------------------ telas informativas

function renderArsenal(): void {
  const bar = (v: number, max: number) => `<i class="bar"><b style="width:${Math.min(100, (v / max) * 100)}%"></b></i>`;
  $('arsenalList').innerHTML = BUY_CATEGORIES.map(c => {
    const items = c.items.map(id => {
      const w = WEAPONS[id];
      const side = (w?.team ?? EQUIPMENT.find(e => e.id === id)?.team) ?? '';
      if (!w) return `<div class="wcard"><b>${itemName(id)}</b><span class="price">$${EQUIPMENT.find(e => e.id === id)?.price}</span><small>${side ? 'Somente ' + side : 'Ambos os lados'}</small></div>`;
      if (w.cls === 'grenade') return `<div class="wcard"><b>${w.name}</b><span class="price">$${w.price}</span><small>${id === 'he' ? 'Até 98 de dano em 8 m' : id === 'flash' ? 'Cega quem estiver olhando' : 'Fumaça por 18 s, bloqueia a visão'}</small></div>`;
      return `<div class="wcard"><b>${w.name}</b><span class="price">$${w.price}</span><small>${side ? 'Somente ' + (side === 'T' ? 'TR' : 'CT') : 'Ambos os lados'} · recompensa $${w.killReward}</small>
        <label>Dano ${w.damage}${bar(w.damage, 115)}</label><label>Cadência ${Math.round(w.fireRate * 60)} RPM${bar(w.fireRate, 14)}</label>
        <label>Penetração no colete ${Math.round(w.armorPen * 100)}%${bar(w.armorPen, 1)}</label><label>Precisão${bar(6 - Math.min(6, w.spreadStand * 2), 6)}</label>
        <label>Mobilidade${bar(w.speed, 1)}</label><small>Pente ${w.magazine}/${w.reserve} · recarga ${w.reloadTime}s${w.scope ? ' · luneta' : ''}</small></div>`;
    });
    return `<h3>${c.name}</h3><div class="wgrid">${items.join('')}</div>`;
  }).join('');
}

let profileTab: 'local' | 'online' = 'local';

function renderProfile(tab: 'local' | 'online'): void {
  if (tab === 'online') {
    if (!net?.profile) {
      $('profileBody').innerHTML = '<p class="roadmap">Conectando ao servidor…</p>';
      void ensureNet().then(() => renderProfile('online')).catch(() => ($('profileBody').innerHTML = '<p class="roadmap">Servidor indisponível. Rode "npm start" para jogar online.</p>'));
      return;
    }
    return drawProfile(net.profile);
  }
  drawProfile(profile);
}

function drawProfile(p: ProfileData): void {
  const lv = levelFor(p.xp);
  const kd = p.deaths ? (p.kills / p.deaths).toFixed(2) : p.kills.toFixed(2);
  const hs = p.kills ? Math.round((p.headshots / p.kills) * 100) : 0;
  const wr = p.matches ? Math.round((p.wins / p.matches) * 100) : 0;
  const hist = p.history
    .map(h => `<tr class="${h.result}"><td>${new Date(h.date).toLocaleDateString()}</td><td>${MAPS[h.mapId]?.name ?? h.mapId}</td><td>${h.mode === 'competitive' ? 'Comp.' : 'Casual'}${h.online ? ' · online' : ''}</td><td>${h.result === 'win' ? 'Vitória' : h.result === 'loss' ? 'Derrota' : 'Empate'} ${h.score}</td><td>${h.kills}/${h.deaths}/${h.assists}</td><td>${h.mmrDelta >= 0 ? '+' : ''}${h.mmrDelta}</td></tr>`)
    .join('');
  $('profileBody').innerHTML = `
    <div class="p-head"><div class="rank-badge">${rankName(p.mmr)}</div><div><b>${esc(p.name)}</b><br><small>Nível ${lv.level} · ${p.mmr} MMR</small><div class="xpbar"><i style="width:${Math.round((lv.into / lv.need) * 100)}%"></i></div><small>${lv.into}/${lv.need} XP</small></div></div>
    <div class="p-stats">
      <div><b>${p.matches}</b><small>Partidas</small></div><div><b>${p.wins}</b><small>Vitórias</small></div><div><b>${p.losses}</b><small>Derrotas</small></div>
      <div><b>${wr}%</b><small>Aproveitamento</small></div><div><b>${p.kills}</b><small>Abates</small></div><div><b>${p.deaths}</b><small>Mortes</small></div>
      <div><b>${p.assists}</b><small>Assistências</small></div><div><b>${kd}</b><small>K/D</small></div><div><b>${hs}%</b><small>Tiros na cabeça</small></div><div><b>${p.mvps}</b><small>MVPs</small></div>
    </div>
    <h3>Histórico</h3><table class="hist">${hist || '<tr><td>Nenhuma partida ainda.</td></tr>'}</table>`;
}

async function loadRanking(): Promise<void> {
  $('rankingBody').innerHTML = '<p class="roadmap">Carregando…</p>';
  try {
    const res = await fetch(httpBase() + '/api/ranking');
    const list = (await res.json()) as { name: string; mmr: number; rank: string; wins: number; matches: number; kd: number }[];
    $('rankingBody').innerHTML = list.length
      ? `<table><tr><th>#</th><th class="n">JOGADOR</th><th>PATENTE</th><th>MMR</th><th>VITÓRIAS</th><th>PARTIDAS</th><th>K/D</th></tr>${list
          .map((r, i) => `<tr><td>${i + 1}</td><td class="n">${esc(r.name)}</td><td>${r.rank}</td><td>${r.mmr}</td><td>${r.wins}</td><td>${r.matches}</td><td>${r.kd}</td></tr>`)
          .join('')}</table>`
      : '<p class="roadmap">Ninguém no ranking ainda. Jogue partidas online para aparecer aqui.</p>';
  } catch {
    $('rankingBody').innerHTML = `<p class="roadmap">Servidor indisponível (${esc(httpBase())}). O ranking online precisa do servidor rodando ("npm start").<br>Seu perfil offline: ${rankName(profile.mmr)} · ${profile.mmr} MMR.</p>`;
  }
}

// ------------------------------------------------------------ configurações

const fields = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]'));

function formatValue(key: string, v: number): string {
  if (key === 'renderDistance') return v + ' m';
  if (key === 'fov') return v + '°';
  if (key === 'volume' || key === 'buttonOpacity') return Math.round(v * 100) + '%';
  return v.toFixed(2) + 'x';
}

function syncSettingsForm(): void {
  for (const el of fields) {
    const key = el.dataset.setting as keyof SettingsData;
    const value = settings.get(key);
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = String(value);
    const out = el.parentElement?.querySelector('output');
    if (out) out.textContent = formatValue(key, Number(value));
  }
}

for (const el of fields) {
  el.addEventListener(el instanceof HTMLInputElement && (el.type === 'range' || el.type === 'text') ? 'input' : 'change', () => {
    const key = el.dataset.setting as keyof SettingsData;
    let value: unknown;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') value = el.checked;
    else if (el instanceof HTMLInputElement && el.type === 'range') value = parseFloat(el.value);
    else if (key === 'fpsCap') value = parseInt(el.value, 10);
    else if (key === 'playerName') value = el.value.replace(/[<>]/g, '').slice(0, 16) || 'Operador';
    else value = el.value.trim();
    settings.set(key, value as never);
    if (key === 'playerName') {
      profile = loadLocalProfile(String(value));
      if (net) {
        net.close();
        net = null;
      }
    }
    if (key === 'serverUrl') Storage.save('serverUrl', value);
    const out = el.parentElement?.querySelector('output');
    if (out) out.textContent = formatValue(key, Number(value));
  });
}

// ------------------------------------------------------------ botões

function openPause(): void {
  if (current !== null || !game.session) return;
  game.pause();
  game.setMenuView();
  const s = game.session;
  $('pauseInfo').textContent = s.online ? 'A partida online continua enquanto você está no menu.' : '';
  show('pauseMenu');
}

document.addEventListener('click', e => {
  const target = e.target as HTMLElement;
  const go = target.closest<HTMLElement>('[data-go]');
  if (go) {
    game.audio.unlock();
    game.audio.play('click');
    if (go.dataset.go === 'settingsMenu') {
      settingsReturn = current;
      syncSettingsForm();
    }
    return show(go.dataset.go as ScreenId);
  }
  const btn = target.closest<HTMLElement>('[data-action]');
  if (!btn) return;
  game.audio.unlock();
  game.audio.play('click');
  switch (btn.dataset.action) {
    case 'start-bots':
      return startLocal(picks.mode as GameMode, picks.map, picks.difficulty as Difficulty, picks.side);
    case 'start-training':
      return startLocal('training', picks.tmap, 'easy', picks.tside);
    case 'quick-competitive':
    case 'quick-casual':
      void ensureNet().then(n => {
        n.send({ t: 'quick', mode: btn.dataset.action === 'quick-casual' ? 'casual' : 'competitive' });
        toast('Procurando partida pelo seu nível…');
      }).catch(() => {});
      return;
    case 'join-code': {
      const code = $<HTMLInputElement>('joinCode').value.trim().toUpperCase();
      if (code.length < 4) return toast('Digite o código da sala');
      void ensureNet().then(n => n.send({ t: 'join', code })).catch(() => {});
      return;
    }
    case 'create-room':
      void ensureNet().then(n => n.send({ t: 'create', mode: picks.mode === 'casual' ? 'casual' : 'competitive', mapId: picks.map, difficulty: picks.difficulty as Difficulty, isPublic: $<HTMLInputElement>('roomPublic').checked })).catch(() => {});
      return;
    case 'refresh-rooms':
      void ensureNet().then(n => n.send({ t: 'list' })).catch(() => {});
      return;
    case 'team-T':
    case 'team-CT':
      net?.send({ t: 'team', team: btn.dataset.action === 'team-T' ? 'T' : 'CT' });
      return;
    case 'start-room':
      net?.send({ t: 'start' });
      return;
    case 'leave-room':
      net?.send({ t: 'leave' });
      return show('playMenu');
    case 'refresh-ranking':
      return void loadRanking();
    case 'resume':
      void enterFullscreen();
      show(null);
      return game.resume();
    case 'open-settings':
      settingsReturn = current;
      syncSettingsForm();
      return show('settingsMenu');
    case 'settings-back':
      return show(settingsReturn);
    case 'settings-reset':
      settings.reset();
      return syncSettingsForm();
    case 'layout': {
      const from = current;
      show(null);
      game.hud.show(false);
      game.touch.openEditor(() => show(from));
      return;
    }
    case 'quit-match':
      if (game.session?.online) net?.send({ t: 'leave' });
      game.endSession();
      return show('mainMenu');
    case 'end-menu':
      game.endSession();
      return show('mainMenu');
  }
});

$('btnPause').addEventListener('click', () => openPause());
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' && current === null && !game.buyMenu.open) openPause();
  else if (e.code === 'Escape' && game.buyMenu.open) game.buyMenu.toggle(false);
  else if (e.code === 'Escape' && current === 'settingsMenu') show(settingsReturn);
  if (e.code === 'Tab') e.preventDefault();
});
game.onAutoPause = () => {
  game.setMenuView();
  if (current === null) show('pauseMenu');
};

// ------------------------------------------------------------ carregamento

renderMapCards();
syncPicks();
setInterval(() => {
  if (net) $('netPing').textContent = net.connected ? `${Math.round(net.rtt)} ms` : '';
}, 1000);
const fill = $('loadingFill');
const text = $('loadingText');
game
  .init((pct, msg) => {
    fill.style.width = pct + '%';
    text.textContent = msg;
  })
  .then(() => {
    game.setMenuView();
    show('mainMenu');
    // reconexão automática a uma partida online em andamento
    if (Storage.load<string | null>('netToken', null)) void ensureNet().catch(() => {});
  })
  .catch(err => {
    console.error(err);
    text.textContent = 'Erro ao iniciar: ' + (err instanceof Error ? err.message : String(err)) + '. Seu navegador precisa de WebGL.';
  });

(window as unknown as { game: Game; settings: Settings }).game = game;
(window as unknown as { settings: Settings }).settings = settings;
