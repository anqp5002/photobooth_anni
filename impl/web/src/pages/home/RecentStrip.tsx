import { Link } from 'react-router-dom';
import type { Media } from '../../api';
import { relativeLabel } from './format';

const STRIP_CLASSES = ['sq', 'tall', 'wide'];

/** Dải ảnh cuộn ngang "Gần đây" — chép theo `design/proto/index.html`. */
export function RecentStrip({ recent }: { recent: Media[] }) {
  return (
    <section className="sec content" id="gan-day">
      <div className="wrap head">
        <h2>Gần đây</h2>
        <p>Những tấm mới nhất mà cả nhà vừa thêm vào.</p>
      </div>
      <div className="strip" tabIndex={0} aria-label="Ảnh gần đây, cuộn ngang để xem thêm">
        {recent.map((media, index) => (
          <Link
            key={media.id}
            to={media.collectionId ? `/muc/${media.collectionId}` : '/dong-thoi-gian'}
            className={`it ${STRIP_CLASSES[index % STRIP_CLASSES.length]}`}
          >
            <img src={media.url.lg} alt={media.caption} loading="lazy" />
            <span className="chip kinh">{relativeLabel(media.takenAt)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
