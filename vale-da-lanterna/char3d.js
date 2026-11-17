/* Vale da Lanterna — Kai e Floco em 3D (three.js), renderizados em baixa resolução com contorno
   para combinar com a pixel art, vistos pela mesma câmera de cima (3/4) do jogo. */
'use strict';

const Char3D = (() => {
  if (!window.THREE) return null;
  const T = window.THREE;
  const RES = 52, HALF = 1.3;          // 52 px cobrem 2,6 unidades
  let renderer;
  try {
    const cnv = document.createElement('canvas'); cnv.width = RES; cnv.height = RES;
    renderer = new T.WebGLRenderer({ canvas: cnv, alpha: true, antialias: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(RES, RES, false); renderer.setClearColor(0x000000, 0);
  } catch (e) { return null; }

  const scene = new T.Scene();
  scene.add(new T.AmbientLight(0xffffff, 0.58));
  const sun = new T.DirectionalLight(0xfff2dc, 0.78); sun.position.set(-2.2, 4, 3); scene.add(sun);
  const rim = new T.DirectionalLight(0x9ad1ff, 0.18); rim.position.set(2, 1, -3); scene.add(rim);
  const cam = new T.OrthographicCamera(-HALF, HALF, HALF, -HALF, 0.1, 60);
  const pitch = 0.5;
  cam.position.set(0, 0.85 + Math.sin(pitch) * 12, Math.cos(pitch) * 12); cam.lookAt(0, 0.85, 0);
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const foot = new T.Vector3(0, 0, 0).project(cam);
  const anchor = [(foot.x + 1) / 2 * RES, (1 - foot.y) / 2 * RES];

  const mats = {};
  const M = col => mats[col] || (mats[col] = new T.MeshLambertMaterial({ color: col, flatShading: true }));
  const hex = c => typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16);
  const OUT = new T.MeshBasicMaterial({ color: 0x1d1a24, side: T.BackSide });
  const OUTW = 0.07;
  function box(parent, w, h, d, col, x, y, z, outline = true) {
    const g = new T.BoxGeometry(w, h, d), m = new T.Mesh(g, M(col));
    m.position.set(x, y, z);
    if (outline) { const o = new T.Mesh(g, OUT); o.scale.set(1 + OUTW / w, 1 + OUTW / h, 1 + OUTW / d); m.add(o); }
    parent.add(m); return m;
  }
  function cyl(parent, r, h, col, x, y, z, rx, outline = true) {
    const g = new T.CylinderGeometry(r, r, h, 12), m = new T.Mesh(g, M(col));
    m.position.set(x, y, z); m.rotation.x = rx || 0;
    if (outline) { const o = new T.Mesh(g, OUT); o.scale.set(1 + OUTW / r / 2, 1 + OUTW / h, 1 + OUTW / r / 2); m.add(o); }
    parent.add(m); return m;
  }
  const pivot = (parent, x, y, z) => { const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  // ------------------------------------------------ Kai
  const kai = new T.Group();
  const body = pivot(kai, 0, 0, 0);
  const legs = [-0.12, 0.12].map(x => {
    const p = pivot(body, x, 0.6, 0);
    box(p, 0.18, 0.42, 0.2, 0x33384e, 0, -0.21, 0);
    const boot = box(p, 0.2, 0.16, 0.26, 0x3b2618, 0, -0.52, 0.03);
    return { p, boot };
  });
  const torso = pivot(body, 0, 0.6, 0);
  const tunic = box(torso, 0.52, 0.54, 0.32, 0x7a4a2a, 0, 0.27, 0);
  box(torso, 0.54, 0.07, 0.34, 0xc99a3a, 0, 0.06, 0, false);
  const scarf = box(torso, 0.56, 0.13, 0.36, 0xc8423b, 0, 0.55, 0);
  const scarfTail = box(torso, 0.14, 0.32, 0.06, 0xb5352e, 0.14, 0.38, -0.22);
  const armor = [box(torso, 0.22, 0.12, 0.38, 0x5fae4a, -0.32, 0.5, 0), box(torso, 0.22, 0.12, 0.38, 0x5fae4a, 0.32, 0.5, 0)];
  // mochila redonda azul com o "olho"
  const pack = cyl(torso, 0.25, 0.16, 0x45b2c9, 0, 0.3, -0.25, Math.PI / 2);
  cyl(torso, 0.11, 0.04, 0x256f86, 0, 0.3, -0.34, Math.PI / 2, false);
  cyl(torso, 0.05, 0.05, 0x1d1a24, 0, 0.3, -0.36, Math.PI / 2, false);
  // espada nas costas
  const backSword = pivot(torso, 0.05, 0.42, -0.36);
  backSword.rotation.z = -0.65;
  const bsBlade = box(backSword, 0.07, 0.62, 0.03, 0xe8eef5, 0, 0.34, 0);
  box(backSword, 0.24, 0.05, 0.06, 0xc99a3a, 0, 0.02, 0);
  box(backSword, 0.06, 0.16, 0.06, 0x7a4a2a, 0, -0.08, 0);
  // cabeça
  const head = pivot(torso, 0, 0.62, 0);
  box(head, 0.44, 0.4, 0.4, 0xf0c08a, 0, 0.2, 0);
  for (const x of [-0.1, 0.1]) box(head, 0.06, 0.09, 0.02, 0x2a2238, x, 0.2, 0.205, false);
  box(head, 0.5, 0.14, 0.46, 0xf3f0ea, 0, 0.44, -0.01);
  box(head, 0.5, 0.34, 0.12, 0xf3f0ea, 0, 0.27, -0.19);
  box(head, 0.48, 0.07, 0.07, 0xf3f0ea, 0, 0.375, 0.2, false);
  box(head, 0.07, 0.18, 0.28, 0xf3f0ea, -0.245, 0.31, -0.05, false);
  box(head, 0.07, 0.18, 0.28, 0xf3f0ea, 0.245, 0.31, -0.05, false);
  box(head, 0.06, 0.04, 0.02, 0xcf9461, 0, 0.1, 0.205, false);
  [[-0.13, 0.52, -0.06, 0.5], [0.08, 0.54, -0.1, -0.4], [0.2, 0.49, 0.02, -0.8], [-0.21, 0.47, 0.04, 0.8], [0, 0.5, -0.2, 0.1]].forEach(([x, y, z, r]) => {
    const s = box(head, 0.12, 0.15, 0.12, 0xf3f0ea, x, y, z); s.rotation.set(0, r * 0.5, r);
  });
  // braços
  const sleeves = [];
  const arms = [-0.34, 0.34].map(x => {
    const p = pivot(torso, x, 0.5, 0);
    sleeves.push(box(p, 0.15, 0.36, 0.17, 0x7a4a2a, 0, -0.17, 0));
    box(p, 0.13, 0.12, 0.15, 0xf0c08a, 0, -0.4, 0);
    return p;
  });
  const handSword = pivot(arms[1], 0, -0.42, 0.06);
  const hsBlade = box(handSword, 0.07, 0.03, 0.66, 0xe8eef5, 0, 0, 0.38);
  box(handSword, 0.26, 0.05, 0.06, 0xc99a3a, 0, 0, 0.04);
  handSword.visible = false;

  // ------------------------------------------------ Floco
  const dog = new T.Group();
  const dBody = pivot(dog, 0, 0, 0);
  box(dBody, 0.34, 0.26, 0.56, 0xf7f5f0, 0, 0.38, 0);
  box(dBody, 0.3, 0.06, 0.4, 0xe0dcd2, 0, 0.26, 0, false);
  const dHead = pivot(dBody, 0, 0.5, 0.3);
  box(dHead, 0.34, 0.3, 0.3, 0xf7f5f0, 0, 0.06, 0.02);
  box(dHead, 0.16, 0.12, 0.14, 0xeceae2, 0, -0.02, 0.2);
  box(dHead, 0.06, 0.05, 0.04, 0x2b1d1d, 0, 0.02, 0.28, false);
  for (const x of [-0.09, 0.09]) box(dHead, 0.06, 0.07, 0.02, 0x1d1a24, x, 0.11, 0.175, false);
  const ears = [-0.13, 0.13].map(x => { const e = box(dHead, 0.09, 0.16, 0.09, 0xcfc8bc, x, 0.25, -0.02); return e; });
  const collar = box(dBody, 0.32, 0.07, 0.12, 0xd04a4a, 0, 0.44, 0.2, false);
  const tail = pivot(dBody, 0, 0.46, -0.28);
  box(tail, 0.07, 0.07, 0.26, 0xf7f5f0, 0, 0.06, -0.1);
  const dLegs = [[-0.11, 0.18], [0.11, 0.18], [-0.11, -0.18], [0.11, -0.18]].map(([x, z]) => {
    const p = pivot(dBody, x, 0.28, z); box(p, 0.1, 0.26, 0.1, 0xf7f5f0, 0, -0.13, 0); return p;
  });

  scene.add(kai); scene.add(dog);
  const cnv = renderer.domElement;

  function poseKai(st) {
    const ph = st.phase || 0, mv = st.moving ? 1 : 0, run = st.run && mv ? 1 : 0;
    kai.rotation.y = st.yaw;
    const sw = Math.sin(ph * Math.PI / 2) * (run ? 1.1 : 0.75) * mv;
    legs[0].p.rotation.x = sw; legs[1].p.rotation.x = -sw;
    arms[0].rotation.set(-sw * (run ? 1.1 : 0.8), 0, 0.08); arms[1].rotation.set(sw * (run ? 1.1 : 0.8), 0, -0.08);
    body.position.y = mv ? Math.abs(Math.sin(ph * Math.PI / 2)) * (run ? 0.09 : 0.05) : Math.sin(st.t * 2) * 0.012;
    torso.rotation.set(mv * (run ? 0.22 : 0.06), 0, 0);
    head.rotation.set(run ? -0.12 : 0, 0, 0);
    if (st.talk && !mv) { arms[1].rotation.set(-0.9 - Math.sin(st.t * 5) * 0.35, 0, -0.25); head.rotation.set(Math.sin(st.t * 4) * 0.06, 0, 0); }
    scarfTail.rotation.x = 0.3 + mv * 0.4 + Math.sin(st.t * 6) * 0.1 * mv;
    const tier = st.espada || 1, bladeCol = tier >= 3 ? 0x8fd8ff : tier === 2 ? 0xa9a6a0 : 0xe8eef5;
    bsBlade.material = M(bladeCol); hsBlade.material = M(bladeCol);
    armor.forEach(a => { a.visible = !!st.armadura; });
    const tc = M(hex(st.tunic || '#7a4a2a')), scm = M(hex(st.scarf || '#c8423b'));
    tunic.material = tc; sleeves.forEach(sl => { sl.material = tc; }); scarf.material = scm; scarfTail.material = scm;
    legs.forEach(l => { l.boot.material = M(st.botas ? 0x5a9ad8 : 0x3b2618); });
    if (st.atk >= 0) {
      const k = st.atk;
      backSword.visible = false; handSword.visible = true;
      arms[1].rotation.set(-2.3 + k * 2.6, 0, -0.2 - Math.sin(k * Math.PI) * 0.6);
      torso.rotation.y = 0.5 - k * 1.0;
    } else { backSword.visible = true; handSword.visible = false; torso.rotation.y = 0; }
  }
  function poseDog(st) {
    dog.rotation.y = st.yaw;
    const ph = st.phase || 0, mv = st.moving ? 1 : 0, sw = Math.sin(ph * Math.PI) * 0.7 * mv;
    dLegs[0].rotation.x = sw; dLegs[3].rotation.x = sw; dLegs[1].rotation.x = -sw; dLegs[2].rotation.x = -sw;
    dBody.position.y = mv ? Math.abs(Math.sin(ph * Math.PI)) * 0.05 : 0;
    tail.rotation.set(0.7, Math.sin(st.t * (st.bark ? 30 : 12)) * 0.6, 0);
    dHead.rotation.x = st.bark ? -0.35 : Math.sin(st.t * 1.5) * 0.05;
    ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * (0.15 + Math.sin(st.t * 3 + i) * 0.05); });
    collar.material = M(st.coleira ? 0xe0a020 : 0xd04a4a);
  }
  // ------------------------------------------------ pessoas genéricas (NPCs)
  // app = { skin, hair, hairStyle, top, bottom, dress, apron, hat, beard, shoes, scale }
  // animais da fazenda (corpo de blocos, pernas animadas)
  function buildAnimal(app) {
    const root = new T.Group(), P = { animal: app.animal, legs: [] };
    P.body = pivot(root, 0, 0, 0);
    P.body.scale.setScalar(app.baby ? 0.6 : 1);
    const k = app.animal;
    const leg = (x, z, h, w, col) => { const p = pivot(P.body, x, h, z); box(p, w, h, w, col, 0, -h / 2, 0); P.legs.push(p); return p; };
    if (k === 'galinha') {
      box(P.body, 0.32, 0.28, 0.4, 0xffffff, 0, 0.36, 0);
      box(P.body, 0.06, 0.2, 0.26, 0xe8e4dc, -0.18, 0.38, -0.02, false); box(P.body, 0.06, 0.2, 0.26, 0xe8e4dc, 0.18, 0.38, -0.02, false);
      box(P.body, 0.18, 0.2, 0.14, 0xffffff, 0, 0.44, -0.24);
      P.head = pivot(P.body, 0, 0.52, 0.18);
      box(P.head, 0.18, 0.2, 0.18, 0xffffff, 0, 0.08, 0);
      box(P.head, 0.06, 0.08, 0.12, 0xd83a3a, 0, 0.22, 0.02, false);
      box(P.head, 0.08, 0.05, 0.08, 0xf0a020, 0, 0.06, 0.12, false);
      for (const x of [-0.05, 0.05]) box(P.head, 0.03, 0.04, 0.02, 0x1d1a24, x, 0.12, 0.09, false);
      leg(-0.07, 0.02, 0.22, 0.05, 0xf0a020); leg(0.07, 0.02, 0.22, 0.05, 0xf0a020);
    } else {
      const big = k === 'vaca', col = k === 'vaca' ? 0xf4f1ea : k === 'ovelha' ? 0xeae6de : 0xf0a8b8;
      const bw = big ? 0.5 : 0.42, bh = big ? 0.46 : 0.38, bl = big ? 0.9 : 0.7, ly = big ? 0.42 : 0.3;
      box(P.body, bw, bh, bl, col, 0, ly + bh / 2, 0);
      if (k === 'vaca') { box(P.body, 0.52, 0.2, 0.26, 0x2a2622, 0, ly + 0.3, 0.12, false); box(P.body, 0.3, 0.16, 0.2, 0x2a2622, 0.12, ly + 0.36, -0.28, false); box(P.body, 0.16, 0.1, 0.18, 0xf0a0b0, 0, ly - 0.02, 0.05, false); }
      if (k === 'ovelha') for (const [x, y, z] of [[-0.18, 0.5, 0.2], [0.18, 0.5, -0.1], [0, 0.62, 0], [-0.15, 0.6, -0.22], [0.16, 0.6, 0.22]]) { const b = new T.Mesh(new T.SphereGeometry(0.17, 6, 5), M(0xffffff)); b.position.set(x, y, z); P.body.add(b); }
      P.head = pivot(P.body, 0, ly + bh * 0.75, bl / 2 + 0.06);
      const hc = k === 'ovelha' ? 0x4a4450 : col;
      box(P.head, big ? 0.32 : 0.26, big ? 0.3 : 0.24, 0.26, hc, 0, 0, 0.08);
      if (k === 'porco') box(P.head, 0.14, 0.1, 0.06, 0xd87890, 0, -0.04, 0.23);
      if (k === 'vaca') { box(P.head, 0.2, 0.1, 0.06, 0xf0b0b8, 0, -0.08, 0.23); box(P.head, 0.06, 0.1, 0.06, 0xe8e0c8, -0.14, 0.18, 0.02); box(P.head, 0.06, 0.1, 0.06, 0xe8e0c8, 0.14, 0.18, 0.02); }
      box(P.head, 0.08, 0.1, 0.05, k === 'porco' ? 0xd87890 : hc, -0.15, 0.1, 0.02, false); box(P.head, 0.08, 0.1, 0.05, k === 'porco' ? 0xd87890 : hc, 0.15, 0.1, 0.02, false);
      for (const x of [-0.07, 0.07]) box(P.head, 0.04, 0.05, 0.02, 0x1d1a24, x, 0.04, 0.215, false);
      const lc = k === 'ovelha' ? 0x4a4450 : k === 'vaca' ? 0xe8e4dc : col;
      for (const [x, z] of [[-bw / 3, bl / 3], [bw / 3, bl / 3], [-bw / 3, -bl / 3], [bw / 3, -bl / 3]]) leg(x, z, ly, 0.12, lc);
    }
    return { root, P };
  }
  function poseAnimal(P, anim, k) {
    const s = Math.sin(k * Math.PI * 2);
    P.body.position.set(0, 0, 0); P.body.rotation.set(0, 0, 0); P.head.rotation.set(0, 0, 0);
    P.legs.forEach((l, i) => l.rotation.set(0, 0, 0));
    if (anim === 'walk' || anim === 'run') { P.legs.forEach((l, i) => { l.rotation.x = (i % 2 === (i < 2 ? 0 : 1) ? 1 : -1) * s * 0.6; }); P.body.position.y = Math.abs(s) * 0.03; }
    else if (anim === 'work' || anim === 'farm') { P.head.rotation.x = 0.7 + s * 0.15; }
    else if (anim === 'sleep' || anim === 'rest') { P.body.position.y = -0.12; P.legs.forEach(l => { l.rotation.x = 1.3; }); P.head.rotation.x = 0.3; }
    else { P.head.rotation.set(s * 0.06, Math.sin(k * Math.PI * 4) * 0.2, 0); }
  }
  function buildPerson(app) {
    if (app.animal) return buildAnimal(app);
    const root = new T.Group(), P = {};
    const sk = hex(app.skin || '#f0c08a'), hr = hex(app.hair || '#5a3a26'), tp = hex(app.top || '#4f7fbf');
    const bt = hex(app.bottom || '#33384e'), sh = hex(app.shoes || '#3b2618');
    P.body = pivot(root, 0, 0, 0);
    P.body.scale.setScalar(app.scale || 1);
    P.legs = [-0.11, 0.11].map(x => {
      const p = pivot(P.body, x, 0.6, 0);
      box(p, 0.17, 0.42, 0.19, app.dress ? sk : bt, 0, -0.21, 0);
      box(p, 0.19, 0.14, 0.24, sh, 0, -0.52, 0.03);
      return p;
    });
    P.torso = pivot(P.body, 0, 0.6, 0);
    const F = !!app.fem, kidF = F && (app.scale || 1) < 0.86;
    if (F) {   // silhueta feminina: ombros estreitos, cintura e quadril
      box(P.torso, 0.42, 0.3, 0.27, tp, 0, 0.38, 0);
      box(P.torso, 0.36, 0.14, 0.25, tp, 0, 0.17, 0, false);
      box(P.torso, 0.46, 0.14, 0.3, app.dress ? tp : bt, 0, 0.05, 0);
    } else box(P.torso, 0.54, 0.54, 0.31, tp, 0, 0.27, 0);
    if (app.dress) { const d = new T.Mesh(new T.CylinderGeometry(0.24, 0.36, 0.5, 8), M(tp)); d.position.set(0, -0.12, 0); const o = new T.Mesh(d.geometry, OUT); o.scale.set(1.06, 1.04, 1.06); d.add(o); P.torso.add(d); }
    if (app.apron) box(P.torso, 0.4, app.dress ? 0.8 : 0.5, 0.04, hex(app.apron), 0, app.dress ? 0.05 : 0.2, 0.17, false);
    box(P.torso, F ? 0.44 : 0.56, 0.08, F ? 0.29 : 0.33, hex(app.collar || app.top || '#4f7fbf'), 0, 0.53, 0, false);
    P.head = pivot(P.torso, 0, 0.6, 0);
    box(P.head, F ? 0.4 : 0.42, 0.4, 0.4, sk, 0, 0.2, 0);
    if (F) {
      // olhos maiores com brilho e cílios, bochechas coradas, lábios rosados
      for (const x of [-0.1, 0.1]) {
        box(P.head, 0.07, 0.1, 0.02, 0x2a2238, x, 0.2, 0.205, false);
        box(P.head, 0.025, 0.03, 0.01, 0xffffff, x + 0.018, 0.23, 0.216, false);
        box(P.head, 0.1, 0.025, 0.02, 0x1a1420, x + (x < 0 ? -0.01 : 0.01), 0.265, 0.207, false);
        box(P.head, 0.07, 0.04, 0.01, 0xf29aa8, x + (x < 0 ? -0.04 : 0.04), 0.13, 0.206, false);
      }
      box(P.head, 0.09, 0.035, 0.02, 0xd9506e, 0, 0.09, 0.205, false);
    } else {
      for (const x of [-0.1, 0.1]) { box(P.head, 0.06, 0.08, 0.02, 0x2a2238, x, 0.2, 0.205, false); box(P.head, 0.1, 0.035, 0.02, hex(app.beard || app.hair || '#3a2a20'), x, 0.265, 0.206, false); }
      box(P.head, 0.09, 0.03, 0.02, 0x8a4a3a, 0, 0.1, 0.205, false);
    }
    let st = app.hairStyle || 'short';
    if (F && (st === 'short' || st === 'bald' || st === 'spiky')) st = 'bob';
    if (st !== 'bald') {
      box(P.head, 0.46, 0.12, 0.44, hr, 0, 0.44, -0.01);
      box(P.head, 0.46, 0.3, 0.1, hr, 0, 0.28, -0.19);
      box(P.head, 0.44, 0.07, 0.06, hr, 0, 0.38, 0.2, false);
    }
    if (st === 'long') { box(P.head, 0.48, 0.5, 0.12, hr, 0, 0.12, -0.2); box(P.head, 0.07, 0.36, 0.3, hr, -0.24, 0.2, -0.04, false); box(P.head, 0.07, 0.36, 0.3, hr, 0.24, 0.2, -0.04, false); }
    if (st === 'bun') { const b = new T.Mesh(new T.SphereGeometry(0.13, 8, 6), M(hr)); b.position.set(0, 0.55, -0.12); P.head.add(b); }
    if (st === 'pony') box(P.head, 0.12, 0.34, 0.12, hr, 0, 0.22, -0.3);
    if (F) {
      // mechas emoldurando o rosto (todas as meninas e mulheres)
      const lh = kidF ? 0.32 : 0.46, ly = kidF ? 0.22 : 0.14;
      box(P.head, 0.08, lh, 0.18, hr, -0.24, ly, 0.09, false);
      box(P.head, 0.08, lh, 0.18, hr, 0.24, ly, 0.09, false);
      if (st === 'bob') box(P.head, 0.48, 0.22, 0.12, hr, 0, 0.18, -0.2);
      if (!app.hat) {
        if (kidF) { box(P.head, 0.1, 0.08, 0.06, 0xff5a8a, -0.1, 0.48, 0.12, false); box(P.head, 0.1, 0.08, 0.06, 0xff5a8a, 0.06, 0.48, 0.12, false); box(P.head, 0.05, 0.06, 0.07, 0xd83a6a, -0.02, 0.48, 0.12, false); }
        else { box(P.head, 0.13, 0.12, 0.08, hex(app.flower || '#ff7aa6'), 0.15, 0.47, 0.17, false); box(P.head, 0.05, 0.05, 0.09, 0xffe066, 0.15, 0.47, 0.18, false); }
      }
      if (!kidF) for (const x of [-0.215, 0.215]) box(P.head, 0.03, 0.05, 0.03, 0xe2b84a, x, 0.1, 0.02, false);
    }
    if (st === 'spiky') [[-0.12, 0.52, 0.4], [0.06, 0.54, -0.3], [0.18, 0.5, -0.7]].forEach(([x, y, r]) => { const s = box(P.head, 0.12, 0.15, 0.12, hr, x, y, 0); s.rotation.z = r; });
    if (app.beard) box(P.head, 0.4, 0.14, 0.08, hex(app.beard), 0, 0.05, 0.2, false);
    if (app.hat === 'straw') { box(P.head, 0.72, 0.04, 0.72, 0xe9c46a, 0, 0.47, 0); box(P.head, 0.42, 0.14, 0.42, 0xd8b058, 0, 0.55, 0); }
    if (app.hat === 'chef') { box(P.head, 0.44, 0.08, 0.44, 0xfbfbf4, 0, 0.46, 0); const c = new T.Mesh(new T.SphereGeometry(0.2, 8, 6), M(0xfbfbf4)); c.position.set(0, 0.6, 0); P.head.add(c); }
    if (app.hat === 'cap') { box(P.head, 0.46, 0.1, 0.44, hex(app.hatCol || '#c8423b'), 0, 0.46, 0); box(P.head, 0.3, 0.03, 0.18, hex(app.hatCol || '#c8423b'), 0, 0.42, 0.27, false); }
    P.arms = (F ? [-0.27, 0.27] : [-0.34, 0.34]).map(x => {
      const p = pivot(P.torso, x, 0.5, 0);
      box(p, F ? 0.11 : 0.15, 0.36, F ? 0.13 : 0.17, tp, 0, -0.17, 0);
      box(p, F ? 0.1 : 0.12, 0.11, F ? 0.12 : 0.14, sk, 0, -0.4, 0);
      return p;
    });
    // ferramentas na mão direita
    P.hammer = pivot(P.arms[1], 0, -0.42, 0.04);
    box(P.hammer, 0.05, 0.05, 0.4, 0x7a4a2a, 0, 0, 0.18); box(P.hammer, 0.12, 0.12, 0.18, 0x55555f, 0, 0, 0.38);
    P.hoe = pivot(P.arms[1], 0, -0.42, 0.04);
    box(P.hoe, 0.05, 0.05, 0.7, 0x8a5a34, 0, 0, 0.25); box(P.hoe, 0.18, 0.04, 0.12, 0x9a9aa8, 0, -0.05, 0.6);
    P.rod = pivot(P.arms[1], 0, -0.42, 0.04);
    box(P.rod, 0.04, 0.04, 1.1, 0x8a5a34, 0, 0.25, 0.45, false);
    P.basket = pivot(P.arms[0], 0, -0.48, 0.04);
    box(P.basket, 0.26, 0.16, 0.2, 0xc99a5a, 0, -0.04, 0.05);
    box(P.basket, 0.2, 0.06, 0.14, 0xd83a3a, 0, 0.06, 0.05, false);
    return { root, P };
  }
  // anim: idle walk run talk work farm fish rest — k é a fase (0..1) do quadro
  function posePerson(P, anim, k) {
    if (P.animal) return poseAnimal(P, anim, k);
    const s = Math.sin(k * Math.PI * 2), c = Math.cos(k * Math.PI * 2);
    P.body.position.set(0, 0, 0); P.body.rotation.set(0, 0, 0); P.torso.rotation.set(0, 0, 0); P.head.rotation.set(0, 0, 0);
    P.legs.forEach(l => l.rotation.set(0, 0, 0)); P.arms[0].rotation.set(0, 0, 0.08); P.arms[1].rotation.set(0, 0, -0.08);
    P.hammer.visible = anim === 'work'; P.hoe.visible = anim === 'farm'; P.rod.visible = anim === 'fish'; P.basket.visible = false;
    if (anim === 'walk' || anim === 'run') {
      const a = anim === 'run' ? 1.1 : 0.7;
      P.legs[0].rotation.x = s * a; P.legs[1].rotation.x = -s * a;
      P.arms[0].rotation.x = -s * a * 0.9; P.arms[1].rotation.x = s * a * 0.9;
      P.body.position.y = Math.abs(s) * (anim === 'run' ? 0.08 : 0.04);
      P.torso.rotation.x = anim === 'run' ? 0.22 : 0.04;
    } else if (anim === 'idle') {
      P.body.position.y = s * 0.012; P.head.rotation.x = s * 0.03;
    } else if (anim === 'talk') {
      P.arms[1].rotation.set(-0.8 - s * 0.35, 0, -0.25); P.arms[0].rotation.set(-0.2 + c * 0.15, 0, 0.12);
      P.head.rotation.set(s * 0.07, c * 0.08, 0);
    } else if (anim === 'work') {
      P.arms[1].rotation.set(-2.2 + Math.max(0, s) * 2.2, 0, -0.1); P.torso.rotation.x = 0.1 + Math.max(0, s) * 0.12;
      P.arms[0].rotation.set(-0.5, 0, 0.2);
    } else if (anim === 'farm') {
      P.torso.rotation.x = 0.55; P.head.rotation.x = 0.2; P.body.position.y = -0.08;
      P.legs[0].rotation.x = -0.35; P.legs[1].rotation.x = 0.2;
      P.arms[1].rotation.set(-1.2 + s * 0.6, 0, -0.1); P.arms[0].rotation.set(-0.9 - c * 0.3, 0, 0.1);
    } else if (anim === 'fish') {
      P.arms[1].rotation.set(-1.1 + s * 0.08, 0, -0.1); P.arms[0].rotation.set(-1.0 + s * 0.08, 0, 0.3); P.head.rotation.x = 0.12;
    } else if (anim === 'rest') {
      P.body.position.y = -0.3; P.legs.forEach(l => { l.rotation.x = -1.45; }); P.arms[0].rotation.set(-0.4, 0, 0.1); P.arms[1].rotation.set(-0.4, 0, -0.1);
      P.head.rotation.x = 0.08 + s * 0.03;
    } else if (anim === 'sleep') {
      P.body.rotation.x = -Math.PI / 2; P.body.position.set(0, 0.32, 0.55);
      P.arms[0].rotation.set(0, 0, 0.12); P.arms[1].rotation.set(0, 0, -0.12);
    } else if (anim === 'carry') {
      P.basket.visible = true; P.arms[0].rotation.set(-0.3, 0, 0.1);
      P.legs[0].rotation.x = s * 0.6; P.legs[1].rotation.x = -s * 0.6; P.arms[1].rotation.x = s * 0.5;
    }
  }
  const ANIMS = { idle: 2, walk: 4, run: 4, talk: 2, work: 2, farm: 2, fish: 2, rest: 2, carry: 4, sleep: 1 };
  const ANIM_OFF = {}; let FRAMES = 0;
  for (const [a, n] of Object.entries(ANIMS)) { ANIM_OFF[a] = FRAMES; FRAMES += n; }
  const ANIM_FPS = { idle: 2, walk: 7, run: 11, talk: 4, work: 4, farm: 2.5, fish: 1.5, rest: 1, carry: 7, sleep: 1 };
  const atlases = new Map();
  let bakeBudget = 0, dirs = 8;
  function setDirs(n) { if (n !== dirs) { dirs = n; atlases.clear(); } }
  function getAtlas(key, app) {
    let A = atlases.get(key);
    if (!A) {
      const c = document.createElement('canvas'); c.width = FRAMES * RES; c.height = dirs * RES;
      A = { c, g: c.getContext('2d'), next: 0, total: FRAMES * dirs, ready: false, app, model: null, used: 0 };
      atlases.set(key, A);
      if (atlases.size > 28) {
        const old = [...atlases.entries()].filter(([, a]) => a !== A).sort((a, b) => a[1].used - b[1].used)[0];
        if (old) { disposeModel(old[1]); atlases.delete(old[0]); }
      }
    }
    A.used = performance.now();
    return A;
  }
  function disposeModel(A) {
    if (!A.model) return;
    scene.remove(A.model.root);
    A.model.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    A.model = null;
  }
  function bakeStep(A) {
    if (A.ready) return;
    if (!A.model) { A.model = buildPerson(A.app); scene.add(A.model.root); }
    kai.visible = false; dog.visible = false;
    for (const a of atlases.values()) if (a.model) a.model.root.visible = a === A;
    while (bakeBudget > 0 && A.next < A.total) {
      const d = Math.floor(A.next / FRAMES), f = A.next % FRAMES;
      let anim = 'idle', k = 0;
      for (const [a, n] of Object.entries(ANIMS)) if (f >= ANIM_OFF[a] && f < ANIM_OFF[a] + n) { anim = a; k = (f - ANIM_OFF[a]) / n; }
      A.model.root.rotation.y = d / dirs * Math.PI * 2;
      posePerson(A.model.P, anim, k);
      renderer.render(scene, cam);
      A.g.drawImage(cnv, f * RES, d * RES);
      A.next++; bakeBudget--;
    }
    A.model.root.visible = false;
    if (A.next >= A.total) { A.ready = true; disposeModel(A); }
  }
  // desenha um NPC; devolve false se a folha ainda não ficou pronta (use o sprite 2D)
  function drawPerson(ctx, key, app, anim, t, fx, fy, x, y, size) {
    const A = getAtlas(key, app);
    if (!A.ready) { bakeStep(A); if (!A.ready) return false; }
    let d = Math.round(Math.atan2(fx, fy) / (Math.PI * 2) * dirs); d = ((d % dirs) + dirs) % dirs;
    const n = ANIMS[anim] || 2, f = ANIM_OFF[anim] + Math.floor(t * (ANIM_FPS[anim] || 2)) % n;
    const k = size / RES;
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(A.c, f * RES, d * RES, RES, RES, Math.round(x - anchor[0] * k), Math.round(y - anchor[1] * k), size, size);
    ctx.imageSmoothingEnabled = sm;
    return true;
  }
  function tick(budget) { bakeBudget = budget; }

  // desenha o modelo com o pé em (x, y); size = largura/altura do quadro em unidades do contexto atual
  function draw(ctx, which, st, x, y, size, white) {
    kai.visible = which === 'kai'; dog.visible = which === 'dog';
    for (const a of atlases.values()) if (a.model) a.model.root.visible = false;
    if (which === 'kai') poseKai(st); else poseDog(st);
    renderer.render(scene, cam);
    const k = size / RES;
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    if (white) { ctx.save(); ctx.filter = 'brightness(3)'; }
    ctx.drawImage(cnv, Math.round(x - anchor[0] * k), Math.round(y - anchor[1] * k), size, size);
    if (white) ctx.restore();
    ctx.imageSmoothingEnabled = sm;
  }
  return { draw, drawPerson, tick, setDirs, RES, ANIMS, atlasCount: () => atlases.size };
})();
