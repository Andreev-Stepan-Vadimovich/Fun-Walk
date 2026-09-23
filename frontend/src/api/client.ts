import type {
  LatLng,
  PlannedRoute,
  PointOfInterest,
  PresetId,
  RoutePreferences,
  RouteSummary,
} from '../types';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  getDefaults: () =>
    request<{ start: LatLng; end: LatLng }>('/defaults'),

  getPoi: (start?: LatLng | null, end?: LatLng | null) => {
    if (start && end) {
      const params = new URLSearchParams({
        startLat: String(start.lat),
        startLng: String(start.lng),
        endLat: String(end.lat),
        endLng: String(end.lng),
      });
      return request<PointOfInterest[]>(`/poi?${params.toString()}`);
    }
    return request<PointOfInterest[]>('/poi');
  },

  getRoutes: () => request<RouteSummary[]>('/routes'),

  getRoute: (id: string) => request<PlannedRoute>(`/routes/${id}`),

  planRoute: (data: {
    start: LatLng;
    end: LatLng;
    preferences: RoutePreferences;
    presetId?: PresetId;
    name?: string;
  }) =>
    request<PlannedRoute>('/routes/plan', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteRoute: (id: string) =>
    request<{ deleted: boolean }>(`/routes/${id}`, { method: 'DELETE' }),
};
