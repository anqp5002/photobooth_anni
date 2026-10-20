import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/700.css';
import { mountPhotobooth } from '../index';
import { SAMPLE_PHOTOS } from '../photos';

/**
 * Trang thử photobooth — chỉ để phát triển/kiểm tra, không thuộc app chính.
 * Mở: `npx vite` rồi vào `/photobooth-dev.html`.
 * Tham số: ?photos=7 (ảnh nguồn mẫu), ?save=1 (giả lập "lưu vào chuyến"), ?title=<tên>.
 *
 * Ảnh nguồn mẫu là **ảnh thật** của bản mẫu (`/proto-photos/*`, CC0) — không vẽ ảnh giả.
 */

const params = new URLSearchParams(location.search);
const host = document.getElementById('photobooth');
if (!host) throw new Error('Thiếu #photobooth');

const sourceCount = Number(params.get('photos') ?? '0');
const sourcePhotos: string[] = [];

for (let i = 0; i < sourceCount; i += 1) {
  sourcePhotos.push(SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length]);
}

const saveEnabled = params.get('save') === '1';

const unmount = mountPhotobooth(host, {
  title: params.get('title') ?? 'Xuyên Việt',
  sourcePhotos,
  onSaveToTrip: saveEnabled
    ? async (png) => {
        // Giả lập API của chuyến: chỉ chờ một nhịp để thấy trạng thái đang lưu.
        await new Promise((resolve) => setTimeout(resolve, 700));
        // eslint-disable-next-line no-console
        console.log('[dev] lưu vào chuyến', png.size, png.type);
      }
    : undefined,
});

window.addEventListener('pagehide', () => {
  unmount();
});
