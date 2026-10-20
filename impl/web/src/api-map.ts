/**
 * API + tiện ích riêng cho trang bản đồ `/ban-do` (F4).
 *
 * `GET /api/map` trả `points[]` (mỗi điểm = một cụm ảnh có toạ độ, `cover` là MỘT Media đầy đủ).
 * `GET /api/collections` dùng để dựng chip lọc năm / lọc mục và lấy tên mục.
 */
import { fetchCollections, fetchMapPoints, type Collection, type MapPoint } from './api';

export type { Collection, MapPoint };

/** Điểm đã gộp để vẽ marker: gộp các điểm sát nhau khi phóng to chưa đủ. */
export interface MapMarker {
  /** `p-<n>` cho điểm lẻ, `g-<n>` cho cụm gộp. */
  id: string;
  lat: number;
  lon: number;
  place: string;
  count: number;
  cover: MapPoint['cover'] | null;
  /** Chỉ có khi cụm chỉ chứa điểm của đúng một mục. */
  collectionId: string | null;
  /** Số điểm gốc trong marker (1 = không gộp). */
  groupSize: number;
  /** Số mục khác nhau trong cụm gộp. */
  collectionCount: number;
}

export interface MapFilters {
  year: string;
  collectionId: string;
}

export const ALL = 'all';

/** Điểm đã chiếu lên màn hình (toạ độ pixel) để gom cụm. */
export interface ProjectedPoint {
  point: MapPoint;
  x: number;
  y: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Khoảng cách tối thiểu giữa hai marker (px) — nhỏ hơn thì gộp thành một cụm. */
export const CLUSTER_PX = 36;

/**
 * Gom các điểm đứng gần nhau trên màn hình thành một marker (như cụm "Hà Nội và quanh đó"
 * của bản mẫu). Chạy trên toạ độ pixel của MapLibre nên tự tách ra khi phóng to.
 */
export function clusterPoints(projected: ProjectedPoint[], threshold = CLUSTER_PX): MapMarker[] {
  const used = new Array<boolean>(projected.length).fill(false);
  const clusters: MapPoint[][] = [];

  for (let i = 0; i < projected.length; i += 1) {
    if (used[i]) continue;
    used[i] = true;
    const group = [projected[i].point];
    for (let j = i + 1; j < projected.length; j += 1) {
      if (used[j]) continue;
      const dx = projected[i].x - projected[j].x;
      const dy = projected[i].y - projected[j].y;
      if (Math.hypot(dx, dy) <= threshold) {
        used[j] = true;
        group.push(projected[j].point);
      }
    }
    clusters.push(group);
  }

  return clusters.map((group, index) => {
    const collections = new Set(
      group.map((point) => point.collectionId).filter((id): id is string => Boolean(id)),
    );
    const cover =
      [...group].sort((a, b) => (b.cover?.score ?? 0) - (a.cover?.score ?? 0))[0]?.cover ?? null;
    const first = group[0];
    return {
      id: group.length === 1 ? `p-${first.id}` : `g-${index + 1}-${group.length}`,
      lat: round1(group.reduce((sum, point) => sum + point.lat, 0) / group.length),
      lon: round1(group.reduce((sum, point) => sum + point.lon, 0) / group.length),
      place:
        group.length === 1
          ? first.place ?? 'Nơi chưa đặt tên'
          : `${group.length} nơi quanh ${first.place ?? 'đây'}`,
      count: group.reduce((sum, point) => sum + point.count, 0),
      cover,
      collectionId: collections.size === 1 ? [...collections][0] ?? null : null,
      groupSize: group.length,
      collectionCount: collections.size,
    };
  });
}

/** Năm có dữ liệu (từ mục kỷ niệm), mới nhất trước. */
export function yearsOf(collections: Collection[]): string[] {
  const years = new Set<string>();
  for (const collection of collections) {
    const year = String(collection.startAt ?? '').slice(0, 4);
    if (/^\d{4}$/.test(year)) years.add(year);
    const endYear = String(collection.endAt ?? '').slice(0, 4);
    if (/^\d{4}$/.test(endYear)) years.add(endYear);
  }
  return [...years].sort((a, b) => b.localeCompare(a));
}

/** Mục có ít nhất một điểm trên bản đồ, nhiều ảnh trước — dùng cho chip "Mục". */
export function collectionsOnMap(collections: Collection[], points: MapPoint[]): Collection[] {
  const used = new Map<string, number>();
  for (const point of points) {
    if (!point.collectionId) continue;
    const id = String(point.collectionId);
    used.set(id, (used.get(id) ?? 0) + point.count);
  }
  return collections
    .filter((collection) => used.has(String(collection.id)))
    .sort((a, b) => (used.get(String(b.id)) ?? 0) - (used.get(String(a.id)) ?? 0));
}

/** Tải dữ liệu trang bản đồ: điểm theo bộ lọc + toàn bộ mục (để dựng chip). */
export async function loadMap(filters: MapFilters): Promise<{ points: MapPoint[]; collections: Collection[] }> {
  const [points, collections] = await Promise.all([
    fetchMapPoints({
      ...(filters.year !== ALL ? { year: filters.year } : {}),
      ...(filters.collectionId !== ALL ? { collectionId: filters.collectionId } : {}),
    }),
    fetchCollections(),
  ]);
  return { points, collections };
}

/** Nhãn phụ của một điểm: số ảnh + tên mục (nếu có). */
export function markerLabel(marker: MapMarker, title: string): string {
  const photos = `${marker.count.toLocaleString('vi-VN')} ảnh`;
  if (marker.groupSize > 1) return `${marker.groupSize} nơi · ${photos}`;
  if (title) return `${photos} · ${title}`;
  return photos;
}
