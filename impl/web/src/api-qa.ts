/**
 * Hàm API cần thêm cho hai màn của qa (`w1:pM`):
 * - F5 `/dong-thoi-gian`: chi tiết mục (để gắn nhãn mục cho từng ngày).
 * - G3 `/tai-anh`: tải ảnh lên (multipart + tiến độ từng tệp), trạng thái AI từng ảnh,
 *   nhận/bỏ qua gợi ý của AI, danh sách người trong nhà.
 *
 * Không sửa `src/api.ts` (của `w1:pP`) và `src/api-extra.ts` (của `w1:pN`):
 * mọi hàm mới nằm ở đây. Cùng cơ chế dữ liệu giả: `VITE_MOCK=1` đọc `src/dev/mock`.
 */
import { ApiError, type Collection, type Media, type Member } from './api';

/* ------------------------------------------------------------------ */
/* Cấu hình (giống src/api.ts)                                          */
/* ------------------------------------------------------------------ */

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

function flag(value: unknown): boolean {
  const raw = value === undefined ? '' : String(value).trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

const FORCE_MOCK = flag(import.meta.env.VITE_MOCK) || flag(import.meta.env.VITE_USE_MOCK);
const MAY_FALLBACK = import.meta.env.DEV || FORCE_MOCK;

let mockModule: Promise<typeof import('./dev/mock/index')> | null = null;

function loadMock(): Promise<typeof import('./dev/mock/index')> {
  mockModule ??= import('./dev/mock/index');
  return mockModule;
}

async function mockGet<T>(path: string, query?: Record<string, string>): Promise<T> {
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
/* Kiểu dữ liệu                                                         */
/* ------------------------------------------------------------------ */

export type AiStatus = 'pending' | 'done' | 'failed' | 'skipped';

export interface MediaStatusItem {
  id: string | number;
  aiStatus: AiStatus;
  caption: string | null;
  collectionId: string | number | null;
}

export interface CollectionSuggestion {
  id: string | number;
  type: 'hide_blurry' | 'merge' | 'split' | 'rename';
  text: string;
  payload: Record<string, unknown>;
  status?: string;
}

export interface CollectionDetail extends Collection {
  days: { date: string; media: Media[] }[];
  route: { lat: number; lon: number }[];
  suggestions: CollectionSuggestion[];
}

export interface UploadAccepted {
  id: string | number;
  file: string;
}

export interface UploadRejected {
  file: string;
  reason: string;
}

export interface UploadResult {
  accepted: UploadAccepted[];
  rejected: UploadRejected[];
}

export interface SuggestionDecision {
  ok: boolean;
  suggestion: CollectionSuggestion & { status?: string };
}

/* ------------------------------------------------------------------ */
/* GET                                                                   */
/* ------------------------------------------------------------------ */

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  options: {
    query?: Record<string, string>;
    json?: unknown;
    form?: FormData;
  } = {},
): Promise<T> {
  if (FORCE_MOCK) return mockGet<T>(path, options.query);

  const headers: Record<string, string> = { accept: 'application/json' };
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.json);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${withQuery(path, options.query)}`, {
      method,
      headers,
      body,
      credentials: 'same-origin',
    });
  } catch {
    if (MAY_FALLBACK && method === 'GET') return mockGet<T>(path, options.query);
    throw new ApiError('server', 'Không kết nối được máy chủ. Vui lòng thử lại.');
  }

  if (res.ok) {
    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiError('server', 'Máy chủ trả dữ liệu không đọc được.');
    }
  }
  if (res.status === 401) {
    throw new ApiError('private', 'Bạn cần đăng nhập để xem kỷ niệm của nhà mình.');
  }
  if (res.status === 403) {
    throw new ApiError('private', 'Mục này không thuộc gia đình bạn.');
  }
  if (res.status === 404) {
    throw new ApiError('not_found', 'Không tìm thấy mục kỷ niệm này.');
  }
  throw new ApiError('server', 'Máy chủ gặp sự cố. Vui lòng thử lại sau.');
}

/** Chi tiết một mục: thêm `days`, `route`, `suggestions`. */
export function fetchCollectionDetail(id: string | number): Promise<CollectionDetail> {
  return request<CollectionDetail>('GET', `/api/collections/${encodeURIComponent(String(id))}`);
}

/** Người trong nhà (để gắn tay vào ảnh). */
export async function fetchMembers(): Promise<Member[]> {
  const list = await request<Member[]>('GET', '/api/members');
  return Array.isArray(list) ? list : [];
}

/** Trạng thái AI của một loạt ảnh (màn tải ảnh hỏi lại vài giây một lần). */
export async function fetchMediaStatus(ids: (string | number)[]): Promise<MediaStatusItem[]> {
  if (ids.length === 0) return [];
  const list = await request<MediaStatusItem[]>('GET', '/api/media/status', {
    query: { ids: ids.map((id) => String(id)).join(',') },
  });
  const byId = new Map((Array.isArray(list) ? list : []).map((item) => [String(item.id), item]));
  // Ảnh vừa tải lên trong chế độ dữ liệu giả chưa có trong dữ liệu giả sẵn có.
  for (const id of ids) {
    if (byId.has(String(id))) continue;
    const fallback = mockStatusFor(id);
    if (fallback) byId.set(String(id), fallback);
  }
  return ids
    .map((id) => byId.get(String(id)))
    .filter((item): item is MediaStatusItem => Boolean(item));
}

/* ------------------------------------------------------------------ */
/* Ghi                                                                   */
/* ------------------------------------------------------------------ */

/** Đổi tiêu đề/tóm tắt/loại/trạng thái của một mục. */
export function patchCollection(
  id: string | number,
  body: { title?: string; summary?: string; kind?: string; status?: string },
): Promise<Collection> {
  return request<Collection>('PATCH', `/api/collections/${encodeURIComponent(String(id))}`, {
    json: body,
  });
}

/** Ẩn ảnh, gán ảnh vào mục, gắn người trong nhà. */
export function patchMedia(
  id: string | number,
  body: { hidden?: boolean; collectionId?: string | number | null; memberIds?: number[] },
): Promise<Media> {
  return request<Media>('PATCH', `/api/media/${encodeURIComponent(String(id))}`, { json: body });
}

/** Nhận một gợi ý của AI (ẩn ảnh mờ, gộp, tách, đổi tên). */
export function acceptSuggestion(id: string | number): Promise<SuggestionDecision> {
  return request<SuggestionDecision>(
    'POST',
    `/api/suggestions/${encodeURIComponent(String(id))}/accept`,
    { json: {} },
  );
}

/** Bỏ qua một gợi ý của AI. */
export function dismissSuggestion(id: string | number): Promise<SuggestionDecision> {
  return request<SuggestionDecision>(
    'POST',
    `/api/suggestions/${encodeURIComponent(String(id))}/dismiss`,
    { json: {} },
  );
}

/* ------------------------------------------------------------------ */
/* Tải ảnh lên                                                          */
/* ------------------------------------------------------------------ */

/** Trạng thái giả lúc dữ liệu giả đang bật: mỗi tệp được "AI phân tích" sau 2 lần hỏi. */
const mockUploads = new Map<string, { polls: number; caption: string }>();

/**
 * Tải một tệp lên (`POST /api/media` multipart) và báo tiến độ theo từng tệp.
 * Dùng `XMLHttpRequest` vì `fetch` không có sự kiện tiến độ tải lên.
 */
export function uploadMediaFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  if (FORCE_MOCK) return mockUpload(file, onProgress);

  return new Promise<UploadResult>((resolve, reject) => {
    const form = new FormData();
    form.append('file', file, file.name);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/media`, true);
    xhr.withCredentials = true;
    xhr.setRequestHeader('accept', 'application/json');
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener('load', () => {
      let body: UploadResult | null = null;
      try {
        body = JSON.parse(xhr.responseText) as UploadResult;
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && body) {
        onProgress?.(100);
        resolve(body);
        return;
      }
      if (xhr.status === 401) {
        reject(new ApiError('private', 'Bạn cần đăng nhập để tải ảnh lên.'));
        return;
      }
      reject(new ApiError('server', `Máy chủ không nhận tệp (${xhr.status}).`));
    });
    xhr.addEventListener('error', () =>
      reject(new ApiError('server', 'Không kết nối được máy chủ. Vui lòng thử lại.')),
    );
    xhr.send(form);
  });
}

