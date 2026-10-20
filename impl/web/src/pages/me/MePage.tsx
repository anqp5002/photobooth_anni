import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { PlusIcon } from '../../components/Icons';
import { formatDate } from '../../lib/format';
import { ErrorPage } from '../ErrorPage';
import {
  ApiError,
  createTrip,
  getOwnerProfile,
  logout,
  type OwnerProfile,
} from './api';
import { ExitIcon, FolderIcon } from './icons';
import { useMe } from './useMe';
import './me.css';

const VISIBILITY_LABEL = {
  private: 'riêng tư',
  link: 'có liên kết',
  public: 'công khai',
} as const;

function FolderCard({ trip, username }: { trip: OwnerProfile['trips'][number]; username: string }) {
  return (
    <Link className="me-folder-card" to={`/me/trips/${trip.id}`}>
      <span className="me-folder-tab" aria-hidden="true">chuyến</span>
      <span className="me-folder-cover">
        {trip.cover?.sm ? (
          <img src={trip.cover.sm} alt={`Ảnh bìa chuyến ${trip.name}`} loading="lazy" />
        ) : (
          <span className="me-folder-blank">
            <FolderIcon size={26} />
          </span>
        )}
        <span className={`me-visibility-badge is-${trip.visibility ?? 'private'}`}>
          {VISIBILITY_LABEL[trip.visibility ?? 'private']}
        </span>
      </span>
      <span className="me-folder-body">
        <span className="me-folder-name">{trip.name}</span>
        <span className="me-folder-date">
          {trip.startedAt ? formatDate(trip.startedAt) : 'chưa có ảnh'}
          {trip.endedAt ? ` – ${formatDate(trip.endedAt)}` : ''}
        </span>
        <span className="me-folder-stats">
          <span>{`${trip.steps} chặng`}</span>
          <span>{`${trip.km} km`}</span>
          <span>{`${trip.countries} quốc gia`}</span>
        </span>
        <span className="me-folder-open">
          mở thư mục
          <span aria-hidden="true">→</span>
        </span>
      </span>
      <span className="sr-only">{`Mở thư mục chuyến ${trip.name} của ${username}`}</span>
    </Link>
  );
}

