// Ponto de entrada: carregamento, todos os menus e a ligação entre interface, sessões e servidor.
import { Game } from './core/Game';
import { Settings, type SettingsData } from './core/Settings';
import { LocalSession, OnlineSession, type Session } from './core/Session';
import { NetClient } from './multiplayer/NetClient';
import type { RoomInfo } from './multiplayer/Protocol';
import { MAP_LIST, MAPS, mapAllows } from './maps/maps';
import { ensureMapData } from './maps/ModelMaps';
import { applyMatch, BOT_MMR, levelFor, rankName, type ProfileData } from './save/Profile';
import { loadLocalProfile, saveLocalProfile } from './save/LocalProfile';
import { Storage } from './save/Storage';
import type { Difficulty, GameMode, Team } from './sim/types';
import { esc } from './interface/Hud';
import { isNativeApp } from './core/Platform';
import { SkinPrefs } from './save/SkinPrefs';
import { ArsenalScreen } from './interface/ArsenalScreen';
import { CHARACTER_FILES } from './player/CharacterAssets';
import type { SquadMember } from './interface/LobbyScene';
import { BUY_CATEGORIES, WEAPONS } from './weapons/WeaponData';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const settings = new Settings();
const arsenal = new ArsenalScreen();
arsenal.onToast = msg => toast(msg);
arsenal.onEquip = () => {
  if (net?.connected) net.send({ t: 'skins', skins: SkinPrefs.all });
};
arsenal.onWeapon = id => {
  agent.weapon = id;
  Storage.save('agent', agent);
};
const canvas = $<HTMLCanvasElement>('renderCanvas');
const game = new Game(canvas, settings);
document.body.classList.toggle('touch', game.isTouch);
document.body.classList.toggle('native', isNativeApp());

const SCREENS = ['loading', 'mainMenu', 'playMenu', 'lobbyScreen', 'trainingMenu', 'arsenalScreen', 'profileScreen', 'rankingScreen', 'pauseMenu', 'endScreen', 'settingsMenu'] as const;
type ScreenId = (typeof SCREENS)[number] | null;
let current: ScreenId = 'loading';
let settingsReturn: ScreenId = 'mainMenu';
let net: NetClient | null = null;
let profile = loadLocalProfile(settings.get('playerName'));

// ------------------------------------------------------------ lobby 3D

/** Telas em que o lobby 3D aparece ao fundo (fora de partida). */
const LOBBY_SCREENS = new Set<string>(['mainMenu', 'playMenu', 'lobbyScreen', 'trainingMenu', 'profileScreen', 'rankingScreen', 'settingsMenu']);
const LOBBY_WEAPONS = BUY_CATEGORIES.filter(c => c.id !== 'grenade' && c.id !== 'gear').flatMap(c => c.items);
const agent = Object.assign({ team: 'CT' as Team, variant: 0, weapon: 'ak47' }, Storage.load<Partial<{ team: Team; variant: number; weapon: string }>>('agent', {}));
if (!WEAPONS[agent.weapon]) agent.weapon = 'ak47';

function syncLobby(): void {
  const l = game.lobby;
  if (!l) return;
  l.active = current !== null && LOBBY_SCREENS.has(current) && !game.session;
  l.setSquad(squadMembers());
  l.setLoadout(agent.team, agent.variant, agent.weapon, SkinPrefs.get(agent.weapon));
  l.focus(current === 'profileScreen');
}

const MODE_LABEL: Record<string, string> = { competitive: 'Competitivo 5v5', casual: 'Casual', tdm: 'Mata-mata em equipe', training: 'Treinamento' };
const DIFF_LABEL: Record<string, string> = { easy: 'Fácil', normal: 'Normal', hard: 'Difícil' };

