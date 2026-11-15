// Modelo em primeira pessoa: braços com luvas e mangas táticas segurando a arma.
// Desenhado num grupo de renderização separado (nunca atravessa paredes) e animado de forma procedural:
// balanço ao andar, inércia ao girar a câmera, recuo, recarga (pente sai e entra), troca de arma,
// inspeção, mira (arma vai ao centro) e postura agachada.
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
  type AbstractMesh,
  type Scene,
  type Camera
} from '../core/babylon';
import { paintedTexture } from '../maps/textures';
import type { WeaponModel } from './WeaponTypes';

export const VIEW_GROUP = 1;

type Anim = { kind: 'none' } | { kind: 'reload' | 'draw' | 'holster' | 'inspect'; t: number; dur: number };

interface WeaponVisual {
  root: TransformNode;
  mag: TransformNode;
  magRest: Vector3;
  muzzle: TransformNode;
  hip: Vector3;
  ads: Vector3;
  slide?: TransformNode;
}

export class ViewModel {
  private root: TransformNode;
  private sway: TransformNode;
  private weapons: Record<WeaponModel, WeaponVisual>;
  private current: WeaponModel = 'rifle';
  private mats: Record<string, StandardMaterial> = {};
  private flash: Mesh;
  private flashTime = 0;

  private anim: Anim = { kind: 'none' };
  private onHolstered: (() => void) | null = null;
  private aimT = 0;
  private swayX = 0;
  private swayY = 0;
  private kickBack = 0;
  private kickRot = 0;
  private crouchT = 0;
  private time = 0;

  constructor(private scene: Scene, camera: Camera) {
    scene.setRenderingAutoClearDepthStencil(VIEW_GROUP, true, true, false);
    this.root = new TransformNode('viewmodel', scene);
    this.root.parent = camera;
    this.sway = new TransformNode('vmSway', scene);
    this.sway.parent = this.root;

    this.mat('metal', '#24272b', 0.35);
    this.mat('metalLight', '#3b4046', 0.4);
    this.mat('polymer', '#2d2a26', 0.12);
    this.mat('wood', '#7a4a26', 0.1);
    this.mat('glove', '#1e1f1c', 0.08);
    this.mat('sleeve', '#5b5a3c', 0.04);
    this.mat('cuff', '#3e3d2a', 0.04);
    this.mat('skin', '#b98a68', 0.06);

    this.weapons = { rifle: this.buildRifle(), pistol: this.buildPistol() };
    this.weapons.pistol.root.setEnabled(false);

    // Clarão do disparo (plano aditivo com textura de estrela)
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
    fm.alphaMode = 1; // aditivo
    fm.backFaceCulling = false;
    this.flash = CreatePlane('muzzleFlash', { size: 0.22 }, scene);
    this.flash.material = fm;
    this.flash.renderingGroupId = VIEW_GROUP;
    this.flash.isPickable = false;
    this.flash.setEnabled(false);
    this.attachFlash();
  }

  get muzzleWorld(): Vector3 {
    return this.weapons[this.current].muzzle.getAbsolutePosition();
  }

  get model(): WeaponModel {
    return this.current;
  }

  get busy(): boolean {
    return this.anim.kind !== 'none' && this.anim.kind !== 'inspect';
  }

  // ------------------------------------------------------------ construção

  private mat(name: string, color: string, spec: number): StandardMaterial {
    const m = new StandardMaterial('vm_' + name, this.scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.specularColor = new Color3(spec, spec, spec);
    m.specularPower = 48;
    m.fogEnabled = false;
    this.mats[name] = m;
    return m;
  }

  private part(parent: TransformNode, name: string, mesh: Mesh, mat: string, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]): Mesh {
    mesh.name = name;
    mesh.parent = parent;
    mesh.material = this.mats[mat];
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.renderingGroupId = VIEW_GROUP;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    return mesh;
  }

  private box(parent: TransformNode, name: string, w: number, h: number, d: number, mat: string, pos: [number, number, number], rot?: [number, number, number]): Mesh {
    return this.part(parent, name, CreateBox(name, { width: w, height: h, depth: d }, this.scene), mat, pos, rot);
  }

  private cyl(parent: TransformNode, name: string, dia: number, len: number, mat: string, pos: [number, number, number], rot?: [number, number, number], top?: number): Mesh {
    return this.part(parent, name, CreateCylinder(name, { diameterTop: top ?? dia, diameterBottom: dia, height: len, tessellation: 10 }, this.scene), mat, pos, rot);
  }

