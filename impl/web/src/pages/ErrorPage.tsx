import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

/**
 * Trang lỗi dùng chung cho các trang của coder-main (`src/pages/me/`).
 * Khung r2 đã có `NotFound` riêng ở `src/layout/NotFound.tsx`; file này giữ
 * lại API cũ (`kind`) để các trang đó không phải sửa.
 */
export type ErrorKind = 'general' | 'not_found' | 'private';

const COPY: Record<ErrorKind, { title: string; text: string }> = {
  general: {
    title: 'Có gì đó chưa ổn',
    text: 'Máy chủ chưa phản hồi được. Vui lòng thử lại sau.',
  },
  not_found: {
    title: 'Không tìm thấy trang này',
    text: 'Đường dẫn có thể đã sai, hoặc nội dung đã được chuyển đi.',
  },
  private: {
    title: 'Nội dung này là riêng tư',
    text: 'Bạn cần đăng nhập đúng tài khoản của chủ nhân để xem.',
  },
};

export function ErrorPage({ kind = 'general' }: { kind?: ErrorKind }) {
  const copy = COPY[kind];
  return (
    <div className="me-page">
      <Header />
      <main className="me-main">
        <div className="me-empty">
          <div className="me-empty-title">{copy.title}</div>
          <div className="me-empty-text">{copy.text}</div>
          <Link className="btn" to="/">
            Về trang chủ
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default ErrorPage;
