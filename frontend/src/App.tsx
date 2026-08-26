import { useCallback, useEffect, useState } from 'react';
import { api } from './api/client';
import Header from './components/Header';
import MapView from './components/MapView';
import PreferencesPanel from './components/PreferencesPanel';
import RouteStats from './components/RouteStats';
import SavedRoutes from './components/SavedRoutes';
import {
  DEFAULT_PREFERENCES,
  type LatLng,
  type PlannedRoute,
  type PointOfInterest,
  type RoutePreferences,
  type RouteSummary,
} from './types';

type SelectMode = 'start' | 'end' | null;

function App() {
  const [start, setStart] = useState<LatLng | null>(null);
  const [end, setEnd] = useState<LatLng | null>(null);
  const [preferences, setPreferences] =
    useState<RoutePreferences>(DEFAULT_PREFERENCES);
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<RouteSummary[]>([]);
  const [poiList, setPoiList] = useState<PointOfInterest[]>([]);
  const [selectMode, setSelectMode] = useState<SelectMode>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getDefaults(), api.getPoi(), api.getRoutes()])
      .then(([defaults, poi, routes]) => {
        setStart(defaults.start);
        setEnd(defaults.end);
        setPoiList(poi);
        setSavedRoutes(routes);
      })
      .catch(() => setError('Не удалось подключиться к серверу. Запустите backend.'));
  }, []);

  const refreshSaved = useCallback(async () => {
    const routes = await api.getRoutes();
    setSavedRoutes(routes);
  }, []);

  const handlePlan = async () => {
    if (!start || !end) return;
    setLoading(true);
    setError(null);
    try {
      const planned = await api.planRoute({ start, end, preferences });
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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-forest-800/40 via-forest-950 to-forest-950">
      <Header />

      <main className="mx-auto max-w-7xl px-4 pb-12 pt-6">
        {error && (
          <div className="mb-4 animate-slide-up rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <aside className="flex flex-col gap-5">
            <PreferencesPanel
              start={start}
              end={end}
              preferences={preferences}
              selectMode={selectMode}
              loading={loading}
              onPreferencesChange={setPreferences}
              onSelectModeChange={setSelectMode}
              onPlan={handlePlan}
            />
            {route && <RouteStats route={route} />}
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
