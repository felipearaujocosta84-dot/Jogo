// =============================================================
// EXTREME RACING — CarModelFactory
// Constrói o modelo 3D do carro. Se existir um GLB licenciado em
// public/assets/cars/<arquivo>.glb ele é usado; caso contrário é
// gerado um modelo procedural detalhado (carroceria esculpida por
// seções, cabine envidraçada, faróis, lanternas, retrovisores,
// aerofólio, rodas com aros e freios, interior com bancos, painel
// e volante). Coordenadas do modelo: solo em y = 0, +Z frente.
// =============================================================
import {
  MeshBuilder, Mesh, TransformNode, Vector3, Color3, PBRMaterial, StandardMaterial,
  DynamicTexture, SceneLoader,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { glbExists } from '../core/AssetManager.js';

const STYLE = {
  gt: { nose: 0.62, hood: 0.86, belt: 0.9, tail: 0.86, roof: 1.26, cabinFront: 0.08, cabinRear: -1.25, cabinWidth: 0.72, glassRake: 0.95, wing: 0 },
  super: { nose: 0.5, hood: 0.72, belt: 0.86, tail: 0.9, roof: 1.17, cabinFront: 0.55, cabinRear: -0.75, cabinWidth: 0.68, glassRake: 1.1, wing: 1 },
  hyper: { nose: 0.44, hood: 0.64, belt: 0.82, tail: 0.92, roof: 1.11, cabinFront: 0.6, cabinRear: -0.55, cabinWidth: 0.64, glassRake: 1.2, wing: 2 },
};

/** Materiais compartilhados por carro (pintura pode ser trocada na garagem). */
export function createCarMaterials(scene, colors, finish = 'metallic') {
  const paint = new PBRMaterial('paint', scene);
  paint.albedoColor = Color3.FromHexString(colors.paint).toLinearSpace();
  paint.metallic = finish === 'matte' ? 0.1 : 0.55;
  paint.roughness = finish === 'matte' ? 0.6 : 0.28;
  paint.clearCoat.isEnabled = finish !== 'matte';
  paint.clearCoat.intensity = 0.9;
  paint.clearCoat.roughness = 0.06;
  paint.environmentIntensity = 0.9;

  const glass = new PBRMaterial('glass', scene);
  glass.albedoColor = new Color3(0.02, 0.03, 0.04);
  glass.metallic = 0.1;
  glass.roughness = 0.05;
  glass.alpha = 0.55;
  glass.environmentIntensity = 1.2;
  glass.backFaceCulling = false;

  const trim = new PBRMaterial('trim', scene);
  trim.albedoColor = new Color3(0.03, 0.03, 0.035);
  trim.metallic = 0.2;
  trim.roughness = 0.55;

  const chrome = new PBRMaterial('chrome', scene);
  chrome.albedoColor = new Color3(0.85, 0.86, 0.88);
  chrome.metallic = 1;
  chrome.roughness = 0.15;

  const rim = new PBRMaterial('rim', scene);
  rim.albedoColor = Color3.FromHexString(colors.rim).toLinearSpace();
  rim.metallic = 0.9;
  rim.roughness = 0.3;

  const tire = new PBRMaterial('tire', scene);
  tire.albedoColor = new Color3(0.035, 0.035, 0.035);
  tire.metallic = 0;
  tire.roughness = 0.9;

  const caliper = new PBRMaterial('caliper', scene);
  caliper.albedoColor = new Color3(0.75, 0.05, 0.05);
  caliper.metallic = 0.3;
  caliper.roughness = 0.4;

  const disc = new PBRMaterial('disc', scene);
  disc.albedoColor = new Color3(0.35, 0.35, 0.36);
  disc.metallic = 0.9;
  disc.roughness = 0.45;

  const headlight = new StandardMaterial('headlight', scene);
  headlight.diffuseColor = new Color3(0.9, 0.95, 1);
  headlight.emissiveColor = new Color3(0.55, 0.6, 0.65);
  headlight.specularColor = new Color3(1, 1, 1);

  const taillight = new StandardMaterial('taillight', scene);
  taillight.diffuseColor = new Color3(0.4, 0, 0);
  taillight.emissiveColor = new Color3(0.45, 0.02, 0.02);

  const interior = new PBRMaterial('interior', scene);
  interior.albedoColor = new Color3(0.06, 0.06, 0.065);
  interior.roughness = 0.85;
  interior.metallic = 0;

  const seat = new PBRMaterial('seat', scene);
  seat.albedoColor = new Color3(0.12, 0.02, 0.02);
  seat.roughness = 0.75;
  seat.metallic = 0;

  return { paint, glass, trim, chrome, rim, tire, caliper, disc, headlight, taillight, interior, seat };
}

/** Painel de instrumentos com textura dinâmica (conta-giros + velocímetro). */
function createDashTexture(scene) {
  const tex = new DynamicTexture('dashTex', { width: 512, height: 192 }, scene, false);
  tex.hasAlpha = false;
  return tex;
}

export function drawDash(tex, speedKmh, rpm, maxRpm, gear) {
  const ctx = tex.getContext();
  const W = 512, H = 192;
  ctx.fillStyle = '#050607';
  ctx.fillRect(0, 0, W, H);
  // Conta-giros (arco)
  const cx = 150, cy = 110, r = 80;
  const start = Math.PI * 0.8, end = Math.PI * 2.2;
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#1c2228';
  ctx.beginPath(); ctx.arc(cx, cy, r, start, end); ctx.stroke();
  const f = Math.min(1, rpm / maxRpm);
  ctx.strokeStyle = f > 0.9 ? '#ff2d2d' : f > 0.75 ? '#ffb020' : '#34d1ff';
  ctx.beginPath(); ctx.arc(cx, cy, r, start, start + (end - start) * f); ctx.stroke();
  ctx.fillStyle = '#e8eef4';
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(gear === 0 ? 'N' : gear < 0 ? 'R' : String(gear), cx, cy + 18);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#8fa1b3';
  ctx.fillText(`${Math.round(rpm)} rpm`, cx, cy + 52);
  // Velocidade digital
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 86px sans-serif';
  ctx.fillText(String(Math.round(speedKmh)), 470, 120);
  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#8fa1b3';
  ctx.fillText('km/h', 470, 152);
  tex.update();
}

/**
 * Modelo procedural. Retorna { root, wheels:{FL,FR,RL,RR}, steeringWheel, dash, brakeLights, headlights, materials, spoiler }
 */
export function buildProceduralCar(scene, spec, materials) {
  const st = STYLE[spec.style] ?? STYLE.gt;
  const L = spec.dims.length, W = spec.dims.width;
  const hw = W / 2;
  const root = new TransformNode(`car_${spec.id}_model`, scene);
  const parts = [];
  const add = (m, mat) => { m.parent = root; if (mat) m.material = mat; parts.push(m); return m; };

  // ---------- Carroceria inferior (seções transversais) ----------
  const z0 = -L / 2, z1 = L / 2;
  const NZ = 28;
  const lowerPaths = [];
  const profile = (t) => {
    // t: 0 (traseira) .. 1 (frente)
    const z = z0 + (z1 - z0) * t;
    // largura: arredondada nas pontas
    const endRound = Math.min(1, Math.min(t, 1 - t) * 7);
    const w = hw * (0.8 + 0.2 * Math.sqrt(Math.max(0, endRound)));
    // linha de cintura/capô
    let top;
    const frontAxle = spec.wheelbase / 2, cabinF = st.cabinFront;
    if (z > cabinF) {
      const k = (z - cabinF) / (z1 - cabinF);
      top = st.belt + (st.nose - st.belt) * Math.pow(k, 1.6);
    } else if (z < st.cabinRear) {
      const k = (st.cabinRear - z) / (st.cabinRear - z0);
      top = st.belt + (st.tail - st.belt) * k;
    } else top = st.belt;
    // Pára-lamas: levanta levemente sobre as rodas
    const archF = Math.exp(-((z - frontAxle) ** 2) / 0.35) * 0.05;
    const archR = Math.exp(-((z + frontAxle) ** 2) / 0.35) * 0.06;
    top += archF + archR;
    const sill = 0.17 + (t < 0.04 || t > 0.96 ? 0.08 : 0);
    return { z, w, top, sill };
  };
  for (let i = 0; i <= NZ; i++) {
    const t = i / NZ;
    const { z, w, top, sill } = profile(t);
    const path = [];
    const pts = [
      [-w * 0.9, sill], [-w, sill + 0.12], [-w * 1.0, top - 0.22], [-w * 0.97, top - 0.06], [-w * 0.82, top],
      [-w * 0.4, top + 0.025], [0, top + 0.03], [w * 0.4, top + 0.025], [w * 0.82, top], [w * 0.97, top - 0.06],
      [w * 1.0, top - 0.22], [w, sill + 0.12], [w * 0.9, sill],
    ];
    for (const [x, y] of pts) path.push(new Vector3(x, y, z));
    // fecha o fundo
    path.push(new Vector3(-w * 0.9, sill, z));
    lowerPaths.push(path);
  }
  const body = MeshBuilder.CreateRibbon('body', { pathArray: lowerPaths, closeArray: false, closePath: false, sideOrientation: Mesh.DOUBLESIDE }, scene);
  add(body, materials.paint);
  // Tampas frontal e traseira
  const nose = MeshBuilder.CreateBox('nosecap', { width: W * 0.78, height: st.nose - 0.25, depth: 0.04 }, scene);
  nose.position.set(0, (st.nose + 0.25) / 2, z1 - 0.02);
  add(nose, materials.paint);
  const tail = MeshBuilder.CreateBox('tailcap', { width: W * 0.78, height: st.tail - 0.25, depth: 0.04 }, scene);
  tail.position.set(0, (st.tail + 0.25) / 2, z0 + 0.02);
  add(tail, materials.paint);

  // ---------- Cabine envidraçada ----------
  const cabPaths = [];
  const NC = 14;
  const cf = st.cabinFront, cr = st.cabinRear;
  for (let i = 0; i <= NC; i++) {
    const t = i / NC;
    const z = cr + (cf - cr) * t;
    // perfil do teto: sobe rápido no para-brisa, cai na traseira
    const front = Math.min(1, (1 - t) * 3.2 * st.glassRake);
    const rear = Math.min(1, t * 2.6);
    const h = Math.max(0, Math.min(front, rear));
    const roofY = st.belt + (st.roof - st.belt) * Math.sin((h * Math.PI) / 2);
    const cw = hw * st.cabinWidth * (0.82 + 0.18 * h);
    const p = [
      new Vector3(-cw * 1.08, st.belt, z),
      new Vector3(-cw * 0.98, st.belt + (roofY - st.belt) * 0.55, z),
      new Vector3(-cw * 0.78, roofY, z),
      new Vector3(cw * 0.78, roofY, z),
      new Vector3(cw * 0.98, st.belt + (roofY - st.belt) * 0.55, z),
      new Vector3(cw * 1.08, st.belt, z),
    ];
    cabPaths.push(p);
  }
  const cabin = MeshBuilder.CreateRibbon('cabin', { pathArray: cabPaths, sideOrientation: Mesh.DOUBLESIDE }, scene);
  add(cabin, materials.glass);
  // Teto pintado (painel central)
  const roofPaths = [];
  for (let i = 2; i <= NC - 3; i++) {
    const src = cabPaths[i];
    roofPaths.push([
      src[2].add(new Vector3(0.03, 0.012, 0)),
      new Vector3(0, src[2].y + 0.02, src[2].z),
      src[3].add(new Vector3(-0.03, 0.012, 0)),
    ]);
  }
  const roof = MeshBuilder.CreateRibbon('roof', { pathArray: roofPaths, sideOrientation: Mesh.DOUBLESIDE }, scene);
  add(roof, materials.paint);
  // Colunas A
  for (const sx of [-1, 1]) {
    const a = cabPaths[NC - 1][sx < 0 ? 1 : 4];
    const b = cabPaths[NC - 3][sx < 0 ? 2 : 3];
    const pillar = MeshBuilder.CreateTube('pillar', { path: [cabPaths[NC][sx < 0 ? 0 : 5], a, b], radius: 0.035, tessellation: 6 }, scene);
    add(pillar, materials.trim);
  }

  // ---------- Detalhes externos ----------
  const frontZ = z1 - 0.12;
  const headlights = [];
  for (const sx of [-1, 1]) {
    const hl = MeshBuilder.CreateBox('headlight', { width: 0.42, height: 0.09, depth: 0.22 }, scene);
    hl.position.set(sx * (hw - 0.32), st.nose - 0.06, frontZ - 0.08);
    hl.rotation.x = -0.25;
    add(hl, materials.headlight);
    headlights.push(hl);
    const drl = MeshBuilder.CreateBox('drl', { width: 0.36, height: 0.018, depth: 0.05 }, scene);
    drl.position.set(sx * (hw - 0.32), st.nose - 0.13, frontZ + 0.03);
    add(drl, materials.headlight);
  }
  const grille = MeshBuilder.CreateBox('grille', { width: W * 0.5, height: 0.16, depth: 0.05 }, scene);
  grille.position.set(0, 0.36, z1 - 0.01);
  add(grille, materials.trim);
  const splitter = MeshBuilder.CreateBox('splitter', { width: W * 0.86, height: 0.03, depth: 0.25 }, scene);
  splitter.position.set(0, 0.2, z1 - 0.1);
  add(splitter, materials.trim);

  const brakeLights = [];
  for (const sx of [-1, 1]) {
    const tl = MeshBuilder.CreateBox('taillight', { width: 0.5, height: 0.07, depth: 0.05 }, scene);
    tl.position.set(sx * (hw - 0.34), st.tail - 0.1, z0 + 0.0);
    add(tl, materials.taillight);
    brakeLights.push(tl);
  }
  const lightBar = MeshBuilder.CreateBox('lightbar', { width: W * 0.55, height: 0.02, depth: 0.04 }, scene);
  lightBar.position.set(0, st.tail - 0.1, z0 + 0.0);
  add(lightBar, materials.taillight);
  brakeLights.push(lightBar);
  const diffuser = MeshBuilder.CreateBox('diffuser', { width: W * 0.7, height: 0.12, depth: 0.3 }, scene);
  diffuser.position.set(0, 0.24, z0 + 0.12);
  diffuser.rotation.x = 0.25;
  add(diffuser, materials.trim);
  for (const sx of [-1, 1]) {
    const ex = MeshBuilder.CreateCylinder('exhaust', { diameter: 0.1, height: 0.18, tessellation: 12 }, scene);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(sx * 0.3, 0.3, z0 - 0.04);
    add(ex, materials.chrome);
  }
  // Retrovisores
  for (const sx of [-1, 1]) {
    const arm = MeshBuilder.CreateBox('mirrorArm', { width: 0.12, height: 0.03, depth: 0.05 }, scene);
    arm.position.set(sx * (hw * st.cabinWidth * 1.08 + 0.06), st.belt + 0.08, st.cabinFront - 0.25);
    add(arm, materials.trim);
    const mirror = MeshBuilder.CreateBox('mirror', { width: 0.2, height: 0.11, depth: 0.08 }, scene);
    mirror.position.set(sx * (hw * st.cabinWidth * 1.08 + 0.17), st.belt + 0.11, st.cabinFront - 0.27);
    add(mirror, materials.paint);
    const glassM = MeshBuilder.CreatePlane('mirrorGlass', { width: 0.17, height: 0.08 }, scene);
    glassM.position.set(mirror.position.x, mirror.position.y, mirror.position.z - 0.041); // voltado para trás
    add(glassM, materials.chrome);
  }
  // Saias laterais
  for (const sx of [-1, 1]) {
    const skirt = MeshBuilder.CreateBox('skirt', { width: 0.06, height: 0.08, depth: spec.wheelbase - 0.9 }, scene);
    skirt.position.set(sx * (hw - 0.02), 0.2, 0);
    add(skirt, materials.trim);
  }

  // ---------- Aerofólio ----------
  const spoiler = new TransformNode('spoiler', scene);
  spoiler.parent = root;
  const wingLevel = Math.max(st.wing, spec.wing ?? 0, spec.upgrades?.aero ?? 0);
  if (wingLevel >= 1) {
    const span = W * (wingLevel >= 2 ? 0.92 : 0.8);
    const wing = MeshBuilder.CreateBox('wing', { width: span, height: 0.035, depth: wingLevel >= 2 ? 0.38 : 0.28 }, scene);
    wing.position.set(0, st.tail + (wingLevel >= 2 ? 0.32 : 0.2), z0 + 0.28);
    wing.rotation.x = -0.12;
    wing.parent = spoiler; wing.material = materials.trim;
    for (const sx of [-1, 1]) {
      const post = MeshBuilder.CreateBox('wingPost', { width: 0.04, height: wingLevel >= 2 ? 0.32 : 0.2, depth: 0.12 }, scene);
      post.position.set(sx * span * 0.3, st.tail + (wingLevel >= 2 ? 0.16 : 0.1), z0 + 0.3);
      post.parent = spoiler; post.material = materials.trim;
      const plate = MeshBuilder.CreateBox('endplate', { width: 0.02, height: 0.16, depth: 0.42 }, scene);
      plate.position.set(sx * span / 2, wing.position.y, wing.position.z);
      plate.parent = spoiler; plate.material = materials.paint;
    }
  } else {
    const lip = MeshBuilder.CreateBox('lip', { width: W * 0.7, height: 0.03, depth: 0.12 }, scene);
    lip.position.set(0, st.tail + 0.02, z0 + 0.1);
    lip.rotation.x = -0.3;
    lip.parent = spoiler; lip.material = materials.paint;
  }

  // ---------- Interior ----------
  const cabinMid = (st.cabinFront + st.cabinRear) / 2;
  const driverX = -0.38;
  const floor = MeshBuilder.CreateBox('floor', { width: W * 0.8, height: 0.04, depth: (st.cabinFront - st.cabinRear) * 0.95 }, scene);
  floor.position.set(0, 0.32, cabinMid);
  add(floor, materials.interior);
  for (const sx of [-1, 1]) {
    const seatBase = MeshBuilder.CreateBox('seatBase', { width: 0.5, height: 0.14, depth: 0.5 }, scene);
    seatBase.position.set(sx * 0.38, 0.42, cabinMid - 0.15);
    add(seatBase, materials.seat);
    const seatBack = MeshBuilder.CreateBox('seatBack', { width: 0.5, height: 0.62, depth: 0.12 }, scene);
    seatBack.position.set(sx * 0.38, 0.75, cabinMid - 0.45);
    seatBack.rotation.x = -0.22;
    add(seatBack, materials.seat);
  }
  const dashZ = st.cabinFront - 0.25;
  const dashboard = MeshBuilder.CreateBox('dashboard', { width: W * 0.82, height: 0.2, depth: 0.42 }, scene);
  dashboard.position.set(0, st.belt - 0.06, dashZ);
  add(dashboard, materials.interior);
  const tunnel = MeshBuilder.CreateBox('tunnel', { width: 0.22, height: 0.22, depth: 0.9 }, scene);
  tunnel.position.set(0, 0.44, cabinMid);
  add(tunnel, materials.interior);
  // Painel de instrumentos (textura dinâmica)
  const dashTex = createDashTexture(scene);
  const dashMat = new StandardMaterial('dashMat', scene);
  dashMat.diffuseTexture = dashTex;
  dashMat.emissiveTexture = dashTex;
  dashMat.emissiveColor = new Color3(1, 1, 1);
  dashMat.disableLighting = true;
  const cluster = MeshBuilder.CreatePlane('cluster', { width: 0.34, height: 0.13 }, scene);
  cluster.position.set(driverX, st.belt + 0.02, dashZ - 0.16);
  cluster.rotation.x = -0.35; // o plano já fica voltado para o motorista (−Z)
  add(cluster, dashMat);
  // Volante
  const steeringPivot = new TransformNode('steeringPivot', scene);
  steeringPivot.parent = root;
  steeringPivot.position.set(driverX, st.belt - 0.04, dashZ - 0.34);
  steeringPivot.rotation.x = -0.4;
  const steeringWheel = new TransformNode('steeringWheel', scene);
  steeringWheel.parent = steeringPivot;
  const ring = MeshBuilder.CreateTorus('wheelRing', { diameter: 0.36, thickness: 0.035, tessellation: 28 }, scene);
  ring.rotation.x = Math.PI / 2;
  ring.parent = steeringWheel; ring.material = materials.interior;
  for (const a of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    const spoke = MeshBuilder.CreateBox('spoke', { width: 0.16, height: 0.03, depth: 0.02 }, scene);
    spoke.position.set(Math.cos(a - Math.PI / 2) * 0.08, Math.sin(a - Math.PI / 2) * 0.08, 0);
    spoke.rotation.z = a - Math.PI / 2;
    spoke.parent = steeringWheel; spoke.material = materials.trim;
  }
  const hub = MeshBuilder.CreateCylinder('hub', { diameter: 0.09, height: 0.05, tessellation: 16 }, scene);
  hub.rotation.x = Math.PI / 2;
  hub.parent = steeringWheel; hub.material = materials.trim;
  const column = MeshBuilder.CreateCylinder('column', { diameter: 0.05, height: 0.3, tessellation: 8 }, scene);
  column.rotation.x = Math.PI / 2;
  column.position.z = 0.17;
  column.parent = steeringPivot; column.material = materials.trim;

  // ---------- Rodas ----------
  const wheels = {};
  const r = spec.wheelRadius, ww = spec.wheelWidth;
  const rimStyle = spec.rimStyle ?? 0;
  const mkWheel = (name, x, z) => {
    const pivot = new TransformNode(`wheel_${name}`, scene); // esterço (Y)
    pivot.parent = root; // montada na origem; posicionada após a fusão das peças
    const spin = new TransformNode(`wheelSpin_${name}`, scene); // rotação (X)
    spin.parent = pivot;
    const side = Math.sign(x);
    const tire = MeshBuilder.CreateCylinder('tire', { diameter: r * 2, height: ww, tessellation: 28 }, scene);
    tire.rotation.z = Math.PI / 2;
    tire.parent = spin; tire.material = materials.tire;
    const sidewall = MeshBuilder.CreateTorus('sidewall', { diameter: r * 1.72, thickness: r * 0.28, tessellation: 28 }, scene);
    sidewall.rotation.z = Math.PI / 2;
    sidewall.parent = spin; sidewall.material = materials.tire;
    const rimDisc = MeshBuilder.CreateCylinder('rim', { diameter: r * 1.42, height: ww * 0.9, tessellation: 28 }, scene);
    rimDisc.rotation.z = Math.PI / 2;
    rimDisc.parent = spin; rimDisc.material = materials.trim;
    const face = MeshBuilder.CreateCylinder('rimLip', { diameter: r * 1.46, height: 0.02, tessellation: 28 }, scene);
    face.rotation.z = Math.PI / 2;
    face.position.x = side * ww * 0.46;
    face.parent = spin; face.material = materials.rim;
    const spokes = rimStyle === 1 ? 10 : rimStyle === 2 ? 14 : 5;
    for (let k = 0; k < spokes; k++) {
      const a = (k / spokes) * Math.PI * 2;
      const sp = MeshBuilder.CreateBox('rimSpoke', { width: 0.03, height: r * (rimStyle === 2 ? 0.6 : 0.62), depth: rimStyle === 0 ? 0.08 : 0.04 }, scene);
      sp.position.set(side * ww * 0.48, Math.cos(a) * r * 0.33, Math.sin(a) * r * 0.33);
      sp.rotation.x = -a;
      sp.parent = spin; sp.material = materials.rim;
    }
    const cap = MeshBuilder.CreateCylinder('centerCap', { diameter: r * 0.32, height: 0.03, tessellation: 16 }, scene);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = side * ww * 0.5;
    cap.parent = spin; cap.material = materials.chrome;
    // Disco e pinça (não giram)
    const discM = MeshBuilder.CreateCylinder('brakeDisc', { diameter: r * 1.15, height: 0.03, tessellation: 24 }, scene);
    discM.rotation.z = Math.PI / 2;
    discM.position.x = side * 0.02;
    discM.parent = spin; discM.material = materials.disc;
    const cal = MeshBuilder.CreateBox('caliper', { width: 0.07, height: 0.16, depth: 0.1 }, scene);
    cal.position.set(side * 0.06, r * 0.32, -r * 0.18);
    cal.parent = pivot; cal.material = materials.caliper;
    // Funde as peças que giram em uma malha (menos draw calls no celular)
    const spinParts = spin.getChildMeshes(true);
    const mergedWheel = Mesh.MergeMeshes(spinParts, true, true, undefined, false, true);
    if (mergedWheel) { mergedWheel.name = `wheelMesh_${name}`; mergedWheel.parent = spin; }
    pivot.position.set(x, r, z);
    wheels[name] = { pivot, spin };
  };
  const hwb = spec.wheelbase / 2;
  mkWheel('FL', -spec.trackFront / 2, hwb);
  mkWheel('FR', spec.trackFront / 2, hwb);
  mkWheel('RL', -spec.trackRear / 2, -hwb);
  mkWheel('RR', spec.trackRear / 2, -hwb);

  // Combina peças estáticas da carroceria para reduzir draw calls
  const byMat = new Map();
  for (const m of parts) {
    if (m === cluster || headlights.includes(m) || brakeLights.includes(m)) continue;
    const key = m.material?.uniqueId ?? -1;
    if (!byMat.has(key)) byMat.set(key, []);
    byMat.get(key).push(m);
  }
  for (const list of byMat.values()) {
    if (list.length < 2) continue;
    const merged = Mesh.MergeMeshes(list, true, true, undefined, false, false);
    if (merged) { merged.parent = root; merged.name = 'bodyMerged'; }
  }

  return {
    root, wheels, steeringWheel, dashTexture: dashTex, brakeLights, headlights, spoiler, materials,
    driverEye: new Vector3(driverX, st.belt + 0.3, cabinMid - 0.3),
    source: 'procedural',
  };
}

// =============================================================
// Modelos GLB (realistas)
// =============================================================
const containers = new WeakMap(); // scene -> Map(url -> Promise<AssetContainer>)

/** Carrega o GLB uma vez por cena; cada carro recebe uma cópia (geometria compartilhada). */
function getContainer(scene, url) {
  if (!containers.has(scene)) {
    containers.set(scene, new Map());
    scene.onDisposeObservable.add(() => {
      for (const p of containers.get(scene)?.values() ?? []) p.then((c) => c.dispose()).catch(() => {});
    });
  }
  const map = containers.get(scene);
  if (!map.has(url)) {
    // Desliga extensões caras no celular (refração em tempo real e iridescência)
    const obs = SceneLoader.OnPluginActivatedObservable.add((loader) => {
      if (loader.name === 'gltf') {
        loader.extensionOptions = {
          ...(loader.extensionOptions || {}),
          KHR_materials_transmission: { enabled: false },
          KHR_materials_iridescence: { enabled: false },
        };
      }
    });
    const slash = url.lastIndexOf('/') + 1;
    const p = SceneLoader.LoadAssetContainerAsync(url.slice(0, slash), url.slice(slash), scene).finally(() => {
      SceneLoader.OnPluginActivatedObservable.remove(obs);
    });
    map.set(url, p);
  }
  return map.get(url);
}

const strip = (n, prefix) => (n.startsWith(prefix) ? n.slice(prefix.length) : n);

/** Qual roda é este nó? (aceita wheel_FL e também WheelFrontL etc.) */
function wheelKey(name) {
  const n = name.toLowerCase().replace(/[\s_-]/g, '');
  if (!n.startsWith('wheel') && !n.includes('wheel')) return null;
  if (/wheel(fl|frontl(eft)?)$/.test(n)) return 'FL';
  if (/wheel(fr|frontr(ight)?)$/.test(n)) return 'FR';
  if (/wheel(rl|rearl(eft)?|backl(eft)?)$/.test(n)) return 'RL';
  if (/wheel(rr|rearr(ight)?|backr(ight)?)$/.test(n)) return 'RR';
  return null;
}

/**
 * Monta um carro a partir de um GLB, normalizando escala, frente (+Z),
 * chão (y = 0) e rodas (raio físico). detail: 'full' (jogador/showroom)
 * ou 'lite' (adversários: sem interior e peças miúdas, menos polígonos).
 */
async function buildFromGlb(scene, spec, url, detail) {
  const container = await getContainer(scene, url);
  const prefix = `${spec.id}_${Math.random().toString(36).slice(2, 7)}_`;
  const inst = container.instantiateModelsToScene((n) => prefix + n, true, { doNotInstantiate: true });
  const root = new TransformNode(`car_${spec.id}_glb`, scene);
  const fit = new TransformNode('fit', scene);
  fit.parent = root;
  for (const r of inst.rootNodes) r.parent = fit;
  const nodes = fit.getDescendants(false);
  const meshes = nodes.filter((n) => typeof n.getTotalVertices === 'function');

  // Esconde logotipos/placa, palhetas (muitos polígonos) e, no modo leve, o interior
  const hideRe = detail === 'lite'
    ? /^(License|InteriorSteeringEmblem|BodyWindshieldWipers|Interior|Engine|Axles|BodyHoodInterior|BodyHoodUnder|.*BrakePad)/i
    : /^(License|InteriorSteeringEmblem|BodyWindshieldWipers)/i;
  for (const m of meshes) {
    if (hideRe.test(strip(m.name, prefix))) { m.setEnabled(false); m.isVisible = false; }
  }

  // Materiais: pintura principal, vidros (sem refração), luzes
  const mats = {};
  const seen = new Set();
  for (const m of meshes) {
    const mat = m.material;
    if (!mat || seen.has(mat)) continue;
    seen.add(mat);
    const name = strip(mat.name || '', prefix);
    if (/paint\s*1/i.test(name) || (!mats.paint && /paint|body|carpaint/i.test(name) && !/paint\s*2/i.test(name))) mats.paint ||= mat;
    if (/glass|window/i.test(name)) {
      mat.albedoColor = new Color3(0.02, 0.025, 0.03);
      // Sem interior (adversários), vidro mais escuro para não ver "através" do carro
      mat.alpha = detail === 'lite' ? 0.92 : 0.38;
      mat.metallic = 0.1;
      mat.roughness = 0.05;
      if (mat.subSurface) mat.subSurface.isRefractionEnabled = false;
      mat.transparencyMode = 2; // ALPHABLEND
      mat.backFaceCulling = false;
    }
    if (/brake.?light|taillight/i.test(name)) mats.taillight ||= mat;
    if (/head.?light/i.test(name)) mats.headlight ||= mat;
    if (/^rim\d*$/i.test(name.trim())) mats.rim ||= mat;
  }

  // Rodas: destrava o esterço da pose do modelo copiando a rotação da traseira do mesmo lado
  const wheelNodes = {};
  for (const n of nodes) {
    const k = wheelKey(strip(n.name, prefix));
    if (k && !wheelNodes[k]) wheelNodes[k] = n;
  }
  if (!wheelNodes.FL || !wheelNodes.FR || !wheelNodes.RL || !wheelNodes.RR) throw new Error('GLB sem as 4 rodas nomeadas');
  for (const [front, rear] of [['FL', 'RL'], ['FR', 'RR']]) {
    const f = wheelNodes[front], r = wheelNodes[rear];
    if (r.rotationQuaternion) f.rotationQuaternion = r.rotationQuaternion.clone();
    else f.rotation.copyFrom(r.rotation);
    f.scaling.copyFrom(r.scaling);
  }

  const update = () => { root.computeWorldMatrix(true); for (const n of nodes) n.computeWorldMatrix(true); };
  const centers = () => Object.fromEntries(Object.entries(wheelNodes).map(([k, n]) => [k, n.getAbsolutePosition().clone()]));
  update();
  let c = centers();
  // Frente para +Z
  const frontZ = (c.FL.z + c.FR.z) / 2, rearZ = (c.RL.z + c.RR.z) / 2;
  if (frontZ < rearZ) fit.rotation.y = Math.PI;
  // Escala: raio do pneu do modelo = raio físico
  update();
  // Raio real do pneu: maior distância dos vértices ao centro da roda no plano
  // vertical (y, z) — a caixa alinhada aos eixos superestima rodas giradas.
  let tireR = 0;
  {
    const v = new Vector3();
    const n = wheelNodes.FL;
    const cc = n.getAbsolutePosition();
    for (const m of n.getChildMeshes(false)) {
      const pos = m.getVerticesData?.('position');
      if (!pos) continue;
      const wm = m.computeWorldMatrix(true);
      for (let i = 0; i < pos.length; i += 3) {
        Vector3.TransformCoordinatesFromFloatsToRef(pos[i], pos[i + 1], pos[i + 2], wm, v);
        const d = Math.hypot(v.y - cc.y, v.z - cc.z);
        if (d > tireR) tireR = d;
      }
    }
  }
  const s = tireR > 0.05 ? spec.wheelRadius / tireR : 1;
  fit.scaling.setAll(s);
  update();
  c = centers();
  const midX = (c.FL.x + c.FR.x + c.RL.x + c.RR.x) / 4;
  const midZ = (c.FL.z + c.FR.z + c.RL.z + c.RR.z) / 4;
  const wheelY = (c.FL.y + c.FR.y + c.RL.y + c.RR.y) / 4;
  fit.position.set(-midX, spec.wheelRadius - wheelY, -midZ);
  update();
  c = centers();

  // Pivôs de esterço/giro (mesma convenção do modelo procedural); FL = lado esquerdo (x < 0)
  const sorted = { FL: null, FR: null, RL: null, RR: null };
  const fronts = [['FL', c.FL], ['FR', c.FR]].sort((a, b) => a[1].x - b[1].x);
  const rears = [['RL', c.RL], ['RR', c.RR]].sort((a, b) => a[1].x - b[1].x);
  sorted.FL = fronts[0][0]; sorted.FR = fronts[1][0]; sorted.RL = rears[0][0]; sorted.RR = rears[1][0];
  const wheels = {};
  for (const key of ['FL', 'FR', 'RL', 'RR']) {
    const node = wheelNodes[sorted[key]];
    const pos = c[sorted[key]];
    const pivot = new TransformNode(`wheel_${key}`, scene);
    pivot.parent = root;
    pivot.position.set(pos.x, pos.y, pos.z);
    const spin = new TransformNode(`wheelSpin_${key}`, scene);
    spin.parent = pivot;
    node.setParent(spin);
    // Pinça de freio não gira com a roda
    for (const m of node.getChildMeshes(false)) if (/brakepad/i.test(strip(m.name, prefix))) m.setParent(pivot);
    if (detail === 'lite') {
      for (const m of node.getChildMeshes(false)) if (/rim/i.test(strip(m.name, prefix))) m.addLODLevel?.(30, null);
    }
    wheels[key] = { pivot, spin };
  }

  // Olho do piloto (cockpit): atrás do volante do modelo, se existir
  let roofY = 0;
  let steeringPivot = null;
  for (const m of meshes) {
    if (!m.isEnabled() || m.getTotalVertices() === 0) continue;
    m.computeWorldMatrix(true);
    roofY = Math.max(roofY, m.getBoundingInfo().boundingBox.maximumWorld.y);
  }
  let driverEye = new Vector3(-0.36, Math.max(0.8, roofY - 0.16), -0.25);
  // Centro do volante do modelo (pela caixa dos vértices; o nó pode estar na origem)
  const steerMeshes = meshes.filter((m) => /^InteriorSteeringWheel/i.test(strip(m.name, prefix)) && m.getTotalVertices() > 0);
  if (steerMeshes.length && detail !== 'lite') {
    const mn = new Vector3(Infinity, Infinity, Infinity), mx = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const m of steerMeshes) {
      m.computeWorldMatrix(true);
      const bb = m.getBoundingInfo().boundingBox;
      mn.minimizeInPlace(bb.minimumWorld); mx.maximizeInPlace(bb.maximumWorld);
    }
    const sp = mn.add(mx).scale(0.5);
    driverEye = new Vector3(sp.x, Math.min(sp.y + 0.3, roofY - 0.12), sp.z - 0.55);
    // Volante do modelo gira com o esterço (pivô no centro do aro)
    steeringPivot = new TransformNode('steeringPivot', scene);
    steeringPivot.parent = root;
    steeringPivot.position.copyFrom(sp);
    for (const m of steerMeshes) m.setParent(steeringPivot);
  }

  // Funde as peças da carroceria por material (menos draw calls).
  // Antes, solta cada peça da hierarquia original (mantendo a posição no mundo)
  // para que descartar um "pai" fundido não apague peças ainda não fundidas.
  update();
  const wheelSet = new Set();
  for (const w of Object.values(wheels)) for (const m of w.pivot.getChildMeshes(false)) wheelSet.add(m);
  if (steeringPivot) for (const m of steeringPivot.getChildMeshes(false)) wheelSet.add(m);
  for (const m of meshes) {
    if (!wheelSet.has(m) && !m.isDisposed()) m.setParent(root);
  }
  const groups = new Map();
  for (const m of meshes) {
    if (wheelSet.has(m) || !m.isEnabled() || !m.material || m.getTotalVertices() === 0) continue;
    const key = m.material.uniqueId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  let deckY = 0, minZ = Infinity, maxY = 0;
  const bodyMeshes = [];
  for (const list of groups.values()) {
    let target = list;
    if (list.length > 1) {
      try {
        const merged = Mesh.MergeMeshes(list, true, true, undefined, false, false);
        if (merged) { merged.parent = root; target = [merged]; }
      } catch { /* atributos diferentes: mantém separado */ }
    }
    bodyMeshes.push(...target);
    for (const m of target) {
      m.computeWorldMatrix(true);
      const bb = m.getBoundingInfo().boundingBox;
      minZ = Math.min(minZ, bb.minimumWorld.z);
      maxY = Math.max(maxY, bb.maximumWorld.y);
    }
  }
  // Altura da tampa traseira (para o aerofólio)
  for (const m of bodyMeshes) {
    {
      const pos = m.getVerticesData?.('position');
      if (!pos) continue;
      const wm = m.getWorldMatrix();
      const v = new Vector3();
      for (let i = 0; i < pos.length; i += 9) {
        Vector3.TransformCoordinatesFromFloatsToRef(pos[i], pos[i + 1], pos[i + 2], wm, v);
        if (v.z < minZ + 0.45 && v.y > deckY) deckY = v.y;
      }
    }
  }
  // Limpa nós vazios que sobraram da hierarquia original
  for (const n of nodes) if (!n.isDisposed() && !n.getChildren().length && typeof n.getTotalVertices !== 'function') n.dispose();

  // Aerofólio (carros de pista/super/hiper ou melhoria aerodinâmica)
  const st = STYLE[spec.style] ?? STYLE.gt;
  const wingLevel = Math.max(st.wing, spec.wing ?? 0, spec.upgrades?.aero ?? 0);
  if (wingLevel >= 1 && deckY > 0) {
    const wingMat = new PBRMaterial('wingCarbon', scene);
    wingMat.albedoColor = new Color3(0.03, 0.03, 0.035);
    wingMat.metallic = 0.3; wingMat.roughness = 0.35;
    const span = spec.dims.width * (wingLevel >= 2 ? 0.9 : 0.78);
    const h = wingLevel >= 2 ? 0.3 : 0.17;
    const wing = MeshBuilder.CreateBox('wing', { width: span, height: 0.035, depth: wingLevel >= 2 ? 0.36 : 0.26 }, scene);
    wing.position.set(0, deckY + h, minZ + 0.32);
    wing.rotation.x = -0.12;
    wing.parent = root; wing.material = wingMat;
    for (const sx of [-1, 1]) {
      const post = MeshBuilder.CreateBox('wingPost', { width: 0.04, height: h + 0.02, depth: 0.1 }, scene);
      post.position.set(sx * span * 0.3, deckY + h / 2, minZ + 0.34);
      post.parent = root; post.material = wingMat;
      const plate = MeshBuilder.CreateBox('endplate', { width: 0.02, height: 0.15, depth: 0.4 }, scene);
      plate.position.set(sx * span / 2, deckY + h, minZ + 0.32);
      plate.parent = root; plate.material = mats.paint ?? wingMat;
    }
  }

  return {
    root, wheels, steeringWheel: steeringPivot, dashTexture: null, brakeLights: [], headlights: [], spoiler: null,
    materials: mats, driverEye, source: 'glb',
    /** Descarta o carro sem apagar as texturas compartilhadas do GLB. */
    dispose() {
      const used = new Set();
      for (const m of root.getChildMeshes(false)) if (m.material) used.add(m.material);
      root.dispose(false, false);
      for (const mat of used) mat.dispose(false, false);
    },
  };
}

/**
 * Carrega o modelo do carro. Ordem: public/assets/cars/<id>.glb (modelo
 * próprio do carro) → public/assets/cars/concept.glb (modelo realista
 * padrão) → modelo procedural. Convenções de GLB no README.
 * @param {object} opts { detail: 'full' | 'lite' }
 */
export async function loadCarModel(scene, spec, materials, opts = {}) {
  const detail = opts.detail ?? 'full';
  const candidates = spec.model === null ? [] : [`${spec.id}.glb`, 'concept.glb'];
  for (const file of candidates) {
    const url = `assets/cars/${file}`;
    if (!(await glbExists(url))) continue;
    try {
      const model = await buildFromGlb(scene, spec, url, detail);
      // Cor/acabamento escolhidos na garagem → pintura do modelo
      const gp = model.materials.paint, pp = materials.paint;
      if (gp && pp) {
        gp.albedoColor = pp.albedoColor.clone();
        gp.albedoTexture = null; // a cor vem do jogador
        gp.metallic = pp.metallic;
        gp.roughness = pp.roughness;
        if (gp.clearCoat) gp.clearCoat.isEnabled = pp.clearCoat.isEnabled;
      }
      if (model.materials.rim && materials.rim) model.materials.rim.albedoColor = materials.rim.albedoColor.clone();
      // Completa materiais ausentes com os procedurais (luzes, aro, pintura)
      model.materials = { ...materials, ...model.materials };
      return model;
    } catch (e) {
      console.warn(`[CarModel] ${file} inválido, usando modelo procedural:`, e?.message || e);
    }
  }
  return buildProceduralCar(scene, spec, materials);
}
