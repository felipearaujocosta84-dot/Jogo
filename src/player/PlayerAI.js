// Inteligência artificial dos jogadores.
// ETAPA 2: posicionamento e movimentação (formação que acompanha a bola, perseguição da bola,
// condução em direção ao gol, goleiro na linha). A ETAPA 4 acrescenta decisões de passe, chute,
// marcação e desarme sobre esta mesma estrutura.
import { Vector3 } from '../babylon.js';
import { FIELD } from '../config.js';

const tmpDir = new Vector3();

export class PlayerAI {
  /** @param {import('./Player.js').Player} player */
  constructor(player) {
    this.player = player;
    this.mode = 'position'; // position | chase | keeper
    this.target = new Vector3();
    this.decisionTimer = Math.random() * 0.2;
    this.reaction = 0.16 + Math.random() * 0.12; // tempo de reação (natural, não robótico)
    this.aimZ = (Math.random() - 0.5) * FIELD.goalWidth * 0.6;
    this.slot = player.index === 1 ? 'att' : 'def';
  }

  reset() {
    this.mode = 'position';
    this.decisionTimer = this.reaction;
  }

  /**
   * @param {number} dt
   * @param {{ ball: any, human: any }} ctx
   */
  update(dt, ctx) {
    this.ctx = ctx;
    this.decisionTimer -= dt;
    if (this.decisionTimer <= 0) {
      this.decide(ctx);
      this.decisionTimer = this.reaction + Math.random() * 0.08;
    }
    switch (this.mode) {
      case 'keeper': this.keeperMove(ctx); break;
      case 'chase': this.chaseMove(ctx); break;
      default: this.positionMove(ctx);
    }
  }

  /** Tempo aproximado para alcançar a bola (considera velocidade da bola). */
  static timeToBall(player, ball) {
    const fut = ball.position.add(ball.velocity.scale(0.35));
    return player.distanceTo(fut) / 6 + (player.busy ? 0.5 : 0);
  }

  decide(ctx) {
    const p = this.player, team = p.team, ball = ctx.ball;
    if (p.isKeeper) {
      this.mode = 'keeper';
      return;
    }
    // quem do time vai na bola? o mais rápido a chegar (o humano conta, mas a IA não o substitui)
    let best = null, bestT = Infinity;
    for (const mate of team.fieldPlayers) {
      const t = PlayerAI.timeToBall(mate, ball) - (mate.isHuman ? 0.25 : 0);
      if (t < bestT) { bestT = t; best = mate; }
    }
    this.mode = best === p ? 'chase' : 'position';
  }

  // ------------------------------------------------------------------ goleiro
  keeperMove(ctx) {
    const p = this.player, team = p.team, ball = ctx.ball;
    const d = team.attackDir;
    const own = team.ownGoalX;
    const b = ball.position;
    const distToGoal = Math.abs(b.x - own);
    // sai um pouco do gol quando a bola se aproxima
    const advance = distToGoal < 10 ? 0.6 + (10 - distToGoal) * 0.12 : 0.6;
    const halfMouth = FIELD.goalWidth / 2 - 0.25;
    let tz = b.z * (distToGoal < 8 ? 0.7 : 0.45);
    tz = Math.max(-halfMouth, Math.min(halfMouth, tz));
    this.target.set(own + d * Math.min(advance, 2.2), 0, tz);

    // bola lenta e perto, dentro da área: vai buscar e afasta
    const inArea = distToGoal < FIELD.goalAreaRadius && Math.abs(b.z) < FIELD.goalAreaRadius;
    if (inArea && ball.speed < 5 && p.distanceTo(b) < 3.5 && b.y < 1) {
      this.target.set(b.x - d * 0.3, 0, b.z);
    }
    this.moveTo(this.target, 0.15, false, b);
  }

  // ------------------------------------------------------------------ perseguir e conduzir
  chaseMove(ctx) {
    const p = this.player, team = p.team, ball = ctx.ball;
    const b = ball.position;
    // bola travada junto à parede/canto (quase não sai do lugar): puxa com a sola para o meio da quadra
    const nearWall = Math.abs(b.z) > FIELD.width / 2 - 1.0 || Math.abs(b.x) > FIELD.length / 2 - 1.0;
    if (nearWall && p.distanceTo(b) < 1.3 && b.y < 0.6) {
      if (!this.stuckAnchor) this.stuckAnchor = b.clone();
      this.stuckTimer = (this.stuckTimer || 0) + ctx.dt;
      if (this.stuckTimer > 0.7) {
        if (Vector3.Distance(this.stuckAnchor, b) < 0.8) {
          const cx = team.targetGoalX * 0.4 - b.x, cz = -b.z * 0.8;
          const l = Math.hypot(cx, cz) || 1;
          ball.velocity.set((cx / l) * 4.5, 1.5, (cz / l) * 4.5);
          ball.lastTouch = p;
          ball.freeTimer = 0.3;
          p.yaw = Math.atan2(cx, cz);
        }
        this.stuckTimer = 0;
        this.stuckAnchor = null;
      }
    } else {
      this.stuckTimer = 0;
      this.stuckAnchor = null;
    }
    const goal = new Vector3(team.targetGoalX, 0, this.aimZ);
    tmpDir.set(goal.x - b.x, 0, goal.z - b.z).normalize();
    const toBallX = b.x - p.position.x, toBallZ = b.z - p.position.z;
    const dist = Math.hypot(toBallX, toBallZ);
    const alignment = dist > 1e-3 ? (toBallX * tmpDir.x + toBallZ * tmpDir.z) / dist : 1;

    // previsão simples da bola
    const lead = Math.min(0.6, dist / 10);
    const fx = b.x + ball.velocity.x * lead, fz = b.z + ball.velocity.z * lead;

    if (dist < 1.4 && alignment > 0.55) {
      // atrás da bola e alinhado: conduz em direção ao gol
      const nearOpp = this.nearestOpponentDist();
      this.moveDir(tmpDir.x * 0.75 + toBallX / dist * 0.25, tmpDir.z * 0.75 + toBallZ / dist * 0.25, 1, nearOpp > 3 && p.stamina > 0.25);
    } else if (dist > 3) {
      // longe: corre direto para onde a bola vai estar
      this.moveTo(new Vector3(fx, 0, fz), 0.1, dist > 5 && p.stamina > 0.3, b);
    } else {
      // perto, mas do lado errado: contorna para ficar atrás da bola
      const behind = new Vector3(fx - tmpDir.x * 0.7, 0, fz - tmpDir.z * 0.7);
      // evita atravessar a bola: desvia lateralmente
      const side = (p.position.x - b.x) * tmpDir.z - (p.position.z - b.z) * tmpDir.x > 0 ? 1 : -1;
      if (alignment < 0) {
        behind.x += -tmpDir.z * side * 0.8;
        behind.z += tmpDir.x * side * 0.8;
      }
      this.moveTo(behind, 0.05, false, b);
    }
  }

