// Cena 1: apartamento do protagonista (top-down 3/4, movimentação livre).
import Phaser from 'phaser';
import { asset } from '../core/assets.js';
import { bus } from '../core/EventBus.js';
import { game } from '../core/GameState.js';
import { MapBuilder } from '../world/MapBuilder.js';
import { Player, createProtagonistTexture } from '../world/Player.js';
import { InteractionSystem } from '../world/InteractionSystem.js';
import { NPC } from '../npc/NPC.js';
import { DialogueRunner } from '../dialogue/DialogueRunner.js';
import { objectScripts } from '../dialogue/scripts/objects.js';
import rinDialogue from '../dialogue/scripts/rin.js';
import { audio } from '../audio/AudioManager.js';

const DIALOGUES = { rin: rinDialogue };
// Condições de presença dos NPCs (a Rin só aparece no dia da mudança)
const NPC_PRESENT = { character_01: () => game.state.time.day === 1 };

export class ApartmentScene extends Phaser.Scene {
  constructor() { super('Apartment'); }

  init(data) { this.ui = data.ui; this.input2 = data.input; }

  preload() {
    this.load.json('map_apartment', asset('maps/apartment.json'));
    // ao ler o mapa, carrega só as imagens dos personagens desta cena
    this.load.once('filecomplete-json-map_apartment', (_k, _t, map) => {
      map.npcs.forEach((n) => NPC.preload(this, n));
    });
    this.load.on('progress', (p) => bus.emit('load:progress', p));
  }

  create() {
    const map = this.cache.json.get('map_apartment');
    this.map = map;
    const builder = new MapBuilder(this, map);
    this.builder = builder;
    this.add.image(0, 0, builder.buildBackground()).setOrigin(0).setScale(0.5).setDepth(0);
    this.physics.world.setBounds(0, 0, builder.W, builder.H);
    this.solids = this.physics.add.staticGroup();
    builder.buildColliders(this.solids);
    this.objects = builder.buildObjects();

    // protagonista
    createProtagonistTexture(this, game.p.appearance);
    const loc = game.state.location;
    const sx = loc.x ?? map.spawn.x, sy = loc.y ?? map.spawn.y;
    this.player = new Player(this, sx, sy, loc.facing || map.spawn.facing);
    this.physics.add.collider(this.player.sprite, this.solids, () => this.onBump());

    // interação
    this.interactions = new InteractionSystem(this);
    this.objects.forEach(({ def, sprite }) => {
      if (!def.interact) return;
      const i = def.interact;
      this.interactions.add({
        id: def.id, kind: 'object', label: i.label, icon: i.icon, action: i.action,
        x: def.x + (i.pointX || 0), y: def.y + (i.pointY ?? 10), radius: i.radius,
        markerY: sprite.y - sprite.displayHeight - 4, markerX: def.x,
      });
    });
    this.npcs = [];
    map.npcs.forEach((d) => this.spawnNPC(d));

    // câmera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, builder.W, builder.H);
    cam.setBackgroundColor('#1b1530');
    cam.startFollow(this.player.sprite, true, 0.14, 0.14);
    cam.roundPixels = false;
    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);

