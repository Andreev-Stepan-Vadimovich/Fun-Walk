import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LatLng } from '../../interfaces/route.interface';
import { haversineKm } from '../math/geo.util';

interface AqiCacheEntry {
  aqi: number;
  expiresAt: number;
}

interface OpenMeteoAirQualityResponse {
  current?: {
    european_aqi?: number;
    pm2_5?: number;
    pm10?: number;
  };
}

@Injectable()
export class AqiService {
  private readonly logger = new Logger(AqiService.name);
  private readonly cache = new Map<string, AqiCacheEntry>();
  private readonly ttlMs = 15 * 60 * 1000;

  constructor(private readonly config: ConfigService) {}

  async getAqi(point: LatLng): Promise<number> {
    const key = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.aqi;
    }

    const baseUrl =
      this.config.get<string>('app.aqiApiUrl') ??
      'https://air-quality-api.open-meteo.com/v1/air-quality';

    const url =
      `${baseUrl}?latitude=${point.lat}&longitude=${point.lng}` +
      '&current=european_aqi,pm2_5,pm10';

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this.logger.warn(`AQI HTTP ${response.status}`);
        return this.fallbackAqi(point);
      }

      const data = (await response.json()) as OpenMeteoAirQualityResponse;
      const aqi = this.normalizeAqi(data);
      this.cache.set(key, { aqi, expiresAt: Date.now() + this.ttlMs });
      return aqi;
    } catch (error) {
      this.logger.warn(`AQI request failed: ${error}`);
      return this.fallbackAqi(point);
    }
  }

  async getAqiGrid(points: LatLng[]): Promise<Map<string, number>> {
    const unique = new Map<string, LatLng>();
    for (const point of points) {
      const key = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
      unique.set(key, point);
    }

    const entries = await Promise.all(
      Array.from(unique.entries()).map(async ([key, point]) => {
        const aqi = await this.getAqi(point);
        return [key, aqi] as const;
      }),
    );

    return new Map(entries);
  }

  async getAqiForPoints(points: LatLng[]): Promise<number[]> {
    const grid = await this.getAqiGrid(points);
    return points.map((point) => {
      const key = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
      return grid.get(key) ?? 55;
    });
  }

  private normalizeAqi(data: OpenMeteoAirQualityResponse): number {
    const european = data.current?.european_aqi;
    if (typeof european === 'number' && Number.isFinite(european)) {
      return Math.round(Math.min(100, Math.max(10, european)));
    }

    const pm25 = data.current?.pm2_5;
    if (typeof pm25 === 'number' && Number.isFinite(pm25)) {
      return Math.round(Math.min(100, Math.max(10, pm25 * 2.5)));
    }

    const pm10 = data.current?.pm10;
    if (typeof pm10 === 'number' && Number.isFinite(pm10)) {
      return Math.round(Math.min(100, Math.max(10, pm10 * 1.8)));
    }

    return 55;
  }

  private fallbackAqi(point: LatLng): number {
    const center: LatLng = { lat: 57.6225, lng: 39.896 };
    const dist = haversineKm(point, center);
    return Math.round(Math.min(78, 38 + dist * 8));
  }
}
