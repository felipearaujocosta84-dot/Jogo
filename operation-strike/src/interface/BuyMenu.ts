// Loja organizada por categorias, com a imagem de cada arma na skin escolhida.
// As setas ◀ ▶ trocam a skin ali mesmo (vale para a arma na mão e para os outros jogadores verem).
import { BUY_CATEGORIES, EQUIPMENT, WEAPONS, itemName, itemTeam } from '../weapons/WeaponData';
import { buyPrice, canBuy, type BuyerState } from '../economy/Economy';
import { gunThumbnail } from '../weapons/WeaponModels';
import { RARITY_COLOR, skinById } from '../weapons/Skins';

const $ = (id: string) => document.getElementById(id)!;

const GEAR_ICON: Record<string, string> = { vest: '🦺', vesthelm: '⛑', kit: '✂' };

export class BuyMenu {
  open = false;
  private cat = 'rifle';
  private state: BuyerState | null = null;
  private lastKey = '';
  onBuy: (item: string) => void = () => {};
  onClose: () => void = () => {};
  onSkin: (weapon: string, dir: 1 | -1) => void = () => {};
  skinOf: (weapon: string) => string = () => 'default';

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
      const t = e.target as HTMLElement;
      const arrow = t.closest<HTMLElement>('[data-skin]');
      if (arrow) {
        e.stopPropagation();
        this.onSkin(arrow.dataset.skin!, arrow.dataset.dir === '-1' ? -1 : 1);
        this.lastKey = '';
        this.render();
        return;
      }
      const b = t.closest<HTMLElement>('[data-item]');
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
    const cat = BUY_CATEGORIES.find(c => c.id === this.cat)!;
    const skins = cat.items.map(id => this.skinOf(id)).join(',');
    const key = JSON.stringify(st) + this.cat + skins;
    if (key === this.lastKey) return;
    this.lastKey = key;
    $('buyCats').innerHTML = BUY_CATEGORIES.map(c => `<button class="${c.id === this.cat ? 'on' : ''}" data-cat="${c.id}">${c.name}</button>`).join('');
    $('buyItems').innerHTML = cat.items
      .filter(id => !itemTeam(id) || itemTeam(id) === st.team)
      .map(id => {
        const err = canBuy(st, id);
        const w = WEAPONS[id];
        const eq = EQUIPMENT.find(e => e.id === id);
        const gun = w && w.cls !== 'grenade';
        const skin = skinById(gun ? this.skinOf(id) : 'default');
        const img = w ? `<img src="${gunThumbnail(id, skin.id)}" alt="${w.name}" />` : `<div class="gear">${GEAR_ICON[id] ?? '•'}</div>`;
        const stats = w && w.magazine > 0
          ? `<small>Dano ${w.damage} · ${Math.round(w.fireRate * 60)} RPM · ${w.magazine}/${w.reserve}</small>`
          : w?.cls === 'grenade' ? `<small>${id === 'he' ? 'Dano em área' : id === 'flash' ? 'Cega inimigos' : 'Bloqueia a visão'}</small>` : eq ? `<small>${id === 'kit' ? 'Desarme em 5s' : 'Reduz o dano'}</small>` : '';
        const skinRow = gun
          ? `<div class="skinrow" style="--rar:${RARITY_COLOR[skin.rarity]}"><span data-skin="${id}" data-dir="-1">◀</span><em>${skin.name}</em><span data-skin="${id}" data-dir="1">▶</span></div>`
          : '';
        return `<div class="item ${err ? 'no' : ''}" data-item="${id}" title="${err ?? ''}" role="button">${img}<b>${itemName(id)}</b>${skinRow}${stats}<span class="price">$${buyPrice(st, id)}</span>${err ? `<em class="err">${err}</em>` : ''}</div>`;
      })
      .join('');
  }
}
