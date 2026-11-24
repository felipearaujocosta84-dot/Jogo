// Testes automatizados da física, IA e regras de corrida (Node, sem navegador).
// Executar:  npm test
import { VehiclePhysics } from '../src/vehicles/VehiclePhysics.js';
import { CARS, applyUpgrades, camberGrip } from '../src/vehicles/VehicleCatalog.js';
import { TrackGeometry } from '../src/tracks/TrackGeometry.js';
import { RacingAI } from '../src/ai/RacingAI.js';
import { RaceManager } from '../src/race/RaceManager.js';
import { v3, quatFromYaw, rotate, quatLookRotation, dist } from '../src/utils/MathUtils.js';
import { ReplayRecorder, FRAME_FLOATS, REPLAY_HZ } from '../src/race/ReplaySystem.js';
import { GhostLap } from '../src/race/GhostLap.js';
import { Achievements, ACHIEVEMENTS } from '../src/systems/Achievements.js';
import { RigidBodySim, makeAdapter, flatGround, trackGround } from './sim/RigidBodySim.js';
import GrandCircuit from '../src/tracks/GrandCircuit.js';
import MountainRacing from '../src/tracks/MountainRacing.js';
import DesertSpeedway from '../src/tracks/DesertSpeedway.js';
import CoastalRacing from '../src/tracks/CoastalRacing.js';

const DT = 1 / 60;
let failures = 0;
const check = (name, ok, info = '') => {
  console.log(`${ok ? '  OK ' : ' FALHA'}  ${name} ${info}`);
  if (!ok) failures++;
};

function makeCar(carId, { ground = flatGround, position = v3(0, 0.6, 0), yaw = 0, surfaceAt = null, upgrades, setup = null } = {}) {
  const spec = applyUpgrades(CARS.find((c) => c.id === carId), upgrades, setup);
  const tmp = new VehiclePhysics(spec, null);
  const body = new RigidBodySim({
    mass: spec.mass, inertia: VehiclePhysics.inertiaFor(spec), comLocal: tmp.comLocal,
    position, rotation: quatFromYaw(yaw),
  });
  const adapter = makeAdapter(body, ground, surfaceAt);
  const ph = new VehiclePhysics(spec, adapter, { transmission: 'auto', abs: true, tc: true });
  return { ph, body, ground, spec };
}
function stepCar(car, input, n = 1) {
  for (let i = 0; i < n; i++) {
    car.ph.step(DT, input);
    car.body.integrate(DT, (p) => car.ground.heightAt(p));
  }
}

console.log('\n== Matemática ==');
{
  const f = v3(0.6, 0.1, -0.79);
  const q = quatLookRotation(f);
  const r = rotate(v3(0, 0, 1), q);
  const fl = Math.hypot(f.x, f.y, f.z);
  check('quatLookRotation aponta +Z para a direção', dist(r, v3(f.x / fl, f.y / fl, f.z / fl)) < 1e-6);
  const y = rotate(v3(0, 0, 1), quatFromYaw(Math.PI / 2));
  check('yaw +90° gira +Z para +X', dist(y, v3(1, 0, 0)) < 1e-6);
}

console.log('\n== Suspensão em repouso ==');
for (const c of CARS) {
  const car = makeCar(c.id);
  stepCar(car, { throttle: 0, brake: 0, steer: 0 }, 240);
  const h1 = car.body.origin.y;
  stepCar(car, { throttle: 0, brake: 0, steer: 0 }, 60);
  const h2 = car.body.origin.y;
  const sum = car.ph.wheels.reduce((a, w) => a + w.load, 0);
  const front = car.ph.wheels[0].load + car.ph.wheels[1].load;
  check(`${c.name}: assenta e estabiliza`, Math.abs(h2 - h1) < 0.002 && car.body.chassisHits === 0, `altura=${h2.toFixed(3)} m`);
  check(`${c.name}: carga total ≈ peso`, Math.abs(sum - c.mass * 9.81) / (c.mass * 9.81) < 0.03, `${(sum / 9.81).toFixed(0)} kg`);
  check(`${c.name}: distribuição de peso`, Math.abs(front / sum - c.weightFront) < 0.03, `dianteira ${(100 * front / sum).toFixed(1)}%`);
  check(`${c.name}: parado não desliza`, car.ph.speed < 0.05, `${car.ph.speed.toFixed(3)} m/s`);
}

