import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchRecap, type Media, type Recap } from '../../api';
import { getFamily } from '../../layout/family';
import { PageState, RetryButton, type ViewState } from '../../layout/PageState';
import { ChapterRail, Chapters } from './Chapters';
import { EndBlock, pickStrip } from './EndBlock';
import { RecapHero, StatsNumbers } from './RecapHero';
import { useActiveChapter, useReveal, useScrollMotion } from './motion';

/** Chương dùng làm dải ảnh toàn màn: chuyến đi nhiều ảnh nhất trong năm. */
function bandChapterId(recap: Recap): string | null {
  const trips = recap.chapters.filter((chapter) => chapter.collection.kind === 'trip');
  if (trips.length === 0) return null;
  const biggest = [...trips].sort((a, b) => b.collection.count - a.collection.count)[0];
  return biggest ? `ch-${biggest.collection.id}` : null;
}

/**
 * Ảnh nền mở đầu: tấm nổi bật nhất, ưu tiên gần cuối năm.
 *
 * Máy chủ đã xếp `highlights` theo điểm AI giảm dần (cùng điểm thì ảnh cũ hơn
 * đứng trước), nên trong một chương ta giữ nguyên thứ tự đó; giữa các chương
 * thì chương về sau (tháng lớn hơn) được ưu tiên.
 */
function coverOf(recap: Recap): Media | null {
  let best: Media | null = null;
  for (const chapter of recap.chapters) {
    // Máy chủ đã xếp `highlights` theo điểm AI giảm dần nên tấm đầu là tấm nổi bật nhất.
    const top = chapter.highlights[0];
    if (!top) continue;
    if (!best || top.score >= best.score) best = top;
  }
  if (best) return best;
  // Chương nào cũng có ảnh bìa: dùng làm ảnh nền thay vì để trống.
  const last = recap.chapters[recap.chapters.length - 1];
  return last?.collection.cover ?? null;
}

/**
 * Tổng kết năm `/tong-ket/:year` — theo `design/proto/tong-ket.html`:
 * màn mở đầu toàn màn, con số của năm, các chương xen kẽ, nơi đến nhiều nhất,
 * chặn cuối trang mở photobooth.
 */
export function RecapPage() {
  const { year = String(new Date().getFullYear()) } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  const demo = raw === 'loading' || raw === 'empty' || raw === 'error' ? raw : null;

  const [state, setState] = useState<ViewState>('loading');
  const [recap, setRecap] = useState<Recap | null>(null);
  const [familyName, setFamilyName] = useState('');

  const root = useRef<HTMLDivElement>(null);
  const revealRef = useReveal<HTMLDivElement>([recap]);
  useScrollMotion(root, [recap]);

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
      setRecap(null);
      setState('empty');
      return;
    }
    setState('loading');
    fetchRecap(Number(year))
      .then((data) => {
        setRecap(data);
        setState(data.chapters.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => setState('error'));
  }, [demo, year]);

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

  const chapterIds = useMemo(
    () => (recap ? recap.chapters.map((chapter) => `ch-${chapter.collection.id}`) : []),
    [recap],
  );
  const activeId = useActiveChapter(chapterIds);
  const bandId = recap ? bandChapterId(recap) : null;

  return (
    <div ref={root}>
      <main id="main">
        <PageState
          state={state}
          errorAction={<RetryButton onRetry={load} />}
          emptyTitle="Chưa đủ ảnh để tổng kết"
          emptyText={`Tải thêm ảnh của năm ${year} lên, mình sẽ dựng thành một cuốn phim kể lại cả năm của nhà mình.`}
          emptyAction={
            <Link className="btn dac" to="/tai-anh">
              Tải ảnh đầu tiên lên
            </Link>
          }
        >
          {recap ? (
            <div ref={revealRef}>
              <RecapHero
                year={recap.year}
                intro={recap.intro}
                familyName={familyName || 'nhà mình'}
                cover={coverOf(recap)}
              />
              <StatsNumbers
                photos={recap.stats.photos}
                videos={recap.stats.videos}
                places={recap.stats.places}
                collections={recap.stats.collections}
              />
              <ChapterRail
                chapters={recap.chapters.map((chapter) => ({
                  id: `ch-${chapter.collection.id}`,
                  title: chapter.collection.title,
                }))}
                activeId={activeId}
              />
              <Chapters chapters={recap.chapters} bandId={bandId} />
              <TopPlaces recap={recap} />
              <EndBlock
                year={recap.year}
                strip={pickStrip(recap)}
                familyName={familyName || 'nhà mình'}
              />
            </div>
          ) : null}
        </PageState>
      </main>
    </div>
  );
}

/** Nơi đến nhiều nhất trong năm. */
function TopPlaces({ recap }: { recap: Recap }) {
  if (recap.topPlaces.length === 0) return null;
  return (
    <section className="sec content" id="noi-den-nhieu-nhat" aria-label="Nơi đến nhiều nhất">
      <div className="wrap">
        <div className="head">
          <h2>Nơi đến nhiều nhất</h2>
          <p>Những nơi xuất hiện nhiều nhất trong ảnh của cả nhà.</p>
        </div>
        <div className="tk-places">
          {recap.topPlaces.map((place, index) => (
            <div className="tk-place" key={place.place}>
              <b>{String(index + 1).padStart(2, '0')}</b>
              <span className="tk-place-name">{place.place}</span>
              <span className="tk-place-count">{place.count.toLocaleString('vi-VN')} ảnh</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default RecapPage;
