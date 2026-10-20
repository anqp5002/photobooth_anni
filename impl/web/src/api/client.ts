import type { Trip, UserProfile } from './types';

export type ApiErrorKind = 'not_found' | 'private' | 'server' | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** Mã lỗi do máy chủ trả về, ví dụ "email_taken". */
  readonly code?: string;

  constructor(kind: ApiErrorKind, message: string, code?: string) {
    super(message);
    this.kind = kind;
    this.code = code;
    this.name = 'ApiError';
  }
}

/**
 * Chưa đăng nhập (API trả 401): chuyển sang trang đăng nhập, nhớ trang đang mở
 * để đăng nhập xong quay lại đúng chỗ. Đang ở trang đăng nhập thì không làm gì.
 */
export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  if (pathname.startsWith('/dang-nhap')) return;
  window.location.assign(`/dang-nhap?next=${encodeURIComponent(pathname + search)}`);
}

/** Đường dẫn quay lại sau khi đăng nhập; chỉ nhận đường dẫn nội bộ. */
export function loginNextPath(): string {
  if (typeof window === 'undefined') return '/';
  const next = new URLSearchParams(window.location.search).get('next') ?? '';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/** Dữ liệu giả chỉ dùng khi chạy dev hoặc bật cờ VITE_USE_MOCK=1. */
const RAW_MOCK_FLAG = import.meta.env.VITE_USE_MOCK;
const MOCK_FLAG = RAW_MOCK_FLAG === undefined ? '' : String(RAW_MOCK_FLAG).trim().toLowerCase();
const USE_MOCK = import.meta.env.DEV || MOCK_FLAG === '1' || MOCK_FLAG === 'true';
/** Bật cờ thì dùng dữ liệu giả luôn, không gọi máy chủ. */
const FORCE_MOCK = MOCK_FLAG === '1' || MOCK_FLAG === 'true';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

interface JsonResponse {
  status: number;
  data: unknown;
  /** Phản hồi có phải JSON của API không (không phải HTML của SPA fallback). */
  api: boolean;
}

async function request(path: string, init?: RequestInit): Promise<JsonResponse> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
    ...init,
  });
  const text = await res.text();
  let data: unknown = null;
  let api = false;
  const trimmed = text.trim();
  if (trimmed) {
    try {
      data = JSON.parse(trimmed);
      api = true;
    } catch {
      api = false;
    }
  }
  return { status: res.status, data, api };
}

function getJson(path: string): Promise<JsonResponse> {
  return request(path);
}

function postJson(path: string, body: unknown): Promise<JsonResponse> {
  return request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Nạp module dữ liệu giả kèm (nằm ở chunk riêng, không vào bundle chính). */
async function loadMock(): Promise<typeof import('../dev/mock')> {
  return import('../dev/mock');
}

function isTrip(value: unknown): value is Trip {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Trip).steps) &&
    typeof (value as Trip).name === 'string'
  );
}

function isUser(value: unknown): value is UserProfile {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as UserProfile).trips) &&
    typeof (value as UserProfile).username === 'string'
  );
}