console.log('\n== Aceleração, velocidade máxima e frenagem ==');
for (const c of CARS) {
  const car = makeCar(c.id, { position: v3(0, 0.6, -2000) });
  stepCar(car, { throttle: 0, brake: 0, steer: 0 }, 60);
  let t = 0, t100 = null, t200 = null, maxGear = 1, maxKmh = 0;
  while (t < 70) {
    stepCar(car, { throttle: 1, brake: 0, steer: 0 });
    t += DT;
    const kmh = car.ph.speedKmh;
    maxKmh = Math.max(maxKmh, kmh);
    maxGear = Math.max(maxGear, car.ph.gear);
    if (t100 == null && kmh >= 100) t100 = t;
    if (t200 == null && kmh >= 200) t200 = t;
  }
  const lateral = Math.abs(car.body.origin.x);
  check(`${c.name}: 0-100 km/h`, t100 != null && t100 > 2.2 && t100 < 6.5, `${t100?.toFixed(2)} s`);
  check(`${c.name}: 0-200 km/h`, t200 != null && t200 < 22, `${t200?.toFixed(2)} s`);
  check(`${c.name}: velocidade máxima plausível`, maxKmh > 260 && maxKmh < 420, `${maxKmh.toFixed(0)} km/h, marcha ${maxGear}`);
  check(`${c.name}: segue reto em aceleração`, lateral < 3, `desvio ${lateral.toFixed(2)} m`);
  check(`${c.name}: chassi nunca toca o solo`, car.body.chassisHits === 0);

  // Frenagem 100 -> 0 com ABS
  const car2 = makeCar(c.id, { position: v3(0, 0.6, 0) });
  stepCar(car2, { throttle: 0, brake: 0, steer: 0 }, 60);
  while (car2.ph.speedKmh < 100) stepCar(car2, { throttle: 1, brake: 0, steer: 0 });
  const z0 = car2.body.origin.z;
  let n = 0;
  while (car2.ph.speed > 0.3 && n < 900) { stepCar(car2, { throttle: 0, brake: 1, steer: 0 }); n++; }
  const dBrake = car2.body.origin.z - z0;
  check(`${c.name}: frenagem 100-0 km/h (ABS)`, dBrake > 25 && dBrake < 48, `${dBrake.toFixed(1)} m`);
}

console.log('\n== Curva em regime permanente ==');
{
  const car = makeCar('vortex');
  stepCar(car, { throttle: 0, brake: 0, steer: 0 }, 60);
  // acelera a ~70 km/h e mantém com esterço constante
  for (let i = 0; i < 60 * 25; i++) {
    const kmh = car.ph.speedKmh;
    const thr = kmh < 70 ? 0.6 : 0.15;
    stepCar(car, { throttle: thr, brake: 0, steer: i > 60 * 8 ? 0.5 : 0 });
  }
  const latG = Math.abs(car.ph.accelLocal.x) || 0;
  const yawRate = car.ph.state.angVel.y;
  const v = car.ph.speed;
  const ay = Math.abs(yawRate * v) / 9.81;
  check('Vortex: curva estável a ~70 km/h', ay > 0.3 && ay < 1.3 && car.body.chassisHits === 0, `ay=${ay.toFixed(2)} g, v=${(v * 3.6).toFixed(0)} km/h`);
  const roll = car.ph.wheels[0].compression - car.ph.wheels[1].compression;
  check('Transferência de peso lateral (rolagem)', Math.abs(roll) > 0.005, `Δcompressão=${roll.toFixed(3)} m, FL=${car.ph.wheels[0].load.toFixed(0)} N FR=${car.ph.wheels[1].load.toFixed(0)} N`);
  void latG;
}

