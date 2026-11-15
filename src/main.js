// Ponto de entrada: carrega o jogo, conecta a interface HTML e trata erros.
import { Game } from './game.js';
import { TEAMS } from './config.js';

const $ = (id) => document.getElementById(id);

function showError(err) {
  console.error(err);
  $('loading').classList.add('hidden');
  $('error').classList.remove('hidden');
  $('errorText').textContent = String(err && (err.stack || err.message) || err);
}
window.addEventListener('error', (e) => showError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showError(e.reason));

const ui = {
  setScore(home, away) {
    $('homeScore').textContent = home;
    $('awayScore').textContent = away;
  },
  showGoal(team) {
    const banner = $('goalBanner');
    $('goalTeam').textContent = team.name;
    banner.classList.remove('hidden');
    // reinicia a animação CSS
    banner.style.animation = 'none';
    void banner.offsetWidth;
    banner.style.animation = '';
  },
  hideGoal() {
    $('goalBanner').classList.add('hidden');
  },
  setControlled(player) {
    $('playerNum').textContent = player.number;
    $('playerName').textContent = player.name;
  },
  setStamina(v) {
    $('staminaFill').style.width = `${Math.round(v * 100)}%`;
  },
  setFps(fps, dpr) {
    $('fps').textContent = `${fps.toFixed(0)} FPS · ${dpr.toFixed(2)}x`;
  },
  showPause(on) {
    $('pause').classList.toggle('hidden', !on);
  }
};

function setProgress(pct, text) {
  $('loadingFill').style.width = `${pct}%`;
  $('loadingText').textContent = text;
}

async function requestFullscreenLandscape() {
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch {
    /* nem todo navegador permite (ex.: dentro de iframe) — segue normalmente */
  }
}

function checkOrientation() {
  const portrait = window.innerHeight > window.innerWidth;
  let ignored = false;
  try { ignored = sessionStorage.getItem('rotateIgnored') === '1'; } catch { /* ignora */ }
  $('rotate').classList.toggle('hidden', !portrait || ignored || $('start').classList.contains('hidden') === false);
}

async function boot() {
  $('homeName').textContent = TEAMS.home.name;
  $('awayName').textContent = TEAMS.away.name;

  const game = new Game($('renderCanvas'), ui, $('controls'));
  window.__game = game; // útil para depuração no console
  await game.init(setProgress);

  $('loading').classList.add('hidden');
  $('start').classList.remove('hidden');

  // opções
  const s = game.settings;
  $('optQuality').value = s.get('quality');
  $('optFps').value = String(s.get('fpsCap'));
  $('optSound').checked = s.get('sound');
  $('optShowFps').checked = s.get('showFps');
  $('fps').classList.toggle('hidden', !s.get('showFps'));

  $('optQuality').addEventListener('change', (e) => game.setQuality(e.target.value));
  $('optFps').addEventListener('change', (e) => game.setFpsCap(Number(e.target.value)));
  $('optSound').addEventListener('change', (e) => game.setSound(e.target.checked));
  $('optShowFps').addEventListener('change', (e) => {
    s.set('showFps', e.target.checked);
    $('fps').classList.toggle('hidden', !e.target.checked);
  });

  $('btnStart').addEventListener('click', async () => {
    $('start').classList.add('hidden');
    $('hud').classList.remove('hidden');
    game.start();
    await requestFullscreenLandscape();
    checkOrientation();
  });
  $('btnPause').addEventListener('click', () => {
    game.audio.ui();
    game.pause();
  });
  $('btnResume').addEventListener('click', () => {
    game.audio.unlock();
    game.resume();
    game.audio.ui();
  });
  $('btnReset').addEventListener('click', () => {
    game.audio.ui();
    game.restartPositions();
  });
  $('btnRotateIgnore').addEventListener('click', () => {
    try { sessionStorage.setItem('rotateIgnored', '1'); } catch { /* ignora */ }
    $('rotate').classList.add('hidden');
  });
  window.addEventListener('resize', checkOrientation);
}

boot().catch(showError);