    this.interactions.onChange = (t) => bus.emit('hud:context', t);
    this.offs = [
      bus.on('ui:interact', () => this.interact()),
      bus.on('dialogue:action', (a, e) => this.onAction(a, e)),
      bus.on('ui:modal', (open) => this.setFrozen(open)),
      bus.on('settings:changed', () => this.fitCamera()),
    ];
    this.input2.onInteract = () => this.interact();
    this.events.once('shutdown', () => this.cleanup());
    this.frozen = false;
    audio.playMusic('home');
    cam.fadeIn(500, 27, 21, 48);
    bus.emit('scene:ready', 'apartment');
  }

  spawnNPC(d) {
    if (NPC_PRESENT[d.characterId] && !NPC_PRESENT[d.characterId]()) return;
    const npc = new NPC(this, d);
    this.physics.add.collider(this.player.sprite, npc.body);
    this.npcs.push(npc);
    this.interactions.add({
      id: `npc_${d.characterId}`, kind: 'npc', npc, label: 'Conversar', icon: '💬', action: 'talk',
      x: d.x, y: d.y, radius: 50, markerY: d.y - npc.sprite.displayHeight - 16, markerX: d.x,
    });
  }

  removeAbsentNPCs() {
    this.npcs = this.npcs.filter((n) => {
      const keep = !NPC_PRESENT[n.id] || NPC_PRESENT[n.id]();
      if (!keep) {
        this.interactions.targets = this.interactions.targets.filter((t) => t.npc !== n);
        [n.sprite, n.shadow, n.label, n.body].forEach((o) => o.destroy());
      }
      return keep;
    });
  }

  fitCamera() {
    const cam = this.cameras.main;
    const dpr = this.game.registry.get('dpr') || 1;
    const cssH = this.scale.height / dpr;
    // ~11 tiles na vertical em celulares; mais perto em telas grandes
    const z = Phaser.Math.Clamp(cssH / (11 * 32), 1, 2.6);
    cam.setZoom(z * dpr);
  }

  onBump() {
    const now = this.time.now;
    if (now - (this._bump || 0) > 500) { this._bump = now; }
  }

  setFrozen(v) {
    this.frozen = v;
    if (v) this.player.stop();
  }

  update(_t, dtMs) {
    if (this.frozen) { this.player.stop(); return; }
    const dt = Math.min(dtMs, 50) / 1000;
    this.player.update(this.input2.vector(), dt);
    this.interactions.update(this.player.x, this.player.y);
  }

  interact() {
    if (this.frozen) return;
    const t = this.interactions.current;
    if (!t) return;
    audio.sfx('interact');
    if (t.kind === 'npc') return this.talkTo(t.npc);
    const make = objectScripts[t.action];
    if (!make) return;
    // vira o protagonista para o objeto
    this.facePoint(t.markerX ?? t.x, t.y);
    this.runDialogue(make(this.dialogueCtx()));
  }

  dialogueCtx() {
    return { flag: (k) => game.flag(k), period: game.period(), day: game.state.time.day };
  }

  facePoint(x, y) {
    const dx = x - this.player.x, dy = y - this.player.y;
    this.player.face(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
  }

  talkTo(npc) {
    this.facePoint(npc.x, npc.y);
    const def = DIALOGUES[npc.def.dialogue];
    const script = typeof def === 'function' ? def({ flag: (k) => game.flag(k) }) : def;
    // câmera enquadra os dois personagens acima da caixa de diálogo
    // (sem limites de borda durante a conversa, para os dois ficarem no alto da tela,
    //  livres da caixa de texto, do retrato e das opções)
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.removeBounds();
    const mx = (npc.x + this.player.x) / 2, my = Math.max(npc.y, this.player.y);
    const viewW = cam.width / cam.zoom, viewH = cam.height / cam.zoom;
    cam.pan(mx - viewW * 0.12, my + viewH * 0.26, 450, 'Sine.easeInOut');
    npc.setHighlight(true);
    this.runDialogue(script, npc.id, () => {
      npc.setHighlight(false);
      const b = this.builder, half = { w: cam.width / cam.zoom / 2, h: cam.height / cam.zoom / 2 };
      const tx = Phaser.Math.Clamp(this.player.x, half.w, Math.max(half.w, b.W - half.w));
      const ty = Phaser.Math.Clamp(this.player.y, half.h, Math.max(half.h, b.H - half.h));
      cam.pan(tx, ty, 350, 'Sine.easeInOut', false, (_c, p) => {
        if (p === 1) { cam.setBounds(0, 0, b.W, b.H); cam.startFollow(this.player.sprite, true, 0.14, 0.14); }
      });
    });
  }

  runDialogue(script, npcId = null, after) {
    this.setFrozen(true);
    this.interactions.marker.setVisible(false);
    const runner = new DialogueRunner(script, {
      box: this.ui.dialogue, npcId,
      onEnd: () => {
        after?.();
        this.setFrozen(false);
        this.interactions.current = null; // força atualizar o botão contextual
        this.autosave();
      },
    });
    runner.start();
  }

  onAction(a, e) {
    if (a === 'time') { game.advance(e.minutes || 10); bus.emit('time:changed'); }
    if (a === 'sleep') this.sleep();
  }

  sleep() {
    this.setFrozen(true);
    audio.sfx('sleep');
    this.ui.transition(async () => {
      game.state.time.day += 1;
      game.state.time.minutes = 7 * 60;
      this.removeAbsentNPCs();
      bus.emit('time:changed');
      await this.autosave();
    }, `Dia ${game.state.time.day + 1}`).then(() => {
      this.setFrozen(false);
      this.ui.toast(`Dia ${game.state.time.day} — 07:00. Jogo salvo.`);
    });
  }

  snapshotLocation() {
    game.state.location = { scene: 'apartment', x: Math.round(this.player.x), y: Math.round(this.player.y), facing: this.player.facing };
  }

  autosave() {
    this.snapshotLocation();
    return this.ui.save();
  }

  cleanup() {
    this.offs.forEach((off) => off());
    this.scale.off('resize', this.fitCamera, this);
    if (this.input2.onInteract) this.input2.onInteract = null;
  }
}
