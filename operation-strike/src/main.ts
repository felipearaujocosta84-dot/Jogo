// Ponto de entrada: carregamento, todos os menus e a ligação entre interface, sessões e servidor.
import { Game } from './core/Game';
import { Settings, type SettingsData } from './core/Settings';
import { LocalSession, OnlineSession, type Session } from './core/Session';
import { NetClient, normalizeServer } from './multiplayer/NetClient';
import { OnlineScreen } from './interface/OnlineScreen';
import { LanScreen } from './interface/LanScreen';
import { MAP_LIST, MAPS, mapAllows } from './maps/maps';
import { ensureMapData } from './maps/ModelMaps';
import { applyMatch, BOT_MMR, levelFor, rankName, type ProfileData } from './save/Profile';
import { loadLocalProfile, saveLocalProfile } from './save/LocalProfile';
import { Storage } from './save/Storage';
import type { Difficulty, GameMode, Team } from './sim/types';
import { esc } from './interface/Hud';
import { isNativeApp } from './core/Platform';
import { SkinPrefs } from './save/SkinPrefs';
import { randomCosmetics } from './cosmetics/Cosmetics';
import { ArsenalScreen } from './interface/ArsenalScreen';
import { SettingsView } from './interface/SettingsView';
import { CHARACTER_FILES } from './player/CharacterAssets';
import type { SquadMember } from './interface/LobbyScene';
import { BUY_CATEGORIES, WEAPONS } from './weapons/WeaponData';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const settings = new Settings();
const arsenal = new ArsenalScreen();
arsenal.onToast = msg => toast(msg);
arsenal.onEquip = () => {
  if (net?.connected) void net.saveCosmetics(SkinPrefs.all);
};
arsenal.onWeapon = id => {
  agent.weapon = id;
  Storage.save('agent', agent);
};
const canvas = $<HTMLCanvasElement>('renderCanvas');
const game = new Game(canvas, settings);
document.body.classList.toggle('touch', game.isTouch);
document.body.classList.toggle('native', isNativeApp());

const SCREENS = ['loading', 'mainMenu', 'playMenu', 'lobbyScreen', 'onlineScreen', 'lanScreen', 'trainingMenu', 'arsenalScreen', 'profileScreen', 'rankingScreen', 'pauseMenu', 'endScreen', 'settingsMenu'] as const;
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

SkinPrefs.onChange(() => syncLobby());

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
  $('lpMmr').textContent = String(p.mmr);
  $('lpWins').textContent = String(p.wins);
  // patente: nível, nome e progresso dentro da patente (10 marcas)
  $('tierLevel').textContent = String(lv.level);
  $('tierRank').textContent = rankName(p.mmr);
  $('tierMmr').textContent = `${p.mmr} MMR · ${p.matches} partidas`;
  const into = Math.max(0, Math.min(1, (((p.mmr - 600) % 75) + 75) % 75 / 75));
  $('tierPips').innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round(into * 10) ? 'on' : ''}"></i>`).join('');
  // missões: próxima meta de cada estatística do perfil
  const goals: [string, number, number][] = [
    ['Elimine {n} inimigos', p.kills, 50], ['Acerte {n} tiros na cabeça', p.headshots, 25], ['Vença {n} partidas', p.wins, 5],
    ['Seja o MVP {n} vezes', p.mvps, 5], ['Jogue {n} partidas', p.matches, 10], ['Ajude em {n} abates', p.assists, 20]
  ];
  $('missionList').innerHTML = goals.map(([txt, v, step]) => {
    const next = (Math.floor(v / step) + 1) * step;
    const k = (v - (next - step)) / step;
    return `<div class="sq-mis"><p>${txt.replace('{n}', String(next))}</p><em>${v}/${next}</em><div class="bar"><i style="width:${Math.round(k * 100)}%"></i></div></div>`;
  }).join('');
  for (const b of document.querySelectorAll<HTMLElement>('.sq-modes [data-action]')) b.classList.toggle('on', b.dataset.action === (picks.mode === 'tdm' ? 'mode-tdm' : 'mode-competitive'));
  $('missionTag').textContent = picks.mode === 'tdm' ? 'MATA-MATA' : 'CONTRA BOTS';
  $('sqTeam').textContent = `Equipe: ${agent.team === 'T' ? 'TR' : 'CT'} · ${CHARACTER_FILES[agent.team].name}`;
  // cartão da missão: modo, mapa e regras escolhidos (o botão INICIAR começa com eles)
  const map = MAPS[picks.map] ?? MAPS.dust_zone;
  $('missionMap').textContent = map.name;
  $('missionMode').textContent = MODE_LABEL[picks.mode] ?? picks.mode;
  $('missionInfo').textContent = picks.mode === 'tdm'
    ? `${picks.tdmTime} min · ${picks.tdmKills} abates · ${WEAPONS[picks.tdmPrimary]?.name ?? ''}`
    : `Lado inicial: ${picks.side === 'T' ? 'TR' : picks.side === 'CT' ? 'CT' : 'aleatório'}`;
  $('missionDiff').textContent = 'Bots ' + (DIFF_LABEL[picks.difficulty] ?? picks.difficulty);
  $('missionCard').style.background = `linear-gradient(160deg, ${map.ambience.sky[0]}, ${map.ambience.sky[1]} 40%, ${map.ambience.fog} 70%, #2a2622)`;
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
  const bots = squadPick.map((k, i) => {
    const weapon = rifles[i % rifles.length];
    // companheiros com visual e armas personalizados (fixos por nome)
    const cos = randomCosmetics([weapon], k * 7919 + i * 104729 + 17);
    return { name: 'BOT ' + SQUAD_NAMES[k % SQUAD_NAMES.length], level: 8 + ((k * 7 + i * 5) % 33), weapon, skin: cos[weapon] ?? 'default', att: cos['a_' + weapon] ?? '', look: cos['lk_' + agent.team] ?? '' };
  });
  const me: SquadMember = { name: profile.name, level: lv, weapon: agent.weapon, skin: SkinPrefs.get(agent.weapon), att: SkinPrefs.attachments(agent.weapon).join('.'), look: SkinPrefs.lookString(agent.team), me: true };
  void bots;
  // o jogador no centro; nos lados, convites para jogar online
  return [{ ...me, name: '', invite: true }, me, { ...me, name: '', invite: true }];
}

