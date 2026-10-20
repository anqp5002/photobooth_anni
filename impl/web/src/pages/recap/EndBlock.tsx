import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Media, Recap } from '../../api';
import { CloseIcon } from '../../layout/Icons';
import { Toast } from '../../layout/Toast';

export interface EndBlockProps {
  year: number;
  /** Bốn tấm ảnh nổi bật nhất để ghép dải. */
  strip: Media[];
  familyName: string;
}

/** Chặn cuối trang + hộp thoại dải ảnh — chép theo `design/proto/tong-ket.html`. */
export function EndBlock({ year, strip, familyName }: EndBlockProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [boothOpen, setBoothOpen] = useState(false);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setToast('Đã chép liên kết. Gửi cho cả nhà nhé.');
    } catch {
      setToast('Chép liên kết không được, bạn tự copy địa chỉ này nhé.');
    }
  };

  return (
    <>
      <section className="end content">
        <div className="wrap">
          <h2>Cảm ơn một năm đã ở bên nhau</h2>
          <p>
            Ghép bốn tấm ảnh thích nhất thành dải ảnh như ở tiệm chụp, hoặc gửi cả cuốn tổng kết này cho
            ông bà.
          </p>
          <div className="cta">
            <button type="button" className="btn vang" onClick={() => setBoothOpen(true)}>
              Ghép dải ảnh kỷ niệm
            </button>
            <button type="button" className="btn" onClick={share}>
              Chia sẻ với cả nhà
            </button>
          </div>
        </div>
      </section>

      <div
        className={`dialog-bg${boothOpen ? ' on' : ''}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) setBoothOpen(false);
        }}
      >
        <div className="dialog booth" role="dialog" aria-modal="true" aria-labelledby="pb-t">
          <button
            type="button"
            className="x"
            aria-label="Đóng"
            onClick={() => setBoothOpen(false)}
          >
            <CloseIcon size={20} />
          </button>
          <h2 id="pb-t">Dải ảnh của nhà mình</h2>
          <div className="strip4">
            {strip.map((media) => (
              <img key={media.id} src={media.url.lg} alt={media.caption} />
            ))}
            <span>
              {familyName}, {year}
            </span>
          </div>
          <div className="cta">
            <Link className="btn vang" to="/photobooth" onClick={() => setBoothOpen(false)}>
              Ghép dải này
            </Link>
            <button type="button" className="btn" onClick={() => setBoothOpen(false)}>
              Chọn tấm khác
            </button>
          </div>
        </div>
      </div>

      <Toast message={toast} />
    </>
  );
}

/** Chọn bốn tấm nổi bật nhất của năm để ghép dải. */
export function pickStrip(recap: Recap): Media[] {
  const all = recap.chapters.flatMap((chapter) => chapter.highlights);
  const sorted = [...all].sort((a, b) => b.score - a.score);
  const picked: Media[] = [];
  const places = new Set<string>();
  for (const media of sorted) {
    if (picked.length >= 4) break;
    if (places.has(media.place) && picked.length < 4) continue;
    places.add(media.place);
    picked.push(media);
  }
  for (const media of sorted) {
    if (picked.length >= 4) break;
    if (!picked.includes(media)) picked.push(media);
  }
  return picked;
}
