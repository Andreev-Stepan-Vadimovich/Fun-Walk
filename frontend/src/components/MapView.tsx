import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import type { LatLng, PlannedRoute, PointOfInterest } from '../types';
import { POI_TYPE_COLORS, POI_TYPE_LABELS } from '../types';
import { getNumberedRouteStops } from '../utils/routeStops';

interface Props {
  start: LatLng | null;
  end: LatLng | null;
  route: PlannedRoute | null;
  poiList: PointOfInterest[];
  selectMode: 'start' | 'end' | null;
  onMapClick: (point: LatLng) => void;
}

const YAROSLAVL_CENTER: [number, number] = [57.6225, 39.896];

const startIcon = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#86c095,#6aab7a);border:3px solid white;box-shadow:0 2px 8px rgba(82,143,98,0.35);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:white;">A</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const endIcon = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#e88aa4,#d96a88);border:3px solid white;box-shadow:0 2px 8px rgba(217,106,136,0.35);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:white;">B</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function numberedStopIcon(n: number): L.DivIcon {
  return L.divIcon({
    className: 'route-stop-icon',
    html: `<div style="width:26px;height:26px;border-radius:50%;background:#fff;border:2.5px solid #6aab7a;box-shadow:0 2px 8px rgba(82,143,98,0.4);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#375c42;font-family:Inter,system-ui,sans-serif;">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function MapClickHandler({
  selectMode,
  onMapClick,
}: {
  selectMode: 'start' | 'end' | null;
  onMapClick: (point: LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (selectMode) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

function FitBounds({
  route,
  start,
  end,
}: {
  route: PlannedRoute | null;
  start: LatLng | null;
  end: LatLng | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (route && route.waypoints.length > 0) {
      const bounds = L.latLngBounds(
        route.waypoints.map((w) => [w.lat, w.lng] as [number, number]),
      );
      map.fitBounds(bounds, { padding: [50, 50] });
      return;
    }

    const points: [number, number][] = [];
    if (start) points.push([start.lat, start.lng]);
    if (end) points.push([end.lat, end.lng]);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 15 });
  }, [route, map]);

  return null;
}

export default function MapView({
  start,
  end,
  route,
  poiList,
  selectMode,
  onMapClick,
}: Props) {
  const polylinePositions = useMemo(() => {
    if (!route) return [];
    return route.waypoints.map((w) => [w.lat, w.lng] as [number, number]);
  }, [route]);

  const numberedStops = useMemo(
    () => (route ? getNumberedRouteStops(route, poiList) : []),
    [route, poiList],
  );

  const numberedIds = useMemo(
    () => new Set(numberedStops.map((stop) => stop.poi.id)),
    [numberedStops],
  );

  const cursorClass = selectMode ? 'cursor-crosshair' : '';

  return (
    <div className={`glass-card overflow-hidden p-1 ${cursorClass}`}>
      <div className="relative">
        <MapContainer
          center={YAROSLAVL_CENTER}
          zoom={14}
          className="h-[520px] w-full rounded-xl lg:h-[calc(100vh-140px)] lg:min-h-[520px]"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler selectMode={selectMode} onMapClick={onMapClick} />
          <FitBounds route={route} start={start} end={end} />

          {polylinePositions.length > 1 && (
            <>
              <Polyline
                positions={polylinePositions}
                pathOptions={{
                  color: '#f3adc0',
                  weight: 10,
                  opacity: 0.25,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              <Polyline
                positions={polylinePositions}
                pathOptions={{
                  color: '#6aab7a',
                  weight: 5,
                  opacity: 0.9,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </>
          )}

          {poiList.map((poi) =>
            numberedIds.has(poi.id) ? null : (
            <CircleMarker
              key={poi.id}
              center={[poi.location.lat, poi.location.lng]}
              radius={6}
              pathOptions={{
                color: POI_TYPE_COLORS[poi.type],
                fillColor: POI_TYPE_COLORS[poi.type],
                fillOpacity: 0.75,
                weight: 2,
              }}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <p className="font-semibold">{poi.name}</p>
                  <p className="text-xs opacity-80">
                    {POI_TYPE_LABELS[poi.type]}
                  </p>
                  <p className="mt-1 text-xs">
                    AQI: {poi.airQualityIndex} · Шум: {poi.noiseLevel} dB
                  </p>
                </div>
              </Popup>
            </CircleMarker>
            ),
          )}

          {numberedStops.map((stop) => (
            <Marker
              key={`stop-${stop.number}-${stop.poi.id}`}
              position={[stop.location.lat, stop.location.lng]}
              icon={numberedStopIcon(stop.number)}
              zIndexOffset={600 + stop.number}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <p className="font-semibold">
                    {stop.number}. {stop.name}
                  </p>
                  <p className="text-xs opacity-80">
                    {POI_TYPE_LABELS[stop.poi.type]}
                  </p>
                  <p className="mt-1 text-xs">
                    AQI: {stop.poi.airQualityIndex} · Шум: {stop.poi.noiseLevel}{' '}
                    dB
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

          {start && (
            <Marker position={[start.lat, start.lng]} icon={startIcon} zIndexOffset={900}>
              <Popup>Старт маршрута</Popup>
            </Marker>
          )}

          {end && (
            <Marker position={[end.lat, end.lng]} icon={endIcon} zIndexOffset={900}>
              <Popup>Финиш маршрута</Popup>
            </Marker>
          )}
        </MapContainer>

        <Legend />
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { color: POI_TYPE_COLORS.park, label: 'Парк' },
    { color: POI_TYPE_COLORS.green_zone, label: 'Сквер' },
    { color: POI_TYPE_COLORS.bike_path, label: 'Велодорожка' },
    { color: POI_TYPE_COLORS.waterfront, label: 'Набережная' },
  ];

  return (
    <div className="absolute bottom-4 left-4 z-[1000] rounded-xl border border-sage-200/80 bg-white/90 px-3 py-2 shadow-card backdrop-blur-md">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sage-500">
        Легенда
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1.5 text-xs text-sage-700"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
