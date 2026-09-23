import { Injectable } from '@nestjs/common';
import {
  LatLng,
  PointOfInterest,
  RouteMetrics,
  RoutePreferences,
} from '../interfaces/route.interface';
import { GraphNode, RoutePlanResult } from './graph/graph.types';
import { dijkstra, countEdges } from './graph/dijkstra';
import { haversineKm } from './math/geo.util';
import {
  buildFeatureVector,
  buildPreferenceVector,
  featureVectorToArray,
  pathLengthKm,
  poisOnPath,
  ScoredPoi,
} from './math/poi-scoring.util';
import { dotProduct } from './math/geo.util';
import { OsrmRoutingService } from './routing/osrm-routing.service';
import { PoiGraphService } from './graph/poi-graph.service';
import { AqiService } from './aqi/aqi.service';
import { OsmPoiService } from './poi/osm-poi.service';
import {
  getMandatoryPois,
  getDominantPreference,
  poiMatchesScenario,
  buildRoutingWaypointChain,
} from './presets/preset-waypoints';
import { estimateWalkingDurationMin } from './math/walking-duration.util';

@Injectable()
export class RoutePlannerService {
  constructor(
    private readonly poiGraph: PoiGraphService,
    private readonly osrmRouting: OsrmRoutingService,
    private readonly aqiService: AqiService,
    private readonly osmPoi: OsmPoiService,
  ) {}

  async plan(
    start: LatLng,
    end: LatLng,
    preferences: RoutePreferences,
  ): Promise<
    RoutePlanResult & { metrics: RouteMetrics; highlights: string[] }
  > {
    if (this.isQuickPreset(preferences)) {
      return this.routeDirect(start, end, preferences, 'osrm');
    }

    return this.planViaPoiGraph(start, end, preferences);
  }

  private isQuickPreset(preferences: RoutePreferences): boolean {
    return (
      preferences.nature <= 2 &&
      preferences.waterfront <= 2 &&
      preferences.bikePaths <= 3
    );
  }

  private async planViaPoiGraph(
    start: LatLng,
    end: LatLng,
    preferences: RoutePreferences,
  ): Promise<
    RoutePlanResult & { metrics: RouteMetrics; highlights: string[] }
  > {
    const catalog = await this.osmPoi.getPoisNear(start, end);
    const aqiByPoiId = await this.loadPoiAqi(start, end, catalog);
    const mandatoryPois = getMandatoryPois(
      preferences,
      catalog,
      start,
      end,
    );
    const { candidates, config } = this.poiGraph.scoreAndSelect(
      catalog,
      start,
      end,
      preferences,
      aqiByPoiId,
    );

    const graphCandidates = this.buildGraphCandidates(
      mandatoryPois,
      candidates,
    );

    const graph = this.poiGraph.buildWeightedGraph(
      start,
      end,
      graphCandidates,
      config.eta,
    );

    const dijkstraResult = dijkstra(graph, 'start', 'end');
    if (!dijkstraResult) {
      return this.routeDirect(start, end, preferences, 'osrm');
    }

    const pathOrderedPois = dijkstraResult.path
      .filter((id) => id !== 'start' && id !== 'end')
      .map((id) => catalog.find((p) => p.id === id))
      .filter((poi): poi is PointOfInterest => Boolean(poi));

    const routingPois = this.mergeRoutingPois(
      mandatoryPois,
      pathOrderedPois,
      candidates.map((c) => c.poi),
      getDominantPreference(preferences),
      8,
    );

    const { chain: routingWaypoints } = buildRoutingWaypointChain(
        start,
        end,
        routingPois,
        getMandatoryPois(preferences, catalog, start, end).map((poi) => poi.id),
      );

    const osrmResult = await this.osrmRouting.routeFootWithFallback(
      routingWaypoints,
    );

    let waypoints: LatLng[];
    let routingSource: 'osrm' | 'direct';
    let osrmDistanceKm: number | undefined;

    if (osrmResult) {
      waypoints = osrmResult.geometry;
      routingSource = 'osrm';
      osrmDistanceKm = osrmResult.distanceKm;
    } else {
      waypoints = routingWaypoints;
      routingSource = 'direct';
    }

    const confirmedOnPath = poisOnPath(waypoints, catalog, 0.08);
    const highlightNames = confirmedOnPath.map((poi) => poi.name);

    const visitedPois: GraphNode[] = highlightNames
      .map((name) => catalog.find((p) => p.name === name))
      .filter(Boolean)
      .map((poi) => ({
        id: poi!.id,
        location: poi!.location,
        attractiveness: 0,
        isPoi: true,
        poiName: poi!.name,
      }));

    const metrics = this.calculatePoiMetrics(
      start,
      end,
      waypoints,
      visitedPois,
      [...mandatoryPois, ...candidates.map((c) => c.poi)],
      preferences,
      dijkstraResult.totalWeight,
      osrmDistanceKm,
      aqiByPoiId,
    );

    return {
      waypoints,
      visitedPois,
      graphNodeCount: graph.nodes.size,
      graphEdgeCount: countEdges(graph.adjacency),
      pathWeight: dijkstraResult.totalWeight,
      algorithm: 'dijkstra',
      routingSource,
      metrics,
      highlights: highlightNames,
    };
  }

