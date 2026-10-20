# Máy chủ Hành Trình (`impl/server`)

Node 26 + Fastify + `node:sqlite` + sharp + exifr. Phục vụ luôn bản dựng web ở `impl/web/dist`.

## Chạy

```bash
npm install
node scripts/seed.js      # user minh / hanhtrinh123 + chuyến công khai "Xuyen Viet"
node src/index.js         # http://localhost:8787
npm test                  # test đơn vị + test API (node --test)
```

Biến môi trường:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `8787` | cổng |
| `HOST` | `0.0.0.0` | địa chỉ nghe |
| `DB_PATH` | `.data/hanh-trinh.db` | tệp SQLite |
| `MEDIA_DIR` | `.data/media` | kho ảnh `<mã>/{orig,lg,sm}` |
| `WEB_DIST` | `impl/web/dist` | bản dựng web để phục vụ + SPA fallback |
| `AI_PROVIDER` | `none` | `none` = chỉ heuristic local; đặt URL `http(s)://…` để gọi LLM (lỗi không chặng) |
| `SESSION_DAYS` | `30` | hạn cookie phiên |
| `COOKIE_SECURE` | `0` | `1` khi chạy HTTPS |
| `CORS_ORIGINS` | `localhost:5173,127.0.0.1:5173,…` | nguồn được gọi API khi `vite dev` |

## API (theo `MEGAPLAN_r1.md` mục "Hợp đồng API")

Đọc công khai: `GET /api/users/:username`, `GET /api/trips/:id?limit=`, `GET /api/trips/:id/steps?offset=&limit=`.
Tài khoản: `POST /api/auth/register|login|logout`, `GET /api/me` (401 khi chưa đăng nhập). Cookie `sid` httpOnly.
Chủ chuyến: `POST /api/trips`, `POST /api/trips/:id/media` (multipart), `PATCH /api/trips/:id`, `PATCH /api/steps/:id`,
`POST /api/media/:id/move`, `POST /api/steps/:id/merge|split|strips`, `PATCH /api/media/:id`.
Ảnh: `/media/<mã>/{orig,lg,sm}.jpg` — `cache-control: public, max-age=31536000, immutable` + `ETag`.

## Quyết định kỹ thuật (ghi lại theo yêu cầu SPEC mục "Điều chưa biết")

- **Chia chặng (B-02)**: hai mục liền nhau (đã sắp theo thời gian) cùng có GPS, cách ≤ 3 giờ và ≤ 5 km → cùng chặng.
  Ảnh có thời gian nhưng không GPS gán vào chặng gần nhất theo thời gian; ảnh có GPS nhưng không thời gian gán theo khoảng cách (≤ 200 km);
  ảnh không có cả hai nằm ở `step_id = NULL` ("chưa xếp", chủ chuyến thấy ở trường `unsorted`).
  Chặng do máy tạo (`steps.auto = 1`) được chia lại sau mỗi lần tải lên; chặng người dùng đã sửa/gộp/tách (`auto = 0`) được giữ nguyên.
- **Địa danh**: `cities15000.txt` nạp vào bộ nhớ, tra theo lưới 0,5°; tên hiển thị tiếng Việt cho các thành phố lớn, sửa ký tự `Ð` của GeoNames thành `Đ`.
  Nước lấy từ `countryInfo.txt`.
- **Quãng đường**: tổng khoảng cách haversine giữa các chặng liên tiếp có toạ độ. **Số ngày**: chênh ngày lịch từ bắt đầu tới `ended_at` (chưa kết thúc thì tới hôm nay).
  `started_at`/`ended_at` của chuyến tự cập nhật theo media (kết thúc = mốc media mới nhất).
- **Tuyến**: không dùng dịch vụ chỉ đường trả phí nên mọi đoạn là `kind: "straight"` (2 điểm, polyline độ chính xác 5); giao diện tự vẽ nét đứt cho `plane`.
  Phương tiện ước lượng theo quãng đường/thời gian, người dùng sửa được ở giao diện.
- **Ảnh**: JPEG/PNG/WebP/HEIC giữ tệp gốc, sinh `lg.jpg` (cạnh dài ≤ 1280) và `sm.jpg` (≤ 400). HEIC không giải mã được bằng libvips
  vẫn được nhận: giữ tệp gốc + ảnh giữ chỗ (không chặn các tệp khác). Video MP4/MOV: giữ gốc, đọc thời lượng/kích thước từ hộp `mvhd`/`tkhd`,
  ảnh bìa sinh bằng code (không có ffmpeg trong ngăn xếp).
- **EXIF**: thời gian chụp đọc bằng exifr, hiểu theo múi giờ của máy chủ (EXIF không lưu múi giờ). Ảnh thiếu EXIF vẫn vào chuyến, xếp theo quy tắc B-02.
- **AI (B-03)**: heuristic local luôn chạy — ảnh mờ = phương sai Laplacian < 80; gần trùng = dHash Hamming ≤ 6 trong cùng chặng;
  tên nháp `"<buổi> ở <địa danh>"`; mô tả nháp `"<n> ảnh, <giờ đầu>–<giờ cuối>"`. `AI_PROVIDER` chỉ là chỗ cắm thêm; lỗi nhà cung cấp → bỏ gợi ý, chuyến vẫn tạo xong.
- **Quyền riêng tư (B-06)**: chuyến mới mặc định `private`; người không phải chủ xem chuyến riêng tư → 403 `{"error":"private"}`;
  toạ độ làm tròn 2 số lẻ; ẩn ảnh (`hidden`) chỉ chủ thấy.
- **Cache/nén**: dữ liệu API `cache-control: no-store`, nén brotli/gzip khi phản hồi ≥ 512 byte; ảnh và tài sản tĩnh cache 1 năm.

## Ghi công dữ liệu

Địa danh và mã nước: GeoNames (`cities15000.txt`, `countryInfo.txt`), CC BY 4.0 — xem `data/CREDITS.md`.
