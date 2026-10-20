import { Link } from 'react-router-dom';
import type { Collection } from '../../api';
import { collectionLine } from './format';

const TILE_CLASSES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

/** Khối "Các mục của năm" (mosaic nhiều cỡ) — chép theo `design/proto/index.html`. */
export function CollectionsMosaic({ collections }: { collections: Collection[] }) {
  return (
    <section className="sec content" id="cac-muc">
      <div className="wrap">
        <div className="head">
          <h2>Các mục của năm</h2>
          <p>Bảy câu chuyện, do mình tự gom từ ngày giờ và nơi chụp.</p>
        </div>
        <div className="mosaic">
          {collections.map((collection, index) => (
            <Link
              key={collection.id}
              className={`tile ${TILE_CLASSES[index % TILE_CLASSES.length]}`}
              to={`/muc/${collection.id}`}
            >
              <img src={collection.cover.url.lg} alt={collection.title} loading="lazy" />
              <div>
                <h3>{collection.title}</h3>
                <span>{collectionLine(collection)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
