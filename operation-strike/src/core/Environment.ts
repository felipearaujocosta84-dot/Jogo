// Ambiente de reflexos para materiais PBR, gerado por código (céu claro em cima, chão escuro embaixo,
// horizonte quente). Nenhum arquivo HDR é baixado: funciona offline no APK.
import { RawCubeTexture, type Scene } from './babylon';

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Cria (ou troca) a textura de ambiente da cena. */
export function applyStudioEnvironment(scene: Scene, sky = '#9cc4e8', horizon = '#e8d8b8', ground = '#3a342c', size = 32): RawCubeTexture {
  const top = hexRgb(sky), mid = hexRgb(horizon), bot = hexRgb(ground);
  const faces: Uint8Array[] = [];
  // ordem: +X, -X, +Y, -Y, +Z, -Z
  for (let f = 0; f < 6; f++) {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        // altura (-1 embaixo .. 1 em cima) do texel na esfera
        let h: number;
        if (f === 2) h = 1;
        else if (f === 3) h = -1;
        else h = 1 - (y / (size - 1)) * 2;
        const col = h >= 0 ? mix(mid, top, Math.pow(h, 0.6)) : mix(mid, bot, Math.pow(-h, 0.5));
        // "janela" de luz suave para dar brilho especular nas armas
        const spot = f === 4 && h > 0.2 && Math.abs(x / size - 0.5) < 0.2 ? 40 : 0;
        const i = (y * size + x) * 4;
        data[i] = Math.min(255, col[0] + spot);
        data[i + 1] = Math.min(255, col[1] + spot);
        data[i + 2] = Math.min(255, col[2] + spot);
        data[i + 3] = 255;
      }
    faces.push(data);
  }
  const old = scene.environmentTexture;
  const tex = new RawCubeTexture(scene, faces, size, 5 /* RGBA */, 0 /* UNSIGNED_BYTE */, true);
  scene.environmentTexture = tex;
  if (old && old !== tex) old.dispose();
  return tex;
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
