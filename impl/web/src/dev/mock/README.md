# Dữ liệu giả cho web r2 (`impl/web/src/dev/mock/`)

Dữ liệu **mẫu** của gia đình **“Nhà Bin & Su” năm 2026**, đúng hợp đồng API trong
`MEGAPLAN_r2.md` → “Hợp đồng API”. Mục đích: web (`w1:pP`, `w1:pN`) làm tiếp mà không phải chờ server.

- 27 ảnh CC0 từ `design/proto/assets/photos/` (nguồn: `design/proto/CREDITS.md`); **mỗi tệp ảnh dùng đúng một bản ghi media** trong mock
  (bản mẫu HTML có lặp ảnh ở hero/ngày — ở đây không lặp, mỗi ảnh một chỗ).
- 7 mục kỷ niệm theo `design/proto/BRIEF_BUILD.md`; **lệch 2 ảnh** so với BRIEF (đã ghi rõ ở mục 4).
- Caption / tags / tên nơi: tiếng Việt có dấu.
- Sinh lại toàn bộ: `node impl/web/src/dev/mock/_gen.mjs` (không cần mạng, không cần AI).
- Kiểm tra khớp hợp đồng: `node tests/mock-contract.mjs`.

---

## 1. Bảng file → route

| File | GET trong hợp đồng | Nội dung |
|---|---|---|
| `me.json` | `GET /api/me` | `{user:{id,username,displayName,avatarColor}, family:{id,name,slug}}` |
| `home.json` | `GET /api/home` | `{greeting, stats, recent(≤12), collections(7), onThisDay, mapPreview}` |
| `recap-2026.json` | `GET /api/recap/2026` | `{year, intro, stats, chapters(7 tháng), topPlaces}` |
| `collections.json` | `GET /api/collections?year=&kind=` | `[Collection]` (7 mục) |
| `collection-tet-que-noi.json` | `GET /api/collections/tet-que-noi` | `{...Collection, days, route, suggestions}` |
| `collection-bin-tron-mot-tuoi.json` | `GET /api/collections/bin-tron-mot-tuoi` | như trên |
| `collection-sinh-nhat-su.json` | `GET /api/collections/sinh-nhat-su` | như trên |
| `collection-he-da-lat.json` | `GET /api/collections/he-da-lat` | như trên |
| `collection-bien-nha-trang.json` | `GET /api/collections/bien-nha-trang` | như trên |
| `collection-cuoi-tuan-o-nha.json` | `GET /api/collections/cuoi-tuan-o-nha` | như trên |
| `collection-giang-sinh-voi-ba.json` | `GET /api/collections/giang-sinh-voi-ba` | như trên |
| `timeline-2026.json` | `GET /api/timeline?year=2026` | `{months:[{month, days:[{date, collectionId, media}]}], nextCursor}` |
| `map.json` | `GET /api/map?year=&collectionId=` | `{points:[{id,lat,lon,place,count,cover,collectionId}]}` (9 nơi) |
| `search-anh-sinh-nhat-su-nam-nay.json` | `GET /api/search?q=ảnh sinh nhật Su năm nay` | `{query, filters, results, collections}` |
| `search-di-bien-thang-8.json` | `GET /api/search?q=đi biển tháng 8` | như trên |
| `search-tet-o-que.json` | `GET /api/search?q=Tết ở quê` | như trên |
| `search-anh-co-banh-kem.json` | `GET /api/search?q=ảnh có bánh kem` | như trên |
| `search-empty.json` | `GET /api/search?q=<câu lạ>` | `{query:"", filters rỗng, results:[], collections:[]}` |
| `media-status.json` | `GET /api/media/status?ids=` | `[{id, aiStatus, caption, collectionId}]` |
| `members.json` | `GET /api/members` | `[{id, name, color}]` (5 người) |
| `index.ts` | — | Bảng route + `mockGet()` / `mockFetch()` + kiểu TS dùng chung |
| `proto-photos-plugin.ts` | — | Plugin Vite phục vụ `/proto-photos/*` (mục 3) |
| `_gen.mjs` | — | Script sinh lại 20 file JSON |