export function MePage() {
  const navigate = useNavigate();
  const { me, state } = useMe();
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [profileState, setProfileState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state === 'unauth') navigate('/login', { replace: true });
  }, [state, navigate]);

  useEffect(() => {
    if (!me) return undefined;
    let alive = true;
    setProfileState('loading');
    getOwnerProfile(me.username)
      .then((data) => {
        if (!alive) return;
        setProfile(data);
        setProfileState('ready');
      })
      .catch(() => {
        if (alive) setProfileState('error');
      });
    return () => {
      alive = false;
    };
  }, [me]);

  if (state === 'unauth') {
    return null;
  }

  if (state === 'error' || profileState === 'error') {
    return <ErrorPage kind="general" />;
  }

  if (state === 'loading' || profileState === 'loading' || !me || !profile) {
    return (
      <div className="me-page">
        <Header />
        <main className="me-main">
          <div className="loading-spinner" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>Đang mở thư mục chuyến…</span>
          </div>
        </main>
      </div>
    );
  }

  const totalSteps = profile.trips.reduce((sum, trip) => sum + trip.steps, 0);
  const initial = profile.displayName.trim().charAt(0).toUpperCase() || 'H';

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setCreateError('Đặt tên cho chuyến trước đã.');
      return;
    }
    setSaving(true);
    setCreateError('');
    try {
      const trip = await createTrip(name);
      navigate(`/me/trips/${trip.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setCreateError('Không tạo được chuyến. Thử lại giúp mình nhé.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="me-page">
      <a className="skip-link" href="#main">
        bỏ qua tới nội dung chính
      </a>
      <Header />
      <main className="me-main" id="main">
        <div className="me-top">
          <div className="me-identity">
            {profile.avatar ? (
              <img className="me-avatar" src={profile.avatar} alt="" width={64} height={64} />
            ) : (
              <span className="me-avatar me-avatar-initial" aria-hidden="true">
                {initial}
              </span>
            )}
            <div>
              <p className="me-eyebrow">Trang của tôi</p>
              <h1 className="me-title">Chuyến của tôi</h1>
              <p className="me-identity-sub">
                {`@${profile.username} · ${me.email}`}
              </p>
            </div>
          </div>
          <div className="me-top-actions">
            <button type="button" className="btn btn-lg btn-secondary" onClick={handleLogout}>
              <ExitIcon size={17} />
              đăng xuất
            </button>
            <button
              type="button"
              className="btn btn-lg btn-primary"
              onClick={() => {
                setCreating((value) => !value);
                setCreateError('');
              }}
              aria-expanded={creating}
            >
              <PlusIcon size={18} />
              tạo chuyến
            </button>
          </div>
        </div>

        <dl className="me-stats">
          <div>
            <dt>thư mục chuyến</dt>
            <dd>{profile.trips.length}</dd>
          </div>
          <div>
            <dt>chặng</dt>
            <dd>{totalSteps}</dd>
          </div>
          <div>
            <dt>quốc gia</dt>
            <dd>{profile.countryCount}</dd>
          </div>
        </dl>

        {creating && (
          <form className="me-create" onSubmit={submitCreate}>
            <label className="me-create-label" htmlFor="me-trip-name">
              Tên chuyến mới
            </label>
            <div className="me-create-row">
              <input
                id="me-trip-name"
                className="me-input"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Ví dụ: Mùa hè ở Đà Lạt"
                maxLength={120}
                autoFocus
              />
              <button type="submit" className="btn btn-lg btn-primary" disabled={saving}>
                {saving ? 'đang tạo…' : 'tạo thư mục'}
              </button>
            </div>
            <p className="me-create-hint">
              Chuyến mới luôn ở mức <b>riêng tư</b>. Bạn đổi được ở trang chuyến.
            </p>
            {createError && (
              <p className="me-alert is-error" role="alert">
                {createError}
              </p>
            )}
          </form>
        )}

        <div className="me-section-head">
          <h2 className="me-section-title">Thư mục chuyến</h2>
          <p className="me-section-hint">
            Mỗi chuyến là một thư mục. Mở thư mục để xếp ảnh vào từng chặng.
          </p>
        </div>

        {profile.trips.length === 0 ? (
          <div className="me-empty">
            <span className="me-empty-icon" aria-hidden="true">
              <FolderIcon size={30} />
            </span>
            <p className="me-empty-title">Chưa có thư mục nào</p>
            <p className="me-empty-text">
              Tạo chuyến đầu tiên rồi kéo ảnh, video vào — hệ thống tự chia chặng giúp bạn.
            </p>
            <button
              type="button"
              className="btn btn-lg btn-primary"
              onClick={() => setCreating(true)}
            >
              <PlusIcon size={18} />
              tạo chuyến
            </button>
          </div>
        ) : (
          <div className="me-folder-grid">
            {profile.trips.map((trip) => (
              <FolderCard key={trip.id} trip={trip} username={profile.username} />
            ))}
            <button
              type="button"
              className="me-folder-card me-folder-new"
              onClick={() => {
                setCreating(true);
                setCreateError('');
              }}
            >
              <span className="me-folder-tab" aria-hidden="true">mới</span>
              <span className="me-folder-cover me-folder-new-cover" aria-hidden="true">
                <span className="me-folder-new-plus">
                  <PlusIcon size={26} />
                </span>
              </span>
              <span className="me-folder-body">
                <span className="me-folder-name">Tạo chuyến mới</span>
                <span className="me-folder-date">Đặt tên rồi kéo ảnh vào</span>
                <span className="me-folder-open">
                  tạo thư mục
                  <span aria-hidden="true">→</span>
                </span>
              </span>
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
