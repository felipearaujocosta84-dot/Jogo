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
export async function assetExists(url, magic = null) {
  const key = `${url}|${magic ?? ''}`;
  if (cache.has(key)) return cache.get(key);
  let ok = false;
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (res.ok) {
      const type = res.headers.get('content-type') || '';
      if (type.includes('text/html')) ok = false;
      else if (magic) {
        const buf = new Uint8Array(await res.arrayBuffer());
        ok = magic.every((b, i) => buf[i] === b);
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
