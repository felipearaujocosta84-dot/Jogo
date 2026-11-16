// Tela de Arsenal: visualização 3D da arma (girar com dedo/mouse, zoom com pinça/roda), nome, categoria,
// estatísticas, skins por raridade com pré-visualização, botão de equipar, inventário e relatório dos
// recursos 3D (o que foi encontrado em public/assets e o que falta adicionar).
// O motor 3D desta tela só existe enquanto ela está aberta (memória liberada ao sair).
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
import { BUY_CATEGORIES, CLASS_LABEL, WEAPONS, effectiveRange } from '../weapons/WeaponData';
import { RARITIES, RARITY_COLOR, RARITY_LABEL, SKINS, skinById } from '../weapons/Skins';
import { skinSwatch } from '../weapons/SkinPatterns';
import { SkinPrefs } from '../save/SkinPrefs';
import { REQUIRED_WEAPONS, WEAPON_MODELS, HANDS_MODEL, assetReport, type AssetReport } from '../assets/AssetRegistry';
import { esc } from './Hud';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const ARSENAL_WEAPONS = [...BUY_CATEGORIES.filter(c => c.id !== 'grenade' && c.id !== 'gear').flatMap(c => c.items), 'knife'];

export class ArsenalScreen {
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private camera: ArcRotateCamera | null = null;
  private library: WeaponLibrary | null = null;
  private model: TransformNode | null = null;
  private weapon = 'ak47';
  /** Skin em pré-visualização (pode ainda não estar equipada). */
  private preview = 'default';
  private tab: 'weapons' | 'inventory' | 'assets' = 'weapons';
  private loadToken = 0;
  private report: AssetReport | null = null;
  onEquip: () => void = () => {};
  /** Arma escolhida na tela (o lobby mostra o agente com ela). */
  onWeapon: (id: string) => void = () => {};

  get weaponId(): string {
    return this.weapon;
  }

  /** Abre já na aba indicada (ex.: inventário) e/ou com a arma indicada. */
  prepare(tab: 'weapons' | 'inventory' | 'assets', weapon?: string): void {
    this.tab = tab;
    if (weapon) this.weapon = weapon;
  }
  onToast: (msg: string) => void = () => {};

  constructor() {
    $('arsenalScreen').addEventListener('click', e => this.onClick(e));
    window.addEventListener('resize', () => this.engine?.resize());
  }

