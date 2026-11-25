// Caminhos dos arquivos públicos (funciona com base relativa no navegador e no APK).
const BASE = import.meta.env.BASE_URL || './';
export const asset = (p) => `${BASE}assets/${p}`;
export const characterAsset = (id, file) => asset(`characters/${id}/${file}`);
