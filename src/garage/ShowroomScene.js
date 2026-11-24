// =============================================================
// EXTREME RACING — ShowroomScene
// Cenário 3D do menu e da garagem: estúdio escuro com piso
// reflexivo, painéis de luz, iluminação cinematográfica e o carro
// selecionado girando no pedestal. Na garagem a câmera pode ser
// girada com o dedo.
// =============================================================
import {
  ArcRotateCamera, Vector3, Color3, Color4, MeshBuilder, PBRMaterial, StandardMaterial, SpotLight, HemisphericLight,
  DirectionalLight, ShadowGenerator, ReflectionProbe, DefaultRenderingPipeline, ImageProcessingConfiguration,
  TransformNode, GlowLayer, RenderTargetTexture,
} from '@babylonjs/core';
import { createCarMaterials, loadCarModel } from '../vehicles/CarModelFactory.js';

export class ShowroomScene {
  constructor(sceneManager, graphics) {
    this.sm = sceneManager;
    this.graphics = graphics;
  }

  async build() {
    const scene = this.sm.createScene({ physics: false });
    this.scene = scene;
    scene.clearColor = new Color4(0.015, 0.018, 0.024, 1);
    const preset = this.graphics.preset;

    const cam = new ArcRotateCamera('showCam', -Math.PI / 2.6, 1.28, 7.2, new Vector3(-1.2, 0.6, 0), scene);
    cam.lowerRadiusLimit = 4.6;
    cam.upperRadiusLimit = 10;
    cam.lowerBetaLimit = 0.75;
    cam.upperBetaLimit = 1.48;
    cam.minZ = 0.1;
    cam.fov = 0.75;
    cam.panningSensibility = 0;
    cam.wheelPrecision = 60;
    cam.pinchPrecision = 80;
    cam.useAutoRotationBehavior = true;
    cam.autoRotationBehavior.idleRotationSpeed = 0.12;
    cam.autoRotationBehavior.idleRotationWaitTime = 2500;
    this.camera = cam;
    scene.activeCamera = cam;

    // Piso reflexivo
    const floor = MeshBuilder.CreateDisc('floor', { radius: 40, tessellation: 64 }, scene);
    floor.rotation.x = Math.PI / 2;
    const fm = new PBRMaterial('floorMat', scene);
    fm.albedoColor = new Color3(0.02, 0.022, 0.026);
    fm.metallic = 0.6;
    fm.roughness = 0.22;
    floor.material = fm;
    floor.receiveShadows = true;
    // Pedestal giratório
    this.turntable = new TransformNode('turntable', scene);
    const ped = MeshBuilder.CreateCylinder('pedestal', { diameter: 7.4, height: 0.08, tessellation: 72 }, scene);
    ped.position.y = 0.04;
    const pm = new PBRMaterial('pedMat', scene);
    pm.albedoColor = new Color3(0.06, 0.065, 0.075);
    pm.metallic = 0.85;
    pm.roughness = 0.3;
    ped.material = pm;
    ped.parent = this.turntable;
    ped.receiveShadows = true;
    const ring = MeshBuilder.CreateTorus('pedRing', { diameter: 7.45, thickness: 0.05, tessellation: 96 }, scene);
    ring.position.y = 0.08;
    const rm = new StandardMaterial('ringMat', scene);
    rm.emissiveColor = new Color3(0.9, 0.05, 0.12);
    rm.disableLighting = true;
    ring.material = rm;

    // Painéis de luz (refletidos na lataria)
    const panelMat = new StandardMaterial('panelMat', scene);
    panelMat.emissiveColor = new Color3(1, 1, 1);
    panelMat.disableLighting = true;
    const panels = [];
    for (const [x, y, z, ry, w, hgt] of [[0, 6.5, 0, 0, 9, 2.2], [-9, 3.2, -4, 1.1, 5, 4], [9, 3.2, 4, -2.0, 5, 4], [0, 3, 10, Math.PI, 8, 3]]) {
      const p = MeshBuilder.CreatePlane('lightPanel', { width: w, height: hgt }, scene);
      p.position.set(x, y, z);
      if (y > 6) p.rotation.x = Math.PI / 2; else p.rotation.y = ry;
      p.material = panelMat;
      panels.push(p);
    }
    if (preset.reflections) {
      const probe = new ReflectionProbe('studioProbe', 128, scene);
      probe.renderList.push(...panels, floor);
      probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
      scene.environmentTexture = probe.cubeTexture;
      scene.environmentIntensity = 1.1;
      this.probe = probe;
    } else {
      scene.environmentIntensity = 0.5;
    }

    // Luzes
    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.25;
    hemi.groundColor = new Color3(0.05, 0.05, 0.06);
    const key = new SpotLight('key', new Vector3(-6, 9, -6), new Vector3(0.55, -1, 0.55), 0.9, 2, scene);
    key.intensity = 260;
    key.diffuse = new Color3(1, 0.96, 0.92);
    const rim = new SpotLight('rim', new Vector3(7, 5, 7), new Vector3(-0.7, -0.6, -0.7), 0.8, 2, scene);
    rim.intensity = 160;
    rim.diffuse = new Color3(0.9, 0.2, 0.25);
    const top = new DirectionalLight('top', new Vector3(0.1, -1, 0.2), scene);
    top.position = new Vector3(0, 20, 0);
    top.intensity = 1.2;
    if (preset.shadows) {
      this.shadow = new ShadowGenerator(Math.min(2048, preset.shadowMapSize), top);
      this.shadow.useBlurExponentialShadowMap = true;
      this.shadow.blurKernel = 32;
      this.shadow.darkness = 0.3;
    }
    if (preset.bloom) {
      const glow = new GlowLayer('glow', scene, { mainTextureRatio: 0.5 });
      glow.intensity = 0.6;
      glow.addIncludedOnlyMesh(ring);
    }
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.exposure = 1.0;
    scene.imageProcessingConfiguration.contrast = 1.2;
    if (preset.postProcess) {
      const pipe = new DefaultRenderingPipeline('showPipe', false, scene, [cam]);
      pipe.fxaaEnabled = true;
      pipe.imageProcessing.vignetteEnabled = true;
      pipe.imageProcessing.vignetteWeight = 2.2;
      pipe.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
    }
    scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      this.turntable.rotation.y += dt * 0.18;
    });
    return scene;
  }

  /** Troca o carro exibido. */
  async setCar(spec, look) {
    if (this.car) { if (this.car.dispose) this.car.dispose(); else this.car.root.dispose(false, true); this.car = null; }
    const mats = createCarMaterials(this.scene, look.colors, look.finish);
    const token = (this._carToken = (this._carToken ?? 0) + 1);
    const model = await loadCarModel(this.scene, { ...spec, rimStyle: look.rimStyle }, mats);
    if (token !== this._carToken) { // outro carro foi pedido enquanto este carregava
      if (model.dispose) model.dispose(); else model.root.dispose(false, true);
      return this.car;
    }
    if (this.car) { if (this.car.dispose) this.car.dispose(); else this.car.root.dispose(false, true); this.car = null; }
    model.root.parent = this.turntable;
    model.root.position.y = 0.08;
    // Faróis acesos no showroom
    const mm = model.materials;
    mm.headlight.emissiveColor = new Color3(1, 1, 1.05);
    mm.taillight.emissiveColor = new Color3(0.6, 0.02, 0.02);
    if (this.shadow) for (const m of model.root.getChildMeshes()) if (m.getTotalVertices() > 0) this.shadow.addShadowCaster(m, false);
    this.car = model;
    return model;
  }

  /** Enquadramento: 'menu' (carro à direita) ou 'garage' (centro, câmera livre). */
  setFraming(mode) {
    const cam = this.camera;
    if (mode === 'garage') {
      cam.setTarget(new Vector3(0, 0.6, 0));
      cam.radius = 7.4;
      cam.attachControl(this.sm.canvas, true);
    } else {
      cam.setTarget(new Vector3(-1.4, 0.6, 0.6));
      cam.radius = 7.0;
      cam.detachControl();
    }
  }
}
