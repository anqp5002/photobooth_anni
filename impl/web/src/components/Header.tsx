import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDownIcon, SearchIcon } from './Icons';
import { Avatar } from './Avatar';
import { Flag } from './Flag';
import { useSession } from '../session/SessionContext';

interface MenuItem {
  label: string;
  to: string;
}

function LogoMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" focusable="false">
      <circle cx="13" cy="13" r="12" fill="#F11F4C" />
      <path
        d="M7 17.5c2.6 0 2.2-9 5.4-9 3.1 0 2.2 6.4 5 6.4"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="7" cy="17.5" r="2" fill="#fff" />
      <circle cx="17.4" cy="14.9" r="2" fill="#fff" />
    </svg>
  );
}

function Dropdown({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="dropdown" ref={ref}>
      <button
        type="button"
        className="dropdown-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDownIcon size={15} className={open ? 'dropdown-caret is-open' : 'dropdown-caret'} />
      </button>
      {open && (
        <div className="dropdown-panel" role="menu">
          {items.map((item) => (
            <Link
              key={item.to + item.label}
              to={item.to}
              role="menuitem"
              className="dropdown-item"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const EXPLORE_MENU: MenuItem[] = [
  { label: 'Chuyến đi mới nhất', to: '/' },
  { label: 'Chuyến đi theo quốc gia', to: '/' },
  { label: 'Hồ sơ nổi bật', to: '/minh' },
];

const COMMUNITY_MENU: MenuItem[] = [
  { label: 'Photobooth', to: '/photobooth' },
  { label: 'Giới thiệu', to: '/' },
  { label: 'Trợ giúp', to: '/' },
];

function LanguageMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="dropdown header-lang-wrap" ref={ref}>
      <button
        type="button"
        className="header-lang"
        aria-label="Ngôn ngữ: Tiếng Việt"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Flag code="VN" size={22} />
      </button>
      {open && (
        <div className="dropdown-panel dropdown-panel-right" role="menu">
          <button type="button" className="dropdown-item dropdown-item-active" role="menuitem">
            Tiếng Việt
            <span className="dropdown-check" aria-hidden="true">
              ✓
            </span>
          </button>
          <button type="button" className="dropdown-item is-disabled" role="menuitem" disabled>
            English
            <span className="dropdown-soon">sắp có</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const { user } = useSession();

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    navigate(term ? `/?q=${encodeURIComponent(term)}` : '/');
    setSearchOpen(false);
  };

  return (
    <header className="app-header">
      <Link to="/" className="app-logo">
        <LogoMark />
        <span>Hành Trình</span>
      </Link>

      <form className="header-search" role="search" onSubmit={submitSearch}>
        {searchOpen ? (
          <input
            ref={searchRef}
            className="header-search-input"
            type="search"
            value={query}
            placeholder="Tìm chuyến đi, địa danh…"
            aria-label="Tìm chuyến đi"
            onChange={(event) => setQuery(event.target.value)}
            onBlur={() => {
              if (!query.trim()) setSearchOpen(false);
            }}
          />
        ) : (
          <button type="button" className="header-search-btn" onClick={() => setSearchOpen(true)}>
            <SearchIcon size={18} />
            <span>Tìm kiếm</span>
          </button>
        )}
        {searchOpen && (
          <button type="button" className="header-search-close" onClick={() => setSearchOpen(false)}>
            Hủy
          </button>
        )}
      </form>

      <nav className="header-menus" aria-label="Danh mục">
        <Dropdown label="Khám phá" items={EXPLORE_MENU} />
        <Dropdown label="Cộng đồng" items={COMMUNITY_MENU} />
      </nav>

      <div className="header-right">
        {user ? (
          <>
            <span className="header-user">
              <Avatar src={user.avatar} name={user.displayName} size={28} />
              <span className="header-user-name">{user.displayName}</span>
            </span>
            <Link to="/me" className="btn btn-lg btn-secondary header-login">
              chuyến của tôi
            </Link>
          </>
        ) : (
          <Link to="/login" className="btn btn-lg btn-secondary header-login">
            đăng nhập
          </Link>
        )}
        <Link to="/me" className="btn btn-lg btn-primary header-create">
          tạo chuyến
        </Link>
        <LanguageMenu />
      </div>
    </header>
  );
}
