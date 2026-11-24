// =============================================================
// EXTREME RACING — AssetManager
// Catálogo de arquivos externos OPCIONAIS (modelos GLB, texturas
// e sons) e verificação de existência. Quando um arquivo não
// existe, o jogo usa a versão procedural correspondente.
// Veja README.md > "Arquivos externos" para nomes e pastas.
// =============================================================

export const OPTIONAL_ASSETS = {
  cars: ['vortex', 'stratos', 'zenith', 'apex', 'titan', 'volt'].map((id) => `assets/cars/${id}.glb`),
  textures: ['assets/textures/asphalt_albedo.jpg', 'assets/textures/asphalt_normal.jpg', 'assets/textures/grass_albedo.jpg', 'assets/textures/rock_albedo.jpg', 'assets/textures/sand_albedo.jpg'],
  sounds: ['assets/sounds/engine_low.ogg', 'assets/sounds/engine_high.ogg', 'assets/sounds/skid.ogg', 'assets/sounds/impact.ogg'],
};

const cache = new Map();

/** Verifica se o arquivo existe (e não é o index.html devolvido pelo servidor). */
// Assinaturas (primeiros bytes) de cada formato. No APK, o servidor interno do
// Capacitor pode devolver o index.html com status 200 para um arquivo que não
// existe — por isso o conteúdo é sempre conferido, nunca só o status.
const MAGIC = {
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  png: [[0x89, 0x50, 0x4e, 0x47]],
  ogg: [[0x4f, 0x67, 0x67, 0x53]],
  mp3: [[0x49, 0x44, 0x33], [0xff, 0xfb], [0xff, 0xf3], [0xff, 0xf2]],
  glb: [[0x67, 0x6c, 0x54, 0x46]],
};

/** Verifica se o arquivo existe de verdade (status, tipo e assinatura). */
export async function assetExists(url, magic = null) {
  const key = `${url}|${magic ?? ''}`;
  if (cache.has(key)) return cache.get(key);
  let ok = false;
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (res.ok) {
      const type = res.headers.get('content-type') || '';
      const ext = url.split('?')[0].split('.').pop().toLowerCase();
      const sigs = magic ? [magic] : MAGIC[ext];
      if (type.includes('text/html')) ok = false;
      else if (sigs) {
        const buf = new Uint8Array(await res.arrayBuffer());
        ok = buf.length > 16 && sigs.some((sig) => sig.every((b, i) => buf[i] === b));
      } else ok = true;
    }
  } catch {
    ok = false;
  }
  cache.set(key, ok);
  return ok;
}

/** Arquivo GLB válido (assinatura "glTF"). */
export function glbExists(url) {
  return assetExists(url, [0x67, 0x6c, 0x54, 0x46]);
}

/** Relatório dos arquivos opcionais encontrados (exibido no console). */
export async function reportOptionalAssets() {
  const report = {};
  for (const [group, list] of Object.entries(OPTIONAL_ASSETS)) {
    report[group] = {};
    for (const url of list) report[group][url] = group === 'cars' ? await glbExists(url) : await assetExists(url);
  }
  console.info('[EXTREME RACING] arquivos opcionais encontrados:', report);
  return report;
}
