// MODELO PROVISÓRIO (bonecos montados por código). Só é usado como reserva de emergência se os arquivos GLB
// dos personagens (public/assets/characters/) não carregarem. O personagem do jogo é o de Character.ts.
// Personagem 3D com esqueleto (18 ossos) e malha com skinning, proporções humanas (1,80 m),
// uniforme tático, colete, capacete/balaclava/boné, luvas e botas. 5 visuais por equipe.
// Animação procedural: caminhada/corrida (ciclo de pernas), agachar, mira acompanhando o pitch,
// braços por cinemática inversa segurando a arma, recuo, recarga, plantar/desarmar e queda ao morrer.
import {
  Bone,
  Color3,
  CreatePlane,
  Matrix,
  Mesh,
  PBRMaterial,
  Quaternion,
  Skeleton,
  StandardMaterial,
  TransformNode,
  Vector3,
  type InstancedMesh,
  type Scene,
  type ShadowGenerator
} from '../core/babylon';
import { GeoBuilder } from '../core/GeoBuilder';
import { gunSource } from '../weapons/WeaponModels';
import { WEAPONS } from '../weapons/WeaponData';
import type { PlayerView, Team } from '../sim/types';
import { paintedTexture } from '../maps/textures';

interface Look {
  shirt: string;
  pants: string;
  vest: string;
  head: 'helmet' | 'balaclava' | 'cap' | 'beanie' | 'scarf';
  headColor: string;
  skin: string;
  accent: string;
}

// TR: tons de terra/verde-oliva + braçadeira laranja. CT: tons de azul + braçadeira azul e capacete.
// As paletas não se cruzam, para nunca confundir inimigo com companheiro.
const LOOKS: Record<Team, Look[]> = {
  T: [
    { shirt: '#9c8763', pants: '#5d5a3c', vest: '#3f3a2a', head: 'balaclava', headColor: '#2a2318', skin: '#b98a68', accent: '#2a2a22' },
    { shirt: '#7a5236', pants: '#6b5a3e', vest: '#4a3b2b', head: 'scarf', headColor: '#8a2b22', skin: '#8d5f45', accent: '#2b2018' },
    { shirt: '#86845f', pants: '#a69676', vest: '#4f4a35', head: 'scarf', headColor: '#cfc3a8', skin: '#c49a78', accent: '#3a3426' },
    { shirt: '#6a4a2e', pants: '#8a7550', vest: '#3e2f1f', head: 'beanie', headColor: '#a0602a', skin: '#d0a385', accent: '#2b2015' },
    { shirt: '#5b6640', pants: '#a08f6a', vest: '#38402a', head: 'beanie', headColor: '#4a3a2c', skin: '#9b6b4f', accent: '#262b1c' }
  ],
  CT: [
    { shirt: '#2a3a5c', pants: '#1f2a40', vest: '#16223a', head: 'helmet', headColor: '#243556', skin: '#d6a98a', accent: '#101826' },
    { shirt: '#3d5a86', pants: '#26354f', vest: '#1d2c47', head: 'helmet', headColor: '#2c4166', skin: '#b7896a', accent: '#141c2b' },
    { shirt: '#4a6fa5', pants: '#2c3a55', vest: '#22314f', head: 'helmet', headColor: '#30466e', skin: '#c99c7c', accent: '#16203a' },
    { shirt: '#22345a', pants: '#18233a', vest: '#121b30', head: 'balaclava', headColor: '#1b2a48', skin: '#e0b496', accent: '#0c1322' },
    { shirt: '#355585', pants: '#2a3d5e', vest: '#203252', head: 'helmet', headColor: '#2a3f66', skin: '#a8765a', accent: '#121c30' }
  ]
};

const TEAM_BAND: Record<Team, string> = { T: '#f08a24', CT: '#3d8bff' };

// índices dos ossos
const B = { root: 0, hips: 1, spine: 2, chest: 3, neck: 4, head: 5, uaR: 6, faR: 7, hR: 8, uaL: 9, faL: 10, hL: 11, thR: 12, shR: 13, ftR: 14, thL: 15, shL: 16, ftL: 17 };
const L1 = 0.28, L2 = 0.27;
const DOWN = new Vector3(0, -1, 0);

