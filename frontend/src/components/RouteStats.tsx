import type { PlannedRoute, PointOfInterest } from '../types';
import { formatWalkingDuration } from '../utils/formatDuration';
import { getNumberedRouteStops } from '../utils/routeStops';

interface Props {
  route: PlannedRoute;
  poiList: PointOfInterest[];
}

function airQualityLabel(aqi: number): { text: string; color: string } {
  if (aqi <= 40) return { text: 'Отлично', color: 'text-sage-600' };
  if (aqi <= 55) return { text: 'Хорошо', color: 'text-sage-500' };
  if (aqi <= 70) return { text: 'Умеренно', color: 'text-amber-600' };
  return { text: 'Плохо', color: 'text-orange-500' };
}

function noiseLabel(level: number): string {
  if (level <= 35) return 'Тихо';
  if (level <= 50) return 'Умеренно';
  return 'Шумно';
}

export default function RouteStats({ route, poiList }: Props) {
  const { metrics } = route;
  const aqi = airQualityLabel(metrics.avgAirQualityIndex);
  const numberedStops = getNumberedRouteStops(route, poiList);

  return (
    <div className="glass-card animate-slide-up p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-sage-800">
            {route.name}
          </h2>
          <p className="text-sm text-sage-500">
            {new Date(route.createdAt).toLocaleString('ru-RU')}
          </p>
          {route.graphStats && (
            <p className="mt-1 text-xs text-sage-400">
              Dijkstra ·{' '}
              {route.routingSource === 'osrm'
                ? 'по дорогам и тропам (OSM)'
                : 'прямая линия (OSRM недоступен)'}{' '}
              · граф {route.graphStats.nodes} узлов, {route.graphStats.edges}{' '}
              рёбер
            </p>
          )}
        </div>
        <ScoreRing score={metrics.score} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard
          label="Дистанция"
          value={`${metrics.distanceKm} км`}
          sub={formatWalkingDuration(metrics.durationMin)}
        />
        <StatCard
          label="Природа"
          value={`${metrics.greenCoveragePercent}%`}
          sub="покрытие маршрута"
        />
        <StatCard
          label="Велодорожки"
          value={`${metrics.bikePathPercent}%`}
          sub="доля участков"
        />
        <StatCard
          label="AQI"
          value={String(metrics.avgAirQualityIndex)}
          sub={aqi.text}
          valueClass={aqi.color}
        />
      </div>

      <div className="mb-4 rounded-xl bg-sage-50/80 p-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-sage-500">
          Уровень шума
        </p>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-sage-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sage-400 to-blush-300"
              style={{ width: `${metrics.avgNoiseLevel}%` }}
            />
          </div>
          <span className="text-sm font-medium text-sage-700">
            {noiseLabel(metrics.avgNoiseLevel)}
          </span>
        </div>
      </div>

      {numberedStops.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sage-500">
            Точки маршрута
          </p>
          <ol className="space-y-1.5">
            {numberedStops.map((stop) => (
              <li
                key={stop.poi.id}
                className="flex items-center gap-2 text-sm text-sage-700"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-sage-400 bg-white text-[11px] font-bold text-sage-700">
                  {stop.number}
                </span>
                {stop.name}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  valueClass = 'text-sage-800',
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-sage-100 bg-white/60 p-3">
      <p className="text-xs text-sage-500">{label}</p>
      <p className={`font-display text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-xs text-sage-400">{sub}</p>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <svg className="-rotate-90" width="64" height="64">
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          stroke="rgba(134, 192, 149, 0.2)"
          strokeWidth="5"
        />
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#86c095" />
            <stop offset="100%" stopColor="#e88aa4" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute font-display text-lg font-bold text-sage-700">
        {score}
      </span>
    </div>
  );
}
