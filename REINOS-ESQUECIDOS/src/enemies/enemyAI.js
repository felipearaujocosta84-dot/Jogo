// IA dos inimigos (máquina de estados):
// idle -> wander -> (vê o jogador) chase -> attack (preparo + golpe) -> recover -> chase ...
// hurt (cambaleia), return (volta para casa e recupera vida), dead.
// O chefe tem golpe especial em área (com aviso no chão) e invoca esqueletos.
import { Vector3, Color4 } from '../babylon.js';

const tmp = new Vector3();

function angleTo(e, x, z) {
  return Math.atan2(x - e.position.x, z - e.position.z);
}

function turnTowards(e, yaw, dt, speed = 8) {
  let d = yaw - e.yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  e.yaw += d * Math.min(1, dt * speed);
  return Math.abs(d);
}

/** Move o inimigo em direção a (x, z) respeitando colisões. Retorna a distância restante. */
function moveTowards(e, x, z, speed, dt, game, stopDist = 0) {
  const dx = x - e.position.x, dz = z - e.position.z;
  const d = Math.hypot(dx, dz);
  let vx = 0, vz = 0;
  if (d > stopDist + 0.05) {
    vx = (dx / d) * speed;
    vz = (dz / d) * speed;
    turnTowards(e, Math.atan2(dx, dz), dt, 9);
  }
  step(e, vx, vz, dt, game);
  return d;
}

function step(e, vx, vz, dt, game) {
  const w = game.world;
  // separação entre inimigos
  let sx = 0, sz = 0;
  for (const o of game.enemies.list) {
    if (o === e || !o.alive || !o.active) continue;
    const ox = e.position.x - o.position.x, oz = e.position.z - o.position.z;
    const min = e.radius + o.radius + 0.25;
    const d2 = ox * ox + oz * oz;
    if (d2 < min * min && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      sx += (ox / d) * (min - d) * 6;
      sz += (oz / d) * (min - d) * 6;
    }
  }
  e.velocity.x += ((vx + sx) - e.velocity.x) * Math.min(1, dt * 10);
  e.velocity.z += ((vz + sz) - e.velocity.z) * Math.min(1, dt * 10);
  const kx = e.knock.x, kz = e.knock.z;
  e.knock.scaleInPlace(Math.max(0, 1 - dt * 7));
  tmp.set(e.position.x + (e.velocity.x + kx) * dt, 0, e.position.z + (e.velocity.z + kz) * dt);
  if (w.isDeepWater(tmp.x, tmp.z)) { tmp.x = e.position.x; tmp.z = e.position.z; }
  w.resolve(tmp, e.radius);
  // não atravessa o jogador
  const p = game.player;
  const px = tmp.x - p.position.x, pz = tmp.z - p.position.z;
  const pm = e.radius + p.radius;
  const pd2 = px * px + pz * pz;
  if (pd2 < pm * pm && pd2 > 1e-6) {
    const pd = Math.sqrt(pd2);
    tmp.x = p.position.x + (px / pd) * pm;
    tmp.z = p.position.z + (pz / pd) * pm;
  }
  const moved = Math.hypot(tmp.x - e.position.x, tmp.z - e.position.z);
  e.position.x = tmp.x;
  e.position.z = tmp.z;
  const gy = w.groundAt(tmp.x, tmp.z);
  e.position.y += (gy - e.position.y) * Math.min(1, dt * 15);
  const speed = moved / Math.max(dt, 1e-4);
  e.speedNorm += (Math.min(1, speed / Math.max(3, e.def.run)) - e.speedNorm) * Math.min(1, dt * 8);
  const stride = e.def.rig === 'quad' ? 2.0 : e.def.rig === 'spider' ? 1.0 : 1.5 * (e.def.scale || 1);
  e.phase += (moved / stride) * Math.PI * 2;
}

function canSeePlayer(e, game) {
  const p = game.player;
  if (p.dead) return false;
  if (game.isSafeZone(p.position.x, p.position.z)) return false;
  const d = Vector3.Distance(e.position, p.position);
  return d < e.def.aggro;
}

