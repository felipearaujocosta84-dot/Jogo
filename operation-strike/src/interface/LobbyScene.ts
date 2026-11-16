// Lobby 3D: o "esconderijo" do esquadrão — sala de tijolos à noite com sofá, estante, mesa com luminária e monitor,
// cartazes e letreiro de néon próprios, porta com placa de saída, tapete e luz quente + néon roxo/ciano.
// O jogador fica no centro; à esquerda e à direita, círculos de convite ("+") para o modo online.
// Usa o mesmo motor do jogo (outra cena): nenhum contexto WebGL extra no celular. Tudo gerado por código.
import {
  Color3,
  Color4,
  CreateBox,
  CreateCylinder,
  CreatePlane,
  CreateSphere,
  PointLight,
  DirectionalLight,
  FreeCamera,
  HemisphericLight,
  Matrix,
  Mesh,
  PBRMaterial,
  ParticleSystem,
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
  /** Acessórios da arma e visual do personagem (ver cosmetics/Cosmetics.ts). */
  att?: string;
  look?: string;
  /** O próprio jogador (fica em destaque). */
  me?: boolean;
  /** Lugar vago: mostra o círculo de convite em vez de um personagem. */
  invite?: boolean;
}

/** Posições (x, z, yaw em graus): o jogador no centro, convites/companheiros nos lados. */
const SLOTS: [number, number, number][] = [[-1.3, 0.75, 14], [0.0, 0.2, 0], [1.3, 0.75, -14], [3.2, 0.0, -18]];

export class LobbyScene {
  readonly scene: Scene;
  private camera: FreeCamera;
  private chars: (CharacterModel | null)[] = [null, null, null, null];
  private charKeys = ['', '', '', ''];
  private shadow: ShadowGenerator | null = null;
  private post: PostFx;
  private t = 0;
  private lights: { light: { intensity: number }; base: number; phase: number }[] = [];
  private invitePads: Mesh[] = [];
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
    scene.clearColor = new Color4(0.02, 0.02, 0.03, 1);
    scene.ambientColor = new Color3(0.1, 0.09, 0.12);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.03;
    scene.fogColor = new Color3(0.05, 0.04, 0.07);
    scene.skipPointerMovePicking = true;
    applyStudioEnvironment(scene, '#4a3b5c', '#2a2230', '#0e0b0c');

    const cam = new FreeCamera('lobbyCam', new Vector3(0, 1.25, 4.6), scene);
    cam.minZ = 0.05;
    cam.maxZ = 40;
    cam.fov = 0.8;
    cam.setTarget(new Vector3(0, 1.1, 0));
    this.camera = cam;

