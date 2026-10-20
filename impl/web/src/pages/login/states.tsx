/**
 * Trạng thái **đang tải / rỗng / lỗi** dùng chung cho các trang nhóm B (G5).
 *
 * TASK_G5 đặt tệp này trong `pages/login/` nhưng nó phục vụ cả
 * `pages/search` (G2), `pages/upload` (G3) và `pages/collection` (G1):
 * mọi trang dùng đúng một kiểu khung xương, một kiểu hộp rỗng, một kiểu hộp lỗi
 * (giống `.sk` / `.sv-box` của bản mẫu `design/proto/assets/`).
 *
 * - `PageStates`: thay cả nội dung trang khi đang tải / rỗng / lỗi.
 * - `LoadingBlock` + `InlineState`: dùng cho một khối nhỏ (lưới kết quả, danh sách gợi ý).
 * - `demoStateOf`: đọc `?state=loading|empty|error` để chụp ảnh trạng thái như bản mẫu.
 */
import type { ReactNode } from 'react';
import { AlertIcon, ImageIcon, RefreshIcon } from '../../layout/Icons';
import './states.css';

export type ViewState = 'loading' | 'empty' | 'error' | 'ready';

/** `?state=…` của bản mẫu; trả `undefined` khi không ép trạng thái. */
export function demoStateOf(raw: string | null): Exclude<ViewState, 'ready'> | undefined {
  return raw === 'loading' || raw === 'empty' || raw === 'error' ? raw : undefined;
}

export interface RetryProps {
  onRetry: () => void;
  label?: string;
}

/** Nút "Thử lại" của hộp lỗi. */
export function RetryAction({ onRetry, label = 'Thử lại' }: RetryProps) {
  return (
    <button type="button" className="btn dac nho" onClick={onRetry}>
      <RefreshIcon size={18} />
      {label}
    </button>
  );
}

export interface LoadingBlockProps {
  /** Nhãn đọc cho trình đọc màn hình, ví dụ "Đang tải kết quả". */
  label?: string;
  /** Số dòng chữ mờ phía trên lưới. */
  lines?: number;
  /** Số ô ảnh mờ. `0` = chỉ hiện dòng chữ. */
  tiles?: number;
}

/** Khung xương: vài dòng chữ mờ + lưới ô ảnh mờ (cùng kiểu `.sk` của bản mẫu). */
export function LoadingBlock({ label = 'Đang tải', lines = 2, tiles = 3 }: LoadingBlockProps) {
  return (
    <div className="b-loading" aria-busy="true" aria-label={label}>
      <div className="sk b-loading-title" />
      {Array.from({ length: lines }).map((_, index) => (
        <div className="sk b-loading-line" key={index} />
      ))}
      {tiles > 0 ? (
        <div className={`b-loading-grid is-${Math.min(tiles, 4)}`}>
          {Array.from({ length: tiles }).map((_, index) => (
            <div className="sk" key={index} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface InlineStateProps {
  kind: 'empty' | 'error';
  title: string;
  text?: ReactNode;
  action?: ReactNode;
  /** `is-page`: hộp lớn giữa trang (thay cả nội dung), mặc định là hộp trong một khối. */
  full?: boolean;
}

/** Hộp rỗng / lỗi. Dùng `full` khi nó thay cả nội dung trang. */
export function InlineState({ kind, title, text, action, full = false }: InlineStateProps) {
  return (
    <div
      className={`b-state b-state-${kind}${full ? ' is-page' : ''}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span className="b-state-icon">
        {kind === 'error' ? <AlertIcon size={30} /> : <ImageIcon size={30} />}
      </span>
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
      {action ? <div className="b-state-action">{action}</div> : null}
    </div>
  );
}

export interface PageStatesProps {
  state: ViewState;
  children?: ReactNode;
  loadingLabel?: string;
  /** Số ô ảnh mờ trong khung xương. */
  loadingTiles?: number;
  emptyTitle?: string;
  emptyText?: ReactNode;
  emptyAction?: ReactNode;
  errorTitle?: string;
  errorText?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * Ba trạng thái của một trang: đang tải (khung xương), rỗng, lỗi.
 * `ready` thì render `children`.
 */
export function PageStates({
  state,
  children,
  loadingLabel = 'Đang tải',
  loadingTiles = 3,
  emptyTitle = 'Chưa có gì ở đây',
  emptyText,
  emptyAction,
  errorTitle = 'Chưa tải được dữ liệu',
  errorText = 'Kết nối bị gián đoạn. Kiểm tra mạng rồi thử lại.',
  onRetry,
  retryLabel,
}: PageStatesProps) {
  if (state === 'loading') {
    return (
      <div className="b-page-state">
        <LoadingBlock label={loadingLabel} tiles={loadingTiles} />
      </div>
    );
  }
  if (state === 'empty') {
    return (
      <InlineState
        kind="empty"
        full
        title={emptyTitle}
        text={emptyText}
        action={emptyAction}
      />
    );
  }
  if (state === 'error') {
    return (
      <InlineState
        kind="error"
        full
        title={errorTitle}
        text={errorText}
        action={onRetry ? <RetryAction onRetry={onRetry} label={retryLabel} /> : undefined}
      />
    );
  }
  return <>{children}</>;
}
