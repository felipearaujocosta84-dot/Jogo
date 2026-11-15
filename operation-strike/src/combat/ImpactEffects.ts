// Efeitos de impacto de tiro: marcas de bala (instâncias, uma chamada de desenho),
// poeira/lascas conforme a superfície e faíscas em metal. Quantidades limitadas pela qualidade.
import {
  Color4,
  CreatePlane,
  ParticleSystem,
  StandardMaterial,
  Vector3,
  Color3,
  type InstancedMesh,
  type Mesh,
  type Scene
} from '../core/babylon';
import { paintedTexture } from '../maps/textures';
import type { SurfaceKind, Vec3 } from '../physics/CollisionWorld';

const DUST_COLORS: Record<SurfaceKind, [Color4, Color4]> = {
  sand: [new Color4(0.78, 0.66, 0.46, 0.9), new Color4(0.7, 0.58, 0.4, 0)],
  stone: [new Color4(0.8, 0.72, 0.58, 0.9), new Color4(0.7, 0.62, 0.5, 0)],
  concrete: [new Color4(0.6, 0.6, 0.58, 0.9), new Color4(0.5, 0.5, 0.5, 0)],
  wood: [new Color4(0.55, 0.38, 0.2, 1), new Color4(0.45, 0.3, 0.15, 0)],
  metal: [new Color4(1, 0.85, 0.4, 1), new Color4(1, 0.5, 0.1, 0)]
};

export class ImpactEffects {
  private decalSource: Mesh;
  private decals: InstancedMesh[] = [];
  private next = 0;
  private dust: ParticleSystem;

  constructor(scene: Scene, private maxDecals: number, maxParticles: number) {
    const holeTex = paintedTexture(scene, 'bulletHole', 64, (g, s) => {
      const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grd.addColorStop(0, 'rgba(10,8,6,1)');
      grd.addColorStop(0.28, 'rgba(25,20,15,0.95)');
      grd.addColorStop(0.5, 'rgba(60,50,40,0.45)');
      grd.addColorStop(1, 'rgba(60,50,40,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
    });
    const mat = new StandardMaterial('decalMat', scene);
    mat.diffuseTexture = holeTex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.specularColor = Color3.Black();
    mat.zOffset = -3;
    mat.backFaceCulling = false;
    this.decalSource = CreatePlane('decalSrc', { size: 0.075 }, scene);
    this.decalSource.material = mat;
    this.decalSource.isPickable = false;
    this.decalSource.isVisible = false;

    const dotTex = paintedTexture(scene, 'dotTex', 32, (g, s) => {
      const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
    });
    this.dust = new ParticleSystem('impactDust', maxParticles * 4, scene);
    this.dust.particleTexture = dotTex;
    this.dust.emitter = Vector3.Zero();
    this.dust.manualEmitCount = 0;
    this.dust.minLifeTime = 0.25;
    this.dust.maxLifeTime = 0.6;
    this.dust.minSize = 0.04;
    this.dust.maxSize = 0.16;
    this.dust.minEmitPower = 0.8;
    this.dust.maxEmitPower = 3;
    this.dust.gravity = new Vector3(0, -6, 0);
    this.dust.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.dust.updateSpeed = 1 / 60;
    this.dust.start();
    this.maxParticles = maxParticles;
  }

  private maxParticles: number;

  setLimits(maxDecals: number, maxParticles: number): void {
    this.maxDecals = maxDecals;
    this.maxParticles = maxParticles;
    while (this.decals.length > maxDecals) this.decals.pop()?.dispose();
    this.next = 0;
  }

  spawn(point: Vec3, normal: Vec3, surface: SurfaceKind): void {
    // Marca de bala
    let d: InstancedMesh;
    if (this.decals.length < this.maxDecals) {
      d = this.decalSource.createInstance('decal' + this.decals.length);
      d.isPickable = false;
      this.decals.push(d);
    } else {
      d = this.decals[this.next];
      this.next = (this.next + 1) % this.decals.length;
    }
    d.position.set(point.x + normal.x * 0.005, point.y + normal.y * 0.005, point.z + normal.z * 0.005);
    d.lookAt(new Vector3(point.x - normal.x, point.y - normal.y, point.z - normal.z));
    d.rotate(new Vector3(0, 0, 1), Math.random() * Math.PI * 2);
    const sc = 0.8 + Math.random() * 0.4;
    d.scaling.set(sc, sc, sc);

    // Partículas na direção da normal
    const [c1, c2] = DUST_COLORS[surface];
    const ps = this.dust;
    (ps.emitter as Vector3).set(point.x + normal.x * 0.02, point.y + normal.y * 0.02, point.z + normal.z * 0.02);
    ps.color1 = c1;
    ps.color2 = c1;
    ps.colorDead = c2;
    const n = new Vector3(normal.x, normal.y, normal.z);
    ps.direction1 = n.add(new Vector3(-0.6, 0.3, -0.6));
    ps.direction2 = n.add(new Vector3(0.6, 1, 0.6));
    ps.blendMode = surface === 'metal' ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
    ps.manualEmitCount = Math.min(this.maxParticles, surface === 'metal' ? 10 : 8);
  }

  dispose(): void {
    for (const d of this.decals) d.dispose();
    this.decals = [];
    this.decalSource.dispose(false, true);
    this.dust.dispose();
  }
}
