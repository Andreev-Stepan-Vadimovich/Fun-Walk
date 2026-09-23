import { useCallback, useEffect, useState } from 'react';
import { api } from './api/client';
import Header from './components/Header';
import MapView from './components/MapView';
import PreferencesPanel from './components/PreferencesPanel';
import RouteStats from './components/RouteStats';
import SavedRoutes from './components/SavedRoutes';
import {
  ROUTE_PRESETS,
  type LatLng,
  type PlannedRoute,
  type PointOfInterest,
  type PresetId,
  type RoutePreferences,
  type RouteSummary,
} from './types';

type SelectMode = 'start' | 'end' | null;

function samePoint(a: LatLng | null, b: LatLng | null): boolean {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

function App() {
  const [start, setStart] = useState<LatLng | null>(null);
  const [end, setEnd] = useState<LatLng | null>(null);
  const [preferences, setPreferences] = useState<RoutePreferences>(
    ROUTE_PRESETS.find((p) => p.id === 'peaceful')!.preferences,
  );
  const [activePresetId, setActivePresetId] = useState<PresetId | null>(
    'peaceful',
  );
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<RouteSummary[]>([]);
  const [poiList, setPoiList] = useState<PointOfInterest[]>([]);
  const [selectMode, setSelectMode] = useState<SelectMode>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getDefaults(), api.getRoutes()])
      .then(([defaults, routes]) => {
        setStart(defaults.start);
        setEnd(defaults.end);
        setSavedRoutes(routes);
      })
      .catch(() => setError('Не удалось подключиться к серверу. Запустите backend.'));
  }, []);

  useEffect(() => {
    if (!start || !end) return;
    api
      .getPoi(start, end)
      .then(setPoiList)
      .catch(() => undefined);
  }, [start, end]);

  useEffect(() => {
    if (!route || !start || !end) return;
    if (!samePoint(start, route.start) || !samePoint(end, route.end)) {
      setRoute(null);
    }
  }, [start, end, route]);

  const refreshSaved = useCallback(async () => {
    const routes = await api.getRoutes();
    setSavedRoutes(routes);
  }, []);

  const handlePlan = async () => {
    if (!start || !end) return;
    setLoading(true);
    setError(null);
    try {
      const planned = await api.planRoute({
        start,
        end,
        preferences,
        presetId: activePresetId ?? undefined,
      });
      setRoute(planned);
      await refreshSaved();
    } catch {
      setError('Ошибка при построении маршрута');
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = (point: LatLng) => {
    if (selectMode === 'start') {
      setStart(point);
      setSelectMode(null);
    } else if (selectMode === 'end') {
      setEnd(point);
      setSelectMode(null);
    }
  };

  const handleLoadRoute = async (id: string) => {
    try {
      const loaded = await api.getRoute(id);
      setRoute(loaded);
      setStart(loaded.start);
      setEnd(loaded.end);
      setPreferences(loaded.preferences);
      setActivePresetId(loaded.presetId ?? null);
    } catch {
      setError('Не удалось загрузить маршрут');
    }
  };

  const handleDeleteRoute = async (id: string) => {
    try {
      await api.deleteRoute(id);
      if (route?.id === id) setRoute(null);
      await refreshSaved();
    } catch {
      setError('Не удалось удалить маршрут');
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sage-100 via-cream-100 to-blush-50">
      <Header />

      <main className="mx-auto max-w-7xl px-4 pb-12 pt-6">
        {error && (
          <div className="mb-4 animate-slide-up rounded-xl border border-blush-200 bg-blush-50 px-4 py-3 text-sm text-blush-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <aside className="flex flex-col gap-5">
            <PreferencesPanel
              start={start}
              end={end}
              preferences={preferences}
              activePresetId={activePresetId}
              selectMode={selectMode}
              loading={loading}
              onPreferencesChange={(prefs) => {
                setPreferences(prefs);
                setActivePresetId('custom');
              }}
              onPresetChange={(id, prefs) => {
                setActivePresetId(id);
                setPreferences(prefs);
              }}
              onSelectModeChange={setSelectMode}
              onPlan={handlePlan}
            />
            {route && <RouteStats route={route} poiList={poiList} />}
            <SavedRoutes
              routes={savedRoutes}
              activeId={route?.id}
              onLoad={handleLoadRoute}
              onDelete={handleDeleteRoute}
            />
          </aside>

          <section className="animate-fade-in">
            <MapView
              start={start}
              end={end}
              route={route}
              poiList={poiList}
              selectMode={selectMode}
              onMapClick={handleMapClick}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
