// Registro de mapas.
import type { MapDefinition } from './MapTypes';
import { DUST_ZONE } from './DustZone';
import { FACTORY } from './Factory';
import { SKYSCRAPER } from './Skyscraper';
import { MODEL_MAPS } from './ModelMaps';

export const MAPS: Record<string, MapDefinition> = {
  [DUST_ZONE.id]: DUST_ZONE,
  [FACTORY.id]: FACTORY,
  [SKYSCRAPER.id]: SKYSCRAPER,
  ...Object.fromEntries(MODEL_MAPS.map(m => [m.id, m]))
};

export const MAP_LIST = [DUST_ZONE, FACTORY, SKYSCRAPER, ...MODEL_MAPS];

/** O mapa aceita este modo? (mapas de modelo 3D são só de mata-mata) */
export function mapAllows(def: MapDefinition, mode: string): boolean {
  return !def.modes || (def.modes as string[]).includes(mode);
}
export const DEFAULT_MAP = DUST_ZONE.id;
