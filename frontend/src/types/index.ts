export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoutePreferences {
  greenZones: number;
  bikePaths: number;
  airQuality: number;
  quietAreas: number;
  waterfront: number;
  parks: number;
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
  metrics: RouteMetrics;
  highlights: string[];
  createdAt: string;
  algorithm: 'dijkstra';
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

export const DEFAULT_PREFERENCES: RoutePreferences = {
  greenZones: 7,
  bikePaths: 5,
  airQuality: 8,
  quietAreas: 6,
  waterfront: 4,
  parks: 9,
};

export const POI_TYPE_LABELS: Record<PointOfInterest['type'], string> = {
  park: 'Парк',
  green_zone: 'Зелёная зона',
  bike_path: 'Велодорожка',
  waterfront: 'Набережная',
  square: 'Площадь',
};

export const POI_TYPE_COLORS: Record<PointOfInterest['type'], string> = {
  park: '#22c55e',
  green_zone: '#84cc16',
  bike_path: '#3b82f6',
  waterfront: '#06b6d4',
  square: '#f59e0b',
};
