// =============================================================
// EXTREME RACING — GhostCar
// Carro fantasma translúcido (sem física e sem colisão) que
// reproduz a melhor volta salva no Contra o Relógio/Treino.
// =============================================================
import { TransformNode, Quaternion } from '@babylonjs/core';
import { createCarMaterials, loadCarModel } from './CarModelFactory.js';

export class GhostCar {
  constructor(scene, spec) {
    this.scene = scene;
    this.spec = spec;
    this.lap = null;
    this.visible = false;
  }

  async init() {
    this.root = new TransformNode('ghost', this.scene);
    this.root.rotationQuaternion = new Quaternion();
    const mats = createCarMaterials(this.scene, { paint: '#6ad1ff', rim: '#bfefff' }, 'metallic');
    const model = await loadCarModel(this.scene, { ...this.spec, model: null }, mats);
    model.root.parent = this.root;
    model.root.position.y = -this.spec.wheelRadius;
    for (const m of model.root.getChildMeshes()) {
      m.visibility = 0.32;
      m.isPickable = false;
      m.receiveShadows = false;
    }
    this.model = model;
    this.root.setEnabled(false);
  }

  setLap(lap) { this.lap = lap; }

  /** Posiciona o fantasma no tempo t da volta atual. */
  update(t) {
    const s = this.lap ? this.lap.sample(t) : null;
    if (!s) {
      if (this.visible) { this.root.setEnabled(false); this.visible = false; }
      return;
    }
    if (!this.visible) { this.root.setEnabled(true); this.visible = true; }
    this.root.position.set(s.x, s.y, s.z);
    this.root.rotationQuaternion.set(s.qx, s.qy, s.qz, s.qw);
  }

  dispose() {
    this.root?.dispose(false, true);
  }
}
