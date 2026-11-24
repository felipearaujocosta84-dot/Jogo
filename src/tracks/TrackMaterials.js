// =============================================================
// EXTREME RACING — TrackMaterials
// Materiais PBR das pistas com texturas procedurais geradas em
// canvas (asfalto com agregados e mapa de normais, zebras, grama,
// brita, areia, muro, guard-rail, quadriculado, arquibancada).
// Se existir uma textura em public/assets/textures/<nome>.jpg ela
// pode substituir a procedural (ver README).
// =============================================================
import { DynamicTexture, PBRMaterial, StandardMaterial, Color3, Texture } from '@babylonjs/core';
import { mulberry32, fbm } from '../utils/MathUtils.js';

function makeCanvasTexture(scene, name, size, draw, { wrap = true, hasAlpha = false } = {}) {
  const tex = new DynamicTexture(name, { width: size, height: size }, scene, true);
  const ctx = tex.getContext();
  draw(ctx, size);
  tex.hasAlpha = hasAlpha;
  tex.update(true);
  if (wrap) {
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
  }
  tex.anisotropicFilteringLevel = 8;
  return tex;
}

/** Preenche com ruído por pixel (cores em 0..255). */
function noiseFill(ctx, size, seed, colorFn) {
  const img = ctx.createImageData(size, size);
  const rnd = mulberry32(seed);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const [r, g, b] = colorFn(x, y, rnd);
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Converte um campo de altura em mapa de normais (tangente). */
function normalMapFromHeight(scene, name, size, heightFn, strength = 2) {
  return makeCanvasTexture(scene, name, size, (ctx) => {
    const h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = heightFn(x, y);
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
        const u = h[((y - 1 + size) % size) * size + x], dn = h[((y + 1) % size) * size + x];
        let nx = (l - r) * strength, ny = (u - dn) * strength, nz = 1;
        const len = Math.hypot(nx, ny, nz);
        nx /= len; ny /= len; nz /= len;
        const i = (y * size + x) * 4;
        d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

export class TrackMaterials {
  /**
   * @param {object} photo texturas fotográficas encontradas em public/assets/textures
   *                       (ex.: { asphalt_albedo: 'assets/textures/asphalt_albedo.jpg' })
   */
  constructor(scene, graphicsPreset, photo = {}) {
    this.scene = scene;
    this.photo = photo;
    this.size = graphicsPreset?.textureSize ?? 1024;
    this.useBump = (graphicsPreset?.textureSize ?? 1024) >= 1024;
    this.cache = {};
  }

  get(name) {
    if (!this.cache[name]) this.cache[name] = this['_' + name]();
    return this.cache[name];
  }

  /** Textura de arquivo (repetida), se o jogador colocou uma foto em assets/textures. */
  _photoTex(key, uScale = 1, vScale = 1) {
    const url = this.photo[key];
    if (!url) return null;
    const t = new Texture(url, this.scene, false, true, Texture.TRILINEAR_SAMPLINGMODE, null, (msg) => {
      console.warn(`[Textura] falha ao carregar ${url}:`, msg);
    });
    t.wrapU = Texture.WRAP_ADDRESSMODE;
    t.wrapV = Texture.WRAP_ADDRESSMODE;
    t.uScale = uScale;
    t.vScale = vScale;
    t.anisotropicFilteringLevel = 8;
    return t;
  }

  _asphalt() {
    const S = this.size;
    // Pixel aleatório determinístico (agregado do asfalto)
    const rndAt = (x, y) => {
      let h = (x * 374761393 + y * 668265263) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const tex = makeCanvasTexture(this.scene, 'asphaltTex', S, (ctx, size) => {
      noiseFill(ctx, size, 7, (x, y) => {
        const n = fbm(x / 40, y / 40, 4, 3);
        const g = rndAt(x, y);
        let v = 52 + n * 28 + (g > 0.93 ? 38 : g < 0.05 ? -20 : (g - 0.5) * 18);
        // marcas de pneu na faixa central de cada metade (linha de corrida)
        const u = x / size;
        const rubber = Math.exp(-((u - 0.42) ** 2) / 0.004) * 10 + Math.exp(-((u - 0.58) ** 2) / 0.004) * 10;
        v -= rubber * (0.6 + 0.4 * fbm(x / 9, y / 90, 2, 11));
        return [v, v, v * 1.03];
      });
      // Linhas brancas de borda (u em 0..1 atravessa a pista)
      ctx.fillStyle = 'rgba(235,235,230,0.95)';
      ctx.fillRect(size * 0.012, 0, size * 0.022, size);
      ctx.fillRect(size * 0.966, 0, size * 0.022, size);
    });
    const mat = new PBRMaterial('asphalt', this.scene);
    mat.albedoTexture = this._photoTex('asphalt_albedo', 2, 1) ?? tex;
    this.asphaltIsPhoto = !!this.photo.asphalt_albedo;
    mat.metallic = 0;
    mat.roughness = 0.88;
    mat.environmentIntensity = 0.35;
    const photoNrm = this._photoTex('asphalt_normal', 2, 1);
    if (photoNrm) mat.bumpTexture = photoNrm;
    else if (this.useBump) {
      mat.bumpTexture = normalMapFromHeight(this.scene, 'asphaltNrm', Math.min(512, S), (x, y) => rndAt(x * 2, y * 2) * 0.6 + fbm(x / 20, y / 20, 3, 5) * 0.4, 3);
      mat.bumpTexture.level = 0.6;
    }
    mat._dryRoughness = 0.88;
    return mat;
  }

  _kerb() {
    const tex = makeCanvasTexture(this.scene, 'kerbTex', 256, (ctx, size) => {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#f2f2f2' : '#d1121b';
        ctx.fillRect(0, (i * size) / 4, size, size / 4);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let k = 0; k < 400; k++) ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    });
    const mat = new PBRMaterial('kerb', this.scene);
    mat.albedoTexture = tex;
    mat.metallic = 0;
    mat.roughness = 0.6;
    return mat;
  }

  _ground(name, base, variation, seed, roughness = 0.95, scale = 1) {
    const S = Math.min(512, this.size);
    const tex = makeCanvasTexture(this.scene, `${name}Tex`, S, (ctx, size) => {
      noiseFill(ctx, size, seed, (x, y, rnd) => {
        const n = fbm(x / (30 * scale), y / (30 * scale), 4, seed);
        const g = rnd();
        const f = 0.75 + n * 0.5 + (g - 0.5) * variation;
        return [base[0] * f, base[1] * f, base[2] * f];
      });
    });
    const mat = new PBRMaterial(name, this.scene);
    const photoKey = { grass: 'grass_albedo', terrainGrass: 'grass_albedo', rock: 'rock_albedo', sandstone: 'rock_albedo', sand: 'sand_albedo', terrainSand: 'sand_albedo', beach: 'sand_albedo' }[name];
    mat.albedoTexture = (photoKey && this._photoTex(photoKey)) || tex;
    mat.metallic = 0;
    mat.roughness = roughness;
    mat.environmentIntensity = 0.2;
    return mat;
  }

  _grass() { return this._ground('grass', [70, 112, 46], 0.25, 21); }
  _gravel() { return this._ground('gravel', [150, 142, 128], 0.6, 33, 0.98, 0.4); }
  _sand() { return this._ground('sand', [205, 170, 118], 0.12, 44, 0.96, 2); }
  _dirt() { return this._ground('dirt', [112, 88, 60], 0.3, 55); }
  _rock() { return this._ground('rock', [118, 108, 98], 0.4, 66, 0.9, 0.6); }
  _sandstone() { return this._ground('sandstone', [176, 96, 58], 0.35, 67, 0.92, 0.5); }
  _terrainGrass() { return this._ground('terrainGrass', [62, 98, 40], 0.2, 77, 0.97, 3); }
  _terrainSand() { return this._ground('terrainSand', [196, 156, 104], 0.1, 88, 0.97, 4); }
  _beach() { return this._ground('beach', [222, 200, 152], 0.12, 99, 0.95, 2); }

  _wall() {
    const tex = makeCanvasTexture(this.scene, 'wallTex', 256, (ctx, size) => {
      noiseFill(ctx, size, 5, (x, y, rnd) => { const v = 190 + (rnd() - 0.5) * 20; return [v, v, v]; });
      // faixas de patrocínio fictício alternadas
      for (let i = 0; i < 2; i++) {
        ctx.fillStyle = i ? '#c8102e' : '#101418';
        ctx.fillRect(i * size / 2, size * 0.35, size / 2, size * 0.3);
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${size * 0.16}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('EXTREME', size * 0.25, size * 0.56);
      ctx.fillText('RACING', size * 0.75, size * 0.56);
    });
    const mat = new PBRMaterial('wall', this.scene);
    mat.albedoTexture = tex;
    mat.metallic = 0;
    mat.roughness = 0.8;
    return mat;
  }

  _guardrail() {
    const mat = new PBRMaterial('guardrail', this.scene);
    mat.albedoColor = new Color3(0.72, 0.74, 0.76);
    mat.metallic = 0.85;
    mat.roughness = 0.35;
    return mat;
  }

  _tirewall() {
    const tex = makeCanvasTexture(this.scene, 'tireTex', 256, (ctx, size) => {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, size, size);
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const x = (c + 0.5) * size / 4, y = (r + 0.5) * size / 4;
          ctx.fillStyle = (r + c) % 2 ? '#1d1d1d' : '#262626';
          ctx.beginPath(); ctx.arc(x, y, size / 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#0a0a0a';
          ctx.beginPath(); ctx.arc(x, y, size / 22, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.fillStyle = '#e6e6e6';
      ctx.fillRect(0, size * 0.45, size, size * 0.1);
    });
    const mat = new PBRMaterial('tirewall', this.scene);
    mat.albedoTexture = tex;
    mat.metallic = 0;
    mat.roughness = 0.9;
    return mat;
  }

  _checker() {
    const tex = makeCanvasTexture(this.scene, 'checkerTex', 256, (ctx, size) => {
      const n = 8;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4';
        ctx.fillRect((x * size) / n, (y * size) / n, size / n, size / n);
      }
    });
    const mat = new PBRMaterial('checker', this.scene);
    mat.albedoTexture = tex;
    mat.metallic = 0;
    mat.roughness = 0.7;
    return mat;
  }

  _crowd() {
    const tex = makeCanvasTexture(this.scene, 'crowdTex', 512, (ctx, size) => {
      ctx.fillStyle = '#2a2f36';
      ctx.fillRect(0, 0, size, size);
      const rnd = mulberry32(12);
      const colors = ['#d23', '#fff', '#29f', '#fc2', '#1a1', '#f60', '#333', '#eee', '#a3f'];
      for (let y = 6; y < size; y += 14) {
        for (let x = 4; x < size; x += 9) {
          if (rnd() < 0.15) continue;
          ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
          ctx.fillRect(x + rnd() * 2, y, 6, 8);
          ctx.fillStyle = '#e0b48c';
          ctx.fillRect(x + 1 + rnd() * 2, y - 4, 4, 4);
        }
      }
    });
    const mat = new StandardMaterial('crowd', this.scene);
    mat.diffuseTexture = tex;
    mat.specularColor = new Color3(0, 0, 0);
    return mat;
  }

  _concrete() { return this._ground('concrete', [168, 166, 160], 0.15, 101, 0.85, 1); }

  _building() { return this._facade('building', '#c9ccd0', 31); }
  _building2() { return this._facade('building2', '#b98f6b', 47); }
  _building3() { return this._facade('building3', '#5f7486', 59); }

  _facade(name, wall, seed) {
    const tex = makeCanvasTexture(this.scene, `${name}Tex`, 512, (ctx, size) => {
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, size, size);
      const rnd = mulberry32(seed);
      for (let y = 10; y < size; y += 32) {
        for (let x = 8; x < size; x += 26) {
          const lit = rnd();
          ctx.fillStyle = lit > 0.75 ? '#f6e7a8' : lit > 0.4 ? '#3c5066' : '#25313e';
          ctx.fillRect(x, y, 16, 20);
        }
      }
    });
    tex.uScale = 2; tex.vScale = 3;
    const mat = new PBRMaterial(name, this.scene);
    mat.albedoTexture = tex;
    mat.emissiveTexture = tex;
    mat.emissiveColor = new Color3(0.0, 0.0, 0.0);
    mat.metallic = 0.1;
    mat.roughness = 0.55;
    return mat;
  }

  _garage() {
    const tex = makeCanvasTexture(this.scene, 'garageTex', 1024, (ctx, size) => {
      ctx.fillStyle = '#e8eaec';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#c8102e';
      ctx.fillRect(0, 0, size, size * 0.12);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${size * 0.07}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('EXTREME RACING  •  PIT LANE', size / 2, size * 0.09);
      for (let i = 0; i < 6; i++) {
        const x = (i + 0.08) * size / 6;
        ctx.fillStyle = '#2a3038';
        ctx.fillRect(x, size * 0.3, size / 6 * 0.84, size * 0.7);
        ctx.fillStyle = '#3b434d';
        for (let k = 0; k < 12; k++) ctx.fillRect(x, size * 0.3 + k * size * 0.058, size / 6 * 0.84, 3);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${size * 0.05}px sans-serif`;
        ctx.fillText(String(i + 1).padStart(2, '0'), x + size / 12 * 0.84, size * 0.26);
      }
    });
    const mat = new PBRMaterial('garage', this.scene);
    mat.albedoTexture = tex;
    mat.metallic = 0.1;
    mat.roughness = 0.6;
    return mat;
  }

  _tunnel() {
    const tex = makeCanvasTexture(this.scene, 'tunnelTex', 256, (ctx, size) => {
      noiseFill(ctx, size, 13, (x, y, rnd) => { const v = 150 + (rnd() - 0.5) * 26; return [v, v, v * 0.98]; });
      ctx.fillStyle = 'rgba(40,40,40,0.5)';
      for (let k = 0; k < size; k += size / 4) ctx.fillRect(k, 0, 3, size);
      ctx.fillStyle = '#e8c21a';
      ctx.fillRect(0, size * 0.9, size, size * 0.05);
    });
    tex.uScale = 4; tex.vScale = 50; // u: em volta do arco, v: ao longo do túnel
    const mat = new PBRMaterial('tunnel', this.scene);
    mat.albedoTexture = tex;
    mat.metallic = 0;
    mat.roughness = 0.85;
    return mat;
  }

  _mirage() {
    const mat = new PBRMaterial('mirage', this.scene);
    mat.albedoColor = new Color3(0.55, 0.62, 0.72);
    mat.metallic = 0;
    mat.roughness = 0.02;
    mat.environmentIntensity = 1.6;
    mat.zOffset = -5;
    return mat;
  }

  _water() {
    const mat = new PBRMaterial('water', this.scene);
    mat.albedoColor = new Color3(0.02, 0.12, 0.2);
    mat.metallic = 0.0;
    mat.roughness = 0.08;
    mat.alpha = 0.92;
    mat.environmentIntensity = 1.4;
    mat.bumpTexture = normalMapFromHeight(this.scene, 'waterNrm', 256, (x, y) => fbm(x / 14, y / 14, 3, 9), 4);
    mat.bumpTexture.uScale = 60;
    mat.bumpTexture.vScale = 60;
    return mat;
  }

  _foliage() {
    const mat = new PBRMaterial('foliage', this.scene);
    mat.albedoColor = new Color3(0.13, 0.28, 0.1);
    mat.metallic = 0;
    mat.roughness = 0.9;
    return mat;
  }

  _pine() {
    const mat = new PBRMaterial('pine', this.scene);
    mat.albedoColor = new Color3(0.07, 0.18, 0.09);
    mat.metallic = 0;
    mat.roughness = 0.92;
    return mat;
  }

  _trunk() {
    const mat = new PBRMaterial('trunk', this.scene);
    mat.albedoColor = new Color3(0.28, 0.19, 0.12);
    mat.metallic = 0;
    mat.roughness = 0.95;
    return mat;
  }

  _metal() {
    const mat = new PBRMaterial('metal', this.scene);
    mat.albedoColor = new Color3(0.55, 0.57, 0.6);
    mat.metallic = 0.8;
    mat.roughness = 0.4;
    return mat;
  }

  _darkMetal() {
    const mat = new PBRMaterial('darkMetal', this.scene);
    mat.albedoColor = new Color3(0.08, 0.09, 0.1);
    mat.metallic = 0.6;
    mat.roughness = 0.5;
    return mat;
  }

  _glassDark() {
    const mat = new PBRMaterial('glassDark', this.scene);
    mat.albedoColor = new Color3(0.05, 0.08, 0.1);
    mat.metallic = 0.3;
    mat.roughness = 0.1;
    return mat;
  }

  _lamp() {
    const mat = new StandardMaterial('lamp', this.scene);
    mat.emissiveColor = new Color3(1, 0.95, 0.8);
    mat.disableLighting = true;
    return mat;
  }

  _puddle() {
    const mat = new PBRMaterial('puddle', this.scene);
    mat.albedoColor = new Color3(0.03, 0.035, 0.04);
    mat.metallic = 0.0;
    mat.roughness = 0.03;
    mat.alpha = 0.85;
    mat.environmentIntensity = 1.5;
    return mat;
  }
}
