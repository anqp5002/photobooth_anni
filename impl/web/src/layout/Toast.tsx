export interface ToastProps {
  message: string | null;
}

/**
 * Thông báo nhỏ ở đáy màn hình — chép theo `design/proto/assets/app.js`.
 * Trang gọi `showToast(text)` và tự xoá sau vài giây.
 */
export function Toast({ message }: ToastProps) {
  return (
    <div className={`toast${message ? ' on' : ''}`} role="status">
      {message ?? ''}
    </div>
  );
}
