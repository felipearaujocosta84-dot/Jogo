// Efeitos de combate: traçantes, sangue, explosões, nuvens de fumaça, granadas em voo e a bomba (com luz piscando).
// Quantidades limitadas pelo nível de qualidade.
import {
  Color3,
  Color4,
  CreateBox,
  CreateSphere,
  Mesh,
  ParticleSystem,
  PointLight,
  StandardMaterial,
  Vector3,
  type Scene
} from '../core/babylon';
import { paintedTexture } from '../maps/textures';
import { buildGun } from '../weapons/WeaponModels';
import type { NadeView, BombView } from '../sim/types';
import type { TransformNode } from '../core/babylon';

interface Tracer {
  mesh: Mesh;
  t: number;
}

export class Effects {
  private tracers: Tracer[] = [];
  private tracerMat: StandardMaterial;
  private blood: ParticleSystem;
  private fire: ParticleSystem;
  private smokes = new Map<number, { ps: ParticleSystem; until: number }>();
  private nadeMeshes = new Map<number, TransformNode>();
  private bombNode: TransformNode;
  private bombLight: Mesh;
  private flashBall: Mesh;
  private flashBallT = 0;
  private dot: ReturnType<typeof paintedTexture>;
  private soft: ReturnType<typeof paintedTexture>;
  private time = 0;
  /** Luz dinâmica única reaproveitada (clarão dos tiros e explosões) — só nas qualidades Alta/Ultra. */
  private light: PointLight | null = null;
  private lightT = 0;
  private lightDur = 1;
  private lightPeak = 0;
  /** Fumaça e poeira que sobem depois de uma explosão. */
  private debris!: ParticleSystem;

  constructor(private scene: Scene, private maxParticles: number) {
    this.dot = paintedTexture(scene, 'fxDot', 32, (g, s) => {
      const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
    });
    this.soft = paintedTexture(scene, 'fxSmoke', 128, (g, s) => {
      for (let i = 0; i < 9; i++) {
        const x = s * (0.3 + Math.random() * 0.4), y = s * (0.3 + Math.random() * 0.4), r = s * (0.2 + Math.random() * 0.25);
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(255,255,255,0.55)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, s, s);
      }
    });
    this.tracerMat = new StandardMaterial('tracerMat', scene);
    this.tracerMat.emissiveColor = new Color3(1, 0.85, 0.5);
    this.tracerMat.disableLighting = true;
    this.tracerMat.alpha = 0.55;

    this.blood = new ParticleSystem('blood', 200, scene);
    this.blood.particleTexture = this.dot;
    this.blood.emitter = Vector3.Zero();
    this.blood.minLifeTime = 0.2;
    this.blood.maxLifeTime = 0.5;
    this.blood.minSize = 0.05;
    this.blood.maxSize = 0.18;
    this.blood.minEmitPower = 0.5;
    this.blood.maxEmitPower = 2.2;
    this.blood.gravity = new Vector3(0, -7, 0);
    this.blood.color1 = new Color4(0.55, 0.02, 0.02, 1);
    this.blood.color2 = new Color4(0.35, 0.0, 0.0, 1);
    this.blood.colorDead = new Color4(0.2, 0, 0, 0);
    this.blood.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.blood.manualEmitCount = 0;
    this.blood.start();

    this.fire = new ParticleSystem('explosion', 300, scene);
    this.fire.particleTexture = this.soft;
    this.fire.emitter = Vector3.Zero();
    this.fire.minLifeTime = 0.3;
    this.fire.maxLifeTime = 1.1;
    this.fire.minSize = 0.6;
    this.fire.maxSize = 2.2;
    this.fire.minEmitPower = 3;
    this.fire.maxEmitPower = 9;
    this.fire.direction1 = new Vector3(-1, 0.3, -1);
    this.fire.direction2 = new Vector3(1, 1.4, 1);
    this.fire.gravity = new Vector3(0, 2, 0);
    this.fire.color1 = new Color4(1, 0.75, 0.3, 1);
    this.fire.color2 = new Color4(1, 0.4, 0.1, 1);
    this.fire.colorDead = new Color4(0.15, 0.13, 0.12, 0);
    this.fire.blendMode = ParticleSystem.BLENDMODE_ADD;
    this.fire.manualEmitCount = 0;
    this.fire.start();

