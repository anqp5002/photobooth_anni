import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { Step, Trip } from '../api/types';
import { decodePolyline } from '../map/polyline';
import { ESRI_ATTRIBUTION, OSM_ATTRIBUTION, STREET_STYLE, resolveMapStyle, type MapStyleId } from '../map/style';
import { MinusIcon, PlusIcon } from './Icons';
import { vehicleGlyphSvg } from './VehicleGlyph';

interface Cluster {
  lat: number;
  lon: number;
  steps: Step[];
}

function routeCollection(trip: Trip): FeatureCollection {
  const features = trip.segments.map((segment) => {
    const coords = decodePolyline(segment.polyline, 5).map(([lat, lon]) => [lon, lat]);
    return {
      type: 'Feature' as const,
      properties: { dash: segment.vehicle === 'plane' ? 1 : 0 },
      geometry: { type: 'LineString' as const, coordinates: coords },
    };
  });
  return { type: 'FeatureCollection', features };
}

function stepBounds(trip: Trip): maplibregl.LngLatBounds {
  const bounds = new maplibregl.LngLatBounds();
  for (const step of trip.steps) bounds.extend([step.location.lon, step.location.lat]);
  return bounds;
}

function computeClusters(map: maplibregl.Map, steps: Step[], threshold: number): Cluster[] {
  const groups: Cluster[] = [];
  for (const step of steps) {
    const point = map.project([step.location.lon, step.location.lat]);
    const found = groups.find((group) => {
      const gp = map.project([group.lon, group.lat]);
      return Math.hypot(point.x - gp.x, point.y - gp.y) < threshold;
    });
    if (found) found.steps.push(step);
    else groups.push({ lat: step.location.lat, lon: step.location.lon, steps: [step] });
  }
  return groups;
}

interface TripMapProps {
  trip: Trip;
  activeStepId: string | null;
  onMarkerClick?: (stepId: string) => void;
  styleKind?: MapStyleId;
  className?: string;
}

export function TripMap({ trip, activeStepId, onMarkerClick, styleKind = 'satellite', className }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const frameRef = useRef<number | null>(null);
  const activeRef = useRef<string | null>(activeStepId);
  const onMarkerClickRef = useRef(onMarkerClick);
  const tripRef = useRef(trip);

  activeRef.current = activeStepId;
  onMarkerClickRef.current = onMarkerClick;
  tripRef.current = trip;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const map = new maplibregl.Map({
      container,
      style: resolveMapStyle(),
      center: [105, 16],
      zoom: 1.4,
      minZoom: 1,
      maxZoom: 18,
      attributionControl: false,
    });
    mapRef.current = map;

    const drawRoute = (): boolean => {
      if (!map.isStyleLoaded()) return false;
      if (map.getSource('route')) return true;
      try {
        map.addSource('route', { type: 'geojson', data: routeCollection(tripRef.current) });
        map.addLayer({
          id: 'route-solid',
          type: 'line',
          source: 'route',
          filter: ['==', ['get', 'dash'], 0],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 3, 'line-opacity': 0.95 },
        });
        map.addLayer({
          id: 'route-dashed',
          type: 'line',
          source: 'route',
          filter: ['==', ['get', 'dash'], 1],
          layout: { 'line-cap': 'butt', 'line-join': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': 3,
            'line-opacity': 0.95,
            'line-dasharray': [2, 2],
          },
        });
        return true;
      } catch {
        return false;
      }
    };

    let lastSignature = '';

    const renderMarkers = () => {
      const currentTrip = tripRef.current;
      const groups = computeClusters(map, currentTrip.steps, 44);
      const signature = `${groups.map((g) => g.steps.map((s) => s.id).join('|')).join('/')}#${activeRef.current ?? ''}`;
      if (signature === lastSignature) return;
      lastSignature = signature;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      for (const group of groups) {
        const first = group.steps[0];
        const isActive = group.steps.some((step) => step.id === activeRef.current);
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `map-marker${group.steps.length > 1 ? ' is-cluster' : ''}${isActive ? ' is-active' : ''}`;
        el.setAttribute(
          'aria-label',
          group.steps.length > 1 ? `${group.steps.length} chặng gần nhau` : `Chặng ${first.location.name}`,
        );

        const img = document.createElement('img');
        img.src = first.media[0]?.sm ?? '';
        img.alt = '';
        el.appendChild(img);

        if (group.steps.length > 1) {
          const badge = document.createElement('span');
          badge.className = 'map-marker-count';
          badge.textContent = String(group.steps.length);
          el.appendChild(badge);
        }

        el.addEventListener('click', () => {
          if (group.steps.length > 1) {
            map.easeTo({
              center: [group.lon, group.lat],
              zoom: Math.min(map.getZoom() + 3, 12),
              duration: 500,
            });
            return;
          }
          onMarkerClickRef.current?.(first.id);
        });

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([group.lon, group.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }

      for (const segment of currentTrip.segments) {
        const coords = decodePolyline(segment.polyline, 5);
        if (coords.length === 0) continue;
        const mid = coords[Math.floor(coords.length / 2)];
        const el = document.createElement('span');
        el.className = 'map-vehicle';
        el.title = segment.vehicle;
        el.innerHTML = vehicleGlyphSvg(segment.vehicle, 15);
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([mid[1], mid[0]])
          .addTo(map);
        markersRef.current.push(marker);
      }
    };

    map.on('load', () => {
      drawRoute();
      renderMarkers();
      map.fitBounds(stepBounds(tripRef.current), { padding: 60, duration: 0, maxZoom: 6 });
    });

    map.on('styledata', () => {
      if (drawRoute()) renderMarkers();
    });

    const onMove = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        renderMarkers();
      });
    };
    map.on('move', onMove);
    map.on('zoomend', onMove);

    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(styleKind === 'street' ? STREET_STYLE : resolveMapStyle());
  }, [styleKind]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeStepId) return;
    const step = trip.steps.find((item) => item.id === activeStepId);
    if (!step) return;
    map.easeTo({
      center: [step.location.lon, step.location.lat],
      duration: 600,
      essential: true,
    });
    const bounds = stepBounds(trip);
    map.once('moveend', () => {
      const view = map.getBounds();
      const allInside = trip.steps.every((item) =>
        view.contains([item.location.lon, item.location.lat]),
      );
      if (!allInside) {
        map.fitBounds(bounds, { padding: 60, duration: 500, maxZoom: 6 });
      }
    });
  }, [activeStepId, trip]);

  return (
    <div className={`map-wrap ${className ?? ''}`}>
      <div className="map-canvas" ref={containerRef} />
      <div className="map-zoom">
        <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Phóng to">
          <PlusIcon size={18} />
        </button>
        <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Thu nhỏ">
          <MinusIcon size={18} />
        </button>
      </div>
      <p className="map-attribution">
        {styleKind === 'street' ? `Bản đồ đường: ${OSM_ATTRIBUTION}` : `Ảnh vệ tinh: ${ESRI_ATTRIBUTION}`}
      </p>
    </div>
  );
}
