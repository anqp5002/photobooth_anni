/** Thanh thông báo trên cùng — chép theo `design/proto/assets/app.js` (biến ANN). */
const NOTICES: Record<string, string> = {
  home: 'Tổng kết năm {year} của nhà mình đã sẵn sàng',
  tk: 'Tổng kết năm {year} của nhà mình đã sẵn sàng',
  map: '9 nơi nhà mình đã đến trong năm nay',
  muc: 'Mục này có 2 gợi ý mới từ AI đang chờ bạn',
  timeline: 'Kéo xuống để xem ảnh theo từng tháng',
  search: 'Tìm ảnh bằng câu nói thường, ví dụ "ảnh sinh nhật Su năm nay"',
  upload: 'Ảnh có ngày giờ và vị trí sẽ tự về đúng mục',
  booth: 'Chọn ảnh rồi ghép thành dải để in',
  login: 'Đăng nhập để xem kỷ niệm của nhà mình',
};

export interface AnnouncementBarProps {
  /** Khoá trang: home, tk, map, muc… xem `pageKey` trong AppLayout. */
  page: string;
  year?: number;
}

export function AnnouncementBar({ page, year }: AnnouncementBarProps) {
  const template = NOTICES[page] ?? NOTICES.home;
  return (
    <div className="ann" role="note">
      <span className="ann-t">
        {template.replace('{year}', String(year ?? new Date().getFullYear()))}
      </span>
    </div>
  );
}
