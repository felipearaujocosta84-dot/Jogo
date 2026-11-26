// Controle de custo e abuso (em memória; para várias instâncias, troque por Redis).
// Limites por aparelho, por IP, total do dia e orçamento diário de tokens.
export class Limits {
  constructor(cfg) { this.cfg = cfg; this.reset(); }

  reset() {
    this.day = new Date().toISOString().slice(0, 10);
    this.devices = new Map(); this.ips = new Map();
    this.total = 0; this.tokens = 0;
  }

  rollDay() { if (new Date().toISOString().slice(0, 10) !== this.day) this.reset(); }

  bucket(map, key) {
    let b = map.get(key);
    if (!b) { b = { day: 0, recent: [] }; map.set(key, b); }
    return b;
  }

  /** Verifica antes de chamar a IA. Retorna null se pode, ou { status, code, retryAfter }. */
  check(deviceId, ip) {
    this.rollDay();
    const c = this.cfg, now = Date.now();
    if (this.tokens >= c.dailyTokenBudget) return { status: 429, code: 'orcamento_diario_esgotado', retryAfter: 3600 };
    if (this.total >= c.globalDaily) return { status: 429, code: 'limite_global_diario', retryAfter: 3600 };
    const d = this.bucket(this.devices, deviceId), i = this.bucket(this.ips, ip);
    if (d.day >= c.deviceDaily) return { status: 429, code: 'limite_diario_aparelho', retryAfter: 3600 };
    if (i.day >= c.ipDaily) return { status: 429, code: 'limite_diario_ip', retryAfter: 3600 };
    d.recent = d.recent.filter((t) => now - t < 60000);
    if (d.recent.length >= c.perMinute) return { status: 429, code: 'muitas_mensagens', retryAfter: Math.ceil((60000 - (now - d.recent[0])) / 1000) };
    return null;
  }

  record(deviceId, ip, usage) {
    const d = this.bucket(this.devices, deviceId), i = this.bucket(this.ips, ip);
    d.day++; i.day++; d.recent.push(Date.now()); this.total++;
    this.tokens += (usage?.input || 0) + (usage?.output || 0) * 5; // saída custa ~5x a entrada
  }

  remaining(deviceId) { return Math.max(0, this.cfg.deviceDaily - (this.devices.get(deviceId)?.day || 0)); }
}
