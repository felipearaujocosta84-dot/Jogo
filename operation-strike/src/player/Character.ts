// Personagem do jogo: modelo 3D da equipe (Soldado = CT, Terrorista = TR) com esqueleto e animações do arquivo GLB.
// Cada jogador/bot recebe uma cópia com esqueleto próprio. As animações são misturadas por região do corpo:
//  - pernas e quadril: Idle / Crouch / locomoção direcional — frente (Walk → Run_Forward), trás (Stepping_Backward →
//    Sprint_Backward), lados (Walk_Left/Right; agachado Strafe_Left/Right) e giro no lugar (Turning/Turning_Mirror).
//    Pesos pela direção da velocidade em relação ao olhar; a cadência de cada ciclo = velocidade real ÷ velocidade
//    do ciclo (medida na conversão), para os pés não deslizarem;
//  - tronco e braços: Aim (arma pronta) / Idle (arma baixa, parado e calmo) / Run (correndo) / Shoot / Reload;
//  - corpo inteiro: Jump (no ar) e Death.
// Por cima das animações: o tronco acompanha a mira (olhar para cima/baixo) e dá um tranco ao levar dano.
// A arma fica presa no osso da mão direita. Se o arquivo do modelo não carregar, usa o boneco antigo como reserva.
import {
  AnimationGroupMask,
  AnimationGroupMaskMode,
  Color3,
  CreatePlane,
  Matrix,
  Mesh,
  Quaternion,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type AnimationGroup,
  type InstancedMesh,
  type Scene,
  type ShadowGenerator
} from '../core/babylon';
import { gunSource } from '../weapons/WeaponModels';
import { WEAPONS } from '../weapons/WeaponData';
import { paintedTexture } from '../maps/textures';
import type { PlayerView, Team } from '../sim/types';
import { characterAsset } from './CharacterAssets';
import { ProceduralCharacter } from './ProceduralCharacter';

const LOWER = ['Hips', 'UpLeg.L', 'Leg.L', 'Foot.L', 'Toe.L', 'UpLeg.R', 'Leg.R', 'Foot.R', 'Toe.R'];
const UPPER = ['Spine', 'Chest', 'Neck', 'Head', 'Shoulder.L', 'UpperArm.L', 'ForeArm.L', 'Hand.L', 'Shoulder.R', 'UpperArm.R', 'ForeArm.R', 'Hand.R'];

/**
 * Ciclos de locomoção: velocidade (m/s) em que cada um foi animado (medida pelo retarget, ver
 * art/characters/LEIAME.md) e limites da cadência — fora deles o ciclo fica feio demais e aceita-se um pouco de deslize.
 */
const LOCO: Record<string, { clip: string; speed: number; min: number; max: number }> = {
  walk: { clip: 'Walk', speed: 0.95, min: 0.7, max: 2.4 },
  runF: { clip: 'Run_Forward', speed: 3.709, min: 0.65, max: 1.7 },
  stepB: { clip: 'Stepping_Backward', speed: 0.221, min: 1, max: 4.5 },
  sprintB: { clip: 'Sprint_Backward', speed: 5.563, min: 0.42, max: 1.25 },
  walkL: { clip: 'Walk_Left', speed: 1.483, min: 0.7, max: 2.8 },
  walkR: { clip: 'Walk_Right', speed: 1.483, min: 0.7, max: 2.8 },
  strafeL: { clip: 'Strafe_Left', speed: 0.833, min: 0.8, max: 2.8 },
  strafeR: { clip: 'Strafe_Right', speed: 0.833, min: 0.8, max: 2.8 }
};
/** Giro no lugar: o ciclo gira ~37° em 1,2 s (Turning = para a direita, Turning_Mirror = para a esquerda). */
const TURN_RATE = (37 * Math.PI) / 180 / 1.2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

interface Layer {
  group: AnimationGroup;
  weight: number;
  target: number;
  playing: boolean;
  /** Controle manual do tempo (recarga, pulo, morte): toca parada e o quadro é escolhido a cada passo. */
  manual: boolean;
}

