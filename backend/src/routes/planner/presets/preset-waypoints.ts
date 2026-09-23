import {
  LatLng,
  PointOfInterest,
  RoutePreferences,
} from '../../interfaces/route.interface';
import { POINTS_OF_INTEREST } from '../../data/points-of-interest';
import { projectOntoSegment, haversineKm } from '../math/geo.util';

export type DominantPreference = keyof RoutePreferences;

const MIN_POI_SEPARATION_KM = 0.12;
const MAX_MIDDLE_WAYPOINTS = 6;
const MAX_OPTIONAL_DETOUR_KM = 0.7;
const MAX_OPTIONAL_PERPENDICULAR_KM = 0.42;
const ENDPOINT_SKIP_KM = 0.1;

export function getDominantPreference(
  preferences: RoutePreferences,
): DominantPreference {
  if (
    preferences.waterfront >= 8 &&
    preferences.waterfront >= preferences.nature - 1
  ) {
    return 'waterfront';
  }

  const entries = Object.entries(preferences) as [DominantPreference, number][];
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

export function poiMatchesScenario(
  poi: PointOfInterest,
  dominant: DominantPreference,
): boolean {
  switch (dominant) {
    case 'waterfront':
      return poi.type === 'waterfront';
    case 'nature':
      return poi.type === 'park' || poi.type === 'green_zone';
    case 'bikePaths':
      return poi.type === 'bike_path';
    case 'quietAreas':
      return poi.noiseLevel <= 35 && poi.type !== 'square';
    case 'airQuality':
      return poi.airQualityIndex <= 42 && poi.type !== 'square';
    default:
      return false;
  }
}

/** Ключевые POI для каждого сценария — реальный путь, а не подписи в карточке */
export function getMandatoryPoiIds(
  preferences: RoutePreferences,
): string[] {
  const dominant = getDominantPreference(preferences);

  switch (dominant) {
    case 'waterfront':
      return [
        'volzhskaya-emb',
        'volga-embankment',
        'kotorosl-emb-east',
        'kotorosl-emb-mid',
      ];
    case 'nature':
      return [
        'gubernatorsky-garden',
        'nakhimsona-boulevard',
        'pervomaysky-blvd',
        'frunze-park',
      ];
    case 'quietAreas':
      return [
        'gubernatorsky-garden',
        'nakhimsona-boulevard',
        'frunze-park',
      ];
    case 'bikePaths':
      return ['bike-volga', 'kotorosl-emb-mid', 'bike-damansky'];
    case 'airQuality':
      return ['gubernatorsky-garden', 'recreation-park', 'damansky-park'];
    default:
      return [];
  }
}

export function getMandatoryPois(
  preferences: RoutePreferences,
  catalog: PointOfInterest[] = POINTS_OF_INTEREST,
  start?: LatLng,
  end?: LatLng,
): PointOfInterest[] {
  const ids = getMandatoryPoiIds(preferences);
  const curated = ids
    .map((id) => catalog.find((poi) => poi.id === id))
    .filter((poi): poi is PointOfInterest => Boolean(poi))
    .filter((poi) => (start && end ? isNearCorridor(poi, start, end, 1.0) : true));

  if (curated.length >= 2 || !start || !end) {
    return curated;
  }

  const dominant = getDominantPreference(preferences);
  const local = catalog
    .filter((poi) => poiMatchesScenario(poi, dominant))
    .filter((poi) => isNearCorridor(poi, start, end, 0.85))
    .filter((poi) => notNearEndpoint(poi, start, end))
    .sort((a, b) => {
      const da = projectOntoSegment(a.location, start, end).perpendicularKm;
      const db = projectOntoSegment(b.location, start, end).perpendicularKm;
      return da - db;
    });

  const byId = new Map<string, PointOfInterest>();
  for (const poi of [...curated, ...local]) {
    byId.set(poi.id, poi);
    if (byId.size >= 4) break;
  }
  return Array.from(byId.values());
}

function isNearCorridor(
  poi: PointOfInterest,
  start: LatLng,
  end: LatLng,
  maxPerpKm: number,
): boolean {
  const { t, perpendicularKm } = projectOntoSegment(poi.location, start, end);
  return t >= -0.12 && t <= 1.12 && perpendicularKm <= maxPerpKm;
}

export function orderPoisAlongCorridor(
  start: LatLng,
  end: LatLng,
  pois: PointOfInterest[],
): PointOfInterest[] {
  return [...pois].sort((a, b) => {
    const ta = projectOntoSegment(a.location, start, end).t;
    const tb = projectOntoSegment(b.location, start, end).t;
    return ta - tb;
  });
}

function notNearEndpoint(
  poi: PointOfInterest,
  start: LatLng,
  end: LatLng,
): boolean {
  return (
    haversineKm(poi.location, start) > ENDPOINT_SKIP_KM &&
    haversineKm(poi.location, end) > ENDPOINT_SKIP_KM
  );
}

export function filterPoisForRouting(
  start: LatLng,
  end: LatLng,
  pois: PointOfInterest[],
  maxMiddle = MAX_MIDDLE_WAYPOINTS,
  mandatoryIds: Set<string> = new Set(),
): PointOfInterest[] {
  const ordered = orderPoisAlongCorridor(start, end, pois);
  const selected: PointOfInterest[] = [];

  for (const poi of ordered) {
    if (!notNearEndpoint(poi, start, end)) continue;

    const isMandatory = mandatoryIds.has(poi.id);
    if (!isMandatory && selected.length >= maxMiddle) continue;

    const tooClose = selected.some(
      (item) => haversineKm(item.location, poi.location) < MIN_POI_SEPARATION_KM,
    );
    if (tooClose) continue;

    if (isMandatory) {
      selected.push(poi);
      continue;
    }

    const { perpendicularKm, t } = projectOntoSegment(
      poi.location,
      start,
      end,
    );
    if (t < 0.04 || t > 0.96) continue;
    if (perpendicularKm > MAX_OPTIONAL_PERPENDICULAR_KM) continue;

    const last = selected.length > 0 ? selected[selected.length - 1].location : start;
    const directToEnd = haversineKm(last, end);
    const viaPoi = haversineKm(last, poi.location) + haversineKm(poi.location, end);
    if (viaPoi - directToEnd > MAX_OPTIONAL_DETOUR_KM) continue;

    selected.push(poi);
  }

  return selected.slice(0, Math.max(maxMiddle, selected.filter((p) => mandatoryIds.has(p.id)).length));
}

export function buildWaypointChain(
  start: LatLng,
  end: LatLng,
  middlePois: PointOfInterest[],
): LatLng[] {
  const ordered = orderPoisAlongCorridor(start, end, middlePois);
  const chain: LatLng[] = [start];

  for (const poi of ordered) {
    const last = chain[chain.length - 1];
    if (
      Math.abs(last.lat - poi.location.lat) > 0.00003 ||
      Math.abs(last.lng - poi.location.lng) > 0.00003
    ) {
      chain.push(poi.location);
    }
  }

  const last = chain[chain.length - 1];
  if (
    Math.abs(last.lat - end.lat) > 0.00003 ||
    Math.abs(last.lng - end.lng) > 0.00003
  ) {
    chain.push(end);
  }

  return chain;
}

export function buildRoutingWaypointChain(
  start: LatLng,
  end: LatLng,
  candidatePois: PointOfInterest[],
  mandatoryIds: string[] = [],
): { chain: LatLng[]; pois: PointOfInterest[] } {
  const mandatorySet = new Set(mandatoryIds);
  const routingPois = filterPoisForRouting(
    start,
    end,
    candidatePois,
    MAX_MIDDLE_WAYPOINTS,
    mandatorySet,
  );

  return {
    chain: buildWaypointChain(start, end, routingPois),
    pois: routingPois,
  };
}
