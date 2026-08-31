'use client';

import type { Map as LeafletMap, Marker } from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { parseExplicitCoordinates } from '@/lib/patient-form';

type Props = { coordinates: string; onCoordinatesChange: (coordinates: string) => void };
const defaultCenter: [number, number] = [13.6929, -89.2182];

export default function PatientLocationMap({ coordinates, onCoordinatesChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const point = parseExplicitCoordinates(coordinates);

  useEffect(() => {
    let cancelled = false;
    let Leaflet: typeof import('leaflet') | undefined;
    void import('leaflet')
      .then((module) => {
        if (cancelled || !host.current) return;
        Leaflet = module;
        const instance = module
          .map(host.current, { scrollWheelZoom: false, zoomControl: false })
          .setView(point ? [point.latitude, point.longitude] : defaultCenter, point ? 15 : 12);
        map.current = instance;
        module
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
          })
          .on('tileerror', () => setUnavailable(true))
          .addTo(instance);
        instance.on('click', (event) =>
          onCoordinatesChange(`${event.latlng.lat.toFixed(6)}, ${event.latlng.lng.toFixed(6)}`),
        );
      })
      .catch(() => setUnavailable(true));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
      void Leaflet;
    };
    // Map creation must occur only on dialog open; coordinate changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current) return;
    void import('leaflet').then((module) => {
      if (!map.current) return;
      if (!point) {
        marker.current?.remove();
        marker.current = null;
        return;
      }
      const position: [number, number] = [point.latitude, point.longitude];
      if (marker.current) marker.current.setLatLng(position);
      else marker.current = module.marker(position).addTo(map.current);
      map.current.setView(position, Math.max(map.current.getZoom(), 15));
    });
  }, [coordinates, point]);

  function zoom(delta: number) {
    const instance = map.current;
    if (instance) instance.setZoom(instance.getZoom() + delta);
  }
  function fullscreen() {
    void host.current?.requestFullscreen?.();
  }
  function layer() {
    setUnavailable(false);
    map.current?.eachLayer((candidate) => {
      if ('setUrl' in candidate) {
        const tile = candidate as unknown as { setUrl: (url: string) => void };
        tile.setUrl('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
      }
    });
  }

  if (unavailable)
    return (
      <div className="patient-map-fallback" role="status">
        Mapa no disponible. Puede ingresar coordenadas manualmente.
      </div>
    );
  return (
    <section aria-label="Mapa de ubicación" className="patient-map-shell">
      <div className="patient-map-controls">
        <button
          aria-label="Acercar mapa"
          data-action-id="PATIENT-MAP-ZOOM-IN"
          onClick={() => zoom(1)}
          type="button"
        >
          +
        </button>
        <button
          aria-label="Alejar mapa"
          data-action-id="PATIENT-MAP-ZOOM-OUT"
          onClick={() => zoom(-1)}
          type="button"
        >
          −
        </button>
        <button
          aria-label="Cambiar capa del mapa"
          data-action-id="PATIENT-MAP-LAYER"
          onClick={layer}
          type="button"
        >
          Map / Satellite
        </button>
        <button
          aria-label="Pantalla completa del mapa"
          data-action-id="PATIENT-MAP-FULLSCREEN"
          onClick={fullscreen}
          type="button"
        >
          ⛶
        </button>
      </div>
      <div className="patient-map" data-action-id="PATIENT-MAP-MARKER" ref={host} />
      <p className="field-help">
        Haga clic en el mapa para colocar el marcador. Use Ctrl + desplazamiento para hacer zoom.
      </p>
    </section>
  );
}
