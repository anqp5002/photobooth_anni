/**
 * Gọi API cho trang "của tôi" (`/me`, `/me/trips/:id`).
 * Chỉ dùng đúng các endpoint trong "Hợp đồng API" của MEGAPLAN_r1.md.
 */
import type {
  Media,
  Step,
  Trip,
  TripSummary,
  UserProfile,
  Visibility,
} from '../../api/types';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

export interface Me {
  id: number;
  username: string;
  displayName: string;
  avatar: string | null;
  email: string;
}

/** `GET /api/users/:username` của chính mình có thêm `visibility` từng chuyến. */
export interface OwnerTripSummary extends TripSummary {
  visibility?: Visibility;
}

export interface OwnerProfile extends Omit<UserProfile, 'trips'> {
  trips: OwnerTripSummary[];
}

/** Chuyến của chủ: `days` và mục `unsorted` (B-02) do máy chủ T2 trả thêm.
 *  Mã trong JSON của máy chủ là số, còn kiểu dùng chung của T1 khai báo chuỗi. */
export interface ManageMedia extends Omit<Media, 'id'> {
  id: number;
}

export interface ManageStep extends Omit<Step, 'id' | 'media'> {
  id: number;
  media: ManageMedia[];
}

export interface ManageTrip extends Omit<Trip, 'id' | 'steps'> {
  id: number;
  steps: ManageStep[];
  days?: number;
  unsorted?: ManageMedia[];
}

export interface RejectedFile {
  file: string;
  reason: string;
}

export interface UploadResult {
  accepted: number[];
  rejected: RejectedFile[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const code =
      data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? String((data as { error: string }).error)
        : `http_${res.status}`;
    throw new ApiError(res.status, code);
  }
  return data as T;
}

export function getMe(): Promise<Me> {
  return request<Me>('/api/me');
}

export function logout(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export function getOwnerProfile(username: string): Promise<OwnerProfile> {
  return request<OwnerProfile>(`/api/users/${encodeURIComponent(username)}`);
}

export function createTrip(name: string): Promise<{ id: number; name: string; slug: string }> {
  return request('/api/trips', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function getManageTrip(id: string | number): Promise<ManageTrip> {
  return request<ManageTrip>(`/api/trips/${encodeURIComponent(String(id))}?limit=100`);
}

export function patchTrip(
  id: number,
  body: { name?: string; visibility?: Visibility },
): Promise<{ id: number; name: string; slug: string; visibility: Visibility }> {
  return request(`/api/trips/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function patchStep(
  id: number,
  body: { name?: string; description?: string },
): Promise<unknown> {
  return request(`/api/steps/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function moveMedia(mediaId: number, stepId: number): Promise<unknown> {
  return request(`/api/media/${mediaId}/move`, {
    method: 'POST',
    body: JSON.stringify({ stepId }),
  });
}

export function mergeStep(stepId: number, intoStepId: number): Promise<unknown> {
  return request(`/api/steps/${stepId}/merge`, {
    method: 'POST',
    body: JSON.stringify({ intoStepId }),
  });
}

export function splitStep(stepId: number, mediaId: number): Promise<{ stepId: number }> {
  return request(`/api/steps/${stepId}/split`, {
    method: 'POST',
    body: JSON.stringify({ mediaId }),
  });
}

export function setMediaHidden(mediaId: number, hidden: boolean): Promise<Media> {
  return request(`/api/media/${mediaId}`, {
    method: 'PATCH',
    body: JSON.stringify({ hidden }),
  });
}

/** Tải từng tệp một bằng XHR để có tiến độ thật của từng tệp (B-01). */
export function uploadFile(
  tripId: number,
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/trips/${tripId}/media`);
    xhr.withCredentials = true;
    xhr.responseType = 'text';
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data && typeof data === 'object') {
        onProgress(100);
        resolve(data as UploadResult);
        return;
      }
      const code =
        data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
          ? String((data as { error: string }).error)
          : `http_${xhr.status}`;
      reject(new ApiError(xhr.status, code));
    };
    xhr.onerror = () => reject(new ApiError(0, 'network_error'));
    const form = new FormData();
    form.append('files', file, file.name);
    xhr.send(form);
  });
}
