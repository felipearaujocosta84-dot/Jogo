// Missões: definição, progresso (abates/coleta), entrega e diálogos dos NPCs.

export const QUESTS = {
  lobos_vale: {
    title: 'Lobos no Vale', giver: 'anciao', main: true,
    desc: 'Uma alcateia ataca os viajantes na estrada do Vale Verde. Abata 5 lobos.',
    obj: { type: 'kill', target: 'lobo', count: 5, label: 'Lobos abatidos', region: 'vale' },
    reward: { xp: 80, gold: 40, items: [['pocao', 2]] },
    offer: ['Que bom que acordou, viajante. Lobos famintos descem das colinas e atacam quem passa pela estrada do vale.',
      'Você parece saber usar essa espada. Abata cinco deles e a aldeia ficará em dívida com você.'],
    done: 'Os uivos cessaram... Obrigado, herói. Tome estas poções — e fale com o Capitão Aldric, ele precisa de alguém como você.'
  },
  ervas_lago: {
    title: 'Ervas do Lago Azul', giver: 'curandeira',
    desc: 'A curandeira Lia precisa de 5 Ervas Lunares, que brilham nas margens do Lago Azul.',
    obj: { type: 'collect', target: 'erva_lunar', count: 5, label: 'Ervas Lunares', region: 'lago' },
    reward: { xp: 90, gold: 30, items: [['pocao', 3], ['gibao_couro', 1]] },
    offer: ['Meus remédios estão acabando. As Ervas Lunares crescem na beira do Lago Azul, ao sul daqui.',
      'Elas brilham com uma luz suave — fáceis de achar. Traga cinco e eu preparo poções para você.'],
    done: 'Perfeitas! Ainda úmidas do orvalho. Aqui estão poções frescas, e este gibão que era do meu irmão.'
  },
  ameaca_goblin: {
    title: 'A Ameaça Goblin', giver: 'capitao', main: true, requires: ['lobos_vale'],
    desc: 'Goblins montaram acampamento na Floresta Sombria, a noroeste. Derrote 6 goblins.',
    obj: { type: 'kill', target: 'goblin', count: 6, label: 'Goblins derrotados', region: 'floresta' },
    reward: { xp: 160, gold: 80, items: [['espada_aco', 1]] },
    offer: ['Soube dos lobos. Bom trabalho. Mas temos um problema maior: goblins na Floresta Sombria.',
      'Eles roubam nossas colheitas e ferem os lenhadores. Derrote seis deles e traga paz à floresta.'],
    done: 'Você é mais valente que metade da minha guarda! Esta espada de aço é sua. Agora... o Ancião quer lhe falar sobre as ruínas.'
  },
  ninho_aranhas: {
    title: 'O Ninho das Aranhas', giver: 'curandeira', requires: ['ervas_lago'],
    desc: 'Aranhas gigantes se espalham a sudoeste. Elimine 5 delas.',
    obj: { type: 'kill', target: 'aranha', count: 5, label: 'Aranhas eliminadas', region: 'ninho' },
    reward: { xp: 150, gold: 70, items: [['pocao', 3]] },
    offer: ['Os caçadores falam de aranhas do tamanho de um cavalo perto das pedras a sudoeste.',
      'O veneno delas já feriu três pessoas. Elimine cinco, por favor.'],
    done: 'Você voltou inteiro! Aqui, mais poções. Você merece.'
  },
  rei_esquecido: {
    title: 'O Rei Esquecido', giver: 'anciao', main: true, requires: ['ameaca_goblin'],
    desc: 'Algo despertou nas Ruínas Antigas, ao norte. Vá ao altar e derrote o Rei Esquecido.',
    obj: { type: 'kill', target: 'rei', count: 1, label: 'Rei Esquecido derrotado', region: 'ruinas' },
    reward: { xp: 0, gold: 200, items: [['pocao', 3]] },
    offer: ['Há séculos, um rei cruel foi selado sob as Ruínas Antigas, no alto das colinas ao norte.',
      'Os goblins e os mortos-vivos são sinal de que o selo enfraqueceu. Só você pode detê-lo. Vá até o altar.',
      'Leve poções. Quando ele erguer a espada com as duas mãos, saia da área vermelha!'],
    done: 'O reino está a salvo graças a você. Seu nome será cantado nas tavernas por gerações!'
  }
};

const IDLE_LINES = {
  anciao: ['Os reinos já foram unidos, há muito tempo...', 'Descanse no poço da aldeia: ele cura e guarda seu progresso.'],
  curandeira: ['Beba poções antes que seja tarde demais!', 'O orvalho da manhã deixa as ervas mais fortes.'],
  capitao: ['Use a esquiva: rolando, nenhum golpe te acerta.', 'O Golpe Giratório acerta todos ao seu redor, mas cansa.'],
  ferreiro: ['Aço bom não se faz com pressa.', 'Traga peles, dentes e ossos. Eu compro tudo!'],
  aldeao: ['Dizem que há baús escondidos pelo reino.', 'À noite os lobos ficam mais ousados...', 'Já viu o brilho azul do lago?']
};

