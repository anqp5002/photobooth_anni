/**
 * Hàm API mà nhóm B cần nhưng `src/api.ts` (vùng của cmd `w1:pP`) chưa có.
 * Giữ đúng "Hợp đồng API" trong MEGAPLAN_r2.md; ai thêm hàm chung thì chuyển sang `src/api.ts` sau.
 *
 * - Có `VITE_MOCK=1` (hoặc `VITE_USE_MOCK=1`): đọc dữ liệu giả ở `src/dev/mock` (qa `w1:pM`).
 * - Chạy dev mà máy chủ chưa sẵn sàng: thử API thật trước, lỗi mạng thì rơi về dữ liệu giả.
 * - Bản build thật: chỉ gọi API, lỗi thì ném `ApiError` để trang hiện trạng thái lỗi.
 *
 * Route ghi (`PATCH`/`POST`) chưa có trong mock: khi chạy bằng mock, hàm trả `{saved:false}`
 * để trang tự cập nhật cục bộ (bản xem trước) thay vì báo lỗi.
 */
import { ApiError, redirectToLogin } from './api/client';

export { ApiError };

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu theo hợp đồng r2                                       */
/* ------------------------------------------------------------------ */

export type CollectionKind =
  | 'trip'
  | 'birthday'
  | 'tet'
  | 'holiday'
  | 'weekend'
  | 'everyday'
  | 'baby'
  | 'other';

export type AiStatus = 'pending' | 'done' | 'failed' | 'skipped';

export interface MediaFlags {
  blurry: boolean;
  nearDuplicate: boolean;
  hidden: boolean;
}

export interface Media {
  id: string;
  type: 'photo' | 'video';
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
  status: 'suggested' | 'accepted';
  cover: Media;
  count: number;
  members: Member[];
}

export type SuggestionType = 'hide_blurry' | 'merge' | 'split' | 'rename';

export interface Suggestion {
  id: string;
  type: SuggestionType;
  text: string;
  payload: Record<string, unknown>;
}

export interface CollectionDay {
  date: string;
  media: Media[];
}

export interface CollectionDetail extends Collection {
  days: CollectionDay[];
  route: { lat: number; lon: number }[];
  suggestions: Suggestion[];
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

export interface CollectionPatch {
  title?: string;
  summary?: string;
  kind?: CollectionKind;
  status?: 'suggested' | 'accepted';
  memberIds?: string[];
}

/** Kết quả một lệnh ghi: `saved=false` nghĩa là chỉ đổi ở trình duyệt (mock/chưa có máy chủ). */
export interface WriteResult {
  saved: boolean;
}

/* ------------------------------------------------------------------ */
/* Cấu hình môi trường                                                 */
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

  if (res.status === 404) {
    if (MAY_FALLBACK && !API_BASE) return mockJson<T>(path, query);
    throw new ApiError('not_found', 'Không tìm thấy mục kỷ niệm này.');
  }
  if (res.status === 401) {
    if (path !== '/api/me') redirectToLogin();
    throw new ApiError('private', 'Bạn cần đăng nhập để xem kỷ niệm của nhà mình.');
  }
  if (res.status === 403) {
    throw new ApiError('private', 'Mục này không thuộc gia đình bạn.');
  }
  throw new ApiError('server', 'Máy chủ gặp sự cố. Vui lòng thử lại sau.');
}

/** Một mục kỷ niệm kèm các ngày, tuyến đi và gợi ý của AI. */
export function fetchCollection(id: string): Promise<CollectionDetail> {
  return apiGet<CollectionDetail>(`/api/collections/${encodeURIComponent(id)}`);
}

/** Danh sách mục (dùng cho hộp "gộp mục" và chip lọc). */
export async function fetchCollections(params: { year?: string; kind?: string } = {}): Promise<
  Collection[]
> {
  const list = await apiGet<Collection[]>('/api/collections', {
    ...(params.year ? { year: params.year } : {}),
    ...(params.kind ? { kind: params.kind } : {}),
  });
  return Array.isArray(list) ? list : [];
}

/** Người trong nhà để gắn vào ảnh/mục. */
export async function fetchMembers(): Promise<Member[]> {
  const list = await apiGet<Member[]>('/api/members');
  return Array.isArray(list) ? list : [];
}

/** Điểm trên bản đồ của một mục (dùng cho bản đồ nhỏ nếu mục không trả `route`). */
export async function fetchMapPoints(collectionId: string): Promise<MapPoint[]> {
  const data = await apiGet<{ points: MapPoint[] }>('/api/map', { collectionId });
  return data?.points ?? [];
}

