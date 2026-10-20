import type { Media } from '../../api';
import { DownIcon } from '../../layout/Icons';
import { useCountUp } from './motion';

export interface RecapHeroProps {
  year: number;
  intro: string;
  familyName: string;
  /** Ảnh nền toàn màn (tấm nổi bật nhất của năm). */
  cover: Media | null;
}

/** Màn mở đầu toàn màn — chép theo `design/proto/tong-ket.html`. */
export function RecapHero({ year, intro, familyName, cover }: RecapHeroProps) {
  return (
    <header className="open content">
      {cover ? (
        <img className="open-bg" src={cover.url.lg} alt={cover.caption} />
      ) : null}
      <div className="open-t">
        <h1>
          Năm {year} của {familyName}
        </h1>
        <p>{intro}</p>
        <a className="down" href="#so-lieu" aria-label="Cuộn xuống xem tổng kết">
          Cuộn để xem lại
          <span>
            <DownIcon size={20} className="ic" />
          </span>
        </a>
      </div>
    </header>
  );
}

export interface StatsNumbersProps {
  photos: number;
  videos: number;
  places: number;
  collections: number;
}

/** Dải con số của năm — chép theo `design/proto/tong-ket.html`. */
export function StatsNumbers({ photos, videos, places, collections }: StatsNumbersProps) {
  return (
    <section className="nums content" id="so-lieu" aria-label="Con số của năm">
      <div className="wrap">
        <Number value={photos} label="tấm ảnh" />
        <Number value={videos} label="đoạn video" />
        <Number value={places} label="nơi đã đến" />
        <Number value={collections} label="mục kỷ niệm" />
      </div>
    </section>
  );
}

function Number({ value, label }: { value: number; label: string }) {
  const { ref, display } = useCountUp(value);
  return (
    <div>
      <b ref={ref}>{display.toLocaleString('vi-VN')}</b>
      <span>{label}</span>
    </div>
  );
}
