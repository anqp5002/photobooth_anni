import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CloseIcon, MenuIcon, SearchIcon, UploadIcon } from './icons';

/**
 * Header trong suốt + thanh thông báo + drawer điện thoại, chép theo
 * `design/proto/assets/app.js` (phần header) để trang mục đứng một mình được
 * khi khung/router của cmd chưa có. Khi cmd có layout chung thì bỏ file này.
 */
const LINKS = [
  { to: '/', label: 'Trang chủ', match: '/' },
  { to: '/tong-ket/2026', label: 'Tổng kết', match: '/tong-ket' },
  { to: '/ban-do', label: 'Bản đồ', match: '/ban-do' },
];

interface ProtoHeaderProps {
  notice: string;
  initial: string;
  familyName: string;
}

export function ProtoHeader({ notice, initial, familyName }: ProtoHeaderProps) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const isCurrent = (match: string) =>
    match === '/' ? pathname === '/' : pathname.startsWith(match);

  return (
    <>
      <div className="ann" role="note">
        {notice}
      </div>
      <header className="hd">
        <div className="hd-row">
          <button
            type="button"
            className="burger"
            aria-label="Mở menu"
            aria-expanded={open}
            aria-controls="muc-drawer"
            onClick={() => setOpen(true)}
          >
            <MenuIcon />
          </button>
          <nav className="hd-l" aria-label="Điều hướng chính">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} aria-current={isCurrent(l.match) ? 'page' : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          <Link className="brand" to="/" aria-label="Hành Trình, trang chủ">
            <b>Hành Trình</b>
            <small>kỷ niệm {familyName}</small>
          </Link>
          <div className="hd-r">
            <Link className="hide-m" to="/tim-kiem" aria-label="Tìm kiếm">
              <SearchIcon size={22} />
            </Link>
            <Link to="/tai-anh" aria-label="Tải ảnh lên">
              <UploadIcon size={22} />
            </Link>
            <Link to="/me" aria-label={`Tài khoản ${familyName}`} title={familyName}>
              <span className="av-i">{initial}</span>
            </Link>
          </div>
        </div>
      </header>

      <div
        className={open ? 'scrim on' : 'scrim'}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={open ? 'drawer on' : 'drawer'}
        id="muc-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!open}
      >
        <button type="button" className="dx" aria-label="Đóng menu" onClick={() => setOpen(false)}>
          <CloseIcon size={24} />
        </button>
        <ul>
          {LINKS.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                onClick={() => setOpen(false)}
                aria-current={isCurrent(l.match) ? 'page' : undefined}
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/tim-kiem" onClick={() => setOpen(false)}>
              Tìm ảnh
            </Link>
          </li>
          <li>
            <Link to="/tai-anh" onClick={() => setOpen(false)}>
              Tải ảnh lên
            </Link>
          </li>
          <li>
            <Link to="/me" onClick={() => setOpen(false)}>
              {familyName}
            </Link>
          </li>
        </ul>
      </aside>
    </>
  );
}
