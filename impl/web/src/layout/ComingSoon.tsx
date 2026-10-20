import type { ReactNode } from 'react';
import { StateBox } from './PageState';

export interface ComingSoonProps {
  title: string;
  text: string;
  action?: ReactNode;
}

/**
 * Trang nhóm B đang được coder-2 (w1:pN) dựng — khung r2 (header, thanh thông báo,
 * drawer, trạng thái rỗng) đã có sẵn nên chỉ cần thay phần nội dung.
 */
export function ComingSoon({ title, text, action }: ComingSoonProps) {
  return (
    <main id="main">
      <StateBox kind="empty" title={title} text={text} action={action} />
    </main>
  );
}
