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
  const onCoordinatesChangeRef = useRef(onCoordinatesChange);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    onCoordinatesChangeRef.current = onCoordinatesChange;
  }, [onCoordinatesChange]);

  useEffect(() => {
    let disposed = false;
    let instance: LeafletMap | null = null;
    void import('leaflet')
      .then((module) => {
        if (disposed || !host.current) return;
        const initialPoint = parseExplicitCoordinates(coordinates);
        const created = module
          .map(host.current, { scrollWheelZoom: false, zoomControl: false })
          .setView(
            initialPoint ? [initialPoint.latitude, initialPoint.longitude] : defaultCenter,
            initialPoint ? 15 : 12,
          );
        if (disposed) {
          created.remove();
          return;
        }
        instance = created;
        map.current = created;
        module
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
          })
          .on('tileerror', () => {
            if (!disposed) setUnavailable(true);
          })
          .addTo(created);
        created.on('click', (event) =>
          onCoordinatesChangeRef.current(
            `${event.latlng.lat.toFixed(6)}, ${event.latlng.lng.toFixed(6)}`,
          ),
        );
      })
      .catch(() => {
        if (!disposed) setUnavailable(true);
      });
    return () => {
      disposed = true;
      marker.current?.remove();
      marker.current = null;
      if (map.current === instance) map.current = null;
      instance?.off();
      instance?.remove();
    };
    // Map creation must occur only on dialog open; coordinate changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    let disposed = false;
    const point = parseExplicitCoordinates(coordinates);
    void import('leaflet')
      .then((module) => {
        if (disposed || map.current !== instance || !instance.getContainer().isConnected) return;
        if (!point) {
          marker.current?.remove();
          marker.current = null;
          return;
        }
        const position: [number, number] = [point.latitude, point.longitude];
        if (marker.current) marker.current.setLatLng(position);
        else marker.current = module.marker(position).addTo(instance);
        instance.setView(position, Math.max(instance.getZoom(), 15));
      })
      .catch(() => {
        if (!disposed && map.current === instance) setUnavailable(true);
      });
    return () => {
      disposed = true;
    };
  }, [coordinates]);

  function zoom(delta: number) {
    const instance = map.current;
    if (instance?.getContainer().isConnected) instance.setZoom(instance.getZoom() + delta);
  }
  function fullscreen() {
    void host.current?.requestFullscreen?.();
  }
  function layer() {
    setUnavailable(false);
    const instance = map.current;
    if (!instance?.getContainer().isConnected) return;
    instance.eachLayer((candidate) => {
      if ('setUrl' in candidate) {
        const tile = candidate as unknown as { setUrl: (url: string) => void };
        tile.setUrl('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
      }
    });
  }

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
      {unavailable ? (
        <p className="patient-map-fallback" role="status">
          Mapa no disponible. Puede ingresar coordenadas manualmente.
        </p>
      ) : (
        <p className="field-help">
          Haga clic en el mapa para colocar el marcador. Use Ctrl + desplazamiento para hacer zoom.
        </p>
      )}
    </section>
  );
}
