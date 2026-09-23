import type { LatLng, PlannedRoute, PointOfInterest } from '../types';

const NEAR_ENDPOINT_KM = 0.12;
/** Точка считается на маршруте, только если линия проходит ближе 80 м */
const ON_ROUTE_KM = 0.08;
/** Минимальное расстояние между соседними цифрами на линии */
const MIN_STOP_SEPARATION_KM = 0.12;

export interface NumberedStop {
  number: number;
  name: string;
  location: LatLng;
  poi: PointOfInterest;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function projectOntoSegment(
  point: LatLng,
  start: LatLng,
  end: LatLng,
): { snapped: LatLng; distKm: number } {
  const abx = end.lng - start.lng;
  const aby = end.lat - start.lat;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq === 0) {
    return { snapped: start, distKm: haversineKm(point, start) };
  }

  let t =
    ((point.lng - start.lng) * abx + (point.lat - start.lat) * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const snapped: LatLng = {
    lat: start.lat + t * aby,
    lng: start.lng + t * abx,
  };

  return { snapped, distKm: haversineKm(point, snapped) };
}

function nearestOnPath(
  point: LatLng,
  path: LatLng[],
): { snapped: LatLng; distKm: number; alongKm: number } {
  if (path.length === 0) {
    return { snapped: point, distKm: Infinity, alongKm: 0 };
  }
  if (path.length === 1) {
    return {
      snapped: path[0],
      distKm: haversineKm(point, path[0]),
      alongKm: 0,
    };
  }

  let bestDist = Infinity;
  let bestSnapped = path[0];
  let bestAlong = 0;
  let walked = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const { snapped, distKm } = projectOntoSegment(point, path[i], path[i + 1]);
    if (distKm < bestDist) {
      bestDist = distKm;
      bestSnapped = snapped;
      bestAlong = walked + haversineKm(path[i], snapped);
    }
    walked += haversineKm(path[i], path[i + 1]);
  }

  return { snapped: bestSnapped, distKm: bestDist, alongKm: bestAlong };
}

function pathLengthKm(path: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += haversineKm(path[i], path[i + 1]);
  }
  return total;
}

type Candidate = {
  poi: PointOfInterest;
  snap: { snapped: LatLng; distKm: number; alongKm: number };
};

/** Убирает точки под A/B и слипшиеся дубликаты, затем нумерует 1…n подряд */
function collapseStops(
  items: Candidate[],
  start: LatLng,
  end: LatLng,
  totalLenKm: number,
): Candidate[] {
  const kept: Candidate[] = [];

  for (const item of items) {
    const { snapped, alongKm } = item.snap;

    if (alongKm < NEAR_ENDPOINT_KM) continue;
    if (totalLenKm - alongKm < NEAR_ENDPOINT_KM) continue;
    if (haversineKm(snapped, start) < NEAR_ENDPOINT_KM) continue;
    if (haversineKm(snapped, end) < NEAR_ENDPOINT_KM) continue;

    const prev = kept[kept.length - 1];
    const tooClose =
      prev &&
      (alongKm - prev.snap.alongKm < MIN_STOP_SEPARATION_KM ||
        haversineKm(snapped, prev.snap.snapped) < MIN_STOP_SEPARATION_KM);

    if (tooClose && prev) {
      if (item.snap.distKm < prev.snap.distKm) {
        kept[kept.length - 1] = item;
      }
      continue;
    }

    kept.push(item);
  }

  return kept;
}

/** Только те POI, через которые линия маршрута реально проходит */
export function getNumberedRouteStops(
  route: PlannedRoute,
  poiList: PointOfInterest[],
): NumberedStop[] {
  if (poiList.length === 0) return [];

  const path =
    route.waypoints.length > 1
      ? route.waypoints
      : [route.start, route.end];

  const totalLenKm = pathLengthKm(path);

  const onRoute = poiList
    .map((poi) => ({ poi, snap: nearestOnPath(poi.location, path) }))
    .filter((item) => item.snap.distKm <= ON_ROUTE_KM)
    .sort((a, b) => a.snap.alongKm - b.snap.alongKm);

  return collapseStops(onRoute, route.start, route.end, totalLenKm).map(
    (item, index) => ({
      number: index + 1,
      name: item.poi.name,
      location: item.snap.snapped,
      poi: item.poi,
    }),
  );
}
