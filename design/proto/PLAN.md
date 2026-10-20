# Bản mẫu giao diện r2 (hướng C): kế hoạch thiết kế

**Sản phẩm:** web kỷ niệm của một gia đình. Cả nhà tải ảnh lên, ảnh có ngày giờ và tọa độ thì tự lên bản đồ, AI gom thành các mục (chuyến đi, sinh nhật, Tết, cuối tuần…). Màn chính là Tổng kết năm và Kỷ niệm gần đây.
**Người dùng:** bố mẹ 30–45 tuổi xem trên máy tính và điện thoại, con và ông bà cùng xem. Việc chính: mở ra là thấy lại kỷ niệm đẹp nhất, bấm một lần là xem tổng kết.

## Điểm nhấn duy nhất
Hero là "bàn kỷ niệm": cụm khối 3D pastel (template Freepik) lơ lửng phía sau, 3 tấm polaroid ảnh thật cài nghiêng phía trước. Chuột di chuyển thì polaroid và khối 3D lệch nhẹ theo hai tốc độ khác nhau (parallax). Mọi thứ khác yên tĩnh.

## Màu
| Tên | Hex | Dùng |
|---|---|---|
| Hồng giấy | `#FFE4EF` | nền chính (lấy từ nền template, sáng hơn một bậc) |
| Hồng sữa | `#FFF4F8` | nền thẻ, nền vùng phụ |
| Mận | `#4A1F4F` | chữ chính, nút đặc |
| Tím khói | `#8E5A93` | chữ phụ, viền nút |
| Vàng bóng bay | `#F6C445` | điểm nhấn: huy hiệu, marker, ngôi sao |
| Đêm (chỉ màn Tổng kết) | `#0B1D26` + vàng nắng `#FBD784` | theo MNTN |

## Chữ
- **Montserrat** (theo template, có tiếng Việt): toàn bộ giao diện. Tiêu đề 700, thân 400/500.
- **Playfair Display** (có tiếng Việt): chỉ dùng ở màn Tổng kết năm và câu chú thích trên polaroid. Đây là giọng "kể chuyện".
- Thang chữ: 14 / 16 / 20 / 28 / 44 / 72. Thân 16/1.6, tối đa 68 ký tự một dòng.
- Không dùng nhãn IN HOA, không chuỗi "A · B · C", không mũi tên ở cuối nút.

## Hình khối
- Thẻ ảnh lớn bo 28px, thẻ nhỏ bo 20px, nút bo tròn hẳn. Polaroid bo 6px (giống giấy ảnh thật), viền trắng dày, bóng mềm màu mận nhạt.
- Bóng: `0 24px 60px -24px rgba(74,31,79,.35)`. Không đặt cùng một bóng dưới mọi thẻ.
- Kính mờ: nền trắng 55% + blur 18px, dùng cho lớp nổi trên ảnh và bản đồ.

## Các màn của bản mẫu
1. `index.html`, Trang chủ gia đình: hero bàn kỷ niệm; Gần đây (dải ảnh cuộn ngang); Các mục (ô ảnh nhiều cỡ khác nhau, không phải lưới thẻ đều); Ngày này năm trước (một polaroid lớn); lối vào bản đồ.
2. `tong-ket.html`, Tổng kết 2026: nền đêm, cuộn theo tháng như các chương của MNTN (số tháng lớn mờ là dòng thời gian thật), ảnh toàn màn parallax, con số của năm, cuối trang mở photobooth.
3. `muc.html`, một mục (ví dụ "Hè ở Đà Lạt"): ảnh bìa, các ngày, lưới ảnh, gợi ý của AI (gộp/tách, ảnh mờ bị ẩn).
4. `ban-do.html`, Bản đồ kỷ niệm: bản đồ vệ tinh toàn màn, marker ảnh tròn, bảng kính mờ lọc theo năm và mục.

Mỗi màn chạy được ở 1440px và 390px, có trạng thái đang tải, trống, lỗi (bật bằng `?state=loading|empty|error`).

## Tài nguyên
- Ảnh: StockSnap qua Openverse, giấy phép CC0, ghi trong `CREDITS.md`.
- Khối 3D: cắt từ template Freepik `8552753`, ghi "Designed by Freepik".
- Bản đồ: MapLibre + ảnh vệ tinh Esri World Imagery, có dòng ghi nguồn.
