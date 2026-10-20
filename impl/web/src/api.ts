/**
 * API client r2 — theo "Hợp đồng API" trong MEGAPLAN_r2.md.
 *
 * - `VITE_MOCK=1` (hoặc `VITE_USE_MOCK=1`): đọc dữ liệu giả ở `src/dev/mock` (qa `w1:pM`).
 * - Bản dev: máy chủ chưa sẵn sàng thì rơi về dữ liệu giả để web vẫn chạy được.
 * - Bản build thật: chỉ gọi máy chủ, lỗi thì ném `ApiError` để trang hiện trạng thái lỗi.
 *
 * Nhóm B cần thêm hàm thì ghi vào `src/api-extra.ts` (theo phân vùng sửa).
 */
import { ApiError, redirectToLogin } from './api/client';

export { ApiError };

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu                                                        */
/* ------------------------------------------------------------------ */

export type AiStatus = 'pending' | 'done' | 'failed' | 'skipped';

export type MediaType = 'photo' | 'video';

export type CollectionKind =
  | 'trip'
  | 'birthday'
  | 'tet'
  | 'holiday'
  | 'weekend'
  | 'everyday'
  | 'baby'
  | 'other';

export type CollectionStatus = 'suggested' | 'accepted';

export interface MediaFlags {
  blurry: boolean;
  nearDuplicate: boolean;
  hidden: boolean;
}

export interface Media {
  id: string;
  type: MediaType;
  takenAt: string;
  place: string;
  country: string;
  lat: number | null;
  lon: number | null;
  caption: string;
  tags: string[];
  score: number;
  collectionId: string | null;
  width: number;
  height: number;
  url: { sm: string; lg: string; orig: string };
  flags: MediaFlags;
  aiStatus: AiStatus;
}

export interface Member {
  id: string;
  name: string;
  color: string;
}

export interface Collection {
  id: string;
  kind: CollectionKind;
  title: string;
  summary: string;
  place: string;
  startAt: string;
  endAt: string;
  status: CollectionStatus;
  cover: Media;
  count: number;
  members: Member[];
}

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
}

export interface Family {
  id: string;
  name: string;
  slug: string;
}

/** `GET /api/me` */
export interface Me {
  user: SessionUser;
  family: Family;
}

export interface HomeStats {
  photos: number;
  videos: number;
  places: number;
  collections: number;
}

export interface OnThisDay {
  yearsAgo: number;
  date: string;
  media: Media;
}

/** `GET /api/home` */
export interface Home {
  greeting: string;
  stats: HomeStats;
  recent: Media[];
  collections: Collection[];
  onThisDay: OnThisDay | null;
  mapPreview: { points: { lat: number; lon: number; count: number; cover: Media }[] };
}

export interface RecapStats {
  photos: number;
  videos: number;
  places: number;
  collections: number;
  birthdays: number;
  trips: number;
}

export interface RecapChapter {
  month: number;
  collection: Collection;
  highlights: Media[];
}

/** `GET /api/recap/:year` */
export interface Recap {
  year: number;
  intro: string;
  stats: RecapStats;
  chapters: RecapChapter[];
  topPlaces: { place: string; count: number }[];
}

export interface TimelineDay {
  date: string;
  collectionId: string | null;
  media: Media[];
}

export interface TimelineMonth {
  month: number;
  days: TimelineDay[];
}

/** `GET /api/timeline` */
export interface Timeline {
  months: TimelineMonth[];
  nextCursor: string | null;
}

export interface MapPoint {
  id: string;
  lat: number;
  lon: number;
  place: string;
  count: number;
  cover: Media;
  collectionId: string | null;
}

/** `GET /api/map` */
export interface MapData {
  points: MapPoint[];
}

export interface SearchFilters {
  from: string | null;
  to: string | null;
  places: string[];
  tags: string[];
  kinds: string[];
  members: string[];
}

/** `GET /api/search` */
export interface SearchResult {
  query: string;
  filters: SearchFilters;
  results: Media[];
  collections: Collection[];
}

/* ------------------------------------------------------------------ */
/* Cấu hình                                                            */
/* ------------------------------------------------------------------ */

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