function renderLobbyCard(): void {
  const p = profile;
  const lv = levelFor(p.xp);
  $('lpLevel').textContent = String(lv.level);
  $('lpName').textContent = p.name;
  $('lpRank').textContent = `${rankName(p.mmr)} · ${p.mmr} MMR`;
  $('lpXp').style.width = Math.round((lv.into / lv.need) * 100) + '%';
  $('lpXpText').textContent = `${lv.into} / ${lv.need} XP para o nível ${lv.level + 1}`;
  $('lpCoins').textContent = (p.coins ?? 0).toLocaleString('pt-BR');
  $('sqTeam').textContent = `Equipe: ${agent.team === 'T' ? 'TR' : 'CT'} · ${CHARACTER_FILES[agent.team].name}`;
  // cartão da missão: modo, mapa e regras escolhidos (o botão INICIAR começa com eles)
  const map = MAPS[picks.map] ?? MAPS.dust_zone;
  $('missionMap').textContent = map.name;
  $('missionMode').textContent = MODE_LABEL[picks.mode] ?? picks.mode;
  $('missionInfo').textContent = picks.mode === 'tdm'
    ? `${picks.tdmTime} min · ${picks.tdmKills} abates · ${WEAPONS[picks.tdmPrimary]?.name ?? ''}`
    : `Lado inicial: ${picks.side === 'T' ? 'TR' : picks.side === 'CT' ? 'CT' : 'aleatório'}`;
  $('missionDiff').textContent = 'Bots ' + (DIFF_LABEL[picks.difficulty] ?? picks.difficulty);
  $('missionCard').style.background = `linear-gradient(0deg, rgba(5,9,13,0.85), rgba(5,9,13,0.1) 70%), linear-gradient(160deg, ${map.ambience.sky[0]}, ${map.ambience.sky[1]} 45%, ${map.ambience.fog} 70%, #2a2622)`;
  renderSquad();
}

// ------------------------------------------------------------ esquadrão do lobby (jogador + 3 companheiros)

const SQUAD_NAMES = ['Viper', 'Falcão', 'Raven', 'Ghost', 'Cobra', 'Titan', 'Lince', 'Spectre', 'Nômade', 'Atlas', 'Jaguar', 'Orion'];
const squadPick = Storage.load<number[] | null>('squad', null) ?? (() => {
  const idx = [...SQUAD_NAMES.keys()].sort(() => Math.random() - 0.5).slice(0, 3);
  Storage.save('squad', idx);
  return idx;
})();

function squadMembers(): SquadMember[] {
  const rifles = agent.team === 'T' ? ['ak47', 'mac10', 'awp'] : ['m4a4', 'aug', 'mp5'];
  const lv = levelFor(profile.xp).level;
  const bots = squadPick.map((k, i) => ({ name: 'BOT ' + SQUAD_NAMES[k % SQUAD_NAMES.length], level: 8 + ((k * 7 + i * 5) % 33), weapon: rifles[i % rifles.length], skin: 'default' }));
  const me: SquadMember = { name: profile.name, level: lv, weapon: agent.weapon, skin: SkinPrefs.get(agent.weapon), me: true };
  return [bots[0], me, bots[1], bots[2]];
}

function renderSquad(): void {
  const box = $('squadPlates');
  const list = squadMembers();
  const color = agent.team === 'T' ? 'var(--t)' : 'var(--ct)';
  box.innerHTML = list.map(m => `<div class="sq-plate${m.me ? ' me' : ''}" style="--pc:${color}"><span class="av">${esc(m.name.replace('BOT ', '')[0] ?? '?')}</span><div><b>${m.me ? '<span class="lead">★</span>' : ''}${esc(m.name)}</b><small>Nv ${m.level} · ${WEAPONS[m.weapon]?.name ?? ''}</small></div></div>`).join('');
}

