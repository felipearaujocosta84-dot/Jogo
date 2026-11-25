// Shader do "LivingSprite": anima a ilustração ORIGINAL deslocando levemente os próprios pixels
// (técnica de deformação, como em Live2D simplificado). Nada é redesenhado ou inventado:
// todo pixel exibido vem da imagem original — exceto o rubor, um brilho rosado translúcido.
// Coordenadas de imagem: (0,0) = canto superior esquerdo, (1,1) = inferior direito.
export const LIVING_FRAG = `
precision mediump float;
uniform sampler2D iChannel0;   // ilustração original
uniform sampler2D iChannel1;   // camada opcional: olhos fechados
uniform sampler2D iChannel2;   // camada opcional: boca aberta
varying vec2 outTexCoord;

uniform float uAlpha;
uniform vec3  uTint;
uniform float uAspect;        // largura / altura da imagem
uniform vec4  uEyeL;          // cx, cy, largura, altura
uniform vec4  uEyeR;
uniform vec3  uMouth;         // cx, cy, largura
uniform vec4  uHead;          // cx, cy, raio (em altura), queda do pescoço
uniform float uBlink;         // 0 aberto .. 1 fechado
uniform float uSquint;        // >0 olhos semicerrados (sorriso/raiva) · <0 arregalados (surpresa)
uniform float uMouthOpen;     // 0..1
uniform vec2  uHeadOffset;    // deslocamento da cabeça (unidades de imagem)
uniform float uBreath;        // subida do tronco
uniform float uWaist;         // linha da cintura (y)
uniform vec4  uHair0; uniform vec4 uHair1; uniform vec4 uHair2;  // x0, y0, x1, y1
uniform vec3  uHairAmp;       // força de cada zona
uniform float uTime;
uniform float uWind;          // intensidade do vento no cabelo
uniform float uBlush;
uniform float uHasEyesLayer;
uniform float uHasMouthLayer;

float ellipseMask(vec2 p, vec2 c, vec2 r) {
  vec2 d = (p - c) / r;
  return 1.0 - smoothstep(0.55, 1.0, length(d));
}
float rectMask(vec2 p, vec4 r, float soft) {
  float mx = smoothstep(r.x, r.x + soft, p.x) * (1.0 - smoothstep(r.z - soft, r.z, p.x));
  float my = smoothstep(r.y, r.y + soft, p.y) * (1.0 - smoothstep(r.w - soft, r.w, p.y));
  return mx * my;
}
// olho: semicerra (sorriso/raiva) ou arregala (surpresa) com uma compressão SUAVE em volta da linha do olho
vec2 eyeWarp(vec2 q, vec4 e, float k) {
  if (e.z <= 0.0) return q;
  vec2 r = vec2(e.z * 0.62, e.w * 1.15);
  float m = ellipseMask(q, e.xy, r);
  // ao comprimir, nunca busca pixels fora do próprio olho (evita puxar fios da franja para dentro)
  float off = (q.y - e.y) * k;
  if (k > 1.0) off = clamp(off, -e.w * 0.62, e.w * 0.62);
  float y = e.y + off;
  return vec2(q.x, mix(q.y, y, m));
}
void main() {
  vec2 p = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
  // 1) respiração: tudo acima da cintura sobe um pouquinho
  float upper = smoothstep(uWaist + 0.08, uWaist - 0.12, p.y);
  vec2 q = p + vec2(0.0, uBreath * upper);
  // 2) cabeça: desloca a região da cabeça com queda suave até o pescoço
  vec2 hd = (q - uHead.xy) * vec2(uAspect, 1.0);
  float wHead = 1.0 - smoothstep(uHead.z, uHead.z + uHead.w, length(hd));
  q -= uHeadOffset * wHead;
  // 3) cabelo: ondulação horizontal que cresce para as pontas das mechas
  float hx = 0.0;
  vec4 H[3]; H[0] = uHair0; H[1] = uHair1; H[2] = uHair2;
  for (int i = 0; i < 3; i++) {
    vec4 z = H[i];
    float amp = i == 0 ? uHairAmp.x : (i == 1 ? uHairAmp.y : uHairAmp.z);
    if (amp <= 0.0) continue;
    float m = rectMask(q, z, 0.03);
    float down = clamp((q.y - z.y) / max(0.01, z.w - z.y), 0.0, 1.0);
    hx += m * amp * (0.35 + down) * (sin(uTime * 1.7 + q.y * 22.0) * 0.6 + sin(uTime * 0.9 + q.y * 9.0) * 0.4) * uWind;
  }
  q.x -= hx;
  // 4) olhos e boca (usam a posição já acompanhando a cabeça)
  vec2 qBase = q;
  // piscar: sem camada de olhos fechados, é uma compressão rápida e suave (até ~40% da altura),
  // que não cria recortes; com a camada desenhada, o piscar é completo (ver mistura abaixo)
  float blinkK = uHasEyesLayer < 0.5 ? uBlink * 1.5 : 0.0;
  float kEye = uSquint >= 0.0 ? 1.0 + uSquint * 1.4 + blinkK : 1.0 / (1.0 - uSquint * 0.22) + blinkK;
  q = eyeWarp(q, uEyeL, kEye); q = eyeWarp(q, uEyeR, kEye);
  if (uHasMouthLayer < 0.5 && uMouth.z > 0.0) {
    vec2 r = vec2(uMouth.z * 0.75, uMouth.z * 0.55 * uAspect);
    float m = ellipseMask(q, uMouth.xy, r);
    q.y = mix(q.y, uMouth.y + (q.y - uMouth.y) / (1.0 + uMouthOpen * 2.2), m);
  }
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) { gl_FragColor = vec4(0.0); return; }
  vec4 col = texture2D(iChannel0, q);
  // camadas desenhadas (quando existirem) — alinhadas à ilustração inteira
  if (uHasEyesLayer > 0.5 && uBlink > 0.01) { vec4 l = texture2D(iChannel1, qBase); col = mix(col, l, l.a * uBlink); }
  if (uHasMouthLayer > 0.5 && uMouthOpen > 0.01) { vec4 l = texture2D(iChannel2, qBase); col = mix(col, l, l.a * uMouthOpen); }
  // 5) rubor nas bochechas (abaixo de cada olho)
  if (uBlush > 0.0) {
    float b = 0.0;
    if (uEyeL.z > 0.0) b += ellipseMask(p, uEyeL.xy + vec2(0.0, uEyeL.w * 1.3 + 0.007), vec2(uEyeL.z * 0.42, 0.0065));
    if (uEyeR.z > 0.0) b += ellipseMask(p, uEyeR.xy + vec2(0.0, uEyeR.w * 1.3 + 0.007), vec2(uEyeR.z * 0.42, 0.0065));
    col.rgb = mix(col.rgb, vec3(1.0, 0.5, 0.58) * col.a, clamp(b, 0.0, 1.0) * uBlush * 0.32);
  }
  col.rgb *= uTint;
  gl_FragColor = col * uAlpha;
}`;