function renderSquad(): void {
  const box = $('squadPlates');
  const list = squadMembers();
  const color = agent.team === 'T' ? 'var(--t)' : 'var(--ct)';
  void color;
  box.innerHTML = list.map(m => m.invite
    ? `<button class="sq-invite" data-action="online-play" aria-label="Convidar para jogar online">+<small>CONVIDAR</small></button>`
    : `<div class="sq-plate me"><b><span class="lead">★</span>${esc(m.name)}</b><small>Nv ${m.level} · ${WEAPONS[m.weapon]?.name ?? ''}</small></div>`).join('');
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
    if (p?.visible) el.style.transform = el.classList.contains('sq-invite') ? `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -50%)` : `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
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
      // troca o modo direto no lobby (o cartão JOGAR mostra o escolhido)
      picks.mode = action === 'mode-tdm' ? 'tdm' : 'competitive';
      Storage.save('picks', picks);
      syncPicks();
      break;
    case 'event-tdm':
      picks.mode = 'tdm';
      Storage.save('picks', picks);
      syncPicks();
      show('playMenu');
      return true;
    case 'online-play':
      online.open('play');
      show('onlineScreen');
      return true;
    case 'lan-play':
      lan.open();
      show('lanScreen');
      return true;
    case 'online-x1':
      online.open('x1');
      show('onlineScreen');
      return true;
    case 'online-friends':
      online.open('friends');
      show('onlineScreen');
      return true;
    case 'inventory':
      arsenal.prepare('inventory', agent.weapon);
      show('arsenalScreen');
      return true;
    case 'customize-character':
      arsenal.prepare('character', agent.weapon);
      show('arsenalScreen');
      return true;
    case 'customize-weapons':
      arsenal.prepare('weapons', agent.weapon);
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
    arsenal.team = agent.team;
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
    void name;
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
  if (s.lan) {
    // Wi-Fi local: só o placar, sem XP/MMR
  } else if (!s.online && me) {
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
  // X1 online: a sala continua aberta para a revanche
  const duel = s.online && !s.lan && s.mode === 'x1';
  $('btnRematch').classList.toggle('hidden', !duel);
  $('btnEndRoom').classList.toggle('hidden', !duel);
  if (s.online && !s.lan && !duel) void net?.leaveGame();
  if (s.online && s.mode === 'br' && me) {
    const place = res.players.find(p => p.id === s.localId)?.place ?? 0;
    $('endTitle').textContent = place === 1 ? '1º LUGAR — VITÓRIA!' : `${place}º LUGAR`;
    $('endTitle').className = place === 1 ? 'win' : 'loss';
    $('endScore').textContent = `Battle Royale · ${res.players.length} participantes · ${MAPS[s.map.def.id].name}`;
  }
  show('endScreen');
}

// ------------------------------------------------------------ online

function httpBase(): string {
  return net?.url ?? (normalizeServer(settings.get('serverUrl') || '') || NetClient.defaultUrl());
}

/** Cliente de rede para o endereço configurado (sem conectar). */
function getNet(): NetClient | null {
  const url = normalizeServer(settings.get('serverUrl') || '') || NetClient.defaultUrl();
  if (!url) return null;
  if (!net || net.url !== url) {
    net?.close();
    net = new NetClient(url);
    online.bind(net);
    net.onStatus = () => online.render();
    net.on(msg => {
      switch (msg.t) {
        case 'room':
          online.setRoom(msg.room);
          if (msg.room.state === 'lobby' && current !== 'onlineScreen' && !game.session) {
            online.open('room');
            show('onlineScreen');
          }
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
          void net!.saveCosmetics(SkinPrefs.all);
          online.render();
          break;
        case 'info':
          if (msg.msg === 'left') online.setRoom(null);
          break;
      }
    });
  }
  return net;
}

/** Conectado e com login (abre a tela de conta se faltar). */
async function ensureNet(): Promise<NetClient> {
  const n = getNet();
  if (!n) {
    online.open('account');
    show('onlineScreen');
    throw new Error('Informe o endereço do servidor');
  }
  if (!n.loggedIn) {
    online.open('account');
    show('onlineScreen');
    throw new Error('Faça login para jogar online');
  }
  await n.connect();
  return n;
}

const lan = new LanScreen();
lan.getName = () => settings.get('playerName') || 'Jogador';
lan.getSkins = () => SkinPrefs.all;
lan.getTeam = () => agent.team;
lan.onToast = (m, ms) => toast(m, ms);
lan.prepareMap = async id => {
  const def = MAPS[id];
  if (def) await ensureMapData(def);
};
lan.onLaunch = s => {
  void enterFullscreen();
  launch(s);
};

const online = new OnlineScreen(() => getNet(), () => ensureNet());
online.onToast = (m, ms) => toast(m, ms);
online.getServer = () => settings.get('serverUrl') || '';
online.setServer = v => {
  settings.set('serverUrl', v);
  Storage.save('serverUrl', v);
  getNet();
  online.render();
};
online.onBadge = n => {
  const el = $('olBadgeMain');
  el.textContent = String(n);
  el.classList.toggle('hidden', n === 0);
};

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
  for (const el of document.querySelectorAll<HTMLSelectElement>('[data-pick]')) el.value = picks[el.dataset.pick!] ?? el.value;
  queueMicrotask(() => settingsView.refresh());
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

const settingsView = new SettingsView();
// escolhas de partida (dificuldade/modo) também ajustáveis nas configurações
for (const el of document.querySelectorAll<HTMLSelectElement>('[data-pick]')) {
  el.addEventListener('change', () => {
    picks[el.dataset.pick!] = el.value;
    Storage.save('picks', picks);
    syncPicks();
    renderLobbyCard();
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
        n.sendSocial('quick', { mode: btn.dataset.action === 'quick-casual' ? 'casual' : 'competitive' });
        toast('Procurando partida…');
      }).catch(e => toast((e as Error).message));
      return;
    case 'end-rematch':
      net?.gameSend('rematch');
      toast('Revanche pedida — esperando o outro jogador');
      return;
    case 'end-room':
      online.open('room');
      return show('onlineScreen');
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
    case 'end-menu': {
      const wasLan = !!game.session?.lan;
      if (btn.dataset.action === 'quit-match' && game.session?.online && !wasLan) void net?.leaveGame();
      game.endSession();
      if (wasLan) {
        // Wi-Fi local: volta para a sala (o anfitrião pode iniciar outra partida)
        lan.open();
        return show('lanScreen');
      }
      return show('mainMenu');
    }
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
  if (current === 'onlineScreen') online.renderStatus();
}, 2000);
const fill = $('loadingFill');
const text = $('loadingText');
game
  .init((pct, msg) => {
    fill.style.width = pct + '%';
    text.textContent = msg;
  })
  .then(() => {
    game.setMenuView();
    $('stDevice').textContent = game.quality.deviceSummary;
    show('mainMenu');
    // reconexão automática a uma partida online em andamento
    // conta salva: conecta (amigos, convites) e retoma uma partida em andamento
    if (Storage.load<string | null>('netSession', null) && getNet()) void ensureNet().catch(() => {});
  })
  .catch(err => {
    console.error(err);
    text.textContent = 'Erro ao iniciar: ' + (err instanceof Error ? err.message : String(err)) + '. Seu navegador precisa de WebGL.';
  });

(window as unknown as { game: Game; settings: Settings }).game = game;
(window as unknown as { settings: Settings }).settings = settings;
(window as unknown as { arsenal: ArsenalScreen }).arsenal = arsenal;
