import { useState } from 'react';
import type { Trip } from '../api/types';
import { formatKm, formatNumber, tripDays } from '../lib/format';
import { CloseIcon } from './Icons';
import { QrCode } from './QrCode';

/** Thanh thống kê nổi trên bản đồ (SPEC R-023). */
export function StatsBar({ trip }: { trip: Trip }) {
  const days = tripDays(trip.startedAt, trip.endedAt, trip.timezone);
  const ongoing = !trip.endedAt;

  return (
    <div className="map-stats-bar">
      {ongoing && <span className="map-stats-dot" aria-hidden="true" />}
      <span>{ongoing ? 'đang đi' : 'đã xong'}</span>
      <span className="map-stats-sep" aria-hidden="true">
        ·
      </span>
      <span>{`${days} ngày`}</span>
      <span className="map-stats-sep" aria-hidden="true">
        ·
      </span>
      <span>{`${trip.stepsTotal} chặng`}</span>
      <span className="map-stats-sep" aria-hidden="true">
        ·
      </span>
      <span>{formatKm(trip.km)}</span>
    </div>
  );
}

/** Thẻ QR mở chuyến đi trên điện thoại (SPEC R-023). */
export function QrCard({ trip, url }: { trip: Trip; url: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className="map-qr-card">
      <button
        type="button"
        className="map-qr-close"
        onClick={() => setOpen(false)}
        aria-label="Đóng thẻ mã QR"
      >
        <CloseIcon size={14} />
      </button>
      <QrCode value={url} size={116} />
      <p className="map-qr-text">Quét mã để mở chuyến đi này trên điện thoại</p>
      <p className="map-qr-meta">
        {`${formatNumber(trip.views)} lượt xem · ${formatNumber(trip.likes)} lượt thích`}
      </p>
    </div>
  );
}