function errorCode(data: unknown): string | undefined {
  if (typeof data === 'object' && data !== null) {
    const code = (data as { error?: unknown }).error;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

/**
 * Lấy chuyến theo mã.
 * - Máy chủ thật trả 404/403 JSON thì giữ nguyên để hiện trang lỗi tương ứng (R-040).
 * - Lỗi mạng hoặc 5xx: bản dev dùng dữ liệu giả, bản build thường báo lỗi chung.
 */
export async function fetchTrip(id: string, limit = 20): Promise<Trip> {
  if (!FORCE_MOCK) {
    let apiError: ApiError | null = null;
    try {
      const { status, data, api } = await getJson(
        `/api/trips/${encodeURIComponent(id)}?limit=${limit}`,
      );
      if (status === 200 && isTrip(data)) return data;
      if (api && status === 404) {
        apiError = new ApiError('not_found', 'Không tìm thấy chuyến đi này.');
      } else if (api && status === 403) {
        apiError = new ApiError('private', 'Chuyến đi này là riêng tư.');
      }
    } catch {
      apiError = null;
    }
    if (apiError) throw apiError;
    if (!USE_MOCK) {
      throw new ApiError('server', 'Máy chủ chưa phản hồi. Vui lòng thử lại sau.');
    }
  }
  const { mockTrip } = await loadMock();
  const trip = mockTrip(id);
  if (!trip) throw new ApiError('not_found', 'Không tìm thấy chuyến đi này.');
  return trip;
}

/** Lấy hồ sơ tác giả theo tên người dùng. */
export async function fetchUser(username: string): Promise<UserProfile> {
  if (!FORCE_MOCK) {
    let apiError: ApiError | null = null;
    try {
      const { status, data, api } = await getJson(`/api/users/${encodeURIComponent(username)}`);
      if (status === 200 && isUser(data)) return data;
      if (api && status === 404) {
        apiError = new ApiError('not_found', 'Không tìm thấy người dùng này.');
      }
    } catch {
      apiError = null;
    }
    if (apiError) throw apiError;
    if (!USE_MOCK) {
      throw new ApiError('server', 'Máy chủ chưa phản hồi. Vui lòng thử lại sau.');
    }
  }
  const { mockUser } = await loadMock();
  const user = mockUser(username);
  if (!user) throw new ApiError('not_found', 'Không tìm thấy người dùng này.');
  return user;
}

/* ------------------------------------------------------------------ */
/* Đăng nhập / đăng ký (hợp đồng API của máy chủ)                     */
/* ------------------------------------------------------------------ */

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  email: string;
}

/** Thông điệp tiếng Việt cho mã lỗi của máy chủ. */
export const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'Sai email hoặc mật khẩu.',
  username_reserved: 'Tên này không dùng được, hãy chọn tên khác.',
  email_taken: 'Email này đã có người dùng.',
  invalid_email: 'Email không hợp lệ.',
  weak_password: 'Mật khẩu cần ít nhất 8 ký tự.',
  invalid_username: 'Tên người dùng phải có 3–30 ký tự, chỉ chữ thường, số, dấu . _ -',
  username_taken: 'Tên người dùng đã có người dùng.',
  invalid_password: 'Mật khẩu không hợp lệ.',
  unauthorized: 'Bạn chưa đăng nhập.',
  too_large: 'Dữ liệu gửi lên quá lớn.',
};

/** Tên người dùng bị cấm (máy chủ cũng kiểm tra lại). */
export const RESERVED_USERNAMES = ['me', 'photobooth', 'login', 'api', 'media'];

export function authErrorMessage(code: string | undefined, fallback: string): string {
  if (code && AUTH_ERRORS[code]) return AUTH_ERRORS[code];
  return fallback;
}

function readUser(data: unknown): SessionUser | null {
  const raw = (data as { user?: unknown } | null)?.user ?? data;
  if (typeof raw !== 'object' || raw === null) return null;
  const user = raw as SessionUser;
  if (typeof user.username !== 'string') return null;
  return user;
}

/** Người dùng đang đăng nhập, hoặc null nếu chưa đăng nhập. */
export async function fetchMe(): Promise<SessionUser | null> {
  try {
    const { status, data } = await getJson('/api/me');
    if (status === 200) return readUser(data);
    return null;
  } catch {
    return null;
  }
}

/** Đăng nhập bằng email (máy chủ cũng nhận tên người dùng). */
export async function loginAccount(email: string, password: string): Promise<SessionUser> {
  let status = 0;
  let code: string | undefined;
  let data: unknown = null;
  try {
    ({ status, data } = await postJson('/api/auth/login', { email, password }));
  } catch {
    throw new ApiError('server', 'Không kết nối được máy chủ. Vui lòng thử lại.');
  }
  const user = readUser(data);
  if (status === 200 && user) return user;
  code = errorCode(data);
  if (status === 401) {
    throw new ApiError('unknown', authErrorMessage(code, 'Sai email hoặc mật khẩu.'), code);
  }
  throw new ApiError(
    'unknown',
    authErrorMessage(code, 'Không đăng nhập được. Vui lòng thử lại.'),
    code,
  );
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

/** Đăng ký tài khoản mới. */
export async function registerAccount(input: RegisterInput): Promise<SessionUser> {
  let status = 0;
  let code: string | undefined;
  let data: unknown = null;
  try {
    ({ status, data } = await postJson('/api/auth/register', input));
  } catch {
    throw new ApiError('server', 'Không kết nối được máy chủ. Vui lòng thử lại.');
  }
  const user = readUser(data);
  if (status === 200 || status === 201) {
    if (user) return user;
    throw new ApiError('unknown', 'Đăng ký xong nhưng chưa lấy được thông tin người dùng.');
  }
  code = errorCode(data);
  throw new ApiError(
    'unknown',
    authErrorMessage(code, 'Không đăng ký được. Vui lòng thử lại.'),
    code,
  );
}

/** Đăng xuất (máy chủ xoá phiên và cookie). */
export async function logoutAccount(): Promise<void> {
  try {
    await postJson('/api/auth/logout', {});
  } catch {
    /* đăng xuất vẫn coi như thành công ở phía trình duyệt */
  }
}