export class QuestSystem {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.status = {};   // id -> 'active' | 'ready' | 'done'
    this.progress = {}; // id -> número
    this.tracked = null;
  }

  isActive(id) { return this.status[id] === 'active' || this.status[id] === 'ready'; }
  isDone(id) { return this.status[id] === 'done'; }

  available(id) {
    const q = QUESTS[id];
    if (this.status[id]) return false;
    return (q.requires || []).every((r) => this.isDone(r));
  }

  accept(id) {
    this.status[id] = 'active';
    this.progress[id] = 0;
    this.tracked = id;
    this.refreshCollect();
    this.game.onQuestUpdate(id, 'accepted');
  }

  /** Atualiza missões de coleta pela quantidade no inventário. */
  refreshCollect() {
    for (const [id, st] of Object.entries(this.status)) {
      const q = QUESTS[id];
      if (q.obj.type !== 'collect' || st === 'done') continue;
      const n = Math.min(q.obj.count, this.game.inventory.count(q.obj.target));
      const before = this.progress[id];
      this.progress[id] = n;
      if (n >= q.obj.count && st === 'active') {
        this.status[id] = 'ready';
        this.game.onQuestUpdate(id, 'ready');
      } else if (n < q.obj.count && st === 'ready') {
        this.status[id] = 'active';
      } else if (n !== before) {
        this.game.onQuestUpdate(id, 'progress');
      }
    }
  }

  onKill(type) {
    for (const [id, st] of Object.entries(this.status)) {
      const q = QUESTS[id];
      if (st !== 'active' || q.obj.type !== 'kill' || q.obj.target !== type) continue;
      this.progress[id] = Math.min(q.obj.count, (this.progress[id] || 0) + 1);
      if (this.progress[id] >= q.obj.count) {
        this.status[id] = 'ready';
        this.game.onQuestUpdate(id, 'ready');
      } else {
        this.game.onQuestUpdate(id, 'progress');
      }
    }
  }

  turnIn(id) {
    const q = QUESTS[id];
    const g = this.game;
    if (q.obj.type === 'collect') g.inventory.remove(q.obj.target, q.obj.count);
    this.status[id] = 'done';
    if (q.reward.xp) g.player.gainXp(q.reward.xp);
    if (q.reward.gold) g.inventory.add('ouro', q.reward.gold);
    for (const [item, n] of q.reward.items || []) g.inventory.add(item, n);
    if (this.tracked === id) this.tracked = null;
    g.onQuestUpdate(id, 'done');
    // acompanha a próxima missão ativa
    if (!this.tracked) this.tracked = Object.keys(this.status).find((k) => this.isActive(k)) || null;
  }

  /** Marcador do NPC: '!' tem missão nova, '?' tem missão para entregar. */
  npcMarker(npc) {
    let mark = null;
    for (const [id, q] of Object.entries(QUESTS)) {
      if (q.giver !== npc) continue;
      if (this.status[id] === 'ready') return '?';
      if (this.available(id)) mark = '!';
    }
    return mark;
  }

  /** Monta o diálogo de um NPC. */
  dialogFor(npc) {
    for (const [id, q] of Object.entries(QUESTS)) {
      if (q.giver === npc && this.status[id] === 'ready') {
        return { kind: 'turnin', quest: id, lines: [q.done] };
      }
    }
    for (const [id, q] of Object.entries(QUESTS)) {
      if (q.giver === npc && this.available(id)) {
        return { kind: 'offer', quest: id, lines: q.offer };
      }
    }
    for (const [id, q] of Object.entries(QUESTS)) {
      if (q.giver === npc && this.status[id] === 'active') {
        return { kind: 'reminder', quest: id, lines: [`Como vai a tarefa? ${q.desc}`] };
      }
    }
    const lines = IDLE_LINES[npc] || IDLE_LINES.aldeao;
    return { kind: 'idle', lines: [lines[Math.floor(Math.random() * lines.length)]] };
  }

  trackedQuest() {
    if (this.tracked && this.isActive(this.tracked)) return this.tracked;
    this.tracked = Object.keys(this.status).find((k) => this.isActive(k)) || null;
    return this.tracked;
  }

  objectiveText(id) {
    const q = QUESTS[id];
    if (this.status[id] === 'ready') return `Volte e fale com ${this.game.npcName(q.giver)}`;
    return `${q.obj.label}: ${this.progress[id] || 0}/${q.obj.count}`;
  }

  /** Posição alvo da missão (para bússola e mapa). */
  targetPos(id) {
    const q = QUESTS[id];
    const g = this.game;
    if (this.status[id] === 'ready') {
      const npc = g.interaction.npcs.find((n) => n.id === q.giver);
      return npc ? { x: npc.x, z: npc.z } : null;
    }
    if (q.obj.type === 'collect') {
      // erva mais próxima ainda não coletada
      const p = g.player.position;
      let best = null, bd = Infinity;
      for (const h of g.interaction.herbs) {
        if (h.collected) continue;
        const d = Math.hypot(h.x - p.x, h.z - p.z);
        if (d < bd) { bd = d; best = h; }
      }
      if (best) return { x: best.x, z: best.z };
    }
    if (q.obj.target === 'rei' && g.world.regions.altar) return { x: g.world.regions.altar.x, z: g.world.regions.altar.z };
    const r = g.world.regions.get(q.obj.region);
    if (q.obj.type === 'kill') {
      // grupo vivo mais próximo do tipo
      const p = g.player.position;
      let best = null, bd = Infinity;
      for (const e of g.enemies.list) {
        if (!e.alive || e.type !== q.obj.target) continue;
        const d = Math.hypot(e.home.x - p.x, e.home.z - p.z);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) return { x: best.home.x, z: best.home.z };
    }
    return r ? { x: r.x, z: r.z } : null;
  }

  serialize() {
    return { status: { ...this.status }, progress: { ...this.progress }, tracked: this.tracked };
  }

  deserialize(d) {
    this.reset();
    if (!d) return;
    this.status = { ...d.status };
    this.progress = { ...d.progress };
    this.tracked = d.tracked || null;
  }
}
