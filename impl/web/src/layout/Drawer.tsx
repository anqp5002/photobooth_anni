import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CloseIcon } from './Icons';
import { DRAWER_LINKS, isCurrent } from './nav';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  familyName: string;
}

/** Drawer điện thoại trượt từ trái — chép theo `design/proto/assets/app.js`. */
export function Drawer({ open, onClose, familyName }: DrawerProps) {
  const { pathname } = useLocation();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Khoá cuộn trang và bắt phím Escape khi drawer đang mở.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>('a,button');
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <>
      <div className={open ? 'scrim on' : 'scrim'} onClick={onClose} aria-hidden="true" />
      <aside
        className={open ? 'drawer on' : 'drawer'}
        id="hd-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!open}
        ref={panelRef}
      >
        <button
          type="button"
          className="dx"
          aria-label="Đóng menu"
          onClick={onClose}
          ref={closeRef}
        >
          <CloseIcon size={24} />
        </button>
        <ul>
          {DRAWER_LINKS.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                onClick={onClose}
                aria-current={isCurrent(pathname, link.match) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/dang-nhap" onClick={onClose}>
              {familyName}
            </Link>
          </li>
        </ul>
      </aside>
    </>
  );
}
