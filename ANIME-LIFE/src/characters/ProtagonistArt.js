// Desenho procedural do PROTAGONISTA (estilo anime, proporções esguias como as referências).
// É independente do Phaser: o mesmo código desenha a prévia na criação de personagem
// e gera a spritesheet usada no mapa (4 direções × parado/caminhada).
import { colorOf } from './appearanceOptions.js';

export const FRAME_W = 48; // unidades lógicas (pés em y=94)
export const FRAME_H = 96;
export const DIRS = ['down', 'left', 'right', 'up'];
// colunas: 0-1 parado (respiração), 2-5 caminhada
export const FRAMES_PER_DIR = 6;

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

function palette(ap) {
  const out = colorOf('outfitColor', ap.outfitColor);
  return {
    skin: colorOf('skin', ap.skin), skinSh: shade(colorOf('skin', ap.skin), -0.12),
    hair: colorOf('hairColor', ap.hairColor), hairSh: shade(colorOf('hairColor', ap.hairColor), -0.3),
    hairHi: shade(colorOf('hairColor', ap.hairColor), 0.35),
    eye: colorOf('eyeColor', ap.eyeColor),
    out, outSh: shade(out, -0.25), outHi: shade(out, 0.2),
    line: '#2b2233',
    inner: '#f4f1ec', innerSh: '#d9d3cb',
    pants: ap.outfit === 'colete' ? '#5d5866' : '#39456a',
    skirt: shade(out, -0.45),
    shoes: ap.outfit === 'cardigan' ? '#5a3a2a' : '#2c2a33',
    socks: '#2f2f3a',
  };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}
function poly(ctx, pts, fill, stroke) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.6; ctx.stroke(); }
}
function ell(ctx, x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }

/**
 * Desenha um quadro. ctx já deve estar transladado para o canto do quadro e escalado.
 * dir: down|left|right|up   frame: 0..5
 */
