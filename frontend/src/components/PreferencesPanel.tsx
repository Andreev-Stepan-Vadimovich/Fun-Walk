import { useState } from 'react';
import type { LatLng, PresetId, RoutePreferences } from '../types';
import { ROUTE_PRESETS } from '../types';

interface Props {
  start: LatLng | null;
  end: LatLng | null;
  preferences: RoutePreferences;
  activePresetId: PresetId | null;
  selectMode: 'start' | 'end' | null;
  loading: boolean;
  onPreferencesChange: (prefs: RoutePreferences) => void;
  onPresetChange: (presetId: PresetId, prefs: RoutePreferences) => void;
  onSelectModeChange: (mode: 'start' | 'end' | null) => void;
  onPlan: () => void;
}

const FILTER_ITEMS: {
  key: keyof RoutePreferences;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    key: 'nature',
    label: 'Природа',
    icon: '🌳',
    description: 'Парки, скверы, бульвары',
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
  activePresetId,
  selectMode,
  loading,
  onPreferencesChange,
  onPresetChange,
  onSelectModeChange,
  onPlan,
}: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const updatePref = (key: keyof RoutePreferences, value: number) => {
    onPreferencesChange({ ...preferences, [key]: value });
  };

  const applyPreset = (preset: (typeof ROUTE_PRESETS)[number]) => {
    onPresetChange(preset.id as PresetId, preset.preferences);
    setFiltersOpen(false);
  };

  return (
    <div className="glass-card animate-slide-up p-5">
      <h2 className="mb-1 font-display text-lg font-semibold text-sage-800">
        Сценарий прогулки
      </h2>
      <p className="mb-4 text-sm text-sage-600">
        Выберите настроение — или настройте фильтры вручную
      </p>

      <div className="mb-5 grid grid-cols-2 gap-2.5">
        {ROUTE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset)}
            className={`preset-btn ${
              activePresetId === preset.id ? 'preset-btn-active' : ''
            }`}
          >
            <span className="mb-1 text-xl">{preset.emoji}</span>
            <span className="text-sm font-semibold text-sage-800">
              {preset.name}
            </span>
            <span className="mt-0.5 text-xs leading-tight text-sage-500">
              {preset.description}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <PointButton
          label="Старт"
          accent="sage"
          coords={formatCoord(start)}
          active={selectMode === 'start'}
          onClick={() =>
            onSelectModeChange(selectMode === 'start' ? null : 'start')
          }
        />
        <PointButton
          label="Финиш"
          accent="blush"
          coords={formatCoord(end)}
          active={selectMode === 'end'}
          onClick={() =>
            onSelectModeChange(selectMode === 'end' ? null : 'end')
          }
        />
      </div>

      {selectMode && (
        <p className="mb-4 rounded-lg bg-sage-50 px-3 py-2 text-xs text-sage-700">
          Кликните на карте, чтобы установить точку{' '}
          {selectMode === 'start' ? 'старта' : 'финиша'}
        </p>
      )}

      <div className="mb-5 rounded-xl border border-sage-200/80 bg-sage-50/50">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-sage-800">
              Тонкая настройка
            </p>
            <p className="text-xs text-sage-500">
              {activePresetId
                ? 'Сценарий выбран — можно подкрутить фильтры'
                : 'Свои приоритеты по каждому критерию'}
            </p>
          </div>
          <svg
            className={`h-5 w-5 text-sage-500 transition ${filtersOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {filtersOpen && (
          <div className="space-y-4 border-t border-sage-200/60 px-4 pb-4 pt-3">
            {FILTER_ITEMS.map((item) => (
              <div key={item.key}>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium text-sage-700">
                    <span>{item.icon}</span>
                    {item.label}
                  </label>
                  <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-sage-600 shadow-sm">
                    {preferences[item.key]}/10
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={preferences[item.key]}
                  onChange={(e) =>
                    updatePref(item.key, Number(e.target.value))
                  }
                  className="pref-slider"
                />
                <p className="mt-0.5 text-xs text-sage-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn-primary w-full"
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
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
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
  accent,
  coords,
  active,
  onClick,
}: {
  label: string;
  accent: 'sage' | 'blush';
  coords: string;
  active: boolean;
  onClick: () => void;
}) {
  const dotColor =
    accent === 'sage'
      ? 'bg-gradient-to-r from-sage-400 to-sage-500'
      : 'bg-gradient-to-r from-blush-300 to-blush-400';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        active
          ? 'border-sage-400 bg-sage-50 ring-2 ring-sage-300/40'
          : 'border-sage-200/80 bg-white/60 hover:bg-sage-50/60'
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor}`} />
        <span className="text-xs font-semibold uppercase tracking-wide text-sage-600">
          {label}
        </span>
      </div>
      <p className="truncate font-mono text-xs text-sage-700">{coords}</p>
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