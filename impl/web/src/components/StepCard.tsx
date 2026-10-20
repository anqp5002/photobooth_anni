import { useEffect, useRef, useState } from 'react';
import type { Media, Step, Trip } from '../api/types';
import { Flag } from './Flag';
import { CommentIcon, HeartIcon, PlayIcon, ChevronDownIcon, WEATHER_ICONS } from './Icons';

function WeatherGlyph({ icon }: { icon: string }) {
  const Cmp = WEATHER_ICONS[icon] ?? WEATHER_ICONS.sunny;
  return <Cmp size={16} />;
}

interface PhotoRowProps {
  step: Step;
  onOpen: (step: Step, index: number, trigger: HTMLElement) => void;
}

/** Hàng ảnh cuộn ngang (SPEC R-019). */
function PhotoRow({ step, onOpen }: PhotoRowProps) {
  const items = step.media.filter((m) => !m.flags.hidden);
  if (items.length === 0) return null;

  return (
    <div className="photo-row thin-scroll" role="list" aria-label={`Ảnh của chặng ${step.name}`}>
      {items.map((media, index) => (
        <button
          type="button"
          role="listitem"
          className="photo-item"
          key={media.id}
          onClick={(event) => onOpen(step, index, event.currentTarget)}
          style={{ width: `${Math.round((325 * media.width) / media.height)}px` }}
        >
          <img
            src={media.lg}
            width={media.width}
            height={media.height}
            loading="lazy"
            decoding="async"
            alt={`Ảnh ${index + 1} của chặng ${step.name}`}
          />
          {media.type === 'video' && (
            <span className="photo-play" aria-hidden="true">
              <PlayIcon size={20} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

interface StepCardProps {
  step: Step;
  trip: Trip;
  active: boolean;
  registerRef: (id: string, el: HTMLElement | null) => void;
  onOpenPhoto: (step: Step, index: number, trigger: HTMLElement) => void;
}

export function StepCard({ step, trip, active, registerRef, onOpenPhoto }: StepCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = descRef.current;
    if (!el) return undefined;
    const measure = () => {
      const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || 24;
      setClamped(el.scrollHeight > lineHeight * 6 + 2);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [step.description, expanded]);

  const weather = step.weather;
  const date = new Intl.DateTimeFormat('vi-VN', {
    timeZone: trip.timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(step.startedAt));

  return (
    <article
      className={`step-card${active ? ' is-active' : ''}`}
      ref={(el) => registerRef(step.id, el)}
      id={`step-${step.id}`}
      aria-label={step.name}
    >
      <h3 className="step-title">{step.name}</h3>

      <p className="step-meta">
        <Flag code={step.location.country.code} size={16} className="step-flag" />
        <span className="step-country">{step.location.country.name}</span>
        <span className="step-dot" aria-hidden="true">
          ·
        </span>
        <time dateTime={step.startedAt}>{date}</time>
        {weather && (
          <>
            <span className="step-dot" aria-hidden="true">
              ·
            </span>
            <span className="step-temp">
              <WeatherGlyph icon={weather.icon} />
              {Math.round(weather.tempC)}°
            </span>
          </>
        )}
      </p>

      <PhotoRow step={step} onOpen={onOpenPhoto} />

      <div className={`step-desc-wrap${clamped && !expanded ? ' is-clamped' : ''}`}>
        <p className="step-desc" ref={descRef}>
          {step.description}
        </p>
      </div>

      {clamped && (
        <div className="step-desc-toggle">
          <button type="button" className="btn btn-text" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'thu gọn' : 'xem thêm'}
            <ChevronDownIcon size={16} className={expanded ? 'caret-up' : ''} />
          </button>
        </div>
      )}

      <div className="step-actions">
        <button type="button" className="btn btn-sm btn-secondary">
          <HeartIcon size={16} />
          {step.likes}
        </button>
        <button type="button" className="btn btn-sm btn-secondary">
          <CommentIcon size={16} />
          {step.comments}
        </button>
      </div>
    </article>
  );
}

export type { Media };
