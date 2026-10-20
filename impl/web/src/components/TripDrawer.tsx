import { useEffect, useState } from 'react';
import type { Trip } from '../api/types';
import { formatKm, formatNumber, tripDays } from '../lib/format';
import { MAP_STYLE_LABELS, type MapStyleId } from '../map/style';
import { Avatar } from './Avatar';
import { ChevronDownIcon, ShareIcon } from './Icons';

interface TripDrawerProps {
  trip: Trip;
  open: boolean;
  onClose: () => void;
  styleKind: MapStyleId;
  onStyleKindChange: (kind: MapStyleId) => void;
}

/** Ngăn menu trượt từ phải ở điện thoại (SPEC R-011, R-030). */
export function TripDrawer({ trip, open, onClose, styleKind, onStyleKindChange }: TripDrawerProps) {
  const [styleOpen, setStyleOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const days = tripDays(trip.startedAt, trip.endedAt, trip.timezone);
  const stats: { value: string; label: string }[] = [
    { value: formatKm(trip.km), label: 'quãng đường' },
    { value: formatNumber(trip.views), label: 'lượt xem' },
    { value: formatNumber(trip.likes), label: 'lượt thích' },
    { value: `${days} ngày`, label: 'số ngày' },
    { value: `${trip.countries.length}`, label: 'quốc gia' },
    { value: `${trip.stepsTotal}`, label: 'chặng' },
  ];

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} role="presentation" />
      <aside className="trip-drawer" aria-label="Thông tin chuyến đi">
        <div className="drawer-cover">
          <img src={trip.cover.sm} alt="" aria-hidden="true" />
          <div className="drawer-cover-shade" />
          <div className="drawer-author">
            <Avatar src={trip.author.avatar} name={trip.author.displayName} size={28} />
            <span>{trip.author.displayName}</span>
          </div>
        </div>

        <h2 className="drawer-title">{trip.name}</h2>

        <div className="drawer-stats">
          {stats.map((item) => (
            <div className="drawer-stat" key={item.label}>
              <b>{item.value}</b>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div className="drawer-map-row">
          <button
            type="button"
            className="drawer-map-trigger"
            onClick={() => setStyleOpen((v) => !v)}
            aria-expanded={styleOpen}
          >
            <span>kiểu bản đồ</span>
            <span className="drawer-map-value">
              {MAP_STYLE_LABELS[styleKind]}
              <ChevronDownIcon size={16} className={styleOpen ? 'caret-up' : ''} />
            </span>
          </button>
          {styleOpen && (
            <ul className="drawer-map-options">
              {(Object.keys(MAP_STYLE_LABELS) as MapStyleId[]).map((kind) => (
                <li key={kind}>
                  <button
                    type="button"
                    className={kind === styleKind ? 'is-active' : ''}
                    onClick={() => {
                      onStyleKindChange(kind);
                      setStyleOpen(false);
                    }}
                  >
                    {MAP_STYLE_LABELS[kind]}
                    {kind === styleKind && <span aria-hidden="true">✓</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="drawer-foot">
          <button type="button" className="btn btn-lg btn-secondary drawer-share">
            <ShareIcon size={18} />
            chia sẻ
          </button>
          <p className="drawer-credit">Ảnh vệ tinh: Esri, Maxar, Earthstar Geographics</p>
        </div>
      </aside>
    </>
  );
}
