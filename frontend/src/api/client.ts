import type {
  LatLng,
  PlannedRoute,
  PointOfInterest,
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

  getPoi: () => request<PointOfInterest[]>('/poi'),

  getRoutes: () => request<RouteSummary[]>('/routes'),

  getRoute: (id: string) => request<PlannedRoute>(`/routes/${id}`),

  planRoute: (data: {
    start: LatLng;
    end: LatLng;
    preferences: RoutePreferences;
    name?: string;
  }) =>
    request<PlannedRoute>('/routes/plan', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteRoute: (id: string) =>
    request<{ deleted: boolean }>(`/routes/${id}`, { method: 'DELETE' }),
};
