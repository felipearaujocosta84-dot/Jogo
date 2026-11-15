// Interação com o mundo: NPCs (conversa/loja/missões), baús, ervas, poço (descanso + salvar)
// e itens soltos no chão (saque dos inimigos, coletados ao passar por cima).
import { MeshBuilder, Mesh, StandardMaterial, Color3, Color4, Vector3, TransformNode } from '../babylon.js';
import { createCharacter } from '../enemies/enemyModels.js';
import { paint } from '../world/regions.js';
import { ITEMS } from './inventory.js';

export const NPC_DEFS = [
  { id: 'anciao', name: 'Ancião Bento', type: 'anciao', x: 50.5, z: -24.6, yaw: Math.PI },
  { id: 'curandeira', name: 'Curandeira Lia', type: 'curandeira', x: 36.8, z: -19.6, yaw: Math.PI * 0.8 },
  { id: 'ferreiro', name: 'Ferreiro Gunnar', type: 'ferreiro', x: 57.4, z: -30, yaw: -Math.PI * 0.6, shop: true },
  { id: 'capitao', name: 'Capitão Aldric', type: 'capitao', x: 36, z: -27.6, yaw: -Math.PI / 2 },
  { id: 'aldeao', name: 'Marta', type: 'aldeao', x: 47.5, z: -34, yaw: 0, wander: 3 },
  { id: 'aldeao2', name: 'Tomé', type: 'aldeao', x: 54, z: -35.5, yaw: 1, wander: 2.5, dialogAs: 'aldeao' }
];

function mat(scene, name, color, opts = {}) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = new Color3(...color);
  m.specularColor = new Color3(0.1, 0.1, 0.1);
  if (opts.emissive) { m.emissiveColor = new Color3(...opts.emissive); }
  if (opts.unlit) m.disableLighting = true;
  return m;
}

