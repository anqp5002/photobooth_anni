import { useEffect, type ReactNode } from 'react';
import { AlertIcon, ImageIcon, RefreshIcon } from './Icons';

export type ViewState = 'loading' | 'empty' | 'error' | 'ready';

/** Khung xương lúc đang tải — chép theo `design/proto/assets/app.js`. */
export function LoadingSkeleton() {
  return (
    <section className="state-view sv-loading" aria-busy="true">
      <div className="wrap">
        <div className="sk" style={{ height: 56, width: 'min(420px,80%)', marginTop: 190 }} />
        <div className="sk" style={{ height: 22, width: 'min(560px,90%)', marginTop: 16 }} />
        <div className="sk-grid">
          <div className="sk" />
          <div className="sk" />
          <div className="sk" />
        </div>
      </div>
    </section>
  );
}

export interface StateBoxProps {
  kind: 'empty' | 'error';
  title: string;
  text: string;
  /** Nút hành động (nút đăng nhập lại, nút tải ảnh…). */
  action?: ReactNode;
}

/** Hộp trạng thái rỗng / lỗi — chép theo `design/proto/assets/app.js`. */
export function StateBox({ kind, title, text, action }: StateBoxProps) {
  return (
    <section className={`state-view sv-${kind}`}>
      <div className="wrap">
        <div className="sv-box">
          <div className="dot">{kind === 'error' ? <AlertIcon size={32} /> : <ImageIcon size={32} />}</div>
          <h2>{title}</h2>
          <p>{text}</p>
          {action}
        </div>
      </div>
    </section>
  );
}

export interface PageStateProps {
  state: ViewState;
  children: ReactNode;
  /** Nội dung khi rỗng. */
  emptyTitle?: string;
  emptyText?: string;
  emptyAction?: ReactNode;
  /** Nội dung khi lỗi. */
  errorTitle?: string;
  errorText?: string;
  errorAction?: ReactNode;
}

const DEFAULT_EMPTY_TITLE = 'Chưa có ảnh nào';
const DEFAULT_EMPTY_TEXT =
  'Tải ảnh đầu tiên của nhà mình lên, mình sẽ gom lại thành từng mục kỷ niệm.';
const DEFAULT_ERROR_TITLE = 'Chưa tải được kỷ niệm của nhà mình';
const DEFAULT_ERROR_TEXT =
  'Kết nối bị gián đoạn nên mình chưa lấy được dữ liệu. Kiểm tra mạng rồi thử lại.';

/**
 * Bọc nội dung trang và quản lý trạng thái `body[data-state]`
 * (bản mẫu dùng thuộc tính này để ẩn nội dung khi đang tải / rỗng / lỗi).
 */
export function PageState({
  state,
  children,
  emptyTitle = DEFAULT_EMPTY_TITLE,
  emptyText = DEFAULT_EMPTY_TEXT,
  emptyAction,
  errorTitle = DEFAULT_ERROR_TITLE,
  errorText = DEFAULT_ERROR_TEXT,
  errorAction,
}: PageStateProps) {
  useEffect(() => {
    if (state === 'ready') {
      delete document.body.dataset.state;
      return undefined;
    }
    document.body.dataset.state = state;
    return () => {
      delete document.body.dataset.state;
    };
  }, [state]);

  if (state === 'loading') return <LoadingSkeleton />;
  if (state === 'empty') {
    return <StateBox kind="empty" title={emptyTitle} text={emptyText} action={emptyAction} />;
  }
  if (state === 'error') {
    return <StateBox kind="error" title={errorTitle} text={errorText} action={errorAction} />;
  }
  return <>{children}</>;
}

/** Nút "Thử lại" dùng chung cho trạng thái lỗi. */
export function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button type="button" className="btn dac" onClick={onRetry}>
      <RefreshIcon size={20} />
      Thử lại
    </button>
  );
}
