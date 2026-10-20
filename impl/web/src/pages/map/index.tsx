/**
 * Bản đồ kỷ niệm `/ban-do` (F4) — dựng theo `design/proto/ban-do.html`.
 *
 * - MapLibre + ngói ảnh vệ tinh Esri, marker là ảnh bìa + số ảnh (ảnh điểm cao nhất làm bìa).
 * - Lọc theo năm / theo mục bằng chip, gọi lại `GET /api/map?year=&collectionId=`.
 * - Các nơi đứng sát nhau trên màn hình được gom thành một marker (như cụm "Hà Nội và quanh đó"
 *   của bản mẫu); phóng to thì tự tách ra từng nơi.
 * - Bấm điểm (hoặc dòng trong danh sách) mở thẻ ảnh, có nút sang mục kỷ niệm.
 * - Đủ trạng thái đang tải / rỗng / lỗi như bản mẫu.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Link } from 'react-router-dom';
import {
  ALL,
  clusterPoints,
  collectionsOnMap,
  loadMap,
  markerLabel,
  yearsOf,
  type Collection,
  type MapFilters,
  type MapMarker,
  type MapPoint,
} from '../../api-map';
import { fetchMapPoints } from '../../api';
import { PageState, RetryButton, type ViewState } from '../../layout/PageState';
import { CloseIcon } from '../../layout/Icons';
import { ESRI_IMAGERY_TILES, resolveMapStyle } from '../../map/style';
import './map-extra.css';

/** Kiểu bản mẫu: chỉ một lớp ảnh vệ tinh, không nhãn (đổi được bằng VITE_MAP_STYLE). */
function mapStyle() {
  const override = (import.meta.env.VITE_MAP_STYLE ?? '').trim();
  if (override) return resolveMapStyle();
  return {
    version: 8 as const,
    sources: {
      esri: { type: 'raster' as const, tileSize: 256, tiles: [ESRI_IMAGERY_TILES] },
    },
    layers: [{ id: 'esri-imagery', type: 'raster' as const, source: 'esri' }],
  };
}

/** Tên nơi hiển thị — cũng là khoá gộp "nơi" (theo `place`, không theo điểm ảnh). */
function placeLabel(point: MapPoint): string {
  return (point.place ?? '').trim() || 'Nơi chưa đặt tên';
}

/** Một nơi trong danh sách khung bên: gộp mọi điểm ảnh cùng `place`. */
export interface PlaceGroup {
  place: string;
  /** Tổng số ảnh của mọi điểm trong nơi này. */
  count: number;
  cover: MapPoint['cover'] | null;
  /** Điểm nhiều ảnh nhất — đại diện để bay tới khi bấm dòng. */
  point: MapPoint;
  /** Chỉ có khi mọi điểm của nơi thuộc đúng một mục. */
  collectionId: string | null;
  /** Số điểm ảnh (cụm) thuộc nơi này. */
  pointCount: number;
}

/**
 * Gom điểm ảnh thành NƠI theo tên `place`.
 *
 * Đây là nguồn duy nhất cho con số "N nơi" ở thanh thông báo và khung bên: `GET /api/map`
 * trả điểm gom theo mục + ô ~2 km (`mapPoints`), nên `points.length` là số ĐIỂM ẢNH chứ
 * không phải số nơi — trước đây khung bên in số điểm (18) còn thanh thông báo ghi số nơi (9).
 */
