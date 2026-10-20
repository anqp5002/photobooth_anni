import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import { ESRI_ATTRIBUTION, ESRI_IMAGERY_TILES } from '../../map/style';

/**
 * Bản đồ nhỏ trong trang mục (giống `#mini` của `design/proto/muc.html`):
 * ảnh vệ tinh Esri, tuyến nét đứt vàng, marker tròn là ảnh thu nhỏ.
 */
export interface MiniPoint {
  lat: number;
  lon: number;
  cover?: string;
  label?: string;
}

interface MiniMapProps {
  points: MiniPoint[];
  route: { lat: number; lon: number }[];
  className?: string;
}

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: [ESRI_IMAGERY_TILES],
      tileSize: 256,
      attribution: ESRI_ATTRIBUTION,
    },
  },
  layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
};

function lineData(route: { lat: number; lon: number }[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: route.map((p) => [p.lon, p.lat]),
    },
  };
}

export function MiniMap({ points, route, className }: MiniMapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;

    const map = new maplibregl.Map({
      container: box,
      style: STYLE,
      attributionControl: false,
      center: [points[0]?.lon ?? 106, points[0]?.lat ?? 16],
      zoom: 10,
      cooperativeGestures: true,
      dragRotate: false,
    });
    mapRef.current = map;

    // Thêm tuyến + marker sau khi bản đồ sẵn sàng; huỷ nếu component đã gỡ.
    map.on('load', () => {
      if (route.length > 1) {
        map.addSource('route', { type: 'geojson', data: lineData(route) });
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': '#FBD784',
            'line-width': 4,
            'line-dasharray': [2, 1.5],
          },
        });
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // Marker và tuyến được cập nhật ở effect dưới; tạo bản đồ một lần.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const p of points) {
      const el = document.createElement('div');
      el.className = 'mk';
      if (p.cover) el.style.backgroundImage = `url("${p.cover}")`;
      if (p.label) el.title = p.label;
      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map));
    }

    const bounds = new maplibregl.LngLatBounds();
    for (const p of [...route, ...points]) bounds.extend([p.lon, p.lat]);
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 64, duration: 0, maxZoom: 13 });
    }
  }, [points, route]);

  return <div ref={boxRef} className={className ?? 'mini'} />;
}
