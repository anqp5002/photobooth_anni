# Phong cách giao diện r2: kỷ niệm gia đình

## Hướng đã chốt: C (anh An chọn 20/10/2026)
- Toàn web: **nền sáng pastel ấm**. Ảnh gia đình thật đặt trong **khung polaroid hoặc thẻ bo tròn**, xung quanh vài **khối 3D bay** (bóng bay, vòng, ngôi sao, cầu bóng) cho vui. Nút bo tròn hẳn, viền hoặc đặc.
- Riêng màn **Tổng kết năm**: chuyển sang **tối điện ảnh kiểu MNTN** (mục dưới) để tạo khoảnh khắc "xem lại cả năm".

### Mẫu 3D realism pastel (`D:\projects\realism-flat-design-landing-page-template`, Freepik, ghi nguồn "Designed by Freepik")
- Nền hồng phấn sáng, mảng chéo nhạt hơn ở góc trái; cụm khối 3D (cầu bóng, vòng, nón, đĩa sọc) màu hồng, tím, vàng chiếm nửa trái, vài khối nhỏ mờ (depth of field) bay rải rác.
- Chữ **Montserrat**: dòng phụ mảnh (light) cỡ vừa, tiêu đề đậm (bold) lớn màu tím mận, thân màu tím nhạt. Nút bo tròn: một nút viền, một nút đặc tím. Chấm chuyển trang dọc ở góc phải dưới; mạng xã hội ở góc trái dưới.
- Lấy cho web: cách đặt cụm 3D lệch một bên làm "nhân vật phụ" cạnh ảnh thật; khối mờ tạo chiều sâu; bảng màu hồng–tím–vàng làm màu nhấn trên nền kem ấm.

# Mẫu tối điện ảnh MNTN (cho màn Tổng kết năm)

Nguồn tham chiếu: Figma Community "MNTN – Landing Page" (ảnh: `ref/mntn_full.png`), đọc qua Figma MCP ngày 20/10/2026.
Áp cho web Hành Trình r2 (tổng kết kỷ niệm gia đình). Bố cục chặng/bản đồ vẫn lấy nhóm "Quy tắc thiết kế FE" của SPEC.

## Tinh thần
Điện ảnh, tối, ảnh thật làm nhân vật chính, chữ serif lớn như tạp chí. Mỗi mùa/mục kỷ niệm là một "chương" có số thứ tự lớn mờ phía sau.

## Token (đo từ file Figma)
| Token | Giá trị MNTN | Dùng cho Hành Trình |
|---|---|---|
| Nền | `#0B1D26` (xanh đêm) | nền trang, nền dưới hero |
| Nhấn | `#FBD784` (vàng nắng) | tagline, đường kẻ 72×2px, link "xem tiếp" |
| Chữ | `#FFFFFF` | toàn bộ chữ trên nền tối |
| Bóng | drop shadow `#00000033`, blur 100 | thẻ ảnh nổi trên nền |
| Tiêu đề hero | serif ~88px, 2 dòng | "Một năm của nhà mình" |
| Tiêu đề chương | serif 64px, rộng ~555px | tên mục: "Tết ở quê", "Hè Đà Lạt" |
| Tagline | 18px, đậm, IN HOA, giãn chữ 6px, có vạch 72×2 bên trái | ngày tháng · địa điểm |
| Thân | 18px / dòng 32px, rộng ≤ 632px | mô tả, AI viết tóm tắt |
| Số chương | 240px, đậm, opacity 0.1 | 01, 02… hoặc số tháng |

Phông MNTN (Chronicle Display, Gilroy) là phông trả phí và không có dấu tiếng Việt. Thay bằng phông OFL có tiếng Việt: tiêu đề **Playfair Display** (hoặc Noto Serif Display), thân **Be Vietnam Pro**.

## Bố cục
1. **Hero toàn màn** cao ~1200px: ảnh gia đình thật tách 3 lớp (nền trời, núi/cảnh giữa, tiền cảnh) cuộn parallax khác tốc độ, chữ nằm giữa các lớp. Header mỏng trong suốt ở trên. Thanh dọc bên phải "Bắt đầu · 01 · 02 · 03" báo đang ở chương nào.
2. **Các chương xen kẽ trái/phải**: một khối ảnh dọc ~566×720 và một khối chữ (tagline, tiêu đề, đoạn văn, "xem tiếp"), số chương khổng lồ mờ chồng lên mép ảnh. Khoảng cách giữa các chương ~200px.
3. Nền tối liền mạch từ hero xuống chương (hero có gradient chìm dần vào `#0B1D26`), không có dải màu đặc tách khối.
4. Footer tối, 3 cột link, chữ nhỏ.

## Điều chỉnh theo yêu cầu anh An
- **Box bo tròn**: MNTN dùng ảnh góc vuông; Hành Trình bo 24px cho thẻ ảnh, 16px cho thẻ nhỏ, nút bo tròn hẳn.
- **Ảnh thật màu đẹp**: không ảnh tự vẽ, không nền màu đặc. Ảnh demo lấy Unsplash/Pexels (ghi nguồn trong `CREDITS.md`), ảnh thật của gia đình khi anh An đưa.
- Thẻ kính mờ (blur nền) cho lớp nổi trên ảnh và bản đồ.

## Ánh xạ sang màn của web kỷ niệm
| Màn | Dùng mẫu nào |
|---|---|
| Trang chủ / Tổng kết năm | Hero parallax + các chương xen kẽ (mỗi chương = một mục kỷ niệm do AI gom) |
| Kỷ niệm gần đây | Chương ngắn, ảnh lớn, tagline "tuần này năm trước" |
| Bản đồ kỷ niệm | Bản đồ vệ tinh toàn màn, thẻ bo tròn kính mờ, marker ảnh tròn |
| Story / photobooth | Toàn màn ảnh, chữ serif trắng, nút bo tròn vàng nhấn |
