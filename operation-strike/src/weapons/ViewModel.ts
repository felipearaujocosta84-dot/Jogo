// Visão em primeira pessoa: braços com luvas e mangas segurando a arma atual (modelos de WeaponModels).
// Grupo de renderização separado (nunca atravessa paredes). Animações procedurais: balanço, inércia,
// recuo, recarga (pente sai/entra), saque, inspeção, mira, golpe de faca, arremesso de granada, plantio da C4.
import {
  Color3,
  CreateBox,
  CreateCylinder,
  CreatePlane,
  Mesh,
  Quaternion,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Camera,
  type Scene
} from '../core/babylon';
import { paintedTexture } from '../maps/textures';
import { buildGun, type GunParts } from './WeaponModels';
import { WEAPONS, type WeaponClass } from './WeaponData';
import type { Team } from '../sim/types';

export const VIEW_GROUP = 1;

type AnimKind = 'reload' | 'draw' | 'inspect' | 'slash' | 'throw' | 'plant';

interface Visual {
  id: string;
  skin: string;
  cls: WeaponClass;
  parts: GunParts;
  magRest: Vector3 | null;
  hip: Vector3;
  ads: Vector3;
}

const POSE: Record<WeaponClass, { hip: [number, number, number]; ads: [number, number, number] }> = {
  rifle: { hip: [0.15, -0.165, 0.42], ads: [0, -0.128, 0.26] },
  smg: { hip: [0.15, -0.16, 0.4], ads: [0, -0.12, 0.26] },
  sniper: { hip: [0.15, -0.17, 0.4], ads: [0, -0.2, 0.2] },
  pistol: { hip: [0.13, -0.14, 0.34], ads: [0, -0.085, 0.28] },
  knife: { hip: [0.16, -0.17, 0.32], ads: [0.16, -0.17, 0.32] },
  grenade: { hip: [0.17, -0.16, 0.3], ads: [0.17, -0.16, 0.3] },
  c4: { hip: [0.05, -0.2, 0.34], ads: [0.05, -0.2, 0.34] }
};

export class ViewModel {
  private root: TransformNode;
  private sway: TransformNode;
  private visuals = new Map<string, Visual>();
  private current: Visual | null = null;
  private mats: Record<string, StandardMaterial> = {};
  private flash: Mesh;
  private flashT = 0;
  private anim: { kind: AnimKind; t: number; dur: number } | null = null;
  private aimT = 0;
  private swayX = 0;
  private swayY = 0;
  private kickBack = 0;
  private kickRot = 0;
  private crouchT = 0;
  private time = 0;
  private team: Team = 'CT';
  private visible = true;

  constructor(private scene: Scene, camera: Camera) {
    scene.setRenderingAutoClearDepthStencil(VIEW_GROUP, true, true, false);
    this.root = new TransformNode('viewmodel', scene);
    this.root.parent = camera;
    this.sway = new TransformNode('vmSway', scene);
    this.sway.parent = this.root;
    this.mat('glove', '#1e1f1c', 0.08);
    this.mat('sleeveT', '#6b6243', 0.04);
    this.mat('sleeveCT', '#2a3446', 0.04);
    this.mat('cuff', '#2b2a24', 0.04);
    this.mat('skin', '#b98a68', 0.06);
    this.mat('watch', '#101214', 0.5);

    const tex = paintedTexture(scene, 'muzzleTex', 128, (g, s) => {
      const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grd.addColorStop(0, 'rgba(255,250,220,1)');
      grd.addColorStop(0.25, 'rgba(255,200,90,0.9)');
      grd.addColorStop(1, 'rgba(255,120,20,0)');
      g.fillStyle = grd;
      g.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = i % 2 ? s * 0.18 : s * 0.5;
        g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
    });
    const fm = new StandardMaterial('muzzleMat', scene);
    fm.emissiveTexture = tex;
    fm.opacityTexture = tex;
    fm.diffuseColor = Color3.Black();
    fm.disableLighting = true;
    fm.alphaMode = 1;
    fm.backFaceCulling = false;
    this.flash = CreatePlane('muzzleFlash', { size: 0.2 }, scene);
    this.flash.material = fm;
    this.flash.renderingGroupId = VIEW_GROUP;
    this.flash.isPickable = false;
    this.flash.setEnabled(false);
  }