/** Pose da arma em relação ao osso do peito: posição da empunhadura e da mão esquerda. */
function weaponPose(cls: string): { grip: Vector3; left: Vector3 | null } {
  switch (cls) {
    case 'pistol': return { grip: new Vector3(0.06, 0.03, 0.42), left: new Vector3(0.03, 0.0, 0.38) };
    case 'knife': return { grip: new Vector3(0.22, -0.22, 0.26), left: null };
    case 'grenade': return { grip: new Vector3(0.26, 0.05, 0.12), left: null };
    case 'c4': return { grip: new Vector3(0.12, -0.18, 0.3), left: new Vector3(-0.08, -0.18, 0.3) };
    default: return { grip: new Vector3(0.13, -0.08, 0.3), left: new Vector3(0.0, -0.06, 0.55) };
  }
}

let flashMat: StandardMaterial | null = null;
let blobMat: StandardMaterial | null = null;

export class ProceduralCharacter {
  /** Material PBR (tecido fosco, reflexos do ambiente) nas qualidades Alta/Ultra. */
  static pbr = false;
  readonly root: TransformNode;
  private mesh: Mesh;
  private skeleton: Skeleton;
  private bones: Bone[] = [];
  private gun: InstancedMesh | null = null;
  private gunId = '';
  private gunSkin = '';
  private gunNode: TransformNode;
  private flash: Mesh;
  private flashT = 0;
  private phase = Math.random() * 10;
  private crouchT = 0;
  private deathT = -1;
  private deathDir = 1;
  private deathMode: 'side' | 'back' | 'front' = 'side';
  // máquina de estados da animação: pesos suavizados de cada estado
  private airT = 0;
  private riseT = 0;
  private fallV = 0;
  private landT = 0;
  private sprintW = 0;
  private switchT = 0;
  private lastWeapon = '';
  private hitT = 0;
  private hitSide = 1;
  private hitAngle: number | null = null;
  private calmT = 0;
  private relaxW = 0;
  private aimHold = 0;
  private idleT = Math.random() * 10;
  private victoryW = 0;
  /** Comemoração (fim de partida vencida / lobby). */
  victory = false;
  private kick = 0;
  private q = new Quaternion();
  private visible = true;
  private blob: Mesh;
  speedSmoothed = 0;

