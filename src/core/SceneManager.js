// =============================================================
// EXTREME RACING — SceneManager
// Cria o Engine do Babylon (com passo fixo determinístico para a
// física), inicializa o Havok, troca de cenas e roda o loop.
// =============================================================
import { Engine, Scene, Vector3, HavokPlugin, Color4 } from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';

export const PHYSICS_HZ = 60;

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, false, {
      preserveDrawingBuffer: false,
      stencil: true,
      powerPreference: 'high-performance',
      // Passo fixo: a física roda sempre a 60 Hz, independente do FPS
      deterministicLockstep: true,
      lockstepMaxSteps: 4,
      timeStep: 1 / PHYSICS_HZ,
      doNotHandleContextLost: false,
      adaptToDeviceRatio: false,
    });
    this.engine.enableOfflineSupport = false;
    this.havok = null;
    this.scene = null;
    this.onFrame = null; // callback(dtSeconds) por quadro renderizado
    this.paused = false; // pausa: não renderiza (a física também para)
    window.addEventListener('resize', () => this.engine.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.engine.resize(), 250));
  }

  /** Carrega o WebAssembly do Havok (uma vez). */
  async initPhysics() {
    if (this.havok) return this.havok;
    this.havok = await HavokPhysics();
    return this.havok;
  }

  /** Cria uma cena nova (descartando a anterior). */
  createScene({ physics = false, gravity = -9.81 } = {}) {
    if (this.scene) {
      this.scene.dispose();
      this.scene = null;
    }
    const scene = new Scene(this.engine);
    scene.clearColor = new Color4(0.02, 0.03, 0.05, 1);
    scene.skipPointerMovePicking = true;
    scene.autoClear = true;
    scene.autoClearDepthAndStencil = true;
    if (physics) {
      const plugin = new HavokPlugin(true, this.havok);
      scene.enablePhysics(new Vector3(0, gravity, 0), plugin);
    }
    this.scene = scene;
    return scene;
  }

  /** Duração do passo físico em segundos. */
  get fixedDt() {
    return this.engine.isDeterministicLockStep() ? this.engine.getTimeStep() / 1000 : 1 / PHYSICS_HZ;
  }

  start() {
    this.engine.runRenderLoop(() => {
      if (!this.scene) return;
      const dt = Math.min(0.1, this.engine.getDeltaTime() / 1000);
      if (this.onFrame) this.onFrame(dt);
      if (this.paused) return;
      if (this.scene && this.scene.activeCamera) this.scene.render();
    });
  }
}
