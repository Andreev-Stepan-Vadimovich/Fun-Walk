import { Injectable } from '@nestjs/common';
import { LatLng, RoutePreferences } from '../../interfaces/route.interface';
import { WeightedGraph, GraphNode } from './graph.types';
import { haversineKm } from '../math/geo.util';
import {
  ScoredPoi,
  scorePois,
  selectCandidatePois,
} from '../math/poi-scoring.util';
import { PointOfInterest } from '../../interfaces/route.interface';
import {
  getDominantPreference,
  getMandatoryPoiIds,
} from '../presets/preset-waypoints';

const MAX_EDGE_DISTANCE_KM = 3.5;
const K_NEIGHBORS = 4;
const ENDPOINT_POI_RADIUS_KM = 0.08;

export interface PoiSelectionConfig {
  maxCount: number;
  minScore: number;
  corridorAlpha: number;
  eta: number;
}

@Injectable()
export class PoiGraphService {
  getSelectionConfig(preferences: RoutePreferences): PoiSelectionConfig {
    const isQuick =
      preferences.nature <= 2 &&
      preferences.waterfront <= 2 &&
      preferences.bikePaths <= 3 &&
      preferences.quietAreas <= 4;

    if (isQuick) {
      return {
        maxCount: 0,
        minScore: 1,
        corridorAlpha: 0.35,
        eta: 0.4,
      };
    }

    const avg =
      (preferences.nature +
        preferences.bikePaths +
        preferences.airQuality +
        preferences.quietAreas +
        preferences.waterfront) /
      5;

    return {
      maxCount: Math.min(8, Math.max(4, Math.round(3 + (avg / 10) * 5))),
      minScore: Math.max(0.02, 0.12 - (avg / 10) * 0.08),
      corridorAlpha: 0.12,
      eta: 1.5 + (avg / 10) * 2.5,
    };
  }

  filterEligiblePois(
    pois: PointOfInterest[],
    start: LatLng,
    end: LatLng,
    excludeIds: string[] = [],
  ): PointOfInterest[] {
    const excluded = new Set(excludeIds);
    return pois.filter((poi) => {
      if (excluded.has(poi.id)) return false;
      if (haversineKm(poi.location, start) <= ENDPOINT_POI_RADIUS_KM) {
        return false;
      }
      if (haversineKm(poi.location, end) <= ENDPOINT_POI_RADIUS_KM) {
        return false;
      }
      return true;
    });
  }

  buildWeightedGraph(
    start: LatLng,
    end: LatLng,
    candidates: ScoredPoi[],
    eta: number,
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
          dist:
            i === j
              ? Infinity
              : haversineKm(nodeList[i].location, other.location),
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
        if (
          (u.id === 'start' && v.id === 'end') ||
          (u.id === 'end' && v.id === 'start')
        ) {
          continue;
        }
        const geoDist = haversineKm(u.location, v.location);
        const weight = this.edgeWeight(
          geoDist,
          u.attractiveness,
          v.attractiveness,
          eta,
        );
        this.addEdge(adjacency, u.id, v.id, weight);
      }
    }

    return { nodes, adjacency };
  }

  scoreAndSelect(
    pois: PointOfInterest[],
    start: LatLng,
    end: LatLng,
    preferences: RoutePreferences,
    aqiByPoiId?: Map<string, number>,
  ): { candidates: ScoredPoi[]; config: PoiSelectionConfig } {
    const config = this.getSelectionConfig(preferences);
    const mandatoryIds = new Set(getMandatoryPoiIds(preferences));
    const eligible = this.filterEligiblePois(
      pois,
      start,
      end,
      Array.from(mandatoryIds),
    );

    const scored = scorePois(
      eligible,
      start,
      end,
      preferences,
      aqiByPoiId,
      config.corridorAlpha,
    );

    const dominant = getDominantPreference(preferences);
    const boosted = scored
      .filter((item) => {
        if (dominant === 'waterfront' || dominant === 'nature') {
          return item.poi.type !== 'square';
        }
        return true;
      })
      .map((item) => {
        if (!this.matchesDominantPreference(item.poi, dominant)) {
          const penalty =
            dominant === 'waterfront' || dominant === 'nature' ? 0.35 : 0;
          return {
            ...item,
            totalScore: item.totalScore - penalty,
            attractiveness: Math.max(0, item.attractiveness - penalty * 0.4),
          };
        }

        const boost = preferences[dominant] / 10;
        return {
          ...item,
          totalScore: item.totalScore + boost * 0.8,
          attractiveness: Math.min(1, item.attractiveness + boost * 0.5),
        };
      });

    boosted.sort((a, b) => b.totalScore - a.totalScore);

    const candidates = selectCandidatePois(
      boosted,
      config.maxCount,
      config.minScore,
    );

    return { candidates, config };
  }

  private matchesDominantPreference(
    poi: PointOfInterest,
    dominant: keyof RoutePreferences,
  ): boolean {
    switch (dominant) {
      case 'nature':
        return poi.type === 'park' || poi.type === 'green_zone';
      case 'bikePaths':
        return poi.type === 'bike_path';
      case 'waterfront':
        return poi.type === 'waterfront';
      case 'quietAreas':
        return poi.noiseLevel <= 35 && poi.type !== 'square';
      case 'airQuality':
        return poi.airQualityIndex <= 42;
      default:
        return false;
    }
  }

  private edgeWeight(
    geoDistKm: number,
    attractivenessU: number,
    attractivenessV: number,
    eta: number,
  ): number {
    const maxAttr = Math.max(attractivenessU, attractivenessV);
    return geoDistKm / (1 + eta * maxAttr);
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
}
