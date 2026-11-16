// Lobby 3D: hangar de uma base militar ao entardecer com o agente do jogador em destaque,
// segurando a arma equipada (com a skin). Usa o mesmo motor do jogo (outra cena), então não cria
// um segundo contexto WebGL no celular. Tudo é gerado por código, identidade visual própria.
import {
  Color3,
  Color4,
  CreateBox,
  CreateCylinder,
  CreatePlane,
  CreateSphere,
  DirectionalLight,
  FreeCamera,
  HemisphericLight,
  Mesh,
  PBRMaterial,
  ParticleSystem,
  PointLight,
  Scene,
  ShadowGenerator,
  SpotLight,
  StandardMaterial,
  Vector3,
  type Engine,
  type Material
} from '../core/babylon';
import { CharacterModel } from '../player/CharacterModel';
import { getTexture, getNormalTexture, paintedTexture, type TextureName } from '../maps/textures';
import { applyStudioEnvironment } from '../core/Environment';
import { PostFx } from '../core/Graphics';
import type { QualityPreset } from '../core/Quality';
import type { PlayerView, Team } from '../sim/types';

export class LobbyScene {
  readonly scene: Scene;
  private camera: FreeCamera;
  private char: CharacterModel | null = null;
  private charKey = '';
  private shadow: ShadowGenerator | null = null;
  private post: PostFx;
  private t = 0;
  private lamps: { light: PointLight | SpotLight; base: number; phase: number }[] = [];
  /** Giro do personagem (arrastar na área livre da tela). */
  private turn = 0;
  private turnVel = 0;
  /** Câmera: 0 = plano geral, 1 = mais perto (transições entre telas). */
  private zoom = 0;
  private zoomTarget = 0;
  private intro = 0;
  active = false;
  team: Team = 'CT';
  variant = 0;
  weapon = 'ak47';
  skin = 'default';

