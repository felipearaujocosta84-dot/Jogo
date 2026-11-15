// Arena urbana: quadra cercada, gols, muretas, alambrado, arquibancadas, torcida,
// muros grafitados, refletores, prédios ao fundo e iluminação.
import {
  MeshBuilder, Mesh, StandardMaterial, Color3, Color4, Vector3, Texture, HemisphericLight,
  DirectionalLight, ShadowGenerator, VertexData, Scene
} from '../babylon.js';
import { FIELD, BALL } from '../config.js';
import { Goal } from './Goal.js';
import {
  createCourtTexture, createAsphaltTexture, createFenceTexture, createNetTexture, createBoardTexture,
  createGraffitiWallTexture, createSkyTexture, createWindowsTexture, createCrowdAtlas, createGlowTexture
} from './textures.js';

function mat(scene, name, opts = {}) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = opts.diffuse || new Color3(1, 1, 1);
  m.specularColor = opts.specular || new Color3(0.05, 0.05, 0.05);
  if (opts.emissive) m.emissiveColor = opts.emissive;
  if (opts.texture) m.diffuseTexture = opts.texture;
  return m;
}

export class StreetArena {
  static id = 'street';
  static displayName = 'Quadra da Rua (noite)';

  /**
   * @param {Scene} scene
   * @param {{shadowMap:number, crowdAnim:boolean}} quality
   */
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.time = 0;
    this.excitement = 0; // 0..1, torcida pulando
    this.staticMeshes = [];
  }

  build() {
    const scene = this.scene;
    scene.clearColor = new Color4(0.02, 0.03, 0.06, 1);
    scene.ambientColor = new Color3(0.25, 0.25, 0.3);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.006;
    scene.fogColor = new Color3(0.05, 0.06, 0.1);

    this.buildLights();
    this.buildSky();
    this.buildGround();
    this.buildCourt();
    this.buildBoardsAndFence();
    this.buildGoals();
    this.buildStands();
    this.buildWalls();
    this.buildFloodlights();
    this.buildCity();

    for (const m of this.staticMeshes) {
      m.freezeWorldMatrix();
      m.isPickable = false;
      m.doNotSyncBoundingInfo = true;
    }
    return this;
  }

  buildLights() {
    const scene = this.scene;
    const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, -0.3), scene);
    hemi.intensity = 0.7;
    hemi.diffuse = new Color3(0.75, 0.8, 1.0);
    hemi.groundColor = new Color3(0.18, 0.16, 0.2);
    hemi.specular = new Color3(0.1, 0.1, 0.1);

    const sun = new DirectionalLight('floodKey', new Vector3(-0.35, -1, 0.45).normalize(), scene);
    sun.position = new Vector3(14, 30, -18);
    sun.intensity = 1.35;
    sun.diffuse = new Color3(1, 0.96, 0.88);
    sun.specular = new Color3(0.4, 0.4, 0.4);
    sun.shadowMinZ = 1;
    sun.shadowMaxZ = 80;
    this.keyLight = sun;

    const sg = new ShadowGenerator(this.quality.shadowMap, sun);
    const webgl2 = scene.getEngine().webGLVersion >= 2;
    if (webgl2) {
      sg.usePercentageCloserFiltering = true;
      sg.filteringQuality = ShadowGenerator.QUALITY_LOW;
    } else {
      sg.usePoissonSampling = true;
    }
    sg.bias = 0.0008;
    sg.normalBias = 0.01;
    sg.darkness = 0.35;
    // a área das sombras fica limitada à quadra (ortográfica fixa = mais nitidez e estabilidade)
    sun.autoUpdateExtends = false;
    sun.orthoLeft = -22; sun.orthoRight = 22; sun.orthoTop = 16; sun.orthoBottom = -16;
    this.shadowGenerator = sg;
  }

  buildSky() {
    const sky = MeshBuilder.CreateSphere('sky', { diameter: 500, segments: 12, sideOrientation: Mesh.BACKSIDE }, this.scene);
    const m = mat(this.scene, 'skyMat');
    m.emissiveTexture = createSkyTexture(this.scene);
    m.disableLighting = true;
    m.fogEnabled = false;
    m.diffuseColor = Color3.Black();
    sky.material = m;
    sky.infiniteDistance = true;
    sky.applyFog = false;
    this.staticMeshes.push(sky);
  }

  buildGround() {
    const g = MeshBuilder.CreateGround('asphalt', { width: 220, height: 220 }, this.scene);
    g.position.y = -0.01;
    const tex = createAsphaltTexture(this.scene);
    tex.uScale = tex.vScale = 40;
    g.material = mat(this.scene, 'asphaltMat', { texture: tex, diffuse: new Color3(0.8, 0.8, 0.85) });
    g.receiveShadows = false;
    this.staticMeshes.push(g);
  }

  buildCourt() {
    const totalLen = FIELD.length + FIELD.goalDepth * 2;
    const court = MeshBuilder.CreateGround('court', { width: totalLen, height: FIELD.width }, this.scene);
    const m = mat(this.scene, 'courtMat', { texture: createCourtTexture(this.scene, this.quality.shadowMap >= 1024 ? 2048 : 1024) });
    m.specularColor = new Color3(0.12, 0.12, 0.12);
    m.specularPower = 24;
    court.material = m;
    court.receiveShadows = true;
    this.court = court;
    this.staticMeshes.push(court);
  }

  buildBoardsAndFence() {
    const scene = this.scene;
    const L = FIELD.length, W = FIELD.width, bh = FIELD.boardHeight, fh = FIELD.fenceHeight;
    const gw = FIELD.goalWidth, gh = FIELD.goalHeight, gd = FIELD.goalDepth;
    const boardTex = createBoardTexture(scene);
    const boardMat = mat(scene, 'boardMat', { texture: boardTex });
    // mureta do lado da câmera: semitransparente para não esconder a bola
    const nearBoardMat = mat(scene, 'boardNearMat', { texture: boardTex });
    nearBoardMat.alpha = 0.35;
    const concrete = mat(scene, 'concreteMat', { diffuse: new Color3(0.22, 0.23, 0.25) });

    const boards = [];
    const board = (name, x, z, len, alongX, material = boardMat, height = bh) => {
      const b = MeshBuilder.CreateBox(name, { width: alongX ? len : 0.15, depth: alongX ? 0.15 : len, height }, scene);
      b.position.set(x, height / 2, z);
      if (material === boardMat) {
        // repete a textura de painéis ao longo da mureta
        b.material = material;
        boards.push(b);
      } else b.material = material;
      this.staticMeshes.push(b);
      return b;
    };
    // laterais
    board('boardFar', 0, W / 2 + 0.075, L + 0.3, true);
    const near = board('boardNear', 0, -W / 2 - 0.075, L + 0.3, true, nearBoardMat, bh * 0.8);
    near.receiveShadows = false;
    // fundos (deixando a boca do gol livre)
    const endLen = (W - gw) / 2;
    for (const s of [-1, 1]) {
      board('boardEndA' + s, s * (L / 2 + 0.075), gw / 2 + endLen / 2, endLen, false);
      board('boardEndB' + s, s * (L / 2 + 0.075), -gw / 2 - endLen / 2, endLen, false);
      // paredes do recuo do gol (concreto)
      board('recessBack' + s, s * (L / 2 + gd + 0.25), 0, gw + 0.8, false, concrete, gh + 0.6);
      board('recessL' + s, s * (L / 2 + gd / 2 + 0.1), gw / 2 + 0.4, gd + 0.4, true, concrete, gh + 0.6);
      board('recessR' + s, s * (L / 2 + gd / 2 + 0.1), -gw / 2 - 0.4, gd + 0.4, true, concrete, gh + 0.6);
    }
    for (const b of boards) {
      // escala de UV proporcional ao comprimento (painéis de ~6m)
      const len = Math.max(b.getBoundingInfo().boundingBox.extendSize.x, b.getBoundingInfo().boundingBox.extendSize.z) * 2;
      const mm = boardMat.clone('boardMat_' + b.name);
      mm.diffuseTexture = boardTex.clone();
      mm.diffuseTexture.uScale = Math.max(1, Math.round(len / 18));
      b.material = mm;
    }

    // alambrado
    const fenceTex = createFenceTexture(scene);
    const fenceMat = mat(scene, 'fenceMat', { texture: fenceTex, diffuse: new Color3(0.85, 0.87, 0.9) });
    fenceMat.diffuseTexture.hasAlpha = true;
    fenceMat.useAlphaFromDiffuseTexture = true;
    fenceMat.backFaceCulling = false;
    fenceMat.emissiveColor = new Color3(0.15, 0.15, 0.17);

    const tile = 0.3;
    const fencePlane = (name, cx, cy, cz, width, height, rotY, material = fenceMat) => {
      const p = MeshBuilder.CreatePlane(name, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene);
      p.position.set(cx, cy, cz);
      p.rotation.y = rotY;
      const m = material.clone(name + 'Mat');
      m.diffuseTexture = fenceTex.clone();
      m.diffuseTexture.uScale = width / tile;
      m.diffuseTexture.vScale = height / tile;
      p.material = m;
      this.staticMeshes.push(p);
      return p;
    };
    const fhh = fh - bh;
    fencePlane('fenceFar', 0, bh + fhh / 2, W / 2 + 0.1, L + 0.3, fhh, 0);
    // lado da câmera sem alambrado: nada cobre a visão da transmissão
    for (const s of [-1, 1]) {
      fencePlane('fenceEndA' + s, s * (L / 2 + 0.1), bh + fhh / 2, gw / 2 + endLen / 2, endLen, fhh, Math.PI / 2);
      fencePlane('fenceEndB' + s, s * (L / 2 + 0.1), bh + fhh / 2, -gw / 2 - endLen / 2, endLen, fhh, Math.PI / 2);
      fencePlane('fenceTopGoal' + s, s * (L / 2 + 0.1), gh + (fh - gh) / 2, 0, gw, fh - gh, Math.PI / 2);
    }

    // postes do alambrado (mesh única com instâncias)
    const postMat = mat(scene, 'fencePostMat', { diffuse: new Color3(0.3, 0.32, 0.35), specular: new Color3(0.3, 0.3, 0.3) });
    const post = MeshBuilder.CreateCylinder('fencePost', { height: fh, diameter: 0.08, tessellation: 6 }, scene);
    post.material = postMat;
    post.position.set(-L / 2, fh / 2, W / 2 + 0.12);
    this.staticMeshes.push(post);
    const positions = [];
    for (let x = -L / 2; x <= L / 2 + 0.01; x += 4) {
      positions.push([x, W / 2 + 0.12]);
    }
    for (const s of [-1, 1]) for (const z of [-gw / 2, gw / 2, W / 2]) positions.push([s * (L / 2 + 0.12), z]);
    positions.forEach(([x, z], i) => {
      if (i === 0) return;
      const inst = post.createInstance('fp' + i);
      inst.position.set(x, fh / 2, z);
      this.staticMeshes.push(inst);
    });
    // barra superior do alambrado
    const rail = MeshBuilder.CreateBox('railFar', { width: L + 0.3, height: 0.06, depth: 0.06 }, scene);
    rail.position.set(0, fh, W / 2 + 0.12);
    rail.material = postMat;
    this.staticMeshes.push(rail);
  }

  buildGoals() {
    const scene = this.scene;
    const postMat = mat(scene, 'goalPostMat', { diffuse: new Color3(0.95, 0.95, 0.95), specular: new Color3(0.6, 0.6, 0.6) });
    postMat.specularPower = 48;
    postMat.emissiveColor = new Color3(0.15, 0.15, 0.15);
    const netMat = mat(scene, 'netMat', { texture: createNetTexture(scene), diffuse: new Color3(0.95, 0.95, 0.95) });
    netMat.diffuseTexture.hasAlpha = true;
    netMat.useAlphaFromDiffuseTexture = true;
    netMat.backFaceCulling = false;
    netMat.emissiveColor = new Color3(0.35, 0.35, 0.35);
    this.goals = {
      positive: new Goal(scene, 1, { post: postMat, net: netMat }, this.shadowGenerator),
      negative: new Goal(scene, -1, { post: postMat, net: netMat }, this.shadowGenerator)
    };
  }

  buildStands() {
    const scene = this.scene;
    const L = FIELD.length, W = FIELD.width, gd = FIELD.goalDepth;
    const seatMat = mat(scene, 'standMat', { diffuse: new Color3(0.55, 0.57, 0.6) });
    const stepMeshes = [];
    const spectators = [];
    const rows = 4, stepH = 0.45, stepD = 0.8;

    const addStand = (cx, cz, length, facing) => {
      // facing: direção (normalizada no plano XZ) para a qual a torcida olha
      const alongX = Math.abs(facing.z) > 0.5;
      for (let r = 0; r < rows; r++) {
        const back = (r + 0.5) * stepD;
        const x = cx - facing.x * back;
        const z = cz - facing.z * back;
        const step = MeshBuilder.CreateBox('step', {
          width: alongX ? length : stepD, depth: alongX ? stepD : length, height: stepH * (r + 1)
        }, scene);
        step.position.set(x, (stepH * (r + 1)) / 2, z);
        stepMeshes.push(step);
        // torcedores neste degrau
        const n = Math.floor(length / 0.62);
        for (let i = 0; i < n; i++) {
          if (Math.random() < 0.18) continue; // lugares vazios
          const t = (i + 0.5) / n - 0.5 + (Math.random() - 0.5) * 0.02;
          const px = alongX ? cx + t * length : x;
          const pz = alongX ? z : cz + t * length;
          spectators.push({ x: px, y: stepH * (r + 1), z: pz, facing, phase: Math.random() * Math.PI * 2 });
        }
      }
    };
    addStand(0, W / 2 + 1.6, L * 0.8, new Vector3(0, 0, -1));
    addStand(-(L / 2 + gd + 1.8), 0, W * 0.75, new Vector3(1, 0, 0));
    addStand(L / 2 + gd + 1.8, 0, W * 0.75, new Vector3(-1, 0, 0));

    const stands = Mesh.MergeMeshes(stepMeshes, true, true);
    stands.name = 'stands';
    stands.material = seatMat;
    this.staticMeshes.push(stands);

    this.buildCrowd(spectators);
  }

  /** Uma única malha com todos os torcedores (1 draw call), animada por atualização de vértices. */
  buildCrowd(spectators) {
    const { texture, cols, rows } = createCrowdAtlas(this.scene);
    const positions = new Float32Array(spectators.length * 12);
    const uvs = new Float32Array(spectators.length * 8);
    const indices = new Uint32Array(spectators.length * 6);
    const w = 0.62, h = 1.25;
    spectators.forEach((s, i) => {
      // vetor lateral (perpendicular à direção que olham)
      const sx = -s.facing.z, sz = s.facing.x;
      const sc = 0.9 + Math.random() * 0.2;
      const hw = (w * sc) / 2, hh = h * sc;
      const base = s.y - 0.1;
      const p = [
        s.x - sx * hw, base, s.z - sz * hw,
        s.x + sx * hw, base, s.z + sz * hw,
        s.x + sx * hw, base + hh, s.z + sz * hw,
        s.x - sx * hw, base + hh, s.z - sz * hw
      ];
      positions.set(p, i * 12);
      const cell = (Math.random() * cols * rows) | 0;
      const cu = (cell % cols) / cols, cv = Math.floor(cell / cols) / rows;
      const du = 1 / cols, dv = 1 / rows;
      // v=0 na base da textura (DynamicTexture tem invertY)
      uvs.set([cu, 1 - cv - dv, cu + du, 1 - cv - dv, cu + du, 1 - cv, cu, 1 - cv], i * 8);
      const o = i * 4;
      indices.set([o, o + 1, o + 2, o, o + 2, o + 3], i * 6);
    });
    const mesh = new Mesh('crowd', this.scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.uvs = uvs;
    vd.indices = indices;
    const normals = new Float32Array(positions.length);
    spectators.forEach((s, i) => {
      for (let k = 0; k < 4; k++) normals.set([s.facing.x, 0.3, s.facing.z], i * 12 + k * 3);
    });
    vd.normals = normals;
    vd.applyToMesh(mesh, true);
    const m = mat(this.scene, 'crowdMat', { texture });
    texture.hasAlpha = true;
    m.useAlphaFromDiffuseTexture = false;
    m.transparencyMode = 1; // ALPHATEST
    m.alphaCutOff = 0.4;
    m.backFaceCulling = false;
    m.emissiveColor = new Color3(0.25, 0.25, 0.28);
    mesh.material = m;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    this.crowd = { mesh, base: positions.slice(), positions, spectators };
  }

  buildWalls() {
    const scene = this.scene;
    const L = FIELD.length, W = FIELD.width;
    const size = this.quality.shadowMap >= 1024 ? 2048 : 1024;
    const wall = (name, seed, x, z, len, rotY) => {
      const h = 6;
      const p = MeshBuilder.CreatePlane(name, { width: len, height: h }, scene);
      p.position.set(x, h / 2, z);
      p.rotation.y = rotY;
      const m = mat(scene, name + 'Mat', { texture: createGraffitiWallTexture(scene, seed, size, size / 4) });
      m.emissiveColor = new Color3(0.18, 0.18, 0.2);
      p.material = m;
      this.staticMeshes.push(p);
      // topo do muro
      const cap = MeshBuilder.CreateBox(name + 'Cap', { width: len, height: 0.25, depth: 0.4 }, scene);
      cap.position.set(x, h, z);
      cap.rotation.y = rotY;
      cap.material = scene.getMaterialByName('concreteMat');
      this.staticMeshes.push(cap);
    };
    wall('wallFar', 1, 0, W / 2 + 6.5, L + 26, 0);
    wall('wallLeft', 2, -(L / 2 + 7), 0, W + 14, -Math.PI / 2);
    wall('wallRight', 3, L / 2 + 7, 0, W + 14, Math.PI / 2);
  }

  buildFloodlights() {
    const scene = this.scene;
    const L = FIELD.length, W = FIELD.width;
    const poleMat = mat(scene, 'poleMat', { diffuse: new Color3(0.25, 0.26, 0.28), specular: new Color3(0.3, 0.3, 0.3) });
    const lampMat = mat(scene, 'lampMat', { diffuse: Color3.Black(), emissive: new Color3(1, 0.97, 0.85) });
    lampMat.disableLighting = true;
    const glowMat = mat(scene, 'glowMat', { diffuse: Color3.Black() });
    glowMat.emissiveTexture = createGlowTexture(scene);
    glowMat.opacityTexture = glowMat.emissiveTexture;
    glowMat.disableLighting = true;
    glowMat.alphaMode = 1; // ADD
    glowMat.fogEnabled = false;
    const parts = [];
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [sx, sz] of corners) {
      const x = sx * (L / 2 + 3), z = sz * (W / 2 + 3.5), h = 13;
      const pole = MeshBuilder.CreateCylinder('pole', { height: h, diameterTop: 0.22, diameterBottom: 0.38, tessellation: 8 }, scene);
      pole.position.set(x, h / 2, z);
      parts.push(pole);
      const head = MeshBuilder.CreateBox('lampHead', { width: 2.2, height: 1.1, depth: 0.3 }, scene);
      head.position.set(x - sx * 0.3, h + 0.4, z - sz * 0.3);
      head.lookAt(new Vector3(0, 0, 0));
      head.material = lampMat;
      this.staticMeshes.push(head);
      const glow = MeshBuilder.CreatePlane('lampGlow', { size: 6 }, scene);
      glow.position.copyFrom(head.position);
      glow.billboardMode = Mesh.BILLBOARDMODE_ALL;
      glow.material = glowMat;
      glow.isPickable = false;
    }
    const poles = Mesh.MergeMeshes(parts, true, true);
    poles.material = poleMat;
    this.staticMeshes.push(poles);
  }

  buildCity() {
    const scene = this.scene;
    const winTex = createWindowsTexture(scene);
    const parts = [];
    const rnd = (a, b) => a + Math.random() * (b - a);
    const place = (x, z, w, d) => {
      const h = rnd(12, 40);
      const b = MeshBuilder.CreateBox('bld', { width: w, depth: d, height: h }, scene);
      b.position.set(x, h / 2, z);
      parts.push(b);
    };
    for (let x = -70; x <= 70; x += rnd(9, 14)) place(x, rnd(38, 55), rnd(7, 12), rnd(7, 12));
    for (let z = -30; z <= 30; z += rnd(10, 14)) {
      place(-rnd(48, 60), z, rnd(7, 12), rnd(7, 12));
      place(rnd(48, 60), z, rnd(7, 12), rnd(7, 12));
    }
    const city = Mesh.MergeMeshes(parts, true, true);
    const m = mat(scene, 'cityMat', { diffuse: new Color3(0.08, 0.08, 0.1) });
    m.emissiveTexture = winTex;
    winTex.uScale = 2; winTex.vScale = 3;
    m.emissiveColor = new Color3(0.9, 0.9, 0.9);
    city.material = m;
    this.staticMeshes.push(city);
  }

  /** Bola x muretas/alambrado. Gols cuidam de traves e redes. Retorna lista de eventos. */
  resolveBallCollisions(ball) {
    const events = [];
    const p = ball.position, v = ball.velocity, r = ball.radius;
    const hw = FIELD.width / 2, hl = FIELD.length / 2;
    const e = BALL.wallRestitution;

    // laterais
    if (p.z + r > hw) {
      p.z = hw - r;
      if (v.z > 0) { if (v.z > 2) events.push({ type: 'wall', strength: v.z }); v.z = -v.z * e; v.x *= 0.92; }
    } else if (p.z - r < -hw) {
      p.z = -hw + r;
      if (v.z < 0) { if (-v.z > 2) events.push({ type: 'wall', strength: -v.z }); v.z = -v.z * e; v.x *= 0.92; }
    }
    // fundos: bloqueiam tudo fora da boca do gol
    const inMouth = Math.abs(p.z) < FIELD.goalWidth / 2 && p.y < FIELD.goalHeight;
    const inGoalBox = Math.abs(p.x) > hl; // já dentro do recuo do gol
    if (!inMouth && !inGoalBox) {
      if (p.x + r > hl) {
        p.x = hl - r;
        if (v.x > 0) { if (v.x > 2) events.push({ type: 'wall', strength: v.x }); v.x = -v.x * e; v.z *= 0.92; }
      } else if (p.x - r < -hl) {
        p.x = -hl + r;
        if (v.x < 0) { if (-v.x > 2) events.push({ type: 'wall', strength: -v.x }); v.x = -v.x * e; v.z *= 0.92; }
      }
    }
    // teto invisível da gaiola (evita bola sumir no céu)
    if (p.y + r > FIELD.fenceHeight + 3) {
      p.y = FIELD.fenceHeight + 3 - r;
      if (v.y > 0) v.y = -v.y * 0.5;
    }
    for (const g of [this.goals.positive, this.goals.negative]) {
      const ev = g.collideBall(ball);
      if (ev) events.push(ev);
    }
    return events;
  }

  /** Torcida comemora (0..1). */
  celebrate(amount = 1) {
    this.excitement = Math.max(this.excitement, amount);
  }

  update(dt) {
    this.time += dt;
    this.goals.positive.update(dt);
    this.goals.negative.update(dt);
    this.excitement = Math.max(0, this.excitement - dt * 0.18);

    if (this.crowd && this.quality.crowdAnim) {
      const { base, positions, spectators, mesh } = this.crowd;
      const ex = this.excitement;
      const t = this.time;
      for (let i = 0; i < spectators.length; i++) {
        const s = spectators[i];
        const idle = Math.sin(t * 2 + s.phase) * 0.02;
        const jump = ex * Math.max(0, Math.sin(t * 9 + s.phase)) * 0.35;
        const dy = idle + jump;
        const o = i * 12;
        positions[o + 1] = base[o + 1] + dy;
        positions[o + 4] = base[o + 4] + dy;
        positions[o + 7] = base[o + 7] + dy;
        positions[o + 10] = base[o + 10] + dy;
      }
      mesh.updateVerticesData('position', positions, false, false);
    }
  }
}
