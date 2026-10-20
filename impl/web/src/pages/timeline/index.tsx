/**
 * Dòng thời gian `/dong-thoi-gian` (F5 → Z2M).
 *
 * - Cuộn theo tháng: tiêu đề tháng dính khi cuộn (CSS `.tl-month-head` trong `styles/timeline.css`).
 * - Z2M: trong một tháng, các ngày xếp thành **lưới dày theo chiều ngang** (nhiều ngày một hàng ở
 *   1440, 2 cột ở 390) — mỗi ngày là một ô, các ô tự giãn để lấp hết bề ngang (không còn
 *   "mỗi ngày một ảnh nhỏ một cột, bên phải trống").
 * - Ảnh nổi bật (`ai_score` = `Media.score` cao) được to hơn: ngày có ảnh điểm cao chiếm ô rộng
 *   hơn (`flex: 2 1 …`), ảnh điểm cao nhất trong ngày tràn hết bề rộng ô.
 * - Giữ: tiêu đề tháng dính, nhãn mục kỷ niệm của ngày, caption Playfair.
 * - Nhảy năm: chọn năm ở đầu trang, dữ liệu tải lại theo năm.
 * - Tải thêm theo `nextCursor` của `GET /api/timeline`.
 * - Có đủ ba trạng thái: đang tải / rỗng / lỗi.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchCollections,
  fetchTimeline,
  type Collection,
  type Media,
  type TimelineMonth,
} from '../../api';
import { PageState, RetryButton, type ViewState } from '../../layout/PageState';
import { CURRENT_YEAR } from '../../layout/nav';
import './timeline-extra.css';

const MONTH_NAMES = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Năm có thể xem: năm hiện tại và hai năm trước. */
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

/** Ngưỡng "nổi bật": `ai_score` (thang 1–10) từ mức này trở lên thì ảnh được ưu tiên to hơn. */
const HOT_SCORE = 9;

function dayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return WEEKDAYS[parsed.getDay()] ?? date;
}

function shortDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.getDate()}/${parsed.getMonth() + 1}/${parsed.getFullYear()}`;
}

/** `ai_score` của máy chủ (có thể null khi AI chưa chạy) → số để so sánh. */
function scoreOf(media: Media): number {
  const value = Number(media.score);
  return Number.isFinite(value) ? value : 0;
}

/** Ghép hai trang: tháng cuối trùng tháng đầu thì nối ngày vào cùng một tháng. */
function mergeMonths(previous: TimelineMonth[], next: TimelineMonth[]): TimelineMonth[] {
  if (previous.length === 0) return next;
  const merged = previous.map((month) => ({ ...month, days: [...month.days] }));
  const last = merged[merged.length - 1];
  for (const month of next) {
    if (last && last.month === month.month) {
      last.days.push(...month.days);
      continue;
    }
    merged.push({ ...month, days: [...month.days] });
  }
  return merged;
}

/** Một tấm ảnh trong ô ngày: ảnh + caption Playfair. */
function Photo({ media, date, hero = false, hot = false }: {
  media: Media;
  date: string;
  hero?: boolean;
  hot?: boolean;
}) {
  const alt = media.caption || `Ảnh kỷ niệm ngày ${shortDay(date)}`;
  const image = <img src={media.url.lg} alt={alt} loading="lazy" />;
  return (
    <figure className={`tl-item${hero ? ' hero' : ''}${hot ? ' hot' : ''}`}>
      {media.collectionId ? <Link to={`/muc/${media.collectionId}`}>{image}</Link> : image}
      {media.caption ? <figcaption>{media.caption}</figcaption> : null}
    </figure>
  );
}

export function TimelinePage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [state, setState] = useState<ViewState>('loading');
  const [months, setMonths] = useState<TimelineMonth[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(() => {
    setState('loading');
    setMonths([]);
    setNextCursor(null);
    Promise.all([fetchTimeline({ year: String(year) }), fetchCollections({ year: String(year) })])
      .then(([timeline, list]) => {
        setMonths(timeline.months);
        setNextCursor(timeline.nextCursor);
        setCollections(list);
        setState(timeline.months.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => setState('error'));
  }, [year]);

  useEffect(load, [load]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    fetchTimeline({ year: String(year), cursor: nextCursor })
      .then((timeline) => {
        setMonths((current) => mergeMonths(current, timeline.months));
        setNextCursor(timeline.nextCursor);
      })
      .catch(() => setState('error'))
      .finally(() => setLoadingMore(false));
  }, [year, nextCursor, loadingMore]);

  /** Nhãn mục kỷ niệm của một ngày. */
  const collectionTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const collection of collections) map.set(String(collection.id), collection.title);
    return (id: string | null): string => (id ? map.get(String(id)) ?? '' : '');
  }, [collections]);

  const photoCount = useMemo(
    () => months.reduce((sum, month) => sum + month.days.reduce((n, day) => n + day.media.length, 0), 0),
    [months],
  );

  return (
    <main id="main">
      <PageState
        state={state}
        errorAction={<RetryButton onRetry={load} />}
        emptyTitle={`Chưa có ảnh nào trong năm ${year}`}
        emptyText="Năm này nhà mình chưa có kỷ niệm nào. Thử một năm khác, hoặc tải ảnh lên."
        emptyAction={
          <Link className="btn dac" to="/tai-anh">
            Tải ảnh lên
          </Link>
        }
      >
        <div className="page-body tlx">
          <div className="wrap">
            <div className="head">
              <h2>Dòng thời gian</h2>
              <p>
                {photoCount.toLocaleString('vi-VN')} ảnh trong {months.length} tháng của năm {year}.
              </p>
            </div>

            <nav className="tlx-years" aria-label="Chọn năm">
              {YEARS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`tlx-year${item === year ? ' on' : ''}`}
                  aria-pressed={item === year}
                  onClick={() => setYear(item)}
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>

          {months.map((month) => (
            <section className="tl-month" key={month.month}>
              <div className="tl-month-head">
                <div className="wrap tl-head">
                  <h2>{MONTH_NAMES[month.month - 1] ?? `Tháng ${month.month}`}</h2>
                  <span>
                    {month.days.length} ngày có ảnh ·{' '}
                    {month.days.reduce((n, day) => n + day.media.length, 0)} ảnh
                  </span>
                </div>
              </div>

              <div className="wrap">
                {/* Z2M: lưới ngày của tháng — nhiều ngày một hàng, tự giãn lấp bề ngang. */}
                <div className="tlx-mgrid">
                  {month.days.map((day) => {
                    const title = collectionTitle(day.collectionId);
                    // Ảnh điểm cao nhất đứng đầu và tràn bề rộng ô; ảnh còn lại xếp lưới nhỏ.
                    const ordered = [...day.media].sort((a, b) => scoreOf(b) - scoreOf(a));
                    const hero = ordered[0] ?? null;
                    const rest = ordered.slice(1);
                    const hot = hero ? scoreOf(hero) >= HOT_SCORE : false;
                    return (
                      <article className={`tlx-day${hot ? ' hot' : ''}`} key={day.date}>
                        <div className="tlx-day-head">
                          <b title={day.date}>{shortDay(day.date)}</b>
                          <span className="tlx-date">{dayLabel(day.date)}</span>
                          {title ? (
                            <Link className="tlx-chip" to={`/muc/${day.collectionId}`}>
                              {title}
                            </Link>
                          ) : null}
                        </div>
                        <div className="tlx-day-grid">
                          {hero ? <Photo media={hero} date={day.date} hero hot={hot} /> : null}
                          {rest.length ? (
                            <div className="tlx-rest">
                              {rest.map((media) => (
                                <Photo key={media.id} media={media} date={day.date} />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}

          {nextCursor ? (
            <div className="wrap tlx-more">
              <button
                type="button"
                className="btn kinh nho"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Đang tải…' : 'Tải thêm ngày cũ hơn'}
              </button>
            </div>
          ) : null}
        </div>
      </PageState>
    </main>
  );
}

export default TimelinePage;
