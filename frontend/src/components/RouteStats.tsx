import type { PlannedRoute } from '../types';

interface Props {
  route: PlannedRoute;
}

function airQualityLabel(aqi: number): { text: string; color: string } {
  if (aqi <= 40) return { text: 'Отлично', color: 'text-emerald-400' };
  if (aqi <= 55) return { text: 'Хорошо', color: 'text-lime-400' };
  if (aqi <= 70) return { text: 'Умеренно', color: 'text-yellow-400' };
  return { text: 'Плохо', color: 'text-orange-400' };
}

function noiseLabel(level: number): string {
  if (level <= 35) return 'Тихо';
  if (level <= 50) return 'Умеренно';
  return 'Шумно';
}

export default function RouteStats({ route }: Props) {
  const { metrics, highlights } = route;
  const aqi = airQualityLabel(metrics.avgAirQualityIndex);

  return (
    <div className="glass-card animate-slide-up p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">
            {route.name}
          </h2>
          <p className="text-sm text-forest-400">
            {new Date(route.createdAt).toLocaleString('ru-RU')}
          </p>
          {route.graphStats && (
            <p className="mt-1 text-xs text-forest-500">
              Dijkstra · граф {route.graphStats.nodes} узлов,{' '}
              {route.graphStats.edges} рёбер · вес{' '}
              {route.graphStats.pathWeight}
            </p>
          )}
        </div>
        <ScoreRing score={metrics.score} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard
          label="Дистанция"
          value={`${metrics.distanceKm} км`}
          sub={`~${metrics.durationMin} мин пешком`}
        />
        <StatCard
          label="Зелёные зоны"
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

      <div className="mb-4 rounded-xl bg-forest-900/50 p-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-forest-400">
          Уровень шума
        </p>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-forest-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-yellow-500"
              style={{ width: `${metrics.avgNoiseLevel}%` }}
            />
          </div>
          <span className="text-sm font-medium text-forest-200">
            {noiseLabel(metrics.avgNoiseLevel)}
          </span>
        </div>
      </div>

      {highlights.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-forest-400">
            Точки маршрута
          </p>
          <ul className="space-y-1.5">
            {highlights.map((name) => (
              <li
                key={name}
                className="flex items-center gap-2 text-sm text-forest-200"
              >
                <span className="text-forest-500">●</span>
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  valueClass = 'text-white',
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-forest-900/40 p-3">
      <p className="text-xs text-forest-400">{label}</p>
      <p className={`font-display text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-xs text-forest-500">{sub}</p>
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
          stroke="rgba(255,255,255,0.08)"
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
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#84cc16" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute font-display text-lg font-bold text-white">
        {score}
      </span>
    </div>
  );
}
