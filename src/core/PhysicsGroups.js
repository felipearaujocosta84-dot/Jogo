// Grupos de colisão (bitmasks) usados com o Havok.
export const GROUP = {
  DRIVABLE: 1, // asfalto, zebras, áreas de escape, terreno
  BARRIER: 2, // muros, guard-rails, pneus
  CAR: 4, // chassis dos carros
  PROP: 8, // objetos do cenário com colisão
};
// Os raios das rodas só enxergam superfícies dirigíveis.
export const WHEEL_RAY_MASK = GROUP.DRIVABLE;