  constructor(private scene: Scene, readonly team: Team, variant: number, shadow: ShadowGenerator | null) {
    const look = LOOKS[team][variant % 5];
    this.root = new TransformNode('char', scene);
    this.skeleton = new Skeleton('skel', 'skel' + Math.random(), scene);
    const def: [string, number, [number, number, number]][] = [
      ['root', -1, [0, 0, 0]], ['hips', 0, [0, 0.95, 0]], ['spine', 1, [0, 0.18, 0]], ['chest', 2, [0, 0.22, 0]],
      ['neck', 3, [0, 0.17, 0]], ['head', 4, [0, 0.08, 0]],
      ['uaR', 3, [0.21, 0.12, 0]], ['faR', 6, [0, -L1, 0]], ['hR', 7, [0, -L2, 0]],
      ['uaL', 3, [-0.21, 0.12, 0]], ['faL', 9, [0, -L1, 0]], ['hL', 10, [0, -L2, 0]],
      ['thR', 1, [0.1, -0.05, 0]], ['shR', 12, [0, -0.42, 0]], ['ftR', 13, [0, -0.4, 0]],
      ['thL', 1, [-0.1, -0.05, 0]], ['shL', 15, [0, -0.42, 0]], ['ftL', 16, [0, -0.4, 0]]
    ];
    for (const [name, parent, t] of def) {
      const bone = new Bone(name, this.skeleton, parent >= 0 ? this.bones[parent] : null, Matrix.Translation(t[0], t[1], t[2]));
      this.bones.push(bone);
    }

    const g = new GeoBuilder();
    const c = look;
    // pernas e botas
    for (const s of [1, -1]) {
      const th = s > 0 ? B.thR : B.thL, sh = s > 0 ? B.shR : B.shL, ft = s > 0 ? B.ftR : B.ftL;
      g.capsule(0.088, 0.47, [0.1 * s, 0.68, 0], c.pants, undefined, th);
      g.capsule(0.072, 0.44, [0.1 * s, 0.28, 0], c.pants, undefined, sh);
      g.box(0.13, 0.09, 0.1, [0.1 * s, 0.5, 0.055], c.accent, undefined, sh); // joelheira
      g.box(0.12, 0.11, 0.27, [0.1 * s, 0.055, 0.04], '#1c1a17', undefined, ft); // bota
      g.box(0.11, 0.04, 0.12, [0.1 * s, 0.13, 0.0], '#2a2620', undefined, ft);
      // braços (manga, antebraço, luva)
      const ua = s > 0 ? B.uaR : B.uaL, fa = s > 0 ? B.faR : B.faL, hd = s > 0 ? B.hR : B.hL;
      g.sphere(0.15, [0.21 * s, 1.46, 0], c.shirt, [1, 0.9, 1], ua);
      g.capsule(0.066, 0.3, [0.21 * s, 1.33, 0], c.shirt, undefined, ua);
      g.capsule(0.058, 0.28, [0.21 * s, 1.06, 0], c.shirt, undefined, fa);
      g.cyl(0.11, 0.11, 0.05, [0.21 * s, 0.95, 0], c.accent, undefined, fa);
      g.box(0.075, 0.1, 0.06, [0.21 * s, 0.87, 0.01], '#1e1f1c', undefined, hd);
    }
    // quadril, cinto e tronco
    g.box(0.36, 0.2, 0.22, [0, 0.93, 0], c.pants, undefined, B.hips);
    g.box(0.38, 0.05, 0.24, [0, 1.02, 0], '#22201c', undefined, B.hips);
    g.box(0.33, 0.24, 0.2, [0, 1.13, 0], c.shirt, undefined, B.spine);
    g.box(0.42, 0.3, 0.25, [0, 1.35, 0], c.shirt, undefined, B.chest);
    // colete com placas e bolsos
    g.box(0.4, 0.34, 0.07, [0, 1.3, 0.13], c.vest, undefined, B.chest);
    for (const s2 of [1, -1]) g.cyl(0.152, 0.152, 0.07, [0.21 * s2, 1.36, 0], TEAM_BAND[team], undefined, s2 > 0 ? B.uaR : B.uaL);
    g.box(0.22, 0.08, 0.01, [0, 1.4, -0.166], TEAM_BAND[team], undefined, B.chest); // faixa nas costas
    g.box(0.4, 0.34, 0.06, [0, 1.3, -0.13], c.vest, undefined, B.chest);
    for (const x of [-0.12, 0, 0.12]) g.box(0.1, 0.12, 0.06, [x, 1.2, 0.18], c.accent, undefined, B.chest);
    g.box(0.12, 0.08, 0.05, [0.13, 1.4, 0.17], c.accent, undefined, B.chest);
    if (team === 'CT') g.box(0.14, 0.05, 0.005, [-0.1, 1.42, 0.168], '#d9d4c7', undefined, B.chest); // emblema
    // pescoço e cabeça
    g.cyl(0.1, 0.11, 0.1, [0, 1.53, 0], c.skin, undefined, B.neck);
    g.sphere(0.22, [0, 1.67, 0.01], c.skin, [0.92, 1.1, 1], B.head);
    g.box(0.06, 0.03, 0.04, [0, 1.65, 0.11], c.skin, undefined, B.head); // nariz
    if (c.head === 'balaclava') {
      g.sphere(0.232, [0, 1.68, 0.0], c.headColor, [0.94, 1.1, 1], B.head);
      g.box(0.16, 0.045, 0.05, [0, 1.7, 0.1], c.skin, undefined, B.head);
    }
    if (c.head === 'helmet' || (team === 'CT' && c.head === 'balaclava')) {
      g.sphere(0.27, [0, 1.73, -0.005], c.headColor, [0.98, 0.72, 1.05], B.head);
      g.box(0.26, 0.03, 0.04, [0, 1.71, 0.12], c.headColor, undefined, B.head);
      g.box(0.17, 0.05, 0.03, [0, 1.71, 0.135], '#0b0d10', undefined, B.head); // óculos
    }
    if (c.head === 'cap') {
      g.sphere(0.235, [0, 1.75, 0], c.headColor, [0.96, 0.55, 1], B.head);
      g.box(0.18, 0.015, 0.12, [0, 1.76, 0.14], c.headColor, undefined, B.head);
      g.box(0.04, 0.06, 0.06, [0.12, 1.67, 0.0], '#151515', undefined, B.head); // fone
    }
    if (c.head === 'beanie') g.sphere(0.24, [0, 1.76, -0.005], c.headColor, [0.97, 0.62, 1], B.head);
    if (c.head === 'scarf') {
      g.cyl(0.2, 0.22, 0.09, [0, 1.6, 0.0], c.headColor, undefined, B.head);
      g.box(0.18, 0.06, 0.05, [0, 1.63, 0.1], c.headColor, undefined, B.head);
      g.sphere(0.235, [0, 1.75, -0.01], c.headColor, [0.95, 0.6, 1], B.head);
    }
    if (c.head !== 'balaclava' && c.head !== 'helmet') {
      g.box(0.03, 0.02, 0.02, [0.045, 1.69, 0.105], '#1a1410', undefined, B.head);
      g.box(0.03, 0.02, 0.02, [-0.045, 1.69, 0.105], '#1a1410', undefined, B.head);
    }

    this.mesh = g.build('soldier', scene, true);
    if (ProceduralCharacter.pbr) {
      const pm = new PBRMaterial('soldierPbr', scene);
      pm.albedoColor = Color3.White();
      pm.metallic = 0.05;
      pm.roughness = 0.78;
      pm.environmentIntensity = 0.5;
      pm.directIntensity = 1.5;
      this.mesh.material = pm;
    } else {
      const mat = new StandardMaterial('soldierMat', scene);
      mat.diffuseColor = Color3.White();
      mat.specularColor = new Color3(0.08, 0.08, 0.08);
      this.mesh.material = mat;
    }
    this.mesh.skeleton = this.skeleton;
    this.mesh.parent = this.root;
    this.mesh.receiveShadows = true;
    // O mapa de sombras do cenário é estático (desenhado uma vez): personagens usam sombra de contato
    void shadow;
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

    this.gunNode = new TransformNode('charGun', scene);
    this.gunNode.attachToBone(this.bones[B.chest], this.mesh);

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
  }