export function groupPlaces(points: MapPoint[]): PlaceGroup[] {
  const groups = new Map<
    string,
    Omit<PlaceGroup, 'collectionId'> & { collections: Set<string>; mixedCollection: boolean }
  >();
  for (const point of points) {
    const place = placeLabel(point);
    let group = groups.get(place);
    if (!group) {
      group = {
        place,
        count: 0,
        cover: null,
        point,
        pointCount: 0,
        collections: new Set<string>(),
        mixedCollection: false,
      };
      groups.set(place, group);
    }
    group.count += point.count;
    group.pointCount += 1;
    if (point.collectionId) group.collections.add(String(point.collectionId));
    else group.mixedCollection = true;
    if ((point.cover?.score ?? 0) > (group.cover?.score ?? 0)) group.cover = point.cover ?? null;
    if (point.count > group.point.count) group.point = point;
  }
  return [...groups.values()]
    .map((group) => ({
      place: group.place,
      count: group.count,
      cover: group.cover,
      point: group.point,
      pointCount: group.pointCount,
      collectionId:
        !group.mixedCollection && group.collections.size === 1
          ? [...group.collections][0] ?? null
          : null,
    }))
    .sort((a, b) => b.count - a.count || a.place.localeCompare(b.place, 'vi'));
}

/** Dòng trong danh sách → marker để mở thẻ ảnh (số ảnh là tổng của cả nơi). */
function asPlaceMarker(group: PlaceGroup): MapMarker {
  return {
    id: `n-${group.place}`,
    lat: group.point.lat,
    lon: group.point.lon,
    place: group.place,
    count: group.count,
    cover: group.cover ?? null,
    collectionId: group.collectionId,
    groupSize: 1,
    collectionCount: group.collectionId ? 1 : 0,
  };
}

