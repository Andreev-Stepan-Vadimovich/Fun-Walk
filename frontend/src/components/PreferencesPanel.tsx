import type { LatLng, RoutePreferences } from '../types';

interface Props {
  start: LatLng | null;
  end: LatLng | null;
  preferences: RoutePreferences;
  selectMode: 'start' | 'end' | null;
  loading: boolean;
  onPreferencesChange: (prefs: RoutePreferences) => void;
  onSelectModeChange: (mode: 'start' | 'end' | null) => void;
  onPlan: () => void;
}

const PREF_ITEMS: {
  key: keyof RoutePreferences;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    key: 'parks',
    label: 'Парки',
    icon: '🌳',
    description: 'Маршрут через парковые зоны',
  },
  {
    key: 'greenZones',
    label: 'Зелёные зоны',
    icon: '🌿',
    description: 'Бульвары, скверы, аллеи',
  },
  {
    key: 'bikePaths',
    label: 'Велодорожки',
    icon: '🚴',
    description: 'Участки с велосипедной инфраструктурой',
  },
  {
    key: 'airQuality',
    label: 'Качество воздуха',
    icon: '💨',
    description: 'Приоритет зон с низким AQI',
  },
  {
    key: 'quietAreas',
    label: 'Тихие места',
    icon: '🤫',
    description: 'Минимальный уровень шума',
  },
  {
    key: 'waterfront',
    label: 'Набережные',
    icon: '🌊',
    description: 'Маршрут вдоль воды',
  },
];

function formatCoord(point: LatLng | null): string {
  if (!point) return '—';
  return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
}

export default function PreferencesPanel({
  start,
  end,
  preferences,
  selectMode,
  loading,
  onPreferencesChange,
  onSelectModeChange,
  onPlan,
}: Props) {
  const updatePref = (key: keyof RoutePreferences, value: number) => {
    onPreferencesChange({ ...preferences, [key]: value });
  };

  return (
    <div className="glass-card animate-slide-up p-5">
      <h2 className="mb-1 font-display text-lg font-semibold text-white">
        Параметры маршрута
      </h2>
      <p className="mb-5 text-sm text-forest-300">
        Настройте приоритеты — алгоритм подберёт оптимальный путь
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <PointButton
          label="Старт"
          color="from-emerald-500 to-green-600"
          coords={formatCoord(start)}
          active={selectMode === 'start'}
          onClick={() =>
            onSelectModeChange(selectMode === 'start' ? null : 'start')
          }
        />
        <PointButton
          label="Финиш"
          color="from-rose-500 to-red-600"
          coords={formatCoord(end)}
          active={selectMode === 'end'}
          onClick={() =>
            onSelectModeChange(selectMode === 'end' ? null : 'end')
          }
        />
      </div>

      {selectMode && (
        <p className="mb-4 rounded-lg bg-forest-500/10 px-3 py-2 text-xs text-forest-200">
          Кликните на карте, чтобы установить точку{' '}
          {selectMode === 'start' ? 'старта' : 'финиша'}
        </p>
      )}

      <div className="space-y-4">
        {PREF_ITEMS.map((item) => (
          <div key={item.key}>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-forest-100">
                <span>{item.icon}</span>
                {item.label}
              </label>
              <span className="rounded-md bg-forest-800/80 px-2 py-0.5 text-xs font-semibold text-forest-300">
                {preferences[item.key]}/10
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={preferences[item.key]}
              onChange={(e) => updatePref(item.key, Number(e.target.value))}
              className="pref-slider"
            />
            <p className="mt-0.5 text-xs text-forest-400">{item.description}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn-primary mt-6 w-full"
        disabled={!start || !end || loading}
        onClick={onPlan}
      >
        {loading ? (
          <>
            <Spinner />
            Строим маршрут…
          </>
        ) : (
          <>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            Построить маршрут
          </>
        )}
      </button>
    </div>
  );
}

function PointButton({
  label,
  color,
  coords,
  active,
  onClick,
}: {
  label: string;
  color: string;
  coords: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        active
          ? 'border-forest-400 bg-forest-500/15 ring-1 ring-forest-400/50'
          : 'border-white/10 bg-white/5 hover:bg-white/10'
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-r ${color}`}
        />
        <span className="text-xs font-semibold uppercase tracking-wide text-forest-300">
          {label}
        </span>
      </div>
      <p className="truncate font-mono text-xs text-forest-200">{coords}</p>
    </button>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
