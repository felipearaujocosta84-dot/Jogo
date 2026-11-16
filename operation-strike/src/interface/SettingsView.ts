// Tela de configurações: arco de botões redondos à esquerda (Áudio, Gráficos, Controles, Geral, Conta, Sair) e,
// à direita, as opções da página escolhida. Listas e liga/desliga viram fileiras de opções com marcador
// (o <select>/<input> original continua no lugar e é quem guarda o valor: o resto do jogo não muda).
const $ = (id: string) => document.getElementById(id) as HTMLElement;

export class SettingsView {
  private page = 'graphics';

  constructor() {
    const root = $('settingsMenu');
    for (const el of root.querySelectorAll<HTMLSelectElement | HTMLInputElement>('.st-dots')) {
      const box = document.createElement('div');
      box.className = 'dots';
      const opts: [string, string][] = el instanceof HTMLSelectElement ? [...el.options].map(o => [o.value, o.text]) : [['1', 'Ligado'], ['0', 'Desligado']];
      box.innerHTML = opts.map(([v, t]) => {
        const sw = el.dataset.setting === 'crosshairColor' ? `<i class="sw" style="background:${v}"></i>` : '';
        return `<button type="button" data-v="${v}">${sw}${t}</button>`;
      }).join('');
      el.style.display = 'none';
      el.after(box);
      box.addEventListener('click', e => {
        const b = (e.target as HTMLElement).closest<HTMLElement>('[data-v]');
        if (!b) return;
        if (el instanceof HTMLInputElement) el.checked = b.dataset.v === '1';
        else el.value = b.dataset.v!;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        this.refresh();
      });
    }
    root.querySelector('.st-arc')!.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-st]');
      if (!b) return;
      this.page = b.dataset.st!;
      this.refresh();
    });
    this.refresh();
  }

  /** Atualiza a página visível e os marcadores (depois que o jogo preenche os valores). */
  refresh(): void {
    const root = $('settingsMenu');
    for (const b of root.querySelectorAll<HTMLElement>('[data-st]')) b.classList.toggle('on', b.dataset.st === this.page);
    for (const p of root.querySelectorAll<HTMLElement>('.st-page')) p.classList.toggle('on', p.dataset.page === this.page);
    for (const el of root.querySelectorAll<HTMLSelectElement | HTMLInputElement>('.st-dots')) {
      const v = el instanceof HTMLInputElement ? (el.checked ? '1' : '0') : el.value;
      const box = el.nextElementSibling;
      if (box) for (const b of box.querySelectorAll<HTMLElement>('[data-v]')) b.classList.toggle('on', b.dataset.v === v);
    }
  }
}