console.log('\n== Freio de mão / drift ==');
{
  const car = makeCar('vortex', { position: v3(0, 0.6, -500) });
  stepCar(car, { throttle: 0, brake: 0, steer: 0 }, 60);
  while (car.ph.speedKmh < 90) stepCar(car, { throttle: 1, brake: 0, steer: 0 });
  let maxDrift = 0;
  for (let i = 0; i < 70; i++) {
    stepCar(car, { throttle: 0.4, brake: 0, steer: 0.8, handbrake: i < 40 ? 1 : 0 });
    maxDrift = Math.max(maxDrift, Math.abs(car.ph.driftAngle));
  }
  check('Freio de mão trava traseira e provoca derrapagem', maxDrift > 0.25, `ângulo máx ${(maxDrift * 57.3).toFixed(1)}°`);
  check('Sem capotar no drift', car.ph.axes.up.y > 0.8);
}

console.log('\n== Transferência longitudinal ==');
{
  const car = makeCar('stratos', { position: v3(0, 0.6, -500) });
  stepCar(car, { throttle: 0, brake: 0, steer: 0 }, 90);
  const rest = car.ph.wheels[0].load + car.ph.wheels[1].load;
  while (car.ph.speedKmh < 120) stepCar(car, { throttle: 1, brake: 0, steer: 0 });
  for (let i = 0; i < 20; i++) stepCar(car, { throttle: 0, brake: 1, steer: 0 });
  const braking = car.ph.wheels[0].load + car.ph.wheels[1].load;
  check('Frenagem transfere peso para a dianteira', braking > rest * 1.15, `${rest.toFixed(0)} N -> ${braking.toFixed(0)} N`);
}

console.log('\n== Setup (ajustes da garagem) ==');
{
  check('Cambagem ideal (~2,5°) dá mais aderência lateral que 0,5° e 4°', camberGrip(2.5).lat > camberGrip(0.5).lat && camberGrip(2.5).lat > camberGrip(4).lat);
  const extremes = {
    'tudo no mínimo': { finalDrive: -2, brakeBias: 0.56, springs: -2, rideHeight: -2, camberFront: 0.5, camberRear: 0.5, aeroBalance: -2, lsd: -2, tirePressure: -2 },
    'tudo no máximo': { finalDrive: 2, brakeBias: 0.76, springs: 2, rideHeight: 2, camberFront: 4, camberRear: 4, aeroBalance: 2, lsd: 2, tirePressure: 2 },
  };
  for (const [label, setup] of Object.entries(extremes)) {
    for (const id of ['vortex', 'volt']) {
      const car = makeCar(id, { position: v3(0, 0.6, -1500), setup });
      stepCar(car, { throttle: 0, brake: 0, steer: 0 }, 240);
      const settled = car.body.chassisHits === 0 && car.ph.speed < 0.05;
      let t = 0;
      while (car.ph.speedKmh < 100 && t < 15) { stepCar(car, { throttle: 1, brake: 0, steer: 0 }); t += DT; }
      const z0 = car.body.origin.z;
      let n = 0;
      while (car.ph.speed > 0.3 && n < 900) { stepCar(car, { throttle: 0, brake: 1, steer: 0 }); n++; }
      const d = car.body.origin.z - z0;
      check(`${car.spec.name} com setup ${label}: estável, acelera e freia`, settled && t < 10 && d > 25 && d < 55 && car.body.chassisHits === 0, `0-100 ${t.toFixed(2)} s, frenagem ${d.toFixed(1)} m`);
    }
  }
  const short = applyUpgrades(CARS[0], {}, { finalDrive: 2 }).transmission.finalDrive;
  const long = applyUpgrades(CARS[0], {}, { finalDrive: -2 }).transmission.finalDrive;
  check('Relação final curta/longa altera a transmissão', short > CARS[0].transmission.finalDrive && long < CARS[0].transmission.finalDrive, `${long.toFixed(2)} / ${CARS[0].transmission.finalDrive} / ${short.toFixed(2)}`);
  const ev = makeCar('volt', { position: v3(0, 0.6, -900) });
  let gears = new Set();
  for (let i = 0; i < 60 * 20; i++) { stepCar(ev, { throttle: 1, brake: 0, steer: 0 }); gears.add(ev.ph.gear); }
  check('Elétrico: uma marcha e torque desde zero', gears.size === 1 && gears.has(1), `marchas usadas: ${[...gears].join(',')}`);
}

