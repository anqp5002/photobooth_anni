/**
 * Dữ liệu giả đúng hợp đồng API r2 (MEGAPLAN_r2.md → "Hợp đồng API").
 *
 * Mục đích: web (cmd / coder-2) làm tiếp mà không phải chờ server. Khi `VITE_MOCK=1`,
 * `src/api.ts` gọi `mockGet(path, query)` ở đây thay vì gọi máy chủ.
 *
 * Mọi thứ trong thư mục này là dữ liệu MẪU của gia đình "Nhà Bin & Su" năm 2026,
 * dùng đúng 27 ảnh CC0 ở `design/proto/assets/photos/` (nguồn: design/proto/CREDITS.md).
 * URL ảnh trỏ tới `/proto-photos/<tên>.jpg` — xem README.md để biết web phục vụ thế nào.
 *
 * Sinh lại dữ liệu: `node impl/web/src/dev/mock/_gen.mjs`
 */

import meJson from './me.json';
import homeJson from './home.json';
import recap2026Json from './recap-2026.json';
import collectionsJson from './collections.json';
import collectionTetQueNoiJson from './collection-tet-que-noi.json';
import collectionBinTronMotTuoiJson from './collection-bin-tron-mot-tuoi.json';
import collectionSinhNhatSuJson from './collection-sinh-nhat-su.json';
import collectionHeDaLatJson from './collection-he-da-lat.json';
import collectionBienNhaTrangJson from './collection-bien-nha-trang.json';
import collectionCuoiTuanOHaJson from './collection-cuoi-tuan-o-nha.json';
import collectionGiangSinhVoiBaJson from './collection-giang-sinh-voi-ba.json';
import timeline2026Json from './timeline-2026.json';
import mapJson from './map.json';
import searchSinhNhatSuNamNayJson from './search-anh-sinh-nhat-su-nam-nay.json';
import searchDiBienThang8Json from './search-di-bien-thang-8.json';
import searchTetOQueJson from './search-tet-o-que.json';
import searchAnhCoBanhKemJson from './search-anh-co-banh-kem.json';
import searchEmptyJson from './search-empty.json';
import mediaStatusJson from './media-status.json';
import membersJson from './members.json';

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu (bám sát hợp đồng API r2)                             */
/* ------------------------------------------------------------------ */

export type MockAiStatus = 'pending' | 'done' | 'failed' | 'skipped';

export interface MockFlags {
  blurry: boolean;
  nearDuplicate: boolean;
  hidden: boolean;
}

export interface MockMedia {
  id: string;
  type: 'photo' | 'video';
  takenAt: string;
  place: string;
  country: string;
  lat: number;
  lon: number;
  caption: string;
  tags: string[];
  score: number;
  collectionId: string | null;
  width: number;
  height: number;
  url: { sm: string; lg: string; orig: string };
  flags: MockFlags;
  aiStatus: MockAiStatus;
}

export interface MockMember {
  id: string;
  name: string;
  color: string;
}

export type MockCollectionKind =
  | 'trip'
  | 'birthday'
  | 'tet'
  | 'holiday'
  | 'weekend'
  | 'everyday'
  | 'baby'
  | 'other';

export interface MockCollection {
  id: string;
  kind: MockCollectionKind;
  title: string;
  summary: string;
  place: string;
  startAt: string;
  endAt: string;
  status: 'suggested' | 'accepted';
  cover: MockMedia;
  count: number;
  members: MockMember[];
}

export interface MockSuggestion {
  id: string;
  type: 'hide_blurry' | 'merge' | 'split' | 'rename';
  text: string;
  payload: Record<string, unknown>;
}

export interface MockCollectionDetail extends MockCollection {
  days: { date: string; media: MockMedia[] }[];
  route: { lat: number; lon: number }[];
  suggestions: MockSuggestion[];
}

export interface MockMe {
  user: { id: string; username: string; displayName: string; avatarColor: string };
  family: { id: string; name: string; slug: string };
}