export function MapPage() {
  const [state, setState] = useState<ViewState>('loading');
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [allPoints, setAllPoints] = useState<MapPoint[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [filters, setFilters] = useState<MapFilters>({ year: ALL, collectionId: ALL });
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState<MapMarker | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const pointsRef = useRef<MapPoint[]>([]);
  pointsRef.current = points;
  const markerClickRef = useRef<(marker: MapMarker) => void>(() => {});
  const skipFilterEffect = useRef(true);

  /* ---- tải dữ liệu ---- */

  const load = useCallback(() => {
    setState('loading');
    loadMap({ year: ALL, collectionId: ALL })
      .then(({ points: list, collections: cats }) => {
        setAllPoints(list);
        setPoints(list);
        setCollections(cats);
        setFilters({ year: ALL, collectionId: ALL });
        setState(list.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => setState('error'));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (skipFilterEffect.current) {
      skipFilterEffect.current = false;
      return undefined;
    }
    let alive = true;
    setRefreshing(true);
    fetchMapPoints({
      ...(filters.year !== ALL ? { year: filters.year } : {}),
      ...(filters.collectionId !== ALL ? { collectionId: filters.collectionId } : {}),
    })
      .then((list) => {
        if (!alive) return;
        setPoints(list);
        setActive(null);
      })
      .catch(() => {
        if (alive) setState('error');
      })
      .finally(() => {
        if (alive) setRefreshing(false);
      });
    return () => {
      alive = false;
    };
  }, [filters]);

  /* ---- bản đồ ---- */

  useEffect(() => {
    document.body.classList.add('mapbody');
    return () => document.body.classList.remove('mapbody');
  }, []);

  /** Vẽ lại marker: gom theo khoảng cách pixel ở mức phóng hiện tại. */
  const renderMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];

    const projected = pointsRef.current.map((point) => ({
      point,
      ...map.project([point.lon, point.lat]),
    }));

    for (const marker of clusterPoints(projected)) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'mk';
      if (marker.cover) {
        el.style.backgroundImage = `url("${marker.cover.url.sm}")`;
      } else {
        el.classList.add('mk-trong');
      }
      el.setAttribute('aria-label', `${marker.place}: ${marker.count} ảnh`);
      const badge = document.createElement('i');
      badge.textContent = marker.count.toLocaleString('vi-VN');
      el.append(badge);
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        markerClickRef.current(marker);
      });
      markersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([marker.lon, marker.lat])
          .addTo(map),
      );
    }
  }, []);

  useEffect(() => {
    if (state !== 'ready' || mapRef.current || !containerRef.current) return undefined;
    const mobile = window.innerWidth < 760;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle(),
      center: mobile ? [107.6, 17.2] : [106.3, 17.9],
      zoom: mobile ? 4.6 : 5.3,
      minZoom: 3,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('click', () => setActive(null));
    map.on('moveend', renderMarkers);
    mapRef.current = map;
    map.on('load', () => {
      // Điện thoại: thu khung để mọi điểm nằm phía trên tấm danh sách (bản mẫu để điểm
      // Đà Lạt/Nha Trang bị tấm danh sách che mất).
      if (mobile && pointsRef.current.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        for (const point of pointsRef.current) bounds.extend([point.lon, point.lat]);
        map.fitBounds(bounds, {
          padding: { top: 170, left: 24, right: 24, bottom: 340 },
          maxZoom: 6.5,
          duration: 0,
        });
      }
      renderMarkers();
    });
    renderMarkers();
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [state, renderMarkers]);

  useEffect(() => {
    renderMarkers();
  }, [points, renderMarkers, state]);

  const flyToMarker = useCallback((marker: MapMarker, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.flyTo({
      center: [marker.lon, marker.lat],
      zoom: zoom ?? (marker.groupSize > 1 ? Math.min(map.getZoom() + 2, 9) : 10),
      duration: reduce ? 0 : 1400,
    });
  }, []);

  const openMarker = useCallback((marker: MapMarker) => {
    setActive(marker);
    setPanelOpen(false);
  }, []);

  markerClickRef.current = (marker) => {
    if (marker.groupSize > 1) flyToMarker(marker);
    else openMarker(marker);
  };

  /* ---- bộ lọc ---- */

  const years = useMemo(() => yearsOf(collections), [collections]);
  const cats = useMemo(() => collectionsOnMap(collections, allPoints), [collections, allPoints]);
  const catTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const collection of collections) map.set(String(collection.id), collection.title);
    return map;
  }, [collections]);

  const setYear = (year: string) => {
    setFilters((current) => (current.year === year ? current : { ...current, year }));
  };
  const setCat = (collectionId: string) => {
    setFilters((current) =>
      current.collectionId === collectionId ? current : { ...current, collectionId },
    );
  };

  /** Danh sách nơi (gộp theo `place`) — cũng là nguồn của con số "N nơi". */
  const placeGroups = useMemo(() => groupPlaces(points), [points]);
  const placeCount = placeGroups.length;
  const activeTitle = active?.collectionId ? catTitles.get(String(active.collectionId)) ?? '' : '';

  /**
   * Thanh thông báo nằm ở `layout/AnnouncementBar` (ngoài vùng sửa của pane này, đang do
   * Z2P sửa) nên ở đây chỉ thay đúng con số trong câu của bản mẫu, giữ nguyên cấu trúc
   * phần tử (Z2P có thể bọc `<span>` để cắt chữ ở 390).
   */
  const bannerText = useMemo(() => {
    const scope = filters.year === ALL ? 'trong năm nay' : `trong năm ${filters.year}`;
    return `${placeCount.toLocaleString('vi-VN')} nơi nhà mình đã đến ${scope}`;
  }, [placeCount, filters.year]);

  useEffect(() => {
    if (state !== 'ready') return undefined;
    const bar = document.querySelector<HTMLElement>('.ann');
    if (!bar) return undefined;
    const walker = document.createTreeWalker(bar, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !/nơi nhà mình đã đến/i.test(node.nodeValue ?? '')) node = walker.nextNode();
    if (!node) return undefined;
    const before = node.nodeValue ?? '';
    node.nodeValue = bannerText;
    return () => {
      // Chỉ trả lại câu cũ nếu thanh vẫn đang hiện câu của mình (rời trang thì layout
      // đã đổi câu khác, không được ghi đè).
      if (node.nodeValue === bannerText) node.nodeValue = before;
    };
  }, [bannerText, state]);

  return (
    <main id="main">
      <div
        id="map"
        className="content"
        ref={containerRef}
        aria-label="Bản đồ vệ tinh các nơi nhà mình đã đến"
      />
      <PageState
        state={state}
        errorAction={<RetryButton onRetry={load} />}
        emptyTitle="Chưa có ảnh nào có vị trí"
        emptyText="Chụp ảnh khi bật định vị, hoặc tải ảnh có tọa độ lên. Nơi nào nhà mình đã đến sẽ hiện trên bản đồ."
        emptyAction={
          <Link className="btn dac" to="/tai-anh">
            Tải ảnh đầu tiên lên
          </Link>
        }
      >
        <aside
          className={`panel kinh content${panelOpen ? ' open' : ''}`}
          aria-label="Bộ lọc và danh sách nơi"
        >
          <button
            type="button"
            className="grab"
            aria-label="Kéo lên hoặc xuống để xem danh sách"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((open) => !open)}
          >
            <i />
          </button>
          <h1>Bản đồ kỷ niệm</h1>
          <p className="sub">
            <span>{placeCount.toLocaleString('vi-VN')} nơi</span> nhà mình đã đến
          </p>

          <div className="fg" role="group" aria-label="Lọc theo năm">
            <b>Năm</b>
            <div className="chips">
              <button
                type="button"
                className={`chip2${filters.year === ALL ? ' on' : ''}`}
                aria-pressed={filters.year === ALL}
                onClick={() => setYear(ALL)}
              >
                Tất cả
              </button>
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={`chip2${filters.year === year ? ' on' : ''}`}
                  aria-pressed={filters.year === year}
                  onClick={() => setYear(year)}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          <div className="fg" role="group" aria-label="Lọc theo mục">
            <b>Mục</b>
            <div className="chips">
              <button
                type="button"
                className={`chip2${filters.collectionId === ALL ? ' on' : ''}`}
                aria-pressed={filters.collectionId === ALL}
                onClick={() => setCat(ALL)}
              >
                Tất cả
              </button>
              {cats.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  className={`chip2${filters.collectionId === String(collection.id) ? ' on' : ''}`}
                  aria-pressed={filters.collectionId === String(collection.id)}
                  onClick={() => setCat(String(collection.id))}
                >
                  {collection.title}
                </button>
              ))}
            </div>
          </div>

          {refreshing ? (
            <p className="map-hint" role="status">
              Đang lọc…
            </p>
          ) : null}

          <ul className="places">
            {placeGroups.length === 0 ? (
              <li className="none">Không có nơi nào khớp bộ lọc này. Thử chọn “Tất cả”.</li>
            ) : (
              placeGroups.map((group) => {
                const title = group.collectionId
                  ? catTitles.get(String(group.collectionId)) ?? ''
                  : '';
                return (
                  <li key={group.place}>
                    <button
                      type="button"
                      onClick={() => {
                        const marker = asPlaceMarker(group);
                        openMarker(marker);
                        flyToMarker(marker, 10);
                      }}
                    >
                      {group.cover ? (
                        <img src={group.cover.url.sm} alt="" loading="lazy" />
                      ) : (
                        <span className="places-anh-trong" aria-hidden="true" />
                      )}
                      <span>
                        <b>{group.place}</b>
                        <small>
                          {group.count.toLocaleString('vi-VN')} ảnh
                          {title ? ` · ${title}` : ''}
                        </small>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <article className="viewer content" aria-live="polite" hidden={!active}>
          {active ? (
            <>
              <button
                type="button"
                className="x"
                aria-label="Đóng thẻ ảnh"
                onClick={() => setActive(null)}
              >
                <CloseIcon size={20} />
              </button>
              {active.cover ? (
                <img src={active.cover.url.lg} alt={`Ảnh tại ${active.place}`} />
              ) : null}
              <div>
                <h2>{active.place}</h2>
                <p>{markerLabel(active, activeTitle)}</p>
                {active.collectionId ? (
                  <Link className="btn dac nho" to={`/muc/${active.collectionId}`}>
                    Xem mục này
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}
        </article>

        <span className="credit content">Ảnh vệ tinh: Esri</span>
      </PageState>
    </main>
  );
}

export default MapPage;
