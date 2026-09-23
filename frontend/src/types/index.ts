export interface LatLng {
  lat: number;
  lng: number;
}

export type PresetId =
  | 'quick'
  | 'waterfront'
  | 'romantic'
  | 'green'
  | 'bike'
  | 'peaceful'
  | 'custom';

export interface RoutePreferences {
  nature: number;
  bikePaths: number;
  airQuality: number;
  quietAreas: number;
  waterfront: number;
}

export interface RouteMetrics {
  distanceKm: number;
  durationMin: number;
  greenCoveragePercent: number;
  bikePathPercent: number;
  avgAirQualityIndex: number;
  avgNoiseLevel: number;
  score: number;
}

export interface PlannedRoute {
  id: string;
  name: string;
  start: LatLng;
  end: LatLng;
  waypoints: LatLng[];
  preferences: RoutePreferences;
  presetId?: PresetId;
  metrics: RouteMetrics;
  highlights: string[];
  createdAt: string;
  algorithm: 'dijkstra';
  routingSource: 'osrm' | 'direct';
  graphStats: {
    nodes: number;
    edges: number;
    pathWeight: number;
  };
}

export interface RouteSummary {
  id: string;
  name: string;
  distanceKm: number;
  score: number;
  createdAt: string;
}

export interface PointOfInterest {
  id: string;
  name: string;
  type: 'park' | 'green_zone' | 'bike_path' | 'waterfront' | 'square';
  location: LatLng;
  airQualityIndex: number;
  noiseLevel: number;
  areaHa: number;
}

export interface RoutePreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  preferences: RoutePreferences;
}

export const DEFAULT_PREFERENCES: RoutePreferences = {
  nature: 8,
  bikePaths: 4,
  airQuality: 7,
  quietAreas: 7,
  waterfront: 5,
};

export const ROUTE_PRESETS: RoutePreset[] = [
  {
    id: 'peaceful',
    name: 'Спокойная прогулка',
    emoji: '🌸',
    description: 'Тишина, чистый воздух, парки',
    preferences: {
      nature: 9,
      bikePaths: 2,
      airQuality: 9,
      quietAreas: 10,
      waterfront: 4,
    },
  },
  {
    id: 'bike',
    name: 'Велотур',
    emoji: '🚴',
    description: 'Велодорожки и активный маршрут',
    preferences: {
      nature: 5,
      bikePaths: 10,
      airQuality: 7,
      quietAreas: 4,
      waterfront: 3,
    },
  },
  {
    id: 'quick',
    name: 'Быстрый путь',
    emoji: '⚡',
    description: 'Минимум объездов — прямее к цели',
    preferences: {
      nature: 1,
      bikePaths: 2,
      airQuality: 5,
      quietAreas: 3,
      waterfront: 1,
    },
  },
  {
    id: 'waterfront',
    name: 'У воды',
    emoji: '🌊',
    description: 'Набережные Волги и речные виды',
    preferences: {
      nature: 6,
      bikePaths: 4,
      airQuality: 7,
      quietAreas: 7,
      waterfront: 10,
    },
  },
  {
    id: 'green',
    name: 'Зелёный маршрут',
    emoji: '🌿',
    description: 'Максимум парков и скверов',
    preferences: {
      nature: 10,
      bikePaths: 3,
      airQuality: 8,
      quietAreas: 6,
      waterfront: 5,
    },
  },
  {
    id: 'romantic',
    name: 'Романтическая прогулка',
    emoji: '💗',
    description: 'Набережная, тишина, красивые виды',
    preferences: {
      nature: 7,
      bikePaths: 1,
      airQuality: 8,
      quietAreas: 9,
      waterfront: 8,
    },
  },
];

export const POI_TYPE_LABELS: Record<PointOfInterest['type'], string> = {
  park: 'Парк',
  green_zone: 'Сквер / бульвар',
  bike_path: 'Велодорожка',
  waterfront: 'Набережная',
  square: 'Площадь',
};

export const POI_TYPE_COLORS: Record<PointOfInterest['type'], string> = {
  park: '#8fbc8f',
  green_zone: '#a8c686',
  bike_path: '#c9a0b8',
  waterfront: '#9ecad8',
  square: '#e8c4a0',
};

export function preferencesMatchPreset(
  prefs: RoutePreferences,
  preset: RoutePreferences,
): boolean {
  return (
    prefs.nature === preset.nature &&
    prefs.bikePaths === preset.bikePaths &&
    prefs.airQuality === preset.airQuality &&
    prefs.quietAreas === preset.quietAreas &&
    prefs.waterfront === preset.waterfront
  );
}

export function findMatchingPresetId(
  prefs: RoutePreferences,
): string | null {
  const match = ROUTE_PRESETS.find((p) =>
    preferencesMatchPreset(prefs, p.preferences),
  );
  return match?.id ?? null;
}