console.log('\n== Pistas (geometria) ==');
const defs = [GrandCircuit, MountainRacing, DesertSpeedway, CoastalRacing];
for (const def of defs) {
  const tr = new TrackGeometry(def);
  const sep = tr.minSeparation();
  check(`${def.name}: traçado fechado e em escala real`, tr.length > 4000, `${(tr.length / 1000).toFixed(2)} km`);
  check(`${def.name}: trechos não se sobrepõem (barreiras)`, sep.min > 2 * tr.barrierOffset + 4, `separação ${sep.min.toFixed(0)} m`);
  check(`${def.name}: raio mínimo dirigível`, tr.minRadius() > 20, `${tr.minRadius().toFixed(0)} m`);
}

console.log('\n== Trechos especiais (túneis, pontes, desfiladeiro, cidade) ==');
for (const def of defs) {
  const tr = new TrackGeometry(def);
  const feats = (def.features ?? []).filter((f) => f.from != null);
  if (!feats.length) continue;
  const inside = feats.every((f) => f.from >= 0 && f.to <= tr.length && f.to > f.from);
  const sorted = [...feats].sort((a, b) => a.from - b.from);
  const noOverlap = sorted.every((f, i) => i === 0 || f.from > sorted[i - 1].to + 20);
  check(`${def.shortName}: trechos dentro do traçado e sem sobreposição`, inside && noOverlap, feats.map((f) => `${f.type} ${f.from}-${f.to}`).join(', '));
  for (const f of tr.featuresOf('bridge')) {
    const mid = (f.from + f.to) / 2;
    const dMid = tr.valleyDepth(mid, 0);
    const dOut = tr.valleyDepth(f.to + 40, 0);
    check(`${def.shortName}: vale sob "${f.name}"`, Math.abs(dMid - f.depth) < 0.5 && dOut === 0 && tr.valleyDepth(mid, 400) === 0, `profundidade ${dMid.toFixed(1)} m no meio, ${dOut} m fora`);
    if (f.water) {
      let maxY = -Infinity;
      for (let sPos = f.from + 60; sPos <= f.to - 60; sPos += 10) maxY = Math.max(maxY, tr.pointAt(sPos).p.y - 2.4 - tr.valleyDepth(sPos, 0));
      check(`${def.shortName}: água visível sob "${f.name}"`, maxY < 0.4, `fundo máx ${maxY.toFixed(1)} m (nível do mar 0,4 m)`);
    }
  }
  for (const f of tr.featuresOf('oasis')) {
    const pt = tr.pointAt(f.at, f.side * (tr.barrierOffset + f.distance)).p;
    const d = tr.distanceToCenter(pt.x, pt.z).distance;
    check(`${def.shortName}: oásis longe da pista (relevo não afeta o asfalto)`, d - tr.barrierOffset > f.radius * 1.6 + 10, `centro a ${d.toFixed(0)} m do eixo`);
  }
  for (const f of tr.featuresOf('mirage')) {
    let maxK = 0;
    for (let sPos = f.from; sPos <= f.to; sPos += 10) maxK = Math.max(maxK, Math.abs(tr.sampleAt(tr.indexAtS(sPos)).curvature));
    check(`${def.shortName}: miragem em trecho reto (${f.from}-${f.to})`, maxK < 0.004, `curvatura máx ${maxK.toFixed(4)}`);
  }
  for (const f of tr.featuresOf('tunnel')) {
    check(`${def.shortName}: "${f.name}" detectado pelo progresso`, !!tr.featureAt((f.from + f.to) / 2, 'tunnel') && !tr.featureAt(f.from - 50, 'tunnel'), `${f.to - f.from} m`);
  }
}

