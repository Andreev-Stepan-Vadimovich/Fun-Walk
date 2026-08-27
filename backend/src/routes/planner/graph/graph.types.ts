import { LatLng } from '../../interfaces/route.interface';

/** Вершина взвешенного графа маршрута */
export interface GraphNode {
  id: string;
  location: LatLng;
  /** Нормализованная привлекательность вершины ∈ [0, 1] */
  attractiveness: number;
  /** true для POI (парки, велодорожки и т.д.) */
  isPoi: boolean;
  poiName?: string;
}

/** Рёбра хранятся в adjacency list: id → [{ targetId, weight }] */
export interface WeightedGraph {
  nodes: Map<string, GraphNode>;
  adjacency: Map<string, { targetId: string; weight: number }[]>;
}

export interface DijkstraResult {
  path: string[];
  totalWeight: number;
  distances: Map<string, number>;
  previous: Map<string, string | null>;
}

export interface RoutePlanResult {
  waypoints: LatLng[];
  visitedPois: GraphNode[];
  graphNodeCount: number;
  graphEdgeCount: number;
  pathWeight: number;
  algorithm: 'dijkstra';
  /** Источник геометрии маршрута */
  routingSource: 'osrm' | 'direct';
}