export class Interaction {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.npcs = [];
    this.chests = [];
    this.herbs = [];
    this.pickups = [];
    this.spots = []; // outros pontos (poço)
    this.current = null;
  }

  build() {
    const s = this.scene;
    const g = this.game;
    const w = g.world;

    // ---- NPCs ----
    for (const d of NPC_DEFS) {
      const c = createCharacter(s, d.type, 'npc_' + d.id, 1);
      const y = w.groundAt(d.x, d.z);
      c.root.position.set(d.x, y, d.z);
      c.root.rotation.y = d.yaw;
      for (const inst of c.instances) g.addShadowCaster(inst);
      const npc = { ...d, char: c, home: { x: d.x, z: d.z }, baseYaw: d.yaw, t: Math.random() * 10, talking: false, target: null, radius: 0.45 };
      this.npcs.push(npc);
    }

    // ---- baús ----
    const woodMat = mat(s, 'chestWood', [0.45, 0.28, 0.14]);
    for (const spot of w.regions.chestSpots) {
      const y = w.groundAt(spot.x, spot.z);
      const root = new TransformNode('chest_' + spot.id, s);
      root.position.set(spot.x, y, spot.z);
      const base = Mesh.MergeMeshes([
        paint(MeshBuilder.CreateBox('cb', { width: 1.1, height: 0.55, depth: 0.7 }, s), [0.45, 0.28, 0.14], 0.1),
        ...[-0.4, 0.4].map((x) => { const b = MeshBuilder.CreateBox('band', { width: 0.08, height: 0.57, depth: 0.72 }, s); b.position.x = x; return paint(b, [0.35, 0.33, 0.3]); })
      ], true, true);
      base.position.y = 0.27;
      base.parent = root;
      base.material = woodMat;
      const lidPivot = new TransformNode('lidPivot', s);
      lidPivot.parent = root;
      lidPivot.position.set(0, 0.55, -0.35);
      const lidM = MeshBuilder.CreateCylinder('lid', { diameter: 0.7, height: 1.1, tessellation: 12, arc: 0.5 }, s);
      lidM.rotation.z = Math.PI / 2;
      lidM.rotation.y = Math.PI / 2;
      paint(lidM, [0.5, 0.31, 0.16], 0.1);
      const lock = paint(MeshBuilder.CreateBox('lock', { width: 0.14, height: 0.16, depth: 0.06 }, s), [0.85, 0.7, 0.25]);
      lock.position.set(0, -0.02, 0.36);
      const lid = Mesh.MergeMeshes([lidM, lock], true, true);
      lid.parent = lidPivot;
      lid.position.set(0, 0, 0.35);
      lid.material = woodMat;
      root.rotation.y = Math.random() * Math.PI * 2;
      g.addShadowCaster(base); g.addShadowCaster(lid);
      w.addCircle({ x: spot.x, z: spot.z, r: 0.6, kind: 'chest' });
      const glow = g.effects.glow(new Vector3(spot.x, y + 0.6, spot.z), new Color4(1, 0.85, 0.4, 1), 4);
      this.chests.push({ ...spot, root, lidPivot, opened: false, glow, anim: 0 });
    }

    // ---- ervas lunares ----
    const herbStem = mat(s, 'herbStem', [0.25, 0.5, 0.25]);
    const herbGlow = mat(s, 'herbGlow', [0.5, 0.9, 1], { emissive: [0.45, 0.85, 1], unlit: true });
    const stemT = Mesh.MergeMeshes([0, 1, 2, 3, 4].map((i) => {
      const l = MeshBuilder.CreateCylinder('leaf', { diameterTop: 0, diameterBottom: 0.09, height: 0.5, tessellation: 4 }, s);
      l.rotation.z = 0.5; l.rotation.y = i * 1.26; l.position.y = 0.22;
      l.position.x = Math.cos(i * 1.26) * 0.08; l.position.z = -Math.sin(i * 1.26) * 0.08;
      return l;
    }), true);
    stemT.material = herbStem;
    stemT.isVisible = false;
    const bulbT = MeshBuilder.CreateSphere('bulb', { diameter: 0.16, segments: 6 }, s);
    bulbT.material = herbGlow;
    bulbT.isVisible = false;
    for (const h of w.regions.herbSpots) {
      const y = w.groundAt(h.x, h.z);
      const root = new TransformNode('herb_' + h.id, s);
      root.position.set(h.x, y, h.z);
      const st = stemT.createInstance('herbStem'); st.parent = root;
      const bulbs = [];
      for (let i = 0; i < 3; i++) {
        const b = bulbT.createInstance('herbBulb');
        b.parent = root;
        b.position.set(Math.cos(i * 2.1) * 0.12, 0.42 + i * 0.06, Math.sin(i * 2.1) * 0.12);
        bulbs.push(b);
      }
      this.herbs.push({ ...h, root, bulbs, collected: false });
    }

    // ---- poço (descanso) ----
    const well = w.regions.well;
    if (well) this.spots.push({ id: 'poco', x: well.x, z: well.z, r: 2.4, label: 'Descansar no poço (curar e salvar)', action: () => this.rest() });

    // ---- modelos de itens soltos ----
    const pouchMat = mat(s, 'pouchMat', [0.55, 0.4, 0.2]);
    const pouch = Mesh.MergeMeshes([
      paint(MeshBuilder.CreateSphere('sack', { diameter: 0.34, segments: 6 }, s), [0.55, 0.4, 0.22]),
      (() => { const t = MeshBuilder.CreateCylinder('tie', { diameterTop: 0.04, diameterBottom: 0.14, height: 0.14, tessellation: 6 }, s); t.position.y = 0.18; return paint(t, [0.5, 0.35, 0.18]); })(),
      (() => { const c = MeshBuilder.CreateCylinder('coin', { diameter: 0.14, height: 0.03, tessellation: 10 }, s); c.position.set(0.14, -0.08, 0.1); c.rotation.x = 0.4; return paint(c, [1, 0.8, 0.25]); })()
    ], true, true);
    pouch.material = pouchMat;
    pouch.isVisible = false;
    this.pouchT = pouch;
    const orbMat = mat(s, 'orbMat', [1, 1, 1], { emissive: [0.9, 0.75, 0.35], unlit: true });
    const orb = MeshBuilder.CreatePolyhedron('orb', { type: 1, size: 0.13 }, s);
    orb.material = orbMat;
    orb.isVisible = false;
    this.orbT = orb;
  }

  npcName(id) {
    const n = this.npcs.find((x) => x.id === id);
    return n ? n.name : id;
  }

  spawnPickup(x, z, item, qty) {
    const g = this.game;
    const y = g.world.groundAt(x, z);
    const m = (item === 'ouro' ? this.pouchT : this.orbT).createInstance('pick_' + item);
    m.position.set(x, y + 0.3, z);
    this.pickups.push({ x, z, y, item, qty, mesh: m, t: 0, vy: 3 });
  }

  rest() {
    const g = this.game;
    const p = g.player;
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    g.effects.sparkle(p.position.add(new Vector3(0, 1, 0)), new Color4(0.5, 0.8, 1, 1));
    g.audio.potion();
    g.save.save(true);
    g.hud.toast('Você descansou. Vida restaurada e jogo salvo.');
  }

  openChest(c) {
    const g = this.game;
    c.opened = true;
    c.anim = 0.001;
    c.glow.stop();
    g.audio.chest();
    g.player.play('interact');
    const names = [];
    for (const [item, n] of c.loot) {
      g.inventory.add(item, n);
      names.push(item === 'ouro' ? `${n} ouro` : `${n > 1 ? n + 'x ' : ''}${ITEMS[item].name}`);
    }
    g.hud.toast('Baú: ' + names.join(', '), 3.5);
    g.effects.sparkle(c.root.position.add(new Vector3(0, 0.8, 0)));
    g.onInventoryChanged();
  }

  collectHerb(h) {
    const g = this.game;
    h.collected = true;
    h.root.setEnabled(false);
    g.player.play('interact');
    g.inventory.add('erva_lunar', 1);
    g.audio.pickup();
    g.effects.sparkle(h.root.position.add(new Vector3(0, 0.5, 0)), new Color4(0.5, 0.9, 1, 1));
    g.hud.toast(`Erva Lunar coletada (${g.inventory.count('erva_lunar')})`);
    g.quests.refreshCollect();
  }

  /** Lista de pontos interativos ativos. */
  candidates() {
    const out = [];
    for (const n of this.npcs) out.push({ x: n.x, z: n.z, r: 2.6, label: 'Falar com ' + n.name, action: () => this.game.talkTo(n), npc: n });
    for (const c of this.chests) if (!c.opened) out.push({ x: c.x, z: c.z, r: 2.0, label: 'Abrir baú', action: () => this.openChest(c) });
    for (const h of this.herbs) if (!h.collected) out.push({ x: h.x, z: h.z, r: 1.9, label: 'Colher Erva Lunar', action: () => this.collectHerb(h) });
    for (const sp of this.spots) out.push(sp);
    return out;
  }

  interact() {
    if (this.current) this.current.action();
  }

  onPlayerStrike() { /* reservado para objetos quebráveis */ }

  update(dt) {
    const g = this.game;
    const p = g.player;
    const pp = p.position;

    // ponto interativo mais próximo
    let best = null, bd = Infinity;
    if (!p.dead) {
      for (const c of this.candidates()) {
        const d = Math.hypot(c.x - pp.x, c.z - pp.z);
        if (d < c.r && d < bd) { bd = d; best = c; }
      }
    }
    if (best !== this.current) {
      this.current = best;
      g.hud.setInteract(best ? best.label : null);
    }

    // NPCs: respiração, olhar para o jogador, passear
    for (const n of this.npcs) {
      n.t += dt;
      const J = n.char.joints;
      const d = Math.hypot(pp.x - n.x, pp.z - n.z);
      if (d > 50) continue;
      let moving = 0;
      if (n.wander && !n.talking) {
        if (!n.target || Math.hypot(n.target.x - n.x, n.target.z - n.z) < 0.3) {
          if (!n.wait || n.wait < 0) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * n.wander;
            n.target = { x: n.home.x + Math.cos(a) * r, z: n.home.z + Math.sin(a) * r };
            n.wait = 3 + Math.random() * 4;
          }
          n.wait -= dt;
        } else if (d > 2.2) {
          const dx = n.target.x - n.x, dz = n.target.z - n.z, l = Math.hypot(dx, dz);
          const v = new Vector3(n.x + (dx / l) * 1.1 * dt, 0, n.z + (dz / l) * 1.1 * dt);
          g.world.resolve(v, 0.4);
          n.x = v.x; n.z = v.z;
          n.baseYaw = Math.atan2(dx, dz);
          moving = 1;
        }
      }
      const look = d < 6 || n.talking;
      let targetYaw = n.baseYaw;
      if (n.talking) targetYaw = Math.atan2(pp.x - n.x, pp.z - n.z);
      let dy = targetYaw - n.char.root.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      n.char.root.rotation.y += dy * Math.min(1, dt * 4);
      // cabeça acompanha o jogador
      let hy = 0;
      if (look) {
        hy = Math.atan2(pp.x - n.x, pp.z - n.z) - n.char.root.rotation.y;
        while (hy > Math.PI) hy -= Math.PI * 2;
        while (hy < -Math.PI) hy += Math.PI * 2;
        hy = Math.max(-1, Math.min(1, hy));
      }
      J.head.rotation.y += (hy - J.head.rotation.y) * Math.min(1, dt * 5);
      const ph = n.t * 6;
      J.legR.rotation.x = -Math.sin(ph) * 0.5 * moving;
      J.legL.rotation.x = Math.sin(ph) * 0.5 * moving;
      J.hips.position.y = J.hips.metadata.rest.y + Math.sin(n.t * 2) * 0.01;
      const talk = n.talking ? Math.sin(n.t * 5) * 0.25 : 0;
      J.armR.rotation.x = -0.15 + talk - Math.sin(ph) * 0.35 * moving;
      J.armL.rotation.x = 0.05 + Math.sin(ph) * 0.35 * moving;
      J.armL.rotation.z = -0.1;
      J.armR.rotation.z = 0.1;
      n.char.root.position.set(n.x, g.world.groundAt(n.x, n.z), n.z);
    }

    // baús abrindo
    for (const c of this.chests) {
      if (c.anim > 0 && c.anim < 1) {
        c.anim = Math.min(1, c.anim + dt * 2.5);
        c.lidPivot.rotation.x = -c.anim * 1.9;
      }
    }

    // ervas pulsando
    const t = g.time;
    for (const h of this.herbs) {
      if (h.collected) continue;
      const k = 1 + Math.sin(t * 3 + h.x) * 0.15;
      for (const b of h.bulbs) b.scaling.setAll(k);
    }

    // itens no chão
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const it = this.pickups[i];
      it.t += dt;
      const m = it.mesh;
      if (it.vy !== 0) {
        m.position.y += it.vy * dt;
        it.vy -= 12 * dt;
        if (m.position.y <= it.y + 0.3) { m.position.y = it.y + 0.3; it.vy = 0; }
      } else {
        m.position.y = it.y + 0.35 + Math.sin(it.t * 3) * 0.08;
      }
      m.rotation.y += dt * 2;
      const dx = pp.x - m.position.x, dz = pp.z - m.position.z;
      const d = Math.hypot(dx, dz);
      if (!p.dead && it.t > 0.5 && d < 3.2) {
        // ímã
        const sp = (3.4 - d) * 4 * dt;
        m.position.x += (dx / (d || 1)) * Math.min(d, sp);
        m.position.z += (dz / (d || 1)) * Math.min(d, sp);
        if (d < 0.8) {
          g.inventory.add(it.item, it.qty);
          if (it.item === 'ouro') {
            g.audio.coin();
            g.hud.floatText(pp.add(new Vector3(0, 2, 0)), `+${it.qty} ouro`, 'gold');
          } else {
            g.audio.pickup();
            g.hud.floatText(pp.add(new Vector3(0, 2.3, 0)), ITEMS[it.item].name, 'item');
          }
          g.quests.refreshCollect();
          m.dispose();
          this.pickups.splice(i, 1);
          continue;
        }
      }
      if (it.t > 150) { m.dispose(); this.pickups.splice(i, 1); }
    }
  }

  serialize() {
    return {
      chests: this.chests.filter((c) => c.opened).map((c) => c.id),
      herbs: this.herbs.filter((h) => h.collected).map((h) => h.id)
    };
  }

  deserialize(d) {
    for (const c of this.chests) {
      const o = !!(d && d.chests && d.chests.includes(c.id));
      c.opened = o;
      c.anim = o ? 1 : 0;
      c.lidPivot.rotation.x = o ? -1.9 : 0;
      if (o) c.glow.stop(); else c.glow.start();
    }
    for (const h of this.herbs) {
      const col = !!(d && d.herbs && d.herbs.includes(h.id));
      h.collected = col;
      h.root.setEnabled(!col);
    }
    for (const it of this.pickups) it.mesh.dispose();
    this.pickups = [];
  }
}
