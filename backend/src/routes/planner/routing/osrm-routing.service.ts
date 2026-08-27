import { Injectable, Logger } from '@nestjs/common';
import { LatLng } from '../../interfaces/route.interface';

export interface OsrmRouteResult {
  geometry: LatLng[];
  distanceKm: number;
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

/** Порог совпадения координат при склейке сегментов (≈1 м) */
const COORD_EPSILON = 0.00001;

@Injectable()
export class OsrmRoutingService {
  private readonly logger = new Logger(OsrmRoutingService.name);
  private readonly baseUrl =
    process.env.OSRM_URL ?? 'https://router.project-osrm.org';

  /**
   * Строит пешеходный маршрут по дорогам, тропам и аллеям (профиль foot).
   * Использует OSRM — Open Source Routing Machine на данных OpenStreetMap.
   */
  async routeFoot(waypoints: LatLng[]): Promise<OsrmRouteResult | null> {
    if (waypoints.length < 2) return null;

    const coords = waypoints
      .map((p) => `${p.lng},${p.lat}`)
      .join(';');

    const url =
      `${this.baseUrl}/route/v1/foot/${coords}` +
      '?overview=full&geometries=geojson&steps=false';

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
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

      return {
        geometry,
        distanceKm: route.distance / 1000,
        durationMin: Math.round(route.duration / 60),
        source: 'osrm',
      };
    } catch (err) {
      this.logger.warn(`OSRM request failed: ${err}`);
      return null;
    }
  }

  /**
   * Маршрут по сегментам — если единый запрос не удался
   * (например, слишком длинный обход).
   */
  async routeFootWithFallback(
    waypoints: LatLng[],
  ): Promise<OsrmRouteResult | null> {
    const full = await this.routeFoot(waypoints);
    if (full) return full;

    if (waypoints.length <= 2) return null;

    const geometry: LatLng[] = [];
    let totalDistanceM = 0;
    let totalDurationS = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const segment = await this.routeFoot([
        waypoints[i],
        waypoints[i + 1],
      ]);

      if (!segment) return null;

      const points =
        i === 0
          ? segment.geometry
          : segment.geometry.slice(1);

      geometry.push(...points);
      totalDistanceM += segment.distanceKm * 1000;
      totalDurationS += segment.durationMin * 60;
    }

    return {
      geometry,
      distanceKm: totalDistanceM / 1000,
      durationMin: Math.round(totalDurationS / 60),
      source: 'osrm',
    };
  }

  /** Убирает подряд идущие дубликаты координат */
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
