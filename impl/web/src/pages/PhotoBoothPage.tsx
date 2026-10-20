import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { fetchTrip, ApiError } from '../api/client';
import type { Trip } from '../api/types';
import { useSession } from '../session/SessionContext';
import { mountPhotobooth } from '../photobooth';

/**
 * Route `/photobooth` (T6, B-05).
 * - Không có `?trip=` → photobooth trống, tiêu đề mặc định.
 * - Có `?trip=<id>` → lấy chuyến: tiêu đề là tên chuyến, nguồn ảnh là ảnh `lg` của chuyến
 *   (bỏ ảnh `hidden`, bỏ video).
 * - Có `?step=<id>` → chặng đích khi lưu dải; không có thì chặng đầu.
 * - Chỉ chủ chuyến đã đăng nhập mới có nút "lưu vào chuyến" (R-132: đây là yêu cầu duy nhất
 *   được phép gửi ảnh ra ngoài).
 */

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

/** Ảnh nguồn: ảnh (không phải video) đang hiện, theo thứ tự trong chặng. */
function sourcePhotosOf(trip: Trip): string[] {
  const out: string[] = [];
  for (const step of trip.steps) {
    for (const media of step.media) {
      if (media.type !== 'photo' || media.flags.hidden) continue;
      out.push(media.lg);
    }
  }
  return out;
}

/** Gửi dải PNG vào chặng: `POST /api/steps/:id/strips` nhận thân là ảnh PNG thô. */
async function uploadStrip(stepId: string, png: Blob): Promise<void> {
  const res = await fetch(`${API_BASE}/api/steps/${encodeURIComponent(stepId)}/strips`, {
    method: 'POST',
    headers: { 'content-type': 'image/png', accept: 'application/json' },
    credentials: 'same-origin',
    body: png,
  });
  if (res.ok) return;
  let code = '';
  try {
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
      code = (data as { error: string }).error;
    }
  } catch {
    /* phản hồi không phải JSON */
  }
  if (res.status === 401) throw new Error('phiên đăng nhập đã hết, đăng nhập lại rồi thử lại.');
  if (res.status === 403) throw new Error('bạn không phải chủ chuyến này.');
  throw new Error(code ? `máy chủ báo "${code}".` : `máy chủ trả lỗi ${res.status}.`);
}

export function PhotoBoothPage() {
  const [params] = useSearchParams();
  const hostRef = useRef<HTMLDivElement>(null);
  const { user, loading: sessionLoading } = useSession();

  const tripId = params.get('trip');
  const stepParam = params.get('step');
  const titleParam = params.get('title') ?? undefined;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [tripError, setTripError] = useState<string | null>(null);
  const [tripLoading, setTripLoading] = useState(Boolean(tripId));

  // Nạp chuyến khi có `?trip=`.
  useEffect(() => {
    if (!tripId) {
      setTrip(null);
      setTripError(null);
      setTripLoading(false);
      return undefined;
    }
    let alive = true;
    setTripLoading(true);
    fetchTrip(tripId, 100)
      .then((found) => {
        if (!alive) return;
        setTrip(found);
        setTripError(null);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setTrip(null);
        const kind = error instanceof ApiError ? error.kind : 'unknown';
        setTripError(
          kind === 'not_found'
            ? 'Không tìm thấy chuyến này.'
            : kind === 'private'
              ? 'Chuyến này là riêng tư, bạn không xem được.'
              : 'Không tải được chuyến. Kiểm tra kết nối rồi thử lại.',
        );
      })
      .finally(() => {
        if (alive) setTripLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tripId]);

  // Gắn photobooth khi đã biết chuyến (hoặc khi không có chuyến) và đã biết phiên đăng nhập.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    if (tripId && (tripLoading || sessionLoading)) return undefined;

    const targetStepId =
      (stepParam && trip?.steps.some((step) => String(step.id) === stepParam) ? stepParam : null) ??
      (trip && trip.steps.length > 0 ? String(trip.steps[0].id) : null);

    const isOwner = Boolean(user && trip && user.username === trip.author.username);
    const canSave = Boolean(trip) && isOwner && Boolean(targetStepId);

    return mountPhotobooth(host, {
      title: trip?.name ?? titleParam,
      sourcePhotos: trip ? sourcePhotosOf(trip) : undefined,
      onSaveToTrip: canSave
        ? (png: Blob) => uploadStrip(String(targetStepId), png)
        : undefined,
    });
  }, [trip, tripId, stepParam, titleParam, tripLoading, sessionLoading, user]);

  const waiting = Boolean(tripId) && (tripLoading || sessionLoading);

  return (
    <div className="photobooth-page">
      <a className="skip-link" href="#main">
        bỏ qua tới nội dung chính
      </a>
      <Header />
      <main className="photobooth-host" id="main">
        {waiting && (
          <p role="status" style={{ padding: '24px', color: '#4D5A6E' }}>
            Đang tải chuyến…
          </p>
        )}
        {tripError && (
          <div role="alert" style={{ padding: '24px', color: '#8C1230', fontWeight: 700 }}>
            {tripError}
          </div>
        )}
        <div ref={hostRef} hidden={Boolean(tripError)} />
      </main>
    </div>
  );
}
