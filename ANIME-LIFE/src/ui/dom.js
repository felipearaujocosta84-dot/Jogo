// Utilitários de DOM da interface.
export const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export async function showEl(el) { el.classList.remove('hidden'); await new Promise(requestAnimationFrame); el.classList.add('show'); }
export async function hideEl(el, ms = 300) { el.classList.remove('show'); await wait(ms); el.classList.add('hidden'); }
