import { RoutePreferences } from '../../interfaces/route.interface';

export interface EdgeFeatureVector {
  nature: number;
  bikePaths: number;
  airQuality: number;
  quietAreas: number;
  waterfront: number;
}

const QUIET_HIGHWAYS = new Set([
  'footway',
  'path',
  'pedestrian',
  'steps',
  'track',
  'living_street',
  'service',
]);

const NOISY_HIGHWAYS = new Set([
  'primary',
  'primary_link',
  'secondary',
  'secondary_link',
  'trunk',
  'trunk_link',
  'motorway',
  'motorway_link',
]);

export function buildEdgeFeatures(
  tags: Record<string, string>,
  aqi: number,
): EdgeFeatureVector {
  const highway = tags.highway ?? '';
  const cycleway = tags.cycleway ?? tags['cycleway:both'] ?? '';
  const isGreen =
    tags.leisure === 'park' ||
    tags.landuse === 'forest' ||
    tags.landuse === 'grass' ||
    tags.natural === 'wood' ||
    tags.natural === 'tree_row';

  const isWater =
    Boolean(tags.natural === 'water') ||
    Boolean(tags.waterway) ||
    Boolean(tags['natural:water']);

  const isBike =
    highway === 'cycleway' ||
    cycleway === 'lane' ||
    cycleway === 'track' ||
    cycleway === 'shared_lane' ||
    tags.bicycle === 'designated';

  let quiet = 0.45;
  if (QUIET_HIGHWAYS.has(highway)) quiet = 0.9;
  if (NOISY_HIGHWAYS.has(highway)) quiet = 0.15;
  if (tags.lit === 'no') quiet += 0.05;

  let nature = isGreen ? 0.85 : 0.2;
  if (highway === 'path' || highway === 'footway') nature += 0.15;

  return {
    nature: Math.min(1, nature),
    bikePaths: isBike ? 1 : highway === 'cycleway' ? 0.9 : 0.05,
    airQuality: (100 - aqi) / 100,
    quietAreas: Math.min(1, quiet),
    waterfront: isWater ? 1 : tags.natural === 'water' ? 0.8 : 0,
  };
}

export function preferenceEta(preferences: RoutePreferences): number {
  const avg =
    (preferences.nature +
      preferences.bikePaths +
      preferences.airQuality +
      preferences.quietAreas +
      preferences.waterfront) /
    5;
  return 0.35 + (avg / 10) * 3.15;
}

export function edgeUtility(
  features: EdgeFeatureVector,
  preferences: RoutePreferences,
): number {
  const vector = [
    features.nature,
    features.bikePaths,
    features.airQuality,
    features.quietAreas,
    features.waterfront,
  ];
  const weights = [
    preferences.nature,
    preferences.bikePaths,
    preferences.airQuality,
    preferences.quietAreas,
    preferences.waterfront,
  ];

  const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1;
  const score =
    vector.reduce((sum, value, index) => sum + value * weights[index], 0) /
    weightSum;

  return Math.max(0, Math.min(1, score));
}

export function edgeWeightKm(
  lengthKm: number,
  utility: number,
  preferences: RoutePreferences,
): number {
  const eta = preferenceEta(preferences);
  return lengthKm / (1 + eta * utility);
}
