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

interface Props {
  start: LatLng | null;
  end: LatLng | null;
  route: PlannedRoute | null;
  poiList: PointOfInterest[];
  selectMode: 'start' | 'end' | null;
  onMapClick: (point: LatLng) => void;
}

const MOSCOW_CENTER: [number, number] = [55.7558, 37.6173];

const startIcon = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:white;">A</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const endIcon = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#f43f5e,#e11d48);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:white;">B</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

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

function FitBounds({ route }: { route: PlannedRoute | null }) {
  const map = useMap();

  useEffect(() => {
    if (route && route.waypoints.length > 0) {
      const bounds = L.latLngBounds(
        route.waypoints.map((w) => [w.lat, w.lng] as [number, number]),
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
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

  const cursorClass = selectMode ? 'cursor-crosshair' : '';

  return (
    <div className={`glass-card overflow-hidden p-1 ${cursorClass}`}>
      <div className="relative">
        <MapContainer
          center={MOSCOW_CENTER}
          zoom={13}
          className="h-[520px] w-full rounded-xl lg:h-[calc(100vh-140px)] lg:min-h-[520px]"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler selectMode={selectMode} onMapClick={onMapClick} />
          <FitBounds route={route} />

          {poiList.map((poi) => (
            <CircleMarker
              key={poi.id}
              center={[poi.location.lat, poi.location.lng]}
              radius={6}
              pathOptions={{
                color: POI_TYPE_COLORS[poi.type],
                fillColor: POI_TYPE_COLORS[poi.type],
                fillOpacity: 0.7,
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
          ))}

          {start && (
            <Marker position={[start.lat, start.lng]} icon={startIcon}>
              <Popup>Старт маршрута</Popup>
            </Marker>
          )}

          {end && (
            <Marker position={[end.lat, end.lng]} icon={endIcon}>
              <Popup>Финиш маршрута</Popup>
            </Marker>
          )}

          {polylinePositions.length > 1 && (
            <>
              <Polyline
                positions={polylinePositions}
                pathOptions={{
                  color: '#22c55e',
                  weight: 5,
                  opacity: 0.85,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              <Polyline
                positions={polylinePositions}
                pathOptions={{
                  color: '#86efac',
                  weight: 10,
                  opacity: 0.25,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </>
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
    { color: POI_TYPE_COLORS.green_zone, label: 'Зелёная зона' },
    { color: POI_TYPE_COLORS.bike_path, label: 'Велодорожка' },
    { color: POI_TYPE_COLORS.waterfront, label: 'Набережная' },
  ];

  return (
    <div className="absolute bottom-4 left-4 z-[1000] rounded-xl border border-white/10 bg-forest-950/90 px-3 py-2 backdrop-blur-md">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-forest-400">
        Легенда
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1.5 text-xs text-forest-200"
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