    // luz: ambiente fraco arroxeado, luz principal na frente (sombra), luminária quente à esquerda,
    // néon roxo/ciano atrás (recorte) e uma luz fria vinda da porta à direita
    const hemi = new HemisphericLight('lobbyHemi', new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.35;
    hemi.diffuse = new Color3(0.62, 0.55, 0.75);
    hemi.groundColor = new Color3(0.08, 0.06, 0.07);
    const key = new DirectionalLight('lobbyKey', new Vector3(0.25, -0.7, -0.65), scene);
    key.position = new Vector3(-2, 6, 6);
    key.intensity = 0.9;
    key.diffuse = new Color3(1, 0.93, 0.85);
    const front = new SpotLight('lobbyFront', new Vector3(0.4, 3.6, 4.2), new Vector3(-0.08, -0.55, -0.85), 0.9, 4, scene);
    front.intensity = 70;
    front.diffuse = new Color3(1, 0.92, 0.82);
    front.range = 12;
    const lamp = new PointLight('lobbyLamp', new Vector3(-2.65, 1.35, -0.9), scene);
    lamp.diffuse = new Color3(1, 0.62, 0.3);
    lamp.intensity = 6;
    lamp.range = 6;
    this.lights.push({ light: lamp, base: 6, phase: 1.3 });
    const neonL = new PointLight('lobbyNeon', new Vector3(0.4, 2.7, -2.2), scene);
    neonL.diffuse = new Color3(0.75, 0.3, 1);
    neonL.intensity = 5;
    neonL.range = 7;
    this.lights.push({ light: neonL, base: 5, phase: 4.1 });
    const door = new SpotLight('lobbyDoor', new Vector3(3.4, 2.5, -1.8), new Vector3(-0.8, -0.35, 0.5), 1.2, 3, scene);
    door.diffuse = new Color3(0.45, 0.75, 1);
    door.intensity = 35;
    door.range = 8;
    if (preset.shadows) {
      const sg = new ShadowGenerator(Math.min(2048, preset.shadowMapSize || 1024), key);
      sg.useBlurExponentialShadowMap = true;
      sg.blurKernel = 16;
      sg.depthScale = 60;
      this.shadow = sg;
    }

    this.buildRoom();
    this.buildFurniture();
    this.buildArt();
    this.buildPads();
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

  private buildRoom(): void {
    const s = this.scene;
    // piso de concreto polido, paredes de tijolo, teto escuro com canos e vigas
    const floor = this.place(CreateBox('lobbyFloor', { width: 9, height: 0.2, depth: 8 }, s), false);
    floor.position.set(0, -0.1, 0.6);
    floor.material = this.mat('concrete', 3, '#6d6a67', 0, 0.45);
    const brick = this.mat('brick', 2.2, '#9b8f88');
    const back = this.place(CreateBox('lobbyWallBack', { width: 9, height: 4, depth: 0.2 }, s), false);
    back.position.set(0, 2, -2.6);
    back.material = brick;
    for (const sx of [-1, 1]) {
      const side = this.place(CreateBox('lobbyWallSide', { width: 0.2, height: 4, depth: 8 }, s), false);
      side.position.set(sx * 4.5, 2, 0.6);
      side.material = brick;
    }
    const ceil = this.place(CreateBox('lobbyCeil', { width: 9, height: 0.2, depth: 8 }, s), false);
    ceil.position.set(0, 4.05, 0.6);
    ceil.material = this.plain('#141316', 0.2, 0.8);
    const pipe = this.plain('#3a3c40', 0.8, 0.4);
    for (const [z, d] of [[-2.2, 0.16], [-1.9, 0.1], [1.2, 0.12]] as const) {
      const p = this.place(CreateCylinder('lobbyPipe', { diameter: d, height: 9, tessellation: 14 }, s));
      p.rotation.z = Math.PI / 2;
      p.position.set(0, 3.7 - d, z);
      p.material = pipe;
    }
    const beam = this.plain('#1d1d20', 0.6, 0.55);
    for (const x of [-2.8, 0, 2.8]) {
      const b = this.place(CreateBox('lobbyBeam', { width: 0.22, height: 0.3, depth: 8 }, s));
      b.position.set(x, 3.8, 0.6);
      b.material = beam;
    }
    // rodapé e tomadas
    const base = this.plain('#1a1918', 0, 0.6);
    const sk = this.place(CreateBox('lobbySkirt', { width: 9, height: 0.12, depth: 0.04 }, s), false);
    sk.position.set(0, 0.06, -2.49);
    sk.material = base;
    // tapete
    const rugTex = paintedTexture(s, 'lobbyRug', 256, (g, n) => {
      g.fillStyle = '#2a1820';
      g.fillRect(0, 0, n, n);
      g.strokeStyle = '#7a3b2e';
      g.lineWidth = n * 0.04;
      g.strokeRect(n * 0.06, n * 0.06, n * 0.88, n * 0.88);
      g.strokeStyle = '#b07a3c';
      g.lineWidth = n * 0.012;
      g.strokeRect(n * 0.12, n * 0.12, n * 0.76, n * 0.76);
      for (let i = 0; i < 6; i++) {
        g.save();
        g.translate(n / 2, n / 2);
        g.rotate((i * Math.PI) / 3);
        g.fillStyle = 'rgba(176,122,60,0.35)';
        g.fillRect(-n * 0.02, -n * 0.3, n * 0.04, n * 0.6);
        g.restore();
      }
      for (let i = 0; i < 4000; i++) {
        g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
        g.fillRect(Math.random() * n, Math.random() * n, 1, 1);
      }
    });
    const rugMat = new StandardMaterial('lobbyRugMat', s);
    rugMat.diffuseTexture = rugTex;
    rugMat.specularColor = Color3.Black();
    const rug = this.place(CreateBox('lobbyRug', { width: 3.4, height: 0.02, depth: 2.2 }, s), false);
    rug.position.set(0.9, 0.01, -0.3);
    rug.material = rugMat;
  }

  private buildFurniture(): void {
    const s = this.scene;
    // sofá de couro escuro à esquerda
    const leather = this.plain('#2b1b16', 0.1, 0.42);
    const sofa: [number, number, number, number, number, number][] = [
      [-2.7, 0.25, -1.6, 2.1, 0.45, 0.9], [-2.7, 0.75, -2.0, 2.1, 0.6, 0.22], [-3.68, 0.5, -1.6, 0.24, 0.55, 0.9], [-1.72, 0.5, -1.6, 0.24, 0.55, 0.9]
    ];
    for (const [x, y, z, w, h, d] of sofa) {
      const p = this.place(CreateBox('lobbySofa', { width: w, height: h, depth: d }, s));
      p.position.set(x, y, z);
      p.material = leather;
    }
    const cushion = this.plain('#4a2e22', 0, 0.6);
    for (const x of [-3.15, -2.25]) {
      const c = this.place(CreateBox('lobbyCushion', { width: 0.85, height: 0.14, depth: 0.7 }, s));
      c.position.set(x, 0.55, -1.52);
      c.material = cushion;
    }
    // mesa de centro com caixa de munição e luminária
    const wood = this.mat('crate', 1, '#8a6a4a');
    const table = this.place(CreateBox('lobbyTable', { width: 1.3, height: 0.08, depth: 0.7 }, s));
    table.position.set(-2.2, 0.45, -0.4);
    table.material = wood;
    const leg = this.plain('#1f1f22', 0.7, 0.4);
    for (const [dx, dz] of [[-0.58, -0.28], [0.58, -0.28], [-0.58, 0.28], [0.58, 0.28]]) {
      const l = this.place(CreateBox('lobbyLeg', { width: 0.05, height: 0.42, depth: 0.05 }, s));
      l.position.set(-2.2 + dx, 0.21, -0.4 + dz);
      l.material = leg;
    }
    const ammo = this.place(CreateBox('lobbyAmmo', { width: 0.36, height: 0.2, depth: 0.2 }, s));
    ammo.position.set(-2.0, 0.59, -0.35);
    ammo.material = this.plain('#3f4a2c', 0.2, 0.6);
    // luminária com cúpula acesa
    const lampPole = this.place(CreateCylinder('lobbyLampPole', { diameter: 0.03, height: 0.55, tessellation: 8 }, s));
    lampPole.position.set(-2.65, 0.77, -0.6);
    lampPole.material = leg;
    const shade = CreateCylinder('lobbyLampShade', { diameterTop: 0.16, diameterBottom: 0.3, height: 0.22, tessellation: 20 }, s);
    shade.position.set(-2.65, 1.12, -0.6);
    shade.material = this.plain('#000000', 0, 1, '#ffb066');
    shade.isPickable = false;
    // estante de metal com caixas e capacetes
    const shelf = this.plain('#2c2e31', 0.7, 0.45);
    for (const y of [0.05, 0.6, 1.15, 1.7]) {
      const b = this.place(CreateBox('lobbyShelf', { width: 1.5, height: 0.04, depth: 0.45 }, s));
      b.position.set(-3.5, y, -2.25);
      b.material = shelf;
    }
    for (const x of [-4.22, -2.78]) {
      const p = this.place(CreateBox('lobbyShelfPost', { width: 0.04, height: 1.8, depth: 0.45 }, s));
      p.position.set(x, 0.9, -2.25);
      p.material = shelf;
    }
    const boxes: [number, number, string][] = [[-3.9, 0.22, '#5d4a2e'], [-3.35, 0.22, '#3b4630'], [-3.75, 0.77, '#2f3a44'], [-3.1, 0.77, '#6b5536'], [-3.6, 1.32, '#45392a']];
    for (const [x, y, c] of boxes) {
      const b = this.place(CreateBox('lobbyBox', { width: 0.42, height: 0.3, depth: 0.34 }, s));
      b.position.set(x, y, -2.25);
      b.material = this.mat('crate', 1, c);
    }
    const helm = this.place(CreateSphere('lobbyHelmet', { diameter: 0.3, slice: 0.5, segments: 16 }, s));
    helm.position.set(-3.1, 1.32, -2.25);
    helm.material = this.plain('#4b5236', 0.1, 0.55);
    // mesa de trabalho à direita com monitor aceso e cadeira
    const desk = this.place(CreateBox('lobbyDesk', { width: 1.5, height: 0.06, depth: 0.7 }, s));
    desk.position.set(3.3, 0.78, -1.9);
    desk.material = wood;
    for (const dx of [-0.68, 0.68]) {
      const l = this.place(CreateBox('lobbyDeskLeg', { width: 0.05, height: 0.76, depth: 0.6 }, s));
      l.position.set(3.3 + dx, 0.38, -1.9);
      l.material = leg;
    }
    const screenTex = paintedTexture(s, 'lobbyScreen', 256, (g, n) => {
      const grd = g.createLinearGradient(0, 0, 0, n);
      grd.addColorStop(0, '#0b2a3a');
      grd.addColorStop(1, '#06121a');
      g.fillStyle = grd;
      g.fillRect(0, 0, n, n);
      g.strokeStyle = '#3fe0ff';
      g.lineWidth = 2;
      g.strokeRect(n * 0.08, n * 0.12, n * 0.5, n * 0.5);
      g.beginPath();
      g.arc(n * 0.33, n * 0.37, n * 0.18, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#3fe0ff';
      for (let i = 0; i < 7; i++) g.fillRect(n * 0.64, n * (0.14 + i * 0.07), n * (0.12 + Math.random() * 0.18), n * 0.025);
      g.fillStyle = '#ffb347';
      g.fillRect(n * 0.08, n * 0.72, n * 0.84, n * 0.03);
    });
    const scrMat = new StandardMaterial('lobbyScreenMat', s);
    scrMat.emissiveTexture = screenTex;
    scrMat.diffuseColor = Color3.Black();
    scrMat.specularColor = Color3.Black();
    const mon = this.place(CreateBox('lobbyMonitor', { width: 0.8, height: 0.5, depth: 0.05 }, s));
    mon.position.set(3.2, 1.15, -2.15);
    mon.material = this.plain('#111113', 0.3, 0.4);
    const scr = CreatePlane('lobbyScreen', { width: 0.74, height: 0.44 }, s);
    scr.position.set(3.2, 1.15, -2.12);
    scr.rotation.y = Math.PI;
    scr.material = scrMat;
    scr.isPickable = false;
    const chair = this.plain('#7a1f22', 0.1, 0.5);
    const seat = this.place(CreateBox('lobbyChair', { width: 0.5, height: 0.08, depth: 0.5 }, s));
    seat.position.set(3.0, 0.5, -1.2);
    seat.material = chair;
    const backrest = this.place(CreateBox('lobbyChairBack', { width: 0.5, height: 0.55, depth: 0.06 }, s));
    backrest.position.set(3.0, 0.8, -0.97);
    backrest.material = chair;
    const cpole = this.place(CreateCylinder('lobbyChairPole', { diameter: 0.05, height: 0.45, tessellation: 8 }, s));
    cpole.position.set(3.0, 0.24, -1.2);
    cpole.material = leg;
    // porta de metal com placa de saída
    const doorM = this.place(CreateBox('lobbyDoor', { width: 1.05, height: 2.15, depth: 0.08 }, s), false);
    doorM.position.set(1.95, 1.07, -2.47);
    doorM.material = this.plain('#3a2422', 0.5, 0.5);
    const frame = this.plain('#141414', 0.6, 0.5);
    for (const [x, y, w, h] of [[1.38, 1.1, 0.08, 2.25], [2.52, 1.1, 0.08, 2.25], [1.95, 2.22, 1.22, 0.08]] as const) {
      const f = this.place(CreateBox('lobbyDoorFrame', { width: w, height: h, depth: 0.12 }, s), false);
      f.position.set(x, y, -2.46);
      f.material = frame;
    }
    const exitTex = paintedTexture(s, 'lobbyExit', 128, (g, n) => {
      g.fillStyle = '#b01818';
      g.fillRect(0, n * 0.25, n, n * 0.5);
      g.fillStyle = '#fff';
      g.font = `bold ${n * 0.28}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('SAÍDA', n / 2, n / 2 + 2);
    });
    const exitMat = new StandardMaterial('lobbyExitMat', s);
    exitMat.emissiveTexture = exitTex;
    exitMat.opacityTexture = exitTex;
    exitMat.disableLighting = true;
    const ex = CreatePlane('lobbyExitSign', { width: 0.5, height: 0.5 }, s);
    ex.position.set(1.95, 2.55, -2.48);
    ex.rotation.y = Math.PI;
    ex.material = exitMat;
    ex.isPickable = false;
    // lâmpadas penduradas
    const bulbMat = this.plain('#000000', 0, 1, '#ffd29a');
    for (const [x, z] of [[-1.6, -0.6], [1.7, 0.4]] as const) {
      const wire = this.place(CreateCylinder('lobbyWire', { diameter: 0.01, height: 0.9, tessellation: 4 }, s), false);
      wire.position.set(x, 3.5, z);
      wire.material = leg;
      const b = CreateSphere('lobbyBulb', { diameter: 0.1, segments: 10 }, s);
      b.position.set(x, 3.02, z);
      b.material = bulbMat;
      b.isPickable = false;
    }
  }

  /** Cartazes e letreiro de néon (arte própria). */
  private buildArt(): void {
    const s = this.scene;
    const poster = (name: string, x: number, y: number, w: number, h: number, paint: (g: CanvasRenderingContext2D, n: number) => void, wall: 'back' | 'left' | 'right' = 'back') => {
      const tex = paintedTexture(s, name, 512, paint);
      tex.hasAlpha = false;
      const m = new StandardMaterial(name + 'Mat', s);
      m.diffuseTexture = tex;
      m.emissiveColor = new Color3(0.12, 0.1, 0.1);
      m.specularColor = new Color3(0.05, 0.05, 0.05);
      const p = CreatePlane(name, { width: w, height: h }, s);
      if (wall === 'back') {
        p.position.set(x, y, -2.48);
        p.rotation.y = Math.PI;
      } else {
        p.position.set(wall === 'left' ? -4.38 : 4.38, y, x);
        p.rotation.y = wall === 'left' ? -Math.PI / 2 : Math.PI / 2;
      }
      p.material = m;
      p.isPickable = false;
      p.receiveShadows = !!this.shadow;
    };
    const grunge = (g: CanvasRenderingContext2D, n: number) => {
      for (let i = 0; i < 1800; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,240,220'},${Math.random() * 0.12})`;
        g.fillRect(Math.random() * n, Math.random() * n, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(n * 0.1, 0);
      g.lineTo(n * 0.18, n);
      g.stroke();
    };
    // cartaz da equipe: silhueta de soldado com mira, título e faixas
    poster('lobbyPoster1', -1.15, 2.05, 1.0, 1.45, (g, n) => {
      const grd = g.createLinearGradient(0, 0, 0, n);
      grd.addColorStop(0, '#d8572a');
      grd.addColorStop(1, '#3a1410');
      g.fillStyle = grd;
      g.fillRect(0, 0, n, n);
      g.fillStyle = '#120a08';
      g.beginPath();
      g.arc(n * 0.5, n * 0.3, n * 0.11, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(n * 0.24, n * 0.95);
      g.lineTo(n * 0.3, n * 0.48);
      g.quadraticCurveTo(n * 0.5, n * 0.38, n * 0.7, n * 0.48);
      g.lineTo(n * 0.76, n * 0.95);
      g.fill();
      g.fillRect(n * 0.55, n * 0.52, n * 0.38, n * 0.05);
      g.strokeStyle = '#ffd36b';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(n * 0.5, n * 0.3, n * 0.2, 0, Math.PI * 2);
      g.moveTo(n * 0.5, n * 0.04);
      g.lineTo(n * 0.5, n * 0.56);
      g.moveTo(n * 0.24, n * 0.3);
      g.lineTo(n * 0.76, n * 0.3);
      g.stroke();
      g.fillStyle = '#ffe9c4';
      g.font = `900 ${n * 0.1}px sans-serif`;
      g.textAlign = 'center';
      g.fillText('STRIKE', n / 2, n * 0.9);
      grunge(g, n);
    });
    // cartaz "procurado" de recrutamento
    poster('lobbyPoster2', 0.95, 2.15, 0.85, 1.15, (g, n) => {
      g.fillStyle = '#d9c7a1';
      g.fillRect(0, 0, n, n);
      g.fillStyle = '#2a1d14';
      g.font = `900 ${n * 0.13}px serif`;
      g.textAlign = 'center';
      g.fillText('RECRUTA-SE', n / 2, n * 0.16);
      g.fillStyle = '#6b1d16';
      g.fillRect(n * 0.12, n * 0.22, n * 0.76, n * 0.5);
      g.fillStyle = '#d9c7a1';
      g.beginPath();
      g.moveTo(n * 0.5, n * 0.28);
      g.lineTo(n * 0.78, n * 0.38);
      g.lineTo(n * 0.7, n * 0.62);
      g.lineTo(n * 0.5, n * 0.68);
      g.lineTo(n * 0.3, n * 0.62);
      g.lineTo(n * 0.22, n * 0.38);
      g.closePath();
      g.fill();
      g.fillStyle = '#6b1d16';
      g.font = `900 ${n * 0.16}px sans-serif`;
      g.fillText('OS', n / 2, n * 0.56);
      g.fillStyle = '#2a1d14';
      g.font = `700 ${n * 0.07}px sans-serif`;
      g.fillText('ESQUADRÃO DE ELITE', n / 2, n * 0.82);
      g.fillText('APRESENTE-SE NA BASE', n / 2, n * 0.92);
      grunge(g, n);
    });
    // mapa tático na parede esquerda
    poster('lobbyMap', -0.6, 1.9, 1.5, 1.0, (g, n) => {
      g.fillStyle = '#1d2a33';
      g.fillRect(0, 0, n, n);
      g.strokeStyle = 'rgba(120,180,210,0.35)';
      g.lineWidth = 1;
      for (let i = 0; i < n; i += n / 16) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i, n); g.stroke();
        g.beginPath(); g.moveTo(0, i); g.lineTo(n, i); g.stroke();
      }
      g.fillStyle = 'rgba(200,170,120,0.55)';
      for (const [x, y, w, h] of [[0.1, 0.2, 0.3, 0.2], [0.5, 0.15, 0.35, 0.3], [0.2, 0.55, 0.25, 0.3], [0.6, 0.6, 0.3, 0.25]]) g.fillRect(x * n, y * n, w * n, h * n);
      g.strokeStyle = '#ff3b3b';
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(n * 0.15, n * 0.85); g.bezierCurveTo(n * 0.4, n * 0.5, n * 0.5, n * 0.45, n * 0.75, n * 0.3); g.stroke();
      g.fillStyle = '#ff3b3b';
      g.font = `900 ${n * 0.12}px sans-serif`;
      g.fillText('A', n * 0.68, n * 0.28);
      g.fillText('B', n * 0.25, n * 0.72);
    }, 'left');
    // letreiro de néon na parede do fundo
    const neonTex = paintedTexture(s, 'lobbyNeonSign', 512, (g, n) => {
      g.clearRect(0, 0, n, n);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const glow = (txt: string, y: number, size: number, col: string) => {
        g.font = `italic 900 ${size}px sans-serif`;
        g.shadowColor = col;
        for (const b of [30, 16, 6]) {
          g.shadowBlur = b;
          g.fillStyle = col;
          g.fillText(txt, n / 2, y);
        }
        g.shadowBlur = 0;
        g.fillStyle = '#fff6ff';
        g.fillText(txt, n / 2, y);
      };
      glow('OPERATION', n * 0.38, n * 0.13, '#c04dff');
      glow('STRIKE', n * 0.6, n * 0.2, '#3fe7ff');
    });
    const neonMat = new StandardMaterial('lobbyNeonMat', s);
    neonMat.emissiveTexture = neonTex;
    neonMat.opacityTexture = neonTex;
    neonMat.disableLighting = true;
    neonMat.fogEnabled = false;
    const neon = CreatePlane('lobbyNeonSign', { width: 2.2, height: 2.2 }, s);
    neon.position.set(0.0, 2.85, -2.47);
    neon.rotation.y = Math.PI;
    neon.material = neonMat;
    neon.isPickable = false;
  }

  /** Círculos no chão: o do jogador e os de convite (com "+"). */
  private buildPads(): void {
    const s = this.scene;
    const padTex = paintedTexture(s, 'lobbyPad', 256, (g, n) => {
      g.clearRect(0, 0, n, n);
      const grd = g.createRadialGradient(n / 2, n / 2, n * 0.3, n / 2, n / 2, n / 2);
      grd.addColorStop(0, 'rgba(90,230,200,0.05)');
      grd.addColorStop(0.75, 'rgba(90,230,200,0.35)');
      grd.addColorStop(1, 'rgba(90,230,200,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, n, n);
      g.strokeStyle = 'rgba(140,255,225,0.9)';
      g.lineWidth = n * 0.02;
      g.beginPath();
      g.arc(n / 2, n / 2, n * 0.42, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = n * 0.008;
      g.beginPath();
      g.arc(n / 2, n / 2, n * 0.34, 0, Math.PI * 2);
      g.stroke();
    });
    const plusTex = paintedTexture(s, 'lobbyPlus', 128, (g, n) => {
      g.clearRect(0, 0, n, n);
      g.fillStyle = 'rgba(200,255,240,0.95)';
      g.fillRect(n * 0.44, n * 0.15, n * 0.12, n * 0.7);
      g.fillRect(n * 0.15, n * 0.44, n * 0.7, n * 0.12);
    });
    const padMat = new StandardMaterial('lobbyPadMat', s);
    padMat.emissiveTexture = padTex;
    padMat.opacityTexture = padTex;
    padMat.disableLighting = true;
    padMat.alphaMode = 1;
    padMat.disableDepthWrite = true;
    const plusMat = new StandardMaterial('lobbyPlusMat', s);
    plusMat.emissiveTexture = plusTex;
    plusMat.opacityTexture = plusTex;
    plusMat.disableLighting = true;
    plusMat.alphaMode = 1;
    plusMat.backFaceCulling = false;
    for (let i = 0; i < 3; i++) {
      const [x, z] = SLOTS[i];
      const pad = CreatePlane('lobbyPad', { size: i === 1 ? 1.5 : 1.2 }, s);
      pad.rotation.x = Math.PI / 2;
      pad.position.set(x, 0.02, z);
      pad.material = padMat;
      pad.isPickable = false;
      if (i === 1) continue;
      this.invitePads.push(pad);
    }
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
    ps.emitter = new Vector3(0, 2, 0);
    ps.minEmitBox = new Vector3(-4, -1.9, -2.4);
    ps.maxEmitBox = new Vector3(4, 1.8, 3);
    ps.color1 = new Color4(1, 0.85, 0.7, 0.3);
    ps.color2 = new Color4(0.8, 0.7, 1, 0.18);
    ps.colorDead = new Color4(0.8, 0.7, 1, 0);
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
      const key = m && !m.invite ? this.team + loaded + (CharacterModel.pbr ? 'p' : 's') + i : '';
      if (key !== this.charKeys[i]) {
        this.chars[i]?.dispose();
        this.chars[i] = null;
        this.charKeys[i] = key;
        if (m && !m.invite) {
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
      if (!c || !m || m.invite) continue;
      const [x, z, yaw] = SLOTS[i];
      const v = this.views[i];
      v.team = this.team;
      v.weapon = m.weapon;
      v.skin = m.skin;
      v.att = m.att ?? '';
      v.look = m.look ?? '';
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
    // o jogador no centro, entre os painéis da esquerda e da direita
    for (const [k, pad] of this.invitePads.entries()) pad.scaling.setAll(1 + Math.sin(this.t * 2 + k) * 0.04);
    this.camera.position.set(Math.sin(this.t * 0.11) * 0.1, 1.3 + Math.sin(this.t * 0.17) * 0.03 - z * 0.05, 4.4 - z * 1.9 + (1 - e) * 1.4);
    this.camera.setTarget(new Vector3(0, 1.08 + z * 0.3, 0));
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
      const inv = !!this.squad[i]?.invite;
      const p = Vector3.Project(new Vector3(x, inv ? 0.75 : 2.0, zz), Matrix.Identity(), tm, vp);
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