function flag(value: unknown): boolean {
  const raw = value === undefined ? '' : String(value).trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/** Ép dùng dữ liệu giả, không gọi máy chủ. */
const FORCE_MOCK = flag(import.meta.env.VITE_MOCK) || flag(import.meta.env.VITE_USE_MOCK);
/** Được phép rơi về dữ liệu giả khi máy chủ không trả lời (chỉ ở bản dev). */
const MAY_FALLBACK = import.meta.env.DEV || FORCE_MOCK;

let mockModule: Promise<typeof import('./dev/mock/index')> | null = null;

/** Nạp dữ liệu giả kèm (nằm ở chunk riêng, không vào bundle chính). */
function loadMock(): Promise<typeof import('./dev/mock/index')> {
  mockModule ??= import('./dev/mock/index');
  return mockModule;
}

async function mockJson<T>(path: string, query?: Record<string, string>): Promise<T> {
  const mod = await loadMock();
  const body = mod.mockGet(path, query ?? {});
  if (body === null) throw new ApiError('not_found', 'Không tìm thấy dữ liệu cho mục này.');
  return body as T;
}

function withQuery(path: string, query?: Record<string, string>): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/* ------------------------------------------------------------------ */
/* GET                                                                 */
/* ------------------------------------------------------------------ */

async function apiGet<T>(path: string, query?: Record<string, string>): Promise<T> {
  if (FORCE_MOCK) return mockJson<T>(path, query);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${withQuery(path, query)}`, {
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
    });
  } catch {
    if (MAY_FALLBACK) return mockJson<T>(path, query);
    throw new ApiError('server', 'Không kết nối được máy chủ. Vui lòng thử lại.');
  }

  if (res.ok) {
    try {
      return (await res.json()) as T;
    } catch {
      if (MAY_FALLBACK) return mockJson<T>(path, query);
      throw new ApiError('server', 'Máy chủ trả dữ liệu không đọc được.');
    }
  }

  if (res.status === 401) {
    if (path !== '/api/me') redirectToLogin();
    throw new ApiError('private', 'Bạn cần đăng nhập để xem kỷ niệm của nhà mình.');
  }
  if (res.status === 403) {
    throw new ApiError('private', 'Mục này không thuộc gia đình bạn.');
  }
  if (res.status === 404) {
    if (MAY_FALLBACK && !API_BASE) return mockJson<T>(path, query);
    throw new ApiError('not_found', 'Không tìm thấy mục kỷ niệm này.');
  }
  throw new ApiError('server', 'Máy chủ gặp sự cố. Vui lòng thử lại sau.');
}

/* ------------------------------------------------------------------ */
/* Hàm theo hợp đồng                                                   */
/* ------------------------------------------------------------------ */

/** Người đang đăng nhập và gia đình của họ; `null` khi chưa đăng nhập. */
export async function fetchMe(): Promise<Me | null> {
  try {
    const data = await apiGet<Me>('/api/me');
    return data ?? null;
  } catch {
    return null;
  }
}

/** Trang chủ: lời chào, số liệu, ảnh mới, mục kỷ niệm, ngày này năm trước. */
export function fetchHome(): Promise<Home> {
  return apiGet<Home>('/api/home');
}

/** Tổng kết năm: mở bài, số liệu, chương theo tháng, nơi nhiều ảnh nhất. */
export function fetchRecap(year: number): Promise<Recap> {
  return apiGet<Recap>(`/api/recap/${encodeURIComponent(String(year))}`);
}

/** Danh sách mục kỷ niệm, lọc theo năm và loại. */
export async function fetchCollections(
  params: { year?: string; kind?: string } = {},
): Promise<Collection[]> {
  const list = await apiGet<Collection[]>('/api/collections', {
    ...(params.year ? { year: params.year } : {}),
    ...(params.kind ? { kind: params.kind } : {}),
  });
  return Array.isArray(list) ? list : [];
}

/** Dòng thời gian theo tháng, có con trỏ để tải tiếp. */
export async function fetchTimeline(
  params: { year?: string; cursor?: string } = {},
): Promise<Timeline> {
  const data = await apiGet<Timeline>('/api/timeline', {
    ...(params.year ? { year: params.year } : {}),
    ...(params.cursor ? { cursor: params.cursor } : {}),
  });
  return { months: data?.months ?? [], nextCursor: data?.nextCursor ?? null };
}

/** Các điểm trên bản đồ kỷ niệm. */
export async function fetchMapPoints(
  params: { year?: string; collectionId?: string } = {},
): Promise<MapPoint[]> {
  const data = await apiGet<MapData>('/api/map', {
    ...(params.year ? { year: params.year } : {}),
    ...(params.collectionId ? { collectionId: params.collectionId } : {}),
  });
  return data?.points ?? [];
}

/** Tìm ảnh bằng câu nói thường; máy chủ tự đổi câu thành bộ lọc. */
export async function fetchSearch(query: string, limit?: number): Promise<SearchResult> {
  const data = await apiGet<SearchResult>('/api/search', {
    q: query,
    ...(limit ? { limit: String(limit) } : {}),
  });
  return {
    query: data?.query ?? query,
    filters: data?.filters ?? {
      from: null,
      to: null,
      places: [],
      tags: [],
      kinds: [],
      members: [],
    },
    results: data?.results ?? [],
    collections: data?.collections ?? [],
  };
}

/* ------------------------------------------------------------------ */
/* Nhãn hiển thị                                                       */
/* ------------------------------------------------------------------ */

export const COLLECTION_KIND_LABELS: Record<CollectionKind, string> = {
  trip: 'Chuyến đi',
  birthday: 'Sinh nhật',
  tet: 'Tết',
  holiday: 'Ngày lễ',
  weekend: 'Cuối tuần',
  everyday: 'Ngày thường',
  baby: 'Năm đầu của bé',
  other: 'Kỷ niệm',
};

export function kindLabel(kind: string): string {
  return COLLECTION_KIND_LABELS[kind as CollectionKind] ?? 'Kỷ niệm';
}
