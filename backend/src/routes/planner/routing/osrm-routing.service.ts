import { Injectable, Logger } from '@nestjs/common';
import { LatLng } from '../../interfaces/route.interface';
import { haversineKm } from '../math/geo.util';
import { cleanRouteGeometry } from '../math/route-geometry.util';

export interface OsrmRouteResult {
  geometry: LatLng[];
  distanceKm: number;
  durationSec: number;
  durationMin: number;
  source: 'osrm';
}

interface OsrmRouteResponse {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: {
      type: string;
      coordinates: [number, number][];
    };
  }[];
}

interface OsrmNearestResponse {
  code: string;
  waypoints?: { location: [number, number] }[];
}

const COORD_EPSILON = 0.00001;
const MAX_SNAP_KM = 0.05;

@Injectable()
export class OsrmRoutingService {
  private readonly logger = new Logger(OsrmRoutingService.name);
  private readonly baseUrl =
    process.env.OSRM_URL ?? 'https://router.project-osrm.org';

  async routeFoot(waypoints: LatLng[]): Promise<OsrmRouteResult | null> {
    if (waypoints.length < 2) return null;

    const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');

    const url =
      `${this.baseUrl}/route/v1/foot/${coords}` +
      '?overview=full&geometries=geojson&steps=false';

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(25_000),
      });

      if (!response.ok) {
        this.logger.warn(`OSRM HTTP ${response.status}`);
        return null;
      }

      const data = (await response.json()) as OsrmRouteResponse;
      if (data.code !== 'Ok' || !data.routes?.length) {
        this.logger.warn(`OSRM code: ${data.code}`);
        return null;
      }

      const route = data.routes[0];
      const geometry = route.geometry.coordinates.map(([lng, lat]) => ({
        lng,
        lat,
      }));

      return this.buildResult(geometry, route.distance, route.duration);
    } catch (err) {
      this.logger.warn(`OSRM request failed: ${err}`);
      return null;
    }
  }

  /**
   * Маршрут по цепочке точек: каждый участок строится отдельно,
   * затем геометрия склеивается и очищается от петель и «лучей».
   */
  async routeFootLegs(waypoints: LatLng[]): Promise<OsrmRouteResult | null> {
    if (waypoints.length < 2) return null;

    let geometry: LatLng[] = [];
    let distanceM = 0;
    let durationSec = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const leg = await this.routeFoot([waypoints[i], waypoints[i + 1]]);
      if (!leg) return null;

      if (geometry.length === 0) {
        geometry = leg.geometry;
      } else if (leg.geometry.length > 0) {
        geometry = this.mergeLegGeometry(geometry, leg.geometry);
      }

      distanceM += leg.distanceKm * 1000;
      durationSec += leg.durationSec;
    }

    return this.buildResult(geometry, distanceM, durationSec);
  }

  /** Привязка точки к ближайшей пешеходной дороге OSM (с ограничением смещения) */
  async snapToFootway(point: LatLng): Promise<LatLng> {
    const url =
      `${this.baseUrl}/nearest/v1/foot/${point.lng},${point.lat}?number=1`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) return point;

      const data = (await response.json()) as OsrmNearestResponse;
      const location = data.waypoints?.[0]?.location;
      if (!location) return point;

      const snapped = { lng: location[0], lat: location[1] };
      if (haversineKm(point, snapped) > MAX_SNAP_KM) {
        return point;
      }
      return snapped;
    } catch {
      return point;
    }
  }

  async snapWaypoints(waypoints: LatLng[]): Promise<LatLng[]> {
    return Promise.all(waypoints.map((point) => this.snapToFootway(point)));
  }

  async routeFootWithFallback(
    waypoints: LatLng[],
  ): Promise<OsrmRouteResult | null> {
    const snapped = await this.snapWaypoints(waypoints);

    if (snapped.length <= 2) {
      return this.routeFoot(snapped);
    }

    const legResult = await this.routeFootLegs(snapped);
    if (legResult) return legResult;

    return this.routeFoot(snapped);
  }

  private mergeLegGeometry(existing: LatLng[], leg: LatLng[]): LatLng[] {
    if (existing.length === 0) return leg;

    const last = existing[existing.length - 1];
    const firstLeg = leg[0];
    const skipFirst =
      Math.abs(last.lat - firstLeg.lat) <= COORD_EPSILON &&
      Math.abs(last.lng - firstLeg.lng) <= COORD_EPSILON;

    return skipFirst
      ? [...existing, ...leg.slice(1)]
      : [...existing, ...leg];
  }

  private buildResult(
    geometry: LatLng[],
    distanceM: number,
    durationSec: number,
  ): OsrmRouteResult {
    const cleaned = cleanRouteGeometry(this.deduplicateGeometry(geometry));
    const cleanedDistanceKm = this.geometryLengthKm(cleaned);

    return {
      geometry: cleaned,
      distanceKm:
        cleanedDistanceKm > 0
          ? cleanedDistanceKm
          : distanceM / 1000,
      durationSec,
      durationMin: Math.round(durationSec / 60),
      source: 'osrm',
    };
  }

  private geometryLengthKm(points: LatLng[]): number {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += haversineKm(points[i], points[i + 1]);
    }
    return total;
  }

  deduplicateGeometry(points: LatLng[]): LatLng[] {
    if (points.length === 0) return points;

    const result: LatLng[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const prev = result[result.length - 1];
      const curr = points[i];
      if (
        Math.abs(prev.lat - curr.lat) > COORD_EPSILON ||
        Math.abs(prev.lng - curr.lng) > COORD_EPSILON
      ) {
        result.push(curr);
      }
    }
    return result;
  }
}
