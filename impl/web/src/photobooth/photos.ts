import type { PhotoEntry } from './types';

/**
 * Đọc ảnh từ máy (R-117): chỉ nhận ảnh giải mã được, giữ thứ tự chọn,
 * tệp không phải ảnh bị bỏ qua và báo bằng chữ.
 */

export interface ReadResult {
  photos: PhotoEntry[];
  rejected: string[];
}

let counter = 0;

function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

async function decode(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

export async function readImageFiles(files: FileList | File[]): Promise<ReadResult> {
  const list = Array.from(files as ArrayLike<File>);
  const photos: PhotoEntry[] = [];
  const rejected: string[] = [];

  for (const file of list) {
    const looksImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(file.name);
    if (!looksImage) {
      rejected.push(`${file.name} không phải ảnh`);
      continue;
    }
    try {
      const bitmap = await decode(file);
      photos.push({
        id: nextId('upload'),
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        alt: `Ảnh tải lên ${photos.length + 1}`,
        origin: 'upload',
      });
    } catch {
      rejected.push(`${file.name} không đọc được (tệp hỏng hoặc định dạng trình duyệt chưa hỗ trợ)`);
    }
  }

  return { photos, rejected };
}

/** Tải ảnh nguồn theo URL cùng nguồn gốc (B-05: ảnh của chuyến). */
export async function readImageUrls(urls: string[]): Promise<ReadResult> {
  const photos: PhotoEntry[] = [];
  const rejected: string[] = [];
  for (const [index, url] of urls.entries()) {
    try {
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      photos.push({
        id: nextId('source'),
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        alt: `Ảnh của chuyến ${index + 1}`,
        origin: 'upload',
      });
    } catch {
      rejected.push(`ảnh nguồn ${index + 1} không tải được`);
    }
  }
  return { photos, rejected };
}

/**
 * Ảnh mẫu cho cột "Kiểu dải có sẵn": **ảnh thật** của bản mẫu
 * (`design/proto/assets/photos/`, CC0 — xem `design/proto/CREDITS.md`), phục vụ ở
 * `/proto-photos/<tên>.jpg` bởi plugin Vite `src/dev/mock/proto-photos-plugin.ts`.
 *
 * AGENTS.md mục 3: cấm ảnh tự vẽ bằng canvas/SVG — nên không còn hàm sinh phong cảnh.
 */
export const SAMPLE_PHOTOS: string[] = [
  '/proto-photos/hero-om.jpg',
  '/proto-photos/bien-nui.jpg',
  '/proto-photos/banh-sn.jpg',
  '/proto-photos/phong-khach.jpg',
  '/proto-photos/di-bien.jpg',
];

/** Tải ảnh mẫu (im lặng: ảnh nào lỗi thì bỏ, không chặn giao diện). */
export async function loadSamplePhotos(urls: string[]): Promise<PhotoEntry[]> {
  const results = await Promise.all(
    urls.map(async (url, index): Promise<PhotoEntry | null> => {
      try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) return null;
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);
        return {
          id: `sample-${index}`,
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          alt: '',
          origin: 'upload',
        };
      } catch {
        /* ảnh mẫu không tải được: ô mẫu hiện khung số thứ tự, không vẽ ảnh giả. */
        return null;
      }
    }),
  );
  return results.filter((photo): photo is PhotoEntry => photo !== null);
}
