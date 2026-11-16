// Lobby 3D: o esquadrão (o jogador + 3 companheiros da mesma equipe) em fila, armados, num pátio industrial
// à noite — neblina azulada, holofotes com fachos de luz, fita de isolamento vermelha e branca, contêineres,
// cerca e torre de andaime ao fundo. Usa o mesmo motor do jogo (outra cena): nenhum contexto WebGL extra no celular.
// Tudo gerado por código (identidade visual própria); os personagens são os modelos 3D das equipes.
import {
  Color3,
  Color4,
  CreateBox,
  CreateCylinder,
  CreatePlane,
  DirectionalLight,
  FreeCamera,
  HemisphericLight,
  Matrix,
  Mesh,
  PBRMaterial,
  ParticleSystem,
  Quaternion,
  Scene,
  ShadowGenerator,
  SpotLight,
  StandardMaterial,
  Vector3,
  type Engine,
  type Material
} from '../core/babylon';
import { CharacterModel } from '../player/Character';
import { characterAsset } from '../player/CharacterAssets';
import { getTexture, paintedTexture, type TextureName } from '../maps/textures';
import { applyPbr, pbrSet, resFor } from '../maps/PbrTextures';
import { applyStudioEnvironment } from '../core/Environment';
import { PostFx } from '../core/Graphics';
import type { QualityPreset } from '../core/Quality';
import type { PlayerView, Team } from '../sim/types';

/** Integrante do esquadrão mostrado no lobby. */
export interface SquadMember {
  name: string;
  level: number;
  weapon: string;
  skin: string;
  /** O próprio jogador (fica em destaque). */
  me?: boolean;
}

/** Posições na fila (x, z, yaw em graus). O jogador ocupa a 2ª posição, como líder do esquadrão. */
const SLOTS: [number, number, number][] = [[-1.55, 0.1, 10], [0.0, 0.35, -4], [1.5, 0.15, -10], [3.0, -0.1, -16]];

export class LobbyScene {
  readonly scene: Scene;
  private camera: FreeCamera;
  private chars: (CharacterModel | null)[] = [null, null, null, null];
  private charKeys = ['', '', '', ''];
  private shadow: ShadowGenerator | null = null;
  private post: PostFx;
  private t = 0;
  private lights: { light: SpotLight; base: number; phase: number }[] = [];
  private beams: Mesh[] = [];
  /** Câmera: 0 = plano geral, 1 = mais perto do jogador (telas de perfil). */
  private zoom = 0;
  private zoomTarget = 0;
  private intro = 0;
  private squad: SquadMember[] = [];
  /** Posição de tela das plaquinhas de nome (atualizada a cada quadro). */
  readonly plates: { x: number; y: number; visible: boolean }[] = SLOTS.map(() => ({ x: 0, y: 0, visible: false }));
  active = false;
  team: Team = 'CT';
  variant = 0;
  weapon = 'ak47';
  skin = 'default';