/* ------------------------------------------------------------------ */
/* Ghi                                                                 */
/* ------------------------------------------------------------------ */

async function apiWrite(
  path: string,
  method: 'PATCH' | 'POST',
  body?: unknown,
): Promise<WriteResult> {
  if (FORCE_MOCK) return { saved: false };
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return { saved: true };
    if (res.status === 401) {
      throw new ApiError('private', 'Phiên đăng nhập đã hết, đăng nhập lại rồi thử lại.');
    }
    throw new ApiError('server', 'Máy chủ chưa lưu được thay đổi này.');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (MAY_FALLBACK) return { saved: false };
    throw new ApiError('server', 'Không kết nối được máy chủ. Vui lòng thử lại.');
  }
}

/** `PATCH /api/collections/:id` — đổi tên, tóm tắt, loại, trạng thái, người có mặt. */
export function patchCollection(id: string, patch: CollectionPatch): Promise<WriteResult> {
  return apiWrite(`/api/collections/${encodeURIComponent(id)}`, 'PATCH', patch);
}

/** `POST /api/collections/:id/merge` — gộp mục này vào `intoId`. */
export function mergeCollection(id: string, intoId: string): Promise<WriteResult> {
  return apiWrite(`/api/collections/${encodeURIComponent(id)}/merge`, 'POST', { intoId });
}

/** `POST /api/collections/:id/split` — tách từ ảnh `mediaId` ra thành mục mới. */
export function splitCollection(id: string, mediaId: string): Promise<WriteResult> {
  return apiWrite(`/api/collections/${encodeURIComponent(id)}/split`, 'POST', { mediaId });
}

/** `PATCH /api/media/:id` — ẩn ảnh, đổi mục, gắn người. */
export function patchMedia(
  id: string,
  patch: { hidden?: boolean; collectionId?: string | null; memberIds?: string[] },
): Promise<WriteResult> {
  return apiWrite(`/api/media/${encodeURIComponent(id)}`, 'PATCH', patch);
}

/** Kết quả lưu dải photobooth: `saved=false` khi chỉ lưu ở trình duyệt (mock/chưa có máy chủ). */
export interface StripResult {
  saved: boolean;
  /** Ảnh máy chủ trả về sau khi lưu (nếu có). */
  media?: Media;
}

/**
 * `POST /api/collections/:id/strips` — thân là ảnh PNG thô (không multipart).
 * Hợp đồng r2: trả `Media` mới của dải ảnh.
 */