  /** Antebraço + manga + luva, do ponto da mão até fora da tela. */
  private arm(parent: TransformNode, name: string, hand: [number, number, number], toward: [number, number, number], fingersFwd: boolean): void {
    const node = new TransformNode(name, this.scene);
    node.parent = parent;
    node.position.set(...hand);
    const dir = new Vector3(...toward).normalize();
    // alinha o eixo Y do braço com a direção do cotovelo
    const up = Vector3.Up();
    const axis = Vector3.Cross(up, dir);
    const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(up, dir))));
    node.rotationQuaternion = axis.lengthSquared() < 1e-6 ? Quaternion.Identity() : Quaternion.RotationAxis(axis.normalize(), angle);
    this.box(node, name + 'Glove', 0.075, 0.1, 0.085, 'glove', [0, 0.02, 0]);
    this.box(node, name + 'Fingers', 0.07, 0.05, 0.06, 'glove', [0, -0.03, fingersFwd ? 0.035 : -0.035]);
    this.cyl(node, name + 'Wrist', 0.07, 0.06, 'skin', [0, 0.09, 0]);
    this.cyl(node, name + 'Cuff', 0.09, 0.05, 'cuff', [0, 0.13, 0]);
    this.cyl(node, name + 'Sleeve', 0.1, 0.5, 'sleeve', [0, 0.38, 0], undefined, 0.12);
  }

  private buildRifle(): WeaponVisual {
    const root = new TransformNode('vmRifle', this.scene);
    root.parent = this.sway;
    const g = new TransformNode('vmRifleGun', this.scene);
    g.parent = root;
    this.box(g, 'rReceiver', 0.062, 0.085, 0.36, 'metal', [0, 0, 0]);
    this.box(g, 'rCover', 0.056, 0.03, 0.3, 'metalLight', [0, 0.055, -0.01]);
    this.box(g, 'rHandguard', 0.07, 0.07, 0.22, 'wood', [0, -0.005, 0.28]);
    this.cyl(g, 'rGasTube', 0.022, 0.2, 'metal', [0, 0.045, 0.3], [Math.PI / 2, 0, 0]);
    this.cyl(g, 'rBarrel', 0.022, 0.3, 'metal', [0, 0.005, 0.5], [Math.PI / 2, 0, 0]);
    this.cyl(g, 'rMuzzle', 0.034, 0.06, 'metalLight', [0, 0.005, 0.66], [Math.PI / 2, 0, 0]);
    this.box(g, 'rFrontSight', 0.012, 0.05, 0.015, 'metal', [0, 0.05, 0.6]);
    this.box(g, 'rRearSight', 0.04, 0.025, 0.03, 'metal', [0, 0.085, 0.1]);
    this.box(g, 'rGrip', 0.036, 0.11, 0.05, 'polymer', [0, -0.085, -0.09], [-0.35, 0, 0]);
    this.box(g, 'rTrigger', 0.008, 0.03, 0.04, 'metal', [0, -0.055, -0.035]);
    this.box(g, 'rStock', 0.05, 0.075, 0.28, 'wood', [0, -0.025, -0.31], [0.08, 0, 0]);
    this.box(g, 'rButt', 0.054, 0.12, 0.03, 'polymer', [0, -0.045, -0.45], [0.08, 0, 0]);
    const mag = new TransformNode('rMagNode', this.scene);
    mag.parent = g;
    mag.position.set(0, -0.06, 0.07);
    this.box(mag, 'rMag', 0.04, 0.16, 0.075, 'metalLight', [0, -0.07, 0.01], [0.3, 0, 0]);
    const muzzle = new TransformNode('rMuzzlePt', this.scene);
    muzzle.parent = g;
    muzzle.position.set(0, 0.005, 0.72);
    // mãos: direita na empunhadura, esquerda no guarda-mão
    this.arm(g, 'rArmR', [0.01, -0.1, -0.08], [0.45, -0.55, -0.7], true);
    this.arm(g, 'rArmL', [-0.02, -0.055, 0.28], [-0.55, -0.6, -0.55], true);
    return { root, mag, magRest: mag.position.clone(), muzzle, hip: new Vector3(0.15, -0.165, 0.5), ads: new Vector3(0, -0.142, 0.34) };
  }

  private buildPistol(): WeaponVisual {
    const root = new TransformNode('vmPistol', this.scene);
    root.parent = this.sway;
    const g = new TransformNode('vmPistolGun', this.scene);
    g.parent = root;
    const slide = new TransformNode('pSlideNode', this.scene);
    slide.parent = g;
    this.box(slide, 'pSlide', 0.034, 0.038, 0.2, 'metal', [0, 0.022, 0.04]);
    this.box(slide, 'pSightF', 0.008, 0.012, 0.01, 'metalLight', [0, 0.045, 0.13]);
    this.box(slide, 'pSightR', 0.026, 0.012, 0.012, 'metalLight', [0, 0.045, -0.05]);
    this.box(g, 'pFrame', 0.03, 0.03, 0.17, 'polymer', [0, -0.008, 0.03]);
    this.box(g, 'pGuard', 0.012, 0.035, 0.05, 'polymer', [0, -0.035, 0.04]);
    this.box(g, 'pGrip', 0.032, 0.11, 0.052, 'polymer', [0, -0.068, -0.035], [-0.22, 0, 0]);
    const mag = new TransformNode('pMagNode', this.scene);
    mag.parent = g;
    mag.position.set(0, -0.06, -0.04);
    this.box(mag, 'pMagBase', 0.034, 0.015, 0.05, 'metalLight', [0, -0.065, 0.012], [-0.22, 0, 0]);
    const muzzle = new TransformNode('pMuzzlePt', this.scene);
    muzzle.parent = g;
    muzzle.position.set(0, 0.02, 0.16);
    this.arm(g, 'pArmR', [0.005, -0.075, -0.04], [0.4, -0.55, -0.75], true);
    this.arm(g, 'pArmL', [-0.03, -0.085, -0.02], [-0.6, -0.55, -0.6], true);
    return { root, mag, magRest: mag.position.clone(), muzzle, hip: new Vector3(0.13, -0.14, 0.4), ads: new Vector3(0, -0.098, 0.3), slide };
  }

  private attachFlash(): void {
    this.flash.parent = this.weapons[this.current].muzzle;
    this.flash.position.set(0, 0, 0.05);
  }

  // ------------------------------------------------------------ ações

  fire(): void {
    const pistol = this.current === 'pistol';
    this.kickBack = Math.min(0.06, this.kickBack + (pistol ? 0.035 : 0.022));
    this.kickRot = Math.min(0.25, this.kickRot + (pistol ? 0.16 : 0.05));
    this.flashTime = 0.05;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scaling.setAll(0.8 + Math.random() * 0.5);
    if (this.anim.kind === 'inspect') this.anim = { kind: 'none' };
  }

  reload(duration: number): void {
    this.anim = { kind: 'reload', t: 0, dur: duration };
  }

  inspect(): void {
    if (this.anim.kind === 'none') this.anim = { kind: 'inspect', t: 0, dur: 2.6 };
  }

  cancelInspect(): void {
    if (this.anim.kind === 'inspect') this.anim = { kind: 'none' };
  }

  /** Abaixa a arma atual, troca o modelo e levanta a nova. */
  switchTo(model: WeaponModel, drawTime: number): void {
    if (model === this.current && this.anim.kind !== 'holster') {
      this.anim = { kind: 'draw', t: 0, dur: drawTime };
      return;
    }
    this.anim = { kind: 'holster', t: 0, dur: 0.18 };
    this.onHolstered = () => {
      this.weapons[this.current].root.setEnabled(false);
      this.current = model;
      this.weapons[model].root.setEnabled(true);
      this.weapons[model].mag.position.copyFrom(this.weapons[model].magRest);
      this.attachFlash();
      this.anim = { kind: 'draw', t: 0, dur: drawTime };
    };
  }

  /** Inércia da arma ao girar a câmera. */
  addLook(dYaw: number, dPitch: number): void {
    this.swayX = Math.max(-0.05, Math.min(0.05, this.swayX - dYaw * 0.08));
    this.swayY = Math.max(-0.05, Math.min(0.05, this.swayY + dPitch * 0.08));
  }

  setVisible(v: boolean): void {
    this.root.setEnabled(v);
  }

  update(dt: number, state: { aiming: boolean; crouched: boolean; speed: number; onGround: boolean; bobPhase: number; bobAmount: number; landDip: number }): void {
    this.time += dt;
    const w = this.weapons[this.current];
    this.aimT += ((state.aiming && !this.busy ? 1 : 0) - this.aimT) * Math.min(1, dt * 16);
    this.crouchT += ((state.crouched ? 1 : 0) - this.crouchT) * Math.min(1, dt * 10);
    const decay = Math.exp(-dt * 7);
    this.swayX *= decay;
    this.swayY *= decay;
    this.kickBack *= Math.exp(-dt * 18);
    this.kickRot *= Math.exp(-dt * 14);

    const aimK = 1 - this.aimT * 0.85;
    const bob = state.bobAmount * aimK;
    const breathe = Math.sin(this.time * 1.6) * 0.003 * aimK;
    const pos = Vector3.Lerp(w.hip, w.ads, this.aimT);
    pos.x += Math.cos(state.bobPhase) * 0.012 * bob + this.swayX * aimK - this.crouchT * 0.012 * aimK;
    pos.y += Math.abs(Math.sin(state.bobPhase)) * -0.014 * bob + breathe + this.swayY * aimK + state.landDip * 0.05 - this.crouchT * 0.01 * aimK;
    pos.z -= this.kickBack * (1 - this.aimT * 0.5);
    if (!state.onGround) pos.y -= 0.012 * aimK;
    let rx = -this.kickRot - this.swayY * 2;
    let ry = this.swayX * 2;
    let rz = Math.cos(state.bobPhase) * 0.02 * bob + this.crouchT * 0.06 * aimK;

    // Animações com linha do tempo
    if (this.anim.kind !== 'none') {
      const a = this.anim;
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      if (a.kind === 'holster') {
        pos.y -= k * 0.3;
        rx += k * 0.8;
      } else if (a.kind === 'draw') {
        const e = 1 - Math.pow(1 - k, 3);
        pos.y -= (1 - e) * 0.3;
        rx += (1 - e) * 0.8;
        rz -= (1 - e) * 0.3;
        if (w.slide) w.slide.position.z = k > 0.6 && k < 0.85 ? -0.03 : 0;
      } else if (a.kind === 'reload') {
        const tilt = Math.sin(Math.min(1, k * 1.15) * Math.PI);
        rz += tilt * 0.55;
        rx += tilt * -0.15;
        pos.y -= tilt * 0.05;
        pos.x -= tilt * 0.03;
        // pente: sai (0.1–0.3), some, entra de baixo (0.45–0.7), batida final
        const m = w.mag.position;
        m.copyFrom(w.magRest);
        if (k > 0.1 && k < 0.45) m.y -= Math.min(1, (k - 0.1) / 0.2) * 0.35;
        else if (k >= 0.45 && k < 0.7) m.y -= (1 - (k - 0.45) / 0.25) * 0.2;
        if (k > 0.7 && k < 0.78) pos.y += 0.01;
        if (w.slide) w.slide.position.z = k > 0.8 && k < 0.9 ? -0.03 : 0;
      } else if (a.kind === 'inspect') {
        const e = Math.sin(k * Math.PI);
        const turn = Math.sin(Math.min(1, k * 1.4) * Math.PI);
        ry -= e * 0.9;
        rz += turn * 0.7;
        rx -= e * 0.15;
        pos.x -= e * 0.08;
        pos.z -= e * 0.05;
      }
      if (k >= 1) {
        const done = a.kind;
        this.anim = { kind: 'none' };
        w.mag.position.copyFrom(w.magRest);
        if (done === 'holster' && this.onHolstered) {
          const cb = this.onHolstered;
          this.onHolstered = null;
          cb();
        }
      }
    }

    // Correndo: arma inclinada para o lado
    const run = Math.max(0, Math.min(1, (state.speed - 3.5) / 2)) * (1 - this.aimT);
    rz += run * 0.08;
    ry += run * 0.06;

    this.sway.position.copyFrom(pos);
    this.sway.rotation.set(rx, ry, rz);

    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.flash.setEnabled(this.flashTime > 0);
    }
    if (w.slide && this.kickBack > 0.02 && this.anim.kind === 'none') w.slide.position.z = -this.kickBack * 0.6;
  }

  dispose(): void {
    this.root.dispose(false, true);
    this.flash.dispose(false, true);
  }

  meshes(): AbstractMesh[] {
    return this.root.getChildMeshes(false);
  }
}
