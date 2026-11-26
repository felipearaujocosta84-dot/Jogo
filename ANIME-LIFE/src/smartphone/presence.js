// Online/offline de cada personagem conforme a rotina (hora real do aparelho), estável por hora.
const ROUTINE = {
  character_01: (h) => h >= 12 || h < 4,       // Rin: tarde, noite e madrugada
  character_02: (h) => h >= 10 && h < 23,
  character_06: (h, r) => r < 0.6,             // Akane: imprevisível
  character_07: (h) => h >= 7 && h < 23,
  character_08: (h) => h >= 15 || h < 1,
  character_10: (h) => (h >= 7 && h < 9) || (h >= 20 && h < 24),
};
const rand = (id, h) => { let x = (h + 1) * 2654435761 ^ id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7); x = (x ^ (x >>> 15)) >>> 0; return (x % 1000) / 1000; };

export function isOnline(id, date = new Date()) {
  const h = date.getHours();
  const f = ROUTINE[id];
  return f ? f(h, rand(id, h + date.getDate() * 24)) : true;
}
