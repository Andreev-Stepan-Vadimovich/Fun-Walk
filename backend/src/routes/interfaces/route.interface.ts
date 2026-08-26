export interface LatLng {
  lat: number;
  lng: number;
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
}

export interface RouteSummary {
  id: string;
  name: string;
  distanceKm: number;
  score: number;
  createdAt: string;
}