export const LIVING_UNIFORMS = {
  uAlpha: { type: '1f', value: 1 }, uTint: { type: '3f', value: { x: 1, y: 1, z: 1 } }, uAspect: { type: '1f', value: 0.4 },
  uEyeL: { type: '4f', value: { x: 0, y: 0, z: 0, w: 0 } }, uEyeR: { type: '4f', value: { x: 0, y: 0, z: 0, w: 0 } },
  uMouth: { type: '3f', value: { x: 0, y: 0, z: 0 } }, uHead: { type: '4f', value: { x: 0.5, y: 0.12, z: 0.05, w: 0.06 } },
  uBlink: { type: '1f', value: 0 }, uSquint: { type: '1f', value: 0 }, uMouthOpen: { type: '1f', value: 0 },
  uHeadOffset: { type: '2f', value: { x: 0, y: 0 } }, uBreath: { type: '1f', value: 0 }, uWaist: { type: '1f', value: 0.45 },
  uHair0: { type: '4f', value: { x: 0, y: 0, z: 0, w: 0 } }, uHair1: { type: '4f', value: { x: 0, y: 0, z: 0, w: 0 } }, uHair2: { type: '4f', value: { x: 0, y: 0, z: 0, w: 0 } },
  uHairAmp: { type: '3f', value: { x: 0, y: 0, z: 0 } }, uTime: { type: '1f', value: 0 }, uWind: { type: '1f', value: 1 },
  uBlush: { type: '1f', value: 0 }, uHasEyesLayer: { type: '1f', value: 0 }, uHasMouthLayer: { type: '1f', value: 0 },
  iChannel0: { type: 'sampler2D', value: null, textureData: { repeat: false } },
  iChannel1: { type: 'sampler2D', value: null, textureData: { repeat: false } },
  iChannel2: { type: 'sampler2D', value: null, textureData: { repeat: false } },
};
