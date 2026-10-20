import { useEffect, useRef } from 'react';
import type { Step, Trip } from '../api/types';
import { formatCardDate, isWithinHours } from '../lib/format';

/** Dải thẻ chặng ngang ở đáy màn hình điện thoại (SPEC R-028). */
export function MobileStrip({
  trip,
  activeStepId,
  onSelect,
}: {
  trip: Trip;
  activeStepId: string | null;
  onSelect: (step: Step) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !activeStepId) return;
    const card = track.querySelector<HTMLElement>(`[data-step="${activeStepId}"]`);
    if (!card) return;
    const left = card.offsetLeft - track.clientWidth / 2 + card.clientWidth / 2;
    track.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [activeStepId]);

  return (
    <div className="mobile-strip">
      <div className="mobile-strip-track" ref={trackRef}>
        <span className="mobile-strip-line" aria-hidden="true" />
        <button
          type="button"
          className="strip-card is-start"
          onClick={() => onSelect(trip.steps[0])}
        >
          <span className="strip-card-title">Bắt đầu chuyến</span>
          <span className="strip-card-sub">{formatCardDate(trip.startedAt, trip.timezone)}</span>
        </button>

        {trip.steps.map((step) => (
          <button
            type="button"
            key={step.id}
            data-step={step.id}
            className={`strip-card${step.id === activeStepId ? ' is-active' : ''}`}
            onClick={() => onSelect(step)}
          >
            <span className="strip-card-title">{step.location.name}</span>
            <span className="strip-card-sub">
              {`${step.media.filter((m) => !m.flags.hidden).length} ảnh`}
            </span>
            {isWithinHours(step.startedAt, 48) && <span className="strip-card-new">mới</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
