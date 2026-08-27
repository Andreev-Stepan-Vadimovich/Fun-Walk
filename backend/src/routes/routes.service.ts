import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PlanRouteDto } from './dto/plan-route.dto';
import {
  LatLng,
  PlannedRoute,
  PointOfInterest,
  RouteSummary,
} from './interfaces/route.interface';
import { POINTS_OF_INTEREST } from './data/points-of-interest';
import { RoutePlannerService } from './planner/route-planner.service';

@Injectable()
export class RoutesService {
  private readonly routes = new Map<string, PlannedRoute>();

  constructor(private readonly routePlanner: RoutePlannerService) {}

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

  async planRoute(dto: PlanRouteDto): Promise<PlannedRoute> {
    const plan = await this.routePlanner.plan(
      dto.start,
      dto.end,
      dto.preferences,
    );

    const route: PlannedRoute = {
      id: randomUUID(),
      name: dto.name ?? this.generateRouteName(dto.preferences),
      start: dto.start,
      end: dto.end,
      waypoints: plan.waypoints,
      preferences: dto.preferences,
      metrics: plan.metrics,
      highlights: plan.highlights,
      createdAt: new Date().toISOString(),
      algorithm: plan.algorithm,
      routingSource: plan.routingSource,
      graphStats: {
        nodes: plan.graphNodeCount,
        edges: plan.graphEdgeCount,
        pathWeight: Math.round(plan.pathWeight * 1000) / 1000,
      },
    };

    this.routes.set(route.id, route);
    return route;
  }

  private generateRouteName(
    preferences: import('./interfaces/route.interface').RoutePreferences,
  ): string {
    const entries: [keyof typeof preferences, string][] = [
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
}
