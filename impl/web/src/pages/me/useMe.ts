import { useEffect, useState } from 'react';
import { ApiError, getMe, type Me } from './api';

type MeState = 'loading' | 'ready' | 'unauth' | 'error';

/** Lấy phiên hiện tại cho các trang `/me` (401 → trang đăng nhập). */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<MeState>('loading');

  useEffect(() => {
    let alive = true;
    getMe()
      .then((data) => {
        if (!alive) return;
        setMe(data);
        setState('ready');
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) setState('unauth');
        else setState('error');
      });
    return () => {
      alive = false;
    };
  }, []);

  return { me, state };
}
