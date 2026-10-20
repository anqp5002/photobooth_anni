import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchHome, type Home } from '../../api';
import { getFamily } from '../../layout/family';
import { PageState, RetryButton, type ViewState } from '../../layout/PageState';
import { CollectionsMosaic } from './CollectionsMosaic';
import { Hero } from './Hero';
import { MapPreview } from './MapPreview';
import { OnThisDay } from './OnThisDay';
import { RecentStrip } from './RecentStrip';

/**
 * Trang chủ r2 — theo đúng `design/proto/index.html`:
 * hero bàn kỷ niệm (polaroid + khối 3D + parallax), dải "Gần đây",
 * "Các mục của năm", "Ngày này năm trước", thẻ mở bản đồ.
 */
export function HomePage() {
  const [params] = useSearchParams();
  const raw = params.get('state');
  const demo = raw === 'loading' || raw === 'empty' || raw === 'error' ? raw : null;

  const [state, setState] = useState<ViewState>('loading');
  const [home, setHome] = useState<Home | null>(null);
  const [familyName, setFamilyName] = useState('');

  const load = useCallback(() => {
    if (demo === 'loading') {
      setState('loading');
      return;
    }
    if (demo === 'error') {
      setState('error');
      return;
    }
    if (demo === 'empty') {
      setHome(null);
      setState('empty');
      return;
    }
    setState('loading');
    fetchHome()
      .then((data) => {
        setHome(data);
        setState(data.recent.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => setState('error'));
  }, [demo]);

  useEffect(load, [load]);

  useEffect(() => {
    let alive = true;
    getFamily()
      .then((me) => {
        if (alive && me) setFamilyName(me.family.name);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main id="main">
      <PageState
        state={state}
        errorAction={<RetryButton onRetry={load} />}
        emptyAction={
          <Link className="btn dac" to="/tai-anh">
            Tải ảnh đầu tiên lên
          </Link>
        }
      >
        {home ? (
          <>
            <Hero home={home} />
            <RecentStrip recent={home.recent} />
            <CollectionsMosaic collections={home.collections} />
            {home.onThisDay ? <OnThisDay onThisDay={home.onThisDay} /> : null}
            <MapPreview points={home.mapPreview.points} />
            <footer className="foot content">
              <div className="wrap">
                <b>Hành Trình</b>
                <span>Kỷ niệm của {familyName || 'nhà mình'}, chỉ cả nhà xem được.</span>
              </div>
            </footer>
          </>
        ) : null}
      </PageState>
    </main>
  );
}

export default HomePage;
