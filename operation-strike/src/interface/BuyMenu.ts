// Loja organizada por categorias. Mostra preço, se pode comprar e o motivo quando não pode.
import { BUY_CATEGORIES, EQUIPMENT, WEAPONS, itemName, itemTeam } from '../weapons/WeaponData';
import { buyPrice, canBuy, type BuyerState } from '../economy/Economy';

const $ = (id: string) => document.getElementById(id)!;

export class BuyMenu {
  open = false;
  private cat = 'rifle';
  private state: BuyerState | null = null;
  private lastKey = '';
  onBuy: (item: string) => void = () => {};
  onClose: () => void = () => {};

  constructor() {
    $('buyClose').addEventListener('click', () => this.toggle(false));
    $('buyCats').addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-cat]');
      if (!b) return;
      this.cat = b.dataset.cat!;
      this.lastKey = '';
      this.render();
    });
    $('buyItems').addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-item]');
      if (b) this.onBuy(b.dataset.item!);
    });
  }

  toggle(v?: boolean): void {
    const was = this.open;
    this.open = v ?? !this.open;
    $('buyMenu').classList.toggle('hidden', !this.open);
    this.lastKey = '';
    if (was && !this.open) this.onClose();
    if (this.open) this.render();
  }

  update(state: BuyerState, canBuyNow: boolean, timeLeft: number): void {
    this.state = state;
    if (!this.open) return;
    if (!canBuyNow) {
      this.toggle(false);
      return;
    }
    $('buyMoney').textContent = '$ ' + state.money;
    $('buyTime').textContent = timeLeft < 900 ? `${Math.ceil(timeLeft)}s para comprar` : '';
    this.render();
  }

  private render(): void {
    const st = this.state;
    if (!st) return;
    const key = JSON.stringify(st) + this.cat;
    if (key === this.lastKey) return;
    this.lastKey = key;
    $('buyCats').innerHTML = BUY_CATEGORIES.map(c => `<button class="${c.id === this.cat ? 'on' : ''}" data-cat="${c.id}">${c.name}</button>`).join('');
    const cat = BUY_CATEGORIES.find(c => c.id === this.cat)!;
    $('buyItems').innerHTML = cat.items
      .filter(id => !itemTeam(id) || itemTeam(id) === st.team)
      .map(id => {
        const err = canBuy(st, id);
        const w = WEAPONS[id];
        const eq = EQUIPMENT.find(e => e.id === id);
        const stats = w && w.magazine > 0
          ? `<small>Dano ${w.damage} · ${Math.round(w.fireRate * 60)} RPM · ${w.magazine}/${w.reserve}</small>`
          : w?.cls === 'grenade' ? `<small>${id === 'he' ? 'Dano em área' : id === 'flash' ? 'Cega inimigos' : 'Bloqueia a visão'}</small>` : eq ? `<small>${id === 'kit' ? 'Desarme em 5s' : 'Reduz o dano'}</small>` : '';
        return `<button class="item ${err ? 'no' : ''}" data-item="${id}" title="${err ?? ''}"><b>${itemName(id)}</b>${stats}<span>$${buyPrice(st, id)}</span>${err ? `<em>${err}</em>` : ''}</button>`;
      })
      .join('');
  }
}
