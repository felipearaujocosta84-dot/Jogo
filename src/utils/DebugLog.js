// =============================================================
// EXTREME RACING — DebugLog
// Registro de erros visível no próprio celular: guarda os erros e
// avisos do console e mostra um botão "LOG" (vermelho quando há
// erro). O painel permite copiar o texto para enviar ao suporte.
// =============================================================
const lines = [];
const MAX = 200;
let badge = null;
let errorCount = 0;

function push(kind, args) {
  const text = args.map((a) => {
    if (a instanceof Error) return `${a.message}\n${(a.stack || '').split('\n').slice(0, 4).join('\n')}`;
    if (typeof a === 'object') { try { return JSON.stringify(a).slice(0, 400); } catch { return String(a); } }
    return String(a);
  }).join(' ');
  const t = new Date().toTimeString().slice(0, 8);
  lines.push(`[${t}] ${kind}: ${text}`);
  if (lines.length > MAX) lines.shift();
  if (kind === 'ERRO') { errorCount++; updateBadge(); }
}

function updateBadge() {
  if (!badge) return;
  badge.textContent = errorCount ? `LOG (${errorCount})` : 'LOG';
  badge.style.background = errorCount ? '#e3122e' : 'rgba(10,13,19,0.7)';
  badge.style.display = 'block';
}

export const DebugLog = {
  info(...a) { push('INFO', a); },
  warn(...a) { push('AVISO', a); },
  error(...a) { push('ERRO', a); },
  text() { return lines.join('\n'); },

  install() {
    const oe = console.error.bind(console), ow = console.warn.bind(console);
    console.error = (...a) => { push('ERRO', a); oe(...a); };
    console.warn = (...a) => { push('AVISO', a); ow(...a); };
    window.addEventListener('error', (e) => push('ERRO', [e.message, `${e.filename}:${e.lineno}`]));
    window.addEventListener('unhandledrejection', (e) => push('ERRO', ['Promise rejeitada:', e.reason]));
    badge = document.createElement('button');
    badge.textContent = 'LOG';
    Object.assign(badge.style, {
      position: 'fixed', left: '6px', bottom: '6px', zIndex: 80, display: 'none', padding: '6px 10px',
      border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px', color: '#fff', font: '700 12px sans-serif',
      background: 'rgba(10,13,19,0.7)', pointerEvents: 'auto',
    });
    badge.addEventListener('click', () => this.open());
    document.body.appendChild(badge);
  },

  /** Mostra o botão (com ou sem erros). */
  showBadge() { updateBadge(); },

  open() {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { position: 'fixed', inset: '0', zIndex: 90, background: 'rgba(5,7,11,0.94)', display: 'flex', flexDirection: 'column', padding: '10px', gap: '8px' });
    const pre = document.createElement('textarea');
    pre.readOnly = true;
    pre.value = this.text() || '(sem registros)';
    Object.assign(pre.style, { flex: '1', width: '100%', background: '#0c1017', color: '#dfe6ee', font: '11px monospace', border: '1px solid #333', borderRadius: '4px', padding: '8px' });
    const bar = document.createElement('div');
    bar.style.display = 'flex';
    bar.style.gap = '8px';
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.textContent = label;
      Object.assign(b.style, { flex: '1', minHeight: '44px', background: '#e3122e', color: '#fff', border: '0', borderRadius: '4px', font: '800 14px sans-serif' });
      b.addEventListener('click', fn);
      return b;
    };
    bar.append(
      mk('COPIAR', async () => {
        try { await navigator.clipboard.writeText(pre.value); } catch { pre.select(); document.execCommand('copy'); }
      }),
      mk('FECHAR', () => wrap.remove()),
    );
    wrap.append(pre, bar);
    document.body.appendChild(wrap);
  },
};