export function drawFrame(ctx, ap, dir, frame) {
  if (dir === 'right') { // espelho do "left"
    ctx.save(); ctx.translate(FRAME_W, 0); ctx.scale(-1, 1);
    drawFrame(ctx, ap, 'left', frame); ctx.restore(); return;
  }
  const P = palette(ap);
  const walking = frame >= 2;
  const ph = walking ? frame - 2 : 0; // 0 contato A, 1 passagem, 2 contato B, 3 passagem
  const bob = walking ? (ph % 2 === 1 ? -1 : 0) : (frame === 1 ? -0.5 : 0);
  const wide = ap.body === 'a';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  if (dir === 'left') return drawSide(ctx, ap, P, walking, ph, bob, wide);
  const back = dir === 'up';

  // ---------- pernas ----------
  const legW = wide ? 6 : 5.2;
  const lx = 24 - 1 - legW, rx = 24 + 1;
  let liftL = 0, liftR = 0;
  if (walking) { if (ph === 0) liftL = 3; if (ph === 2) liftR = 3; if (ph === 1) liftL = 1; if (ph === 3) liftR = 1; }
  const skirt = ap.outfit === 'cardigan';
  const legTop = 54 + bob;
  for (const [x, lift] of [[lx, liftL], [rx, liftR]]) {
    const bottom = 89 - lift;
    if (skirt) {
      ctx.fillStyle = P.skin; rr(ctx, x + 0.5, legTop, legW - 1, bottom - legTop, 2);
      ctx.fillStyle = P.socks; rr(ctx, x + 0.4, 77 - lift, legW - 0.8, bottom - 77 + lift + 1, 1.5);
    } else {
      ctx.fillStyle = P.pants; rr(ctx, x, legTop, legW, bottom - legTop, 2);
      ctx.fillStyle = shade(P.pants, -0.25); ctx.fillRect(x + legW - 1.6, legTop + 2, 1.2, bottom - legTop - 3);
    }
    ctx.fillStyle = P.shoes; rr(ctx, x - 0.8, bottom - 1, legW + 1.6, 6, 2.5);
    ctx.fillStyle = '#e8e6e2'; ctx.fillRect(x - 0.6, bottom + 3.6, legW + 1.2, 1.2);
  }

  // ---------- cabelo de trás (frente: atrás do corpo) ----------
  const hy = 15 + bob;
  if (!back) drawBackHair(ctx, ap, P, hy, false);

  // ---------- braços (atrás do tronco nas laterais) ----------
  const sh = wide ? 12.5 : 14;
  let aL = 0, aR = 0;
  if (walking) { if (ph === 0) { aL = -1.5; aR = 1.5; } if (ph === 2) { aL = 1.5; aR = -1.5; } }
  const sleeve = ap.outfit === 'colete' ? P.inner : P.out;
  for (const [x, dy, s] of [[sh - 0.5, aL, -1], [48 - sh - 4.5, aR, 1]]) {
    ctx.fillStyle = sleeve; rr(ctx, x, 25 + bob, 5, 25 + dy, 2.5);
    ctx.fillStyle = shade(sleeve === P.inner ? '#f4f1ec' : P.out, -0.18); ctx.fillRect(x + (s < 0 ? 0.3 : 3.5), 28 + bob, 1.2, 20 + dy);
    ctx.fillStyle = P.skin; rr(ctx, x + 0.6, 48 + bob + dy, 3.8, 5, 2);
  }

  // ---------- tronco ----------
  const t = 25 + bob, hip = 55 + bob;
  const sL = sh + 2, sR = 48 - sh - 2, hL = wide ? 15.5 : 16.5, hR = 48 - hL;
  if (ap.outfit === 'jaqueta') {
    poly(ctx, [sL, t, sR, t, hR + 0.5, hip, hL - 0.5, hip], P.out);
    if (!back) {
      poly(ctx, [21, t, 27, t, 26.5, hip, 21.5, hip], P.inner); // camiseta
      ctx.fillStyle = P.innerSh; ctx.fillRect(21.5, hip - 3, 5, 3);
      poly(ctx, [sL + 1, t, 21, t, 21.5, t + 8], P.outHi); poly(ctx, [sR - 1, t, 27, t, 26.5, t + 8], P.outHi); // gola
      ctx.strokeStyle = P.outSh; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(21, t + 1); ctx.lineTo(21.4, hip); ctx.moveTo(27, t + 1); ctx.lineTo(26.6, hip); ctx.stroke();
    } else {
      ctx.fillStyle = P.outSh; ctx.fillRect(23.4, t + 4, 1.2, hip - t - 6);
    }
    ctx.fillStyle = P.outSh; ctx.fillRect(hL, hip - 2.5, hR - hL, 2.5);
  } else if (ap.outfit === 'cardigan') {
    poly(ctx, [sL, t, sR, t, hR, hip - 3, hL, hip - 3], P.out);
    if (!back) {
      poly(ctx, [21.5, t, 26.5, t, 24, t + 10], P.inner);
      ctx.fillStyle = '#c94a5a'; poly(ctx, [22, t + 1.5, 26, t + 1.5, 24, t + 4], '#c94a5a'); // laço
      for (let i = 0; i < 3; i++) ell(ctx, 24, t + 13 + i * 5, 0.7, 0.7, P.outSh);
    }
    ctx.fillStyle = P.outSh; ctx.fillRect(hL, hip - 5, hR - hL, 2);
    // saia pregueada
    poly(ctx, [hL - 0.5, hip - 3, hR + 0.5, hip - 3, hR + 3, hip + 11, hL - 3, hip + 11], P.skirt);
    ctx.strokeStyle = shade('#000000', 0); ctx.globalAlpha = 0.25; ctx.lineWidth = 0.6;
    for (let i = 1; i < 5; i++) { const x = hL - 2.5 + i * (hR - hL + 5) / 5; ctx.beginPath(); ctx.moveTo(x - 0.8, hip - 2); ctx.lineTo(x, hip + 11); ctx.stroke(); }
    ctx.globalAlpha = 1;
  } else { // colete
    poly(ctx, [sL, t, sR, t, hR, hip, hL, hip], P.inner);
    poly(ctx, [sL + 1.5, t + 1, sR - 1.5, t + 1, hR + 0.3, hip, hL - 0.3, hip], P.out);
    if (!back) {
      poly(ctx, [21.5, t, 26.5, t, 24, t + 12], P.inner);
      poly(ctx, [23.2, t + 2, 24.8, t + 2, 25.2, t + 14, 24, t + 16, 22.8, t + 14], '#2e3a5c'); // gravata
      for (let i = 0; i < 3; i++) ell(ctx, 25.6, t + 18 + i * 4.5, 0.6, 0.6, P.outSh);
    }
    ctx.fillStyle = P.outSh; ctx.fillRect(hL, hip - 2, hR - hL, 2);
  }

  // ---------- pescoço e cabeça ----------
  ctx.fillStyle = P.skinSh; rr(ctx, 22, 20 + bob, 4, 6, 1);
  drawHead(ctx, ap, P, 24, hy, back);
  if (back) drawBackHair(ctx, ap, P, hy, true);
}

