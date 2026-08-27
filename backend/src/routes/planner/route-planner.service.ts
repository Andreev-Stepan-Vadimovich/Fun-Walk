import { Injectable } from '@nestjs/common';
import {
  LatLng,
  PointOfInterest,
  RouteMetrics,
  RoutePreferences,
} from '../interfaces/route.interface';
import { POINTS_OF_INTEREST } from '../data/points-of-interest';
import { WeightedGraph, GraphNode, RoutePlanResult } from './graph/graph.types';
import { dijkstra, countEdges } from './graph/dijkstra';
import { haversineKm, smoothPath } from './math/geo.util';
import {
  scorePois,
  selectCandidatePois,
  pathLengthKm,
  buildFeatureVector,
  featureVectorToArray,
  buildPreferenceVector,
} from './math/poi-scoring.util';
import { dotProduct } from './math/geo.util';

/** Коэффициент η в формуле веса ребра: w(u,v) = d_H(u,v) / (1 + η · Ã(v)) */
const ATTRACTIVENESS_ETA = 2.5;

/** Максимальное расстояние (км) для создания ребра в k-NN графе */
const MAX_EDGE_DISTANCE_KM = 3.5;

/** Число ближайших соседей для каждой вершины */
const K_NEIGHBORS = 4;

@Injectable()
export class RoutePlannerService {
  /**
   * Главный метод планирования маршрута.
   *
   * Этапы:
   * 1. Оценка POI — скalarное произведение w · f(p) минус штраф за отклонение
   * 2. Построение k-NN взвешенного графа G = (V, E)
   * 3. Поиск оптимального пути алгоритмом Dijkstra
   * 4. Сглаживание polyline и расчёт метрик
   */
  plan(
    start: LatLng,
    end: LatLng,
    preferences: RoutePreferences,
  ): RoutePlanResult & { metrics: RouteMetrics; highlights: string[] } {
    const scored = scorePois(POINTS_OF_INTEREST, start, end, preferences);
    const candidates = selectCandidatePois(scored);

    const graph = this.buildWeightedGraph(start, end, candidates, preferences);

    const dijkstraResult = dijkstra(graph, 'start', 'end');
    if (!dijkstraResult) {
      return this.fallbackDirectRoute(start, end, preferences);
    }

    const visitedPois = dijkstraResult.path
      .filter((id) => id !== 'start' && id !== 'end')
      .map((id) => graph.nodes.get(id)!)
      .filter(Boolean);

    const rawWaypoints = dijkstraResult.path.map(
      (id) => graph.nodes.get(id)!.location,
    );
    const waypoints = smoothPath(rawWaypoints);

    const metrics = this.calculateMetrics(
      start,
      end,
      waypoints,
      visitedPois.map((n) => n.poiName).filter(Boolean) as string[],
      candidates.map((c) => c.poi),
      preferences,
      dijkstraResult.totalWeight,
    );

    return {
      waypoints,
      visitedPois,
      graphNodeCount: graph.nodes.size,
      graphEdgeCount: countEdges(graph.adjacency),
      pathWeight: dijkstraResult.totalWeight,
      algorithm: 'dijkstra',
      metrics,
      highlights: visitedPois
        .filter((n) => n.poiName)
        .map((n) => n.poiName!),
    };
  }

  /**
   * Строит неориентированный взвешенный граф.
   *
   * V = {start, end} ∪ {выбранные POI}
   *
   * Рёбра: k ближайших соседей + все пары с d_H < MAX_EDGE_DISTANCE_KM
   *
   * Вес ребра (u, v):
   *   w(u,v) = d_H(u,v) / (1 + η · max(Ã(u), Ã(v)))
   *
   * Чем привлекательнее вершина, тем меньше «эффективная» длина ребра —
   * Dijkstra выбирает путь через парки и зелёные зоны.
   */
  private buildWeightedGraph(
    start: LatLng,
    end: LatLng,
    candidates: ReturnType<typeof selectCandidatePois>,
    preferences: RoutePreferences,
  ): WeightedGraph {
    const nodes = new Map<string, GraphNode>();
    const adjacency = new Map<string, { targetId: string; weight: number }[]>();

    nodes.set('start', {
      id: 'start',
      location: start,
      attractiveness: 0,
      isPoi: false,
    });

    nodes.set('end', {
      id: 'end',
      location: end,
      attractiveness: 0,
      isPoi: false,
    });

    for (const { poi, attractiveness } of candidates) {
      nodes.set(poi.id, {
        id: poi.id,
        location: poi.location,
        attractiveness,
        isPoi: true,
        poiName: poi.name,
      });
    }

    for (const id of nodes.keys()) {
      adjacency.set(id, []);
    }

    const nodeList = Array.from(nodes.values());

    for (let i = 0; i < nodeList.length; i++) {
      const distances = nodeList
        .map((other, j) => ({
          j,
          other,
          dist: i === j ? Infinity : haversineKm(nodeList[i].location, other.location),
        }))
        .filter((d) => d.dist < Infinity)
        .sort((a, b) => a.dist - b.dist);

      const neighborsToConnect = new Set<number>();

      for (const d of distances.slice(0, K_NEIGHBORS)) {
        neighborsToConnect.add(d.j);
      }

      for (const d of distances) {
        if (d.dist <= MAX_EDGE_DISTANCE_KM) {
          neighborsToConnect.add(d.j);
        }
      }

      for (const j of neighborsToConnect) {
        if (j <= i) continue;
        const u = nodeList[i];
        const v = nodeList[j];
        const geoDist = haversineKm(u.location, v.location);
        const weight = this.edgeWeight(geoDist, u.attractiveness, v.attractiveness);
        this.addEdge(adjacency, u.id, v.id, weight);
      }
    }

    return { nodes, adjacency };
  }