export function updateAI(e, dt, game) {
  const p = game.player;
  const def = e.def;
  const distP = Math.hypot(p.position.x - e.position.x, p.position.z - e.position.z);

  // chefe adormecido: só acorda com a missão final ativa e jogador perto
  if (e.dormant) {
    step(e, 0, 0, dt, game);
    if (distP < 13 && game.quests.isActive('rei_esquecido')) {
      e.dormant = false;
      e.target = p;
      e.setState('chase');
      game.onBossAwake(e);
    }
    return;
  }

  switch (e.state) {
    case 'idle': {
      step(e, 0, 0, dt, game);
      e.timer -= dt;
      if (canSeePlayer(e, game)) { e.target = p; e.setState('chase'); game.audio.alert(e.type); break; }
      if (e.timer <= 0) {
        const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 6;
        e.wanderTo = { x: e.home.x + Math.cos(a) * r, z: e.home.z + Math.sin(a) * r };
        e.setState('wander');
      }
      break;
    }
    case 'wander': {
      const d = moveTowards(e, e.wanderTo.x, e.wanderTo.z, def.walk, dt, game, 0.4);
      if (canSeePlayer(e, game)) { e.target = p; e.setState('chase'); game.audio.alert(e.type); break; }
      if (d < 0.6 || e.stateTime > 8) { e.timer = 2 + Math.random() * 4; e.setState('idle'); }
      break;
    }
    case 'chase': {
      const leash = def.leash || 32;
      const homeD = Math.hypot(e.position.x - e.home.x, e.position.z - e.home.z);
      if (p.dead || homeD > leash || game.isSafeZone(p.position.x, p.position.z) || distP > def.aggro * 2.2) {
        e.setState('return');
        break;
      }
      // cada inimigo mira um "lugar" ao redor do jogador (não se amontoam)
      const ring = def.range * 0.8 + p.radius;
      const a = e.slot;
      const tx = p.position.x + Math.sin(a) * ring * (distP < 4 ? 1 : 0);
      const tz = p.position.z + Math.cos(a) * ring * (distP < 4 ? 1 : 0);
      if (distP > def.range + p.radius * 0.5) {
        moveTowards(e, distP < 4 ? tx : p.position.x, distP < 4 ? tz : p.position.z, def.run, dt, game, 0.2);
      } else {
        step(e, 0, 0, dt, game);
        const off = turnTowards(e, angleTo(e, p.position.x, p.position.z), dt, 10);
        if (off < 0.5) {
          // chefe: golpe especial às vezes
          if (def.boss && Math.random() < 0.35) startSpecial(e, game);
          else { e.attackT = 0; e.setState('attack'); }
        }
      }
      e.slot += dt * 0.2;
      break;
    }
    case 'attack': {
      e.attackT += dt;
      step(e, 0, 0, dt, game);
      if (e.attackT < def.windup * 0.8) turnTowards(e, angleTo(e, p.position.x, p.position.z), dt, 6);
      if (!e.struck && e.attackT >= def.windup) {
        e.struck = true;
        // lunge
        e.knock.x += Math.sin(e.yaw) * 3.5;
        e.knock.z += Math.cos(e.yaw) * 3.5;
        const dx = p.position.x - e.position.x, dz = p.position.z - e.position.z;
        const d = Math.hypot(dx, dz);
        const dot = (dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw)) / (d || 1);
        game.audio.enemyAttack(e.type);
        if (d < def.range + p.radius + 0.5 && dot > 0.35) {
          p.combat.receiveDamage(def.dmg, e.position.x, e.position.z, def.boss ? 7 : 4);
        }
      }
      if (e.attackT > def.windup + 0.25) {
        e.struck = false;
        e.timer = def.recover * (0.8 + Math.random() * 0.4);
        e.setState('recover');
      }
      break;
    }
    case 'special': {
      // golpe em área do chefe: aviso no chão crescendo, depois impacto
      e.special = Math.min(1, e.stateTime / 0.4);
      step(e, 0, 0, dt, game);
      const R = 4.6;
      const k = Math.min(1, e.stateTime / 1.3);
      game.enemies.showTelegraph(e.position.x, e.position.z, R, k);
      if (e.stateTime >= 1.3 && !e.struck) {
        e.struck = true;
        game.enemies.hideTelegraph();
        game.effects.dust(e.position.add(new Vector3(0, 0.3, 0)), true);
        game.effects.burst(e.position.add(new Vector3(0, 0.5, 0)), { count: 40, color: new Color4(0.5, 0.8, 1, 1), power: 7, up: 0.6, spread: 2, life: 0.6 });
        game.cameraRig.shake(0.6);
        game.audio.slam();
        if (distP < R + p.radius) p.combat.receiveDamage(def.dmg * 1.4, e.position.x, e.position.z, 10);
      }
      if (e.stateTime > 1.8) {
        e.special = 0;
        e.struck = false;
        e.timer = 1.2;
        e.setState('recover');
      }
      break;
    }
    case 'recover': {
      e.timer -= dt;
      // recua um pouco/rodeia
      const back = def.boss ? 0 : 0.8;
      const a = angleTo(e, p.position.x, p.position.z);
      step(e, -Math.sin(a) * back + Math.cos(a) * back * 0.6, -Math.cos(a) * back - Math.sin(a) * back * 0.6, dt, game);
      turnTowards(e, a, dt, 6);
      if (e.timer <= 0) e.setState('chase');
      break;
    }
    case 'hurt': {
      e.timer -= dt;
      step(e, 0, 0, dt, game);
      if (e.timer <= 0) e.setState('chase');
      break;
    }
    case 'return': {
      const d = moveTowards(e, e.home.x, e.home.z, def.run * 0.8, dt, game, 0.5);
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * dt * 0.25);
      if (d < 1) {
        e.hp = e.maxHp;
        e.timer = 1 + Math.random() * 2;
        e.setState('idle');
        if (def.boss) { e.dormant = true; e.yaw = Math.PI; game.onBossReset(e); }
      } else if (canSeePlayer(e, game) && e.stateTime > 2 && Math.hypot(e.position.x - e.home.x, e.position.z - e.home.z) < (def.leash || 32) * 0.6) {
        e.setState('chase');
      }
      break;
    }
  }

  // chefe invoca ajudantes na metade da vida
  if (def.boss && !e.summoned && e.hp < e.maxHp * 0.5 && e.state !== 'dead') {
    e.summoned = true;
    game.onBossSummon(e);
  }
}

function startSpecial(e, game) {
  e.struck = false;
  e.setState('special');
  game.audio.bossRoar();
}