console.log('\n== IA completa voltas reais (física + IA + regras) ==');
for (const def of [GrandCircuit, MountainRacing, DesertSpeedway, CoastalRacing]) {
  const tr = new TrackGeometry(def);
  const ground = def.controlPoints.some((p) => p.length === 3 && p[1] !== 0) ? trackGround(tr) : flatGround;
  const surface = (car) => (p) => tr.surfaceAtLateral(tr.project(p, car._hint ?? -1).lateral);
  const race = new RaceManager(tr, { mode: 'quick', laps: 1, countdown: 1 });
  const slots = tr.gridSlots(3);
  const cars = [];
  ['vortex', 'stratos', 'zenith'].forEach((id, i) => {
    const sl = slots[i];
    const holder = {};
    const car = makeCar(id, { ground, position: v3(sl.position.x, sl.position.y + 0.65, sl.position.z), yaw: sl.heading, surfaceAt: (p) => surface(holder)(p) });
    car.ai = new RacingAI(tr, car.ph, 'hard', i + 1);
    car.maxLat = 0; car.respawns = 0;
    car.part = race.addParticipant({ id, name: id, isPlayer: false, getPosition: () => car.body.origin, getSpeed: () => car.ph.speed });
    holder._hint = car.part.index;
    cars.push(car);
  });
  // assentar
  for (let i = 0; i < 60; i++) for (const c of cars) stepCar(c, { throttle: 0, brake: 1, steer: 0 });
  race.startCountdown();
  let t = 0;
  const laps = [];
  race.on('lap', (p, lt) => laps.push([p.id, lt]));
  while (t < 400 && !race.participants.every((p) => p.finished)) {
    race.update(DT);
    for (const c of cars) {
      const me = c.part;
      const others = cars.filter((o) => o !== c).map((o) => ({ s: o.part.s, lateral: o.part.lateral, speed: o.ph.speed }));
      const inp = c.ai.update(DT, me, others, race.isRacing);
      c.ph.launchHold = !race.isRacing;
      stepCar(c, inp);
      c.maxLat = Math.max(c.maxLat, Math.abs(me.lateral));
      if (c.ai.wantsRespawn) {
        c.respawns++;
        const pt = tr.pointAt(me.s, 0);
        c.body.com = v3(pt.p.x, pt.p.y + 0.7, pt.p.z);
        c.body.rot = quatFromYaw(pt.heading);
        c.body.vel = v3(); c.body.angVel = v3();
        c.ph.resetState(); c.ai.onRespawn();
      }
    }
    t += DT;
  }
  for (const c of cars) {
    const lap = laps.find((l) => l[0] === c.part.id);
    check(`${def.shortName} — ${c.spec.name} (IA) completa a volta`, !!lap, lap ? `tempo ${lap[1].toFixed(1)} s, média ${(tr.length / lap[1] * 3.6).toFixed(0)} km/h` : `dist=${c.part.distance.toFixed(0)}`);
    check(`${def.shortName} — ${c.spec.name} fica entre as barreiras`, c.maxLat < tr.barrierOffset - 1, `desvio lateral máx ${c.maxLat.toFixed(1)} m (barreira a ${tr.barrierOffset.toFixed(1)} m)`);
    check(`${def.shortName} — ${c.spec.name} sem travar/capotar`, c.respawns === 0 && c.body.chassisHits === 0, `respawns=${c.respawns}, toques do chassi=${c.body.chassisHits}`);
  }
  check(`${def.shortName}: todos terminam e a classificação segue a ordem de chegada`, race.finishOrder.length === 3 && race.ranking.every((p, i) => p === race.finishOrder[i]), race.results().map((r) => `${r.position}º ${r.name}`).join(', '));
}

