import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PlanRouteDto } from './dto/plan-route.dto';
import {
  LatLng,
  PlannedRoute,
  PointOfInterest,
  RouteMetrics,
  RoutePreferences,
  RouteSummary,
} from './interfaces/route.interface';
import { POINTS_OF_INTEREST } from './data/points-of-interest';

@Injectable()
export class RoutesService {
  private readonly routes = new Map<string, PlannedRoute>();

  getPointsOfInterest(): PointOfInterest[] {
    return POINTS_OF_INTEREST;
  }

  getDefaultPoints(): { start: LatLng; end: LatLng } {
    return {
      start: { lat: 55.7558, lng: 37.6173 },
      end: { lat: 55.7293, lng: 37.6017 },
    };
  }

  findAll(): RouteSummary[] {
    return Array.from(this.routes.values())
      .map((route) => ({
        id: route.id,
        name: route.name,
        distanceKm: route.metrics.distanceKm,
        score: route.metrics.score,
        createdAt: route.createdAt,
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  findOne(id: string): PlannedRoute {
    const route = this.routes.get(id);
    if (!route) {
      throw new NotFoundException(`Маршрут с id "${id}" не найден`);
    }
    return route;
  }

  remove(id: string): void {
    if (!this.routes.delete(id)) {
      throw new NotFoundException(`Маршрут с id "${id}" не найден`);
    }
  }

  planRoute(dto: PlanRouteDto): PlannedRoute {
    const preferences = dto.preferences;
    const selectedPois = this.selectPois(dto.start, dto.end, preferences);
    const waypoints = this.buildWaypoints(dto.start, dto.end, selectedPois);
    const metrics = this.calculateMetrics(
      dto.start,
      dto.end,
      waypoints,
      selectedPois,
      preferences,
    );
    const highlights = selectedPois.map((poi) => poi.name);

    const route: PlannedRoute = {
      id: randomUUID(),
      name: dto.name ?? this.generateRouteName(preferences),
      start: dto.start,
      end: dto.end,
      waypoints,
      preferences,
      metrics,
      highlights,
      createdAt: new Date().toISOString(),
    };

    this.routes.set(route.id, route);
    return route;
  }

  private selectPois(
    start: LatLng,
    end: LatLng,
    preferences: RoutePreferences,
  ): PointOfInterest[] {
    const midLat = (start.lat + end.lat) / 2;
    const midLng = (start.lng + end.lng) / 2;

    const scored = POINTS_OF_INTEREST.map((poi) => {
      const distToRoute = this.distanceToSegment(
        poi.location,
        start,
        end,
        midLat,
        midLng,
      );
      const typeScore = this.poiTypeScore(poi, preferences);
      const airScore = (100 - poi.airQualityIndex) / 100;
      const quietScore = (100 - poi.noiseLevel) / 100;

      const total =
        typeScore * 3 +
        airScore * (preferences.airQuality / 10) * 2 +
        quietScore * (preferences.quietAreas / 10) * 2 -
        distToRoute * 0.0003;

      return { poi, score: total };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .filter((item) => item.score > 0)
      .map((item) => item.poi);
  }

  private poiTypeScore(
    poi: PointOfInterest,
    preferences: RoutePreferences,
  ): number {
    const weights: Record<PointOfInterest['type'], number> = {
      park: preferences.parks,
      green_zone: preferences.greenZones,
      bike_path: preferences.bikePaths,
      waterfront: preferences.waterfront,
      square: 0,
    };
    return weights[poi.type] / 10;
  }

  private buildWaypoints(
    start: LatLng,
    end: LatLng,
    pois: PointOfInterest[],
  ): LatLng[] {
    const points: LatLng[] = [start];

    const sortedPois = [...pois].sort((a, b) => {
      const da = this.haversine(start, a.location);
      const db = this.haversine(start, b.location);
      return da - db;
    });

    for (const poi of sortedPois) {
      points.push(poi.location);
    }

    points.push(end);
    return this.smoothPath(points);
  }

  private smoothPath(points: LatLng[]): LatLng[] {
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

  private calculateMetrics(
    start: LatLng,
    end: LatLng,
    waypoints: LatLng[],
    pois: PointOfInterest[],
    preferences: RoutePreferences,
  ): RouteMetrics {
    let distanceKm = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      distanceKm += this.haversine(waypoints[i], waypoints[i + 1]);
    }

    const directDistance = this.haversine(start, end);
    const detourRatio = distanceKm / Math.max(directDistance, 0.001);

    const greenPois = pois.filter(
      (p) =>
        p.type === 'park' ||
        p.type === 'green_zone' ||
        p.type === 'waterfront',
    );
    const bikePois = pois.filter((p) => p.type === 'bike_path');

    const greenCoveragePercent = Math.min(
      95,
      Math.round(
        (greenPois.length / Math.max(pois.length, 1)) * 70 +
          (detourRatio > 1.2 ? 15 : 5),
      ),
    );

    const bikePathPercent = Math.min(
      90,
      Math.round(
        bikePois.length * 18 + (preferences.bikePaths / 10) * 25,
      ),
    );

    const avgAirQualityIndex =
      pois.length > 0
        ? Math.round(
            pois.reduce((sum, p) => sum + p.airQualityIndex, 0) / pois.length,
          )
        : 60;

    const avgNoiseLevel =
      pois.length > 0
        ? Math.round(
            pois.reduce((sum, p) => sum + p.noiseLevel, 0) / pois.length,
          )
        : 55;

    const durationMin = Math.round((distanceKm / 5) * 60);

    const prefSum =
      preferences.greenZones +
      preferences.bikePaths +
      preferences.airQuality +
      preferences.quietAreas +
      preferences.waterfront +
      preferences.parks;

    const airScore = ((100 - avgAirQualityIndex) / 100) * 100;
    const quietScore = ((100 - avgNoiseLevel) / 100) * 100;

    const score = Math.round(
      greenCoveragePercent * (preferences.greenZones / prefSum) * 0.35 +
        bikePathPercent * (preferences.bikePaths / prefSum) * 0.2 +
        airScore * (preferences.airQuality / prefSum) * 0.25 +
        quietScore * (preferences.quietAreas / prefSum) * 0.2,
    );

    return {
      distanceKm: Math.round(distanceKm * 100) / 100,
      durationMin,
      greenCoveragePercent,
      bikePathPercent,
      avgAirQualityIndex,
      avgNoiseLevel,
      score: Math.min(100, Math.max(0, score)),
    };
  }

  private generateRouteName(preferences: RoutePreferences): string {
    const entries: [keyof RoutePreferences, string][] = [
      ['greenZones', 'зелёные зоны'],
      ['bikePaths', 'велодорожки'],
      ['airQuality', 'чистый воздух'],
      ['quietAreas', 'тишина'],
      ['waterfront', 'набережная'],
      ['parks', 'парки'],
    ];

    const top = entries
      .sort((a, b) => preferences[b[0]] - preferences[a[0]])
      .slice(0, 2)
      .map(([, label]) => label);

    return `Прогулка: ${top.join(' + ')}`;
  }

  private haversine(a: LatLng, b: LatLng): number {
    const R = 6371;
    const dLat = this.toRad(b.lat - a.lat);
    const dLng = this.toRad(b.lng - a.lng);
    const lat1 = this.toRad(a.lat);
    const lat2 = this.toRad(b.lat);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  private distanceToSegment(
    point: LatLng,
    start: LatLng,
    end: LatLng,
    midLat: number,
    midLng: number,
  ): number {
    const toMid = this.haversine(point, { lat: midLat, lng: midLng });
    const toStart = this.haversine(point, start);
    const toEnd = this.haversine(point, end);
    return Math.min(toMid, toStart, toEnd);
  }
}
