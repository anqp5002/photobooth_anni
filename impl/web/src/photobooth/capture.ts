import { filterById } from './filters';
import type { Orientation } from './types';

/**
 * Chờ video có ít nhất một khung hình thật (readyState ≥ HAVE_CURRENT_DATA).
 * Nếu chụp trước lúc camera phát khung đầu, ảnh sẽ ra trống — R-107 cần ảnh thật.
 */
export async function waitForVideoFrame(video: HTMLVideoElement, timeoutMs = 2500): Promise<boolean> {
  if (video.readyState >= 2 && video.videoWidth > 0) return true;
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      window.clearTimeout(timer);
      resolve(ok);
    };
    const onReady = () => {
      if (video.videoWidth > 0) finish(true);
    };
    const timer = window.setTimeout(() => finish(video.readyState >= 2 && video.videoWidth > 0), timeoutMs);
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    if (video.paused) void video.play().catch(() => undefined);
  });
}

/**
 * Chụp một khung từ video (R-107): cắt phần giữa khung theo 4:3 / 3:4,
 * lật gương, in luôn bộ lọc đang chọn. Camera 1280x720 → 960x720 (ngang) hoặc 540x720 (dọc).
 */
export function captureFrame(
  video: HTMLVideoElement,
  orientation: Orientation,
  filterId: string,
): HTMLCanvasElement {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const targetAspect = orientation === 'landscape' ? 4 / 3 : 3 / 4;

  let sw = vw;
  let sh = vh;
  if (vw / vh > targetAspect) sw = Math.round(vh * targetAspect);
  else sh = Math.round(vw / targetAspect);

  // Kích thước đầu ra: giữ chiều cao nguồn, rộng theo tỉ lệ (960x720 / 540x720 với 1280x720).
  const outH = sh;
  const outW = Math.round(outH * targetAspect);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không tạo được canvas 2D.');

  const sx = Math.round((vw - sw) / 2);
  const sy = Math.round((vh - sh) / 2);

  ctx.save();
  ctx.translate(outW, 0);
  ctx.scale(-1, 1); // lật gương, khớp bản xem trước
  const filter = filterById(filterId).css;
  if (filter !== 'none') ctx.filter = filter;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
  ctx.restore();

  return canvas;
}
