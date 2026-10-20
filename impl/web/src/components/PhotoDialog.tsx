import { useCallback, useEffect, useRef, useState } from 'react';
import type { Step, Trip } from '../api/types';
import { dayIndex, formatLongDate } from '../lib/format';
import { Avatar } from './Avatar';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, PlayIcon } from './Icons';

interface PhotoDialogProps {
  trip: Trip;
  step: Step;
  index: number;
  /** Tác giả lấy từ hồ sơ (GET /api/users/<tên>); thiếu thì dùng trip.author. */
  author?: { displayName: string; avatar: string };
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

/** Hộp thoại ảnh lớn — SPEC R-007, R-026, R-034. */
export function PhotoDialog({ trip, step, index, author, onClose, onIndexChange }: PhotoDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<number | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  const items = step.media.filter((m) => !m.flags.hidden);
  const media = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0 || next >= items.length) return;
      setVideoFailed(false);
      onIndexChange(next);
    },
    [index, items.length, onIndexChange],
  );

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        go(1);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(-1);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, video[controls]',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  if (!media) return null;

  const day = dayIndex(trip.startedAt, step.startedAt, trip.timezone);

  return (
    <div
      className="photo-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="photo-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Ảnh lớn của chặng ${step.name}`}
        ref={dialogRef}
      >
        <div className="photo-dialog-bar">
          <div className="photo-dialog-author">
            <Avatar
              src={author?.avatar ?? trip.author.avatar}
              name={author?.displayName ?? trip.author.displayName}
              size={32}
            />
            <span>{author?.displayName ?? trip.author.displayName}</span>
          </div>

          <div className="photo-dialog-title">
            <strong>{step.name}</strong>
            <span>{`Ngày ${day} - ${formatLongDate(step.startedAt, trip.timezone)}`}</span>
          </div>

          <button
            type="button"
            className="photo-dialog-close"
            onClick={onClose}
            aria-label="Đóng hộp thoại ảnh"
            ref={closeRef}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div
          className="photo-dialog-body"
          onTouchStart={(event) => {
            touchStart.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            const end = event.changedTouches[0]?.clientX ?? null;
            touchStart.current = null;
            if (start === null || end === null) return;
            const delta = end - start;
            if (Math.abs(delta) < 48) return;
            go(delta < 0 ? 1 : -1);
          }}
        >
          {media.type === 'video' && !videoFailed ? (
            <video
              className="photo-dialog-media"
              src={media.orig}
              poster={media.sm}
              controls
              autoPlay
              onError={() => setVideoFailed(true)}
            />
          ) : (
            <img
              className="photo-dialog-media"
              src={media.orig}
              alt={`Ảnh ${index + 1} của chặng ${step.name}`}
            />
          )}

          {media.type === 'video' && videoFailed && (
            <span className="photo-dialog-badge">
              <PlayIcon size={18} />
              Video
            </span>
          )}

          {hasPrev && (
            <button
              type="button"
              className="photo-dialog-nav is-prev"
              onClick={() => go(-1)}
              aria-label="Ảnh trước"
            >
              <ChevronLeftIcon size={20} />
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              className="photo-dialog-nav is-next"
              onClick={() => go(1)}
              aria-label="Ảnh sau"
            >
              <ChevronRightIcon size={20} />
            </button>
          )}

          <p className="photo-dialog-counter" aria-live="polite">
            {`${index + 1} / ${items.length}`}
          </p>
        </div>
      </div>
    </div>
  );
}