export interface MockHome {
  greeting: string;
  stats: { photos: number; videos: number; places: number; collections: number };
  recent: MockMedia[];
  collections: MockCollection[];
  onThisDay: { yearsAgo: number; date: string; media: MockMedia } | null;
  mapPreview: { points: { lat: number; lon: number; count: number; cover: MockMedia }[] };
}

export interface MockRecap {
  year: number;
  intro: string;
  stats: {
    photos: number;
    videos: number;
    places: number;
    collections: number;
    birthdays: number;
    trips: number;
  };
  chapters: { month: number; collection: MockCollection; highlights: MockMedia[] }[];
  topPlaces: { place: string; count: number }[];
}

export interface MockTimeline {
  months: {
    month: number;
    days: { date: string; collectionId: string | null; media: MockMedia[] }[];
  }[];
  nextCursor: string | null;
}

export interface MockMap {
  points: {
    id: string;
    lat: number;
    lon: number;
    place: string;
    count: number;
    cover: MockMedia;
    collectionId: string | null;
  }[];
}

export interface MockSearch {
  query: string;
  filters: {
    from: string | null;
    to: string | null;
    places: string[];
    tags: string[];
    kinds: string[];
    members: string[];
  };
  results: MockMedia[];
  collections: MockCollection[];
}

export interface MockMediaStatus {
  id: string;
  aiStatus: MockAiStatus;
  caption: string;
  collectionId: string | null;
}

/* ------------------------------------------------------------------ */
/* Dữ liệu                                                              */
/* ------------------------------------------------------------------ */

export const me = meJson as unknown as MockMe;
export const home = homeJson as unknown as MockHome;
export const recap2026 = recap2026Json as unknown as MockRecap;
export const collections = collectionsJson as unknown as MockCollection[];
export const timeline2026 = timeline2026Json as unknown as MockTimeline;
export const mapData = mapJson as unknown as MockMap;
export const searchEmpty = searchEmptyJson as unknown as MockSearch;
export const mediaStatus = mediaStatusJson as unknown as MockMediaStatus[];
export const members = membersJson as unknown as MockMember[];

/** Chi tiết từng mục, khóa là id mục. */
export const collectionDetails: Record<string, MockCollectionDetail> = {
  'tet-que-noi': collectionTetQueNoiJson as unknown as MockCollectionDetail,
  'bin-tron-mot-tuoi': collectionBinTronMotTuoiJson as unknown as MockCollectionDetail,
  'sinh-nhat-su': collectionSinhNhatSuJson as unknown as MockCollectionDetail,
  'he-da-lat': collectionHeDaLatJson as unknown as MockCollectionDetail,
  'bien-nha-trang': collectionBienNhaTrangJson as unknown as MockCollectionDetail,
  'cuoi-tuan-o-nha': collectionCuoiTuanOHaJson as unknown as MockCollectionDetail,
  'giang-sinh-voi-ba': collectionGiangSinhVoiBaJson as unknown as MockCollectionDetail,
};

/** Kết quả tìm kiếm mẫu, khóa là slug của câu hỏi. */
export const searchResults: Record<string, MockSearch> = {
  'anh-sinh-nhat-su-nam-nay': searchSinhNhatSuNamNayJson as unknown as MockSearch,
  'di-bien-thang-8': searchDiBienThang8Json as unknown as MockSearch,
  'tet-o-que': searchTetOQueJson as unknown as MockSearch,
  'anh-co-banh-kem': searchAnhCoBanhKemJson as unknown as MockSearch,
};

/** File JSON ứng với từng GET trong hợp đồng. */
export const MOCK_FILES: Record<string, string> = {
  'GET /api/me': 'me.json',
  'GET /api/home': 'home.json',
  'GET /api/recap/:year': 'recap-2026.json',
  'GET /api/collections': 'collections.json',
  'GET /api/collections/:id': 'collection-<id>.json',
  'GET /api/timeline': 'timeline-2026.json',
  'GET /api/map': 'map.json',
  'GET /api/search': 'search-<slug>.json',
  'GET /api/media/status': 'media-status.json',
  'GET /api/members': 'members.json',
};