`GET` nào **không** có trong mock sẽ trả `null` (web nên hiện trạng thái rỗng):
`/api/recap/2025` (khác năm 2026), mục không tồn tại, và mọi route ghi (`POST`/`PATCH`).

## 2. Cách `src/api.ts` dùng mock (khi `VITE_MOCK=1`)

```ts
import { mockFetch } from './dev/mock';

const USE_MOCK = import.meta.env.VITE_MOCK === '1';

export async function apiGet<T>(path: string, query: Record<string, string> = {}): Promise<T> {
  if (USE_MOCK) {
    const { status, body } = mockFetch('GET', path, query);   // path bắt đầu bằng "/api"
    if (status !== 200) throw new Error(`Mock: không có ${path}`);
    return body as T;
  }
  const res = await fetch(`/api${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}
```

`index.ts` còn export: `me`, `home`, `recap2026`, `collections`, `collectionDetails`,
`timeline2026`, `mapData`, `searchResults`, `searchEmpty`, `mediaStatus`, `members`,
`MOCK_FILES`, `MOCK_SEARCH_QUERIES`, `slugify()` và các kiểu `MockMedia`, `MockCollection`,
`MockCollectionDetail`, `MockHome`, `MockRecap`, `MockTimeline`, `MockMap`, `MockSearch`,
`MockMediaStatus`, `MockMember`, `MockMe`, `MockSuggestion`, `MockFlags`.
Panes khác có thể import thẳng từ `../dev/mock` (hoặc từ `src/api.ts` nếu cmd re-export).

Câu hỏi tìm kiếm được khớp theo **slug bỏ dấu, gọn**: `ảnh sinh nhật Su năm nay` →
`anh-sinh-nhat-su-nam-nay`. Câu lạ → `search-empty.json`.

## 3. Phục vụ ảnh ở `/proto-photos/`

Mọi `url.sm/lg/orig` trong JSON trỏ tới `/proto-photos/<tên>.jpg`
(cùng một tệp cho cả 3 kích thước — thư mục ảnh proto chỉ có 1 kích thước).

**Cách khuyến nghị (việc nối Vite do cmd `w1:pP` làm)** — dùng sẵn plugin trong thư mục này:

```ts
// impl/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { protoPhotos } from './src/dev/mock/proto-photos-plugin';