    this.debris = new ParticleSystem('explosionSmoke', 120, scene);
    this.debris.particleTexture = this.soft;
    this.debris.emitter = Vector3.Zero();
    this.debris.minLifeTime = 1.4;
    this.debris.maxLifeTime = 3.2;
    this.debris.minEmitPower = 0.6;
    this.debris.maxEmitPower = 2.4;
    this.debris.direction1 = new Vector3(-1, 0.6, -1);
    this.debris.direction2 = new Vector3(1, 1.6, 1);
    this.debris.gravity = new Vector3(0, 0.6, 0);
    this.debris.minAngularSpeed = -0.6;
    this.debris.maxAngularSpeed = 0.6;
    this.debris.color1 = new Color4(0.32, 0.29, 0.26, 0.75);
    this.debris.color2 = new Color4(0.22, 0.2, 0.18, 0.7);
    this.debris.colorDead = new Color4(0.4, 0.38, 0.35, 0);
    this.debris.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.debris.manualEmitCount = 0;
    this.debris.start();

    const fbm = new StandardMaterial('flashBallMat', scene);
    fbm.emissiveColor = new Color3(1, 1, 0.95);
    fbm.disableLighting = true;
    fbm.alpha = 0.9;
    this.flashBall = CreateSphere('flashBall', { diameter: 1, segments: 8 }, scene);
    this.flashBall.material = fbm;
    this.flashBall.isPickable = false;
    this.flashBall.setEnabled(false);

