import { LatLng } from '../../interfaces/route.interface';

const EARTH_RADIUS_KM = 6371;

/** Перевод градусов в радианы */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Формула Haversine — расстояние между двумя точками на сфере:
 *
 *   a = sin²(Δφ/2) + cos(φ₁)·cos(φ₂)·sin²(Δλ/2)
 *   d = 2R · arctan2(√a, √(1−a))
 *
 * где φ — широта, λ — долгота, R — радиус Земли.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Ортогональная проекция точки P на отрезок AB.
 * Возвращает параметр t ∈ [0, 1] и перпендикулярное расстояние (км).
 *
 * Используется для оценки «насколько POI лежит на пути» между стартом и финишем.
 */
export function projectOntoSegment(
  point: LatLng,
  start: LatLng,
  end: LatLng,
): { t: number; perpendicularKm: number } {
  const ax = start.lng;
  const ay = start.lat;
  const bx = end.lng;
  const by = end.lat;
  const px = point.lng;
  const py = point.lat;

  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq === 0) {
    return { t: 0, perpendicularKm: haversineKm(point, start) };
  }

  let t = ((px - ax) * abx + (py - ay) * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const proj: LatLng = {
    lat: ay + t * aby,
    lng: ax + t * abx,
  };

  return { t, perpendicularKm: haversineKm(point, proj) };
}

/** Скалярное произведение двух векторов (для отчёта по курсовой) */
export function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

/** L2-норма вектора */
export function vectorNorm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
}

/** Скользящее среднее для сглаживания polyline (3 точки) */
export function smoothPath(points: LatLng[]): LatLng[] {
  if (points.length <= 2) return points;

  const result: LatLng[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    result.push({
      lat: (prev.lat + curr.lat + next.lat) / 3,
      lng: (prev.lng + curr.lng + next.lng) / 3,
    });
  }
  result.push(points[points.length - 1]);
  return result;
}
