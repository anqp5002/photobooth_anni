/**
 * Trang nhóm B — coder-2 (w1:pN) sở hữu (G1: trang một mục kỷ niệm).
 *
 * Bản dựng hiện tại của coder-2 nằm ở `src/pages/collection/`, tự mang header
 * riêng (`ProtoHeader`) nên route này chưa đặt trong `AppLayout` để tránh
 * trùng header. Khi chuyển mã sang thư mục này, bỏ `ProtoHeader` đi để dùng
 * chung khung r2 (header + thanh thông báo + drawer).
 */
import { useSearchParams } from 'react-router-dom';
import { CollectionPage } from '../collection';

export function MucPage() {
  const [params] = useSearchParams();
  const raw = params.get('state');
  const demo =
    raw === 'loading' || raw === 'empty' || raw === 'error' ? raw : undefined;
  return <CollectionPage demo={demo} />;
}

export default MucPage;
