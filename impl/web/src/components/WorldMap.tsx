import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { resolveMapStyle } from '../map/style';

export interface VisitedPlace {
  name: string;
  lat: number;
  lon: number;
  country: string;
}

/** Bản đồ thế giới các nơi đã đến — SPEC R-012. */
export function WorldMap({ places }: { places: VisitedPlace[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const map = new maplibregl.Map({
      container,
      style: resolveMapStyle(),
      center: [12, 22],
      zoom: 1.1,
      minZoom: 0.6,
      maxZoom: 12,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on('load', () => {
      const bounds = new maplibregl.LngLatBounds([-170, -58], [180, 76]);
      map.fitBounds(bounds, { padding: 20, duration: 0 });

      for (const place of places) {
        const el = document.createElement('span');
        el.className = 'world-pin';
        el.title = `${place.name} — ${place.country}`;
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([place.lon, place.lat])
          .addTo(map);
        void marker;
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [places]);

  return (
    <div className="world-map">
      <div className="map-canvas" ref={containerRef} />
      <p className="map-attribution">Ảnh vệ tinh: Esri, Maxar, Earthstar Geographics</p>
    </div>
  );
}