/** Bốn câu tìm kiếm mẫu trong MEGAPLAN_r2.md (mọi câu khác → search-empty.json). */
export const MOCK_SEARCH_QUERIES = [
  'ảnh sinh nhật Su năm nay',
  'đi biển tháng 8',
  'Tết ở quê',
  'ảnh có bánh kem',
];

/* ------------------------------------------------------------------ */
/* Tra cứu                                                              */
/* ------------------------------------------------------------------ */

/** Bỏ dấu + gọn, dùng làm slug cho câu hỏi tìm kiếm. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseQuery(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const idx = pair.indexOf('=');
    const key = decodeURIComponent((idx === -1 ? pair : pair.slice(0, idx)).replace(/\+/g, ' '));
    const value = idx === -1 ? '' : decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '));
    out[key] = value;
  }
  return out;
}

function collectionByKind(year: string | undefined, kind: string | undefined): MockCollection[] {
  let list = collections;
  if (year) list = list.filter((c) => c.startAt.startsWith(year) || c.endAt.startsWith(year));
  if (kind && kind !== 'all') list = list.filter((c) => c.kind === kind);
  return list;
}

function mapPoints(year: string | undefined, collectionId: string | undefined): MockMap['points'] {
  let points = mapData.points;
  if (collectionId && collectionId !== 'all') {
    points = points.filter((p) => p.collectionId === collectionId);
  }
  if (year && year !== 'all') {
    const ids = new Set(
      collections.filter((c) => c.startAt.startsWith(year) || c.endAt.startsWith(year)).map((c) => c.id),
    );
    points = points.filter((p) => p.collectionId === null || ids.has(p.collectionId));
  }
  return points;
}

function statusByIds(ids: string | undefined): MockMediaStatus[] {
  if (!ids) return mediaStatus;
  const wanted = ids.split(',').map((s) => s.trim()).filter(Boolean);
  return mediaStatus.filter((s) => wanted.includes(s.id));
}

/**
 * Trả dữ liệu giả cho một GET. `path` có thể kèm query (`/api/search?q=...`).
 * Trả `null` nếu không có dữ liệu (web nên hiện trạng thái rỗng).
 */
export function mockGet(path: string, query: Record<string, string> = {}): unknown {
  const [rawPath = '', rawQuery = ''] = path.split('?');
  const q = { ...parseQuery(rawQuery), ...query };
  const p = rawPath.replace(/\/+$/, '') || '/';

  if (p === '/api/me') return me;
  if (p === '/api/home') return home;
  if (p === '/api/members') return members;
  if (p === '/api/media/status') return statusByIds(q.ids);
  if (p === '/api/map') return { points: mapPoints(q.year, q.collectionId) };
  if (p === '/api/timeline') return timeline2026;
  if (p === '/api/collections') return collectionByKind(q.year, q.kind);
  if (p === '/api/search') {
    const slug = slugify(q.q ?? '');
    return searchResults[slug] ?? searchEmpty;
  }
  if (/^\/api\/recap\/\d{4}$/.test(p)) {
    return p === '/api/recap/2026' ? recap2026 : null;
  }
  const collectionMatch = /^\/api\/collections\/([^/]+)$/.exec(p);
  if (collectionMatch) return collectionDetails[collectionMatch[1]] ?? null;
  return null;
}

/** Giống `mockGet` nhưng trả kèm mã HTTP, tiện cho `fetch` giả. */
export function mockFetch(
  method: string,
  path: string,
  query: Record<string, string> = {},
): { status: number; body: unknown } {
  if (method.toUpperCase() !== 'GET') {
    return { status: 405, body: { error: 'Mock chỉ phục vụ các GET trong hợp đồng API.' } };
  }
  const body = mockGet(path, query);
  if (body === null) return { status: 404, body: { error: `Không có dữ liệu mock cho ${path}.` } };
  return { status: 200, body };
}

export default {
  me,
  home,
  recap2026,
  collections,
  collectionDetails,
  timeline2026,
  mapData,
  searchResults,
  searchEmpty,
  mediaStatus,
  members,
  mockGet,
  mockFetch,
};