function drawHead(ctx, ap, P, cx, cy, back) {
  // rosto com queixo levemente pontudo (anime)
  ctx.fillStyle = P.skin;
  ctx.beginPath();
  ctx.moveTo(cx - 7.2, cy - 2);
  ctx.bezierCurveTo(cx - 7.6, cy - 12, cx + 7.6, cy - 12, cx + 7.2, cy - 2);
  ctx.bezierCurveTo(cx + 7, cy + 4, cx + 3, cy + 8.2, cx, cy + 8.6);
  ctx.bezierCurveTo(cx - 3, cy + 8.2, cx - 7, cy + 4, cx - 7.2, cy - 2);
  ctx.fill();
  if (!back) {
    // olhos
    for (const s of [-1, 1]) {
      const ex = cx + s * 3.6, ey = cy + 1.2;
      ell(ctx, ex, ey + 0.3, 1.9, 2.4, '#ffffff');
      ell(ctx, ex, ey + 0.6, 1.6, 2.2, P.eye);
      ell(ctx, ex, ey + 1.2, 0.9, 1.2, shade(P.eye, -0.5));
      ell(ctx, ex - s * 0.5, ey - 0.3, 0.55, 0.55, '#ffffff');
      ctx.strokeStyle = P.line; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(ex - 2.3, ey - 1.6 + (s > 0 ? 0.2 : 0)); ctx.quadraticCurveTo(ex, ey - 2.6, ex + 2.3, ey - 1.6 + (s < 0 ? 0.2 : 0)); ctx.stroke();
    }
    ctx.globalAlpha = 0.35; ell(ctx, cx - 4.4, cy + 4.6, 1.6, 0.8, '#ff8a9a'); ell(ctx, cx + 4.4, cy + 4.6, 1.6, 0.8, '#ff8a9a'); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#b0605a'; ctx.lineWidth = 0.55;
    ctx.beginPath(); ctx.moveTo(cx - 0.9, cy + 6); ctx.quadraticCurveTo(cx, cy + 6.5, cx + 0.9, cy + 6); ctx.stroke();
  }
  drawFrontHair(ctx, ap, P, cx, cy, back);
}

