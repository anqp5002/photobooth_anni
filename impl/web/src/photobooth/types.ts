/**
 * Photobooth — kiểu dùng chung.
 * Module TS thuần (không React), mọi thứ chạy trong trình duyệt.
 */

export interface PhotoboothOptions {
  /** Tiêu đề dải ảnh mặc định (B-05: tên chuyến). Rỗng thì dùng "KỶ NIỆM". */
  title?: string;
  /** Ảnh nguồn có sẵn (B-05: ảnh của chuyến). Chỉ là URL cùng nguồn gốc. */
  sourcePhotos?: string[];
  /** Có thì hiện nút "lưu vào chuyến" trong hộp xuất. */
  onSaveToTrip?: (png: Blob) => Promise<void>;
}

export type ScreenName = 'entry' | 'camera' | 'editor';

export type Orientation = 'landscape' | 'portrait';

export type PhotoCount = 2 | 3 | 4 | 5 | 6;

export type TimerSeconds = 0 | 3 | 5 | 10;

/** Ảnh nguồn: ảnh vừa chụp (canvas đã lật + đã lọc) hoặc ảnh tải lên. */
export interface PhotoEntry {
  id: string;
  source: CanvasImageSource;
  width: number;
  height: number;
  alt: string;
  /** Ảnh chụp từ camera (đã in bộ lọc) hay ảnh tải lên. */
  origin: 'camera' | 'upload';
}

/** Vị trí + phóng của ảnh trong ô. dx/dy tính bằng đơn vị gốc của dải. */
export interface PhotoTransform {
  scale: number;
  dx: number;
  dy: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}

export interface StripStyle {
  title: string;
  color: string;
}

export interface AppState {
  screen: ScreenName;
  count: PhotoCount;
  timer: TimerSeconds;
  orientation: Orientation;
  filterId: string;
  soundOn: boolean;
  photos: PhotoEntry[];
  /** Tổng số ảnh của phiên chụp hiện tại (khi quay lại camera vẫn giữ). */
  sessionTotal: number;
  running: boolean;
  layoutId: string;
  color: string;
  title: string;
  transforms: PhotoTransform[];
  selected: number;
  tab: 'style' | 'color';
  cameraError: CameraError | null;
  cameraReady: boolean;
}

export type CameraErrorKind =
  | 'denied'
  | 'unsupported'
  | 'insecure'
  | 'notfound'
  | 'inuse'
  | 'overconstrained'
  | 'other';

export interface CameraError {
  kind: CameraErrorKind;
  message: string;
  detail?: string;
}