  setWeapon(id: string, skin = 'default'): void {
    if (id === this.gunId && skin === this.gunSkin) return;
    this.gunId = id;
    this.gunSkin = skin;
    this.gun?.dispose();
    this.gun = null;
    const src = gunSource(id, this.scene, skin);
    this.gun = src.createInstance('gunInst');
    this.gun.parent = this.gunNode;
    this.gun.isVisible = true;
    const cls = WEAPONS[id]?.cls ?? 'rifle';
    const pose = weaponPose(cls);
    this.gunNode.position.copyFrom(pose.grip);
    this.flash.position.set(0, 0.02, cls === 'pistol' ? 0.24 : cls === 'sniper' ? 0.9 : cls === 'smg' ? 0.4 : 0.66);
  }

  fire(): void {
    this.kick = 1;
    this.flashT = 0.06;
    this.aimHold = 1;
    this.calmT = 0;
  }

  /** Reação a dano: tranco do tronco/cabeça. fromAngle = direção (mundo) de onde veio o tiro. */
  hit(fromAngle: number | null): void {
    this.hitT = 1;
    this.hitSide = Math.random() < 0.5 ? -1 : 1;
    this.hitAngle = fromAngle;
    this.calmT = 0;
    this.aimHold = 1;
  }

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    this.root.setEnabled(v);
  }

  /** Proteção de renascimento: o soldado pisca semitransparente. */
  setProtected(on: boolean, time: number): void {
    const v = on ? 0.45 + 0.25 * Math.sin(time * 14) : 1;
    if (this.mesh.visibility !== v) this.mesh.visibility = v;
  }

  get isDeadAnimDone(): boolean {
    return this.deathT >= 1;
  }

  dispose(): void {
    this.gun?.dispose();
    this.flash.dispose();
    this.blob.dispose();
    this.gunNode.dispose();
    this.mesh.dispose(false, true);
    this.skeleton.dispose();
    this.root.dispose();
  }

  private rot(i: number, x: number, y = 0, z = 0): void {
    Quaternion.FromEulerAnglesToRef(x, y, z, this.q);
    this.bones[i].rotationQuaternion = this.q;
  }

  private setQ(i: number, q: Quaternion): void {
    this.bones[i].rotationQuaternion = q;
  }

  /** Braço por cinemática inversa no espaço do peito. */
  private ik(side: 1 | -1, target: Vector3): void {
    const S = new Vector3(0.21 * side, 0.12, 0);
    const toT = target.subtract(S);
    let D = toT.length();
    D = Math.min(D, L1 + L2 - 0.01);
    const t = toT.normalize();
    const cosA = Math.max(-1, Math.min(1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D)));
    const a = Math.acos(cosA);
    const pole = new Vector3(0.9 * side, -1, -0.3);
    const perp = pole.subtract(t.scale(Vector3.Dot(pole, t))).normalize();
    const u = t.scale(Math.cos(a)).add(perp.scale(Math.sin(a)));
    const E = S.add(u.scale(L1));
    const f = target.subtract(E).normalize();
    const q1 = new Quaternion();
    Quaternion.FromUnitVectorsToRef(DOWN, u, q1);
    const inv = Quaternion.Inverse(q1);
    const fLocal = new Vector3();
    f.rotateByQuaternionToRef(inv, fLocal);
    const q2 = new Quaternion();
    Quaternion.FromUnitVectorsToRef(DOWN, fLocal.normalize(), q2);
    this.setQ(side > 0 ? B.uaR : B.uaL, q1);
    this.setQ(side > 0 ? B.faR : B.faL, q2);
    this.rot(side > 0 ? B.hR : B.hL, 0);
  }

  /** Atualiza posição e animação a partir do estado do jogador (já interpolado). */
  update(dt: number, p: PlayerView, reloadT: number): void {
    this.root.position.set(p.x, p.y, p.z);
    this.root.rotation.y = p.yaw;
    this.setWeapon(p.weapon, p.skin);
    const cls = WEAPONS[p.weapon]?.cls ?? 'rifle';

    // ---------------------------------------------------------------- estado: morte (direção conforme o tiro)
    if (!p.alive) {
      if (this.deathT < 0) {
        this.deathT = 0;
        // atingido pela frente cai de costas; por trás cai de frente; dos lados, para o lado
        const rel = this.hitAngle === null ? Math.random() * Math.PI * 2 : angWrap(this.hitAngle - p.yaw);
        this.deathMode = Math.abs(rel) < Math.PI / 4 ? 'back' : Math.abs(rel) > (Math.PI * 3) / 4 ? 'front' : 'side';
        this.deathDir = rel > 0 ? 1 : -1;
      }
      this.deathT = Math.min(1, this.deathT + dt * 2.2);
      const e = 1 - Math.pow(1 - this.deathT, 3);
      // primeiro os joelhos cedem, depois o corpo tomba
      const knees = Math.min(1, this.deathT * 2.5);
      const fall = Math.max(0, (this.deathT - 0.15) / 0.85);
      const f = 1 - Math.pow(1 - fall, 3);
      if (this.deathMode === 'side') this.rot(B.root, 0, 0, -this.deathDir * f * (Math.PI / 2) * 0.98);
      else this.rot(B.root, (this.deathMode === 'back' ? -1 : 1) * f * (Math.PI / 2) * 0.96, 0, 0);
      this.bones[B.root].position = new Vector3(0, 0.12 * f, this.deathMode === 'back' ? -0.25 * f : this.deathMode === 'front' ? 0.25 * f : 0);
      this.bones[B.hips].position = new Vector3(0, 0.95 - 0.25 * knees * (1 - f), 0);
      this.rot(B.spine, (this.deathMode === 'front' ? 0.3 : -0.25) * e);
      this.rot(B.head, (this.deathMode === 'back' ? -0.5 : 0.35) * e, 0, 0.2 * this.deathDir * e);
      this.rot(B.uaR, -0.3 * e, 0, 0.8 * e);
      this.rot(B.uaL, -0.3 * e, 0, -0.8 * e);
      this.rot(B.faR, -0.3 * e);
      this.rot(B.faL, -0.2 * e);
      this.rot(B.thR, -0.4 * e - 0.5 * knees * (1 - f));
      this.rot(B.shR, 0.6 * e + 0.8 * knees * (1 - f));
      this.rot(B.thL, 0.1 * e - 0.4 * knees * (1 - f));
      this.rot(B.shL, 0.2 * e + 0.7 * knees * (1 - f));
      this.gunNode.setEnabled(false);
      this.flash.setEnabled(false);
      return;
    }
    if (this.deathT >= 0) {
      this.deathT = -1;
      this.hitAngle = null;
      this.rot(B.root, 0);
      this.bones[B.root].position = Vector3.Zero();
      this.gunNode.setEnabled(true);
    }

    // ---------------------------------------------------------------- entradas da máquina de estados
    const speed = Math.hypot(p.vx, p.vz);
    this.speedSmoothed += (speed - this.speedSmoothed) * Math.min(1, dt * 10);
    const kneel = p.act === 2 || p.act === 3;
    const crouch = p.crouch || kneel ? 1 : 0;
    const k = (rate: number) => Math.min(1, dt * rate);
    this.crouchT += (crouch - this.crouchT) * k(10);
    const ct = this.crouchT;
    // no ar: subindo (pulo) ou caindo
    const airborne = !p.ground;
    this.airT += ((airborne ? 1 : 0) - this.airT) * k(airborne ? 12 : 16);
    if (airborne) this.fallV = Math.min(this.fallV, p.vy);
    else if (this.fallV < -3.5) {
      // estado aterrissar: amortece proporcional à queda
      this.landT = Math.min(1, -this.fallV / 10);
      this.fallV = 0;
    } else this.fallV = 0;
    this.landT = Math.max(0, this.landT - dt * 3.2);
    const rising = p.vy > 0.5 ? 1 : 0;
    this.riseT += (rising - this.riseT) * k(10);
    // corrida (sprint): acima da velocidade de corrida normal
    const sprintW = p.ground && !p.crouch ? Math.max(0, Math.min(1, (this.speedSmoothed - 5.9) / 0.8)) : 0;
    this.sprintW += (sprintW - this.sprintW) * k(6);
    // troca de arma: abaixa e levanta
    if (p.weapon !== this.lastWeapon) {
      if (this.lastWeapon) this.switchT = 1;
      this.lastWeapon = p.weapon;
    }
    this.switchT = Math.max(0, this.switchT - dt * 2.4);
    // reação a dano
    this.hitT = Math.max(0, this.hitT - dt * 4);
    // parado há um tempo sem atirar: arma em posição relaxada
    this.calmT = this.kick > 0.05 || this.speedSmoothed > 0.5 || reloadT > 0 ? 0 : this.calmT + dt;
    const relax = Math.max(0, Math.min(1, (this.calmT - 2.5) / 0.6)) * (1 - this.aimHold);
    this.relaxW += (relax - this.relaxW) * k(4);
    this.aimHold = Math.max(0, this.aimHold - dt * 0.5);
    this.victoryW += ((this.victory ? 1 : 0) - this.victoryW) * k(4);
    this.idleT += dt;

    // ---------------------------------------------------------------- pernas (locomoção + ar + aterrissagem)
    const fwd = p.vx * Math.sin(p.yaw) + p.vz * Math.cos(p.yaw);
    const side = p.vx * Math.cos(p.yaw) - p.vz * Math.sin(p.yaw);
    const sp = this.speedSmoothed;
    this.phase += dt * (sp > 0.2 ? 2.2 + sp * 1.25 : 0) * (fwd < -0.3 ? -1 : 1);
    const ground = 1 - this.airT;
    const amp = Math.min(1, sp / 5.5) * (0.62 + this.sprintW * 0.3) * ground * (1 - ct * 0.5);
    const s = Math.sin(this.phase);
    const lateral = Math.abs(side) > Math.abs(fwd) ? Math.sign(side) * 0.25 * Math.min(1, sp / 4) : 0;
    const breath = Math.sin(this.idleT * 1.8) * (1 - Math.min(1, sp)) * 0.012;

    const bob = Math.abs(Math.cos(this.phase)) * 0.035 * amp;
    const land = this.landT * this.landT;
    this.bones[B.hips].position = new Vector3(0, 0.95 - ct * 0.4 - bob - land * 0.16 + breath * 0.3, 0);
    const tc = -1.1 * ct - land * 0.45, kc = 1.95 * ct + land * 0.85;
    // pulo: pernas recolhidas; queda: pernas estendidas à frente se preparando
    const air = this.airT;
    const tuckR = (-0.55 * this.riseT - 0.25 * (1 - this.riseT)) * air;
    const tuckL = (-0.15 * this.riseT - 0.35 * (1 - this.riseT)) * air;
    this.rot(B.thR, tc - s * amp + tuckR, 0, lateral);
    this.rot(B.shR, kc + Math.max(0, s) * amp * 1.3 + (0.95 * this.riseT + 0.35) * air);
    this.rot(B.ftR, -0.85 * ct * 0.5);
    this.rot(B.thL, tc + s * amp + tuckL, 0, lateral);
    this.rot(B.shL, kc + Math.max(0, -s) * amp * 1.3 + (0.5 * this.riseT + 0.5) * air);
    this.rot(B.ftL, -0.85 * ct * 0.5);
    if (kneel) {
      this.rot(B.thL, -0.2, 0, 0);
      this.rot(B.shL, 1.9);
    }

    // ---------------------------------------------------------------- tronco (mira, corrida, dano, vitória)
    this.kick *= Math.exp(-dt * 14);
    const pitch = Math.max(-1.2, Math.min(1.2, p.pitch)) * (1 - this.sprintW * 0.7);
    const hit = Math.sin(this.hitT * Math.PI) * this.hitT;
    const lean = this.sprintW * 0.22 + land * 0.2;
    this.rot(B.hips, 0, Math.sin(this.phase) * 0.06 * amp, 0);
    this.rot(B.spine, -pitch * 0.35 + ct * 0.25 + (kneel ? 0.35 : 0) + lean - hit * 0.18 + breath, hit * 0.12 * this.hitSide, 0);
    this.rot(B.chest, -pitch * 0.4 - this.kick * 0.06 - hit * 0.22 - this.victoryW * 0.15 + breath, -this.sprintW * 0.25, 0);
    this.rot(B.neck, -pitch * 0.1 - this.sprintW * 0.12);
    this.rot(B.head, -pitch * 0.15 + hit * 0.25 - this.victoryW * 0.2, hit * 0.3 * this.hitSide, 0);

    // ---------------------------------------------------------------- braços e arma (mira, fogo, recarga, troca, corrida, relaxado, vitória)
    const pose = weaponPose(cls);
    const grip = pose.grip.clone();
    grip.z -= this.kick * 0.04;
    let gunPitch = -this.kick * 0.15;
    let gunYaw = 0;
    // corrida: arma atravessada no peito, cano para baixo/esquerda
    const longGun = cls !== 'pistol' && cls !== 'knife' && cls !== 'grenade' && cls !== 'c4';
    if (this.sprintW > 0.01) {
      const w = this.sprintW;
      grip.x += (longGun ? -0.02 : 0.02) * w;
      grip.y -= 0.12 * w;
      grip.z -= 0.1 * w;
      gunPitch += 0.55 * w;
      gunYaw -= (longGun ? 0.75 : 0.3) * w;
    }
    // relaxado (parado sem combate): cano apontado para o chão
    if (this.relaxW > 0.01) {
      grip.y -= 0.06 * this.relaxW;
      gunPitch += 0.45 * this.relaxW;
      gunYaw -= 0.2 * this.relaxW;
    }
    // troca de arma: desce para fora da vista e sobe com a nova
    const sw = Math.sin(this.switchT * Math.PI);
    grip.y -= 0.25 * sw;
    gunPitch += 0.9 * sw;
    // recarga
    if (reloadT > 0) gunPitch += 0.35 * Math.sin(Math.min(1, reloadT) * Math.PI);
    // vitória: arma erguida
    if (this.victoryW > 0.01) {
      const v = this.victoryW;
      grip.y += 0.32 * v;
      grip.z -= 0.12 * v;
      gunPitch -= 1.05 * v;
    }
    if (kneel) {
      this.ik(1, new Vector3(0.12, -0.42, 0.42));
      this.ik(-1, new Vector3(-0.08, -0.42, 0.42));
      this.gunNode.setEnabled(false);
    } else {
      this.gunNode.setEnabled(this.switchT < 0.45 || this.switchT > 0.55);
      this.ik(1, grip.add(new Vector3(0, -0.02, -0.02)));
      if (pose.left && sw < 0.6 && this.victoryW < 0.5) {
        // mão de apoio acompanha a arma (girada junto com o cano)
        const left = pose.left.clone().subtract(pose.grip);
        const qGun = Quaternion.FromEulerAngles(gunPitch, gunYaw, 0);
        const rel = new Vector3();
        left.rotateByQuaternionToRef(qGun, rel);
        const target = grip.add(rel);
        if (reloadT > 0) {
          const r = Math.sin(Math.min(1, reloadT) * Math.PI);
          target.y -= 0.25 * r;
          target.z -= 0.15 * r;
          target.x += 0.08 * r;
        }
        this.ik(-1, target);
      } else if (this.victoryW > 0.5) {
        this.ik(-1, new Vector3(-0.26, 0.42 * this.victoryW, 0.08));
      } else {
        this.ik(-1, new Vector3(-0.28, -0.42, 0.08 + Math.sin(this.phase) * 0.08 * amp));
      }
    }
    this.gunNode.position.copyFrom(grip);
    this.gunNode.rotation.set(gunPitch, gunYaw, 0);

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.setEnabled(this.flashT > 0);
    }
  }
}

function angWrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
