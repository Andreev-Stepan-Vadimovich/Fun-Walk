import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LatLng, PointOfInterest } from '../../interfaces/route.interface';
import { POINTS_OF_INTEREST } from '../../data/points-of-interest';
import { haversineKm } from '../math/geo.util';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

const USER_AGENT = 'FunWalk/1.0 (yaroslavl-route-planner; coursework)';
const DEDUPE_KM = 0.12;
const MAX_OSM_POIS = 40;
const CACHE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class OsmPoiService {
  private readonly logger = new Logger(OsmPoiService.name);
  private readonly cache = new Map<
    string,
    { at: number; pois: PointOfInterest[] }
  >();

  constructor(private readonly config: ConfigService) {}

  async getPoisNear(start: LatLng, end: LatLng): Promise<PointOfInterest[]> {
    const bbox = this.buildBbox(start, end);
    const cacheKey = [
      bbox.south.toFixed(3),
      bbox.west.toFixed(3),
      bbox.north.toFixed(3),
      bbox.east.toFixed(3),
    ].join(',');

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.pois;
    }

    const curated = POINTS_OF_INTEREST.filter((poi) =>
      this.inBbox(poi.location, bbox),
    );
    const osm = await this.fetchOsmPois(bbox);
    const merged = this.merge(curated, osm);
    this.cache.set(cacheKey, { at: Date.now(), pois: merged });
    return merged;
  }

  private buildBbox(start: LatLng, end: LatLng) {
    const padding = 0.018;
    return {
      south: Math.min(start.lat, end.lat) - padding,
      west: Math.min(start.lng, end.lng) - padding,
      north: Math.max(start.lat, end.lat) + padding,
      east: Math.max(start.lng, end.lng) + padding,
    };
  }

  private inBbox(
    point: LatLng,
    bbox: { south: number; west: number; north: number; east: number },
  ): boolean {
    return (
      point.lat >= bbox.south &&
      point.lat <= bbox.north &&
      point.lng >= bbox.west &&
      point.lng <= bbox.east
    );
  }

  private async fetchOsmPois(bbox: {
    south: number;
    west: number;
    north: number;
    east: number;
  }): Promise<PointOfInterest[]> {
    const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
    const query = `
[out:json][timeout:25];
(
  nwr["leisure"="park"](${box});
  nwr["leisure"="garden"](${box});
  nwr["leisure"="nature_reserve"](${box});
  nwr["landuse"="recreation_ground"](${box});
  nwr["place"="square"](${box});
  way["highway"="cycleway"](${box});
  nwr["name"~"набережн",i](${box});
);
out center tags;
`.trim();

    const data = await this.queryOverpass(query);
    if (!data?.elements?.length) return [];

    const pois: PointOfInterest[] = [];
    for (const element of data.elements) {
      const poi = this.toPoi(element);
      if (poi) pois.push(poi);
    }

    pois.sort((a, b) => {
      const named = Number(Boolean(b.name && !this.isGenericName(b.name))) -
        Number(Boolean(a.name && !this.isGenericName(a.name)));
      if (named !== 0) return named;
      return b.areaHa - a.areaHa;
    });

    return pois.slice(0, MAX_OSM_POIS);
  }

  private toPoi(element: OverpassElement): PointOfInterest | null {
    const tags = element.tags ?? {};
    if (tags.building && !tags.leisure && !tags.place) return null;

    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat == null || lon == null) return null;

    const type = this.classify(tags);
    if (!type) return null;

    const name = this.displayName(tags, type);
    const quality = this.qualityForType(type);

    return {
      id: `osm-${element.type}-${element.id}`,
      name,
      type,
      location: { lat, lng: lon },
      airQualityIndex: quality.aqi,
      noiseLevel: quality.noise,
      areaHa: quality.areaHa,
    };
  }

  private classify(
    tags: Record<string, string>,
  ): PointOfInterest['type'] | null {
    const name = `${tags.name ?? ''} ${tags['name:ru'] ?? ''}`.toLowerCase();
    if (name.includes('набережн')) return 'waterfront';
    if (tags.highway === 'cycleway') return 'bike_path';
    if (tags.place === 'square') return 'square';
    if (tags.leisure === 'garden') return 'green_zone';
    if (
      tags.leisure === 'park' ||
      tags.leisure === 'nature_reserve' ||
      tags.landuse === 'recreation_ground'
    ) {
      return 'park';
    }
    return null;
  }

  private displayName(
    tags: Record<string, string>,
    type: PointOfInterest['type'],
  ): string {
    const name = tags['name:ru'] ?? tags.name;
    if (name) return name;
    switch (type) {
      case 'waterfront':
        return 'Набережная';
      case 'bike_path':
        return 'Велодорожка';
      case 'square':
        return 'Площадь';
      case 'green_zone':
        return 'Сквер';
      default:
        return 'Парк';
    }
  }

  private isGenericName(name: string): boolean {
    return ['Парк', 'Сквер', 'Набережная', 'Велодорожка', 'Площадь'].includes(
      name,
    );
  }

  private qualityForType(type: PointOfInterest['type']): {
    aqi: number;
    noise: number;
    areaHa: number;
  } {
    switch (type) {
      case 'waterfront':
        return { aqi: 40, noise: 36, areaHa: 8 };
      case 'bike_path':
        return { aqi: 41, noise: 35, areaHa: 1 };
      case 'square':
        return { aqi: 52, noise: 58, areaHa: 2 };
      case 'green_zone':
        return { aqi: 40, noise: 34, areaHa: 3 };
      default:
        return { aqi: 38, noise: 30, areaHa: 6 };
    }
  }

  private merge(
    curated: PointOfInterest[],
    osm: PointOfInterest[],
  ): PointOfInterest[] {
    const result = [...curated];
    for (const poi of osm) {
      const duplicate = result.some(
        (existing) =>
          haversineKm(existing.location, poi.location) < DEDUPE_KM,
      );
      if (!duplicate) result.push(poi);
    }
    return result;
  }

  private async queryOverpass(query: string): Promise<OverpassResponse | null> {
    const mirrors =
      this.config.get<string[]>('app.overpassMirrors') ?? [
        'https://overpass-api.de/api/interpreter',
      ];

    for (const mirror of mirrors) {
      try {
        const response = await fetch(mirror, {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded; charset=UTF-8',
            Accept: 'application/json',
            'User-Agent': USER_AGENT,
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(25_000),
        });
        if (!response.ok) {
          this.logger.warn(`Overpass POI HTTP ${response.status} at ${mirror}`);
          continue;
        }
        return (await response.json()) as OverpassResponse;
      } catch (error) {
        this.logger.warn(`Overpass POI failed at ${mirror}: ${error}`);
      }
    }
    return null;
  }
}
