// Tela de CUSTOMIZAÇÃO (abre pelos botões ARSENAL e INVENTÁRIO do menu):
//  - PERSONAGEM: soldado/terrorista em 3D (girar, aproximar), peça por peça — capacete, máscara, óculos, colete,
//    uniforme, calças, luvas, botas, mochila e acessórios — com pré-visualização antes de equipar;
//  - ARSENAL: arma em 3D com skins (por raridade) e acessórios (mira, cano, empunhadura, lanterna, laser,
//    carregador) só dos que a arma aceita; modo COMPARAR mostra a equipada e a prévia lado a lado;
//  - INVENTÁRIO: armas, skins, uniformes, capacetes, equipamentos e acessórios — filtrar, ordenar, visualizar,
//    equipar e remover;
//  - RECURSOS 3D: o que foi encontrado em public/assets e o que falta.
// O motor 3D desta tela só existe enquanto ela está aberta (memória liberada ao sair). Tudo é salvo no aparelho.
import {
  ArcRotateCamera,
  Color3,
  Color4,
  CreateCylinder,
  DirectionalLight,
  Engine,
  HemisphericLight,
  PBRMaterial,
  Scene,
  TransformNode,
  Vector3
} from '../core/babylon';
import { applyStudioEnvironment } from '../core/Environment';
import { WeaponLibrary } from '../weapons/WeaponLibrary';
import { buildGun } from '../weapons/WeaponModels';
import { attachToGun } from '../weapons/WeaponAttachments';
import { BUY_CATEGORIES, CLASS_LABEL, WEAPONS, effectiveRange } from '../weapons/WeaponData';
import { SKINS, skinById } from '../weapons/Skins';
import { RARITIES, RARITY_COLOR, RARITY_LABEL, rarityRank, type Rarity } from '../cosmetics/Rarity';
import {
  ATTACHMENTS,
  ATTACH_SLOTS,
  CHAR_SLOTS,
  FINISHES,
  GEAR,
  INTEGRATED,
  WEAPON_ATTACH,
  attachmentById,
  encodeLook,
  finishOf,
  gearById,
  itemsFor,
  type AttachSlot,
  type CharSlot,
  type Look
} from '../cosmetics/Cosmetics';
import { seamlessPattern, skinSwatch } from '../weapons/SkinPatterns';
import { SkinPrefs } from '../save/SkinPrefs';
import { REQUIRED_WEAPONS, WEAPON_MODELS, HANDS_MODEL, assetReport, type AssetReport } from '../assets/AssetRegistry';
import { CharacterModel } from '../player/Character';
import { CHARACTER_FILES, loadCharacters } from '../player/CharacterAssets';
import type { PlayerView, Team } from '../sim/types';
import { esc } from './Hud';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const ARSENAL_WEAPONS = [...BUY_CATEGORIES.filter(c => c.id !== 'grenade' && c.id !== 'gear').flatMap(c => c.items), 'knife'];

type Tab = 'character' | 'weapons' | 'inventory' | 'assets';
type InvFilter = 'all' | 'weapons' | 'skins' | 'uniforms' | 'helmets' | 'equipment' | 'accessories';

/** Ícones das partes (vetoriais, só para a lista). */
const SLOT_ICON: Record<CharSlot, string> = {
  helmet: '<path d="M4 15a8 8 0 0 1 16 0v2H4z"/><path d="M2 17h20"/>',
  mask: '<path d="M5 9h14v4a7 7 0 0 1-14 0z"/><path d="M9 13h6"/>',
  glasses: '<circle cx="7" cy="12" r="3.5"/><circle cx="17" cy="12" r="3.5"/><path d="M10.5 12h3"/>',
  vest: '<path d="M7 3l-3 4v13h16V7l-3-4-2 3h-6z"/><path d="M8 12h8M8 16h8"/>',
  uniform: '<path d="M8 3l-5 4 3 4 2-1v11h8V10l2 1 3-4-5-4-2 2h-4z"/>',
  pants: '<path d="M6 3h12l1 18h-5l-2-11-2 11H5z"/>',
  gloves: '<path d="M7 21v-8l-2-3 1-1 3 2V4h2v7-8h2v8-7h2v8l2-3h2l-3 6v7z"/>',
  boots: '<path d="M7 3h6v10l6 3v5H5v-5l2-2z"/>',
  backpack: '<rect x="5" y="6" width="14" height="15" rx="3"/><path d="M9 6V4h6v2M8 13h8"/>',
  accessory: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'
};
const svg = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">${d}</svg>`;

const ATT_ICON: Record<AttachSlot, string> = {
  optic: '<rect x="4" y="8" width="16" height="7" rx="2"/><circle cx="12" cy="11.5" r="1.4"/>',
  muzzle: '<rect x="3" y="9" width="18" height="6" rx="3"/><path d="M8 9v6M13 9v6"/>',
  grip: '<path d="M7 6h10v3h-3v11h-4V9H7z"/>',
  light: '<rect x="3" y="9" width="12" height="6" rx="1"/><path d="M15 8l6-2v12l-6-2z"/>',
  laser: '<rect x="3" y="8" width="10" height="8" rx="1"/><path d="M13 12h8" stroke-dasharray="2 2"/>',
  mag: '<path d="M8 3h7l1 6-2 12H9L7 9z"/>'
};

const viewFor = (team: Team): PlayerView => ({
  id: 'custom', name: '', team, bot: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: -0.05,
  crouch: false, ground: true, alive: true, hp: 100, armor: 100, helmet: true, kit: false, money: 0, weapon: 'ak47',
  bomb: false, act: 0, kills: 0, deaths: 0, assists: 0, score: 0, mvps: 0, ping: 0, connected: true, variant: 0, skin: 'default'
});