    // bomba (plantada ou caída)
    const bomb = buildGun('c4', scene);
    this.bombNode = bomb.root;
    this.bombNode.scaling.setAll(1.6);
    const lm = new StandardMaterial('bombLight', scene);
    lm.emissiveColor = new Color3(1, 0.1, 0.05);
    lm.disableLighting = true;
    this.bombLight = CreateBox('bombLed', { size: 0.025 }, scene);
    this.bombLight.material = lm;
    this.bombLight.parent = this.bombNode;
    this.bombLight.position.set(-0.05, 0.065, 0.06);
    this.bombNode.setEnabled(false);
  }

  setMaxParticles(n: number): void {
    this.maxParticles = n;
  }

  tracer(from: Vector3, to: Vector3): void {
    const len = Vector3.Distance(from, to);
    if (len < 1.5) return;
    let tr = this.tracers.find(t => t.t <= 0);
    if (!tr) {
      if (this.tracers.length > 24) return;
      const mesh = CreateBox('tracer', { width: 0.012, height: 0.012, depth: 1 }, this.scene);
      mesh.material = this.tracerMat;
      mesh.isPickable = false;
      tr = { mesh, t: 0 };
      this.tracers.push(tr);
    }
    const shown = Math.min(len, 6);
    const start = from.add(to.subtract(from).normalize().scale(Math.min(1.2, len * 0.2)));
    tr.mesh.position = Vector3.Lerp(start, to, 0.5);
    tr.mesh.scaling.set(1, 1, shown);
    tr.mesh.lookAt(to);
    tr.mesh.setEnabled(true);
    tr.t = 0.06;
    (tr as Tracer & { from?: Vector3; to?: Vector3 }).from = start;
    (tr as Tracer & { from?: Vector3; to?: Vector3 }).to = to;
  }

  /**
   * Liga/desliga a luz dinâmica. A luz é criada uma vez (intensidade 0 quando apagada) e nunca é desativada,
   * para os shaders não precisarem ser recompilados a cada tiro.
   */
  setDynamicLights(on: boolean): void {
    if (on && !this.light) {
      this.light = new PointLight('fxLight', Vector3.Zero(), this.scene);
      this.light.intensity = 0;
      this.light.range = 9;
      this.light.diffuse = new Color3(1, 0.75, 0.4);
      this.light.specular = new Color3(0.6, 0.45, 0.25);
    } else if (!on && this.light) {
      this.light.dispose();
      this.light = null;
    }
  }

  /** Clarão de luz no ponto (tiro: curto e fraco; explosão: forte e mais longo). */
  lightFlash(p: Vector3, intensity: number, dur: number, range = 9, color?: Color3): void {
    const l = this.light;
    if (!l || intensity < this.lightPeak * (this.lightT / this.lightDur)) return;
    l.position.copyFrom(p);
    l.range = range;
    if (color) l.diffuse.copyFrom(color);
    else l.diffuse.set(1, 0.75, 0.4);
    this.lightPeak = intensity;
    this.lightT = this.lightDur = dur;
    l.intensity = intensity;
  }

  bloodAt(p: Vector3, dir: Vector3): void {
    (this.blood.emitter as Vector3).copyFrom(p);
    this.blood.direction1 = dir.add(new Vector3(-0.6, 0.2, -0.6));
    this.blood.direction2 = dir.add(new Vector3(0.6, 1, 0.6));
    this.blood.manualEmitCount = Math.min(14, this.maxParticles);
  }

  explosion(p: Vector3, big = false): void {
    (this.fire.emitter as Vector3).copyFrom(p);
    this.fire.minSize = big ? 1.5 : 0.6;
    this.fire.maxSize = big ? 4.5 : 2.2;
    this.fire.manualEmitCount = Math.min(big ? 120 : 50, this.maxParticles * (big ? 5 : 3));
    this.flashBall.position.copyFrom(p);
    this.flashBall.scaling.setAll(big ? 6 : 2.5);
    (this.flashBall.material as StandardMaterial).emissiveColor = new Color3(1, 0.7, 0.35);
    this.flashBall.setEnabled(true);
    this.flashBallT = 0.12;
    (this.debris.emitter as Vector3).copyFrom(p);
    this.debris.minSize = big ? 2 : 0.9;
    this.debris.maxSize = big ? 5 : 2.6;
    this.debris.manualEmitCount = Math.min(big ? 40 : 18, this.maxParticles * 2);
    this.lightFlash(p.add(new Vector3(0, 0.6, 0)), big ? 9 : 5, big ? 0.6 : 0.35, big ? 30 : 14, new Color3(1, 0.62, 0.3));
  }

  flashbang(p: Vector3): void {
    this.flashBall.position.copyFrom(p);
    this.flashBall.scaling.setAll(1.6);
    (this.flashBall.material as StandardMaterial).emissiveColor = new Color3(1, 1, 1);
    this.flashBall.setEnabled(true);
    this.flashBallT = 0.15;
    this.lightFlash(p, 7, 0.25, 18, new Color3(1, 1, 1));
  }

  /** Atualiza granadas em voo, nuvens de fumaça e a bomba a partir do estado da partida. */
  sync(nades: NadeView[], bomb: BombView, localCarrier: boolean): void {
    const seen = new Set<number>();
    for (const n of nades) {
      seen.add(n.id);
      if (n.smoke > 0) {
        let s = this.smokes.get(n.id);
        if (!s) {
          s = { ps: this.createSmoke(new Vector3(n.x, n.y, n.z)), until: 0 };
          this.smokes.set(n.id, s);
          this.nadeMeshes.get(n.id)?.dispose();
          this.nadeMeshes.delete(n.id);
        }
        // nos últimos segundos a fumaça para de nascer e se dissipa
        if (n.smoke < 3) s.ps.emitRate = 0;
        continue;
      }
      let m = this.nadeMeshes.get(n.id);
      if (!m) {
        m = buildGun(n.type, this.scene).root;
        this.nadeMeshes.set(n.id, m);
      }
      m.position.set(n.x, n.y, n.z);
      m.rotation.x += 0.3;
    }
    for (const [id, m] of this.nadeMeshes) if (!seen.has(id)) {
      m.dispose();
      this.nadeMeshes.delete(id);
    }
    for (const [id, s] of this.smokes) if (!seen.has(id)) {
      s.ps.stop();
      s.ps.disposeOnStop = true;
      this.smokes.delete(id);
    }
    const showBomb = bomb.state === 'planted' || bomb.state === 'dropped' || (bomb.state === 'defused');
    this.bombNode.setEnabled(showBomb && !localCarrier);
    if (showBomb) {
      this.bombNode.position.set(bomb.x, bomb.y + 0.05, bomb.z);
      const rate = bomb.state === 'planted' ? (bomb.timeLeft < 10 ? (bomb.timeLeft < 5 ? 8 : 4) : 1.5) : 0;
      this.bombLight.setEnabled(rate > 0 && Math.sin(this.time * Math.PI * 2 * rate) > 0);
    }
  }

  private createSmoke(p: Vector3): ParticleSystem {
    const n = Math.max(18, Math.min(60, this.maxParticles * 2));
    const ps = new ParticleSystem('smoke', n, this.scene);
    ps.particleTexture = this.soft;
    ps.emitter = p.add(new Vector3(0, 0.3, 0));
    ps.minEmitBox = new Vector3(-1.8, 0, -1.8);
    ps.maxEmitBox = new Vector3(1.8, 1.6, 1.8);
    ps.minLifeTime = 6;
    ps.maxLifeTime = 9;
    const big = n < 30 ? 1.4 : 1;
    ps.minSize = 2.6 * big;
    ps.maxSize = 4.2 * big;
    ps.emitRate = n / 6;
    ps.minEmitPower = 0.05;
    ps.maxEmitPower = 0.35;
    ps.direction1 = new Vector3(-0.5, 0.05, -0.5);
    ps.direction2 = new Vector3(0.5, 0.25, 0.5);
    ps.gravity = Vector3.Zero();
    ps.color1 = new Color4(0.78, 0.78, 0.78, 0.95);
    ps.color2 = new Color4(0.7, 0.7, 0.72, 0.95);
    ps.colorDead = new Color4(0.7, 0.7, 0.7, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.minAngularSpeed = -0.2;
    ps.maxAngularSpeed = 0.2;
    ps.preWarmCycles = 60;
    ps.preWarmStepOffset = 5;
    ps.start();
    return ps;
  }

  update(dt: number): void {
    if (this.light && this.lightT > 0) {
      this.lightT = Math.max(0, this.lightT - dt);
      const k = this.lightT / this.lightDur;
      this.light.intensity = this.lightPeak * k * k;
      if (this.lightT === 0) this.lightPeak = 0;
    }
    this.time += dt;
    for (const t of this.tracers) {
      if (t.t <= 0) continue;
      t.t -= dt;
      if (t.t <= 0) t.mesh.setEnabled(false);
    }
    if (this.flashBallT > 0) {
      this.flashBallT -= dt;
      if (this.flashBallT <= 0) this.flashBall.setEnabled(false);
    }
  }

  clearRound(): void {
    for (const m of this.nadeMeshes.values()) m.dispose();
    this.nadeMeshes.clear();
    for (const s of this.smokes.values()) s.ps.dispose();
    this.smokes.clear();
  }

  dispose(): void {
    this.clearRound();
    for (const t of this.tracers) t.mesh.dispose();
    this.blood.dispose();
    this.fire.dispose();
    this.debris.dispose();
    this.light?.dispose();
    this.flashBall.dispose();
    this.bombNode.dispose();
  }
}
