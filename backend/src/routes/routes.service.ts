import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PlanRouteDto } from './dto/plan-route.dto';
import {
  LatLng,
  PlannedRoute,
  PointOfInterest,
  PresetId,
  RouteSummary,
} from './interfaces/route.interface';
import {
  DEFAULT_END,
  DEFAULT_START,
  POINTS_OF_INTEREST,
} from './data/points-of-interest';
import { RoutePlannerService } from './planner/route-planner.service';
import { AqiService } from './planner/aqi/aqi.service';
import { OsmPoiService } from './planner/poi/osm-poi.service';

@Injectable()
export class RoutesService {
  private readonly routes = new Map<string, PlannedRoute>();

  constructor(
    private readonly routePlanner: RoutePlannerService,
    private readonly aqiService: AqiService,
    private readonly osmPoi: OsmPoiService,
  ) {}

  getPointsOfInterest(): PointOfInterest[] {
    return POINTS_OF_INTEREST;
  }

  async getPointsOfInterestNear(
    start: LatLng,
    end: LatLng,
  ): Promise<PointOfInterest[]> {
    return this.osmPoi.getPoisNear(start, end);
  }

  getDefaultPoints(): { start: LatLng; end: LatLng } {
    return {
      start: DEFAULT_START,
      end: DEFAULT_END,
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
      name: dto.name ?? this.generateRouteName(dto.preferences, dto.presetId),
      start: dto.start,
      end: dto.end,
      waypoints: plan.waypoints,
      preferences: dto.preferences,
      presetId: dto.presetId as PresetId | undefined,
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

  async enrichPoiWithLiveAqi(): Promise<PointOfInterest[]> {
    const enriched = await Promise.all(
      POINTS_OF_INTEREST.map(async (poi) => ({
        ...poi,
        airQualityIndex: await this.aqiService.getAqi(poi.location),
      })),
    );
    return enriched;
  }

  private generateRouteName(
    preferences: import('./interfaces/route.interface').RoutePreferences,
    presetId?: string,
  ): string {
    if (presetId && presetId !== 'custom') {
      const presetNames: Record<string, string> = {
        peaceful: 'Спокойная прогулка',
        bike: 'Велотур',
        quick: 'Быстрый путь',
        waterfront: 'У воды',
        green: 'Зелёный маршрут',
        romantic: 'Романтическая прогулка',
      };
      if (presetNames[presetId]) {
        return presetNames[presetId];
      }
    }

    const entries: [keyof typeof preferences, string][] = [
      ['nature', 'природа'],
      ['bikePaths', 'велодорожки'],
      ['airQuality', 'чистый воздух'],
      ['quietAreas', 'тишина'],
      ['waterfront', 'набережная'],
    ];

    const top = entries
      .sort((a, b) => preferences[b[0]] - preferences[a[0]])
      .slice(0, 2)
      .map(([, label]) => label);

    return `Прогулка: ${top.join(' + ')}`;
  }
}
