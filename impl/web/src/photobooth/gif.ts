import type { PhotoEntry } from './types';

/**
 * GIF động (R-116): mỗi ảnh một khung vuông 480x480 cắt giữa, nền trắng, 0,8 giây/khung.
 * Thư viện gifenc (MIT) đóng gói trong `vendor/`, nạp động khi người dùng bấm "GIF động":
 * thiếu tệp thư viện thì chỉ hỏng chức năng GIF và báo lỗi bằng chữ (R-133), không hỏng im lặng
 * và không kéo sập cả photobooth.
 */

const SIZE = 480;
const DELAY_MS = 800;

export interface GifProgress {
  (percent: number): void;
}

type GifModule = typeof import('./vendor/gifenc/gifenc.esm.js');

let modulePromise: Promise<GifModule> | null = null;

async function loadEncoder(): Promise<GifModule> {
  if (!modulePromise) {
    modulePromise = import('./vendor/gifenc/gifenc.esm.js').catch((error: unknown) => {
      modulePromise = null;
      throw new Error(
        `thư viện GIF không tải được (${(error as Error)?.message ?? 'lỗi không rõ'}). Tải lại trang rồi thử lại.`,
      );
    });
  }
  return modulePromise;
}

function frameData(photo: PhotoEntry): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không tạo được canvas 2D.');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const scale = Math.max(SIZE / photo.width, SIZE / photo.height);
  const dw = photo.width * scale;
  const dh = photo.height * scale;
  ctx.drawImage(photo.source, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
  return ctx.getImageData(0, 0, SIZE, SIZE);
}

export async function encodeGif(photos: PhotoEntry[], onProgress?: GifProgress): Promise<Blob> {
  if (!photos.length) throw new Error('Chưa có ảnh nào để làm GIF.');

  let mod: GifModule;
  try {
    mod = await loadEncoder();
  } catch (error) {
    // Câu đã rõ nghĩa trong loadEncoder, không bọc thêm để khỏi lặp.
    throw error instanceof Error ? error : new Error(String(error));
  }

  const encoder = mod.GIFEncoder();
  for (let i = 0; i < photos.length; i += 1) {
    const data = frameData(photos[i]);
    // Mỗi khung mang bảng màu riêng: an toàn khi các ảnh khác tông nhau nhiều.
    const palette = mod.quantize(data.data, 128);
    const index = mod.applyPalette(data.data, palette);
    encoder.writeFrame(index, SIZE, SIZE, { palette, delay: DELAY_MS, repeat: 0, dispose: 1 });
    onProgress?.(Math.round(((i + 1) / photos.length) * 100));
    await new Promise((resolve) => window.setTimeout(resolve, 16));
  }

  encoder.finish();
  const bytes = encoder.bytes();
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'image/gif' });
}