/** Enquadramento da câmera por parte do corpo. */
const FRAME: Record<string, { target: [number, number, number]; radius: number; alpha: number }> = {
  body: { target: [0, 1.0, 0], radius: 3.3, alpha: Math.PI / 2 + 0.35 },
  head: { target: [0, 1.62, 0], radius: 1.05, alpha: Math.PI / 2 + 0.45 },
  torso: { target: [0, 1.25, 0], radius: 1.9, alpha: Math.PI / 2 + 0.3 },
  back: { target: [0, 1.25, 0], radius: 2.0, alpha: -Math.PI / 2 + 0.5 },
  legs: { target: [0, 0.55, 0], radius: 2.0, alpha: Math.PI / 2 + 0.3 },
  hands: { target: [0, 1.15, 0.15], radius: 1.4, alpha: Math.PI / 2 + 0.6 }
};
const SLOT_FRAME: Record<CharSlot, string> = {
  helmet: 'head', mask: 'head', glasses: 'head', vest: 'torso', uniform: 'torso', pants: 'legs', gloves: 'hands', boots: 'legs', backpack: 'back', accessory: 'body'
};

export class ArsenalScreen {
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private camera: ArcRotateCamera | null = null;
  private library: WeaponLibrary | null = null;
  private model: TransformNode | null = null;
  private compareModel: TransformNode | null = null;
  private plate: TransformNode | null = null;
  private weapon = 'ak47';
  /** Skin e acessórios em pré-visualização (podem ainda não estar equipados). */
  private preview = 'default';
  private previewAtt: string[] = [];
  private compare = false;
  private tab: Tab = 'character';
  private loadToken = 0;
  private report: AssetReport | null = null;
  // personagem
  team: Team = 'CT';
  private slot: CharSlot = 'helmet';
  private previewLook: Look | null = null;
  private char: CharacterModel | null = null;
  private charTeam: Team | null = null;
  private view: PlayerView = viewFor('CT');
  private camGoal: { target: Vector3; radius: number; alpha: number } | null = null;
  // inventário
  private invFilter: InvFilter = 'all';
  private invSort: 'rarity' | 'name' | 'level' = 'rarity';
  onEquip: () => void = () => {};
  /** Arma escolhida na tela (o lobby mostra o agente com ela). */
  onWeapon: (id: string) => void = () => {};
  onToast: (msg: string) => void = () => {};

  get weaponId(): string {
    return this.weapon;
  }

  /** Abre já na aba indicada e/ou com a arma indicada. */
  prepare(tab: Tab, weapon?: string): void {
    this.tab = tab;
    if (weapon) this.weapon = weapon;
  }

  constructor() {
    $('arsenalScreen').addEventListener('click', e => this.onClick(e));
    $('arsenalScreen').addEventListener('change', e => this.onChangeEvt(e));
    window.addEventListener('resize', () => this.engine?.resize());
  }

  // ================================================================== motor 3D