  /**
   * w(u,v) = d_H(u,v) / (1 + η · max(Ã(u), Ã(v)))
   * Вес всегда > 0 — корректно для Dijkstra.
   */
  private edgeWeight(
    geoDistKm: number,
    attractivenessU: number,
    attractivenessV: number,
  ): number {
    const maxAttr = Math.max(attractivenessU, attractivenessV);
    return geoDistKm / (1 + ATTRACTIVENESS_ETA * maxAttr);
  }

  private addEdge(
    adjacency: Map<string, { targetId: string; weight: number }[]>,
    u: string,
    v: string,
    weight: number,
  ): void {
    adjacency.get(u)!.push({ targetId: v, weight });
    adjacency.get(v)!.push({ targetId: u, weight });
  }

  private calculateMetrics(
    start: LatLng,
    end: LatLng,
    waypoints: LatLng[],
    highlightNames: string[],
    allCandidatePois: PointOfInterest[],
    preferences: RoutePreferences,
    graphPathWeight: number,
  ): RouteMetrics {
    const distanceKm = pathLengthKm(waypoints);
    const directDistance = haversineKm(start, end);
    const detourRatio = distanceKm / Math.max(directDistance, 0.001);

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

    const greenCoveragePercent = Math.min(
      95,
      Math.round(
        (greenPois.length / Math.max(visitedPoiObjects.length, 1)) * 65 +
          (detourRatio > 1.15 ? 20 : 8) +
          waypoints.length * 2,
      ),
    );

    const bikePathPercent = Math.min(
      90,
      Math.round(
        bikePois.length * 20 + (preferences.bikePaths / 10) * 22,
      ),
    );

    const avgAirQualityIndex =
      visitedPoiObjects.length > 0
        ? Math.round(
            visitedPoiObjects.reduce((s, p) => s + p.airQualityIndex, 0) /
              visitedPoiObjects.length,
          )
        : 60;

    const avgNoiseLevel =
      visitedPoiObjects.length > 0
        ? Math.round(
            visitedPoiObjects.reduce((s, p) => s + p.noiseLevel, 0) /
              visitedPoiObjects.length,
          )
        : 55;

    const durationMin = Math.round((distanceKm / 5) * 60);

    const w = buildPreferenceVector(preferences);
    const wSum = w.reduce((s, v) => s + v, 0) || 1;

    let qualitySum = 0;
    for (const poi of visitedPoiObjects) {
      const f = featureVectorToArray(buildFeatureVector(poi));
      qualitySum += dotProduct(w, f) / wSum;
    }

    const pathEfficiency = directDistance / Math.max(distanceKm, 0.001);
    const graphBonus = Math.min(15, graphPathWeight > 0 ? 10 / graphPathWeight : 0);

    const score = Math.round(
      greenCoveragePercent * 0.25 +
        bikePathPercent * 0.15 +
        ((100 - avgAirQualityIndex) / 100) * 100 * 0.25 +
        ((100 - avgNoiseLevel) / 100) * 100 * 0.15 +
        qualitySum * 10 * 0.15 +
        pathEfficiency * 10 +
        graphBonus,
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

  private fallbackDirectRoute(
    start: LatLng,
    end: LatLng,
    preferences: RoutePreferences,
  ): RoutePlanResult & { metrics: RouteMetrics; highlights: string[] } {
    const waypoints = [start, end];
    const distanceKm = haversineKm(start, end);

    return {
      waypoints,
      visitedPois: [],
      graphNodeCount: 2,
      graphEdgeCount: 1,
      pathWeight: distanceKm,
      algorithm: 'dijkstra',
      highlights: [],
      metrics: {
        distanceKm: Math.round(distanceKm * 100) / 100,
        durationMin: Math.round((distanceKm / 5) * 60),
        greenCoveragePercent: 10,
        bikePathPercent: 0,
        avgAirQualityIndex: 60,
        avgNoiseLevel: 55,
        score: 30,
      },
    };
  }
}
