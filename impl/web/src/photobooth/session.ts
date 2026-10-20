import { captureFrame, waitForVideoFrame } from './capture';
import type { Orientation, PhotoCount, TimerSeconds } from './types';
import { sleep } from './util';

/**
 * Phiên chụp (R-105, R-106, R-108).
 * Thứ tự: đếm ngược N..1 → chụp → (nháy trắng) → xem ảnh 1,2s → nghỉ 0,8s → lặp.
 * Huỷ (dừng / X) phải chặn mọi lần chụp đang chờ: sau mỗi `await` đều kiểm `signal.aborted`.
 */

export interface SessionOptions {
  video: HTMLVideoElement;
  count: PhotoCount;
  timer: TimerSeconds;
  orientation: Orientation;
  filterId: string;
  signal: AbortSignal;
  onCountdown: (value: number | null) => void;
  onCapture: (canvas: HTMLCanvasElement, index: number) => void;
  onPreview: (canvas: HTMLCanvasElement | null, index?: number) => void;
  onFlash: () => void;
}

const PREVIEW_MS = 1200;
const GAP_MS = 1000;

export async function runSession(options: SessionOptions): Promise<void> {
  const { count, timer, signal } = options;
  for (let index = 0; index < count; index += 1) {
    // Đếm ngược trước mỗi ảnh; hẹn 0 thì không đếm.
    if (timer > 0) {
      for (let n = timer; n >= 1; n -= 1) {
        if (signal.aborted) return;
        options.onCountdown(n);
        await sleep(1000, signal);
      }
      if (signal.aborted) return;
      options.onCountdown(null);
    } else {
      options.onCountdown(null);
      // Nhường một nhịp để DOM kịp vẽ trạng thái trước khi chụp.
      await sleep(30, signal);
    }
    if (signal.aborted) return;

    // Bảo đảm có khung hình thật trước khi chụp (nếu không ảnh sẽ ra trống).
    const ready = await waitForVideoFrame(options.video, timer === 0 ? 2500 : 1200);
    if (signal.aborted || !ready) return;

    const canvas = captureFrame(options.video, options.orientation, options.filterId);
    if (signal.aborted) return;
    options.onFlash();
    options.onCapture(canvas, index);
    options.onPreview(canvas, index);

    // R-106: khung xem trước ~1,2s rồi ẩn; hẹn giờ > 0 thì nghỉ thêm 0,8s (tổng nghỉ ≈ 2,2s).
    // Hẹn 0: chụp liên tiếp, vẫn giữ khung xem trước 1,2s theo R-106.
    await sleep(PREVIEW_MS, signal);
    if (signal.aborted) return;
    options.onPreview(null);
    if (timer > 0) await sleep(GAP_MS, signal);
    if (signal.aborted) return;
  }
}
