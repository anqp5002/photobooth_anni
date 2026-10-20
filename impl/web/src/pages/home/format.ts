import type { Collection } from '../../api';

const MONTHS = [
  'tháng 1',
  'tháng 2',
  'tháng 3',
  'tháng 4',
  'tháng 5',
  'tháng 6',
  'tháng 7',
  'tháng 8',
  'tháng 9',
  'tháng 10',
  'tháng 11',
  'tháng 12',
];

/** "tháng 2" — tháng của chuỗi ISO. */
export function monthLabel(iso: string): string {
  const month = Number(iso.slice(5, 7));
  return MONTHS[month - 1] ?? '';
}

/** "Nam Định, tháng 2, 164 ảnh" — dòng phụ dưới tên mục. */
export function collectionLine(collection: Collection): string {
  const start = new Date(collection.startAt);
  const end = new Date(collection.endAt);
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  const when = sameMonth ? monthLabel(collection.startAt) : 'quanh năm';
  const place = collection.place ? `${collection.place}, ` : '';
  return `${place}${when}, ${collection.count.toLocaleString('vi-VN')} ảnh`;
}

const DAY = 24 * 60 * 60 * 1000;

/** Nhãn thời gian tương đối trên ảnh gần đây: "Hôm qua", "3 ngày trước"… */
export function relativeLabel(iso: string, now: Date = new Date()): string {
  const taken = new Date(iso).getTime();
  if (Number.isNaN(taken)) return '';
  const days = Math.floor((now.getTime() - taken) / DAY);
  if (days <= 0) return 'Hôm nay';
  if (days === 1) return 'Hôm qua';
  if (days < 7) return `${days} ngày trước`;
  if (days < 14) return 'Tuần trước';
  if (days < 21) return '2 tuần trước';
  if (days < 31) return '3 tuần trước';
  return 'Tháng trước';
}

/** "Thứ Hai, 20 tháng 10, 2025" — kiểu bản mẫu ở mục "Ngày này năm trước". */
export function longDate(iso: string): string {
  const date = new Date(iso);
  const weekdays = [
    'Chủ Nhật',
    'Thứ Hai',
    'Thứ Ba',
    'Thứ Tư',
    'Thứ Năm',
    'Thứ Sáu',
    'Thứ Bảy',
  ];
  return `${weekdays[date.getDay()]}, ${date.getDate()} ${monthLabel(iso)}, ${date.getFullYear()}`;
}