export default defineConfig({
  plugins: [react(), protoPhotos()],
  server: { port: 5173, proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true } } },
});
```

Cách thay thế (không cần plugin): tạo **junction** trong `impl/web/public/`:

```powershell
New-Item -ItemType Junction -Path impl/web/public/proto-photos -Target design/proto/assets/photos
```

(`publicDir` mặc định của Vite là `public/`, nên `/proto-photos/x.jpg` được phục vụ và được copy vào `dist/`.)

Cách thứ ba: đặt `publicDir` là `design/proto/assets` — nhưng khi đó URL phải đổi thành `/photos/<tên>.jpg`,
không khớp với JSON đã sinh, nên **không dùng**.

> Không copy ảnh vào `public/` (tốn dung lượng và lệch nguồn), không sinh ảnh bằng SVG/CSS.

## 4. Dữ liệu dùng trong bản mẫu

| Mục | id | kind | Tháng | Số ảnh thật | Ảnh mẫu trong `days` |
|---|---|---|---|---|---|
| Tết ở quê nội | `tet-que-noi` | `tet` | 2 | 164 | giao-thua, giao-thua-2, qua |
| Bin tròn 1 tuổi | `bin-tron-mot-tuoi` | `baby` | 3 | 98 | em-be, tay-be |
| Sinh nhật Su 7 tuổi | `sinh-nhat-su` | `birthday` | 5 | 121 | banh-sn, bong-bay, nen-sn |
| Hè ở Đà Lạt | `he-da-lat` | `trip` | 7 | 236 | van-deo, cua-so-xe, da-ngoai-ho, bien-nui, da-ngoai-cho, cho-xe |
| Biển Nha Trang | `bien-nha-trang` | `trip` | 8 | 187 | di-bien, be-nuoc, hero-co |
| Cuối tuần ở nhà | `cuoi-tuan-o-nha` | `weekend` | quanh năm (chương tháng 9) | 372 | phong-khach, bep, bo-con-mua, bo-con-doc, me-con-banh |
| Giáng sinh với bà | `giang-sinh-voi-ba` | `holiday` | 12 | 70 | ba-chau |

- `count` của mục là số ảnh **thật** của gia đình (giống bản mẫu: 164+98+121+236+187+372+70 = 1.248);
  `days[].media` chỉ là **ảnh mẫu** đủ để dựng giao diện.
- `stats`: 1.248 ảnh, 86 video, 9 nơi, 7 mục. `recap.stats` thêm `birthdays: 2`, `trips: 2`.
- 9 nơi trên bản đồ lấy đúng tọa độ + số ảnh của `design/proto/ban-do.html`
  (Hà Nội 212 + Hồ Tây 48 + Ba Vì 39 + Đồng Mô 27 + Ecopark 31 + Yên Sở 15 = 372 ảnh của mục “Cuối tuần ở nhà”).
- Ảnh lẻ chưa vào mục nào (`collectionId: null`): `hero-om`, `hero-chay`, `tk-hoang-hon` (ảnh mở màn Tổng kết),
  và `be-cuoi` — ảnh này dùng cho `home.onThisDay` (20/10/2025, đúng như bản mẫu “Ngày này năm trước”).
  Vì vậy mục “Cuối tuần ở nhà” có **5** ảnh mẫu thay vì 6 như `BRIEF_BUILD.md`, và `da-ngoai-cho.jpg`
  được đưa vào mục “Hè ở Đà Lạt” (đúng như `design/proto/muc.html`).
- **Hai điểm lệch so với `BRIEF_BUILD.md`** (giữ lại để dùng đủ 27 ảnh và giữ đúng ảnh “Ngày này năm trước” của bản mẫu):
  1. `be-cuoi.jpg` nằm ở `onThisDay` (20/10/2025) thay vì trong mục “Cuối tuần ở nhà” → mục đó còn 5 ảnh mẫu.
  2. `da-ngoai-cho.jpg` (ảnh chợ, BRIEF không gán) nằm ở mục “Hè ở Đà Lạt” → mục đó có 6 ảnh mẫu.
  `count` của mục **không đổi** theo BRIEF (372 cho “Cuối tuần ở nhà”, 236 cho “Hè ở Đà Lạt”).
- Ảnh bìa các điểm bản đồ lấy theo `ban-do.html`, trừ Ecopark: bản mẫu dùng `be-cuoi`, ở mock dùng `em-be`
  (vì `be-cuoi` đã dành cho `onThisDay`).
- `flags`: `m-dl-2` và `m-dl-5` bị mờ (`m-dl-5` đã `hidden`), `m-tet-2` và `m-wk-1` gần trùng → dùng để dựng
  thẻ “Gợi ý của AI” (mỗi mục có đủ 4 loại: `hide_blurry`, `merge`, `split`, `rename`).
- `aiStatus`: `m-hoang-hon` = `skipped`; trong `media-status.json` có thêm 3 ảnh vừa tải
  (`m-upload-28` pending, `m-upload-29` pending, `m-upload-30` failed) để dựng màn “Tải ảnh”.
- Người trong nhà: Bố Tuấn `#F6C445`, Mẹ Linh `#FFC2DB`, Su `#D9C6FF`, Bin `#BFE8D6`, Bà nội `#FFC79B`
  (màu `a1`–`a4` lấy từ `design/proto/assets/muc.css`).
- Ghi chú thời gian: dữ liệu mô phỏng **trọn năm 2026** (đã có Giáng sinh tháng 12) như bản mẫu;
  `onThisDay` lấy mốc 20/10/2025.

## 5. Kiểm tra

```bash
ls impl/web/src/dev/mock/*.json          # 20 file JSON
node tests/mock-contract.mjs              # khớp hợp đồng + đủ 27 ảnh
node -e "for (const f of require('fs').readdirSync('impl/web/src/dev/mock')) if (f.endsWith('.json')) JSON.parse(require('fs').readFileSync('impl/web/src/dev/mock/'+f,'utf8')); console.log('parse OK')"
```
