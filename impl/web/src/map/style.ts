import type { StyleSpecification } from 'maplibre-gl';

/** Ngói ảnh vệ tinh Esri + lớp nhãn tham chiếu (MEGAPLAN "Ngăn xếp"). */
export const ESRI_IMAGERY_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const ESRI_REFERENCE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const ESRI_ATTRIBUTION = 'Esri, Maxar, Earthstar Geographics';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: [ESRI_IMAGERY_TILES],
      tileSize: 256,
      attribution: ESRI_ATTRIBUTION,
    },
    esriLabels: {
      type: 'raster',
      tiles: [ESRI_REFERENCE_TILES],
      tileSize: 256,
      attribution: ESRI_ATTRIBUTION,
    },
  },
  layers: [
    { id: 'esri-imagery', type: 'raster', source: 'esri' },
    { id: 'esri-labels', type: 'raster', source: 'esriLabels' },
  ],
};

export const STREET_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [OSM_TILES],
      tileSize: 256,
      attribution: OSM_ATTRIBUTION,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export type MapStyleId = 'satellite' | 'street';

export const MAP_STYLE_LABELS: Record<MapStyleId, string> = {
  satellite: 'Vệ tinh',
  street: 'Bản đồ đường',
};

/**
 * Chọn kiểu bản đồ. Biến môi trường VITE_MAP_STYLE nhận:
 *  - "satellite" | "street"  → kiểu có sẵn
 *  - JSON bản đồ            → dùng trực tiếp
 *  - URL                    → dùng làm style URL
 */
export function resolveMapStyle(): StyleSpecification | string {
  const raw = (import.meta.env.VITE_MAP_STYLE ?? '').trim();
  if (!raw || raw === 'satellite') return SATELLITE_STYLE;
  if (raw === 'street') return STREET_STYLE;
  if (raw.startsWith('{')) {
    try {
      return JSON.parse(raw) as StyleSpecification;
    } catch {
      return SATELLITE_STYLE;
    }
  }
  return raw;
}
