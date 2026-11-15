// Registro de mapas.
import type { MapDefinition } from './MapTypes';
import { DUST_ZONE } from './DustZone';
import { FACTORY } from './Factory';
import { SKYSCRAPER } from './Skyscraper';

export const MAPS: Record<string, MapDefinition> = {
  [DUST_ZONE.id]: DUST_ZONE,
  [FACTORY.id]: FACTORY,
  [SKYSCRAPER.id]: SKYSCRAPER
};

export const MAP_LIST = [DUST_ZONE, FACTORY, SKYSCRAPER];
export const DEFAULT_MAP = DUST_ZONE.id;
