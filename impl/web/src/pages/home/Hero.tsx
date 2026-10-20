import { Link } from 'react-router-dom';
import type { Collection, Home, Media } from '../../api';
import { CURRENT_YEAR } from '../../layout/nav';
import { useParallax } from './parallax';
// Khối 3D pastel của bản mẫu (Freepik — xem `design/proto/CREDITS.md`).
import clusterUrl from '../../../../../design/proto/assets/cluster3d.png';

/** Ba tấm polaroid nổi bật nhất: ưu tiên ảnh chụp ở ba nơi khác nhau. */
function pickHeroPhotos(recent: Media[]): Media[] {
  const picked: Media[] = [];
  const places = new Set<string>();
  for (const media of recent) {
    if (media.type !== 'photo') continue;
    const place = media.place || '';
    if (places.has(place) && picked.length < 3) continue;
    places.add(place);
    picked.push(media);
    if (picked.length === 3) break;
  }
  for (const media of recent) {
    if (picked.length === 3) break;
    if (!picked.includes(media)) picked.push(media);
  }
  return picked;
}

/** Câu dẫn dạng "Từ … đến …, mình đã gom N tấm ảnh …". */
function leadText(home: Home): string {
  const photos = home.stats.photos.toLocaleString('vi-VN');
  const { first, last } = eventRange(home.collections);
  if (!first || !last) {
    return `Mình đã gom ${photos} tấm ảnh của cả nhà vào đúng chỗ của nó.`;
  }
  return `Từ ${first} đến ${last}, mình đã gom ${photos} tấm ảnh của cả nhà vào đúng chỗ của nó.`;
}

/**
 * Mục đầu và mục cuối của năm theo thời gian. Mục trải dài như "Cuối tuần ở nhà"
 * không phải sự kiện nên không dùng làm mốc đầu.
 */
function eventRange(collections: Collection[]): { first: string; last: string } {
  const DAY = 24 * 60 * 60 * 1000;
  const events = collections.filter((collection) => {
    const days =
      (new Date(collection.endAt).getTime() - new Date(collection.startAt).getTime()) / DAY;
    return days <= 60;
  });
  const sorted = [...(events.length > 0 ? events : collections)].sort((a, b) =>
    a.startAt.localeCompare(b.startAt),
  );
  return {
    first: sorted[0]?.title ?? '',
    last: sorted[sorted.length - 1]?.title ?? '',
  };
}

export interface HeroProps {
  home: Home;
}

export function Hero({ home }: HeroProps) {
  const stageRef = useParallax<HTMLElement>();
  const photos = pickHeroPhotos(home.recent);
  const stats = home.stats;

  return (
    <section className="hero content" ref={stageRef}>
      <div className="wrap hero-in">
        <div className="hero-text">
          <h1>{home.greeting}</h1>
          <p className="lead">{leadText(home)}</p>
          <div className="cta">
            <Link className="btn dac" to={`/tong-ket/${CURRENT_YEAR}`}>
              Xem tổng kết {CURRENT_YEAR}
            </Link>
            <Link className="btn kinh" to="/tai-anh">
              Tải ảnh lên
            </Link>
          </div>
          <p className="small">
            {stats.photos.toLocaleString('vi-VN')} ảnh, {stats.videos.toLocaleString('vi-VN')} video,{' '}
            {stats.places} nơi đã đến, {stats.collections} mục kỷ niệm
          </p>
        </div>

        <div className="stage" aria-label="Bàn kỷ niệm của nhà mình">
          <img className="cluster" data-depth={-16} src={clusterUrl} alt="" width={1490} height={1200} />
          <img
            className="cluster c2"
            data-depth={-40}
            src={clusterUrl}
            alt=""
            width={1490}
            height={1200}
          />
          {photos.map((media, index) => (
            <figure key={media.id} className={`pol p${index + 1}`} data-depth={26 + index * 9}>
              <img src={media.url.lg} alt={media.caption} />
              <figcaption>{media.caption}</figcaption>
            </figure>
          ))}
          <div className="sticker" data-depth={52}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#4A1F4F" aria-hidden="true">
              <path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.5 6 20.9l1.3-6.7-5-4.7 6.8-.8z" />
            </svg>
            <b>{CURRENT_YEAR}</b>
            <span>năm của nhà mình</span>
          </div>
        </div>
      </div>
    </section>
  );
}