let flashMat: StandardMaterial | null = null;
let blobMat: StandardMaterial | null = null;

/** Posição da arma na mão (calculada uma vez por modelo, na pose de mira). */
const gripCache = new WeakMap<object, { pos: Vector3; rot: Quaternion; scale: Vector3 }>();

class SkinnedCharacter {
  readonly root: TransformNode;
  private model: TransformNode;
  private meshes: AbstractMesh[];
  private nodes = new Map<string, TransformNode>();
  private layers = new Map<string, Layer>();
  private gunNode: TransformNode;
  private gun: InstancedMesh | null = null;
  private gunId = '';
  private gunSkin = '';
  private flash: Mesh;
  private flashT = 0;
  private blob: Mesh;
  private visible = true;
  private dead = false;
  private deathT = 0;
  private air = false;
  private airT = 0;
  private landT = 1;
  private shootT = 0;
  private calmT = 0;
  private hitT = 0;
  private hitSide = 1;
  private pitch = 0;
  private speed = 0;
  private lastYaw: number | null = null;
  private turnRate = 0;
  private obs: ReturnType<Scene['onAfterAnimationsObservable']['add']>;
  victory = false;

  constructor(private scene: Scene, readonly team: Team, container: NonNullable<ReturnType<typeof characterAsset>>) {
    this.root = new TransformNode('char_' + team, scene);
    const inst = container.instantiateModelsToScene(n => n, false, { doNotInstantiate: true });
    this.model = inst.rootNodes[0] as TransformNode;
    this.model.parent = this.root;
    this.meshes = this.model.getChildMeshes(false);
    for (const m of this.meshes) {
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true; // a caixa de seleção não acompanha a animação (morte, pulo)
      m.receiveShadows = true;
    }
    for (const n of this.model.getChildTransformNodes(false)) this.nodes.set(n.name, n);

    // camadas de animação (máscaras por região do corpo)
    const byName = new Map(inst.animationGroups.map(g => [g.name, g]));
    const lowerMask = () => new AnimationGroupMask(LOWER, AnimationGroupMaskMode.Include);
    const upperMask = () => new AnimationGroupMask(UPPER, AnimationGroupMaskMode.Include);
    const add = (key: string, src: string, mask: 'lower' | 'upper' | null, manual = false, clone = false) => {
      const base = byName.get(src);
      if (!base) return;
      const g = clone ? base.clone(`${src}_${key}`) : base;
      if (mask) {
        g.mask = mask === 'lower' ? lowerMask() : upperMask();
        g.removeUnmaskedAnimations();
      }
      g.stop();
      this.layers.set(key, { group: g, weight: 0, target: 0, playing: false, manual });
    };
    // cópias primeiro (antes das máscaras alterarem os originais)
    add('idleUp', 'Idle', 'upper', false, true);
    add('runUp', 'Run', 'upper', false, true);
    add('idle', 'Idle', 'lower');
    for (const [key, c] of Object.entries(LOCO)) add(key, c.clip, 'lower');
    add('turnR', 'Turning', 'lower');
    add('turnL', 'Turning_Mirror', 'lower');
    add('crouch', 'Crouch', 'lower');
    add('aim', 'Aim', 'upper');
    add('shoot', 'Shoot', 'upper');
    add('reload', 'Reload', 'upper', true);
    add('jump', 'Jump', null, true);
    add('death', 'Death', null, true);

    // contato com o chão (sombra suave)
    if (!blobMat || blobMat.getScene() !== scene) {
      const tex = paintedTexture(scene, 'blobShadow', 64, (ctx, s) => {
        const grd = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        grd.addColorStop(0, 'rgba(0,0,0,0.55)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, s, s);
      });
      blobMat = new StandardMaterial('blobMat', scene);
      blobMat.diffuseTexture = tex;
      blobMat.useAlphaFromDiffuseTexture = true;
      blobMat.specularColor = Color3.Black();
      blobMat.disableLighting = true;
      blobMat.zOffset = -1;
    }
    this.blob = CreatePlane('blob', { size: 1.1 }, scene);
    this.blob.material = blobMat;
    this.blob.rotation.x = Math.PI / 2;
    this.blob.position.y = 0.03;
    this.blob.parent = this.root;
    this.blob.isPickable = false;

    // arma presa na mão direita
    this.gunNode = new TransformNode('charGun', scene);
    const hand = this.nodes.get('Hand.R');
    if (hand) {
      this.gunNode.parent = hand;
      const grip = this.calibrateGrip(container, hand);
      this.gunNode.position.copyFrom(grip.pos);
      this.gunNode.rotationQuaternion = grip.rot.clone();
      this.gunNode.scaling.copyFrom(grip.scale);
    } else this.gunNode.parent = this.root;

    if (!flashMat || flashMat.getScene() !== scene) {
      const tex = paintedTexture(scene, 'tpFlash', 64, (ctx, s) => {
        const grd = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        grd.addColorStop(0, 'rgba(255,245,200,1)');
        grd.addColorStop(0.4, 'rgba(255,180,60,0.8)');
        grd.addColorStop(1, 'rgba(255,120,20,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, s, s);
      });
      flashMat = new StandardMaterial('tpFlashMat', scene);
      flashMat.emissiveTexture = tex;
      flashMat.opacityTexture = tex;
      flashMat.disableLighting = true;
      flashMat.alphaMode = 1;
      flashMat.backFaceCulling = false;
    }
    this.flash = CreatePlane('tpFlash', { size: 0.35 }, scene);
    this.flash.material = flashMat;
    this.flash.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.flash.parent = this.gunNode;
    this.flash.isPickable = false;
    this.flash.setEnabled(false);

    // camadas extras por cima das animações: mira (tronco) e tranco de dano
    this.obs = scene.onAfterAnimationsObservable.add(() => this.postAnimate());
  }

  /**
   * Onde a arma fica na mão: na pose de mira, o cano aponta para a frente do personagem e o punho fica na palma.
   * Calculado uma vez por modelo e reaproveitado.
   */
  private calibrateGrip(container: object, hand: TransformNode): { pos: Vector3; rot: Quaternion; scale: Vector3 } {
    const cached = gripCache.get(container);
    if (cached) return cached;
    const aim = this.layers.get('aim')?.group;
    if (aim) {
      aim.start(false, 1, aim.from, aim.from);
      aim.goToFrame(aim.from);
    }
    // atualiza a cadeia de pai para filho (a mão precisa estar de fato na pose de mira)
    const chain: TransformNode[] = [];
    for (let n: TransformNode | null = hand; n; n = n.parent as TransformNode | null) chain.unshift(n);
    for (const n of chain) n.computeWorldMatrix(true);
    const hw = hand.getWorldMatrix();
    const rw = this.root.getWorldMatrix();
    // direção dos dedos (eixo Y do osso) para posicionar o punho na palma
    const wrist = Vector3.TransformCoordinates(Vector3.Zero(), hw);
    const fingers = Vector3.TransformNormal(new Vector3(0, 1, 0), hw).normalize();
    const forward = Vector3.TransformNormal(new Vector3(0, 0, 1), rw).normalize();
    const up = Vector3.TransformNormal(new Vector3(0, 1, 0), rw).normalize();
    const gripWorld = wrist.add(fingers.scale(0.07)).add(up.scale(-0.015));
    // base explícita: X = direita, Y = cima, Z = frente (o cano da arma aponta para +Z)
    const right = Vector3.Cross(up, forward).normalize();
    const up2 = Vector3.Cross(forward, right).normalize();
    const want = Matrix.FromValues(
      right.x, right.y, right.z, 0,
      up2.x, up2.y, up2.z, 0,
      forward.x, forward.y, forward.z, 0,
      gripWorld.x, gripWorld.y, gripWorld.z, 1
    );
    const local = want.multiply(Matrix.Invert(hw));
    const s = new Vector3(), q = new Quaternion(), t = new Vector3();
    local.decompose(s, q, t);
    aim?.stop();
    // a escala guarda o espelhamento do carregador glTF (sem ela a arma vira 180°)
    const res = { pos: t, rot: q, scale: s };
    gripCache.set(container, res);
    return res;
  }

  setWeapon(id: string, skin = 'default'): void {
    if (id === this.gunId && skin === this.gunSkin) return;
    this.gunId = id;
    this.gunSkin = skin;
    this.gun?.dispose();
    this.gun = gunSource(id, this.scene, skin).createInstance('gunInst');
    this.gun.parent = this.gunNode;
    this.gun.isVisible = true;
    const cls = WEAPONS[id]?.cls ?? 'rifle';
    this.flash.position.set(0, 0.02, cls === 'pistol' ? 0.24 : cls === 'sniper' ? 0.9 : cls === 'smg' ? 0.4 : 0.66);
  }

  fire(): void {
    this.flashT = 0.06;
    this.shootT = 0.32;
    this.calmT = 0;
    const s = this.layers.get('shoot');
    if (s) {
      s.group.stop();
      s.playing = false;
    }
  }

  hit(fromAngle: number | null): void {
    void fromAngle;
    this.hitT = 1;
    this.hitSide = Math.random() < 0.5 ? -1 : 1;
    this.calmT = 0;
  }

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    this.root.setEnabled(v);
  }

  setProtected(on: boolean, time: number): void {
    const v = on ? 0.45 + 0.25 * Math.sin(time * 14) : 1;
    for (const m of this.meshes) if (m.visibility !== v) m.visibility = v;
  }

  get isDeadAnimDone(): boolean {
    return this.dead && this.deathT >= 1.5;
  }

  private want(key: string, w: number): void {
    const l = this.layers.get(key);
    if (l) l.target = w;
  }

  update(dt: number, p: PlayerView, reloadT: number): void {
    this.root.position.set(p.x, p.y, p.z);
    this.root.rotation.y = p.yaw;
    this.setWeapon(p.weapon, p.skin);
    for (const l of this.layers.values()) l.target = 0;
    this.pitch = Math.max(-1.2, Math.min(1.2, p.pitch));
    const sp = Math.hypot(p.vx, p.vz);
    this.speed += (sp - this.speed) * Math.min(1, dt * 10);
    this.hitT = Math.max(0, this.hitT - dt * 4);
    this.shootT = Math.max(0, this.shootT - dt);
    this.calmT = this.speed > 0.5 || reloadT > 0 || this.shootT > 0 ? 0 : this.calmT + dt;

    // morte: corpo inteiro, uma vez
    if (!p.alive) {
      if (!this.dead) {
        this.dead = true;
        this.deathT = 0;
        for (const l of this.layers.values()) l.weight = 0;
      }
      this.deathT += dt;
      this.want('death', 1);
      this.scrub('death', Math.min(1, this.deathT / 1.5));
      this.gunNode.setEnabled(this.deathT < 0.25);
      this.flash.setEnabled(false);
      this.blend(dt, 30);
      return;
    }
    if (this.dead) {
      this.dead = false;
      this.gunNode.setEnabled(true);
    }

    // no ar: animação de pulo (subida → queda conforme a velocidade vertical)
    if (!p.ground) {
      if (!this.air) {
        this.air = true;
        this.airT = 0;
      }
      this.airT += dt;
    } else if (this.air) {
      this.air = false;
      this.landT = 0;
    }
    this.landT = Math.min(1, this.landT + dt * 4);
    const fullBody = this.air && this.airT > 0.08 ? 1 : this.landT < 1 ? 1 - this.landT : 0;
    if (fullBody > 0) {
      // trecho do pulo: 0,33..0,78 no ar (subida/queda pelo vy), 0,78..1 aterrissagem
      const k = this.air ? 0.33 + 0.45 * Math.max(0, Math.min(1, (4.5 - p.vy) / 9)) : 0.78 + 0.22 * this.landT;
      this.want('jump', fullBody);
      this.scrub('jump', k);
    }
    const rest = 1 - fullBody;

    // pernas
    const crouch = p.crouch || p.act === 2 || p.act === 3;
    // velocidade de giro (rad/s), suavizada — rede e bots mudam o yaw em degraus
    if (this.lastYaw !== null && dt > 0) {
      const dy = Math.atan2(Math.sin(p.yaw - this.lastYaw), Math.cos(p.yaw - this.lastYaw));
      this.turnRate += (dy / dt - this.turnRate) * Math.min(1, dt * 6);
    }
    this.lastYaw = p.yaw;
    if (this.speed < 0.3) {
      const turn = crouch ? 0 : clamp01((Math.abs(this.turnRate) - 0.6) / 0.6);
      this.want(crouch ? 'crouch' : 'idle', rest * (1 - turn));
      if (turn > 0) {
        // Turning = giro à direita (yaw crescente no Babylon); cadência pela velocidade do giro
        const key = this.turnRate > 0 ? 'turnR' : 'turnL';
        this.want(key, rest * turn);
        this.ratio(key, Math.max(0.8, Math.min(2.5, Math.abs(this.turnRate) / TURN_RATE)));
      }
    } else this.locomotion(p, rest, crouch);
    // tronco e braços
    if (reloadT > 0) {
      this.want('reload', rest);
      this.scrub('reload', Math.min(1, reloadT));
    } else if (this.shootT > 0) this.want('shoot', rest);
    else if (this.speed > 5.9 && !crouch) this.want('runUp', rest);
    else if (this.calmT > 2.5 && !crouch) this.want('idleUp', rest);
    else this.want('aim', rest);

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.setEnabled(this.flashT > 0);
    }
    this.blend(dt, 10);
  }

