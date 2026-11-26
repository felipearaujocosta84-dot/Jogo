// Ponto de entrada do ANIME LIFE — MINHA VIDA (visual novel).
import './style.css';
import { UIManager } from './ui/UIManager.js';
import { game } from './core/GameState.js';
import { settings } from './save/Settings.js';
import { Chat } from './smartphone/ChatSystem.js';
import { audio } from './audio/AudioManager.js';
import { voice } from './audio/VoiceManager.js';
import { bus } from './core/EventBus.js';
import { Characters } from './characters/CharacterRegistry.js';

const ui = new UIManager(document.getElementById('ui-root'), document.getElementById('game-root'));
ui.boot();
voice.init().catch((e) => console.warn('[Voz]', e));
bus.on('settings:changed', (k) => { if (k === 'voice' && settings.data.voice === false) voice.stop(); });

// Acesso para testes automatizados e depuração.
window.__ANIME_LIFE__ = { ui, game, settings, chat: Chat, audio, voice, Characters };
window.addEventListener('unhandledrejection', (e) => console.error('[Promise]', e.reason));
