// Animação dos jogadores.
// - ProceduralAnimator: anima os ossos do personagem provisório por código (corrida, chute, carrinho, defesa…).
// - GlbAnimator: usa as AnimationGroups de um modelo GLB/GLTF (Idle, Walk, Run, Kick…).
// Os dois têm a mesma interface: update(dt, speed, sprint), play(action, opts), isBusy(), onEvent.

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (t) => t * t * (3 - 2 * t);

/** Duração (s) e momento de contato (fração) de cada ação. */
export const ACTIONS = {
  kick: { duration: 0.5, contact: 0.42 },
  pass: { duration: 0.38, contact: 0.45 },
  slide: { duration: 0.85, contact: 0.2 },
  dive: { duration: 1.1, contact: 0.25 },
  celebrate: { duration: 2.2, contact: 0 },
  stumble: { duration: 0.9, contact: 0 }
};

const POSE_BONES = ['hips', 'spine', 'chest', 'head', 'upperArmL', 'foreArmL', 'upperArmR', 'foreArmR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];

function emptyPose() {
  const p = { hipsY: 0, hipsZ: 0, hipsX: 0 };
  for (const b of POSE_BONES) p[b] = [0, 0, 0];
  return p;
}

export class ProceduralAnimator {
  /**
   * @param {Record<string, import('@babylonjs/core').TransformNode>} nodes nós ligados aos ossos
   */
  constructor(nodes) {
    this.nodes = nodes;
    this.base = {};
    for (const k in nodes) this.base[k] = nodes[k].position.clone();
    this.phase = Math.random() * TAU;
    this.time = Math.random() * 10;
    this.loco = emptyPose();
    this.act = emptyPose();
    this.out = emptyPose();
    this.action = null;
    this.onEvent = null; // callback(actionName, 'contact' | 'end')
    this.smoothedSpeed = 0;
  }

  play(name, opts = {}) {
    const def = ACTIONS[name];
    if (!def) return;
    this.action = { name, t: 0, duration: opts.duration || def.duration, contact: def.contact, contactSent: false, side: opts.side || 1 };
  }

  isBusy() {
    return !!this.action && this.action.name !== 'celebrate';
  }

  get currentAction() {
    return this.action ? this.action.name : null;
  }

  update(dt, speed, sprint = false, keeper = false) {
    this.time += dt;
    this.smoothedSpeed = lerp(this.smoothedSpeed, speed, clamp01(dt * 10));
    const s = this.smoothedSpeed;
    this.locomotion(dt, s, sprint, keeper);

    let w = 0;
    if (this.action) {
      const a = this.action;
      a.t += dt / a.duration;
      if (!a.contactSent && a.t >= a.contact) {
        a.contactSent = true;
        if (this.onEvent) this.onEvent(a.name, 'contact');
      }
      if (a.t >= 1) {
        this.action = null;
        if (this.onEvent) this.onEvent(a.name, 'end');
      } else {
        this.actionPose(a);
        w = Math.min(clamp01(a.t / 0.12), clamp01((1 - a.t) / 0.18));
      }
    }
    this.blendAndApply(w);
  }

  locomotion(dt, s, sprint, keeper) {
    const p = this.loco;
    const stride = s < 3 ? 1.1 : 1.55;
    this.phase = (this.phase + (s * dt / stride) * TAU) % TAU;
    const ph = this.phase;
    const run = clamp01((s - 0.3) / 5.5);           // 0 parado .. 1 correndo
    const spr = sprint ? clamp01((s - 5) / 2) : 0;   // extra no sprint
    const legA = lerp(0, 0.75, run) + spr * 0.25;
    const armA = lerp(0, 0.7, run) + spr * 0.3;
    const sin = Math.sin(ph), cos = Math.cos(ph);
    const idle = 1 - run;
    const breath = Math.sin(this.time * 2.2) * 0.02 * idle;

    // postura de goleiro parado: base mais aberta e agachada
    const crouch = keeper ? 0.35 * idle : 0.08 * idle;

    p.hipsY = -Math.abs(sin) * 0.05 * run + Math.abs(cos) * 0.03 * run - crouch * 0.25 - 0.02 * run;
    p.hipsX = 0; p.hipsZ = 0;
    p.hips[0] = 0; p.hips[1] = sin * 0.12 * run; p.hips[2] = 0;
    p.spine[0] = 0.06 + 0.16 * run + spr * 0.1 + crouch * 0.6; p.spine[1] = -sin * 0.1 * run; p.spine[2] = 0;
    p.chest[0] = breath; p.chest[1] = -sin * 0.12 * run; p.chest[2] = 0;
    p.head[0] = -0.08 * run - crouch * 0.4; p.head[1] = 0; p.head[2] = 0;

    // pernas: coxa balança, joelho dobra na recuperação
    p.thighL[0] = -sin * legA - crouch * 0.9; p.thighL[1] = 0; p.thighL[2] = keeper ? 0.12 * idle : 0.02;
    p.thighR[0] = sin * legA - crouch * 0.9; p.thighR[1] = 0; p.thighR[2] = keeper ? -0.12 * idle : -0.02;
    p.shinL[0] = 0.15 * run + Math.max(0, cos) * 1.3 * legA + crouch * 1.6; p.shinL[1] = 0; p.shinL[2] = 0;
    p.shinR[0] = 0.15 * run + Math.max(0, -cos) * 1.3 * legA + crouch * 1.6; p.shinR[1] = 0; p.shinR[2] = 0;
    p.footL[0] = -0.2 * Math.max(0, cos) * run - crouch * 0.7; p.footL[1] = 0; p.footL[2] = 0;
    p.footR[0] = -0.2 * Math.max(0, -cos) * run - crouch * 0.7; p.footR[1] = 0; p.footR[2] = 0;

    // braços em oposição às pernas, cotovelos dobrados ao correr
    p.upperArmL[0] = sin * armA - (keeper ? 0.6 * idle : 0); p.upperArmL[1] = 0; p.upperArmL[2] = 0.1 + 0.08 * run + (keeper ? 0.35 * idle : 0);
    p.upperArmR[0] = -sin * armA - (keeper ? 0.6 * idle : 0); p.upperArmR[1] = 0; p.upperArmR[2] = -0.1 - 0.08 * run - (keeper ? 0.35 * idle : 0);
    p.foreArmL[0] = -0.25 - 1.1 * run - (keeper ? 0.6 * idle : 0); p.foreArmL[1] = 0; p.foreArmL[2] = 0;
    p.foreArmR[0] = -0.25 - 1.1 * run - (keeper ? 0.6 * idle : 0); p.foreArmR[1] = 0; p.foreArmR[2] = 0;
  }

  actionPose(a) {
    const p = this.act;
    const t = a.t;
    // começa a partir da locomoção atual para não "teleportar" partes não animadas
    for (const b of POSE_BONES) p[b] = this.loco[b].slice();
    p.hipsY = this.loco.hipsY; p.hipsX = 0; p.hipsZ = 0;

    switch (a.name) {
      case 'kick':
      case 'pass': {
        const strong = a.name === 'kick' ? 1 : 0.55;
        // 0..contact: perna de trás; contact..0.7: golpe; depois: acompanhamento
        let thigh, shin;
        if (t < a.contact) {
          const k = smooth(t / a.contact);
          thigh = lerp(0, 0.75 * strong, k);
          shin = lerp(0.2, 1.6 * strong, k);
        } else if (t < 0.7) {
          const k = smooth((t - a.contact) / (0.7 - a.contact));
          thigh = lerp(0.75 * strong, -1.35 * strong, k);
          shin = lerp(1.6 * strong, 0.05, k);
        } else {
          const k = smooth((t - 0.7) / 0.3);
          thigh = lerp(-1.35 * strong, -0.2, k);
          shin = lerp(0.05, 0.3, k);
        }
        p.thighR = [thigh, a.name === 'pass' ? -0.35 : 0, -0.05];
        p.shinR = [shin, 0, 0];
        p.footR = [a.name === 'pass' ? 0 : 0.4, a.name === 'pass' ? -0.6 : 0, 0];
        p.thighL = [0.15, 0, 0.05];
        p.shinL = [0.35, 0, 0];
        p.spine = [0.05 - thigh * 0.12, 0.25 * strong, 0];
        p.chest = [0, 0.15 * strong, 0];
        p.upperArmL = [-0.5 * strong, 0, 0.9 * strong + 0.1];
        p.upperArmR = [0.3 * strong, 0, -0.6 * strong - 0.1];
        p.foreArmL = [-0.4, 0, 0];
        p.foreArmR = [-0.4, 0, 0];
        p.hipsY = -0.05;
        break;
      }
      case 'slide': {
        // carrinho: corpo baixo e inclinado para trás, perna direita esticada à frente
        const k = smooth(clamp01(t / 0.2));
        p.hipsY = lerp(0, -0.6, k);
        p.hipsX = lerp(0, -0.95, k);
        p.thighR = [-0.65, 0, -0.1];
        p.shinR = [0.05, 0, 0];
        p.footR = [0.3, 0, 0];
        p.thighL = [0.5, 0, 0.25];
        p.shinL = [1.9, 0, 0];
        p.spine = [0.55, 0, 0];
        p.chest = [0.2, 0, 0];
        p.head = [0.4, 0, 0];
        p.upperArmL = [0.4, 0, 0.9];
        p.upperArmR = [0.4, 0, -0.9];
        p.foreArmL = [-0.3, 0, 0];
        p.foreArmR = [-0.3, 0, 0];
        break;
      }
      case 'dive': {
        // goleiro: salto lateral com braços esticados
        const side = a.side;
        const up = Math.sin(clamp01(t / 0.6) * Math.PI);
        const k = smooth(clamp01(t / 0.25));
        p.hipsY = lerp(0, 0.25, up) - lerp(0, 0.55, smooth(clamp01((t - 0.45) / 0.3)));
        p.hipsZ = -side * lerp(0, 1.35, k);
        p.upperArmL = [-2.9, 0, 0.2 * side];
        p.upperArmR = [-2.9, 0, 0.2 * side];
        p.foreArmL = [-0.1, 0, 0];
        p.foreArmR = [-0.1, 0, 0];
        p.thighL = [-0.2, 0, 0.3];
        p.thighR = [0.1, 0, -0.3];
        p.shinL = [0.4, 0, 0];
        p.shinR = [0.6, 0, 0];
        p.spine = [0, 0, -side * 0.2];
        break;
      }
      case 'celebrate': {
        const jump = Math.abs(Math.sin(t * Math.PI * 4));
        p.hipsY = jump * 0.25;
        p.upperArmL = [-2.8 + Math.sin(t * 30) * 0.15, 0, 0.4];
        p.upperArmR = [-2.8 - Math.sin(t * 30) * 0.15, 0, -0.4];
        p.foreArmL = [-0.3, 0, 0];
        p.foreArmR = [-0.3, 0, 0];
        p.thighL = [-0.3 * jump, 0, 0.05];
        p.thighR = [-0.3 * jump, 0, -0.05];
        p.shinL = [0.6 * jump, 0, 0];
        p.shinR = [0.6 * jump, 0, 0];
        p.spine = [-0.15, 0, 0];
        p.head = [-0.3, 0, 0];
        break;
      }
      case 'stumble': {
        const k = Math.sin(clamp01(t) * Math.PI);
        p.hipsY = -0.25 * k;
        p.spine = [0.7 * k, 0, 0.1];
        p.upperArmL = [-1.2 * k, 0, 0.6];
        p.upperArmR = [-1.0 * k, 0, -0.6];
        p.shinL = [0.8 * k, 0, 0];
        p.shinR = [0.5 * k, 0, 0];
        break;
      }
    }
  }

  blendAndApply(w) {
    const L = this.loco, A = this.act, n = this.nodes;
    for (const b of POSE_BONES) {
      const node = n[b];
      if (!node) continue;
      const l = L[b], a = A[b];
      node.rotation.set(lerp(l[0], a[0], w), lerp(l[1], a[1], w), lerp(l[2], a[2], w));
    }
    const hips = n.hips;
    if (hips) {
      hips.position.y = this.base.hips.y + lerp(L.hipsY, A.hipsY, w);
      hips.rotation.x += lerp(L.hipsX, A.hipsX, w);
      hips.rotation.z += lerp(L.hipsZ, A.hipsZ, w);
    }
  }
}

/**
 * Animador para modelos GLB com AnimationGroups. Nomes procurados (sem diferenciar maiúsculas):
 * idle, walk, run, sprint, kick, pass, slide/tackle, dive, celebrate.
 */
export class GlbAnimator {
  constructor(animationGroups, nameMap = {}) {
    this.groups = {};
    const find = (keys) => animationGroups.find((g) => keys.some((k) => g.name.toLowerCase().includes(k)));
    const map = {
      idle: nameMap.idle ? [nameMap.idle.toLowerCase()] : ['idle'],
      walk: nameMap.walk ? [nameMap.walk.toLowerCase()] : ['walk'],
      run: nameMap.run ? [nameMap.run.toLowerCase()] : ['run', 'jog'],
      kick: nameMap.kick ? [nameMap.kick.toLowerCase()] : ['kick', 'shoot'],
      pass: nameMap.pass ? [nameMap.pass.toLowerCase()] : ['pass'],
      slide: nameMap.slide ? [nameMap.slide.toLowerCase()] : ['slide', 'tackle'],
      dive: nameMap.dive ? [nameMap.dive.toLowerCase()] : ['dive', 'save'],
      celebrate: nameMap.celebrate ? [nameMap.celebrate.toLowerCase()] : ['celebrat', 'cheer', 'victory'],
      stumble: nameMap.stumble ? [nameMap.stumble.toLowerCase()] : ['stumble', 'fall', 'hit']
    };
    for (const k in map) this.groups[k] = find(map[k]) || null;
    // se não houver "run", usa "walk" acelerado; se não houver "idle", usa o primeiro grupo
    this.groups.idle ||= animationGroups[0] || null;
    this.groups.run ||= this.groups.walk;
    this.groups.walk ||= this.groups.run;
    for (const k of ['idle', 'walk', 'run']) {
      const g = this.groups[k];
      if (g) {
        g.start(true, 1);
        g.setWeightForAllAnimatables(k === 'idle' ? 1 : 0);
      }
    }
    for (const g of animationGroups) if (![this.groups.idle, this.groups.walk, this.groups.run].includes(g)) g.stop();
    this.action = null;
    this.onEvent = null;
  }

  play(name, opts = {}) {
    const def = ACTIONS[name];
    const g = this.groups[name];
    this.action = { name, t: 0, duration: opts.duration || def.duration, contact: def.contact, contactSent: false };
    if (g) {
      g.stop();
      g.start(false, (g.to - g.from) / 60 / this.action.duration || 1);
      g.setWeightForAllAnimatables(1);
    }
  }

  isBusy() {
    return !!this.action && this.action.name !== 'celebrate';
  }

  get currentAction() {
    return this.action ? this.action.name : null;
  }

  update(dt, speed) {
    const a = this.action;
    let actionW = 0;
    if (a) {
      a.t += dt / a.duration;
      if (!a.contactSent && a.t >= a.contact) {
        a.contactSent = true;
        this.onEvent && this.onEvent(a.name, 'contact');
      }
      if (a.t >= 1) {
        this.groups[a.name]?.stop();
        this.action = null;
        this.onEvent && this.onEvent(a.name, 'end');
      } else if (this.groups[a.name]) actionW = 1;
    }
    const base = 1 - actionW;
    const walkW = clamp01(speed / 2.5) * (1 - clamp01((speed - 3) / 2.5));
    const runW = clamp01((speed - 3) / 2.5);
    const idleW = 1 - clamp01(speed / 2.5);
    this.groups.idle?.setWeightForAllAnimatables(idleW * base);
    if (this.groups.walk && this.groups.walk !== this.groups.run) this.groups.walk.setWeightForAllAnimatables(walkW * base);
    if (this.groups.run) {
      this.groups.run.setWeightForAllAnimatables((this.groups.walk === this.groups.run ? walkW + runW : runW) * base);
      this.groups.run.speedRatio = Math.max(0.6, speed / 5);
    }
  }
}