  constructor(engine: Engine, private preset: QualityPreset) {
    const scene = new Scene(engine);
    this.scene = scene;
    scene.clearColor = new Color4(0.08, 0.115, 0.155, 1);
    scene.ambientColor = new Color3(0.12, 0.15, 0.2);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.032;
    scene.fogColor = new Color3(0.1, 0.14, 0.19);
    scene.skipPointerMovePicking = true;
    applyStudioEnvironment(scene, '#3c5a78', '#22313f', '#0c1014');

    const cam = new FreeCamera('lobbyCam', new Vector3(0.75, 1.15, 5.0), scene);
    cam.minZ = 0.05;
    cam.maxZ = 90;
    cam.fov = 0.78;
    cam.setTarget(new Vector3(0.75, 1.05, 0));
    this.camera = cam;

    // luz: céu noturno frio, lua (sombras), holofotes atrás à direita e recorte azul-ciano
    const hemi = new HemisphericLight('lobbyHemi', new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.55;
    hemi.diffuse = new Color3(0.55, 0.68, 0.85);
    hemi.groundColor = new Color3(0.06, 0.07, 0.09);
    const moon = new DirectionalLight('lobbyMoon', new Vector3(-0.35, -0.75, -0.55), scene);
    moon.position = new Vector3(6, 12, 10);
    moon.intensity = 1.25;
    moon.diffuse = new Color3(0.72, 0.82, 1);
    const front = new SpotLight('lobbyFront', new Vector3(0.8, 4.2, 6.5), new Vector3(0, -0.55, -0.85), 1.0, 6, scene);
    front.intensity = 150;
    front.diffuse = new Color3(0.86, 0.92, 1);
    front.range = 16;
    // recorte azul-ciano por trás (separa as silhuetas da neblina, como num retrato de esquadrão)
    for (const [x, z] of [[-3.5, -3.2], [4.5, -3.0]] as const) {
      const rim = new SpotLight('lobbyRim', new Vector3(x, 3.6, z), new Vector3(0.75 - x * 0.12, -0.45, 1).normalize(), 1.2, 4, scene);
      rim.diffuse = new Color3(0.45, 0.72, 1);
      rim.intensity = 90;
      rim.range = 12;
    }
    if (preset.shadows) {
      const sg = new ShadowGenerator(Math.min(2048, preset.shadowMapSize || 1024), moon);
      sg.useBlurExponentialShadowMap = true;
      sg.blurKernel = 16;
      sg.depthScale = 60;
      this.shadow = sg;
    }

    this.buildGround();
    this.buildBackdrop();
    this.buildFloodlights();
    this.buildTape();
    this.buildHaze();
    this.post = new PostFx(scene, cam);
    this.post.apply(preset);
  }

  // ------------------------------------------------------------------ materiais

  private mat(name: TextureName, scale: number, tint = '#ffffff', metal = 0, rough = 0.8): Material {
    const size = Math.min(1024, this.preset.textureSize);
    const key = 'lobby_' + name + scale + tint;
    const found = this.scene.getMaterialByName(key);
    if (found) return found;
    if (this.preset.pbr) {
      // texturas PBR reais (cópias próprias do lobby, com a repetição de cada peça)
      const m = new PBRMaterial(key, this.scene);
      const set = pbrSet(this.scene, name, resFor(name, this.preset.pbrRes === '4k' ? '2k' : this.preset.pbrRes), this.preset.aniso, 'lobby' + scale);
      for (const t of [set.albedo, set.normal, set.orm]) t.uScale = t.vScale = scale;
      applyPbr(m, set);
      m.albedoColor = Color3.FromHexString(tint);
      void metal;
      void rough;
      m.environmentIntensity = 0.55;
      m.directIntensity = 1.3;
      return m;
    }
    const m = new StandardMaterial(key, this.scene);
    const tex = getTexture(this.scene, name, size);
    tex.uScale = tex.vScale = scale;
    m.diffuseTexture = tex;
    m.diffuseColor = Color3.FromHexString(tint);
    m.specularColor = new Color3(0.1, 0.1, 0.12).scale(1 + metal * 3);
    return m;
  }

  private plain(hex: string, metal = 0, rough = 0.7, emissive?: string): Material {
    const key = 'lobbyPlain' + hex + (emissive ?? '');
    const found = this.scene.getMaterialByName(key);
    if (found) return found;
    if (this.preset.pbr) {
      const m = new PBRMaterial(key, this.scene);
      m.albedoColor = Color3.FromHexString(hex);
      m.metallic = metal;
      m.roughness = rough;
      if (emissive) m.emissiveColor = Color3.FromHexString(emissive);
      return m;
    }
    const m = new StandardMaterial(key, this.scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.1, 0.1, 0.1);
    if (emissive) m.emissiveColor = Color3.FromHexString(emissive);
    return m;
  }

  private place(m: Mesh, cast = true): Mesh {
    m.isPickable = false;
    m.receiveShadows = !!this.shadow;
    if (cast) this.shadow?.addShadowCaster(m);
    return m;
  }

  // ------------------------------------------------------------------ cenário

  private buildGround(): void {
    const s = this.scene;
    // asfalto molhado (rugosidade baixa = reflexo dos holofotes)
    const g = this.place(CreateBox('lobbyGround', { width: 60, height: 0.2, depth: 60 }, s), false);
    g.position.y = -0.1;
    g.material = this.mat('asphalt', 14, '#5d646c', 0.1, 0.38);
    // poças
    const pud = this.plain('#0d1218', 0.6, 0.06);
    for (const [x, z, w, d] of [[-2.4, 1.6, 2.2, 1.1], [2.2, 2.2, 1.6, 0.8], [0.6, -2.5, 3, 1.2]] as const) {
      const p = this.place(CreateBox('lobbyPuddle', { width: w, height: 0.01, depth: d }, s), false);
      p.position.set(x, 0.005, z);
      p.material = pud;
    }
  }

  private buildBackdrop(): void {
    const s = this.scene;
    // contêineres empilhados ao fundo (vermelho escuro, azul, verde)
    const cont: [number, number, number, number, string][] = [
      [-7.5, 1.3, -8.5, 0.15, '#6b2a24'], [-1.8, 1.3, -10.5, -0.05, '#28465e'], [-1.8, 3.9, -10.5, -0.05, '#3e4a33'],
      [4.2, 1.3, -9.2, 0.25, '#7a3328'], [4.2, 3.9, -9.4, 0.2, '#2c3f52'], [9.5, 1.3, -6.5, 0.6, '#5a2c26']
    ];
    for (const [x, y, z, r, tint] of cont) {
      const c = this.place(CreateBox('lobbyCont', { width: 6.1, height: 2.6, depth: 2.45 }, s));
      c.position.set(x, y, z);
      c.rotation.y = r;
      c.material = this.mat('container', 1, tint, 0.45, 0.55);
    }
    // cerca de alambrado
    const fenceTex = paintedTexture(s, 'lobbyFence', 128, (g, n) => {
      g.clearRect(0, 0, n, n);
      g.strokeStyle = 'rgba(150,165,180,0.85)';
      g.lineWidth = 2;
      for (let i = -n; i < n * 2; i += 16) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + n, n); g.stroke();
        g.beginPath(); g.moveTo(i + n, 0); g.lineTo(i, n); g.stroke();
      }
    });
    fenceTex.uScale = 14;
    fenceTex.vScale = 1.4;
    const fm = new StandardMaterial('lobbyFenceMat', s);
    fm.diffuseTexture = fenceTex;
    fm.useAlphaFromDiffuseTexture = true;
    fm.backFaceCulling = false;
    fm.specularColor = Color3.Black();
    // tela do alambrado em painéis entre os postes (textura sem repetir demais, para não virar listras)
    fenceTex.uScale = 2.2;
    fenceTex.vScale = 1.5;
    for (let x = -13; x < 13; x += 3.25) {
      const panel = CreatePlane('lobbyFenceMesh', { width: 3.25, height: 2.8 }, s);
      panel.position.set(x + 1.625, 1.4, -5.6);
      panel.material = fm;
      panel.isPickable = false;
    }
    const post = this.plain('#3a4148', 0.7, 0.5);
    for (let x = -13; x <= 13; x += 3.25) {
      const p = this.place(CreateCylinder('lobbyFencePost', { diameter: 0.07, height: 3, tessellation: 8 }, s));
      p.position.set(x, 1.5, -5.6);
      p.material = post;
    }
    // torre de andaime à esquerda
    const scaf = this.plain('#4b5359', 0.75, 0.45);
    for (const [x, z] of [[-6.2, -3.2], [-4.6, -3.2], [-6.2, -4.6], [-4.6, -4.6]] as const) {
      const p = this.place(CreateCylinder('lobbyScafPost', { diameter: 0.08, height: 9, tessellation: 8 }, s));
      p.position.set(x, 4.5, z);
      p.material = scaf;
    }
    for (const y of [2.2, 4.4, 6.6, 8.6]) {
      const deck = this.place(CreateBox('lobbyScafDeck', { width: 1.8, height: 0.08, depth: 1.6 }, s));
      deck.position.set(-5.4, y, -3.9);
      deck.material = this.mat('metal', 1, '#59606a', 0.7, 0.5);
      for (const z of [-3.2, -4.6]) {
        const rail = this.place(CreateBox('lobbyScafRail', { width: 1.7, height: 0.05, depth: 0.05 }, s));
        rail.position.set(-5.4, y + 0.9, z);
        rail.material = scaf;
      }
    }
    // barreiras de concreto e caixas
    const jersey = this.mat('concrete', 1, '#8d8f8f', 0, 0.9);
    for (const [x, z, r] of [[-3.6, -1.6, 0.3], [5.4, -1.2, -0.4], [6.8, 1.6, -0.9]] as const) {
      const b = this.place(CreateBox('lobbyJersey', { width: 2.0, height: 0.8, depth: 0.45 }, s));
      b.position.set(x, 0.4, z);
      b.rotation.y = r;
      b.material = jersey;
    }
    const crate = this.mat('crate', 1, '#b9b2a4', 0, 0.8);
    for (const [x, y, z, sz] of [[-4.9, 0.45, 0.2, 0.9], [-4.4, 1.2, 0.3, 0.6], [5.6, 0.5, 0.6, 1.0]] as const) {
      const c = this.place(CreateBox('lobbyCrate', { size: sz }, s));
      c.position.set(x, y, z);
      c.rotation.y = x * 0.3;
      c.material = crate;
    }
  }

  private buildFloodlights(): void {
    const s = this.scene;
    const glowTex = paintedTexture(s, 'lobbyGlow', 128, (g, n) => {
      const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.18, 'rgba(225,238,255,0.85)');
      grd.addColorStop(0.5, 'rgba(150,190,255,0.18)');
      grd.addColorStop(1, 'rgba(120,170,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, n, n);
    });
    const glowMat = new StandardMaterial('lobbyGlowMat', s);
    glowMat.emissiveTexture = glowTex;
    glowMat.opacityTexture = glowTex;
    glowMat.disableLighting = true;
    glowMat.alphaMode = 1; // aditivo
    glowMat.fogEnabled = false;
    // facho de luz volumétrico (cone translúcido com degradê)
    const beamTex = paintedTexture(s, 'lobbyBeam', 64, (g, n) => {
      const grd = g.createLinearGradient(0, 0, 0, n);
      grd.addColorStop(0, 'rgba(190,215,255,0.11)');
      grd.addColorStop(1, 'rgba(190,215,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, n, n);
    });
    const beamMat = new StandardMaterial('lobbyBeamMat', s);
    beamMat.emissiveTexture = beamTex;
    beamMat.opacityTexture = beamTex;
    beamMat.disableLighting = true;
    beamMat.alphaMode = 1;
    beamMat.backFaceCulling = false;
    beamMat.disableDepthWrite = true;
    const pole = this.plain('#2f353b', 0.7, 0.5);
    const lampMat = this.plain('#000000', 0, 1, '#eef4ff');
    // torres de holofote: atrás à direita (como no fundo de um pátio) e uma à esquerda
    const towers: [number, number, number, Vector3][] = [
      [5.5, 7.2, -7.5, new Vector3(-0.45, -0.75, 0.55)], [8.2, 7.6, -6.0, new Vector3(-0.6, -0.7, 0.45)], [-8.5, 6.5, -6.8, new Vector3(0.55, -0.7, 0.5)]
    ];
    for (const [x, y, z, dir] of towers) {
      const p = this.place(CreateCylinder('lobbyFloodPole', { diameter: 0.18, height: y, tessellation: 8 }, s));
      p.position.set(x, y / 2, z);
      p.material = pole;
      for (const dx of [-0.35, 0.35]) {
        const head = CreateBox('lobbyFloodHead', { width: 0.55, height: 0.45, depth: 0.18 }, s);
        head.position.set(x + dx, y + 0.2, z);
        head.material = pole;
        head.isPickable = false;
        const lens = CreatePlane('lobbyFloodLens', { width: 0.46, height: 0.36 }, s);
        lens.position.set(x + dx, y + 0.2, z + 0.1);
        lens.rotation.y = Math.PI;
        lens.material = lampMat;
        lens.isPickable = false;
        const glow = CreatePlane('lobbyFloodGlow', { size: 2.6 }, s);
        glow.position.set(x + dx, y + 0.2, z + 0.2);
        glow.billboardMode = Mesh.BILLBOARDMODE_ALL;
        glow.material = glowMat;
        glow.isPickable = false;
      }
      // cone largo com queda suave (sem borda dura)
      const light = new SpotLight('lobbyFlood', new Vector3(x, y, z), dir, 1.5, 10, s);
      light.diffuse = new Color3(0.75, 0.85, 1);
      light.intensity = 60;
      light.range = 22;
      this.lights.push({ light, base: 60, phase: Math.random() * 10 });
      if (this.preset.particles >= 12) {
        // cone do facho apontando para a direção da luz
        const len = 11;
        const beam = CreateCylinder('lobbyBeam', { diameterTop: 0.5, diameterBottom: 3.2, height: len, tessellation: 24, cap: Mesh.NO_CAP }, s);
        const d = dir.normalize();
        beam.position = new Vector3(x, y, z).add(d.scale(len / 2));
        const up = new Vector3(0, 1, 0);
        const axis = Vector3.Cross(up, d.negate()).normalize();
        const ang = Math.acos(Vector3.Dot(up, d.negate()));
        beam.rotationQuaternion = Quaternion.RotationAxis(axis, ang);
        beam.material = beamMat;
        beam.isPickable = false;
        beam.applyFog = false;
        this.beams.push(beam);
      }
    }
  }

  private buildTape(): void {
    const s = this.scene;
    // fita de isolamento: listras vermelhas e brancas com texto
    const tex = paintedTexture(s, 'lobbyTape', 256, (g, n) => {
      g.fillStyle = '#d8d6d0';
      g.fillRect(0, 0, n, n);
      g.fillStyle = '#b3161b';
      for (let x = -n; x < n * 2; x += 44) {
        g.beginPath();
        g.moveTo(x, 0); g.lineTo(x + 22, 0); g.lineTo(x + 22 - n * 0.35, n); g.lineTo(x - n * 0.35, n);
        g.closePath();
        g.fill();
      }
      g.fillStyle = 'rgba(25,8,8,0.85)';
      g.font = `900 ${Math.round(n * 0.55)}px sans-serif`;
      g.textBaseline = 'middle';
      g.fillText('PERIGO · NÃO ULTRAPASSE', 6, n / 2);
    });
    tex.wrapU = 1;
    tex.uScale = 3; // texto repetido ao longo da fita (textura compartilhada: clonar textura de canvas sai vazia)
    const tm = new StandardMaterial('lobbyTapeMat', s);
    tm.diffuseTexture = tex;
    tm.emissiveColor = new Color3(0.18, 0.12, 0.12);
    tm.backFaceCulling = false;
    tm.specularColor = new Color3(0.2, 0.2, 0.2);
    const tape = (a: Vector3, b: Vector3, width = 0.09) => {
      const len = Vector3.Distance(a, b);
      const m = CreatePlane('lobbyTapeStrip', { width: len, height: width }, s);
      m.position = a.add(b).scale(0.5);
      m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      m.rotation.z = Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
      m.material = tm;
      m.isPickable = false;
      return m;
    };
    // postes/cones que seguram a fita
    const coneMat = this.plain('#c8341f', 0, 0.6);
    const stripeMat = this.plain('#e9e6df', 0, 0.6);
    const posts: Vector3[] = [new Vector3(-5.8, 0, -2.4), new Vector3(-2.6, 0, -2.9), new Vector3(1.2, 0, -2.2), new Vector3(4.6, 0, -2.8), new Vector3(7.4, 0, -1.3),
      new Vector3(4.2, 0, 2.4), new Vector3(7.0, 0, 3.2)];
    for (const p of posts) {
      const cone = this.place(CreateCylinder('lobbyCone', { diameterTop: 0.06, diameterBottom: 0.36, height: 0.75, tessellation: 14 }, s));
      cone.position.set(p.x, 0.375, p.z);
      cone.material = coneMat;
      const band = CreateCylinder('lobbyConeBand', { diameterTop: 0.17, diameterBottom: 0.22, height: 0.12, tessellation: 14 }, s);
      band.position.set(p.x, 0.45, p.z);
      band.material = stripeMat;
      band.isPickable = false;
      const pole = CreateCylinder('lobbyConePole', { diameter: 0.04, height: 0.55, tessellation: 6 }, s);
      pole.position.set(p.x, 0.95, p.z);
      pole.material = stripeMat;
      pole.isPickable = false;
    }
    // atrás do esquadrão (em zigue-zague) e na frente à direita
    for (let i = 0; i < 4; i++) {
      const a = posts[i], b = posts[i + 1];
      tape(new Vector3(a.x, 1.2, a.z), new Vector3(b.x, 1.12, b.z));
      tape(new Vector3(a.x, 0.75, a.z), new Vector3(b.x, 0.7, b.z), 0.07);
    }
    tape(new Vector3(posts[5].x, 1.2, posts[5].z), new Vector3(posts[6].x, 1.15, posts[6].z));
    tape(new Vector3(posts[4].x, 1.18, posts[4].z), new Vector3(posts[6].x, 1.1, posts[6].z));
    // fita caída no chão em primeiro plano
    const floor = tape(new Vector3(-3.2, 0.012, 2.6), new Vector3(2.8, 0.012, 3.4), 0.1);
    floor.rotation.x = Math.PI / 2;
  }

  private buildHaze(): void {
    if (this.preset.particles < 12) return;
    const s = this.scene;
    const ps = new ParticleSystem('lobbyHaze', 220, s);
    ps.particleTexture = paintedTexture(s, 'lobbyMote', 32, (g, n) => {
      const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      grd.addColorStop(0, 'rgba(210,225,255,1)');
      grd.addColorStop(1, 'rgba(210,225,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, n, n);
    });
    ps.emitter = new Vector3(1, 2.5, -1);
    ps.minEmitBox = new Vector3(-7, -2.5, -5);
    ps.maxEmitBox = new Vector3(7, 4, 4);
    ps.color1 = new Color4(0.75, 0.85, 1, 0.35);
    ps.color2 = new Color4(0.6, 0.72, 0.95, 0.2);
    ps.colorDead = new Color4(0.6, 0.72, 0.95, 0);
    ps.minSize = 0.01;
    ps.maxSize = 0.04;
    ps.minLifeTime = 6;
    ps.maxLifeTime = 12;
    ps.emitRate = 20;
    ps.direction1 = new Vector3(-0.06, -0.03, -0.04);
    ps.direction2 = new Vector3(0.06, 0.03, 0.04);
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 1;
    ps.gravity = Vector3.Zero();
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.preWarmCycles = 300;
    ps.start();
  }

  // ------------------------------------------------------------------ esquadrão

  /** Integrantes mostrados (o jogador + companheiros). Recria só quem mudou. */
  setSquad(members: SquadMember[]): void {
    this.squad = members.slice(0, SLOTS.length);
    this.rebuild();
  }

  /** Equipe e arma do jogador (compatível com o lobby anterior). */
  setLoadout(team: Team, variant: number, weapon: string, skin: string): void {
    this.team = team;
    this.variant = variant;
    this.weapon = weapon;
    this.skin = skin;
    const me = this.squad.find(m => m.me);
    if (me) {
      me.weapon = weapon;
      me.skin = skin;
    }
    this.rebuild();
  }

  private rebuild(): void {
    const loaded = characterAsset(this.scene, this.team) ? 'm' : 'p';
    for (let i = 0; i < SLOTS.length; i++) {
      const m = this.squad[i];
      // o modelo 3D da equipe pode terminar de carregar depois: a chave muda e o personagem é recriado
      const key = m ? this.team + loaded + (CharacterModel.pbr ? 'p' : 's') + i : '';
      if (key !== this.charKeys[i]) {
        this.chars[i]?.dispose();
        this.chars[i] = null;
        this.charKeys[i] = key;
        if (m) {
          const c = new CharacterModel(this.scene, this.team, i, this.shadow);
          if (this.shadow) for (const mesh of c.root.getChildMeshes()) this.shadow.addShadowCaster(mesh, false);
          this.chars[i] = c;
        }
        if (i === 0) this.intro = 0;
      }
    }
  }

  /** Mantido por compatibilidade (o esquadrão não gira mais com o arrasto). */
  drag(dx: number): void {
    void dx;
  }

  /** Aproxima a câmera do jogador (telas de perfil/arsenal) ou volta ao plano geral. */
  focus(close: boolean): void {
    this.zoomTarget = close ? 1 : 0;
  }

  setPreset(p: QualityPreset): void {
    this.preset = p;
    this.post.apply(p);
  }

  private views: PlayerView[] = SLOTS.map(() => ({
    id: 'lobby', name: '', team: 'CT', bot: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0,
    crouch: false, ground: true, alive: true, hp: 100, armor: 100, helmet: true, kit: false, money: 0, weapon: 'ak47',
    bomb: false, act: 0, kills: 0, deaths: 0, assists: 0, score: 0, mvps: 0, ping: 0, connected: true, variant: 0, skin: 'default'
  }));

  render(dt: number): void {
    this.t += dt;
    this.intro = Math.min(1, this.intro + dt * 0.9);
    const e = 1 - Math.pow(1 - this.intro, 3);
    for (let i = 0; i < SLOTS.length; i++) {
      const c = this.chars[i], m = this.squad[i];
      if (!c || !m) continue;
      const [x, z, yaw] = SLOTS[i];
      const v = this.views[i];
      v.team = this.team;
      v.weapon = m.weapon;
      v.skin = m.skin;
      v.x = x;
      v.z = z;
      v.yaw = ((yaw + Math.sin(this.t * 0.21 + i * 1.7) * 3) * Math.PI) / 180;
      // respiração e olhar levemente diferentes para cada um
      v.pitch = -0.05 + Math.sin(this.t * (1.5 + i * 0.13) + i) * 0.02;
      c.update(dt, v, 0);
    }
    // câmera: entrada suave, leve deriva; perfil aproxima do jogador
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 3);
    const z = this.zoom;
    const meX = SLOTS[Math.max(0, this.squad.findIndex(m => m.me))][0];
    // telas largas (celular deitado): o esquadrão vai mais para a direita, livre do painel da esquerda
    const aspect = this.scene.getEngine().getRenderWidth() / Math.max(1, this.scene.getEngine().getRenderHeight());
    const base = 1.0 + Math.max(0, aspect - 1.78) * 1.1;
    const tx = base + (meX - base) * z;
    this.camera.position.set(tx + Math.sin(this.t * 0.11) * 0.12, 1.15 + Math.sin(this.t * 0.17) * 0.03 + z * 0.2, 5.0 - z * 2.1 + (1 - e) * 1.6);
    this.camera.setTarget(new Vector3(tx, 1.05 + z * 0.25, 0));
    for (const l of this.lights) l.light.intensity = l.base * (0.95 + Math.sin(this.t * 6 + l.phase) * 0.02 + Math.sin(this.t * 11.7 + l.phase) * 0.03);
    this.scene.render();
    // posição das plaquinhas de nome (altura dos joelhos de cada integrante)
    const eng = this.scene.getEngine();
    const w = eng.getRenderWidth(), h = eng.getRenderHeight();
    const vp = this.camera.viewport.toGlobal(w, h);
    const tm = this.scene.getTransformMatrix();
    const cssW = eng.getRenderingCanvas()?.clientWidth ?? w, cssH = eng.getRenderingCanvas()?.clientHeight ?? h;
    for (let i = 0; i < SLOTS.length; i++) {
      const [x, zz] = SLOTS[i];
      const p = Vector3.Project(new Vector3(x, 0.6, zz + 0.3), Matrix.Identity(), tm, vp);
      this.plates[i].x = (p.x / w) * cssW;
      this.plates[i].y = (p.y / h) * cssH;
      this.plates[i].visible = !!this.squad[i] && p.z > 0 && p.z < 1;
    }
  }

  dispose(): void {
    this.post.dispose();
    for (const c of this.chars) c?.dispose();
    this.scene.dispose();
  }
}