console.log('\n== Replay, fantasma e conquistas ==');
{
  // Grava 20 s de um carro real e confere a interpolação
  const car = makeCar('stratos', { position: v3(0, 0.6, -800) });
  const rec = new ReplayRecorder(2);
  const truth = [];
  for (let i = 0; i < 60 * 20; i++) {
    stepCar(car, { throttle: 1, brake: 0, steer: i > 300 ? 0.3 : 0 });
    rec.step(DT, (c, arr, o) => {
      const b = car.body;
      const p = b.origin, q = b.rot;
      const vals = [p.x + c, p.y, p.z, q.x, q.y, q.z, q.w, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, car.ph.engine.rpm, car.ph.speedKmh, 1];
      for (let k = 0; k < FRAME_FLOATS; k++) arr[o + k] = vals[k];
    });
    truth.push({ t: i * DT, p: { ...car.body.origin } });
  }
  check('Replay grava 30 quadros/s', Math.abs(rec.frames - 20 * REPLAY_HZ) <= 2, `${rec.frames} quadros, ${rec.sizeMB.toFixed(2)} MB alocados`);
  let maxErr = 0;
  for (const tr of truth.filter((_, i) => i % 7 === 0)) {
    const f = rec.sample(0, tr.t);
    maxErr = Math.max(maxErr, Math.hypot(f[0] - tr.p.x, f[2] - tr.p.z));
  }
  check('Replay interpola a trajetória com precisão', maxErr < 0.25, `erro máx ${(maxErr * 100).toFixed(1)} cm`);
  const f2 = rec.sample(1, 10);
  check('Replay separa os carros', Math.abs(f2[0] - rec.sample(0, 10)[0] - 1) < 1e-3);
  const qn = Math.hypot(f2[3], f2[4], f2[5], f2[6]);
  check('Replay mantém o quaternion normalizado', Math.abs(qn - 1) < 1e-5);

  // Fantasma: grava, compacta, recupera
  const ghost = new GhostLap({ x: 0, z: -500 });
  for (const tr of truth) ghost.record(DT, tr.p, { x: 0, y: 0.38, z: 0, w: 0.925 });
  ghost.time = 20;
  const enc = ghost.encode();
  const dec = GhostLap.decode(JSON.parse(JSON.stringify(enc)));
  let gErr = 0;
  for (let t = 0; t < dec.duration; t += 0.37) {
    const a = ghost.sample(t), b = dec.sample(t);
    gErr = Math.max(gErr, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
  }
  check('Fantasma salvo/carregado sem perder precisão', gErr < 0.06 && dec.time === 20, `erro ${(gErr * 100).toFixed(1)} cm, ${(enc.data.length / 1024).toFixed(1)} KB para 20 s`);
  check('Fantasma some ao fim da volta', dec.sample(dec.duration + 1) === null);

  // Conquistas
  const data = { stats: { podiums: 0, distanceKm: 0 }, garage: { owned: ['vortex'], cars: {} } };
  const got = [];
  const ach = new Achievements(data, (a) => got.push(a.id));
  ach.tick(DT, { speedKmh: 305, drift: 0 });
  for (let i = 0; i < 200; i++) ach.tick(DT, { speedKmh: 80, drift: 0.5 });
  ach.raceFinished({ position: 1, ai: true, difficulty: 'expert', trackId: 'grand', stormy: true });
  ach.raceFinished({ position: 1, ai: true, difficulty: 'easy', trackId: 'grand', stormy: false });
  for (const t of ['mountain', 'desert', 'coastal']) ach.raceFinished({ position: 1, ai: true, difficulty: 'easy', trackId: t });
  data.garage.owned.push('stratos', 'apex');
  data.garage.cars.vortex = { upgrades: { engine: 3, brakes: 3, transmission: 3, suspension: 3, aero: 3, tires: 3 } };
  ach.garageChanged(data.garage);
  ach.lap({ clean: true });
  const expected = ['speed300', 'drift', 'first_race', 'first_win', 'expert_win', 'storm_win', 'all_tracks', 'collector', 'maxed', 'clean_lap'];
  check('Conquistas desbloqueiam pelos eventos certos', expected.every((id) => got.includes(id)) && got.length === new Set(got).size, got.join(', '));
  check('Conquistas não liberam o que não foi feito', !got.includes('champion') && !got.includes('km500') && !got.includes('podium5'), `${ach.count}/${ACHIEVEMENTS.length}`);
}

console.log(failures ? `\n${failures} falha(s).` : '\nTodos os testes passaram.');
process.exit(failures ? 1 : 0);
