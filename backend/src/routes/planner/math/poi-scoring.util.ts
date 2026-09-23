import {
  LatLng,
  PointOfInterest,
  RoutePreferences,
} from '../../interfaces/route.interface';
import { dotProduct, haversineKm, projectOntoSegment } from './geo.util';

export interface PoiFeatureVector {
  nature: number;
  bikePaths: number;
  airQuality: number;
  quietAreas: number;
  waterfront: number;
}

const TYPE_FEATURES: Record<
  PointOfInterest['type'],
  Partial<PoiFeatureVector>
> = {
  park: { nature: 1.0 },
  green_zone: { nature: 0.85 },
  bike_path: { bikePaths: 1.0, nature: 0.2 },
  waterfront: { waterfront: 1.0, nature: 0.45 },
  square: { nature: 0.15 },
};

export function buildFeatureVector(
  poi: PointOfInterest,
  liveAqi?: number,
): PoiFeatureVector {
  const typeFeat = TYPE_FEATURES[poi.type];
  const aqi = liveAqi ?? poi.airQualityIndex;
  return {
    nature: typeFeat.nature ?? 0,
    bikePaths: typeFeat.bikePaths ?? 0,
    airQuality: (100 - aqi) / 100,
    quietAreas: (100 - poi.noiseLevel) / 100,
    waterfront: typeFeat.waterfront ?? 0,
  };
}

export function buildPreferenceVector(preferences: RoutePreferences): number[] {
  return [
    preferences.nature,
    preferences.bikePaths,
    preferences.airQuality,
    preferences.quietAreas,
    preferences.waterfront,
  ];
}

export function featureVectorToArray(f: PoiFeatureVector): number[] {
  return [f.nature, f.bikePaths, f.airQuality, f.quietAreas, f.waterfront];
}

export function scoreFeatureVector(
  features: number[],
  preferences: RoutePreferences,
): number {
  const w = buildPreferenceVector(preferences);
  const wNorm = Math.sqrt(w.reduce((s, v) => s + v * v, 0)) || 1;
  return dotProduct(w, features) / wNorm;
}

export interface ScoredPoi {
  poi: PointOfInterest;
  dotScore: number;
  corridorPenaltyKm: number;
  totalScore: number;
  attractiveness: number;
}

export function scorePois(
  pois: PointOfInterest[],
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  preferences: RoutePreferences,
  aqiByPoiId?: Map<string, number>,
  corridorAlpha = 0.15,
): ScoredPoi[] {
  const w = buildPreferenceVector(preferences);
  const wNorm = Math.sqrt(w.reduce((s, v) => s + v * v, 0)) || 1;

  const scored = pois.map((poi) => {
    const f = featureVectorToArray(
      buildFeatureVector(poi, aqiByPoiId?.get(poi.id)),
    );
    const dotScore = dotProduct(w, f) / wNorm;
    const { perpendicularKm } = projectOntoSegment(poi.location, start, end);
    const typeBonus =
      preferences.waterfront >= 8 && poi.type === 'waterfront'
        ? 1.2
        : preferences.nature >= 8 &&
            (poi.type === 'park' || poi.type === 'green_zone')
          ? 0.9
          : 0;
    const typePenalty = poi.type === 'square' ? 0.6 : 0;
    const totalScore =
      dotScore + typeBonus - typePenalty - corridorAlpha * perpendicularKm;

    return {
      poi,
      dotScore,
      corridorPenaltyKm: perpendicularKm,
      totalScore,
      attractiveness: Math.max(0, Math.min(1, dotScore / 10)),
    };
  });

  return scored.sort((a, b) => b.totalScore - a.totalScore);
}

export function selectCandidatePois(
  scored: ScoredPoi[],
  maxCount = 8,
  minScore = 0.05,
): ScoredPoi[] {
  return scored.filter((s) => s.totalScore >= minScore).slice(0, maxCount);
}

export function pathLengthKm(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineKm(points[i], points[i + 1]);
  }
  return total;
}

export function nearestPoiNames(
  point: LatLng,
  pois: PointOfInterest[],
  radiusKm = 0.25,
  limit = 3,
): string[] {
  return pois
    .map((poi) => ({
      poi,
      dist: haversineKm(point, poi.location),
    }))
    .filter((item) => item.dist <= radiusKm)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit)
    .map((item) => item.poi.name);
}

/** POI, через которые реально проходит линия маршрута (не «рядом») */
export function poisOnPath(
  waypoints: LatLng[],
  pois: PointOfInterest[],
  radiusKm = 0.08,
): PointOfInterest[] {
  return pois.filter((poi) => distanceToPathKm(poi.location, waypoints) <= radiusKm);
}

function distanceToPathKm(point: LatLng, path: LatLng[]): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return haversineKm(point, path[0]);

  let minDist = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const { perpendicularKm } = projectOntoSegment(point, path[i], path[i + 1]);
    if (perpendicularKm < minDist) minDist = perpendicularKm;
  }
  return minDist;
}