  private buildGraphCandidates(
    mandatoryPois: PointOfInterest[],
    candidates: ScoredPoi[],
  ): ScoredPoi[] {
    const byId = new Map<string, ScoredPoi>();

    for (const scored of candidates) {
      byId.set(scored.poi.id, scored);
    }

    for (const poi of mandatoryPois) {
      byId.set(poi.id, {
        poi,
        dotScore: 1,
        corridorPenaltyKm: 0,
        totalScore: 1,
        attractiveness: 0.95,
      });
    }

    return Array.from(byId.values());
  }

  /** Обязательные + путь Dijkstra + лучшие кандидаты, без дубликатов */
  private mergeRoutingPois(
    mandatory: PointOfInterest[],
    pathPois: PointOfInterest[],
    candidates: PointOfInterest[],
    dominant: ReturnType<typeof getDominantPreference>,
    maxTotal: number,
  ): PointOfInterest[] {
    const byId = new Map<string, PointOfInterest>();

    for (const poi of mandatory) {
      byId.set(poi.id, poi);
    }

    const rest = [...pathPois, ...candidates].filter(
      (poi) => poi.type !== 'square',
    );
    const matching = rest.filter((poi) => poiMatchesScenario(poi, dominant));
    const other = rest.filter((poi) => !poiMatchesScenario(poi, dominant));

    for (const poi of matching) {
      if (byId.size >= maxTotal) break;
      byId.set(poi.id, poi);
    }
    for (const poi of other) {
      if (byId.size >= maxTotal) break;
      byId.set(poi.id, poi);
    }

    return Array.from(byId.values());
  }

  private async loadPoiAqi(
    start: LatLng,
    end: LatLng,
    pois: PointOfInterest[],
  ): Promise<Map<string, number>> {
    const live = await this.aqiService.getAqi({
      lat: (start.lat + end.lat) / 2,
      lng: (start.lng + end.lng) / 2,
    });

    return new Map(
      pois.map((poi) => [
        poi.id,
        Math.round((poi.airQualityIndex + live) / 2),
      ]),
    );
  }

