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
  box(torso, 0.52, 0.54, 0.32, 0x7a4a2a, 0, 0.27, 0);
  box(torso, 0.54, 0.07, 0.34, 0xc99a3a, 0, 0.06, 0, false);
  box(torso, 0.56, 0.13, 0.36, 0xc8423b, 0, 0.55, 0);
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
  const arms = [-0.34, 0.34].map(x => {
    const p = pivot(torso, x, 0.5, 0);
    box(p, 0.15, 0.36, 0.17, 0x7a4a2a, 0, -0.17, 0);
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
    const ph = st.phase || 0, mv = st.moving ? 1 : 0;
    kai.rotation.y = st.yaw;
    const sw = Math.sin(ph * Math.PI / 2) * 0.75 * mv;
    legs[0].p.rotation.x = sw; legs[1].p.rotation.x = -sw;
    arms[0].rotation.set(-sw * 0.8, 0, 0.08); arms[1].rotation.set(sw * 0.8, 0, -0.08);
    body.position.y = mv ? Math.abs(Math.sin(ph * Math.PI / 2)) * 0.05 : Math.sin(st.t * 2) * 0.012;
    torso.rotation.set(mv * 0.06, 0, 0);
    head.rotation.set(0, 0, 0);
    scarfTail.rotation.x = 0.3 + mv * 0.4 + Math.sin(st.t * 6) * 0.1 * mv;
    const tier = st.espada || 1, bladeCol = tier >= 3 ? 0x8fd8ff : tier === 2 ? 0xa9a6a0 : 0xe8eef5;
    bsBlade.material = M(bladeCol); hsBlade.material = M(bladeCol);
    armor.forEach(a => { a.visible = !!st.armadura; });
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
  // desenha o modelo com o pé em (x, y); size = largura/altura do quadro em unidades do contexto atual
  function draw(ctx, which, st, x, y, size, white) {
    kai.visible = which === 'kai'; dog.visible = which === 'dog';
    if (which === 'kai') poseKai(st); else poseDog(st);
    renderer.render(scene, cam);
    const k = size / RES;
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    if (white) { ctx.save(); ctx.filter = 'brightness(3)'; }
    ctx.drawImage(cnv, Math.round(x - anchor[0] * k), Math.round(y - anchor[1] * k), size, size);
    if (white) ctx.restore();
    ctx.imageSmoothingEnabled = sm;
  }
  return { draw, RES };
})();