function drawFrontHair(ctx, ap, P, cx, cy, back) {
  const H = P.hair;
  // calota
  ctx.fillStyle = H;
  ctx.beginPath();
  ctx.moveTo(cx - 8.4, cy + (back ? 6 : 0));
  ctx.bezierCurveTo(cx - 9.6, cy - 14, cx + 9.6, cy - 14, cx + 8.4, cy + (back ? 6 : 0));
  ctx.closePath(); ctx.fill();
  if (back) {
    // nuca coberta de cabelo
    poly(ctx, [cx - 8.4, cy - 2, cx + 8.4, cy - 2, cx + 7.4, cy + 8, cx + 3, cy + 9.5, cx - 3, cy + 9.5, cx - 7.4, cy + 8], H);
    if (ap.hairStyle === 'curto') poly(ctx, [cx - 6, cy + 7, cx - 4, cy + 11, cx - 2, cy + 8, cx, cy + 11.5, cx + 2, cy + 8, cx + 4, cy + 11, cx + 6, cy + 7], H);
    ctx.strokeStyle = P.hairSh; ctx.lineWidth = 0.6;
    for (const x of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(cx + x * 0.6, cy - 8); ctx.quadraticCurveTo(cx + x, cy, cx + x * 1.1, cy + 8); ctx.stroke(); }
  } else {
    // franja em mechas
    const y0 = cy - 6.5;
    const tips = ap.hairStyle === 'curto'
      ? [-8.2, 1, -6, -1.5, -4.4, 3, -2.2, -1, 0, 3.4, 2.2, -1, 4.4, 3, 6, -1.5, 8.2, 1]
      : [-8.2, 3, -6.2, -0.5, -4.6, 3.6, -2.4, 0, -0.6, 3.8, 1.6, 0, 3.6, 3.4, 5.8, -0.4, 8.2, 3];
    const pts = [cx - 8.6, y0 - 1];
    for (let i = 0; i < tips.length; i += 2) pts.push(cx + tips[i], cy + tips[i + 1] - 1.6);
    pts.push(cx + 8.6, y0 - 1);
    poly(ctx, pts, H);
    // mechas laterais
    if (ap.hairStyle !== 'curto') {
      poly(ctx, [cx - 8.6, cy - 4, cx - 6.4, cy - 2, cx - 6.6, cy + 9, cx - 8.4, cy + 11], H);
      poly(ctx, [cx + 8.6, cy - 4, cx + 6.4, cy - 2, cx + 6.6, cy + 9, cx + 8.4, cy + 11], H);
    } else {
      poly(ctx, [cx - 8.6, cy - 4, cx - 6.8, cy - 1, cx - 7.4, cy + 4, cx - 8.8, cy + 2], H);
      poly(ctx, [cx + 8.6, cy - 4, cx + 6.8, cy - 1, cx + 7.4, cy + 4, cx + 8.8, cy + 2], H);
    }
    // brilho (anel de luz típico de anime)
    ctx.strokeStyle = P.hairHi; ctx.lineWidth = 1; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(cx, cy - 2, 7, Math.PI * 1.15, Math.PI * 1.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy - 2, 7, Math.PI * 1.6, Math.PI * 1.85); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // tufo no topo
  poly(ctx, [cx - 1, cy - 10.8, cx + 1.5, cy - 14, cx + 2.2, cy - 10.2], H);
}

function drawBackHair(ctx, ap, P, cy, overBody) {
  const H = P.hair, cx = 24;
  if (ap.hairStyle === 'longo') {
    poly(ctx, [cx - 9, cy - 4, cx + 9, cy - 4, cx + 10.5, cy + 22, cx + 9, cy + 34, cx + 4, cy + 37, cx, cy + 35, cx - 4, cy + 37, cx - 9, cy + 34, cx - 10.5, cy + 22], overBody ? H : P.hairSh);
    if (overBody) { ctx.strokeStyle = P.hairSh; ctx.lineWidth = 0.6; for (const x of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(cx + x * 0.7, cy + 4); ctx.lineTo(cx + x, cy + 34); ctx.stroke(); } }
  } else if (ap.hairStyle === 'medio') {
    poly(ctx, [cx - 9, cy - 4, cx + 9, cy - 4, cx + 10, cy + 10, cx + 7, cy + 13, cx, cy + 12, cx - 7, cy + 13, cx - 10, cy + 10], overBody ? H : P.hairSh);
  } else if (ap.hairStyle === 'rabo') {
    if (overBody) {
      ell(ctx, cx, cy + 2, 2, 1.6, '#c94a5a');
      poly(ctx, [cx - 2.5, cy + 3, cx + 2.5, cy + 3, cx + 4, cy + 16, cx + 1, cy + 24, cx - 2, cy + 22, cx - 3.6, cy + 14], H);
    } else {
      poly(ctx, [cx + 6, cy - 6, cx + 11, cy - 2, cx + 12, cy + 12, cx + 9, cy + 18, cx + 8, cy + 6], P.hairSh);
    }
  }
}

// ------------------- vista lateral (olhando para a esquerda) -------------------
function drawSide(ctx, ap, P, walking, ph, bob, wide) {
  const cx = 24;
  const hy = 15 + bob;
  const legW = wide ? 6 : 5.4;
  const swing = walking ? [5, 0, -5, 0][ph] : 0; // perna da frente: deslocamento x
  const lift = walking ? [0, 2.5, 0, 2.5][ph] : 0;
  const skirt = ap.outfit === 'cardigan';
  // cabelo de trás
  if (ap.hairStyle === 'longo') poly(ctx, [cx - 2, hy - 6, cx + 9, hy - 4, cx + 9.5, hy + 22, cx + 6, hy + 36, cx + 1, hy + 34, cx + 1, hy + 10], P.hairSh);
  if (ap.hairStyle === 'rabo') poly(ctx, [cx + 6, hy - 3, cx + 9, hy - 2, cx + 13, hy + 10, cx + 11, hy + 22, cx + 8, hy + 14], P.hair);
  // pernas (trás depois frente)
  const legs = [[-swing, ph === 3 ? lift : 0, true], [swing, ph === 1 ? lift : 0, false]];
  const legTop = 54 + bob;
  for (const [dx, lf, isBack] of legs) {
    const x = cx - legW / 2 + dx * 0.6;
    const bottom = 89 - lf;
    ctx.save();
    ctx.translate(cx, legTop); ctx.rotate(-dx * 0.022); ctx.translate(-cx, -legTop);
    if (skirt) {
      ctx.fillStyle = isBack ? P.skinSh : P.skin; rr(ctx, x + 0.6, legTop, legW - 1.2, bottom - legTop, 2);
      ctx.fillStyle = isBack ? shade(P.socks, -0.2) : P.socks; rr(ctx, x + 0.5, 77 - lf, legW - 1, bottom - 77 + lf + 1, 1.5);
    } else {
      ctx.fillStyle = isBack ? shade(P.pants, -0.2) : P.pants; rr(ctx, x, legTop, legW, bottom - legTop, 2);
    }
    ctx.fillStyle = isBack ? shade(P.shoes, -0.2) : P.shoes; rr(ctx, x - 2.6, bottom - 1, legW + 3, 6, 2.5);
    ctx.fillStyle = '#e8e6e2'; ctx.fillRect(x - 2.4, bottom + 3.6, legW + 2.6, 1.2);
    ctx.restore();
  }
  // braço de trás
  const arm = walking ? [-4, 0, 4, 0][ph] : 0;
  const sleeve = ap.outfit === 'colete' ? P.inner : P.out;
  drawSideArm(ctx, P, sleeve, cx + 1, 25 + bob, arm, true);
  // tronco
  const t = 25 + bob, hip = 55 + bob, w = wide ? 6.5 : 5.8;
  if (ap.outfit === 'colete') {
    poly(ctx, [cx - w, t, cx + w, t, cx + w - 0.5, hip, cx - w + 0.5, hip], P.inner);
    poly(ctx, [cx - w + 0.6, t + 1, cx + w - 0.4, t + 1, cx + w - 0.6, hip, cx - w + 0.8, hip], P.out);
  } else {
    poly(ctx, [cx - w, t, cx + w, t, cx + w - 0.5, skirt ? hip - 3 : hip, cx - w + 0.5, skirt ? hip - 3 : hip], P.out);
    if (ap.outfit === 'jaqueta') { ctx.fillStyle = P.inner; ctx.fillRect(cx - w, t + 1, 1.6, hip - t - 4); }
  }
  if (skirt) poly(ctx, [cx - w, hip - 3, cx + w, hip - 3, cx + w + 2.5, hip + 11, cx - w - 3, hip + 11], P.skirt);
  ctx.fillStyle = P.outSh; ctx.fillRect(cx - w + 0.5, (skirt ? hip - 5 : hip - 2.5), 2 * w - 1, 2);
  // pescoço + cabeça de perfil
  ctx.fillStyle = P.skinSh; rr(ctx, cx - 1, 20 + bob, 4, 6, 1);
  ctx.fillStyle = P.skin;
  ctx.beginPath();
  ctx.moveTo(cx + 6.5, hy - 2);
  ctx.bezierCurveTo(cx + 7, hy - 12, cx - 7.5, hy - 12, cx - 7, hy - 2);
  ctx.lineTo(cx - 7.8, hy + 1.5); ctx.lineTo(cx - 6.8, hy + 2.2);
  ctx.bezierCurveTo(cx - 6.4, hy + 6, cx - 4, hy + 8.5, cx - 1.5, hy + 8.6);
  ctx.bezierCurveTo(cx + 3, hy + 8.4, cx + 6.5, hy + 4, cx + 6.5, hy - 2);
  ctx.fill();
  // olho de perfil
  const ex = cx - 4.2, ey = hy + 1.4;
  ell(ctx, ex, ey + 0.4, 1.3, 2.3, '#ffffff');
  ell(ctx, ex - 0.2, ey + 0.7, 1.1, 2.1, P.eye);
  ell(ctx, ex - 0.4, ey + 1.2, 0.6, 1.1, shade(P.eye, -0.5));
  ell(ctx, ex - 0.6, ey - 0.2, 0.45, 0.45, '#fff');
  ctx.strokeStyle = P.line; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(ex - 1.6, ey - 1.6); ctx.quadraticCurveTo(ex, ey - 2.4, ex + 1.6, ey - 1.3); ctx.stroke();
  ctx.globalAlpha = 0.35; ell(ctx, cx - 3.6, hy + 4.6, 1.4, 0.8, '#ff8a9a'); ctx.globalAlpha = 1;
  ctx.strokeStyle = '#b0605a'; ctx.lineWidth = 0.55; ctx.beginPath(); ctx.moveTo(cx - 5.8, hy + 6.2); ctx.lineTo(cx - 4.6, hy + 6.3); ctx.stroke();
  // orelha
  ell(ctx, cx + 1.8, hy + 1.5, 1.4, 2, P.skinSh);
  // cabelo lateral
  const H = P.hair;
  ctx.fillStyle = H;
  ctx.beginPath(); ctx.moveTo(cx - 8, hy - 1); ctx.bezierCurveTo(cx - 9, hy - 14, cx + 10, hy - 14, cx + 8.6, hy + 2); ctx.closePath(); ctx.fill();
  poly(ctx, [cx + 0.5, hy - 4, cx + 8.6, hy - 2, cx + 8.2, hy + (ap.hairStyle === 'curto' ? 7 : 11), cx + 3.6, hy + (ap.hairStyle === 'curto' ? 6 : 9), cx + 3.2, hy + 0.6], H);
  poly(ctx, [cx - 8.4, hy - 3, cx - 5, hy - 5, cx - 3, hy + 0.5, cx - 5.5, hy - 1.5, cx - 7.6, hy + 2.4], H); // franja
  ctx.strokeStyle = P.hairHi; ctx.lineWidth = 1; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(cx, hy - 2, 7, Math.PI * 1.2, Math.PI * 1.5); ctx.stroke(); ctx.globalAlpha = 1;
  poly(ctx, [cx - 1, hy - 10.8, cx + 1.5, hy - 14, cx + 2.2, hy - 10.2], H);
  // braço da frente
  drawSideArm(ctx, P, sleeve, cx, 25 + bob, -arm, false);
}

function drawSideArm(ctx, P, sleeve, x, y, swing, isBack) {
  ctx.save();
  ctx.translate(x, y + 2); ctx.rotate(swing * 0.06);
  ctx.fillStyle = isBack ? shade(sleeve === P.inner ? '#f4f1ec' : P.out, -0.2) : sleeve;
  rr(ctx, -2.5, -2, 5, 24, 2.5);
  ctx.fillStyle = isBack ? P.skinSh : P.skin; rr(ctx, -1.9, 21, 3.8, 5, 2);
  ctx.restore();
}

/** Gera a spritesheet completa num canvas (colunas = quadros, linhas = direções). */
export function buildSheetCanvas(ap, res = 2) {
  const c = document.createElement('canvas');
  c.width = FRAME_W * res * FRAMES_PER_DIR; c.height = FRAME_H * res * DIRS.length;
  const ctx = c.getContext('2d');
  DIRS.forEach((d, row) => {
    for (let f = 0; f < FRAMES_PER_DIR; f++) {
      ctx.save();
      ctx.translate(f * FRAME_W * res, row * FRAME_H * res);
      ctx.scale(res, res);
      drawFrame(ctx, ap, d, f);
      ctx.restore();
    }
  });
  return c;
}