  /**
   * Andando/correndo: pesos por direção (frente/trás/lados, diagonais misturam dois) e, em cada direção,
   * ciclo lento → rápido pela velocidade. Agachado: frente/trás usam o Crouch, lados o Strafing (postura baixa).
   */
  private locomotion(p: PlayerView, rest: number, crouch: boolean): void {
    const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
    const fwd = p.vx * s + p.vz * c;
    const side = p.vx * c - p.vz * s; // > 0 = direita do personagem
    const len = Math.hypot(fwd, side) || 1;
    const f = fwd / len, r = side / len;
    const norm = Math.abs(f) + Math.abs(r) || 1;
    const wF = Math.max(0, f) / norm, wB = Math.max(0, -f) / norm;
    const wR = Math.max(0, r) / norm, wL = Math.max(0, -r) / norm;
    const sp = this.speed;
    const cycle = (key: string, w: number) => {
      if (w <= 0.001) return;
      const d = LOCO[key];
      this.want(key, rest * w);
      this.ratio(key, Math.max(d.min, Math.min(d.max, sp / d.speed)));
    };
    if (crouch) {
      this.want('crouch', rest * (wF + wB));
      cycle('strafeL', wL);
      cycle('strafeR', wR);
      return;
    }
    const run = clamp01((sp - 1.8) / 1.2); // frente: andar → correr
    cycle('walk', wF * (1 - run));
    cycle('runF', wF * run);
    const back = clamp01((sp - 0.6) / 0.8); // trás: passos curtos → corrida de costas
    cycle('stepB', wB * (1 - back));
    cycle('sprintB', wB * back);
    cycle('walkL', wL);
    cycle('walkR', wR);
  }