export async function saveStrip(collectionId: string, png: Blob): Promise<StripResult> {
  if (FORCE_MOCK) return { saved: false };
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/collections/${encodeURIComponent(collectionId)}/strips`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'image/png' },
      credentials: 'same-origin',
      body: png,
    });
  } catch {
    if (MAY_FALLBACK) return { saved: false };
    throw new ApiError('server', 'Không kết nối được máy chủ. Vui lòng thử lại.');
  }

  if (res.ok) {
    let media: Media | undefined;
    try {
      const body: unknown = await res.json();
      if (body && typeof body === 'object' && typeof (body as { id?: unknown }).id === 'string') {
        media = body as Media;
      }
    } catch {
      media = undefined;
    }
    return { saved: true, media };
  }
  if (res.status === 401) {
    throw new ApiError('private', 'Phiên đăng nhập đã hết, đăng nhập lại rồi thử lại.');
  }
  if (res.status === 403) throw new ApiError('private', 'Mục này không thuộc gia đình bạn.');
  if (res.status === 413) throw new ApiError('server', 'Dải ảnh quá lớn, máy chủ không nhận.');
  throw new ApiError('server', 'Máy chủ chưa lưu được dải ảnh này.');
}

/** `POST /api/suggestions/:id/accept`. */
export function acceptSuggestion(suggestionId: string): Promise<WriteResult> {
  return apiWrite(`/api/suggestions/${encodeURIComponent(suggestionId)}/accept`, 'POST');
}

/** `POST /api/suggestions/:id/dismiss`. */
export function dismissSuggestion(suggestionId: string): Promise<WriteResult> {
  return apiWrite(`/api/suggestions/${encodeURIComponent(suggestionId)}/dismiss`, 'POST');
}

/* ------------------------------------------------------------------ */
/* Đăng nhập / đăng ký gia đình (G5)                                   */
/* ------------------------------------------------------------------ */

export interface AuthUser {
  id: string | number;
  username: string;
  displayName: string;
  avatarColor: string | null;
}

export interface FamilyInfo {
  id: string | number;
  name: string;
  slug: string;
}

/** `POST /api/auth/login|register` → `{user, family}` (giống `GET /api/me`). */
export interface AuthSession {
  user: AuthUser;
  family: FamilyInfo;
}

export interface LoginFamilyInput {
  /** Máy chủ nhận cả email lẫn tên người dùng. */
  email: string;
  password: string;
}

export interface RegisterFamilyInput {
  username: string;
  email: string;
  password: string;
  /** Hợp đồng r2: `familyName?` — tên gia đình mới. */
  familyName?: string;
}

/** Mã lỗi của máy chủ → câu tiếng Việt (bám `auth.js` + `auth-routes.js`). */
const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Sai mật khẩu hoặc email. Bạn thử lại giúp mình nhé.',
  username_reserved: 'Tên đăng nhập này không dùng được, bạn chọn tên khác nhé.',
  invalid_username: 'Tên đăng nhập cần 3–30 ký tự: chữ thường, số, dấu . _ -',
  username_taken: 'Tên đăng nhập này đã có người dùng.',
  invalid_email: 'Email chưa đúng dạng, bạn kiểm tra lại nhé.',
  email_taken: 'Email này đã có tài khoản. Bạn đăng nhập thay vì đăng ký nhé.',
  weak_password: 'Mật khẩu cần ít nhất 8 ký tự.',
  invalid_password: 'Bạn chưa nhập mật khẩu.',
  bad_request: 'Thông tin chưa đúng, bạn kiểm tra lại giúp mình.',
};

/** Câu tiếng Việt cho một mã lỗi của máy chủ. */
export function authMessage(code: string | undefined, fallback: string): string {
  return (code && AUTH_MESSAGES[code]) || fallback;
}

function errorCodeOf(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null) {
    const code = (body as { error?: unknown }).error;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

/** Phiên giả khi `VITE_MOCK=1`: lấy người trong `src/dev/mock/me.json`. */
async function mockSession(
  email: string,
  familyName?: string,
): Promise<AuthSession> {
  const mod = await loadMock();
  const base = mod.me;
  const username = email.split('@')[0]?.trim() || base.user.username;
  return {
    user: { ...base.user, username },
    family: familyName
      ? { ...base.family, name: familyName, slug: 'nha-cua-ban' }
      : base.family,
  };
}

/**
 * `POST /api/auth/login` — đăng nhập, máy chủ đặt cookie phiên.
 * Lỗi 401 → `ApiError` có `code = invalid_credentials` để trang hiện "sai mật khẩu".
 */
export async function loginFamily(input: LoginFamilyInput): Promise<AuthSession> {
  if (FORCE_MOCK) return mockSession(input.email);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: input.email.trim(), password: input.password }),
    });
  } catch {
    throw new ApiError('server', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (res.ok && body) return body as AuthSession;

  const code = errorCodeOf(body);
  const message = authMessage(
    code,
    res.status === 401
      ? AUTH_MESSAGES.invalid_credentials
      : 'Chưa đăng nhập được. Bạn thử lại giúp mình nhé.',
  );
  throw new ApiError(res.status === 401 ? 'unknown' : 'server', message, code);
}

/** `POST /api/auth/register` — tạo tài khoản và gia đình mới, máy chủ đặt cookie phiên. */
export async function registerFamily(input: RegisterFamilyInput): Promise<AuthSession> {
  if (FORCE_MOCK) return mockSession(input.email, input.familyName);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        username: input.username.trim().toLowerCase(),
        email: input.email.trim(),
        password: input.password,
        ...(input.familyName?.trim() ? { familyName: input.familyName.trim() } : {}),
      }),
    });
  } catch {
    throw new ApiError('server', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if ((res.status === 200 || res.status === 201) && body) return body as AuthSession;

  const code = errorCodeOf(body);
  throw new ApiError('server', authMessage(code, 'Chưa tạo được nhà mình. Bạn thử lại giúp mình nhé.'), code);
}

/** `POST /api/auth/logout` — máy chủ xoá phiên và cookie. */
export async function logoutFamily(): Promise<void> {
  if (FORCE_MOCK) return;
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
    });
  } catch {
    /* trình duyệt vẫn coi như đã đăng xuất */
  }
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
