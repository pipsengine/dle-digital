import locationData from './data/nigeria-locations.json';

export const NIGERIA_REGIONS = locationData.regions as readonly string[];

export type NigeriaRegion = (typeof NIGERIA_REGIONS)[number];

type NigeriaStateRecord = {
  name: string;
  region: string;
  lgas: string[];
};

const STATE_RECORDS = locationData.states as NigeriaStateRecord[];

const ALL_STATE_NAMES = STATE_RECORDS.map((state) => state.name);

const REGION_BY_STATE = new Map<string, string>(
  STATE_RECORDS.map((state) => [state.name, state.region]),
);

const LGAS_BY_STATE = new Map<string, string[]>(
  STATE_RECORDS.map((state) => [state.name, state.lgas]),
);

export function getNigeriaStates(region?: string): string[] {
  if (!region) return [...ALL_STATE_NAMES];
  return STATE_RECORDS.filter((state) => state.region === region).map((state) => state.name);
}

export function getNigeriaLgas(stateName: string): string[] {
  if (!stateName) return [];
  return [...(LGAS_BY_STATE.get(stateName) || [])];
}

export function getRegionForState(stateName: string): NigeriaRegion | '' {
  if (!stateName) return '';
  const region = REGION_BY_STATE.get(stateName) || '';
  return NIGERIA_REGIONS.includes(region) ? (region as NigeriaRegion) : '';
}

export function isNigeriaCountry(country: string | null | undefined) {
  const normalized = String(country || '').trim().toLowerCase();
  if (!normalized) return true;
  return normalized.includes('nigeria') || normalized === 'ng';
}
