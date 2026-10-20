/**
 * Trang thử riêng của coder-2 cho `/muc/:id` — dùng khi khung/router của cmd `w1:pP`
 * chưa có route `/muc/:id`. Không sửa `src/App.tsx` (vùng cmd).
 *
 * Mở:  /muc-dev.html?id=he-da-lat
 * Tham số: `id` (mã mục), `state=loading|empty|error` để xem trạng thái.
 * Gỡ file này (và `muc-dev.html`) khi cmd đã nối route thật.
 */
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@fontsource/oswald/latin-600.css';
import '@fontsource/oswald/vietnamese-600.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/vietnamese-400.css';
import '@fontsource/inter/vietnamese-500.css';
import '@fontsource/inter/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/latin-700.css';
import '@fontsource/be-vietnam-pro/vietnamese-700.css';
import '@fontsource/playfair-display/latin-500-italic.css';
import '@fontsource/playfair-display/vietnamese-500-italic.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CollectionPage } from './CollectionPage';

const params = new URLSearchParams(window.location.search);
const id = params.get('id') || 'he-da-lat';
const rawState = params.get('state');
const demo =
  rawState === 'loading' || rawState === 'empty' || rawState === 'error' ? rawState : undefined;

const container = document.getElementById('root');
if (!container) throw new Error('Không tìm thấy phần tử #root');

createRoot(container).render(
  <MemoryRouter initialEntries={[`/muc/${id}`]}>
    <Routes>
      <Route path="/muc/:id" element={<CollectionPage demo={demo} />} />
    </Routes>
  </MemoryRouter>,
);