  private ratio(key: string, r: number): void {
    const l = this.layers.get(key);
    if (l) l.group.speedRatio = r;
  }

  /** Posição (0..1) de uma animação com tempo controlado manualmente. */
  private scrub(key: string, t: number): void {
    const l = this.layers.get(key);
    if (!l) return;
    if (!l.playing) {
      l.group.start(true, 0, l.group.from, l.group.to);
      l.playing = true;
    }
    l.group.goToFrame(l.group.from + (l.group.to - l.group.from) * t);
  }

  /** Mistura suave entre as animações (pesos) e liga/desliga as que entram/saem. */
  private blend(dt: number, rate: number): void {
    const k = Math.min(1, dt * rate);
    for (const l of this.layers.values()) {
      l.weight += (l.target - l.weight) * k;
      if (l.target === 0 && l.weight < 0.02) {
        if (l.playing) {
          l.group.stop();
          l.playing = false;
        }
        l.weight = 0;
        continue;
      }
      if (!l.playing) {
        if (l.manual) l.group.start(true, 0, l.group.from, l.group.to);
        else l.group.start(true, l.group.speedRatio || 1, l.group.from, l.group.to);
        l.playing = true;
      }
      l.group.weight = Math.max(0.0001, l.weight);
    }
  }

  /** Depois das animações: o tronco acompanha a mira e reage a dano. */
  private postAnimate(): void {
    if (!this.visible || this.dead) return;
    const hit = Math.sin(this.hitT * Math.PI) * this.hitT;
    const add = (name: string, x: number, y = 0, z = 0) => {
      const n = this.nodes.get(name);
      if (!n || (!x && !y && !z)) return;
      if (!n.rotationQuaternion) n.rotationQuaternion = Quaternion.FromEulerVector(n.rotation);
      n.rotationQuaternion.multiplyInPlace(Quaternion.RotationYawPitchRoll(y, x, z));
    };
    const pitch = -this.pitch;
    add('Spine', pitch * 0.3 - hit * 0.15, 0, hit * 0.1 * this.hitSide);
    add('Chest', pitch * 0.35 - hit * 0.2);
    add('Neck', pitch * 0.15);
    add('Head', pitch * 0.2 + hit * 0.25, hit * 0.3 * this.hitSide);
  }