  nearestOpponentDist() {
    let m = Infinity;
    for (const o of this.player.team.opponent.players) m = Math.min(m, this.player.distanceTo(o.position));
    return m;
  }

  // ------------------------------------------------------------------ posicionamento sem a bola
  positionMove(ctx) {
    const p = this.player, team = p.team, ball = ctx.ball;
    const d = team.attackDir;
    const own = team.ownGoalX;
    const b = ball.position;
    const hl = FIELD.length / 2, hw = FIELD.width / 2;
    // progresso da bola no campo do ponto de vista deste time (0 = nosso gol, 1 = gol deles)
    const prog = Math.max(0, Math.min(1, ((b.x - own) * d) / FIELD.length));
    // estamos com a bola? (algum companheiro mais perto dela do que qualquer adversário)
    const ourDist = Math.min(...team.players.map((m) => m.distanceTo(b)));
    const theirDist = Math.min(...team.opponent.players.map((m) => m.distanceTo(b)));
    const attacking = ourDist < theirDist - 0.5;

    let tx, tz;
    const ballSide = Math.sign(b.z) || 1;
    if (this.slot === 'att' || (attacking && this.slot === 'def' && prog > 0.55)) {
      // atacante: oferece linha de passe à frente, do lado oposto da bola
      tx = own + d * Math.min(FIELD.length - 4, 9 + prog * 16 + (attacking ? 3 : -2));
      tz = -ballSide * (2.5 + (1 - Math.abs(b.z) / hw) * 2) + b.z * 0.25;
    } else {
      // defensor: fica entre a bola e o próprio gol
      const k = attacking ? 0.4 : 0.55;
      tx = b.x + (own - b.x) * k;
      tx = own + d * Math.max(3.5, Math.min(FIELD.length * 0.62, (tx - own) * d));
      tz = b.z * 0.55 - ballSide * 0.8;
    }
    // não ficar grudado nos companheiros
    for (const m of team.players) {
      if (m === p) continue;
      const dx = tx - m.position.x, dz = tz - m.position.z;
      const dd = Math.hypot(dx, dz);
      if (dd < 3.2) {
        const push = (3.2 - dd) * 0.8;
        tz += (dz >= 0 ? 1 : -1) * push;
      }
    }
    tx = Math.max(-hl + 1, Math.min(hl - 1, tx));
    tz = Math.max(-hw + 1, Math.min(hw - 1, tz));
    this.target.set(tx, 0, tz);
    const far = p.distanceTo(this.target);
    this.moveTo(this.target, 0.6, far > 9 && p.stamina > 0.5, b);
  }

  // ------------------------------------------------------------------ utilitários de movimento
  moveTo(target, stopRadius, sprint, faceTarget) {
    const p = this.player;
    // regra da saída de bola: time que não dá a saída fica fora do círculo central
    const ko = this.ctx && this.ctx.kickoffTeam;
    if (ko && ko !== p.team.id) {
      const r = Math.hypot(target.x, target.z);
      const minR = FIELD.centerCircle + 0.4;
      if (r < minR) {
        const k = minR / Math.max(r, 0.01);
        target = new Vector3(r > 0.01 ? target.x * k : -p.team.attackDir * minR, 0, target.z * k);
      }
      // e no próprio campo
      if ((target.x * p.team.attackDir) > -0.3) target = new Vector3(-p.team.attackDir * minR, 0, target.z);
    }
    const dx = target.x - p.position.x, dz = target.z - p.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < stopRadius) {
      p.setInput(tmpDir.setAll(0), 0, false, faceTarget);
      return;
    }
    // chegada suave: anda quando está perto do alvo
    const mag = dist > 2.5 ? 1 : 0.3 + (dist / 2.5) * 0.7;
    p.setInput(new Vector3(dx, 0, dz), mag, sprint, faceTarget);
  }

  moveDir(x, z, mag, sprint) {
    if (this.ctx && this.ctx.kickoffTeam && this.ctx.kickoffTeam !== this.player.team.id) return this.moveTo(this.player.position, 1, false, null);
    this.player.setInput(new Vector3(x, 0, z), mag, sprint, null);
  }
}