  private mat(name: string, color: string, spec: number): void {
    const m = new StandardMaterial('vm_' + name, this.scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.specularColor = new Color3(spec, spec, spec);
    m.fogEnabled = false;
    this.mats[name] = m;
  }

  setTeam(team: Team): void {
    if (team === this.team) return;
    this.team = team;
    // mangas trocam de cor: recria os modelos
    for (const v of this.visuals.values()) v.parts.root.dispose(false, false);
    this.visuals.clear();
    const id = this.current?.id, skin = this.current?.skin;
    this.current = null;
    if (id) this.setWeapon(id, 0, skin);
  }

  private prep(m: Mesh | null): void {
    if (!m) return;
    m.renderingGroupId = VIEW_GROUP;
    m.alwaysSelectAsActiveMesh = true;
    m.isPickable = false;
  }

  private arm(parent: TransformNode, hand: Vector3, toward: Vector3): void {
    const node = new TransformNode('arm', this.scene);
    node.parent = parent;
    node.position.copyFrom(hand);
    const dir = toward.normalize();
    const up = Vector3.Up();
    const axis = Vector3.Cross(up, dir);
    const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(up, dir))));
    node.rotationQuaternion = axis.lengthSquared() < 1e-6 ? Quaternion.Identity() : Quaternion.RotationAxis(axis.normalize(), angle);
    const sleeve = this.team === 'T' ? 'sleeveT' : 'sleeveCT';
    const add = (m: Mesh, mat: string, y: number) => {
      m.parent = node;
      m.position.y = y;
      m.material = this.mats[mat];
      this.prep(m);
    };
    add(CreateBox('glove', { width: 0.072, height: 0.1, depth: 0.082 }, this.scene), 'glove', 0.02);
    add(CreateCylinder('wrist', { diameter: 0.068, height: 0.06, tessellation: 10 }, this.scene), 'skin', 0.09);
    add(CreateCylinder('cuff', { diameter: 0.088, height: 0.05, tessellation: 10 }, this.scene), 'cuff', 0.13);
    add(CreateCylinder('sleeve', { diameterTop: 0.12, diameterBottom: 0.098, height: 0.5, tessellation: 10 }, this.scene), sleeve, 0.38);
  }

  private visual(id: string, skin: string): Visual {
    const key = id + '|' + skin;
    let v = this.visuals.get(key);
    if (v) return v;
    const def = WEAPONS[id];
    const parts = buildGun(id, this.scene, skin);
    parts.root.parent = this.sway;
    for (const m of [parts.body, parts.mag, parts.slide]) this.prep(m);
    const cls = def.cls;
    // mãos
    if (cls === 'grenade') {
      this.arm(parts.root, new Vector3(0.0, -0.03, 0.02), new Vector3(0.4, -0.6, -0.7));
    } else if (cls === 'knife') {
      this.arm(parts.root, new Vector3(0.0, -0.02, 0.0), new Vector3(0.4, -0.55, -0.75));
    } else if (cls === 'c4') {
      this.arm(parts.root, new Vector3(0.08, -0.04, 0.04), new Vector3(0.45, -0.6, -0.65));
      this.arm(parts.root, new Vector3(-0.08, -0.04, 0.04), new Vector3(-0.45, -0.6, -0.65));
    } else {
      this.arm(parts.root, new Vector3(0.01, -0.09, -0.05), new Vector3(0.45, -0.55, -0.7));
      const lh = parts.leftHand;
      this.arm(parts.root, cls === 'pistol' ? new Vector3(-0.03, -0.085, -0.02) : lh, new Vector3(-0.55, -0.6, -0.55));
    }
    const pose = POSE[cls];
    v = { id, skin, cls, parts, magRest: parts.mag ? parts.mag.position.clone() : null, hip: new Vector3(...pose.hip), ads: new Vector3(...pose.ads) };
    parts.root.setEnabled(false);
    this.visuals.set(key, v);
    return v;
  }

  get weaponId(): string {
    return this.current?.id ?? '';
  }

  get muzzleWorld(): Vector3 {
    if (!this.current) return Vector3.Zero();
    return Vector3.TransformCoordinates(this.current.parts.muzzle, this.current.parts.root.getWorldMatrix());
  }

  setWeapon(id: string, drawTime: number, skin = 'default'): void {
    if (this.current?.id === id && this.current.skin === skin) return;
    const sameGun = this.current?.id === id;
    if (this.current) this.current.parts.root.setEnabled(false);
    this.current = this.visual(id, skin);
    if (sameGun) drawTime = 0; // só trocou a skin
    this.current.parts.root.setEnabled(this.visible);
    this.flash.parent = this.current.parts.root;
    this.flash.position.copyFrom(this.current.parts.muzzle);
    this.flash.position.z += 0.04;
    this.anim = drawTime > 0 ? { kind: 'draw', t: 0, dur: drawTime } : null;
  }

  fire(): void {
    const cls = this.current?.cls;
    if (cls === 'knife') {
      this.anim = { kind: 'slash', t: 0, dur: 0.38 };
      return;
    }
    if (cls === 'grenade') {
      this.anim = { kind: 'throw', t: 0, dur: 0.5 };
      return;
    }
    const pistol = cls === 'pistol';
    const sniper = cls === 'sniper';
    this.kickBack = Math.min(0.07, this.kickBack + (sniper ? 0.06 : pistol ? 0.035 : 0.02));
    this.kickRot = Math.min(0.3, this.kickRot + (sniper ? 0.25 : pistol ? 0.15 : 0.045));
    if (WEAPONS[this.current?.id ?? '']?.sound !== 'silenced') {
      this.flashT = 0.05;
      this.flash.rotation.z = Math.random() * Math.PI;
      this.flash.scaling.setAll(0.8 + Math.random() * 0.5);
    }
    if (this.anim?.kind === 'inspect') this.anim = null;
  }

  reload(duration: number): void {
    this.anim = { kind: 'reload', t: 0, dur: duration };
  }

  /** Inspeção da arma. Retorna false se não pôde começar (ex.: recarregando). */
  inspect(): boolean {
    if (this.anim && this.anim.kind !== 'inspect') return false;
    const cls = this.current?.cls;
    const dur = cls === 'knife' ? 2.6 : cls === 'pistol' ? 3 : cls === 'grenade' || cls === 'c4' ? 2 : 3.6;
    this.anim = { kind: 'inspect', t: 0, dur };
    return true;
  }

  plant(active: boolean): void {
    if (active && this.anim?.kind !== 'plant') this.anim = { kind: 'plant', t: 0, dur: 99 };
    if (!active && this.anim?.kind === 'plant') this.anim = null;
  }

  addLook(dYaw: number, dPitch: number): void {
    this.swayX = Math.max(-0.05, Math.min(0.05, this.swayX - dYaw * 0.08));
    this.swayY = Math.max(-0.05, Math.min(0.05, this.swayY + dPitch * 0.08));
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (this.current) this.current.parts.root.setEnabled(v);
    if (!v) this.flash.setEnabled(false);
  }

  update(dt: number, st: { aiming: boolean; crouched: boolean; speed: number; onGround: boolean; bobPhase: number; bobAmount: number; landDip: number }): void {
    this.time += dt;
    const v = this.current;
    if (!v) return;
    this.aimT += ((st.aiming && (!this.anim || this.anim.kind === 'inspect') ? 1 : 0) - this.aimT) * Math.min(1, dt * 16);
    this.crouchT += ((st.crouched ? 1 : 0) - this.crouchT) * Math.min(1, dt * 10);
    const decay = Math.exp(-dt * 7);
    this.swayX *= decay;
    this.swayY *= decay;
    this.kickBack *= Math.exp(-dt * 16);
    this.kickRot *= Math.exp(-dt * 12);

    const aimK = 1 - this.aimT * 0.85;
    const bob = st.bobAmount * aimK;
    const pos = Vector3.Lerp(v.hip, v.ads, this.aimT);
    pos.x += Math.cos(st.bobPhase) * 0.012 * bob + this.swayX * aimK - this.crouchT * 0.012 * aimK;
    pos.y += Math.abs(Math.sin(st.bobPhase)) * -0.014 * bob + Math.sin(this.time * 1.6) * 0.003 * aimK + this.swayY * aimK + st.landDip * 0.05;
    pos.z -= this.kickBack * (1 - this.aimT * 0.5);
    if (!st.onGround) pos.y -= 0.012 * aimK;
    let rx = -this.kickRot - this.swayY * 2;
    let ry = this.swayX * 2;
    let rz = Math.cos(st.bobPhase) * 0.02 * bob + this.crouchT * 0.06 * aimK;

    if (this.anim) {
      const a = this.anim;
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      switch (a.kind) {
        case 'draw': {
          const e = 1 - Math.pow(1 - k, 3);
          pos.y -= (1 - e) * 0.3;
          rx += (1 - e) * 0.8;
          rz -= (1 - e) * 0.3;
          if (v.parts.slide) v.parts.slide.position.z = k > 0.6 && k < 0.85 ? -0.03 : 0;
          break;
        }
        case 'reload': {
          const tilt = Math.sin(Math.min(1, k * 1.15) * Math.PI);
          rz += tilt * 0.55;
          rx += tilt * -0.15;
          pos.y -= tilt * 0.05;
          pos.x -= tilt * 0.03;
          if (v.parts.mag && v.magRest) {
            const m = v.parts.mag.position;
            m.copyFrom(v.magRest);
            if (k > 0.1 && k < 0.45) m.y -= Math.min(1, (k - 0.1) / 0.2) * 0.35;
            else if (k >= 0.45 && k < 0.7) m.y -= (1 - (k - 0.45) / 0.25) * 0.2;
          }
          if (k > 0.7 && k < 0.78) pos.y += 0.01;
          if (v.parts.slide) v.parts.slide.position.z = k > 0.8 && k < 0.9 ? -0.03 : 0;
          break;
        }
        case 'inspect': {
          // quadros-chave: [tempo, rx, ry, rz, dx, dy, dz]
          const knife = v.cls === 'knife';
          const frames: number[][] = knife
            ? [[0, 0, 0, 0, 0, 0, 0], [0.18, -0.2, -0.9, 0.3, -0.06, 0.05, -0.02], [0.3, -0.2, -0.9, 0.3, -0.06, 0.05, -0.02],
               [0.55, -0.2, -0.9, 0.3 + Math.PI * 2, -0.06, 0.09, -0.02], [0.75, 0.3, 0.6, -0.4, -0.04, 0.04, -0.03], [0.88, 0.3, 0.6, -0.4, -0.04, 0.04, -0.03], [1, 0, 0, 0, 0, 0, 0]]
            : [[0, 0, 0, 0, 0, 0, 0], [0.16, -0.1, -1.05, 0.35, -0.07, 0.04, -0.05], [0.42, -0.06, -1.15, 0.3, -0.07, 0.045, -0.05],
               [0.6, -0.55, 0.55, -0.3, -0.05, 0.06, -0.03], [0.8, -0.5, 0.65, -0.35, -0.05, 0.06, -0.03], [1, 0, 0, 0, 0, 0, 0]];
          let i = 0;
          while (i < frames.length - 2 && k > frames[i + 1][0]) i++;
          const a = frames[i], b = frames[i + 1];
          let t = (k - a[0]) / Math.max(1e-6, b[0] - a[0]);
          t = Math.max(0, Math.min(1, t));
          t = t * t * (3 - 2 * t); // suavização
          const f = (j: number) => a[j] + (b[j] - a[j]) * t;
          rx += f(1);
          ry += f(2);
          rz += f(3);
          pos.x += f(4);
          pos.y += f(5);
          pos.z += f(6);
          break;
        }
        case 'slash': {
          const e = Math.sin(k * Math.PI);
          ry += e * 1.1;
          rz -= e * 0.8;
          pos.x -= e * 0.12;
          pos.z += e * 0.08;
          break;
        }
        case 'throw': {
          const back = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65;
          pos.y += back * 0.12;
          pos.z -= back * 0.1;
          rx -= back * 0.9;
          if (k > 0.35) pos.y -= (k - 0.35) * 0.4;
          break;
        }
        case 'plant': {
          pos.y -= 0.06;
          pos.z += 0.04;
          rx += 0.6 + Math.sin(this.time * 18) * 0.03;
          break;
        }
      }
      if (k >= 1) {
        this.anim = null;
        if (v.parts.mag && v.magRest) v.parts.mag.position.copyFrom(v.magRest);
      }
    }

    const run = Math.max(0, Math.min(1, (st.speed - 3.5) / 2)) * (1 - this.aimT);
    rz += run * 0.08;
    ry += run * 0.06;
    this.sway.position.copyFrom(pos);
    this.sway.rotation.set(rx, ry, rz);

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.setEnabled(this.flashT > 0 && this.visible);
    }
    if (v.parts.slide && this.kickBack > 0.02 && !this.anim) v.parts.slide.position.z = -this.kickBack * 0.6;
  }

  dispose(): void {
    this.root.dispose(false, true);
    this.flash.dispose(false, true);
  }
}
