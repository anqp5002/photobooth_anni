import { useCallback, useEffect, useRef, useState } from 'react';
import type { Step, Trip } from '../api/types';
import { Flag } from './Flag';
import { CommentIcon, HeartIcon, ShareIcon, WEATHER_ICONS } from './Icons';

const GUIDE_KEY = 'hanh-trinh:story-guide-seen';
const AUTO_ADVANCE_MS = 5000;

function WeatherGlyph({ icon }: { icon: string }) {
  const Cmp = WEATHER_ICONS[icon] ?? WEATHER_ICONS.sunny;
  return <Cmp size={14} />;
}

interface StoryViewProps {
  trip: Trip;
  step: Step;
  onClose: () => void;
  onStepChange: (stepId: string) => void;
}

/** Màn story toàn chiều cao ở điện thoại (SPEC R-010, R-029). */
export function StoryView({ trip, step, onClose, onStepChange }: StoryViewProps) {
  const items = step.media.filter((m) => !m.flags.hidden);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [guide, setGuide] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GUIDE_KEY) === null;
    } catch {
      return false;
    }
  });
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const holdTimer = useRef<number | null>(null);
  const stepIdRef = useRef(step.id);

  stepIdRef.current = step.id;

  useEffect(() => {
    setIndex(0);
  }, [step.id]);

  const stepIndex = trip.steps.findIndex((s) => s.id === step.id);

  const goStep = useCallback(
    (delta: number) => {
      const next = trip.steps[stepIndex + delta];
      if (!next) return;
      onStepChange(next.id);
    },
    [onStepChange, stepIndex, trip.steps],
  );

  const goPhoto = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0) {
        goStep(-1);
        return;
      }
      if (next >= items.length) {
        goStep(1);
        return;
      }
      setIndex(next);
    },
    [goStep, index, items.length],
  );

  useEffect(() => {
    if (paused || guide) return undefined;
    const timer = window.setTimeout(() => goPhoto(1), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [goPhoto, index, paused, guide]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') goPhoto(1);
      if (event.key === 'ArrowLeft') goPhoto(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [goPhoto, onClose]);

  const media = items[index] ?? items[0];
  const weather = step.weather;

  const closeGuide = () => {
    setGuide(false);
    try {
      localStorage.setItem(GUIDE_KEY, '1');
    } catch {
      /* bỏ qua */
    }
  };

  const startHold = () => {
    holdTimer.current = window.setTimeout(() => setPaused(true), 280);
  };
  const endHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setPaused(false);
  };

  return (
    <div className={`story${paused ? ' is-paused' : ''}`} role="dialog" aria-modal="true" aria-label={step.name}>
      <div className="story-progress" aria-hidden="true">
        {items.map((item, i) => (
          <span key={item.id} className={i < index ? 'is-done' : i === index ? 'is-active' : ''} />
        ))}
      </div>

      <div
        className="story-sheet"
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        onPointerLeave={endHold}
        onClick={(event) => {
          const target = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - target.left) / target.width;
          if (ratio > 0.5) goPhoto(1);
          else goPhoto(-1);
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const touch = event.changedTouches[0];
          touchStart.current = null;
          if (!start || !touch) return;
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
          goStep(dx < 0 ? 1 : -1);
        }}
      >
        {media && <img className="story-bg" src={media.lg} alt="" aria-hidden="true" />}
        <span className="story-shade" aria-hidden="true" />

        {media && (
          <img
            className="story-photo"
            src={media.lg}
            alt={`Ảnh ${index + 1} của chặng ${step.name}`}
            draggable={false}
          />
        )}

        <div className="story-content">
          <h2 className="story-title">{step.name}</h2>
          <p className="story-meta">
            <Flag code={step.location.country.code} size={14} />
            <span>{step.location.country.name}</span>
            <span className="story-dot" aria-hidden="true">
              ·
            </span>
            <time dateTime={step.startedAt}>
              {new Intl.DateTimeFormat('vi-VN', {
                timeZone: trip.timezone,
                day: '2-digit',
                month: '2-digit',
              }).format(new Date(step.startedAt))}
            </time>
            {weather && (
              <>
                <span className="story-dot" aria-hidden="true">
                  ·
                </span>
                <span className="story-temp">
                  <WeatherGlyph icon={weather.icon} />
                  {`${Math.round(weather.tempC)}°`}
                </span>
              </>
            )}
          </p>
          <p className="story-desc">{step.description}</p>
          <button type="button" className="story-more">
            đọc thêm
          </button>
        </div>

        <div className="story-bar">
          <button type="button" className="story-action">
            <HeartIcon size={20} />
            <span>{step.likes}</span>
          </button>
          <button type="button" className="story-action">
            <CommentIcon size={20} />
            <span>{step.comments}</span>
          </button>
          <button type="button" className="story-action">
            <ShareIcon size={20} />
            <span>chia sẻ</span>
          </button>
        </div>
      </div>

      {guide && (
        <div className="story-guide" role="dialog" aria-modal="true" aria-label="Hướng dẫn cử chỉ">
          <div className="story-guide-card">
            <h3 className="story-guide-title">Cách xem chuyến đi</h3>
            <ul className="story-guide-list">
              <li>
                <span className="story-guide-icon" aria-hidden="true">
                  ⇥
                </span>
                Chạm nửa phải hoặc nửa trái để đổi ảnh
              </li>
              <li>
                <span className="story-guide-icon" aria-hidden="true">
                  ↔
                </span>
                Vuốt trái hoặc phải để đổi chặng
              </li>
              <li>
                <span className="story-guide-icon" aria-hidden="true">
                  ⏸
                </span>
                Giữ ngón tay để dừng lại
              </li>
            </ul>
            <button type="button" className="btn btn-lg btn-primary story-guide-btn" onClick={closeGuide}>
              tiếp tục
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