  private calculatePoiMetrics(
    start: LatLng,
    end: LatLng,
    waypoints: LatLng[],
    visitedPois: GraphNode[],
    allCandidatePois: PointOfInterest[],
    preferences: RoutePreferences,
    graphPathWeight: number,
    osrmDistanceKm: number | undefined,
    aqiByPoiId: Map<string, number>,
  ): RouteMetrics {
    const geometryDistanceKm = pathLengthKm(waypoints);
    const distanceKm =
      osrmDistanceKm && osrmDistanceKm > 0
        ? Math.max(geometryDistanceKm, osrmDistanceKm)
        : geometryDistanceKm;
    const directDistance = haversineKm(start, end);
    const detourRatio = distanceKm / Math.max(directDistance, 0.001);

    const highlightNames = visitedPois
      .map((n) => n.poiName)
      .filter(Boolean) as string[];
    const visitedPoiObjects = allCandidatePois.filter((p) =>
      highlightNames.includes(p.name),
    );

    const greenPois = visitedPoiObjects.filter(
      (p) =>
        p.type === 'park' ||
        p.type === 'green_zone' ||
        p.type === 'waterfront',
    );
    const bikePois = visitedPoiObjects.filter((p) => p.type === 'bike_path');
    const waterfrontPois = visitedPoiObjects.filter(
      (p) => p.type === 'waterfront',
    );

    const greenCoveragePercent = Math.min(
      95,
      Math.round(
        (greenPois.length / Math.max(visitedPoiObjects.length, 1)) * 55 +
          (detourRatio > 1.1 ? 25 : 10) +
          preferences.nature * 2,
      ),
    );

    const bikePathPercent = Math.min(
      90,
      Math.round(
        bikePois.length * 25 +
          (preferences.bikePaths / 10) * 30 +
          (visitedPoiObjects.some((p) => p.type === 'bike_path') ? 15 : 0),
      ),
    );

    const avgAirQualityIndex =
      visitedPoiObjects.length > 0
        ? Math.round(
            visitedPoiObjects.reduce(
              (s, p) => s + (aqiByPoiId.get(p.id) ?? p.airQualityIndex),
              0,
            ) / visitedPoiObjects.length,
          )
        : 55;

    const avgNoiseLevel =
      visitedPoiObjects.length > 0
        ? Math.round(
            visitedPoiObjects.reduce((s, p) => s + p.noiseLevel, 0) /
              visitedPoiObjects.length,
          )
        : 55;

    const durationMin = estimateWalkingDurationMin(distanceKm);

    const w = buildPreferenceVector(preferences);
    const wSum = w.reduce((s, v) => s + v, 0) || 1;

    let qualitySum = 0;
    for (const poi of visitedPoiObjects) {
      const f = featureVectorToArray(
        buildFeatureVector(poi, aqiByPoiId.get(poi.id)),
      );
      qualitySum += dotProduct(w, f) / wSum;
    }

    const pathEfficiency = directDistance / Math.max(distanceKm, 0.001);
    const graphBonus = Math.min(
      15,
      graphPathWeight > 0 ? 10 / graphPathWeight : 0,
    );
    const waterfrontBonus =
      waterfrontPois.length * 5 * (preferences.waterfront / 10);

    const score = Math.round(
      greenCoveragePercent * 0.25 +
        bikePathPercent * 0.15 +
        ((100 - avgAirQualityIndex) / 100) * 100 * 0.25 +
        ((100 - avgNoiseLevel) / 100) * 100 * 0.15 +
        qualitySum * 10 * 0.15 +
        pathEfficiency * 10 +
        graphBonus +
        waterfrontBonus,
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

  private async routeDirect(
    start: LatLng,
    end: LatLng,
    preferences: RoutePreferences,
    preferredSource: 'osrm' | 'direct',
  ): Promise<
    RoutePlanResult & { metrics: RouteMetrics; highlights: string[] }
  > {
    const osrmResult = await this.osrmRouting.routeFootWithFallback([
      start,
      end,
    ]);
    const waypoints = osrmResult ? osrmResult.geometry : [start, end];

    const geometryDistanceKm = pathLengthKm(waypoints);
    const distanceKm =
      osrmResult?.distanceKm && osrmResult.distanceKm > 0
        ? Math.max(geometryDistanceKm, osrmResult.distanceKm)
        : geometryDistanceKm;
    const routingSource = osrmResult ? preferredSource : 'direct';
    const aqi = await this.aqiService.getAqi({
      lat: (start.lat + end.lat) / 2,
      lng: (start.lng + end.lng) / 2,
    });

    return {
      waypoints,
      visitedPois: [],
      graphNodeCount: 2,
      graphEdgeCount: 1,
      pathWeight: distanceKm,
      algorithm: 'dijkstra',
      routingSource,
      highlights: [],
      metrics: {
        distanceKm: Math.round(distanceKm * 100) / 100,
        durationMin: estimateWalkingDurationMin(distanceKm),
        greenCoveragePercent: Math.round(preferences.nature * 1.5),
        bikePathPercent: Math.round(preferences.bikePaths * 2),
        avgAirQualityIndex: aqi,
        avgNoiseLevel: Math.round(70 - preferences.quietAreas * 3),
        score: Math.round(25 + preferences.nature + preferences.airQuality),
      },
    };
  }
}