// plaquinhas acompanham os personagens na tela
function updatePlates(): void {
  requestAnimationFrame(updatePlates);
  const l = game.lobby;
  if (!l || current !== 'mainMenu') return;
  const els = $('squadPlates').children;
  for (let i = 0; i < els.length; i++) {
    const p = l.plates[i];
    const el = els[i] as HTMLElement;
    el.style.display = p?.visible ? '' : 'none';
    if (p?.visible) el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translateX(-50%)`;
  }
}
requestAnimationFrame(updatePlates);

function lobbyAction(action: string): boolean {
  switch (action) {
    case 'lobby-weapon-prev':
    case 'lobby-weapon-next': {
      const i = LOBBY_WEAPONS.indexOf(agent.weapon);
      const d = action.endsWith('next') ? 1 : -1;
      agent.weapon = LOBBY_WEAPONS[(i + d + LOBBY_WEAPONS.length) % LOBBY_WEAPONS.length];
      break;
    }
    case 'lobby-agent-prev':
    case 'lobby-agent-next':
      agent.variant = (agent.variant + (action.endsWith('next') ? 1 : 4)) % 5;
      break;
    case 'lobby-team':
      agent.team = agent.team === 'T' ? 'CT' : 'T';
      // o lado escolhido no lobby vira o lado inicial das partidas
      picks.side = agent.team;
      Storage.save('picks', picks);
      syncPicks();
      break;
    case 'mode-competitive':
    case 'mode-tdm':
      picks.mode = action === 'mode-tdm' ? 'tdm' : 'competitive';
      Storage.save('picks', picks);
      syncPicks();
      show('playMenu');
      return true;
    case 'online-play':
      show('playMenu');
      (document.querySelector('.tab[data-tab="online"]') as HTMLElement | null)?.click();
      return true;
    case 'inventory':
      arsenal.prepare('inventory', agent.weapon);
      show('arsenalScreen');
      return true;
    default:
      return false;
  }
  Storage.save('agent', agent);
  renderLobbyCard();
  syncLobby();
  return true;
}

function show(id: ScreenId): void {
  current = id;
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  document.body.classList.toggle('in-menu', id !== null);
  if (id === 'mainMenu') {
    refreshMenuRank();
    syncSettingsForm();
  }
  syncLobby();
  if (id === 'profileScreen') renderProfile(profileTab);
  if (id === 'rankingScreen') void loadRanking();
  if (id === 'arsenalScreen') {
    updateSkinLevel();
    arsenal.open();
  } else arsenal.close();
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
  if (!game.isTouch || isNativeApp()) return; // no app a tela cheia e a orientação são nativas
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.('landscape');
  } catch {
    /* sem suporte: o aviso de girar o celular cuida disso */
  }
}

function updateSkinLevel(): void {
  SkinPrefs.level = Math.max(levelFor(profile.xp).level, net?.profile ? levelFor(net.profile.xp).level : 1);
}

function refreshMenuRank(): void {
  updateSkinLevel();
  renderLobbyCard();
}

// ------------------------------------------------------------ escolhas (botões segmentados)

const picks: Record<string, string> = { mode: 'competitive', map: 'dust_zone', difficulty: 'normal', side: 'T', tmap: 'dust_zone', tside: 'T', tdmTime: '10', tdmKills: '50', tdmPrimary: 'ak47', tdmSecondary: 'glock' };
Object.assign(picks, Storage.load<Record<string, string>>('picks', {}));

/** Botões de escolha de arma do mata-mata. */
function renderTdmWeapons(): void {
  const cat = (ids: string[]) => ids.filter(id => WEAPONS[id]).map(id => `<button data-v="${id}">${WEAPONS[id].name}</button>`).join('');
  const prim = BUY_CATEGORIES.filter(c => c.id !== 'pistol' && c.id !== 'grenade' && c.id !== 'gear').flatMap(c => c.items);
  const pist = BUY_CATEGORIES.find(c => c.id === 'pistol')?.items ?? [];
  $('tdmPrimary').innerHTML = cat(prim);
  $('tdmSecondary').innerHTML = cat(['glock', 'usp', ...pist.filter(p => p !== 'glock' && p !== 'usp')]);
}

function renderMapCards(): void {
  for (const box of document.querySelectorAll<HTMLElement>('.maps')) {
    const key = box.dataset.pick!;
    // treino usa os locais de bomba: só mapas clássicos
    const list = key === 'tmap' ? MAP_LIST.filter(m => !m.model) : MAP_LIST;
    box.innerHTML = list.map(m => `<button data-v="${m.id}" class="mapcard ${picks[key] === m.id ? 'on' : ''}" style="--sky:${m.ambience.sky[1]};--ground:${m.ambience.fog}"><b>${m.name}</b><small>${m.description}</small>${m.model ? '<i class="mapbadge">MATA-MATA · 3D</i>' : ''}</button>`).join('');
  }
}

function syncPicks(): void {
  $('playMenu').classList.toggle('mode-tdm', picks.mode === 'tdm');
  for (const box of document.querySelectorAll<HTMLElement>('[data-pick]')) {
    const key = box.dataset.pick!;
    for (const b of box.querySelectorAll<HTMLElement>('[data-v]')) b.classList.toggle('on', b.dataset.v === picks[key]);
  }
}

document.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-v]');
  const box = b?.closest<HTMLElement>('[data-pick]');
  if (b && box) {
    const key = box.dataset.pick!;
    picks[key] = b.dataset.v!;
    // mapas de modelo 3D só têm mata-mata; modos com bomba voltam para um mapa clássico
    const map = MAPS[picks.map];
    if (key === 'map' && map && !mapAllows(map, picks.mode)) {
      picks.mode = 'tdm';
      toast(`${map.name}: mapa de Mata-mata em equipe`);
    } else if (key === 'mode' && map && !mapAllows(map, picks.mode)) {
      picks.map = MAP_LIST.find(m => mapAllows(m, picks.mode))!.id;
      toast(`Modo com bomba: mapa trocado para ${MAPS[picks.map].name}`);
    }
    Storage.save('picks', picks);
    // escolher o lado mostra o personagem daquela equipe no lobby
    if (key === 'side' && (picks.side === 'T' || picks.side === 'CT') && agent.team !== picks.side) {
      agent.team = picks.side;
      Storage.save('agent', agent);
      renderLobbyCard();
      syncLobby();
    }
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

let starting = false;

async function startLocal(mode: GameMode, mapId: string, difficulty: Difficulty, side: string): Promise<void> {
  if (starting) return;
  const def = MAPS[mapId] ?? MAPS.dust_zone;
  if (!mapAllows(def, mode)) mode = 'tdm';
  void enterFullscreen();
  if (def.model && !def.colliders) {
    starting = true;
    toast('Carregando mapa…', 8000);
    try {
      await ensureMapData(def);
      toast(`${def.name} pronto`, 900);
    } catch (e) {
      toast('Não foi possível carregar o mapa: ' + (e as Error).message, 4000);
      return;
    } finally {
      starting = false;
    }
  }
  const team: Team = side === 'random' ? (Math.random() < 0.5 ? 'T' : 'CT') : (side as Team);
  updateSkinLevel();
  const tdm = mode === 'tdm'
    ? { timeLimit: +picks.tdmTime || 10, killLimit: +picks.tdmKills || 50, loadout: { primary: picks.tdmPrimary || null, secondary: picks.tdmSecondary || null } }
    : {};
  const session = new LocalSession({ mapId, mode, difficulty, teamSize: 5, ...tdm }, settings.get('playerName'), team, SkinPrefs.all);
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
  $('endScore').textContent = `TR ${res.scoreT} x ${res.scoreCT} CT${s.mode === 'tdm' ? ' abates' : ''} · ${s.mode === 'competitive' ? 'Competitivo' : s.mode === 'tdm' ? 'Mata-mata em equipe' : 'Casual'} · ${MAPS[s.map.def.id].name}`;
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
  const mine = me
    ? (() => {
        const kd = me.deaths ? me.kills / me.deaths : me.kills;
        const hs = me.kills ? Math.round((me.headshots / me.kills) * 100) : 0;
        const c = (v: string | number, l: string) => `<div><b>${v}</b><small>${l}</small></div>`;
        return `<div class="end-me">${c(me.kills, 'ABATES')}${c(me.deaths, 'MORTES')}${c(me.assists, 'ASSIST.')}${c(kd.toFixed(2), 'K/D')}${c(hs + '%', 'NA CABEÇA')}${c(Math.round(me.damage), 'DANO')}${c(me.mvps, 'MVP')}</div>`;
      })()
    : '';
  if (pdata && rec) {
    const lv = levelFor(pdata.xp);
    $('endProfile').innerHTML = mine + `<div><b>+${rec.xp} XP</b> · Nível ${lv.level} <div class="xpbar"><i style="width:${Math.round((lv.into / lv.need) * 100)}%"></i></div></div>
      <div>${s.mode === 'competitive' ? `MMR ${rec.mmrDelta >= 0 ? '+' : ''}${rec.mmrDelta} → <b>${pdata.mmr}</b> · ${rankName(pdata.mmr)}` : s.mode === 'tdm' ? 'Mata-mata não altera o MMR' : 'Partida casual não altera o MMR'}${rec.coins ? ` · <b>+${rec.coins}</b> moedas` : ''}</div>`;
  } else $('endProfile').innerHTML = mine;
  if (s.online) net?.send({ t: 'leave' });
  show('endScreen');
}

// ------------------------------------------------------------ online

function httpBase(): string {
  const url = net?.url ?? (settings.get('serverUrl') || NetClient.defaultUrl());
  return url.replace(/^ws/, 'http').replace(/\/ws$/, '');
}

async function ensureNet(): Promise<NetClient> {
  if (net && net.connected) return net;
  const url = settings.get('serverUrl') || NetClient.defaultUrl();
  if (!url) {
    toast('Informe o endereço do servidor em Configurações → Servidor online (ex.: ws://192.168.0.10:8080/ws)', 5000);
    throw new Error('Servidor não configurado');
  }
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
          const def = MAPS[msg.mapId];
          void (def ? ensureMapData(def) : Promise.resolve())
            .then(() => {
              const session = new OnlineSession(net!, msg.mapId, msg.mode, msg.you);
              void enterFullscreen();
              launch(session);
            })
            .catch(e => toast('Não foi possível carregar o mapa: ' + (e as Error).message, 4000));
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
          updateSkinLevel();
          net!.send({ t: 'skins', skins: SkinPrefs.all });
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
        .map(r => `<button class="room" data-room="${r.code}"><b>${r.code}</b> ${MAPS[r.mapId]?.name ?? r.mapId} · ${r.mode === 'competitive' ? 'Competitivo' : r.mode === 'tdm' ? 'Mata-mata' : 'Casual'} · ${r.humans}/10 humanos · ${r.state === 'lobby' ? 'no lobby' : 'em jogo'} · MMR ${r.avgMmr}</button>`)
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
  $('lobbyInfo').textContent = `${MAPS[r.mapId]?.name} · ${r.mode === 'competitive' ? 'Competitivo' : r.mode === 'tdm' ? 'Mata-mata' : 'Casual'} · bots ${diff}${r.countdown > 0 && r.state === 'lobby' ? ` · começa em ${r.countdown}s` : ''}`;
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
  if (lobbyAction(btn.dataset.action!)) return;
  switch (btn.dataset.action) {
    case 'start-bots':
      return void startLocal(picks.mode as GameMode, picks.map, picks.difficulty as Difficulty, picks.side);
    case 'start-training':
      return void startLocal('training', MAPS[picks.tmap]?.model ? 'dust_zone' : picks.tmap, 'easy', picks.tside);
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
      void ensureNet().then(n => n.send({ t: 'create', mode: picks.mode === 'casual' ? 'casual' : picks.mode === 'tdm' ? 'tdm' : 'competitive', mapId: picks.map, difficulty: picks.difficulty as Difficulty, isPublic: $<HTMLInputElement>('roomPublic').checked })).catch(() => {});
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
renderTdmWeapons();
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
