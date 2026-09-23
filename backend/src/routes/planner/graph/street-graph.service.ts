import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LatLng, RoutePreferences } from '../../interfaces/route.interface';
import { WeightedGraph, GraphNode } from '../graph/graph.types';
import { countEdges } from '../graph/dijkstra';
import { haversineKm } from '../math/geo.util';
import {
  buildEdgeFeatures,
  edgeUtility,
  edgeWeightKm,
} from '../math/edge-scoring.util';
import { AqiService } from '../aqi/aqi.service';

interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
}

interface OverpassWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: Array<OverpassNode | OverpassWay>;
}

export interface StreetGraphPlanResult {
  graph: WeightedGraph;
  edgeLengths: Map<string, number>;
  edgeFeatures: Map<string, number[]>;
}

const START_ID = '__start__';
const END_ID = '__end__';
const SNAP_RADIUS_KM = 0.45;
const OVERPASS_USER_AGENT = 'FunWalk/1.0 (yaroslavl-route-planner; coursework)';

@Injectable()
export class StreetGraphService {
  private readonly logger = new Logger(StreetGraphService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly aqiService: AqiService,
  ) {}

  async buildGraph(
    start: LatLng,
    end: LatLng,
    preferences: RoutePreferences,
  ): Promise<StreetGraphPlanResult | null> {
    const bbox = this.buildBoundingBox(start, end);
    const overpassData = await this.fetchOverpass(bbox);
    if (!overpassData) return null;

    const nodeCoords = new Map<number, LatLng>();
    const ways: OverpassWay[] = [];

    for (const element of overpassData.elements) {
      if (element.type === 'node') {
        nodeCoords.set(element.id, { lat: element.lat, lng: element.lon });
      } else if (element.type === 'way') {
        ways.push(element);
      }
    }

    if (nodeCoords.size === 0 || ways.length === 0) {
      return null;
    }

    const nodes = new Map<string, GraphNode>();
    const adjacency = new Map<string, { targetId: string; weight: number }[]>();
    const edgeLengths = new Map<string, number>();
    const edgeFeatures = new Map<string, number[]>();
    const edgeTags = new Map<
      string,
      { tags: Record<string, string>; midpoint: LatLng; lengthKm: number }
    >();

    for (const [id, location] of nodeCoords.entries()) {
      const nodeId = String(id);
      nodes.set(nodeId, {
        id: nodeId,
        location,
        attractiveness: 0,
        isPoi: false,
      });
      adjacency.set(nodeId, []);
    }

    for (const way of ways) {
      const tags = way.tags ?? {};
      if (!this.isWalkableWay(tags)) continue;

      for (let i = 0; i < way.nodes.length - 1; i++) {
        const fromId = way.nodes[i];
        const toId = way.nodes[i + 1];
        const from = nodeCoords.get(fromId);
        const to = nodeCoords.get(toId);
        if (!from || !to) continue;

        const a = String(Math.min(fromId, toId));
        const b = String(Math.max(fromId, toId));
        const edgeKey = `${a}|${b}`;
        const lengthKm = haversineKm(from, to);
        if (lengthKm <= 0) continue;

        const midpoint: LatLng = {
          lat: (from.lat + to.lat) / 2,
          lng: (from.lng + to.lng) / 2,
        };

        const existing = edgeTags.get(edgeKey);
        if (!existing || lengthKm > existing.lengthKm) {
          edgeTags.set(edgeKey, { tags, midpoint, lengthKm });
        }
      }
    }

    const midpoints = Array.from(edgeTags.values()).map((edge) => edge.midpoint);
    const aqiValues = await this.aqiService.getAqiForPoints(midpoints);
    const aqiByEdgeKey = new Map<string, number>();
    Array.from(edgeTags.keys()).forEach((key, index) => {
      aqiByEdgeKey.set(key, aqiValues[index] ?? 55);
    });

    for (const [edgeKey, edge] of edgeTags.entries()) {
      const [a, b] = edgeKey.split('|');
      const aqi = aqiByEdgeKey.get(edgeKey) ?? 55;
      const features = buildEdgeFeatures(edge.tags, aqi);
      const utility = edgeUtility(features, preferences);
      const weight = edgeWeightKm(edge.lengthKm, utility, preferences);

      edgeLengths.set(edgeKey, edge.lengthKm);
      edgeFeatures.set(edgeKey, [
        features.nature,
        features.bikePaths,
        features.airQuality,
        features.quietAreas,
        features.waterfront,
      ]);

      this.addUndirectedEdge(adjacency, a, b, weight);
    }

    if (countEdges(adjacency) === 0) {
      return null;
    }

    nodes.set(START_ID, {
      id: START_ID,
      location: start,
      attractiveness: 0,
      isPoi: false,
    });
    nodes.set(END_ID, {
      id: END_ID,
      location: end,
      attractiveness: 0,
      isPoi: false,
    });
    adjacency.set(START_ID, []);
    adjacency.set(END_ID, []);

    this.connectVirtualNode(adjacency, START_ID, start, nodes, preferences);
    this.connectVirtualNode(adjacency, END_ID, end, nodes, preferences);

    return {
      graph: { nodes, adjacency },
      edgeLengths,
      edgeFeatures,
    };
  }