  /** Abre a tela (cria o motor 3D desta tela). */
  open(): void {
    const canvas = $<HTMLCanvasElement>('arsCanvas');
    if (!this.engine) {
      this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, antialias: true, adaptToDeviceRatio: true });
      this.engine.disableManifestCheck = true;
      const scene = new Scene(this.engine);
      scene.clearColor = new Color4(0.06, 0.07, 0.09, 1);
      const cam = new ArcRotateCamera('arsCam', -Math.PI / 2 + 0.35, 1.25, 1.4, Vector3.Zero(), scene);
      cam.minZ = 0.01;
      cam.lowerRadiusLimit = 0.25;
      cam.upperRadiusLimit = 4;
      cam.wheelPrecision = 120;
      cam.pinchPrecision = 300;
      cam.panningSensibility = 0;
      cam.useAutoRotationBehavior = true;
      if (cam.autoRotationBehavior) {
        cam.autoRotationBehavior.idleRotationSpeed = 0.35;
        cam.autoRotationBehavior.idleRotationWaitTime = 2500;
      }
      cam.attachControl(canvas, true);
      const hemi = new HemisphericLight('arsHemi', new Vector3(0, 1, 0), scene);
      hemi.intensity = 0.7;
      hemi.groundColor = new Color3(0.15, 0.15, 0.18);
      const key = new DirectionalLight('arsKey', new Vector3(-0.5, -0.8, 0.4), scene);
      key.intensity = 2.2;
      const rim = new DirectionalLight('arsRim', new Vector3(0.6, -0.2, -0.8), scene);
      rim.intensity = 1.1;
      rim.diffuse = new Color3(0.6, 0.75, 1);
      applyStudioEnvironment(scene, '#c9d6e6', '#6f747c', '#1a1c20');
      // base giratória
      const plate = CreateCylinder('arsPlate', { diameter: 1.6, height: 0.02, tessellation: 48 }, scene);
      plate.position.y = -0.22;
      const pm = new PBRMaterial('arsPlateMat', scene);
      pm.albedoColor = Color3.FromHexString('#0c0d10');
      pm.metallic = 0.3;
      pm.roughness = 0.35;
      plate.material = pm;
      this.scene = scene;
      this.camera = cam;
      this.library = new WeaponLibrary(scene);
    }
    this.engine.runRenderLoop(() => this.scene?.render());
    requestAnimationFrame(() => this.engine?.resize());
    this.preview = SkinPrefs.get(this.weapon);
    this.render();
    void this.showModel();
    void assetReport(SKINS.filter(s => s.folder).map(s => s.folder)).then(r => {
      this.report = r;
      this.render();
    });
  }

  /** Fecha a tela e libera a memória do motor 3D. */
  close(): void {
    if (!this.engine) return;
    this.engine.stopRenderLoop();
    this.library?.dispose();
    this.scene?.dispose();
    this.engine.dispose();
    this.engine = null;
    this.scene = null;
    this.camera = null;
    this.library = null;
    this.model = null;
  }

  private async showModel(): Promise<void> {
    const scene = this.scene, lib = this.library;
    if (!scene || !lib) return;
    const token = ++this.loadToken;
    const id = this.weapon, skin = this.preview;
    $('arsBadge').textContent = 'Carregando…';
    let root: TransformNode;
    let definitive = false;
    const glb = (await lib.has(id)) ? await lib.instantiate(id, skin) : null;
    if (token !== this.loadToken || !this.scene) {
      glb?.root.dispose(false, false);
      return;
    }
    if (glb) {
      root = glb.root;
      definitive = true;
      for (const a of glb.animations) a.stop();
    } else {
      const g = buildGun(id, scene, skin);
      root = g.root;
    }
    this.model?.dispose(false, false);
    this.model = root;
    // enquadra: a arma deitada de lado, centralizada sobre a base
    const holder = new TransformNode('arsHolder', scene);
    root.parent = holder;
    root.computeWorldMatrix(true);
    const { min, max } = root.getHierarchyBoundingVectors(true);
    const size = max.subtract(min);
    root.position.subtractInPlace(min.add(max).scale(0.5));
    holder.rotation.y = Math.PI / 2;
    this.model = holder;
    const len = Math.max(size.x, size.y, size.z);
    if (this.camera) {
      this.camera.radius = Math.max(0.35, len * 1.25);
      this.camera.target = Vector3.Zero();
    }
    const plate = scene.getMeshByName('arsPlate');
    if (plate) {
      plate.position.y = -size.y * 0.5 - 0.03;
      plate.scaling.set(len * 0.6, 1, len * 0.6);
    }
    $('arsBadge').textContent = definitive ? 'Modelo 3D definitivo (GLB)' : `Modelo provisório — adicione ${WEAPON_MODELS[id] ?? id}`;
    $('arsBadge').className = 'ars-badge ' + (definitive ? 'ok' : 'warn');
  }

  private onClick(e: Event): void {
    const t = e.target as HTMLElement;
    const tab = t.closest<HTMLElement>('[data-arstab]');
    if (tab) {
      this.tab = tab.dataset.arstab as typeof this.tab;
      return this.render();
    }
    const w = t.closest<HTMLElement>('[data-arsw]');
    if (w) {
      this.weapon = w.dataset.arsw!;
      this.onWeapon(this.weapon);
      this.preview = SkinPrefs.get(this.weapon);
      this.tab = 'weapons';
      this.render();
      void this.showModel();
      return;
    }
    const sk = t.closest<HTMLElement>('[data-arssk]');
    if (sk) {
      this.preview = sk.dataset.arssk!;
      this.render();
      void this.showModel();
      return;
    }
    if (t.closest('[data-arsequip]')) {
      const def = skinById(this.preview);
      if (!SkinPrefs.set(this.weapon, def.id)) return this.onToast(`${def.name} é liberada no nível ${def.level}`);
      this.onEquip();
      this.onToast(`${WEAPONS[this.weapon]?.name}: ${def.name} equipada`);
      return this.render();
    }
    if (t.closest('[data-arsrecheck]')) {
      this.report = null;
      this.render();
      void assetReport(SKINS.filter(s => s.folder).map(s => s.folder), true).then(r => {
        this.report = r;
        this.render();
        void this.showModel();
      });
    }
  }

  private statBar(label: string, value: string, frac: number): string {
    return `<div class="ars-stat"><span>${label}</span><b>${value}</b><i><em style="width:${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%"></em></i></div>`;
  }

  render(): void {
    for (const b of document.querySelectorAll<HTMLElement>('[data-arstab]')) b.classList.toggle('on', b.dataset.arstab === this.tab);
    // lista de armas por categoria
    const glbOk = (id: string) => this.report?.weapons[id];
    $('arsList').innerHTML = BUY_CATEGORIES.filter(c => c.id !== 'grenade' && c.id !== 'gear')
      .map(c => `<h4>${c.name}</h4>` + c.items.map(id => `<button data-arsw="${id}" class="${id === this.weapon ? 'on' : ''}">${WEAPONS[id].name}${glbOk(id) ? ' <small class="ok">3D</small>' : ''}</button>`).join(''))
      .join('') + `<h4>Corpo a corpo</h4><button data-arsw="knife" class="${this.weapon === 'knife' ? 'on' : ''}">Faca</button>`;

    const box = $('arsInfo');
    if (this.tab === 'weapons') box.innerHTML = this.weaponPanel();
    else if (this.tab === 'inventory') box.innerHTML = this.inventoryPanel();
    else box.innerHTML = this.assetsPanel();
  }

  private weaponPanel(): string {
    const w = WEAPONS[this.weapon];
    const equipped = SkinPrefs.get(this.weapon);
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
    const skins = SKINS.map(s => {
      const locked = !SkinPrefs.unlocked(s.id);
      return `<button class="ars-skin ${s.id === this.preview ? 'sel' : ''} ${s.id === equipped ? 'eq' : ''} ${locked ? 'locked' : ''}" data-arssk="${s.id}" style="--rar:${RARITY_COLOR[s.rarity]}">
        <span class="sw" style="background-image:url(${skinSwatch(s.id).toDataURL()})">${locked ? '🔒' : ''}</span>
        <b>${s.name}</b><small>${RARITY_LABEL[s.rarity]}${locked ? ` · nível ${s.level}` : ''}${s.id === equipped ? ' · equipada' : ''}</small></button>`;
    }).join('');
    const canEquip = this.preview !== equipped;
    const locked = !SkinPrefs.unlocked(this.preview);
    return `<div class="ars-head"><h3>${w.name}</h3><span class="cat">${CLASS_LABEL[w.cls]}${w.team ? ' · ' + (w.team === 'T' ? 'TR' : 'CT') : ''}</span></div>
      <div class="ars-skinname" style="color:${RARITY_COLOR[prev.rarity]}">${prev.name} · ${RARITY_LABEL[prev.rarity]}</div>
      <div class="ars-stats">${stats}</div>
      <h4>Skins</h4><div class="ars-skins">${skins}</div>
      <button class="btn primary ars-equip" data-arsequip ${canEquip && !locked ? '' : 'disabled'}>${locked ? 'BLOQUEADA (nível ' + prev.level + ')' : canEquip ? 'EQUIPAR SKIN' : 'EQUIPADA'}</button>
      <p class="roadmap">Skins são só visuais: não mudam dano, recuo, precisão nem velocidade.</p>`;
  }

  private inventoryPanel(): string {
    const rows = RARITIES.map(r => {
      const list = SKINS.filter(s => s.rarity === r);
      if (!list.length) return '';
      return `<h4 style="color:${RARITY_COLOR[r]}">${RARITY_LABEL[r]}</h4>` + list.map(s => {
        const owned = SkinPrefs.unlocked(s.id);
        const on = ARSENAL_WEAPONS.filter(id => SkinPrefs.get(id) === s.id).map(id => WEAPONS[id].name);
        return `<div class="inv-row ${owned ? '' : 'locked'}"><span class="sw" style="background-image:url(${skinSwatch(s.id).toDataURL()})"></span>
          <div><b>${s.name}</b><small>${owned ? (on.length ? 'Equipada em: ' + on.join(', ') : 'No inventário') : `Liberada no nível ${s.level}`}</small></div></div>`;
      }).join('');
    }).join('');
    const owned = SKINS.filter(s => SkinPrefs.unlocked(s.id)).length;
    return `<div class="ars-head"><h3>Inventário</h3><span class="cat">${owned}/${SKINS.length} skins · nível ${SkinPrefs.level}</span></div>${rows}`;
  }

  private assetsPanel(): string {
    const r = this.report;
    if (!r) return '<p class="roadmap">Verificando arquivos em public/assets…</p>';
    const req = REQUIRED_WEAPONS.map(id => `<li class="${r.weapons[id] ? 'ok' : 'miss'}">${r.weapons[id] ? '✔' : '✖'} ${WEAPON_MODELS[id]}</li>`).join('');
    const opt = Object.keys(WEAPON_MODELS).filter(id => !REQUIRED_WEAPONS.includes(id)).map(id => `<li class="${r.weapons[id] ? 'ok' : 'opt'}">${r.weapons[id] ? '✔' : '·'} ${WEAPON_MODELS[id]} <small>(opcional)</small></li>`).join('');
    const skins = SKINS.filter(s => s.folder).map(s => {
      const files = r.skins[s.folder] ?? [];
      return `<li class="${files.length ? 'ok' : 'opt'}">${files.length ? '✔' : '·'} skins/${s.folder}/ ${files.length ? files.map(f => f.split('/').pop()).join(', ') : '<small>(sem texturas — usa o padrão procedural)</small>'}</li>`;
    }).join('');
    const missingReq = REQUIRED_WEAPONS.filter(id => !r.weapons[id]).length + (r.hands ? 0 : 1);
    return `<div class="ars-head"><h3>Recursos 3D</h3><span class="cat">${missingReq ? missingReq + ' arquivo(s) pendente(s)' : 'Tudo encontrado'}</span></div>
      <p class="roadmap">Coloque os arquivos em <b>public/assets/</b> (com licença que permita uso no jogo, ex.: CC0 ou CC-BY com crédito) e gere o build/APK de novo. Enquanto um modelo não existir, o jogo usa o modelo provisório.</p>
      <h4>Armas</h4><ul class="ars-files">${req}${opt}</ul>
      <h4>Mãos</h4><ul class="ars-files"><li class="${r.hands ? 'ok' : 'miss'}">${r.hands ? '✔' : '✖'} ${HANDS_MODEL}</li></ul>
      <h4>Skins (texturas opcionais: albedo, normal, orm)</h4><ul class="ars-files">${skins}</ul>
      ${this.library?.errors.length ? `<h4>Erros</h4><ul class="ars-files">${this.library.errors.map(e => `<li class="miss">${esc(e)}</li>`).join('')}</ul>` : ''}
      <button class="btn" data-arsrecheck>VERIFICAR NOVAMENTE</button>`;
  }
}
