/** Năm đang xem — dùng cho trang tổng kết và thông báo trên cùng. */
export const CURRENT_YEAR = new Date().getFullYear();

export interface NavLink {
  to: string;
  label: string;
  /** Tiền tố đường dẫn để tô đậm mục đang mở. */
  match: string;
}

/** Menu ngang trên desktop — giống bản mẫu `design/proto/assets/app.js`. */
export const NAV_LINKS: NavLink[] = [
  { to: '/', label: 'Trang chủ', match: '/' },
  { to: `/tong-ket/${CURRENT_YEAR}`, label: 'Tổng kết', match: '/tong-ket' },
  { to: '/ban-do', label: 'Bản đồ', match: '/ban-do' },
];

/** Menu của drawer điện thoại — thêm các mục chỉ có ở kích thước nhỏ. */
export const DRAWER_LINKS: NavLink[] = [
  ...NAV_LINKS,
  { to: '/dong-thoi-gian', label: 'Dòng thời gian', match: '/dong-thoi-gian' },
  { to: '/tim-kiem', label: 'Tìm ảnh', match: '/tim-kiem' },
  { to: '/tai-anh', label: 'Tải ảnh lên', match: '/tai-anh' },
  { to: '/photobooth', label: 'Photobooth', match: '/photobooth' },
];

/** Mục đang mở: `/` khớp đúng, còn lại khớp theo tiền tố. */
export function isCurrent(pathname: string, match: string): boolean {
  return match === '/' ? pathname === '/' : pathname.startsWith(match);
}