  private connectVirtualNode(
    adjacency: Map<string, { targetId: string; weight: number }[]>,
    virtualId: string,
    point: LatLng,
    nodes: Map<string, GraphNode>,
    preferences: RoutePreferences,
  ): void {
    const candidates = Array.from(nodes.values())
      .filter((node) => node.id !== START_ID && node.id !== END_ID)
      .map((node) => ({
        node,
        dist: haversineKm(point, node.location),
      }))
      .filter((item) => item.dist <= SNAP_RADIUS_KM)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 4);

    if (candidates.length === 0) {
      const nearest = Array.from(nodes.values())
        .filter((node) => node.id !== START_ID && node.id !== END_ID)
        .map((node) => ({
          node,
          dist: haversineKm(point, node.location),
        }))
        .sort((a, b) => a.dist - b.dist)[0];

      if (!nearest) return;
      candidates.push(nearest);
    }

    for (const { node, dist } of candidates) {
      const weight = edgeWeightKm(dist, 0.05, preferences);
      this.addUndirectedEdge(adjacency, virtualId, node.id, weight);
    }
  }

  private addUndirectedEdge(
    adjacency: Map<string, { targetId: string; weight: number }[]>,
    a: string,
    b: string,
    weight: number,
  ): void {
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);

    if (!adjacency.get(a)!.some((edge) => edge.targetId === b)) {
      adjacency.get(a)!.push({ targetId: b, weight });
    }
    if (!adjacency.get(b)!.some((edge) => edge.targetId === a)) {
      adjacency.get(b)!.push({ targetId: a, weight });
    }
  }

  private isWalkableWay(tags: Record<string, string>): boolean {
    const highway = tags.highway;
    if (!highway) return false;
    if (tags.access === 'private' || tags.access === 'no') return false;
    if (tags.foot === 'no') return false;
    return true;
  }

  private buildBoundingBox(
    start: LatLng,
    end: LatLng,
  ): { south: number; west: number; north: number; east: number } {
    const padding = 0.012;
    return {
      south: Math.min(start.lat, end.lat) - padding,
      west: Math.min(start.lng, end.lng) - padding,
      north: Math.max(start.lat, end.lat) + padding,
      east: Math.max(start.lng, end.lng) + padding,
    };
  }

  private async fetchOverpass(
    bbox: { south: number; west: number; north: number; east: number },
  ): Promise<OverpassResponse | null> {
    const query = `
[out:json][timeout:25];
(
  way["highway"~"footway|path|pedestrian|steps|cycleway|living_street|residential|unclassified|tertiary|secondary|service"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
);
out body;
>;
out skel qt;
`.trim();

    const mirrors =
      this.config.get<string[]>('app.overpassMirrors') ?? [
        'https://overpass-api.de/api/interpreter',
      ];

    for (const mirror of mirrors) {
      try {
        const response = await this.postOverpass(mirror, query);
        if (!response) {
          const getResponse = await this.getOverpass(mirror, query);
          if (!getResponse) continue;
          return getResponse;
        }
        return response;
      } catch (error) {
        this.logger.warn(`Overpass failed at ${mirror}: ${error}`);
      }
    }

    return null;
  }

  private async postOverpass(
    mirror: string,
    query: string,
  ): Promise<OverpassResponse | null> {
    const response = await fetch(mirror, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
        'User-Agent': OVERPASS_USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      this.logger.warn(`Overpass HTTP ${response.status} at ${mirror}`);
      return null;
    }

    return (await response.json()) as OverpassResponse;
  }

  private async getOverpass(
    mirror: string,
    query: string,
  ): Promise<OverpassResponse | null> {
    const url = `${mirror}?data=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(25_000),
      headers: {
        Accept: 'application/json',
        'User-Agent': OVERPASS_USER_AGENT,
      },
    });

    if (!response.ok) {
      this.logger.warn(`Overpass GET HTTP ${response.status} at ${mirror}`);
      return null;
    }

    return (await response.json()) as OverpassResponse;
  }
}
