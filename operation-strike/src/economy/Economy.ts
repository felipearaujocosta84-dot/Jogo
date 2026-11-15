// Economia: recompensas e validação de compras (compartilhado entre cliente e servidor).
import { EQUIPMENT, WEAPONS, itemPrice, itemTeam } from '../weapons/WeaponData';
import type { Team } from '../sim/types';

export const REWARD = {
  winElimination: 3250,
  winBomb: 3500,
  winDefuse: 3500,
  winTime: 3250,
  lossBase: 1400,
  lossStep: 500,
  lossMax: 3400,
  plantedLossBonus: 800,
  plant: 300,
  defuse: 300,
  teamKill: -300
};

export function lossBonus(streak: number): number {
  return Math.min(REWARD.lossMax, REWARD.lossBase + REWARD.lossStep * Math.max(0, streak - 1));
}

export interface BuyerState {
  team: Team;
  money: number;
  primary?: string;
  secondary?: string;
  armor: number;
  helmet: boolean;
  kit: boolean;
  nades: { he: number; flash: number; smoke: number };
}

/** Verifica se a compra é possível. Retorna mensagem de erro ou null. */
export function canBuy(b: BuyerState, item: string): string | null {
  const t = itemTeam(item);
  if (t && t !== b.team) return 'Item exclusivo do outro lado';
  if (!WEAPONS[item] && !EQUIPMENT.some(e => e.id === item)) return 'Item desconhecido';
  let price = itemPrice(item);
  if (item === 'vesthelm' && b.armor >= 100) price = 350;
  if (b.money < price) return 'Dinheiro insuficiente';
  if (item === 'vest' && b.armor >= 100) return 'Colete já está completo';
  if (item === 'vesthelm' && b.armor >= 100 && b.helmet) return 'Você já tem colete e capacete';
  if (item === 'kit' && b.kit) return 'Você já tem o kit';
  const w = WEAPONS[item];
  if (w) {
    if (w.slot === 'primary' && b.primary === item) return 'Você já tem esta arma';
    if (w.slot === 'secondary' && b.secondary === item) return 'Você já tem esta arma';
    if (w.cls === 'grenade') {
      const total = b.nades.he + b.nades.flash + b.nades.smoke;
      if (total >= 4) return 'Limite de granadas';
      const key = item as 'he' | 'flash' | 'smoke';
      if (b.nades[key] >= (key === 'flash' ? 2 : 1)) return 'Limite desta granada';
    }
  }
  return null;
}

export function buyPrice(b: BuyerState, item: string): number {
  if (item === 'vesthelm' && b.armor >= 100) return 350;
  return itemPrice(item);
}
