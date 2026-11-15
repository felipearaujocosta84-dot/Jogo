// Registro de mapas. Factory e Skyscraper serão adicionados aqui nas próximas etapas.
import type { MapDefinition } from './MapTypes';
import { DUST_ZONE } from './DustZone';

export const MAPS: Record<string, MapDefinition> = {
  [DUST_ZONE.id]: DUST_ZONE
};

export const DEFAULT_MAP = DUST_ZONE.id;
