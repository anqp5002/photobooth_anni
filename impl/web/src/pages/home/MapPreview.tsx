import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import type { Home } from '../../api';
import { ESRI_ATTRIBUTION, ESRI_IMAGERY_TILES } from '../../map/style';

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

/** Thẻ "lối vào bản đồ" có bản đồ nhỏ — chép theo `design/proto/index.html`. */
export function MapPreview({ points }: { points: Home['mapPreview']['points'] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return undefined;

    const map = new maplibregl.Map({
      container: element,
      interactive: false,
      attributionControl: false,
      center: [108.2, 16.2],
      zoom: 4.2,
      style: STYLE,
    });

    for (const point of points) {
      const marker = document.createElement('div');
      marker.className = 'mk';
      marker.style.backgroundImage = `url(${point.cover.url.sm})`;
      new maplibregl.Marker({ element: marker }).setLngLat([point.lon, point.lat]).addTo(map);
    }

    return () => {
      map.remove();
    };
  }, [points]);

  return (
    <section className="sec content" id="ban-do">
      <div className="wrap">
        <Link className="mapcard" to="/ban-do" aria-label="Mở bản đồ kỷ niệm">
          <div className="mini" ref={container} aria-hidden="true" />
          <div className="mapcard-t kinh">
            <h2>{points.length} nơi nhà mình đã đến</h2>
            <p>Ảnh có tọa độ tự lên bản đồ. Bấm vào để đi lại từng chuyến.</p>
            <span className="btn dac">Mở bản đồ kỷ niệm</span>
          </div>
          <span className="credit">Ảnh vệ tinh: Esri</span>
        </Link>
      </div>
    </section>
  );
}