  open(): void {
    const canvas = $<HTMLCanvasElement>('arsCanvas');
    if (!this.engine) {
      this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, antialias: true, adaptToDeviceRatio: true });
      this.engine.disableManifestCheck = true;
      const scene = new Scene(this.engine);
      scene.clearColor = new Color4(0.035, 0.036, 0.04, 1);
      const cam = new ArcRotateCamera('arsCam', Math.PI / 2 + 0.35, 1.3, 3.2, new Vector3(0, 1, 0), scene);
      cam.minZ = 0.01;
      cam.lowerRadiusLimit = 0.25;
      cam.upperRadiusLimit = 6;
      cam.wheelPrecision = 90;
      cam.pinchPrecision = 220;
      cam.panningSensibility = 0;
      cam.useAutoRotationBehavior = true;
      if (cam.autoRotationBehavior) {
        cam.autoRotationBehavior.idleRotationSpeed = 0.25;
        cam.autoRotationBehavior.idleRotationWaitTime = 4000;
      }
      cam.attachControl(canvas, true);
      const hemi = new HemisphericLight('arsHemi', new Vector3(0, 1, 0), scene);
      hemi.intensity = 0.75;
      hemi.groundColor = new Color3(0.16, 0.14, 0.12);
      const key = new DirectionalLight('arsKey', new Vector3(-0.5, -0.8, -0.4), scene);
      key.intensity = 2.4;
      key.diffuse = new Color3(1, 0.95, 0.86);
      const rim = new DirectionalLight('arsRim', new Vector3(0.6, -0.25, 0.8), scene);
      rim.intensity = 1.3;
      rim.diffuse = new Color3(1, 0.82, 0.5);
      applyStudioEnvironment(scene, '#d8c9a6', '#6f6a60', '#1a1814');
      // base com aro dourado
      const plate = new TransformNode('arsPlateRoot', scene);
      const disc = CreateCylinder('arsPlate', { diameter: 1.6, height: 0.03, tessellation: 64 }, scene);
      const pm = new PBRMaterial('arsPlateMat', scene);
      pm.albedoColor = Color3.FromHexString('#0b0b0c');
      pm.metallic = 0.4;
      pm.roughness = 0.4;
      disc.material = pm;
      disc.parent = plate;
      const ring = CreateCylinder('arsRing', { diameter: 1.64, height: 0.012, tessellation: 64 }, scene);
      const gm = new PBRMaterial('arsRingMat', scene);
      gm.albedoColor = Color3.FromHexString('#c99a32').toLinearSpace();
      gm.metallic = 1;
      gm.roughness = 0.25;
      ring.material = gm;
      ring.parent = plate;
      ring.position.y = -0.006;
      this.plate = plate;
      this.scene = scene;
      this.camera = cam;
      this.library = WeaponLibrary.forScene(scene);
      let last = performance.now();
      scene.onBeforeRenderObservable.add(() => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this.char?.update(dt, this.view, 0);
        const g = this.camGoal;
        if (g && this.camera) {
          const k = Math.min(1, dt * 5);
          this.camera.target = Vector3.Lerp(this.camera.target, g.target, k);
          this.camera.radius += (g.radius - this.camera.radius) * k;
          this.camera.alpha += (g.alpha - this.camera.alpha) * k;
          if (Vector3.Distance(this.camera.target, g.target) < 0.002 && Math.abs(g.radius - this.camera.radius) < 0.003) this.camGoal = null;
        }
      });
    }
    this.engine.runRenderLoop(() => this.scene?.render());
    requestAnimationFrame(() => this.engine?.resize());
    this.preview = SkinPrefs.get(this.weapon);
    this.previewAtt = SkinPrefs.attachments(this.weapon);
    this.previewLook = null;
    this.render();
    this.showStage();
    void assetReport(SKINS.filter(s => s.folder).map(s => s.folder)).then(r => {
      this.report = r;
      this.render();
    });
  }

  close(): void {
    if (!this.engine) return;
    this.engine.stopRenderLoop();
    this.char?.dispose();
    this.char = null;
    this.charTeam = null;
    this.scene?.dispose();
    this.engine.dispose();
    this.engine = null;
    this.scene = null;
    this.camera = null;
    this.library = null;
    this.model = null;
    this.compareModel = null;
    this.plate = null;
  }

  /** Mostra o personagem (aba Personagem/Inventário de roupas) ou a arma. */
  private showStage(): void {
    if (!this.scene) return;
    if (this.tab === 'character') {
      this.model?.setEnabled(false);
      this.compareModel?.setEnabled(false);
      void this.showCharacter();
    } else {
      this.char?.root.setEnabled(false);
      void this.showModel();
    }
  }

  private frame(name: string): void {
    const f = FRAME[name] ?? FRAME.body;
    this.camGoal = { target: new Vector3(...f.target), radius: f.radius, alpha: f.alpha };
  }

  private async showCharacter(): Promise<void> {
    const scene = this.scene;
    if (!scene) return;
    $('arsBadge').textContent = 'Carregando personagem…';
    $('arsBadge').className = 'ars-badge';
    if (this.plate) {
      this.plate.position.set(0, -0.015, 0);
      this.plate.scaling.set(1.1, 1, 1.1);
    }
    if (!this.char || this.charTeam !== this.team) {
      await loadCharacters(scene, false);
      if (this.scene !== scene) return;
      this.char?.dispose();
      this.char = new CharacterModel(scene, this.team, 0, null);
      this.charTeam = this.team;
      this.view = viewFor(this.team);
    }
    this.char.root.setEnabled(true);
    const agentWeapon = this.weapon && WEAPONS[this.weapon]?.cls !== 'knife' ? this.weapon : this.team === 'T' ? 'ak47' : 'm4a4';
    this.view.weapon = agentWeapon;
    this.view.skin = SkinPrefs.get(agentWeapon);
    this.view.att = SkinPrefs.attachments(agentWeapon).join('.');
    this.view.look = encodeLook(this.previewLook ?? SkinPrefs.look(this.team));
    this.frame(SLOT_FRAME[this.slot]);
    $('arsBadge').textContent = `${CHARACTER_FILES[this.team].name} · modelo 3D original`;
    $('arsBadge').className = 'ars-badge ok';
  }

  private async buildGunModel(id: string, skin: string, att: string[]): Promise<{ root: TransformNode; glb: boolean } | null> {
    const scene = this.scene, lib = this.library;
    if (!scene || !lib) return null;
    const glb = (await lib.has(id)) ? await lib.instantiate(id, skin) : null;
    if (!this.scene) {
      glb?.root.dispose(false, false);
      return null;
    }
    if (glb) {
      for (const a of glb.animations) a.stop();
      if (att.length) await attachToGun(scene, { weapon: id, list: att, root: glb.root, meshes: glb.meshes, mag: glb.mag, muzzle: glb.muzzle, leftHand: glb.leftHand, cacheKey: 'glb|' + id, firstPerson: true });
      return { root: glb.root, glb: true };
    }
    const g = buildGun(id, scene, skin);
    const meshes = [g.body, g.mag, g.slide].filter(m => !!m) as NonNullable<typeof g.body>[];
    if (att.length) await attachToGun(scene, { weapon: id, list: att, root: g.root, meshes, mag: g.mag, muzzle: g.muzzle, leftHand: g.leftHand, cacheKey: 'proc|' + id, firstPerson: true });
    return { root: g.root, glb: false };
  }

  private async showModel(): Promise<void> {
    const scene = this.scene;
    if (!scene) return;
    const token = ++this.loadToken;
    const id = this.weapon, skin = this.preview, att = [...this.previewAtt];
    $('arsBadge').textContent = 'Carregando…';
    const built = await this.buildGunModel(id, skin, att);
    const cmp = this.compare && token === this.loadToken ? await this.buildGunModel(id, SkinPrefs.get(id), SkinPrefs.attachments(id)) : null;
    if (token !== this.loadToken || !this.scene || !built) {
      built?.root.dispose(false, false);
      cmp?.root.dispose(false, false);
      return;
    }
    this.model?.dispose(false, false);
    this.compareModel?.dispose(false, false);
    this.compareModel = null;
    const place = (root: TransformNode, y: number) => {
      const holder = new TransformNode('arsHolder', scene);
      root.parent = holder;
      root.computeWorldMatrix(true);
      // enquadra pela arma (o feixe do laser não conta)
      const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
      for (const m of root.getChildMeshes(false)) {
        if (m.name.startsWith('laserBeam')) continue;
        m.computeWorldMatrix(true);
        m.refreshBoundingInfo({});
        const bb = m.getBoundingInfo().boundingBox;
        min.minimizeInPlace(bb.minimumWorld);
        max.maximizeInPlace(bb.maximumWorld);
      }
      if (!isFinite(min.x)) min.setAll(-0.1), max.setAll(0.1);
      root.position.subtractInPlace(min.add(max).scale(0.5));
      holder.rotation.y = Math.PI / 2;
      holder.position.y = y;
      return { holder, size: max.subtract(min) };
    };
    const a = place(built.root, 0);
    const len = Math.max(a.size.x, a.size.y, a.size.z);
    const gap = Math.max(a.size.y * 1.6, 0.12);
    if (cmp) {
      a.holder.position.y = -gap / 2;
      const b = place(cmp.root, gap / 2);
      this.compareModel = b.holder;
    }
    this.model = a.holder;
    if (this.camera) {
      this.camGoal = { target: Vector3.Zero(), radius: Math.max(0.4, len * (cmp ? 1.45 : 1.25)), alpha: Math.PI / 2 + 0.35 };
      this.camera.target = Vector3.Zero();
    }
    if (this.plate) {
      this.plate.position.y = -a.size.y * 0.5 - (cmp ? gap / 2 : 0) - 0.04;
      this.plate.scaling.set(len * 0.42, 1, len * 0.42);
    }
    $('arsBadge').textContent = (cmp ? 'Em cima: equipada · embaixo: prévia · ' : '') + (built.glb ? 'Modelo 3D (GLB)' : `Modelo provisório — adicione ${WEAPON_MODELS[id] ?? id}`);
    $('arsBadge').className = 'ars-badge ' + (built.glb ? 'ok' : 'warn');
  }

  // ================================================================== ações

  private onChangeEvt(e: Event): void {
    const t = e.target as HTMLSelectElement;
    if (t.id === 'czSort') {
      this.invSort = t.value as typeof this.invSort;
      this.render();
    }
  }

  private onClick(e: Event): void {
    const t = e.target as HTMLElement;
    const tab = t.closest<HTMLElement>('[data-arstab]');
    if (tab) {
      const was = this.tab;
      this.tab = tab.dataset.arstab as Tab;
      this.render();
      if ((was === 'character') !== (this.tab === 'character')) this.showStage();
      return;
    }
    const v = t.closest<HTMLElement>('[data-czv]');
    if (v && this.camera) {
      const c = this.camera;
      const k = v.dataset.czv;
      this.camGoal = null;
      if (k === 'zin') c.radius = Math.max(c.lowerRadiusLimit ?? 0.2, c.radius * 0.82);
      else if (k === 'zout') c.radius = Math.min(c.upperRadiusLimit ?? 6, c.radius * 1.2);
      else if (k === 'left') c.alpha -= 0.45;
      else if (k === 'right') c.alpha += 0.45;
      else if (k === 'reset') this.tab === 'character' ? this.frame(SLOT_FRAME[this.slot]) : void this.showModel();
      else if (k === 'compare') {
        this.compare = !this.compare;
        this.render();
        void this.showModel();
      }
      return;
    }
    // ---------------------------------------------------------- personagem
    const team = t.closest<HTMLElement>('[data-czteam]');
    if (team) {
      this.team = team.dataset.czteam as Team;
      this.previewLook = null;
      this.render();
      void this.showCharacter();
      return;
    }
    const slot = t.closest<HTMLElement>('[data-czslot]');
    if (slot) {
      this.slot = slot.dataset.czslot as CharSlot;
      this.previewLook = null;
      this.render();
      void this.showCharacter();
      return;
    }
    const item = t.closest<HTMLElement>('[data-czitem]');
    if (item) {
      const look = { ...(this.previewLook ?? SkinPrefs.look(this.team)) };
      look[this.slot] = item.dataset.czitem!;
      this.previewLook = look;
      this.view.look = encodeLook(look);
      this.render();
      return;
    }
    if (t.closest('[data-czequip]')) {
      const id = (this.previewLook ?? SkinPrefs.look(this.team))[this.slot];
      const def = itemsFor(this.slot).find(i => i.id === id);
      if (!def) return;
      if (!SkinPrefs.setLookItem(this.team, this.slot, id)) return this.onToast(`${def.name} é liberado no nível ${def.level}`);
      this.previewLook = null;
      this.onEquip();
      this.onToast(`${CHAR_SLOTS.find(s => s.id === this.slot)!.name}: ${def.name} equipado`);
      return this.render();
    }
    if (t.closest('[data-czremove]')) {
      const def = this.slot in SkinPrefs.defaultLook ? SkinPrefs.defaultLook[this.slot] : 'orig';
      SkinPrefs.setLookItem(this.team, this.slot, def);
      this.previewLook = null;
      this.view.look = SkinPrefs.lookString(this.team);
      this.onEquip();
      return this.render();
    }
    if (t.closest('[data-czresetall]')) {
      SkinPrefs.resetLook(this.team);
      this.previewLook = null;
      this.view.look = '';
      this.onEquip();
      this.onToast('Visual original restaurado');
      return this.render();
    }
    // ---------------------------------------------------------- arsenal
    const w = t.closest<HTMLElement>('[data-arsw]');
    if (w) {
      this.weapon = w.dataset.arsw!;
      this.onWeapon(this.weapon);
      this.preview = SkinPrefs.get(this.weapon);
      this.previewAtt = SkinPrefs.attachments(this.weapon);
      this.tab = 'weapons';
      this.render();
      this.showStage();
      return;
    }
    const sk = t.closest<HTMLElement>('[data-arssk]');
    if (sk) {
      this.preview = sk.dataset.arssk!;
      this.render();
      void this.showModel();
      return;
    }
    const at = t.closest<HTMLElement>('[data-czatt]');
    if (at) {
      const [slotId, id] = at.dataset.czatt!.split(':') as [AttachSlot, string];
      this.previewAtt = this.previewAtt.filter(a => attachmentById(a)?.slot !== slotId);
      if (id) this.previewAtt.push(id);
      this.render();
      void this.showModel();
      return;
    }
    if (t.closest('[data-arsequip]')) {
      const def = skinById(this.preview);
      if (!SkinPrefs.set(this.weapon, def.id)) return this.onToast(`${def.name} é liberada no nível ${def.level}`);
      // acessórios da prévia
      let blocked = '';
      for (const s of ATTACH_SLOTS) {
        const want = this.previewAtt.find(a => attachmentById(a)?.slot === s.id);
        if (want) {
          if (!SkinPrefs.equipAttachment(this.weapon, want)) blocked = attachmentById(want)!.name;
        } else SkinPrefs.removeAttachment(this.weapon, s.id);
      }
      this.previewAtt = SkinPrefs.attachments(this.weapon);
      this.onEquip();
      this.onToast(blocked ? `${blocked} ainda está bloqueado` : `${WEAPONS[this.weapon]?.name}: ${def.name} e acessórios equipados`);
      this.render();
      void this.showModel();
      return;
    }
    if (t.closest('[data-arsrecheck]')) {
      this.report = null;
      this.render();
      void assetReport(SKINS.filter(s => s.folder).map(s => s.folder), true).then(r => {
        this.report = r;
        this.render();
        if (this.tab !== 'character') void this.showModel();
      });
      return;
    }
    // ---------------------------------------------------------- inventário
    const f = t.closest<HTMLElement>('[data-czf]');
    if (f) {
      this.invFilter = f.dataset.czf as InvFilter;
      return this.render();
    }
    const act = t.closest<HTMLElement>('[data-inv]');
    if (act) this.inventoryAction(act.dataset.inv!, act.dataset.kind!, act.dataset.id!);
  }

  private inventoryAction(action: string, kind: string, id: string): void {
    const goChar = (slot: CharSlot) => {
      this.slot = slot;
      this.tab = 'character';
      const look = { ...SkinPrefs.look(this.team) };
      look[slot] = id;
      this.previewLook = action === 'view' ? look : null;
      this.render();
      this.showStage();
    };
    const goWeapon = () => {
      this.tab = 'weapons';
      this.render();
      this.showStage();
    };
    if (kind === 'weapon') {
      this.weapon = id;
      this.preview = SkinPrefs.get(id);
      this.previewAtt = SkinPrefs.attachments(id);
      if (action === 'equip') {
        this.onWeapon(id);
        this.onToast(`${WEAPONS[id].name} equipada no agente`);
        return this.render();
      }
      return goWeapon();
    }
    if (kind === 'skin') {
      if (action === 'view') {
        this.preview = id;
        return goWeapon();
      }
      if (action === 'equip' && !SkinPrefs.set(this.weapon, id)) return this.onToast('Ainda bloqueada');
      if (action === 'remove') for (const w of ARSENAL_WEAPONS) if (SkinPrefs.get(w) === id) SkinPrefs.set(w, 'default');
      this.onEquip();
      return this.render();
    }
    if (kind === 'att') {
      const a = attachmentById(id)!;
      if (action === 'view') {
        if (WEAPON_ATTACH[this.weapon]?.[a.slot]?.includes(id)) this.previewAtt = [...this.previewAtt.filter(x => attachmentById(x)?.slot !== a.slot), id];
        return goWeapon();
      }
      if (action === 'equip' && !SkinPrefs.equipAttachment(this.weapon, id)) return this.onToast(`${a.name} não encaixa na ${WEAPONS[this.weapon]?.name ?? 'arma'} ou está bloqueado`);
      if (action === 'remove') for (const w of SkinPrefs.attachmentUse(id)) SkinPrefs.removeAttachment(w, a.slot);
      this.previewAtt = SkinPrefs.attachments(this.weapon);
      this.onEquip();
      return this.render();
    }
    // peças e acabamentos do personagem: "slot|item"
    const [slot, item] = id.split('|') as [CharSlot, string];
    if (action === 'view') return goChar(slot);
    if (action === 'equip' && !SkinPrefs.setLookItem(this.team, slot, item)) return this.onToast('Ainda bloqueado');
    if (action === 'remove') SkinPrefs.setLookItem(this.team, slot, SkinPrefs.defaultLook[slot]);
    this.view.look = SkinPrefs.lookString(this.team);
    this.onEquip();
    this.render();
  }

  // ================================================================== interface

  render(): void {
    for (const b of document.querySelectorAll<HTMLElement>('[data-arstab]')) b.classList.toggle('on', b.dataset.arstab === this.tab);
    $('arsenalScreen').dataset.tab = this.tab;
    const cmp = document.getElementById('czCompare');
    if (cmp) {
      cmp.classList.toggle('on', this.compare);
      cmp.style.display = this.tab === 'weapons' ? '' : 'none';
    }
    $('arsList').innerHTML = this.tab === 'character' ? this.slotList() : this.weaponList();
    const box = $('arsInfo');
    if (this.tab === 'character') box.innerHTML = this.characterPanel();
    else if (this.tab === 'weapons') box.innerHTML = this.weaponPanel();
    else if (this.tab === 'inventory') box.innerHTML = this.inventoryPanel();
    else box.innerHTML = this.assetsPanel();
  }

  private rar(r: Rarity): string {
    return `<em class="rar" style="--rar:${RARITY_COLOR[r]}">${RARITY_LABEL[r]}</em>`;
  }

  private weaponList(): string {
    const glbOk = (id: string) => this.report?.weapons[id];
    return BUY_CATEGORIES.filter(c => c.id !== 'grenade' && c.id !== 'gear')
      .map(c => `<h4>${c.name}</h4>` + c.items.map(id => `<button data-arsw="${id}" class="${id === this.weapon ? 'on' : ''}">${WEAPONS[id].name}${glbOk(id) ? ' <small class="ok">3D</small>' : ''}</button>`).join(''))
      .join('') + `<h4>Corpo a corpo</h4><button data-arsw="knife" class="${this.weapon === 'knife' ? 'on' : ''}">Faca</button>`;
  }

  private slotList(): string {
    const look = this.previewLook ?? SkinPrefs.look(this.team);
    const teams = (['CT', 'T'] as Team[]).map(t => `<button data-czteam="${t}" class="cz-team ${t === this.team ? 'on' : ''}">${t === 'CT' ? 'CT<small>Soldado</small>' : 'TR<small>Terrorista</small>'}</button>`).join('');
    return `<div class="cz-teams">${teams}</div>` + CHAR_SLOTS.map(s => {
      const id = look[s.id];
      const name = s.kind === 'finish' ? finishOf(id).name : gearById(id)?.name ?? '—';
      return `<button data-czslot="${s.id}" class="cz-slot ${s.id === this.slot ? 'on' : ''}"><i>${svg(SLOT_ICON[s.id])}</i><span><b>${s.name}</b><small>${esc(name)}</small></span></button>`;
    }).join('');
  }

  private finishSwatch(id: string): string {
    const f = finishOf(id);
    if (f.pattern === 'orig') return '';
    return seamlessPattern('finish_' + f.id, ({ solid: 'solid', woodland: 'woodland', desert: 'desert', arid: 'camo', digital: 'digital', snow: 'snow', tiger: 'tiger', urban: 'digital', blackgold: 'damascus' } as Record<string, string>)[f.pattern] ?? 'solid', f.colors, 64).toDataURL();
  }

  private characterPanel(): string {
    const equipped = SkinPrefs.look(this.team);
    const look = this.previewLook ?? equipped;
    const slotDef = CHAR_SLOTS.find(s => s.id === this.slot)!;
    const items = itemsFor(this.slot);
    const cur = look[this.slot];
    const curDef = items.find(i => i.id === cur)!;
    const cards = items.map(i => {
      const locked = i.level > SkinPrefs.level;
      const g = gearById(i.id);
      let sw = '';
      if (slotDef.kind === 'finish') {
        const url = this.finishSwatch(i.id);
        sw = url ? `<span class="sw" style="background-image:url(${url})"></span>` : `<span class="sw orig">ORIG</span>`;
      } else {
        const color = g?.color ?? (g?.headFinish ? finishOf(g.headFinish).colors[0] : '');
        const fin = g?.headFinish ? this.finishSwatch(g.headFinish) : '';
        sw = fin ? `<span class="sw" style="background-image:url(${fin})"></span>` : `<span class="sw ico" style="${color ? `--c:${color}` : ''}">${svg(SLOT_ICON[this.slot])}</span>`;
      }
      return `<button class="cz-card ${i.id === cur ? 'sel' : ''} ${i.id === equipped[this.slot] ? 'eq' : ''} ${locked ? 'locked' : ''}" data-czitem="${i.id}" style="--rar:${RARITY_COLOR[i.rarity]}">
        ${sw}<b>${esc(i.name)}</b><small>${RARITY_LABEL[i.rarity]}${locked ? ` · 🔒 nível ${i.level}` : ''}${i.id === equipped[this.slot] ? ' · equipado' : ''}</small></button>`;
    }).join('');
    const changed = cur !== equipped[this.slot];
    const locked = curDef.level > SkinPrefs.level;
    const isDefault = equipped[this.slot] === SkinPrefs.defaultLook[this.slot];
    const g = gearById(cur);
    const desc = slotDef.kind === 'finish'
      ? 'Troca a cor/camuflagem da peça original do modelo, mantendo costuras, dobras e desgaste.'
      : g?.model ? 'Peça 3D presa ao corpo: acompanha todas as animações.' : g?.headFinish ? 'Cobertura original da cabeça com outra cor.' : 'Sem peça extra.';
    return `<div class="ars-head"><h3>${slotDef.name.toUpperCase()}</h3><span class="cat">${CHARACTER_FILES[this.team].name}</span></div>
      <div class="cz-sel"><b>${esc(curDef.name)}</b> ${this.rar(curDef.rarity)}<p>${desc}</p></div>
      <div class="cz-grid">${cards}</div>
      <div class="cz-actions">
        <button class="btn primary" data-czequip ${changed && !locked ? '' : 'disabled'}>${locked ? 'BLOQUEADO (nível ' + curDef.level + ')' : changed ? 'EQUIPAR' : 'EQUIPADO'}</button>
        <button class="btn" data-czremove ${isDefault ? 'disabled' : ''}>REMOVER</button>
      </div>
      <button class="btn small cz-reset" data-czresetall>RESTAURAR VISUAL ORIGINAL</button>
      <p class="roadmap">Clique numa peça para ver no personagem antes de equipar. O visual aparece no menu, nas partidas e para os outros jogadores.</p>`;
  }

  private statBar(label: string, value: string, frac: number): string {
    return `<div class="ars-stat"><span>${label}</span><b>${value}</b><i><em style="width:${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%"></em></i></div>`;
  }

  private weaponPanel(): string {
    const w = WEAPONS[this.weapon];
    const equipped = SkinPrefs.get(this.weapon);
    const eqAtt = SkinPrefs.attachments(this.weapon);
    const prev = skinById(this.preview);
    const stats = w.cls === 'knife'
      ? this.statBar('Dano', String(w.damage), w.damage / 115) + this.statBar('Alcance', `${w.range} m`, 0.05) + this.statBar('Recompensa', `$${w.killReward}`, 1)
      : [
          this.statBar('Dano', String(w.damage), w.damage / 115),
          this.statBar('Cadência', `${Math.round(w.fireRate * 60)} RPM`, w.fireRate / 14),
          this.statBar('Carregador', `${w.magazine} / ${w.reserve}`, w.magazine / 35),
          this.statBar('Recarga', `${w.reloadTime.toFixed(1)} s`, 1 - w.reloadTime / 4),
          this.statBar('Recuo', w.recoil.toFixed(2), w.recoil / 4),
          this.statBar('Precisão', `${(1 / Math.max(0.05, w.spreadStand)).toFixed(1)}`, 1 - Math.min(1, w.spreadStand / 5)),
          this.statBar('Distância efetiva', `${effectiveRange(w)} m`, effectiveRange(w) / 200),
          this.statBar('Penetração no colete', `${Math.round(w.armorPen * 100)}%`, w.armorPen),
          this.statBar('Mobilidade', `${Math.round(w.speed * 250)}`, w.speed),
          this.statBar('Preço / recompensa', `$${w.price} / $${w.killReward}`, w.price / 4750)
        ].join('');
    const skins = [...SKINS].sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || a.level - b.level).map(s => {
      const locked = !SkinPrefs.unlocked(s.id);
      return `<button class="ars-skin ${s.id === this.preview ? 'sel' : ''} ${s.id === equipped ? 'eq' : ''} ${locked ? 'locked' : ''}" data-arssk="${s.id}" style="--rar:${RARITY_COLOR[s.rarity]}">
        <span class="sw" style="background-image:url(${skinSwatch(s.id).toDataURL()})">${locked ? '🔒' : ''}</span>
        <b>${s.name}</b><small>${RARITY_LABEL[s.rarity]}${locked ? ` · nível ${s.level}` : ''}${s.id === equipped ? ' · equipada' : ''}</small></button>`;
    }).join('');
    // acessórios: só os encaixes que a arma aceita
    const compat = WEAPON_ATTACH[this.weapon] ?? {};
    const attRows = ATTACH_SLOTS.filter(s => compat[s.id]?.length).map(s => {
      const cur = this.previewAtt.find(a => attachmentById(a)?.slot === s.id) ?? '';
      const opts = [`<button class="cz-chip ${cur === '' ? 'sel' : ''}" data-czatt="${s.id}:">Nenhum</button>`]
        .concat(compat[s.id]!.map(id => {
          const a = attachmentById(id)!;
          const locked = a.level > SkinPrefs.level;
          const fin = a.finish ? `<span class="dot" style="background:${a.finish.color}"></span>` : '';
          return `<button class="cz-chip ${cur === id ? 'sel' : ''} ${eqAtt.includes(id) ? 'eq' : ''} ${locked ? 'locked' : ''}" data-czatt="${s.id}:${id}" style="--rar:${RARITY_COLOR[a.rarity]}" title="${esc(a.desc)}">${fin}${esc(a.name)}${locked ? ` 🔒${a.level}` : ''}</button>`;
        }));
      return `<div class="cz-attrow"><i>${svg(ATT_ICON[s.id])}</i><span>${s.name}</span><div>${opts.join('')}</div></div>`;
    }).join('');
    const integrated = INTEGRATED[this.weapon];
    const changed = this.preview !== equipped || [...this.previewAtt].sort().join('.') !== [...eqAtt].sort().join('.');
    const locked = !SkinPrefs.unlocked(this.preview) || this.previewAtt.some(a => !SkinPrefs.attachmentUnlocked(a));
    return `<div class="ars-head"><h3>${w.name}</h3><span class="cat">${CLASS_LABEL[w.cls]}${w.team ? ' · ' + (w.team === 'T' ? 'TR' : 'CT') : ''}</span></div>
      <div class="cz-sel"><b style="color:${RARITY_COLOR[prev.rarity]}">${prev.name}</b> ${this.rar(prev.rarity)} <small>${prev.style}</small></div>
      <h4>Skins</h4><div class="ars-skins">${skins}</div>
      ${attRows ? `<h4>Acessórios</h4><div class="cz-atts">${attRows}</div>` : '<p class="roadmap">Esta arma não aceita acessórios.</p>'}
      ${integrated ? `<p class="roadmap">Integrado: ${integrated.join(', ')}.</p>` : ''}
      <button class="btn primary ars-equip" data-arsequip ${changed && !locked ? '' : 'disabled'}>${locked ? 'BLOQUEADO' : changed ? 'EQUIPAR' : 'EQUIPADO'}</button>
      <h4>Atributos</h4><div class="ars-stats">${stats}</div>
      <p class="roadmap">Skins e acessórios são só visuais: não mudam dano, recuo, precisão nem velocidade.</p>`;
  }

  private inventoryPanel(): string {
    type Row = { kind: string; id: string; name: string; rarity: Rarity; level: number; cat: InvFilter; sw: string; status: string; equipped: boolean };
    const rows: Row[] = [];
    const lookCT = SkinPrefs.look('CT'), lookT = SkinPrefs.look('T');
    for (const id of ARSENAL_WEAPONS) {
      const w = WEAPONS[id];
      rows.push({ kind: 'weapon', id, name: w.name, rarity: 'comum', level: 1, cat: 'weapons', sw: svg('<path d="M3 11h14l2-2h2v4h-4l-1 2h-3l-1 4H9l1-4H3z"/>'), status: `${CLASS_LABEL[w.cls]} · ${SkinPrefs.get(id) !== 'default' ? skinById(SkinPrefs.get(id)).name : 'padrão'}`, equipped: id === this.weapon });
    }
    for (const s of SKINS) {
      if (s.id === 'default') continue;
      const on = ARSENAL_WEAPONS.filter(id => SkinPrefs.get(id) === s.id).map(id => WEAPONS[id].name);
      rows.push({ kind: 'skin', id: s.id, name: s.name, rarity: s.rarity, level: s.level, cat: 'skins', sw: `<span class="sw" style="background-image:url(${skinSwatch(s.id).toDataURL()})"></span>`, status: on.length ? 'Em: ' + on.join(', ') : s.style, equipped: on.length > 0 });
    }
    for (const f of FINISHES) {
      if (f.id === 'orig') continue;
      const parts = (['vest', 'uniform', 'pants', 'gloves', 'boots'] as CharSlot[]);
      const usedCT = parts.filter(p => lookCT[p] === f.id), usedT = parts.filter(p => lookT[p] === f.id);
      const label = (l: CharSlot[]) => l.map(p => CHAR_SLOTS.find(s => s.id === p)!.name).join(', ');
      const status = [usedCT.length ? 'CT: ' + label(usedCT) : '', usedT.length ? 'TR: ' + label(usedT) : ''].filter(Boolean).join(' · ') || 'Uniforme, calças, colete, luvas e botas';
      rows.push({ kind: 'finish', id: 'uniform|' + f.id, name: f.name, rarity: f.rarity, level: f.level, cat: 'uniforms', sw: `<span class="sw" style="background-image:url(${this.finishSwatch(f.id)})"></span>`, status, equipped: usedCT.length + usedT.length > 0 });
    }
    for (const g of GEAR) {
      if (!g.model && !g.headFinish) continue;
      const cat: InvFilter = g.slot === 'helmet' ? 'helmets' : g.slot === 'accessory' ? 'accessories' : 'equipment';
      const on = [lookCT[g.slot] === g.id ? 'CT' : '', lookT[g.slot] === g.id ? 'TR' : ''].filter(Boolean);
      rows.push({ kind: 'gear', id: g.slot + '|' + g.id, name: g.name, rarity: g.rarity, level: g.level, cat, sw: `<span class="sw ico" style="${g.color ? `--c:${g.color}` : ''}">${svg(SLOT_ICON[g.slot])}</span>`, status: (CHAR_SLOTS.find(s => s.id === g.slot)!.name) + (on.length ? ' · equipado (' + on.join(', ') + ')' : ''), equipped: on.length > 0 });
    }
    for (const a of ATTACHMENTS) {
      const on = SkinPrefs.attachmentUse(a.id).map(w => WEAPONS[w]?.name).filter(Boolean);
      rows.push({ kind: 'att', id: a.id, name: a.name, rarity: a.rarity, level: a.level, cat: 'accessories', sw: `<span class="sw ico" style="${a.finish ? `--c:${a.finish.color}` : ''}">${svg(ATT_ICON[a.slot])}</span>`, status: on.length ? 'Em: ' + on.join(', ') : ATTACH_SLOTS.find(s => s.id === a.slot)!.name + ' de arma', equipped: on.length > 0 });
    }
    const list = rows.filter(r => this.invFilter === 'all' || r.cat === this.invFilter);
    list.sort((a, b) => this.invSort === 'name' ? a.name.localeCompare(b.name, 'pt') : this.invSort === 'level' ? a.level - b.level : rarityRank(b.rarity) - rarityRank(a.rarity) || a.name.localeCompare(b.name, 'pt'));
    const filters: [InvFilter, string][] = [['all', 'Todos'], ['weapons', 'Armas'], ['skins', 'Skins'], ['uniforms', 'Uniformes'], ['helmets', 'Capacetes'], ['equipment', 'Equipamentos'], ['accessories', 'Acessórios']];
    const owned = rows.filter(r => r.level <= SkinPrefs.level).length;
    const cards = list.map(r => {
      const locked = r.level > SkinPrefs.level;
      const canEquip = !locked && r.kind !== 'weapon' ? true : r.kind === 'weapon';
      return `<div class="inv-row ${locked ? 'locked' : ''} ${r.equipped ? 'eq' : ''}" style="--rar:${RARITY_COLOR[r.rarity]}">${r.sw.startsWith('<span') ? r.sw : `<span class="sw ico">${r.sw}</span>`}
        <div class="inv-txt"><b>${esc(r.name)}</b><small>${r.kind !== 'weapon' ? RARITY_LABEL[r.rarity] + ' · ' : ''}${locked ? `🔒 nível ${r.level}` : esc(r.status)}</small></div>
        <div class="inv-act"><button data-inv="view" data-kind="${r.kind}" data-id="${r.id}">VER</button>${canEquip && !locked ? `<button data-inv="equip" data-kind="${r.kind}" data-id="${r.id}">EQUIPAR</button>` : ''}${r.equipped && r.kind !== 'weapon' ? `<button data-inv="remove" data-kind="${r.kind}" data-id="${r.id}">REMOVER</button>` : ''}</div></div>`;
    }).join('');
    return `<div class="ars-head"><h3>INVENTÁRIO</h3><span class="cat">${owned}/${rows.length} itens liberados · nível ${SkinPrefs.level}</span></div>
      <div class="cz-filters">${filters.map(([id, n]) => `<button class="cz-chip ${this.invFilter === id ? 'sel' : ''}" data-czf="${id}">${n}</button>`).join('')}
      <select id="czSort"><option value="rarity" ${this.invSort === 'rarity' ? 'selected' : ''}>Raridade</option><option value="name" ${this.invSort === 'name' ? 'selected' : ''}>Nome</option><option value="level" ${this.invSort === 'level' ? 'selected' : ''}>Nível</option></select></div>
      <p class="roadmap">Skins e acessórios de arma equipam na arma selecionada (${esc(WEAPONS[this.weapon]?.name ?? '')}); roupas e peças no personagem ${this.team === 'T' ? 'Terrorista' : 'Soldado'}.</p>
      <div class="inv-list">${cards}</div>
      <p class="roadmap">${RARITIES.map(r => `<em class="rar" style="--rar:${RARITY_COLOR[r]}">${RARITY_LABEL[r]}</em>`).join(' ')}</p>`;
  }

  private assetsPanel(): string {
    const r = this.report;
    if (!r) return '<p class="roadmap">Verificando arquivos em public/assets…</p>';
    const req = REQUIRED_WEAPONS.map(id => `<li class="${r.weapons[id] ? 'ok' : 'miss'}">${r.weapons[id] ? '✔' : '✖'} ${WEAPON_MODELS[id]}</li>`).join('');
    const opt = Object.keys(WEAPON_MODELS).filter(id => !REQUIRED_WEAPONS.includes(id)).map(id => `<li class="${r.weapons[id] ? 'ok' : 'opt'}">${r.weapons[id] ? '✔' : '·'} ${WEAPON_MODELS[id]} <small>(opcional)</small></li>`).join('');
    const skins = SKINS.filter(s => s.folder).map(s => {
      const files = r.skins[s.folder] ?? [];
      return `<li class="${files.length ? 'ok' : 'opt'}">${files.length ? '✔' : '·'} skins/${s.folder}/ ${files.length ? files.map(f => f.split('/').pop()).join(', ') : '<small>(padrão procedural com relevo)</small>'}</li>`;
    }).join('');
    const models = [...new Set(ATTACHMENTS.filter(a => a.model).map(a => `attachments/${a.model}.glb`))].map(p => `<li class="ok">✔ ${p}</li>`).join('');
    const gear = [...new Set(GEAR.filter(g => g.model).map(g => g.model))].map(m => `<li class="ok">✔ cosmetics/${m}_CT.glb · _T.glb</li>`).join('');
    const missingReq = REQUIRED_WEAPONS.filter(id => !r.weapons[id]).length + (r.hands ? 0 : 1);
    return `<div class="ars-head"><h3>RECURSOS 3D</h3><span class="cat">${missingReq ? missingReq + ' arquivo(s) pendente(s)' : 'Tudo encontrado'}</span></div>
      <p class="roadmap">Coloque os arquivos em <b>public/assets/</b> (com licença que permita uso no jogo, ex.: CC0 ou CC-BY com crédito) e gere o build/APK de novo. Enquanto um modelo não existir, o jogo usa o modelo provisório.</p>
      <h4>Armas</h4><ul class="ars-files">${req}${opt}</ul>
      <h4>Mãos</h4><ul class="ars-files"><li class="${r.hands ? 'ok' : 'miss'}">${r.hands ? '✔' : '✖'} ${HANDS_MODEL}</li></ul>
      <h4>Acessórios de arma</h4><ul class="ars-files">${models}</ul>
      <h4>Peças de personagem</h4><ul class="ars-files">${gear}</ul>
      <h4>Skins (texturas opcionais: albedo, normal, orm)</h4><ul class="ars-files">${skins}</ul>
      ${this.library?.errors.length ? `<h4>Erros</h4><ul class="ars-files">${this.library.errors.map(e => `<li class="miss">${esc(e)}</li>`).join('')}</ul>` : ''}
      <button class="btn" data-arsrecheck>VERIFICAR NOVAMENTE</button>`;
  }
}
