// Ponto de entrada: tela de carregamento, menus (principal, pausa, configurações),
// tela cheia + orientação horizontal no Android e ligação da interface com o jogo.
import { Game } from './core/Game';
import { Settings, type SettingsData } from './core/Settings';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const settings = new Settings();
const canvas = $<HTMLCanvasElement>('renderCanvas');
const game = new Game(canvas, settings);
document.body.classList.toggle('touch', game.isTouch);

const screens = ['loading', 'mainMenu', 'pauseMenu', 'settingsMenu'] as const;
type ScreenId = (typeof screens)[number] | null;
let current: ScreenId = 'loading';
let settingsReturn: ScreenId = 'mainMenu';
let inMatch = false;

function show(id: ScreenId): void {
  current = id;
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
  document.body.classList.toggle('in-menu', id !== null);
}

async function enterFullscreen(): Promise<void> {
  if (!game.isTouch) return;
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.('landscape');
  } catch {
    /* navegador não permite: o aviso de girar o celular cuida disso */
  }
}

function play(team: 'T' | 'CT'): void {
  void enterFullscreen();
  if (!inMatch || game.team !== team) game.respawn(team);
  inMatch = true;
  show(null);
  game.start();
}

function resume(): void {
  void enterFullscreen();
  show(null);
  game.resume();
}

function openPause(): void {
  if (current !== null) return;
  game.pause();
  game.setMenuView();
  show('pauseMenu');
}

function openSettings(from: ScreenId): void {
  settingsReturn = from;
  syncSettingsForm();
  show('settingsMenu');
}

function openLayoutEditor(from: ScreenId): void {
  show(null);
  game.hud.show(false);
  game.touch.openEditor(() => show(from));
}

// ------------------------------------------------------------ formulário de configurações

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
  el.addEventListener(el instanceof HTMLInputElement && el.type === 'range' ? 'input' : 'change', () => {
    const key = el.dataset.setting as keyof SettingsData;
    let value: unknown;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') value = el.checked;
    else if (el instanceof HTMLInputElement && el.type === 'range') value = parseFloat(el.value);
    else if (key === 'fpsCap') value = parseInt(el.value, 10);
    else value = el.value;
    settings.set(key, value as never);
    const out = el.parentElement?.querySelector('output');
    if (out) out.textContent = formatValue(key, Number(value));
  });
}

// ------------------------------------------------------------ botões dos menus

document.addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!btn) return;
  game.audio.unlock();
  game.audio.play('click');
  switch (btn.dataset.action) {
    case 'play-t': return play('T');
    case 'play-ct': return play('CT');
    case 'resume': return resume();
    case 'respawn-t': game.respawn('T'); return resume();
    case 'respawn-ct': game.respawn('CT'); return resume();
    case 'settings': return openSettings(current);
    case 'settings-back': return show(settingsReturn);
    case 'settings-reset': settings.reset(); return syncSettingsForm();
    case 'layout': return openLayoutEditor(current);
    case 'menu':
      inMatch = false;
      return show('mainMenu');
  }
});

$('btnPause').addEventListener('click', () => openPause());
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' && current === null) openPause();
  if (e.code === 'Escape' && current === 'settingsMenu') show(settingsReturn);
});
game.onAutoPause = () => {
  game.setMenuView();
  show('pauseMenu');
};

// ------------------------------------------------------------ carregamento

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
  })
  .catch(err => {
    console.error(err);
    text.textContent = 'Erro ao iniciar: ' + (err instanceof Error ? err.message : String(err)) + '. Seu navegador precisa de WebGL.';
  });

// Acesso para testes automatizados e depuração
(window as unknown as { game: Game }).game = game;
