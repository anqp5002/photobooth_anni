import { Link } from 'react-router-dom';
import type { Home } from '../../api';
import { longDate } from './format';
// Khối 3D pastel của bản mẫu (Freepik — xem `design/proto/CREDITS.md`).
import clusterUrl from '../../../../../design/proto/assets/cluster3d.png';

export type OnThisDayData = NonNullable<Home['onThisDay']>;

/** Khối "Ngày này năm trước" — chép theo `design/proto/index.html`. */
export function OnThisDay({ onThisDay }: { onThisDay: OnThisDayData }) {
  const { media, date, yearsAgo } = onThisDay;
  const target = media.collectionId ? `/muc/${media.collectionId}` : '/dong-thoi-gian';

  return (
    <section className="sec content" id="ngay-nay">
      <div className="wrap">
        <div className="then kinh">
          <img className="deco" src={clusterUrl} alt="" />
          <figure className="pol big">
            <img src={media.url.lg} alt={media.caption} loading="lazy" />
            <figcaption>{media.place}</figcaption>
          </figure>
          <div className="then-text">
            <h2>Ngày này năm trước</h2>
            <p className="when">
              <b>{yearsAgo} năm trước</b>
              <br />
              {longDate(date)}
            </p>
            <p>{media.caption}</p>
            <Link className="btn dac" to={target}>
              Xem lại ngày hôm đó
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
