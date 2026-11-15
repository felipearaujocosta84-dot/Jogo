// Acesso seguro ao armazenamento local. Em modo anônimo ou com dados bloqueados
// o localStorage pode falhar: o jogo continua funcionando, apenas sem salvar.
const PREFIX = 'opstrike.';

export const Storage = {
  load<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  save(key: string, value: unknown): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* armazenamento indisponível */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignorado */
    }
  }
};