  dispose(): void {
    this.scene.onAfterAnimationsObservable.remove(this.obs);
    for (const l of this.layers.values()) l.group.dispose();
    this.gun?.dispose();
    this.flash.dispose();
    this.blob.dispose();
    this.gunNode.dispose();
    this.model.dispose(false, false);
    this.root.dispose();
  }
}

type Impl = SkinnedCharacter | ProceduralCharacter;

/** Personagem de um jogador/bot (ou do lobby). Usa o modelo 3D da equipe; o boneco antigo só se o modelo faltar. */
export class CharacterModel {
  /** Material PBR do boneco de reserva nas qualidades Alta/Ultra. */
  static get pbr(): boolean {
    return ProceduralCharacter.pbr;
  }
  static set pbr(v: boolean) {
    ProceduralCharacter.pbr = v;
  }

  private impl: Impl;
  /** true = modelo 3D do arquivo; false = boneco de reserva. */
  readonly fromModel: boolean;

  constructor(scene: Scene, readonly team: Team, variant: number, shadow: ShadowGenerator | null) {
    const asset = characterAsset(scene, team);
    this.fromModel = !!asset;
    this.impl = asset ? new SkinnedCharacter(scene, team, asset) : new ProceduralCharacter(scene, team, variant, shadow);
  }

  get root(): TransformNode {
    return this.impl.root;
  }
  set victory(v: boolean) {
    this.impl.victory = v;
  }
  get isDeadAnimDone(): boolean {
    return this.impl.isDeadAnimDone;
  }
  setWeapon(id: string, skin = 'default'): void {
    this.impl.setWeapon(id, skin);
  }
  fire(): void {
    this.impl.fire();
  }
  hit(fromAngle: number | null): void {
    this.impl.hit(fromAngle);
  }
  setVisible(v: boolean): void {
    this.impl.setVisible(v);
  }
  setProtected(on: boolean, time: number): void {
    this.impl.setProtected(on, time);
  }
  update(dt: number, p: PlayerView, reloadT: number): void {
    this.impl.update(dt, p, reloadT);
  }
  dispose(): void {
    this.impl.dispose();
  }
}
