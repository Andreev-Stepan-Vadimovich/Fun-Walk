import { LatLng } from '../../interfaces/route.interface';
import { haversineKm, projectOntoSegment } from './geo.util';

const DEDUPE_EPS = 0.000025;

function nearlySame(a: LatLng, b: LatLng, eps = DEDUPE_EPS): boolean {
  return Math.abs(a.lat - b.lat) <= eps && Math.abs(a.lng - b.lng) <= eps;
}

/** Убирает подряд идущие дубликаты */
export function dedupeRoutePoints(points: LatLng[]): LatLng[] {
  if (points.length === 0) return points;

  const result: LatLng[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    if (!nearlySame(prev, points[i])) {
      result.push(points[i]);
    }
  }
  return result;
}

/**
 * Локальный «отросток»: точка curr сильно отклоняется от хорды prev→next,
 * а обход через curr заметно длиннее прямого участка.
 */
export function removeBacktrackSpurs(points: LatLng[]): LatLng[] {
  if (points.length <= 3) return points;

  const result: LatLng[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const direct = haversineKm(prev, next);
    const viaCurr = haversineKm(prev, curr) + haversineKm(curr, next);
    const { perpendicularKm } = projectOntoSegment(curr, prev, next);

    const isSpur =
      direct > 0.02 &&
      direct < 0.08 &&
      viaCurr > direct * 1.35 &&
      perpendicularKm > 0.02 &&
      perpendicularKm < 0.08 &&
      haversineKm(prev, curr) < 0.08;

    if (!isSpur) {
      result.push(curr);
    }
  }

  result.push(points[points.length - 1]);
  return dedupeRoutePoints(result);
}

/**
 * Удаляет петли: когда маршрут возвращается к уже пройденной точке
 * и образует лишний круг.
 */
export function removeSelfLoops(
  points: LatLng[],
  closeKm = 0.028,
  minGap = 5,
): LatLng[] {
  let result = dedupeRoutePoints(points);
  let changed = true;

  while (changed) {
    changed = false;

    for (let i = result.length - 1; i >= minGap; i--) {
      for (let j = 0; j <= i - minGap; j++) {
        if (haversineKm(result[i], result[j]) > closeKm) continue;

        const loopLen = pathLengthBetween(result, j, i);
        if (loopLen > 0.35) continue;
        const chord = haversineKm(result[j], result[i]);
        if (loopLen < chord * 1.45) continue;

        let maxPerp = 0;
        for (let m = j + 1; m < i; m++) {
          const { perpendicularKm } = projectOntoSegment(
            result[m],
            result[j],
            result[i],
          );
          maxPerp = Math.max(maxPerp, perpendicularKm);
        }

        if (maxPerp > 0.03) {
          result = [...result.slice(0, j + 1), ...result.slice(i + 1)];
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return result;
}

/**
 * Удаляет длинные «лучи» туда-обратно: участок i→k почти замыкается,
 * но между ними большой выступ от основной линии.
 */
export function removeDeadEndSpurs(points: LatLng[]): LatLng[] {
  let result = dedupeRoutePoints(points);
  let changed = true;

  while (changed) {
    changed = false;

    outer: for (let i = 0; i < result.length - 3; i++) {
      for (let k = i + 2; k < Math.min(i + 60, result.length); k++) {
        const direct = haversineKm(result[i], result[k]);
        if (direct > 0.12) continue;

        const subLen = pathLengthBetween(result, i, k);
        if (subLen > 0.28) continue;
        if (subLen <= direct * 1.45 || k - i < 3) continue;

        let maxPerp = 0;
        for (let m = i + 1; m < k; m++) {
          const { perpendicularKm } = projectOntoSegment(
            result[m],
            result[i],
            result[k],
          );
          maxPerp = Math.max(maxPerp, perpendicularKm);
        }

        if (maxPerp > 0.03) {
          result = [...result.slice(0, i + 1), ...result.slice(k)];
          changed = true;
          break outer;
        }
      }
    }
  }

  return result;
}

function pathLengthBetween(points: LatLng[], from: number, to: number): number {
  let total = 0;
  for (let i = from; i < to; i++) {
    total += haversineKm(points[i], points[i + 1]);
  }
  return total;
}

/** Полная очистка геометрии маршрута от артеfactов OSRM */
export function cleanRouteGeometry(points: LatLng[]): LatLng[] {
  if (points.length <= 2) return dedupeRoutePoints(points);

  let cleaned = dedupeRoutePoints(points);

  for (let pass = 0; pass < 4; pass++) {
    const next = removeDeadEndSpurs(
      removeSelfLoops(removeBacktrackSpurs(cleaned)),
    );
    if (next.length === cleaned.length) break;
    cleaned = next;
  }

  return cleaned;
}

/** Удаляет почти коллинеарные точки для сглаживания линии */
export function simplifyRouteGeometry(points: LatLng[]): LatLng[] {
  const cleaned = cleanRouteGeometry(points);
  if (cleaned.length <= 3) return cleaned;

  const result: LatLng[] = [cleaned[0]];

  for (let i = 1; i < cleaned.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = cleaned[i];
    const next = cleaned[i + 1];

    const { perpendicularKm } = projectOntoSegment(curr, prev, next);
    if (perpendicularKm > 0.008) {
      result.push(curr);
    }
  }

  result.push(cleaned[cleaned.length - 1]);
  return dedupeRoutePoints(result);
}
