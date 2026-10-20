import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { type Me } from '../api';
import { AnnouncementBar } from './AnnouncementBar';
import { Drawer } from './Drawer';
import { Header } from './Header';
import { getFamily } from './family';
import { CURRENT_YEAR } from './nav';

/** Khoá trang để CSS bản mẫu tô màu đúng (body[data-page=…]). */
export function pageKey(pathname: string): string {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/tong-ket')) return 'tk';
  if (pathname.startsWith('/muc')) return 'muc';
  if (pathname.startsWith('/ban-do')) return 'map';
  if (pathname.startsWith('/dong-thoi-gian')) return 'timeline';
  if (pathname.startsWith('/tim-kiem')) return 'search';
  if (pathname.startsWith('/tai-anh')) return 'upload';
  if (pathname.startsWith('/photobooth')) return 'booth';
  if (pathname.startsWith('/dang-nhap') || pathname.startsWith('/login')) return 'login';
  return 'other';
}

function initialOf(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return (first[0] ?? '?').toUpperCase();
}

/**
 * Khung chung của mọi trang: thanh thông báo + header trong suốt + drawer điện thoại.
 * Đặt `body[data-page]` và `body.dark` đúng như bản mẫu.
 */
export function AppLayout() {
  const { pathname } = useLocation();
  const page = pageKey(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [meDone, setMeDone] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    document.body.dataset.page = page;
    document.body.classList.toggle('dark', page === 'tk');
    return () => {
      delete document.body.dataset.page;
      document.body.classList.remove('dark');
    };
  }, [page]);

  useEffect(() => {
    let alive = true;
    getFamily()
      .then((data) => {
        if (!alive) return;
        setMe(data);
        setMeDone(true);
      })
      .catch(() => {
        if (!alive) return;
        setMe(null);
        setMeDone(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Chưa đăng nhập thì header chỉ còn logo: ẩn menu, nút tải lên, avatar và
   * drawer. Trang đăng nhập thì chắc chắn chưa đăng nhập; các trang khác chờ
   * lời gọi `/api/me` xong mới biết, để header không nhảy menu lúc vừa tải.
   */
  const signedIn = page !== 'login' && (me !== null || !meDone);

  const familyName = me?.family.name ?? 'nhà mình';
  const initial = initialOf(me?.user.displayName ?? familyName);

  return (
    <>
      <a className="sr" href="#main">
        Bỏ qua điều hướng
      </a>
      <AnnouncementBar page={page} year={CURRENT_YEAR} />
      <Header
        signedIn={signedIn}
        familyName={familyName}
        initial={initial}
        onOpenMenu={() => setMenuOpen(true)}
        menuOpen={menuOpen}
      />
      <Drawer
        open={menuOpen && signedIn}
        onClose={closeMenu}
        familyName={familyName}
      />
      <Outlet />
    </>
  );
}
