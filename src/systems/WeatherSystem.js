// =============================================================
// EXTREME RACING — WeatherSystem
// Céu atmosférico, sol/lua com sombras dinâmicas, neblina,
// ciclo dia/noite, chuva (partículas + pista molhada + poças),
// reflexos do ambiente nos carros (reflection probe).
// =============================================================
import {
  MeshBuilder, Vector3, Color3, Color4, HemisphericLight, DirectionalLight, ShadowGenerator,
  ParticleSystem, ReflectionProbe, Scene, DynamicTexture, RenderTargetTexture,
} from '@babylonjs/core';
import { SkyMaterial } from '@babylonjs/materials';
import { clamp, lerp, smoothStep } from '../utils/MathUtils.js';

export class WeatherSystem {
  /**
   * @param {Scene} scene
   * @param {object} preset preset gráfico
   * @param {object} opts { timeOfDay (h), cycle:boolean, rain:boolean, cycleSpeed }
   */
  constructor(scene, preset, opts = {}) {
    this.scene = scene;
    this.preset = preset;
    this.time = opts.timeOfDay ?? 14;
    this.cycle = !!opts.cycle;
    this.cycleSpeed = opts.cycleSpeed ?? 0.02; // horas de jogo por segundo
    this.rain = 0;
    this.sand = opts.sandstorm ? 1 : 0; // tempestade de areia (deserto)
    this.occlusion = 0; // 0 = céu aberto, 1 = dentro de túnel
    this.occlusionTarget = 0;
    this.targetRain = opts.rain ? 1 : 0;
    this.wetness = opts.rain ? 1 : 0;
    this.listeners = [];

    // Céu
    // Tamanho proporcional à distância de visão (os cantos ficam dentro do maxZ da câmera)
    this.sky = MeshBuilder.CreateBox('skyBox', { size: preset.viewDistance * 1.1 }, scene);
    this.skyMat = new SkyMaterial('skyMat', scene);
    this.skyMat.backFaceCulling = false;
    this.skyMat.useSunPosition = true;
    this.skyMat.turbidity = 6;
    this.skyMat.rayleigh = 1.6;
    this.skyMat.mieCoefficient = 0.006;
    this.skyMat.mieDirectionalG = 0.85;
    this.skyMat.luminance = 1;
    this.sky.material = this.skyMat;
    this.sky.infiniteDistance = true;
    this.sky.isPickable = false;

    // Luzes
    this.hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
    this.hemi.groundColor = new Color3(0.18, 0.17, 0.15);
    this.sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.3), scene);
    this.sun.position = new Vector3(0, 200, 0);

    // Sombras (área móvel em volta do carro do jogador)
    this.shadowGen = null;
    if (preset.shadows) {
      this.sun.autoUpdateExtends = false;
      this.sun.shadowFrustumSize = 90;
      this.sun.shadowMinZ = 1;
      this.sun.shadowMaxZ = 400;
      this.shadowGen = new ShadowGenerator(preset.shadowMapSize, this.sun);
      this.shadowGen.bias = 0.0015;
      this.shadowGen.normalBias = 0.02;
      if (preset.pcf) {
        this.shadowGen.usePercentageCloserFiltering = true;
        this.shadowGen.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      } else {
        this.shadowGen.usePoissonSampling = true;
      }
      this.shadowGen.darkness = 0.35;
    }

    // Neblina (também limita a distância de renderização)
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = preset.fogDensity;

    // Reflexos: probe que captura só o céu (barato)
    this.probe = null;
    if (preset.reflections) {
      this.probe = new ReflectionProbe('envProbe', preset.textureSize >= 1024 ? 128 : 64, scene, true, true);
      this.probe.renderList.push(this.sky);
      this.probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
      scene.environmentTexture = this.probe.cubeTexture;
      this._probeTimer = 0;
    }

    // Chuva
    this.rainSystem = null;
    this._buildRain();
    this.sandSystem = null;
    if (this.sand > 0) this._buildSand();
    this.apply(0, true);
  }

  _buildRain() {
    const scene = this.scene;
    const cap = this.preset.rainDrops;
    if (!cap) return;
    const tex = new DynamicTexture('rainTex', { width: 8, height: 64 }, scene, false);
    const ctx = tex.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(200,210,230,0)');
    g.addColorStop(1, 'rgba(220,230,255,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(3, 0, 2, 64);
    tex.hasAlpha = true;
    tex.update(false);
    const ps = new ParticleSystem('rain', cap, scene);
    ps.particleTexture = tex;
    ps.minEmitBox = new Vector3(-40, 25, -40);
    ps.maxEmitBox = new Vector3(40, 30, 40);
    ps.direction1 = new Vector3(-1, -30, 1);
    ps.direction2 = new Vector3(1, -34, -1);
    ps.minEmitPower = 1; ps.maxEmitPower = 1;
    ps.minLifeTime = 0.9; ps.maxLifeTime = 1.1;
    ps.minSize = 0.05; ps.maxSize = 0.08;
    ps.minScaleY = 0.8; ps.maxScaleY = 1.4;
    ps.color1 = new Color4(0.75, 0.8, 0.9, 0.55);
    ps.color2 = new Color4(0.7, 0.75, 0.85, 0.4);
    ps.colorDead = new Color4(0.7, 0.75, 0.85, 0);
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.emitRate = 0;
    ps.emitter = new Vector3(0, 0, 0);
    ps.start();
    this.rainSystem = ps;
  }

  /** Aceita malhas ou TransformNodes (adiciona as malhas filhas). */
  /** Poeira da tempestade de areia: nuvens marrons varridas pelo vento em volta da câmera. */
  _buildSand() {
    const scene = this.scene;
    const cap = Math.round(this.preset.rainDrops * 0.5);
    if (!cap) return;
    const tex = new DynamicTexture('sandTex', { width: 64, height: 64 }, scene, false);
    const ctx = tex.getContext();
    const gr = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.8)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
    tex.hasAlpha = true;
    tex.update();
    const ps = new ParticleSystem('sandstorm', cap, scene);
    ps.particleTexture = tex;
    ps.minEmitBox = new Vector3(-60, -2, -60);
    ps.maxEmitBox = new Vector3(60, 14, 60);
    ps.direction1 = new Vector3(14, -0.5, 4);
    ps.direction2 = new Vector3(22, 1, 9);
    ps.minEmitPower = 1; ps.maxEmitPower = 1.6;
    ps.minLifeTime = 2; ps.maxLifeTime = 3.5;
    ps.minSize = 3; ps.maxSize = 9;
    ps.color1 = new Color4(0.72, 0.55, 0.36, 0.22);
    ps.color2 = new Color4(0.6, 0.45, 0.3, 0.16);
    ps.colorDead = new Color4(0.6, 0.45, 0.3, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.emitRate = cap / 2.5;
    ps.emitter = new Vector3(0, 0, 0);
    ps.start();
    this.sandSystem = ps;
  }

  addShadowCaster(node) {
    if (!this.shadowGen || !node) return;
    const meshes = typeof node.getTotalVertices === 'function' ? [node, ...node.getChildMeshes()] : node.getChildMeshes();
    for (const m of meshes) if (m.getTotalVertices() > 0) this.shadowGen.addShadowCaster(m, false);
  }

  setRain(on) { this.targetRain = on ? 1 : 0; }
  get isNight() { return this.daylight < 0.25; }

  /** Direção do sol a partir da hora do dia. */
  sunDirection(hour) {
    const t = ((hour - 6) / 12) * Math.PI; // 6h nasce, 18h se põe
    const elev = Math.sin(t);
    const az = t * 0.9 + 0.6;
    return new Vector3(Math.cos(az) * Math.cos(Math.asin(clamp(elev, -1, 1))), elev, Math.sin(az) * 0.7).normalize();
  }

  apply(dt, force = false) {
    if (this.cycle) this.time = (this.time + dt * this.cycleSpeed) % 24;
    this.rain = lerp(this.rain, this.targetRain, 1 - Math.exp(-dt * 0.5));
    this.occlusion = lerp(this.occlusion, this.occlusionTarget, 1 - Math.exp(-dt * 3));
    const open = 1 - this.occlusion * 0.78;
    this.wetness = clamp(this.wetness + (this.targetRain > 0.5 ? dt / 20 : -dt / 60), 0, 1);

    const dir = this.sunDirection(this.time);
    const elev = dir.y;
    this.daylight = smoothStep(-0.12, 0.25, elev);
    const golden = smoothStep(0.35, 0.02, elev) * this.daylight;

    // Céu
    this.skyMat.sunPosition = dir.scale(1000);
    this.skyMat.luminance = lerp(0.06, 1.0, this.daylight) * lerp(1, 0.55, this.rain);
    this.skyMat.turbidity = Math.max(lerp(6, 18, this.rain), lerp(6, 20, this.sand));
    this.skyMat.rayleigh = lerp(1.6, 0.8, this.rain);

    // Sol / lua
    const night = 1 - this.daylight;
    if (elev > -0.05) this.sun.direction = dir.scale(-1);
    else this.sun.direction = new Vector3(0.3, -0.9, 0.2).normalize(); // lua
    this.sun.intensity = lerp(0.12, 3.0, this.daylight) * lerp(1, 0.35, this.rain) * lerp(1, 0.4, this.sand) * open;
    this.sun.diffuse = Color3.Lerp(new Color3(0.55, 0.62, 0.85), Color3.Lerp(new Color3(1, 0.98, 0.93), new Color3(1, 0.7, 0.45), golden), this.daylight);
    this.hemi.intensity = lerp(0.18, 0.75, this.daylight) * lerp(1, 0.8, this.rain) * Math.max(0.35, open);
    this.hemi.diffuse = Color3.Lerp(new Color3(0.35, 0.42, 0.65), new Color3(0.75, 0.82, 0.95), this.daylight);

    // Neblina com a cor do horizonte
    const fogDay = Color3.Lerp(new Color3(0.68, 0.76, 0.86), new Color3(0.9, 0.7, 0.55), golden);
    const fog = Color3.Lerp(new Color3(0.03, 0.04, 0.07), fogDay, this.daylight);
    let fogRain = Color3.Lerp(fog, new Color3(0.42, 0.45, 0.5).scale(0.25 + 0.75 * this.daylight), this.rain);
    fogRain = Color3.Lerp(fogRain, new Color3(0.7, 0.53, 0.35).scale(0.3 + 0.7 * this.daylight), this.sand * 0.9);
    this.scene.fogColor = fogRain;
    this.scene.fogDensity = this.preset.fogDensity * (1 + this.rain * 2.5 + night * 0.4) + this.sand * 0.0045;
    this.scene.clearColor = new Color4(fogRain.r, fogRain.g, fogRain.b, 1);
    this.scene.environmentIntensity = lerp(0.15, 1.0, this.daylight) * Math.max(0.3, open);

    // Chuva (partículas seguem a câmera)
    if (this.rainSystem) {
      const cam = this.scene.activeCamera;
      if (cam) this.rainSystem.emitter = cam.globalPosition.clone();
      if (this.sandSystem && cam) this.sandSystem.emitter = cam.globalPosition.subtract(new Vector3(30, 4, 10));
      this.rainSystem.emitRate = this.rain > 0.05 ? this.preset.rainDrops * 1.2 * this.rain * (1 - this.occlusion) : 0;
    }

    // Reflexos: atualiza o probe quando a luz muda bastante
    if (this.probe) {
      this._probeTimer += dt;
      if (force || (this.cycle && this._probeTimer > 4)) {
        this._probeTimer = 0;
        this.probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE; // renderiza mais uma vez
      }
    }
    for (const fn of this.listeners) fn(this);
  }

  /** Mantém a área de sombras centralizada no ponto de interesse. */
  followTarget(pos) {
    if (!this.shadowGen) return;
    const d = this.sun.direction;
    this.sun.position = new Vector3(pos.x - d.x * 150, pos.y - d.y * 150, pos.z - d.z * 150);
  }

  /** Fator de aderência da pista conforme a umidade. */
  get gripFactor() {
    return lerp(1, 0.78, this.wetness) * lerp(1, 0.92, this.sand); // areia sobre o asfalto
  }

  dispose() {
    this.rainSystem?.dispose();
    this.sandSystem?.dispose();
    this.probe?.dispose();
    this.shadowGen?.dispose();
    this.sky.dispose();
  }
}
