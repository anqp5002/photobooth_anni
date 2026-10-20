# Brief dựng bản mẫu giao diện r2 (hướng C)

Đọc trước: `PLAN.md` (cùng thư mục, là hợp đồng thiết kế), `../STYLE_r2.md`, và mục "Áp dụng cho web kỷ niệm gia đình" ở cuối 3 file:
- `C:\Users\Pham An\cleanroom\hanh-trinh-r2-fe\popsa\FE_RULES.md`
- `C:\Users\Pham An\cleanroom\hanh-trinh-r2-fe\dayone\FE_RULES.md`
- `C:\Users\Pham An\cleanroom\hanh-trinh-r2-fe\spline\FE_RULES.md`
Có thể xem ảnh chụp trong 3 thư mục đó để hiểu kiểu nhìn, nhưng KHÔNG chép chữ, logo, ảnh của các web đó.
Ảnh mẫu MNTN cho màn Tổng kết: `../ref/mntn_full.png`. Template 3D: `D:\projects\realism-flat-design-landing-page-template\8552753.jpg`.

## Kỹ thuật
- HTML + CSS + JS thuần trong `D:\projects\hanh-trinh\design\proto\`, mở trực tiếp hoặc qua `npx serve` đều chạy. Một file `assets/style.css` dùng chung (token màu, chữ, bo góc, bóng ở `:root`), mỗi màn một file HTML, JS nhỏ trong `assets/app.js`.
- Phông Google Fonts: Montserrat (400, 500, 700, 800) và Playfair Display (500, 700, italic 500), có subset vietnamese.
- Bản đồ: MapLibre GL JS từ unpkg (ghi đúng phiên bản, ví dụ 4.7.1) với lớp raster Esri World Imagery `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`, có dòng ghi nguồn "Ảnh vệ tinh: Esri".
- Chỉ dùng ảnh trong `assets/photos/` và `assets/cluster3d.png` (nguồn ghi ở `CREDITS.md`). Không vẽ ảnh bằng SVG/CSS, không dùng nền màu đặc phẳng cho vùng lớn (dùng gradient pastel mờ như popsa, hoặc ảnh). Icon: dùng bộ icon MIT (Lucide qua unpkg) hoặc SVG nét đơn giản.
- Parallax và chuyển động: chỉ một khoảnh khắc chính ở hero (chuột di chuyển thì polaroid và cụm 3D lệch hai tốc độ) và hiệu ứng cuộn ở màn Tổng kết. Tôn trọng `prefers-reduced-motion` (tắt parallax, giữ ảnh tĩnh).
- Responsive 1440 và 390, không tràn ngang, vùng chạm ≥ 44px, focus bàn phím thấy rõ, tương phản chữ đạt AA.
- Mỗi màn hỗ trợ `?state=loading` (khung xương), `?state=empty` (lời mời hành động, ví dụ "Chưa có ảnh nào. Tải ảnh đầu tiên lên"), `?state=error` (nói rõ lỗi và nút thử lại).

## Nội dung (tiếng Việt, giọng gần gũi, không quảng cáo)
Gia đình mẫu "Nhà Bin & Su": bố Tuấn, mẹ Linh, Su (7 tuổi), Bin (1 tuổi), bà nội. Năm 2026: 1.248 ảnh, 86 video, 9 nơi đã đến, 7 mục kỷ niệm.
Các mục (ảnh dùng):
1. Tết ở quê nội Nam Định, tháng 2: `giao-thua.jpg`, `giao-thua-2.jpg`, `qua.jpg`
2. Bin tròn 1 tuổi, tháng 3: `em-be.jpg`, `tay-be.jpg`
3. Sinh nhật Su 7 tuổi, tháng 5: `banh-sn.jpg`, `bong-bay.jpg`, `nen-sn.jpg`
4. Hè ở Đà Lạt, tháng 7: `bien-nui.jpg`, `da-ngoai-ho.jpg`, `van-deo.jpg`, `cua-so-xe.jpg`, `cho-xe.jpg` (đây là mục dùng cho `muc.html`)
5. Biển Nha Trang, tháng 8: `di-bien.jpg`, `be-nuoc.jpg`, `hero-co.jpg`
6. Cuối tuần ở nhà (Hà Nội), quanh năm: `phong-khach.jpg`, `bep.jpg`, `bo-con-mua.jpg`, `bo-con-doc.jpg`, `me-con-banh.jpg`, `be-cuoi.jpg`
7. Giáng sinh với bà, tháng 12: `ba-chau.jpg`
Ảnh hero trang chủ (3 polaroid): `hero-om.jpg`, `hero-chay.jpg`, `hero-co.jpg`. Ảnh mở màn Tổng kết: `tk-hoang-hon.jpg`.
Tọa độ cho bản đồ: Hà Nội 21.03,105.85; Nam Định 20.42,106.17; Đà Lạt 11.94,108.44; Nha Trang 12.24,109.19; thêm vài điểm cuối tuần quanh Hà Nội.

## Bốn màn
1. `index.html` Trang chủ gia đình (nền sáng pastel): hero bàn kỷ niệm (chữ bên trái: lời chào nhà mình + nút "Xem tổng kết 2026" và "Tải ảnh lên"; bên phải cụm 3D + 3 polaroid nghiêng có chú thích chữ Playfair italic); "Gần đây" dải ảnh cuộn ngang (tỉ lệ xen vuông và dọc như popsa); "Các mục của năm" ô ảnh nhiều cỡ (không phải lưới đều), chữ trắng trên lớp tối dần; "Ngày này năm trước" một polaroid lớn kiểu Day One (mốc tương đối + ngày đủ thứ); thẻ lối vào bản đồ (ảnh bản đồ thật thu nhỏ hoặc bản đồ MapLibre nhỏ); footer gọn.
2. `tong-ket.html` Tổng kết 2026 (nền đêm #0B1D26, vàng #FBD784, Playfair): mở màn ảnh hoàng hôn toàn màn chìm dần vào nền; dải con số của năm (ảnh, video, nơi, mục); các chương theo tháng xen trái/phải kiểu MNTN với số tháng lớn mờ (đây là dòng thời gian thật nên số là hợp lý); ảnh bo 24px; thanh dọc bên phải báo chương; cuối trang "Ghép dải ảnh kỷ niệm" mở photobooth (nút) và "Chia sẻ với cả nhà".
3. `muc.html` Hè ở Đà Lạt: ảnh bìa lớn bo tròn với tiêu đề; thông tin ngày, nơi, ai có mặt (avatar chữ cái); bản đồ nhỏ tuyến đi; các ngày (Ngày 1, 2, 3) mỗi ngày một lưới ảnh; thẻ "Gợi ý của AI" (ví dụ: "3 ảnh bị mờ đã được ẩn", "Gộp với mục Cuối tuần ở nhà?") có nút nhận/bỏ qua.
4. `ban-do.html` Bản đồ kỷ niệm: bản đồ vệ tinh toàn màn, marker là ảnh tròn viền trắng có số lượng; bảng kính mờ bên trái (trên điện thoại là tấm kéo từ dưới lên) lọc theo năm và mục, danh sách nơi; bấm marker mở thẻ xem ảnh.
Thanh điều hướng chung: logo chữ "Hành Trình" + các mục Trang chủ, Tổng kết, Bản đồ, Tải ảnh, avatar gia đình.

## Kiểm tra trước khi báo xong
- Chụp màn hình bằng Playwright (đã có trên máy; nếu thiếu thì `npx playwright`) mỗi màn ở 1440x900 (đầu trang + 1 vị trí cuộn) và 390x844, lưu `shots/<man>-<kho>.png`. Mở từng ảnh xem lại và sửa đến khi đẹp: hỏi "có đẹp, có nhớ được không, có giống phong cách đã chốt không".
- Soát lỗi giao diện mặc định: không nhãn IN HOA giãn chữ trên mọi tiêu đề, không mũi tên "→" cuối nút, không lưới thẻ đều nhau, không cùng một bóng dưới mọi thẻ, không nền kem #F4F1EA + cam đất.
- Không lỗi console.

Báo cáo cuối (ngắn): danh sách file, đường dẫn ảnh chụp, điểm còn yếu.
