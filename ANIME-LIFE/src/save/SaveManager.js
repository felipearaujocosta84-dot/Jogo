// Salvamento local: IndexedDB (preferencial) com reserva em localStorage.
import { SAVE_VERSION } from '../core/GameState.js';

const DB_NAME = 'anime-life';
const STORE = 'saves';
const LS_PREFIX = 'anime-life.save.';
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'];

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponível'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r?.result);
    t.onerror = () => reject(t.error);
  });
}

class SaveManager {
  constructor() { this.dbPromise = openDB().catch((e) => { console.warn('[Save] usando localStorage:', e.message); return null; }); }

  async save(state, slot = 'auto') {
    state.updatedAt = Date.now();
    const data = JSON.parse(JSON.stringify(state));
    const db = await this.dbPromise;
    try {
      if (db) await tx(db, 'readwrite', (s) => s.put(data, slot));
      else localStorage.setItem(LS_PREFIX + slot, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('[Save] falha ao salvar', e);
      try { localStorage.setItem(LS_PREFIX + slot, JSON.stringify(data)); return true; } catch { return false; }
    }
  }

  async load(slot = 'auto') {
    const db = await this.dbPromise;
    let data = null;
    try { if (db) data = await tx(db, 'readonly', (s) => s.get(slot)); } catch (e) { console.warn('[Save] leitura IDB falhou', e); }
    if (!data) { try { data = JSON.parse(localStorage.getItem(LS_PREFIX + slot) || 'null'); } catch { data = null; } }
    if (data && data.version !== SAVE_VERSION) data = this.migrate(data);
    return data;
  }

  async has(slot = 'auto') { return !!(await this.load(slot)); }

  async remove(slot = 'auto') {
    const db = await this.dbPromise;
    try { if (db) await tx(db, 'readwrite', (s) => s.delete(slot)); } catch {}
    try { localStorage.removeItem(LS_PREFIX + slot); } catch {}
  }

  migrate(data) { // ponto único para converter saves antigos
    // v1 era a versão de exploração livre (sem história): incompatível, é descartada.
    if (!data.version || data.version < 2) return null;
    data.version = SAVE_VERSION;
    return data;
  }

  /** Resumo de todos os espaços: automático + 3 manuais. */
  async list() {
    const out = {};
    for (const slot of SLOTS) out[slot] = await this.load(slot);
    return out;
  }
}
export const saves = new SaveManager();