/** Tải nhiều tệp, gọi `onFile` khi từng tệp xong để cập nhật danh sách ngay. */
export async function uploadMediaFiles(
  files: File[],
  handlers: {
    onProgress?: (index: number, percent: number) => void;
    onFile?: (index: number, result: UploadResult) => void;
    onError?: (index: number, error: unknown) => void;
  } = {},
): Promise<UploadResult> {
  const accepted: UploadAccepted[] = [];
  const rejected: UploadRejected[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    try {
      const result = await uploadMediaFile(file, (percent) =>
        handlers.onProgress?.(index, percent),
      );
      accepted.push(...result.accepted);
      rejected.push(...result.rejected);
      handlers.onFile?.(index, result);
    } catch (error) {
      handlers.onError?.(index, error);
      rejected.push({
        file: file.name,
        reason: error instanceof ApiError ? error.message : 'Không tải được tệp này.',
      });
    }
  }
  return { accepted, rejected };
}

/** Giả lập tải lên khi `VITE_MOCK=1` (không có máy chủ thật). */
async function mockUpload(file: File, onProgress?: (percent: number) => void): Promise<UploadResult> {
  const id = `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  mockUploads.set(id, { polls: 0, caption: `AI đã đọc tấm ${file.name}.` });
  for (const percent of [18, 46, 74, 100]) {
    onProgress?.(percent);
    await new Promise((resolve) => setTimeout(resolve, 90));
  }
  return { accepted: [{ id, file: file.name }], rejected: [] };
}

/** Trạng thái AI giả: lần hỏi đầu `pending`, từ lần hai trở đi `done` kèm caption. */
export function mockStatusFor(id: string | number): MediaStatusItem | null {
  const key = String(id);
  const entry = mockUploads.get(key);
  if (!entry) return null;
  entry.polls += 1;
  const done = entry.polls >= 2;
  return {
    id,
    aiStatus: done ? 'done' : 'pending',
    caption: done ? entry.caption : null,
    collectionId: null,
  };
}
