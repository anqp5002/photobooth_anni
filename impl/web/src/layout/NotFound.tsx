import { Link } from 'react-router-dom';
import { StateBox } from './PageState';

/** Trang 404 — cùng khung trạng thái của bản mẫu. */
export function NotFound() {
  return (
    <main id="main">
      <StateBox
        kind="error"
        title="Không tìm thấy trang này"
        text="Có thể đường dẫn bị sai, hoặc mục kỷ niệm này đã được chuyển đi."
        action={
          <Link className="btn dac" to="/">
            Về trang chủ
          </Link>
        }
      />
    </main>
  );
}
