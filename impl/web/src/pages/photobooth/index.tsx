/**
 * Photobooth `/photobooth?muc=:id` (G4 — coder-2 `w1:pN`).
 *
 * - Giữ nguyên logic của module `src/photobooth/` (`mountPhotobooth`); trang chỉ lo khung r2,
 *   trạng thái đang tải / rỗng / lỗi và nối dữ liệu.
 * - Có `?muc=<id>`: lấy mục kỷ niệm → ảnh nguồn là ảnh của mục (bỏ video, bỏ ảnh đang ẩn),
 *   tiêu đề dải mặc định là tên mục; lưu dải bằng `POST /api/collections/:id/strips`.
 * - Không có `?muc=`: vẫn dùng được (camera + tải ảnh lên), chỉ không có nút lưu vào mục.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, fetchCollection, saveStrip, type CollectionDetail } from '../../api-extra';
import { mountPhotobooth } from '../../photobooth';
import { ImageIcon, SparkleIcon } from '../collection/icons';
import './photobooth.css';

/** Ảnh nguồn: ảnh thật của mục, theo thứ tự ngày → giờ. */
function photosOf(detail: CollectionDetail): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const day of detail.days ?? []) {
    for (const media of day.media ?? []) {
      if (media.type !== 'photo' || media.flags?.hidden) continue;
      const url = media.url?.lg || media.url?.sm || media.url?.orig;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

function shortRange(startAt: string, endAt: string): string {
  if (!startAt) return '';
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : null;
  const fmt = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric' });
  if (!end || start.toDateString() === end.toDateString()) return fmt.format(start);
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function PhotoboothPage() {
  const [params] = useSearchParams();
  const hostRef = useRef<HTMLDivElement>(null);
  const mucId = params.get('muc') ?? '';

  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(mucId));
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [saved, setSaved] = useState(0);

  /* Nạp mục khi có `?muc=`. */
  useEffect(() => {
    if (!mucId) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    fetchCollection(mucId)
      .then((data) => {
        if (!alive) return;
        setDetail(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setDetail(null);
        setLoading(false);
        setError(
          err instanceof ApiError && err.kind === 'not_found'
            ? 'Không tìm thấy mục này. Có thể mục đã bị gộp hoặc xoá.'
            : 'Chưa lấy được ảnh của mục. Bạn thử lại giúp mình nhé.',
        );
      });
    return () => {
      alive = false;
    };
  }, [mucId, round]);

  const photos = useMemo(() => (detail ? photosOf(detail) : []), [detail]);

  const saveToCollection = useCallback(
    async (png: Blob) => {
      if (!detail) return;
      const result = await saveStrip(detail.id, png);
      // `saved=false` = đang chạy bằng dữ liệu giả, chưa có máy chủ để lưu.
      if (result.saved || import.meta.env.DEV) setSaved((n) => n + 1);
    },
    [detail],
  );

  /* Gắn module khi đã có dữ liệu (hoặc khi mở không kèm mục). */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    if (mucId && (loading || error)) return undefined;
    return mountPhotobooth(host, {
      title: detail?.title,
      sourcePhotos: photos.length > 0 ? photos : undefined,
      onSaveToTrip: detail ? saveToCollection : undefined,
    });
  }, [mucId, detail, photos, loading, error, saveToCollection, round]);

  useEffect(() => {
    document.title = detail ? `Photobooth · ${detail.title} — Hành Trình` : 'Photobooth — Hành Trình';
    return () => {
      document.title = 'Hành Trình — Kỷ niệm nhà Bin & Su';
    };
  }, [detail]);

  const cover = detail?.cover?.url?.lg ?? detail?.cover?.url?.sm ?? null;

  return (
    <main id="main">
      <div className="wrap page-body pb">
        <section className={cover ? 'pb-hero co-anh' : 'pb-hero'}>
          {cover ? <img className="pb-hero__anh" src={cover} alt="" aria-hidden="true" /> : null}
          <div className="pb-hero__noi">
            <p className="pb-hero__chip">
              <SparkleIcon size={16} />
              Photobooth
            </p>
            <h2 className="pb-hero__tieu">
              {detail ? (
                <>
                  Một dải ảnh cho <em>{detail.title}</em>
                </>
              ) : (
                <>
                  Chụp một dải ảnh <em>để dành</em>
                </>
              )}
            </h2>
            <p className="pb-hero__phu">
              {detail
                ? `${detail.place || 'Nhà mình'} · ${shortRange(detail.startAt, detail.endAt)} · ${photos.length} ảnh sẵn có`
                : 'Chụp từ camera hoặc lấy ảnh trong máy. Mọi thứ chạy ngay trong trình duyệt.'}
            </p>
            {detail ? (
              <div className="pb-hero__nut">
                <Link className="btn kinh nho" to={`/muc/${encodeURIComponent(detail.id)}`}>
                  ← Về mục {detail.title}
                </Link>
                <Link className="btn kinh nho" to="/tai-anh">
                  <ImageIcon size={18} />
                  Thêm ảnh vào mục
                </Link>
              </div>
            ) : (
              <div className="pb-hero__nut">
                <Link className="btn kinh nho" to="/muc/he-da-lat">
                  ← Về mục kỷ niệm
                </Link>
              </div>
            )}
          </div>
        </section>

        {saved > 0 && detail ? (
          <p className="pb-toast" role="status">
            Đã lưu dải ảnh vào <strong>{detail.title}</strong>.{' '}
            <Link to={`/muc/${encodeURIComponent(detail.id)}`}>Mở mục để xem</Link>
          </p>
        ) : null}

        {loading ? (
          <div className="pb-dang-tai" role="status" aria-live="polite">
            <span className="pb-skel pb-skel--rong" />
            <span className="pb-skel" />
            <span className="pb-skel pb-skel--ngan" />
            <p>Đang lấy ảnh của mục…</p>
          </div>
        ) : null}

        {error ? (
          <div className="pb-loi" role="alert">
            <h3>Chưa mở được photobooth</h3>
            <p>{error}</p>
            <div className="pb-loi__nut">
              <button type="button" className="btn dac nho" onClick={() => setRound((n) => n + 1)}>
                Thử lại
              </button>
              <Link className="btn nho" to="/">
                Về trang chủ
              </Link>
            </div>
          </div>
        ) : null}

        <div className="pb-host" ref={hostRef} hidden={Boolean(error)} />
      </div>
    </main>
  );
}

export default PhotoboothPage;
