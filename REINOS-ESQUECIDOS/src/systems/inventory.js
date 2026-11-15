// Inventário: itens, ouro, equipamento (arma e armadura), uso e venda.

export const ITEMS = {
  pocao: { name: 'Poção de Vida', icon: '🧪', type: 'consumivel', desc: 'Recupera vida. Use pelo botão de poção.', price: 20, sell: 8 },
  erva_lunar: { name: 'Erva Lunar', icon: '🌿', type: 'missao', desc: 'Planta que brilha à beira do Lago Azul. A curandeira precisa dela.', sell: 0 },
  pele_lobo: { name: 'Pele de Lobo', icon: '🐺', type: 'material', desc: 'Pele grossa. Vale algumas moedas.', sell: 6 },
  dente_goblin: { name: 'Dente de Goblin', icon: '🦷', type: 'material', desc: 'Troféu nojento, mas o ferreiro compra.', sell: 9 },
  seda_aranha: { name: 'Seda de Aranha', icon: '🕸️', type: 'material', desc: 'Fio resistente e leve.', sell: 10 },
  osso_antigo: { name: 'Osso Antigo', icon: '🦴', type: 'material', desc: 'Restos de um guerreiro esquecido.', sell: 14 },

  espada_curta: { name: 'Espada Curta', icon: '🗡️', type: 'arma', atk: 4, desc: 'Lâmina simples de aprendiz.', sell: 5, color: [0.7, 0.72, 0.76], length: 0.85 },
  espada_aco: { name: 'Espada de Aço', icon: '⚔️', type: 'arma', atk: 10, desc: 'Bem forjada e equilibrada.', price: 180, sell: 60, color: [0.82, 0.84, 0.9], length: 1 },
  machado_guerra: { name: 'Machado de Guerra', icon: '🪓', type: 'arma', atk: 15, desc: 'Pesado, golpes devastadores.', price: 340, sell: 110, color: [0.55, 0.52, 0.5], length: 1.05 },
  lamina_runica: { name: 'Lâmina Rúnica', icon: '✨', type: 'arma', atk: 24, desc: 'A espada do Rei Esquecido. Runas azuis pulsam no aço.', sell: 300, color: [0.6, 0.8, 1], glow: [0.15, 0.35, 0.6], length: 1.15 },

  roupas: { name: 'Roupas de Viagem', icon: '👕', type: 'armadura', def: 0, desc: 'Capa e couro leve.', sell: 0 },
  gibao_couro: { name: 'Gibão de Couro', icon: '🦺', type: 'armadura', def: 3, desc: 'Couro fervido e reforçado.', price: 90, sell: 30 },
  cota_malha: { name: 'Cota de Malha', icon: '🛡️', type: 'armadura', def: 6, desc: 'Anéis de ferro entrelaçados.', price: 230, sell: 80 },
  armadura_guardiao: { name: 'Armadura do Guardião', icon: '🏰', type: 'armadura', def: 10, desc: 'Usada pelos antigos guardiões do reino.', sell: 200 }
};

export const SHOP = ['pocao', 'gibao_couro', 'espada_aco', 'cota_malha', 'machado_guerra'];

export class Inventory {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.items = { pocao: 3, espada_curta: 1, roupas: 1 };
    this.gold = 25;
    this.weapon = 'espada_curta';
    this.armor = 'roupas';
    this.changed();
  }

  changed() {
    if (this.game.onInventoryChanged) this.game.onInventoryChanged();
  }

  count(id) { return this.items[id] || 0; }
  has(id, n = 1) { return this.count(id) >= n; }

  add(id, qty = 1) {
    if (id === 'ouro') { this.gold += qty; this.changed(); return; }
    if (!ITEMS[id]) return;
    this.items[id] = this.count(id) + qty;
    this.changed();
  }

  remove(id, qty = 1) {
    if (!this.has(id, qty)) return false;
    this.items[id] -= qty;
    if (this.items[id] <= 0 && id !== this.weapon && id !== this.armor) delete this.items[id];
    this.changed();
    return true;
  }

  equip(id) {
    const it = ITEMS[id];
    if (!it || !this.has(id)) return;
    if (it.type === 'arma') this.weapon = id;
    if (it.type === 'armadura') this.armor = id;
    this.game.player.setEquipmentLook(ITEMS[this.weapon]);
    this.changed();
  }

  weaponAttack() { return (ITEMS[this.weapon] && ITEMS[this.weapon].atk) || 0; }
  armorDefense() { return (ITEMS[this.armor] && ITEMS[this.armor].def) || 0; }

  buy(id) {
    const it = ITEMS[id];
    if (!it || !it.price) return 'Item indisponível';
    if (this.gold < it.price) return 'Ouro insuficiente';
    if ((it.type === 'arma' || it.type === 'armadura') && this.has(id)) return 'Você já tem este item';
    this.gold -= it.price;
    this.add(id, 1);
    return null;
  }

  sell(id) {
    const it = ITEMS[id];
    if (!it || !it.sell || !this.has(id)) return false;
    if (id === this.weapon || id === this.armor) return false;
    this.remove(id, 1);
    this.gold += it.sell;
    this.changed();
    return true;
  }

  list() {
    const order = { arma: 0, armadura: 1, consumivel: 2, missao: 3, material: 4 };
    return Object.entries(this.items)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ id, n, ...ITEMS[id] }))
      .sort((a, b) => order[a.type] - order[b.type]);
  }

  serialize() {
    return { items: { ...this.items }, gold: this.gold, weapon: this.weapon, armor: this.armor };
  }

  deserialize(d) {
    if (!d) return;
    this.items = { ...d.items };
    this.gold = d.gold || 0;
    this.weapon = ITEMS[d.weapon] ? d.weapon : 'espada_curta';
    this.armor = ITEMS[d.armor] ? d.armor : 'roupas';
    this.game.player.setEquipmentLook(ITEMS[this.weapon]);
    this.changed();
  }
}
