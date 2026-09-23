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

export interface PointOfInterest {
  id: string;
  name: string;
  type: 'park' | 'green_zone' | 'bike_path' | 'waterfront' | 'square';
  location: LatLng;
  airQualityIndex: number;
  noiseLevel: number;
  areaHa: number;
}

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
