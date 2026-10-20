/**
 * Đăng nhập / đăng ký gia đình — `/dang-nhap` (G5).
 *
 * - Hai tab: **Đăng nhập** (email + mật khẩu) và **Đăng ký nhà mới**
 *   (tên gia đình, tên đăng nhập, email, mật khẩu) theo hợp đồng
 *   `POST /api/auth/register {username,email,password,familyName?}`.
 * - Sai mật khẩu / email đã có người dùng / mật khẩu ngắn … hiện câu tiếng Việt ngay trên biểu mẫu.
 * - Đang đăng nhập sẵn thì hiện "nhà của bạn" + nút đăng xuất.
 * - Trạng thái tải / rỗng / lỗi dùng `PageStates` chung của nhóm B.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchMe, type Me } from '../../api';
import { ApiError, loginFamily, logoutFamily, registerFamily } from '../../api-extra';
import { loginNextPath } from '../../api/client';
import { AlertIcon, RefreshIcon, SparkleIcon } from '../../layout/Icons';
import { PageStates, demoStateOf } from './states';
import './login.css';

type Tab = 'login' | 'register';

interface FormState {
  email: string;
  password: string;
  username: string;
  familyName: string;
}

const EMPTY: FormState = { email: '', password: '', username: '', familyName: '' };

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Bản dev có gợi ý tài khoản seed; bản build thật thì không. */
const SHOW_DEMO_HINT =
  import.meta.env.DEV || /^(1|true|yes)$/i.test(String(import.meta.env.VITE_MOCK ?? ''));

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={`lg-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p className="lg-field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="lg-field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function LoginPage() {
  const [params] = useSearchParams();
  const demo = demoStateOf(params.get('state'));

  const [tab, setTab] = useState<Tab>(params.get('tab') === 'dang-ky' ? 'register' : 'login');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setChecking(true);
    fetchMe()
      .then((data) => {
        if (alive) setMe(data);
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const set = useCallback((key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {};
    if (tab === 'register') {
      if (form.familyName.trim().length < 2) {
        next.familyName = 'Bạn đặt tên cho nhà mình nhé, ví dụ “Nhà Bin & Su”.';
      }
      if (!USERNAME_RE.test(form.username.trim().toLowerCase())) {
        next.username = 'Tên đăng nhập 3–30 ký tự: chữ thường, số, dấu . _ -';
      }
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      next.email = 'Email chưa đúng dạng, bạn kiểm tra lại nhé.';
    }
    if (form.password.length < 8) {
      next.password = 'Mật khẩu cần ít nhất 8 ký tự.';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }, [form, tab]);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy) return;
      setError('');
      if (!validate()) return;

      setBusy(true);
      try {
        if (tab === 'login') {
          await loginFamily({ email: form.email.trim(), password: form.password });
        } else {
          await registerFamily({
            username: form.username.trim(),
            email: form.email.trim(),
            password: form.password,
            familyName: form.familyName.trim(),
          });
        }
        // Quay lại trang đang xem trước khi bị đòi đăng nhập (mặc định trang chủ),
        // tải lại để header biết nhà mình.
        window.location.assign(loginNextPath());
      } catch (failure) {
        setError(
          failure instanceof ApiError
            ? failure.message
            : 'Chưa vào được nhà mình. Bạn thử lại giúp mình nhé.',
        );
        setBusy(false);
      }
    },
    [busy, form, tab, validate],
  );

  const switchTab = useCallback((next: Tab) => {
    setTab(next);
    setError('');
    setFieldErrors({});
  }, []);

  const title = useMemo(
    () => (tab === 'login' ? 'Vào nhà mình' : 'Mở nhà mới trên Hành Trình'),
    [tab],
  );

  return (
    <main id="main">
      <div className="wrap page-body lg">
        {demo ? (
          <PageStates
            state={demo}
            loadingLabel="Đang mở cửa nhà"
            emptyTitle="Chưa có nhà nào"
            emptyText="Bạn đăng ký một nhà mới để bắt đầu giữ kỷ niệm của cả nhà."
            errorTitle="Chưa mở được cửa nhà"
            errorText="Kết nối bị gián đoạn nên mình chưa kiểm tra được phiên đăng nhập. Bạn thử lại nhé."
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        ) : checking ? (
          <PageStates state="loading" loadingLabel="Đang kiểm tra phiên đăng nhập" loadingTiles={0} />
        ) : me ? (
          <section className="lg-card lg-welcome" aria-label="Nhà của bạn">
            <span className="lg-badge">
              <SparkleIcon size={24} />
            </span>
            <h1>Chào {me.user.displayName}</h1>
            <p className="lg-welcome-text">
              Bạn đang ở <b>{me.family.name}</b>. Mọi ảnh và mục kỷ niệm ở đây chỉ nhà mình xem được.
            </p>
            <div className="lg-actions">
              <Link className="btn dac" to="/">
                Về trang chủ
              </Link>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void logoutFamily().then(() => window.location.reload());
                }}
              >
                Đăng xuất
              </button>
            </div>
          </section>
        ) : (
          <section className="lg-card" aria-labelledby="lg-title">
            <header className="lg-head">
              <span className="lg-kicker">
                <SparkleIcon size={18} />
                Kỷ niệm của nhà mình
              </span>
              <h1 id="lg-title">{title}</h1>
              <p>
                {tab === 'login'
                  ? 'Đăng nhập để xem lại ảnh, mục kỷ niệm và tổng kết năm của cả nhà.'
                  : 'Mỗi nhà một không gian riêng. Đăng ký xong là cả nhà cùng tải ảnh lên được.'}
              </p>
            </header>

            <div className="lg-tabs" role="tablist" aria-label="Đăng nhập hoặc đăng ký">
              <button
                type="button"
                role="tab"
                id="lg-tab-login"
                aria-selected={tab === 'login'}
                aria-controls="lg-panel"
                className={`lg-tab${tab === 'login' ? ' is-on' : ''}`}
                onClick={() => switchTab('login')}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                role="tab"
                id="lg-tab-register"
                aria-selected={tab === 'register'}
                aria-controls="lg-panel"
                className={`lg-tab${tab === 'register' ? ' is-on' : ''}`}
                onClick={() => switchTab('register')}
              >
                Đăng ký nhà mới
              </button>
            </div>

            {error ? (
              <p className="lg-alert" role="alert">
                <AlertIcon size={18} />
                <span>{error}</span>
              </p>
            ) : null}

            <form
              id="lg-panel"
              className="lg-form"
              role="tabpanel"
              aria-labelledby={tab === 'login' ? 'lg-tab-login' : 'lg-tab-register'}
              onSubmit={(event) => void submit(event)}
              noValidate
            >
              <div className="lg-grid">
                {tab === 'register' ? (
                  <>
                    <Field
                      id="lg-family"
                      label="Tên gia đình"
                      error={fieldErrors.familyName}
                      hint="Tên này hiện ở đầu mỗi trang, ví dụ “Nhà Bin & Su”."
                    >
                      <input
                        id="lg-family"
                        name="familyName"
                        type="text"
                        autoComplete="organization"
                        placeholder="Nhà Bin & Su"
                        value={form.familyName}
                        aria-invalid={Boolean(fieldErrors.familyName)}
                        onChange={(event) => set('familyName', event.target.value)}
                      />
                    </Field>

                    <Field
                      id="lg-username"
                      label="Tên đăng nhập"
                      error={fieldErrors.username}
                      hint="Chữ thường, số, dấu . _ - (3–30 ký tự)."
                    >
                      <input
                        id="lg-username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        placeholder="bin-su"
                        value={form.username}
                        aria-invalid={Boolean(fieldErrors.username)}
                        onChange={(event) => set('username', event.target.value)}
                      />
                    </Field>
                  </>
                ) : null}

                <Field id="lg-email" label="Email" error={fieldErrors.email}>
                  <input
                    id="lg-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="bo@bin-su.vn"
                    value={form.email}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'lg-email-error' : undefined}
                    onChange={(event) => set('email', event.target.value)}
                  />
                </Field>

                <Field
                  id="lg-password"
                  label="Mật khẩu"
                  error={fieldErrors.password}
                  hint={tab === 'register' ? 'Ít nhất 8 ký tự.' : undefined}
                >
                  <input
                    id="lg-password"
                    name="password"
                    type="password"
                    autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                    placeholder="••••••••"
                    value={form.password}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? 'lg-password-error' : undefined}
                    onChange={(event) => set('password', event.target.value)}
                  />
                </Field>
              </div>

              <button type="submit" className="btn dac lg-submit" disabled={busy}>
                {busy ? 'Đang mở cửa…' : tab === 'login' ? 'Đăng nhập' : 'Tạo nhà mới'}
              </button>

              <p className="lg-switch">
                {tab === 'login' ? (
                  <>
                    Nhà mình chưa có tài khoản?{' '}
                    <button type="button" onClick={() => switchTab('register')}>
                      Đăng ký nhà mới
                    </button>
                  </>
                ) : (
                  <>
                    Đã có tài khoản?{' '}
                    <button type="button" onClick={() => switchTab('login')}>
                      Đăng nhập
                    </button>
                  </>
                )}
              </p>

              {SHOW_DEMO_HINT ? (
                <p className="lg-hint">
                  <RefreshIcon size={14} /> Bản xem thử: <b>bo@bin-su.vn</b> · <b>kyniem123</b>
                </p>
              ) : null}
            </form>
          </section>
        )}
      </div>
    </main>
  );
}

export default LoginPage;
