import {
  PointOfInterest,
  RoutePreferences,
} from '../../interfaces/route.interface';
import { dotProduct, haversineKm, projectOntoSegment } from './geo.util';

/** Признаковый вектор POI f(p) ∈ ℝ⁶ — нормализованные характеристики локации */
export interface PoiFeatureVector {
  parks: number;
  greenZones: number;
  bikePaths: number;
  airQuality: number;
  quietAreas: number;
  waterfront: number;
}

const TYPE_FEATURES: Record<
  PointOfInterest['type'],
  Partial<PoiFeatureVector>
> = {
  park: { parks: 1.0, greenZones: 0.6 },
  green_zone: { greenZones: 1.0, parks: 0.3 },
  bike_path: { bikePaths: 1.0 },
  waterfront: { waterfront: 1.0, greenZones: 0.4 },
  square: {},
};

/**
 * Строит признаковый вектор POI.
 * Качество воздуха и тишина — непрерывные признаки:
 *   airQuality feature = (100 − AQI) / 100
 *   quietAreas feature = (100 − noise) / 100
 */
export function buildFeatureVector(poi: PointOfInterest): PoiFeatureVector {
  const typeFeat = TYPE_FEATURES[poi.type];
  return {
    parks: typeFeat.parks ?? 0,
    greenZones: typeFeat.greenZones ?? 0,
    bikePaths: typeFeat.bikePaths ?? 0,
    airQuality: (100 - poi.airQualityIndex) / 100,
    quietAreas: (100 - poi.noiseLevel) / 100,
    waterfront: typeFeat.waterfront ?? 0,
  };
}

/** Вектор предпочтений пользователя w ∈ ℝ⁶ */
export function buildPreferenceVector(
  preferences: RoutePreferences,
): number[] {
  return [
    preferences.parks,
    preferences.greenZones,
    preferences.bikePaths,
    preferences.airQuality,
    preferences.quietAreas,
    preferences.waterfront,
  ];
}

export function featureVectorToArray(f: PoiFeatureVector): number[] {
  return [
    f.parks,
    f.greenZones,
    f.bikePaths,
    f.airQuality,
    f.quietAreas,
    f.waterfront,
  ];
}

export interface ScoredPoi {
  poi: PointOfInterest;
  /** Скalarное произведение S = w · f(p) */
  dotScore: number;
  /** Штраф за удаление от коридора старт→финиш (км) */
  corridorPenaltyKm: number;
  /** Итоговая оценка: S − α · d⊥ */
  totalScore: number;
  /** Нормализованная привлекательность ∈ [0, 1] */
  attractiveness: number;
}

/**
 * Оценка POI по линейной модели:
 *
 *   score(p) = w · f(p) − α · d⊥(p, S→E)
 *
 * где w — вектор предпочтений, f(p) — признаки локации,
 * d⊥ — перпендикулярное расстояние до отрезка старт–финиш.
 */
export function scorePois(
  pois: PointOfInterest[],
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  preferences: RoutePreferences,
  corridorAlpha = 0.15,
): ScoredPoi[] {
  const w = buildPreferenceVector(preferences);
  const wNorm = Math.sqrt(w.reduce((s, v) => s + v * v, 0)) || 1;

  const scored = pois.map((poi) => {
    const f = featureVectorToArray(buildFeatureVector(poi));
    const dotScore = dotProduct(w, f) / wNorm;
    const { perpendicularKm } = projectOntoSegment(poi.location, start, end);
    const totalScore = dotScore - corridorAlpha * perpendicularKm;

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

/** Выбирает POI с положительной оценкой, не более maxCount */
export function selectCandidatePois(
  scored: ScoredPoi[],
  maxCount = 8,
  minScore = 0.05,
): ScoredPoi[] {
  return scored
    .filter((s) => s.totalScore >= minScore)
    .slice(0, maxCount);
}

/** Суммарная длина пути по последовательности точек (формула Haversine) */
export function pathLengthKm(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineKm(points[i], points[i + 1]);
  }
  return total;
}
