import { Link, useLocation } from 'react-router-dom';
import { MenuIcon, SearchIcon, UploadIcon } from './Icons';
import { NAV_LINKS, isCurrent } from './nav';

export interface HeaderProps {
  /** Người dùng đã đăng nhập chưa — chưa đăng nhập thì header chỉ còn logo. */
  signedIn: boolean;
  /** Tên gia đình, hiện dưới chữ Hành Trình. */
  familyName: string;
  /** Chữ cái đầu trong ô tròn tài khoản. */
  initial: string;
  /** Mở drawer điện thoại. */
  onOpenMenu: () => void;
  /** Drawer đang mở hay không (cho aria-expanded). */
  menuOpen: boolean;
}

/** Header trong suốt (không dính) — chép theo `design/proto/assets/app.js`. */
export function Header({ signedIn, familyName, initial, onOpenMenu, menuOpen }: HeaderProps) {
  const { pathname } = useLocation();

  return (
    <header className="hd">
      <div className="hd-row">
        {signedIn ? (
          <button
            type="button"
            className="burger"
            aria-label="Mở menu"
            aria-expanded={menuOpen}
            aria-controls="hd-drawer"
            onClick={onOpenMenu}
          >
            <MenuIcon size={22} />
          </button>
        ) : null}

        {signedIn ? (
          <nav className="hd-l" aria-label="Điều hướng chính">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={isCurrent(pathname, link.match) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <Link className="brand" to="/" aria-label="Hành Trình, trang chủ">
          <b>Hành Trình</b>
          <small>kỷ niệm {familyName}</small>
        </Link>

        {signedIn ? (
          <div className="hd-r">
            <Link className="hide-m" to="/tim-kiem" aria-label="Tìm kiếm">
              <SearchIcon size={22} />
            </Link>
            <Link to="/tai-anh" aria-label="Tải ảnh lên">
              <UploadIcon size={22} />
            </Link>
            <Link to="/dang-nhap" aria-label={`Tài khoản ${familyName}`} title={familyName}>
              <span className="av-i">{initial}</span>
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  );
}