  constructor(engine: Engine, private preset: QualityPreset) {
    const scene = new Scene(engine);
    this.scene = scene;
    scene.clearColor = new Color4(0.05, 0.055, 0.07, 1);
    scene.ambientColor = new Color3(0.2, 0.2, 0.22);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.02;
    scene.fogColor = new Color3(0.09, 0.09, 0.1);
    scene.skipPointerMovePicking = true;
    applyStudioEnvironment(scene, '#5d6b7c', '#8a6a4a', '#16171a');

    const cam = new FreeCamera('lobbyCam', new Vector3(-1.1, 1.35, 3.6), scene);
    cam.minZ = 0.05;
    cam.maxZ = 80;
    cam.fov = 0.72;
    cam.setTarget(new Vector3(0.35, 1.05, 0));
    this.camera = cam;

    // luz: ambiente fraca, sol de fim de tarde entrando pela porta, recorte azulado atrás, luminárias
    const hemi = new HemisphericLight('lobbyHemi', new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.75;
    hemi.diffuse = new Color3(0.75, 0.8, 0.9);
    hemi.groundColor = new Color3(0.12, 0.1, 0.08);
    const key = new DirectionalLight('lobbyKey', new Vector3(0.55, -0.6, -0.6), scene);
    key.position = new Vector3(-6, 8, 8);
    key.intensity = 2.1;
    key.diffuse = new Color3(1, 0.78, 0.55);
    const rim = new SpotLight('lobbyRim', new Vector3(1.5, 3.4, -2.6), new Vector3(-0.35, -0.55, 0.75), 1.1, 8, scene);
    rim.intensity = 26;
    rim.diffuse = new Color3(0.45, 0.65, 1);
    rim.range = 9;
    this.lamps.push({ light: rim, base: 26, phase: 0 });
    if (preset.shadows) {
      const sg = new ShadowGenerator(Math.min(2048, preset.shadowMapSize || 1024), key);
      sg.useBlurExponentialShadowMap = true;
      sg.blurKernel = 16;
      sg.depthScale = 60;
      this.shadow = sg;
    }

    this.buildHangar();
    this.buildProps();
    this.buildDust();
    this.post = new PostFx(scene, cam);
    this.post.apply(preset);
  }

  // ------------------------------------------------------------------ cenário

  private mat(name: TextureName, scale: number, tint = '#ffffff', metal = 0, rough = 0.8): Material {
    const size = Math.min(1024, this.preset.textureSize);
    if (this.preset.pbr) {
      const m = new PBRMaterial('lobby_' + name + scale, this.scene);
      const tex = getTexture(this.scene, name, size);
      tex.uScale = tex.vScale = scale;
      m.albedoTexture = tex;
      const n = getNormalTexture(this.scene, name, size);
      n.uScale = n.vScale = scale;
      m.bumpTexture = n;
      m.albedoColor = Color3.FromHexString(tint);
      m.metallic = metal;
      m.roughness = rough;
      m.environmentIntensity = 0.45;
      m.directIntensity = 1.4;
      return m;
    }
    const m = new StandardMaterial('lobby_' + name + scale, this.scene);
    const tex = getTexture(this.scene, name, size);
    tex.uScale = tex.vScale = scale;
    m.diffuseTexture = tex;
    m.diffuseColor = Color3.FromHexString(tint);
    m.specularColor = new Color3(0.08, 0.08, 0.08).scale(1 + metal * 4);
    return m;
  }

  private plain(hex: string, metal = 0, rough = 0.7, emissive?: string): Material {
    if (this.preset.pbr) {
      const m = new PBRMaterial('lobbyPlain' + hex, this.scene);
      m.albedoColor = Color3.FromHexString(hex);
      m.metallic = metal;
      m.roughness = rough;
      if (emissive) m.emissiveColor = Color3.FromHexString(emissive);
      return m;
    }
    const m = new StandardMaterial('lobbyPlain' + hex, this.scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.1, 0.1, 0.1);
    if (emissive) m.emissiveColor = Color3.FromHexString(emissive);
    return m;
  }

  private receive(m: Mesh): Mesh {
    m.receiveShadows = !!this.shadow;
    m.isPickable = false;
    return m;
  }

  private cast(m: Mesh): Mesh {
    this.shadow?.addShadowCaster(m);
    return this.receive(m);
  }

  private buildHangar(): void {
    const s = this.scene;
    // piso de concreto com faixas de sinalização
    const floor = this.receive(CreateBox('lobbyFloor', { width: 30, height: 0.2, depth: 24 }, s));
    floor.position.set(0, -0.1, -4);
    floor.material = this.mat('concrete', 6, '#a7a49e', 0, 0.85);
    const stripeMat = this.plain('#6e5a2a', 0, 0.85);
    for (const x of [-2.2, 2.6]) {
      const st = this.receive(CreateBox('lobbyStripe', { width: 0.14, height: 0.01, depth: 14 }, s));
      st.position.set(x, 0.005, -3);
      st.material = stripeMat;
    }
    // plataforma do agente (círculo com borda iluminada)
    const pad = this.receive(CreateCylinder('lobbyPad', { diameter: 2.2, height: 0.08, tessellation: 48 }, s));
    pad.position.y = 0.04;
    pad.material = this.plain('#1b1d22', 0.6, 0.35);
    // borda luminosa: um pouco maior e mais baixa que a plataforma, só a beirada aparece
    const ring = CreateCylinder('lobbyRing', { diameter: 2.3, height: 0.06, tessellation: 48 }, s);
    ring.position.y = 0.03;
    ring.material = this.plain('#000000', 0, 1, '#d98a1a');
    ring.isPickable = false;

    // casco do hangar em arco (chapa ondulada)
    const shell = CreateCylinder('lobbyShell', { diameter: 22, height: 26, tessellation: 40, arc: 0.5, sideOrientation: Mesh.BACKSIDE }, s);
    shell.rotation.z = Math.PI / 2;
    shell.rotation.y = Math.PI / 2;
    shell.position.set(0, 0, -6);
    shell.material = this.mat('metal', 6, '#6f7a6a', 0.5, 0.6);
    this.receive(shell);
    // parede do fundo com portão
    const back = this.receive(CreateBox('lobbyBack', { width: 22, height: 11, depth: 0.3 }, s));
    back.position.set(0, 5.5, -9.5);
    back.material = this.mat('metal', 6, '#5c6258', 0.6, 0.55);
    // vigas
    const beamMat = this.plain('#2a2d30', 0.8, 0.45);
    for (let i = 0; i < 5; i++) {
      const z = -9 + i * 3.2;
      const beam = CreateBox('lobbyBeam', { width: 21, height: 0.3, depth: 0.3 }, s);
      beam.position.set(0, 9.6, z);
      beam.material = beamMat;
      beam.isPickable = false;
    }
    // emblema da unidade (identidade própria): estrela em escudo com o nome
    const emblem = CreatePlane('lobbyEmblem', { width: 5.2, height: 3.1 }, s);
    emblem.position.set(-0.6, 4.6, -9.3);
    const etex = paintedTexture(s, 'lobbyEmblemTex', 512, (g, n) => {
      g.clearRect(0, 0, n, n);
      g.fillStyle = 'rgba(14,16,18,0.85)';
      g.fillRect(0, n * 0.12, n, n * 0.76);
      g.strokeStyle = '#d98a1a';
      g.lineWidth = 6;
      g.strokeRect(10, n * 0.12 + 10, n - 20, n * 0.76 - 20);
      // escudo
      const cx = n * 0.22, cy = n * 0.5, r = n * 0.15;
      g.fillStyle = '#d98a1a';
      g.beginPath();
      g.moveTo(cx - r, cy - r);
      g.lineTo(cx + r, cy - r);
      g.lineTo(cx + r, cy + r * 0.2);
      g.quadraticCurveTo(cx, cy + r * 1.4, cx - r, cy + r * 0.2);
      g.closePath();
      g.fill();
      g.fillStyle = '#121416';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.28 : r * 0.68;
        g.lineTo(cx + Math.cos(a) * rr, cy - r * 0.15 + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      g.fillStyle = '#e8e2d4';
      g.font = `900 italic ${Math.round(n * 0.1)}px sans-serif`;
      g.fillText('OPERATION', n * 0.42, n * 0.46);
      g.fillStyle = '#d98a1a';
      g.fillText('STRIKE', n * 0.42, n * 0.58);
      g.fillStyle = '#9aa0a6';
      g.font = `600 ${Math.round(n * 0.035)}px sans-serif`;
      g.fillText('FORÇA-TAREFA 7 · BASE AVANÇADA', n * 0.42, n * 0.67);
    });
    const em = new StandardMaterial('lobbyEmblemMat', s);
    em.diffuseTexture = etex;
    em.useAlphaFromDiffuseTexture = true;
    em.emissiveColor = new Color3(0.75, 0.75, 0.75);
    em.specularColor = Color3.Black();
    emblem.material = em;
    emblem.isPickable = false;

    // luminárias industriais penduradas
    const lampMat = this.plain('#1d1f22', 0.7, 0.4);
    const bulbMat = this.plain('#000000', 0, 1, '#ffd9a0');
    const lampSpots: [number, number][] = [[-4.5, -3], [3.8, -4.5], [0.2, 1.2]];
    for (const [x, z] of lampSpots) {
      const shade = CreateCylinder('lobbyLamp', { diameterTop: 0.25, diameterBottom: 0.9, height: 0.45, tessellation: 20 }, s);
      shade.position.set(x, 6.2, z);
      shade.material = lampMat;
      const bulb = CreateSphere('lobbyBulb', { diameter: 0.28, segments: 8 }, s);
      bulb.position.set(x, 5.95, z);
      bulb.material = bulbMat;
      const cable = CreateCylinder('lobbyCable', { diameter: 0.02, height: 3.4 }, s);
      cable.position.set(x, 8.1, z);
      cable.material = lampMat;
      if (this.preset.dynamicLights || this.lamps.length < 2) {
        const l = new PointLight('lobbyLampL', new Vector3(x, 5.7, z), s);
        l.diffuse = new Color3(1, 0.82, 0.6);
        l.intensity = 45;
        l.range = 14;
        this.lamps.push({ light: l, base: 45, phase: Math.random() * 10 });
      }
    }
  }

  private buildProps(): void {
    const s = this.scene;
    // barricada de sacos de areia em semicírculo atrás do agente
    const bagMat = this.mat('sand', 1, '#a8956c', 0, 0.95);
    const bag = CreateSphere('lobbyBag', { diameter: 1, segments: 10 }, s);
    bag.material = bagMat;
    bag.scaling.set(0.62, 0.22, 0.34);
    bag.isPickable = false;
    this.cast(bag);
    bag.setEnabled(false);
    let i = 0;
    for (let row = 0; row < 4; row++)
      for (let k = 0; k < 9 - row; k++) {
        const a = -0.9 + (k + (row % 2) * 0.5) * 0.22;
        const inst = bag.createInstance('bag' + i++);
        inst.position.set(Math.sin(a) * 3.1 + 0.6, 0.11 + row * 0.2, -Math.cos(a) * 3.1 - 0.4);
        inst.rotation.y = a + (Math.random() - 0.5) * 0.15;
        inst.isPickable = false;
        this.shadow?.addShadowCaster(inst);
      }
    // pilha de caixas de suprimento
    const crateMat = this.mat('crate', 1, '#ffffff', 0, 0.75);
    const crates: [number, number, number, number, number][] = [
      [-3.4, 0.5, -2.2, 1, 0.2], [-2.35, 0.4, -2.5, 0.8, -0.15], [-3.2, 1.4, -2.3, 0.8, 0.5], [3.6, 0.45, -3.2, 0.9, 0.1]
    ];
    for (const [x, y, z, sz, r] of crates) {
      const c = this.cast(CreateBox('lobbyCrate', { size: sz }, s));
      c.position.set(x, y, z);
      c.rotation.y = r;
      c.material = crateMat;
    }
    // contêiner ao fundo
    const cont = this.cast(CreateBox('lobbyContainer', { width: 6, height: 2.6, depth: 2.4 }, s));
    cont.position.set(5.6, 1.3, -6.8);
    cont.rotation.y = -0.25;
    cont.material = this.mat('container', 1, '#4f6b4a', 0.55, 0.55);
    // tambores
    const drumMat = this.plain('#3d4a33', 0.5, 0.5);
    for (const [x, z] of [[-4.6, -0.6], [-5.2, -1.3], [4.4, -1.4]] as [number, number][]) {
      const d = this.cast(CreateCylinder('lobbyDrum', { diameter: 0.6, height: 0.9, tessellation: 18 }, s));
      d.position.set(x, 0.45, z);
      d.material = drumMat;
    }
    // rede de camuflagem sobre a área (alfa pintado)
    const net = CreatePlane('lobbyNet', { width: 12, height: 8 }, s);
    net.rotation.x = Math.PI / 2 + 0.12;
    net.position.set(0, 4.3, -3);
    const ntex = paintedTexture(s, 'lobbyNetTex', 256, (g, n) => {
      g.clearRect(0, 0, n, n);
      const cols = ['#3b4630', '#55603c', '#6b6544', '#2d3526'];
      for (let k = 0; k < 900; k++) {
        g.fillStyle = cols[k % 4];
        g.globalAlpha = 0.85;
        const x = Math.random() * n, y = Math.random() * n, r = 2 + Math.random() * 7;
        g.beginPath();
        g.ellipse(x, y, r, r * 0.6, Math.random() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    });
    const nm = new StandardMaterial('lobbyNetMat', s);
    nm.diffuseTexture = ntex;
    nm.useAlphaFromDiffuseTexture = true;
    nm.backFaceCulling = false;
    nm.specularColor = Color3.Black();
    net.material = nm;
    net.isPickable = false;
    // luz do sol entrando pelo portão aberto (faixa de luz no fundo)
    const glow = CreatePlane('lobbyDoorGlow', { width: 5, height: 6 }, s);
    glow.position.set(-7.5, 3, -9.3);
    glow.material = this.plain('#000000', 0, 1, '#f2b26a');
    glow.isPickable = false;
  }

  private buildDust(): void {
    if (this.preset.particles < 12) return;
    const s = this.scene;
    const ps = new ParticleSystem('lobbyDust', 160, s);
    ps.particleTexture = paintedTexture(s, 'lobbyMote', 32, (g, n) => {
      const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      grd.addColorStop(0, 'rgba(255,240,210,1)');
      grd.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, n, n);
    });
    ps.emitter = new Vector3(0, 2, -1);
    ps.minEmitBox = new Vector3(-5, -2, -4);
    ps.maxEmitBox = new Vector3(5, 3, 3);
    ps.color1 = new Color4(1, 0.9, 0.7, 0.35);
    ps.color2 = new Color4(1, 0.85, 0.6, 0.2);
    ps.colorDead = new Color4(1, 0.85, 0.6, 0);
    ps.minSize = 0.01;
    ps.maxSize = 0.035;
    ps.minLifeTime = 5;
    ps.maxLifeTime = 10;
    ps.emitRate = 16;
    ps.direction1 = new Vector3(-0.05, -0.02, -0.05);
    ps.direction2 = new Vector3(0.05, 0.05, 0.05);
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 1;
    ps.gravity = Vector3.Zero();
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.preWarmCycles = 200;
    ps.start();
  }

  // ------------------------------------------------------------------ agente

  /** Troca o agente ou a arma exibida (recria o modelo só quando a equipe/visual muda). */
  setLoadout(team: Team, variant: number, weapon: string, skin: string): void {
    this.team = team;
    this.variant = variant;
    this.weapon = weapon;
    this.skin = skin;
    const key = team + variant + (CharacterModel.pbr ? 'p' : 's');
    if (key !== this.charKey) {
      this.char?.dispose();
      this.char = new CharacterModel(this.scene, team, variant, this.shadow);
      this.charKey = key;
      if (this.shadow) for (const m of this.char.root.getChildMeshes()) this.shadow.addShadowCaster(m, false);
      this.intro = 0;
    }
  }

  /** Arraste horizontal para girar o agente. */
  drag(dx: number): void {
    this.turnVel += dx * 0.012;
  }

  /** Aproxima a câmera (ex.: telas de arsenal/perfil) ou volta ao plano geral. */
  focus(close: boolean): void {
    this.zoomTarget = close ? 1 : 0;
  }

  setPreset(p: QualityPreset): void {
    this.preset = p;
    this.post.apply(p);
  }

  private view: PlayerView = {
    id: 'lobby', name: '', team: 'CT', bot: false, x: 0.35, y: 0.08, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0,
    crouch: false, ground: true, alive: true, hp: 100, armor: 100, helmet: true, kit: false, money: 0, weapon: 'ak47',
    bomb: false, act: 0, kills: 0, deaths: 0, assists: 0, score: 0, mvps: 0, ping: 0, connected: true, variant: 0, skin: 'default'
  };

  render(dt: number): void {
    this.t += dt;
    this.intro = Math.min(1, this.intro + dt * 1.2);
    // giro com inércia que volta devagar para a pose de frente
    this.turn += this.turnVel;
    this.turnVel *= Math.exp(-dt * 5);
    if (Math.abs(this.turnVel) < 0.001) this.turn *= Math.exp(-dt * 0.6);
    const v = this.view;
    v.team = this.team;
    v.weapon = this.weapon;
    v.skin = this.skin;
    // idle: respiração (tronco sobe e desce), olhar que passeia e peso trocando de perna
    const breath = Math.sin(this.t * 1.7);
    v.pitch = -0.06 + breath * 0.025 + Math.sin(this.t * 0.37) * 0.03;
    v.yaw = -0.35 + this.turn + Math.sin(this.t * 0.23) * 0.07 + (1 - this.intro) * 0.6;
    if (this.char) {
      this.char.update(dt, v, 0);
      this.char.root.position.y = 0.08 + breath * 0.004;
    }
    // câmera: leve deriva + aproximação suave
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 3);
    const z = this.zoom;
    const e = 1 - Math.pow(1 - this.intro, 3);
    this.camera.position.set(-1.1 + z * 0.45 + Math.sin(this.t * 0.13) * 0.12, 1.35 + Math.sin(this.t * 0.21) * 0.04 - z * 0.05, 3.6 - z * 1.3 + (1 - e) * 1.2);
    this.camera.setTarget(new Vector3(0.35 + z * 0.1, 1.05 + z * 0.12, 0));
    // luminárias com leve oscilação (gerador)
    for (const l of this.lamps) l.light.intensity = l.base * (0.94 + Math.sin(this.t * 7 + l.phase) * 0.03 + Math.sin(this.t * 13.3 + l.phase) * 0.03);
    this.scene.render();
  }

  dispose(): void {
    this.post.dispose();
    this.char?.dispose();
    this.scene.dispose();
  }
}
