import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ApiError,
  COLLECTION_KIND_LABELS,
  acceptSuggestion,
  dismissSuggestion,
  fetchCollection,
  fetchCollections,
  fetchMembers,
  mergeCollection,
  patchCollection,
  patchMedia,
  splitCollection,
  type CollectionDetail,
  type CollectionKind,
  type Media,
  type Member,
  type Suggestion,
} from '../../api-extra';
import { MiniMap } from './MiniMap';
import { ProtoHeader } from './ProtoHeader';
import { InlineState, LoadingBlock, RetryAction } from '../login/states';
import {
  CameraIcon,
  CheckIcon,
  CloseIcon,
  ImageIcon,
  MapIcon,
  MergeIcon,
  NextIcon,
  PencilIcon,
  PersonIcon,
  PrevIcon,
  SparkleIcon,
  SplitIcon,
} from './icons';
import { dayLabel, rangeLabel, shortDate, timeLabel, weekdayLabel } from './fmt';
import './collection.css';

/* ------------------------------------------------------------------ */
/* Tiện ích                                                            */
/* ------------------------------------------------------------------ */

/** "Bố Tuấn" → "T", "Su" → "S" (giống avatar chữ trong bản mẫu). */
function initialOf(name: string): string {
  const words = name.trim().split(/\s+/);
  const last = words[words.length - 1] ?? name;
  return (last[0] ?? '?').toUpperCase();
}

function photosOf(detail: CollectionDetail): Media[] {
  const seen = new Set<string>();
  const out: Media[] = [];
  for (const day of detail.days) {
    for (const media of day.media) {
      if (seen.has(media.id)) continue;
      seen.add(media.id);
      out.push(media);
    }
  }
  return out;
}

function videoCount(detail: CollectionDetail): number {
  return photosOf(detail).filter((m) => m.type === 'video').length;
}

function mediaById(detail: CollectionDetail): Map<string, Media> {
  const map = new Map<string, Media>();
  for (const m of photosOf(detail)) map.set(m.id, m);
  return map;
}

function payloadIds(suggestion: Suggestion): string[] {
  const raw = suggestion.payload?.mediaIds ?? suggestion.payload?.mediaId;
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (typeof raw === 'string') return [raw];
  return [];
}

function payloadString(suggestion: Suggestion, key: string): string {
  const value = suggestion.payload?.[key];
  return typeof value === 'string' ? value : '';
}

const KIND_ORDER: CollectionKind[] = [
  'trip',
  'birthday',
  'tet',
  'holiday',
  'weekend',
  'baby',
  'everyday',
  'other',
];

type Dialog =
  | { kind: 'rename' }
  | { kind: 'merge' }
  | { kind: 'split' }
  | { kind: 'members' }
  | null;

/* ------------------------------------------------------------------ */
/* Trang                                                               */
/* ------------------------------------------------------------------ */

interface CollectionPageProps {
  /** Chỉ dùng cho trang thử `muc-dev.html`: ép hiện trạng thái để chụp ảnh. */
  demo?: 'loading' | 'empty' | 'error';
}

export function CollectionPage({ demo }: CollectionPageProps = {}) {
  const { id = '' } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [errorText, setErrorText] = useState('');
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [kind, setKind] = useState<CollectionKind>('trip');
  const [accepted, setAccepted] = useState(false);
  const [done, setDone] = useState<Record<string, string>>({});
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | null>(null);
  const viewerRef = useRef<HTMLDialogElement | null>(null);

  const say = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
  }, []);

  const load = useCallback(async () => {
    if (demo === 'loading') {
      setStatus('loading');
      return;
    }
    if (demo === 'error') {
      setErrorText('Kết nối bị gián đoạn nên mình chưa lấy được mục này. Kiểm tra mạng rồi thử lại.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    try {
      const data = await fetchCollection(id);
      // Dữ liệu mock/máy chủ có thể thiếu mảng phụ; chuẩn hoá để trang không vỡ.
      const safe: CollectionDetail = {
        ...data,
        days: Array.isArray(data.days) ? data.days : [],
        route: Array.isArray(data.route) ? data.route : [],
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
        members: Array.isArray(data.members) ? data.members : [],
      };
      setDetail(safe);
      setTitle(safe.title);
      setSummary(safe.summary);
      setKind(safe.kind);
      setMembers(safe.members);
      setAccepted(safe.status === 'accepted');
      setDone({});
      setHiddenIds(new Set());
      setRemovedIds(new Set());
      setStatus('ready');
    } catch (error) {
      if (error instanceof ApiError && error.kind === 'not_found') {
        setStatus('missing');
        return;
      }
      setErrorText(
        error instanceof ApiError ? error.message : 'Không tải được mục này. Vui lòng thử lại.',
      );
      setStatus('error');
    }
  }, [demo, id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (status !== 'ready') return;
    let alive = true;
    void fetchMembers()
      .then((list) => {
        if (alive) setAllMembers(list);
      })
      .catch(() => {
        if (alive) setAllMembers([]);
      });
    return () => {
      alive = false;
    };
  }, [status]);

  const media = useMemo(() => (detail ? photosOf(detail) : []), [detail]);
  const visibleMedia = useMemo(
    () => (demo === 'empty' ? [] : media.filter((m) => !removedIds.has(m.id))),
    [demo, media, removedIds],
  );
  const byId = useMemo(() => (detail ? mediaById(detail) : new Map<string, Media>()), [detail]);

  const suggestions = useMemo(() => {
    if (!detail) return [];
    return detail.suggestions.filter((s) => !done[s.id]);
  }, [detail, done]);

  const mapPoints = useMemo(() => {
    const points: { lat: number; lon: number; cover: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const item of visibleMedia) {
      if (item.lat === null || item.lon === null) continue;
      const key = `${item.lat.toFixed(2)},${item.lon.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push({
        lat: item.lat,
        lon: item.lon,
        cover: item.url.sm,
        label: item.place,
      });
      if (points.length >= 5) break;
    }
    return points;
  }, [visibleMedia]);

  const route = useMemo(() => detail?.route?.filter((p) => p.lat && p.lon) ?? [], [detail]);

  /* ----- người dùng bấm gợi ý ------------------------------------- */

  const runSuggestion = async (suggestion: Suggestion, action: 'accept' | 'dismiss') => {
    const ids = payloadIds(suggestion);
    const label =
      action === 'dismiss'
        ? 'Đã bỏ qua gợi ý này.'
        : suggestion.type === 'merge'
          ? 'Đã gộp hai mục.'
          : suggestion.type === 'split'
            ? 'Đã tách ảnh ra mục mới.'
            : suggestion.type === 'rename'
              ? 'Đã đổi tên mục.'
              : `Đã ẩn ${ids.length || ''} ảnh mờ.`.replace('  ', ' ');

    // Cập nhật giao diện trước cho mượt, lưu máy chủ sau.
    if (action === 'accept' && suggestion.type === 'hide_blurry') {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        for (const mediaId of ids) next.add(mediaId);
        return next;
      });
    }
    if (action === 'accept' && suggestion.type === 'split') {
      setRemovedIds((prev) => {
        const next = new Set(prev);
        for (const mediaId of ids) next.add(mediaId);
        return next;
      });
    }
    if (action === 'accept' && suggestion.type === 'rename') {
      const nextTitle = payloadString(suggestion, 'title');
      if (nextTitle) setTitle(nextTitle);
    }
    if (action === 'accept' && suggestion.type === 'merge') {
      setDone((prev) => ({ ...prev, [suggestion.id]: label }));
      say(`${label} Mục còn lại đang được gộp, bạn xem lại giúp mình nhé.`);
      try {
        await acceptSuggestion(suggestion.id);
      } catch (error) {
        say(error instanceof ApiError ? error.message : 'Chưa lưu được thay đổi.');
      }
      return;
    }

    setDone((prev) => ({ ...prev, [suggestion.id]: label }));
    say(label);
    try {
      await (action === 'accept' ? acceptSuggestion(suggestion.id) : dismissSuggestion(suggestion.id));
    } catch (error) {
      if (error instanceof ApiError) say(`${error.message} (đã đổi trên máy bạn)`);
    }
  };

  const undo = (suggestion: Suggestion) => {
    setDone((prev) => {
      const next = { ...prev };
      delete next[suggestion.id];
      return next;
    });
    if (suggestion.type === 'hide_blurry' || suggestion.type === 'split') {
      const ids = payloadIds(suggestion);
      setHiddenIds((prev) => {
        const next = new Set(prev);
        for (const mediaId of ids) next.delete(mediaId);
        return next;
      });
      if (suggestion.type === 'split') {
        setRemovedIds((prev) => {
          const next = new Set(prev);
          for (const mediaId of ids) next.delete(mediaId);
          return next;
        });
      }
    }
    say('Đã hoàn tác.');
  };

  /* ----- hộp thoại ------------------------------------------------- */

  const saveTitle = async (nextTitle: string, nextSummary: string, nextKind: CollectionKind) => {
    const trimmed = nextTitle.trim();
    if (!trimmed) {
      say('Tên mục không được để trống.');
      return;
    }
    setTitle(trimmed);
    setSummary(nextSummary.trim());
    setKind(nextKind);
    setDialog(null);
    say('Đã đổi tên mục.');
    try {
      await patchCollection(id, {
        title: trimmed,
        summary: nextSummary.trim(),
        kind: nextKind,
      });
    } catch (error) {
      if (error instanceof ApiError) say(`${error.message} (đã đổi trên máy bạn)`);
    }
  };

  const saveMembers = async (next: Member[]) => {
    setMembers(next);
    setDialog(null);
    say(`Đã gắn ${next.length} người vào mục.`);
    try {
      await patchCollection(id, { memberIds: next.map((m) => m.id) });
    } catch (error) {
      if (error instanceof ApiError) say(`${error.message} (đã đổi trên máy bạn)`);
    }
  };

  const doMerge = async (intoId: string) => {
    setDialog(null);
    say('Đã gộp hai mục.');
    try {
      await mergeCollection(id, intoId);
    } catch (error) {
      if (error instanceof ApiError) say(`${error.message} (đã đổi trên máy bạn)`);
    }
  };

  const doSplit = async (mediaId: string) => {
    setDialog(null);
    setRemovedIds((prev) => new Set(prev).add(mediaId));
    say('Đã tách ảnh ra thành mục mới.');
    try {
      await splitCollection(id, mediaId);
    } catch (error) {
      if (error instanceof ApiError) say(`${error.message} (đã đổi trên máy bạn)`);
    }
  };

  const toggleHidden = async (mediaId: string) => {
    const nowHidden = !hiddenIds.has(mediaId);
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (nowHidden) next.add(mediaId);
      else next.delete(mediaId);
      return next;
    });
    say(nowHidden ? 'Đã ẩn ảnh này.' : 'Đã hiện lại ảnh.');
    try {
      await patchMedia(mediaId, { hidden: nowHidden });
    } catch (error) {
      if (error instanceof ApiError) say(`${error.message} (đã đổi trên máy bạn)`);
    }
  };

  const keepCollection = async () => {
    setAccepted(true);
    say('Đã giữ mục này trong album của nhà mình.');
    try {
      await patchCollection(id, { status: 'accepted' });
    } catch (error) {
      if (error instanceof ApiError) say(`${error.message} (đã đổi trên máy bạn)`);
    }
  };

  /* ----- xem ảnh --------------------------------------------------- */

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const openViewer = (mediaIdOrIndex: string | number) => {
    const index =
      typeof mediaIdOrIndex === 'number'
        ? mediaIdOrIndex
        : visibleMedia.findIndex((m) => m.id === mediaIdOrIndex);
    if (index >= 0) setViewerIndex(index);
  };

  const stepViewer = (delta: number) => {
    setViewerIndex((current) => {
      if (current === null || visibleMedia.length === 0) return current;
      return (current + delta + visibleMedia.length) % visibleMedia.length;
    });
  };

  useEffect(() => {
    const box = viewerRef.current;
    if (!box) return;
    if (viewerIndex !== null && !box.open) box.showModal();
    if (viewerIndex === null && box.open) box.close();
  }, [viewerIndex]);

  useEffect(() => {
    if (viewerIndex === null) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') stepViewer(1);
      if (event.key === 'ArrowLeft') stepViewer(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerIndex, visibleMedia.length]);

  /* ----- render ---------------------------------------------------- */

  const initial = allMembers[0]?.name ? 'B' : 'B';
  const notice = detail
    ? `Mục này có ${suggestions.length} gợi ý mới từ AI đang chờ bạn`
    : 'Đang mở mục kỷ niệm của nhà mình';

  return (
    <div className="muc-page">
      <a className="sr" href="#main">
        Bỏ qua điều hướng
      </a>
      <ProtoHeader notice={notice} initial={initial} familyName="nhà Bin & Su" />

      <main id="main">
        <div className="wrap content">
          {status === 'loading' && <LoadingBlock label="Đang mở mục kỷ niệm" tiles={3} />}

          {status === 'error' && (
            <InlineState
              kind="error"
              full
              title="Chưa mở được mục này"
              text={errorText}
              action={<RetryAction onRetry={() => void load()} />}
            />
          )}

          {status === 'missing' && (
            <InlineState
              kind="empty"
              full
              title="Không có mục này"
              text="Có thể mục đã bị gộp vào mục khác, hoặc đường dẫn bị gõ sai."
              action={
                <Link className="btn dac" to="/">
                  Về trang chủ
                </Link>
              }
            />
          )}

          {status === 'ready' && detail && (
            <>
              <header className="cover">
                <img
                  src={detail.cover?.url?.lg || detail.cover?.url?.orig || ''}
                  alt={detail.cover?.caption || detail.title}
                />
                <div className="cover-t">
                  <Link className="back kinh" to="/">
                    Các mục
                  </Link>
                  <h1>{title || 'Mục kỷ niệm'}</h1>
                  <p>{summary}</p>
                </div>
              </header>

              {!accepted && (
                <section className="sug-banner" aria-label="Mục do AI gợi ý">
                  <p>
                    <b>Mục này mình tự gom từ ảnh của nhà mình.</b> Bạn thấy đúng thì giữ lại, không
                    thì đổi tên hoặc tách ra.
                  </p>
                  <div>
                    <button type="button" className="btn dac nho" onClick={() => void keepCollection()}>
                      <CheckIcon size={16} /> Giữ mục này
                    </button>
                    <button type="button" className="btn nho" onClick={() => setDialog({ kind: 'rename' })}>
                      Đổi tên
                    </button>
                  </div>
                </section>
              )}

              <div className="info">
                <section className="card facts" aria-label="Thông tin mục">
                  <dl>
                    <div>
                      <dt>Ngày</dt>
                      <dd>{rangeLabel(detail.startAt, detail.endAt)}</dd>
                    </div>
                    <div>
                      <dt>Nơi</dt>
                      <dd>{detail.place || 'Chưa rõ'}</dd>
                    </div>
                    <div>
                      <dt>Loại</dt>
                      <dd>{COLLECTION_KIND_LABELS[kind] ?? 'Kỷ niệm'}</dd>
                    </div>
                    <div>
                      <dt>Số ảnh</dt>
                      <dd>
                        {detail.count.toLocaleString('vi-VN')} ảnh
                        {videoCount(detail) > 0 ? `, ${videoCount(detail)} video` : ''}
                      </dd>
                    </div>
                  </dl>
                  <div className="who">
                    <b>Ai có mặt</b>
                    <ul>
                      {members.map((member) => (
                        <li key={member.id}>
                          <span className="av" style={{ background: member.color }}>
                            {initialOf(member.name)}
                          </span>
                          {member.name}
                        </li>
                      ))}
                      <li>
                        <button
                          type="button"
                          className="add"
                          onClick={() => setDialog({ kind: 'members' })}
                        >
                          <PersonIcon size={16} /> Gắn người
                        </button>
                      </li>
                    </ul>
                  </div>
                </section>

                <section className="card mapc" aria-label="Tuyến đi">
                  {mapPoints.length > 0 || route.length > 1 ? (
                    <MiniMap points={mapPoints} route={route} />
                  ) : (
                    <div className="mini" />
                  )}
                  <span className="credit">Ảnh vệ tinh: Esri</span>
                  <Link className="btn kinh nho" to="/ban-do">
                    <MapIcon size={16} /> Xem trên bản đồ lớn
                  </Link>
                </section>
              </div>

              <section className="ai kinh" aria-label="Gợi ý của AI">
                <div className="ai-h">
                  <span className="spark">
                    <SparkleIcon size={24} />
                  </span>
                  <div>
                    <h2>Gợi ý của AI</h2>
                    <p>
                      {suggestions.length > 0
                        ? `Mình đã xem qua mục này và có ${suggestions.length} đề nghị. Bạn quyết định giữ hay bỏ.`
                        : 'Không còn gợi ý nào đang chờ. Mục này đã gọn.'}
                    </p>
                  </div>
                </div>

                {detail.suggestions.map((suggestion) => {
                  const finished = done[suggestion.id];
                  const ids = payloadIds(suggestion);
                  const count = ids.length;
                  if (finished) {
                    return (
                      <div className="sg done" key={suggestion.id} data-sg>
                        <p>
                          <b>Xong.</b> {finished}
                        </p>
                        <div>
                          <button
                            type="button"
                            className="btn nho"
                            onClick={() => undo(suggestion)}
                          >
                            Hoàn tác
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="sg" key={suggestion.id} data-sg>
                      <p>{suggestion.text}</p>
                      <div>
                        <SuggestionButtons
                          suggestion={suggestion}
                          count={count}
                          onAccept={() => void runSuggestion(suggestion, 'accept')}
                          onDismiss={() => void runSuggestion(suggestion, 'dismiss')}
                          onOpenRename={() => setDialog({ kind: 'rename' })}
                          onReview={() => {
                            const first = ids.find((mediaId) => byId.has(mediaId));
                            if (first) openViewer(first);
                            else say('Ảnh gợi ý không còn trong mục này.');
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </section>

              {visibleMedia.length === 0 ? (
                <div className="sv-box">
                  <div className="dot">
                    <ImageIcon size={32} />
                  </div>
                  <h2>Mục này chưa có ảnh</h2>
                  <p>Tải ảnh chụp trong chuyến đi lên, mình sẽ xếp chúng theo từng ngày.</p>
                  <Link className="btn dac" to="/tai-anh">
                    <CameraIcon size={18} /> Tải ảnh lên
                  </Link>
                </div>
              ) : (
                detail.days.map((day, dayIndex) => {
                  const items = day.media.filter(
                    (m) => !removedIds.has(m.id) && !hiddenIds.has(m.id),
                  );
                  if (items.length === 0) return null;
                  // Lưới theo số ảnh để không còn ô trống: 1 ô lớn · 2 ô · 3 ô (ô đầu lớn) ·
                  // 4 ô 2×2 · từ 5 dùng lưới bản mẫu (ô đầu cao), thừa thì ô cuối "Thêm N ảnh".
                  const layout =
                    items.length >= 5
                      ? 'g3'
                      : items.length === 4
                        ? 'g4'
                        : items.length === 3
                          ? 'g2'
                          : items.length === 2
                            ? 'g2 duo'
                            : 'g1';
                  const capacity =
                    layout === 'g3' ? 4 : layout === 'g4' ? 4 : layout === 'g2' ? 3 : 2;
                  const shown = items.length <= capacity ? items : items.slice(0, capacity - 1);
                  const rest = items.length - shown.length;
                  return (
                    <section className="day" key={day.date}>
                      <div className="day-h">
                        <h2>Ngày {dayIndex + 1}</h2>
                        <p>
                          {items[0]?.place ? `${items[0].place} · ` : ''}
                          {weekdayLabel(day.date)}
                        </p>
                        <span className="count">{items.length} ảnh</span>
                      </div>
                      <div className={`g ${layout}`}>
                        {shown.map((item, index) => (
                          <figure
                            key={item.id}
                            className={
                              index === 0 && layout === 'g3'
                                ? 'tall'
                                : index === 0 && layout === 'g2'
                                  ? 'p1'
                                  : undefined
                            }
                          >
                            <img
                              src={item.url.sm || item.url.lg}
                              alt={item.caption || `Ảnh ngày ${dayLabel(day.date)}`}
                              loading="lazy"
                            />
                            <button
                              type="button"
                              className="photo-btn"
                              aria-label={`Xem ảnh: ${item.caption || 'ảnh trong mục'}`}
                              onClick={() => openViewer(item.id)}
                            />
                            <span className="fig-tag">{item.caption || item.place}</span>
                          </figure>
                        ))}
                        {rest > 0 && (
                          <figure className="more">
                            <img
                              src={items[shown.length]?.url.sm ?? shown[0]?.url.sm ?? ''}
                              alt=""
                              loading="lazy"
                            />
                            <span>Thêm {rest} ảnh</span>
                            <button
                              type="button"
                              className="photo-btn"
                              aria-label={`Xem thêm ${rest} ảnh của ngày ${dayLabel(day.date)}`}
                              onClick={() => {
                                const localIndex = visibleMedia.findIndex(
                                  (m) => m.id === items[shown.length]?.id,
                                );
                                if (localIndex >= 0) setViewerIndex(localIndex);
                              }}
                            />
                          </figure>
                        )}
                      </div>
                    </section>
                  );
                })
              )}

              <div className="tools" aria-label="Việc với mục này">
                <button type="button" className="btn nho" onClick={() => setDialog({ kind: 'rename' })}>
                  <PencilIcon size={16} /> Đổi tên mục
                </button>
                <button type="button" className="btn nho" onClick={() => setDialog({ kind: 'merge' })}>
                  <MergeIcon size={16} /> Gộp mục
                </button>
                <button type="button" className="btn nho" onClick={() => setDialog({ kind: 'split' })}>
                  <SplitIcon size={16} /> Tách ảnh
                </button>
                <button type="button" className="btn nho" onClick={() => setDialog({ kind: 'members' })}>
                  <PersonIcon size={16} /> Gắn người
                </button>
                <span className="spacer" />
                <Link className="btn nho" to={`/photobooth?muc=${encodeURIComponent(id)}`}>
                  <CameraIcon size={16} /> Ghép dải ảnh
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      {dialog?.kind === 'rename' && (
        <RenameDialog
          title={title}
          summary={summary}
          kind={kind}
          onClose={() => setDialog(null)}
          onSave={(nextTitle, nextSummary, nextKind) => void saveTitle(nextTitle, nextSummary, nextKind)}
        />
      )}

      {dialog?.kind === 'merge' && (
        <MergeDialog
          currentId={id}
          onClose={() => setDialog(null)}
          onMerge={(intoId) => void doMerge(intoId)}
        />
      )}

      {dialog?.kind === 'split' && (
        <SplitDialog
          media={visibleMedia}
          onClose={() => setDialog(null)}
          onSplit={(mediaId) => void doSplit(mediaId)}
        />
      )}

      {dialog?.kind === 'members' && (
        <MembersDialog
          all={allMembers.length > 0 ? allMembers : members}
          chosen={members}
          onClose={() => setDialog(null)}
          onSave={(next) => void saveMembers(next)}
        />
      )}

      <dialog
        ref={viewerRef}
        className="viewer"
        onClose={() => setViewerIndex(null)}
        onCancel={() => setViewerIndex(null)}
      >
        {viewerIndex !== null && visibleMedia[viewerIndex] && (
          <ViewerBody
            media={visibleMedia[viewerIndex]}
            position={`${viewerIndex + 1} / ${visibleMedia.length}`}
            hidden={hiddenIds.has(visibleMedia[viewerIndex].id)}
            onClose={() => setViewerIndex(null)}
            onPrev={() => stepViewer(-1)}
            onNext={() => stepViewer(1)}
            onToggleHidden={() => void toggleHidden(visibleMedia[viewerIndex].id)}
          />
        )}
      </dialog>

      <div className={toast ? 'toast on' : 'toast'} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mảnh giao diện                                                      */
/* ------------------------------------------------------------------ */

interface SuggestionButtonsProps {
  suggestion: Suggestion;
  count: number;
  onAccept: () => void;
  onDismiss: () => void;
  onOpenRename: () => void;
  onReview: () => void;
}

function SuggestionButtons({
  suggestion,
  count,
  onAccept,
  onDismiss,
  onOpenRename,
  onReview,
}: SuggestionButtonsProps) {
  if (suggestion.type === 'hide_blurry') {
    return (
      <>
        <button type="button" className="btn dac nho" onClick={onAccept}>
          Giữ ẩn{count > 0 ? ` ${count} ảnh` : ''}
        </button>
        <button type="button" className="btn nho" onClick={onReview}>
          Xem lại{count > 0 ? ` ${count} ảnh` : ''}
        </button>
      </>
    );
  }
  if (suggestion.type === 'merge') {
    return (
      <>
        <button type="button" className="btn dac nho" onClick={onAccept}>
          Gộp hai mục
        </button>
        <button type="button" className="btn nho" onClick={onDismiss}>
          Bỏ qua
        </button>
      </>
    );
  }
  if (suggestion.type === 'split') {
    return (
      <>
        <button type="button" className="btn dac nho" onClick={onAccept}>
          Tách thành mục mới
        </button>
        <button type="button" className="btn nho" onClick={onDismiss}>
          Bỏ qua
        </button>
      </>
    );
  }
  return (
    <>
      <button type="button" className="btn dac nho" onClick={onOpenRename}>
        Đổi tên
      </button>
      <button type="button" className="btn nho" onClick={onDismiss}>
        Bỏ qua
      </button>
    </>
  );
}

interface RenameDialogProps {
  title: string;
  summary: string;
  kind: CollectionKind;
  onClose: () => void;
  onSave: (title: string, summary: string, kind: CollectionKind) => void;
}

function RenameDialog({ title, summary, kind, onClose, onSave }: RenameDialogProps) {
  const [nextTitle, setNextTitle] = useState(title);
  const [nextSummary, setNextSummary] = useState(summary);
  const [nextKind, setNextKind] = useState<CollectionKind>(kind);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.querySelector('input')?.focus();
  }, []);

  return (
    <div
      className="dialog-bg"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="muc-rename" ref={boxRef}>
        <button type="button" className="x" aria-label="Đóng" onClick={onClose}>
          <CloseIcon />
        </button>
        <h2 id="muc-rename">Đổi tên mục</h2>
        <p>Tên ngắn, đúng như nhà mình vẫn gọi. Ví dụ “Hè ở Đà Lạt”.</p>
        <label className="field">
          <span>Tên mục</span>
          <input
            value={nextTitle}
            maxLength={80}
            onChange={(event) => setNextTitle(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Tóm tắt một câu</span>
          <textarea
            value={nextSummary}
            maxLength={240}
            onChange={(event) => setNextSummary(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Loại mục</span>
          <select
            value={nextKind}
            onChange={(event) => setNextKind(event.target.value as CollectionKind)}
          >
            {KIND_ORDER.map((option) => (
              <option key={option} value={option}>
                {COLLECTION_KIND_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn nho" onClick={onClose}>
            Thôi
          </button>
          <button
            type="button"
            className="btn dac nho"
            onClick={() => onSave(nextTitle, nextSummary, nextKind)}
          >
            Lưu tên mới
          </button>
        </div>
      </div>
    </div>
  );
}

interface MergeDialogProps {
  currentId: string;
  onClose: () => void;
  onMerge: (intoId: string) => void;
}

function MergeDialog({ currentId, onClose, onMerge }: MergeDialogProps) {
  const [options, setOptions] = useState<{ id: string; title: string; place: string }[] | null>(null);
  const [chosen, setChosen] = useState('');

  useEffect(() => {
    let alive = true;
    void fetchCollections()
      .then((list) => {
        if (!alive) return;
        setOptions(
          list
            .filter((c) => c.id !== currentId)
            .map((c) => ({ id: c.id, title: c.title, place: c.place })),
        );
      })
      .catch(() => {
        if (alive) setOptions([]);
      });
    return () => {
      alive = false;
    };
  }, [currentId]);

  return (
    <div
      className="dialog-bg"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="muc-merge">
        <button type="button" className="x" aria-label="Đóng" onClick={onClose}>
          <CloseIcon />
        </button>
        <h2 id="muc-merge">Gộp vào mục khác</h2>
        <p>Ảnh của mục này sẽ chuyển sang mục bạn chọn. Mục đang mở sẽ không còn.</p>
        <div className="pick" role="radiogroup" aria-label="Chọn mục để gộp vào">
          {options === null && <p>Đang lấy danh sách mục…</p>}
          {options !== null && options.length === 0 && <p>Chưa có mục nào khác để gộp.</p>}
          {options?.map((option) => (
            <label key={option.id}>
              <input
                type="radio"
                name="muc-merge-into"
                value={option.id}
                checked={chosen === option.id}
                onChange={() => setChosen(option.id)}
              />
              <span>
                {option.title}
                <small>{option.place}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn nho" onClick={onClose}>
            Thôi
          </button>
          <button
            type="button"
            className="btn dac nho"
            disabled={!chosen}
            onClick={() => chosen && onMerge(chosen)}
          >
            Gộp vào mục này
          </button>
        </div>
      </div>
    </div>
  );
}

interface SplitDialogProps {
  media: Media[];
  onClose: () => void;
  onSplit: (mediaId: string) => void;
}

function SplitDialog({ media, onClose, onSplit }: SplitDialogProps) {
  const [chosen, setChosen] = useState('');
  return (
    <div
      className="dialog-bg"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="muc-split">
        <button type="button" className="x" aria-label="Đóng" onClick={onClose}>
          <CloseIcon />
        </button>
        <h2 id="muc-split">Tách ra mục mới</h2>
        <p>Chọn ảnh mở đầu cho mục mới. Các ảnh sau ảnh này có thể chuyển sang mục đó.</p>
        <div className="pick" role="radiogroup" aria-label="Chọn ảnh mở đầu">
          {media.length === 0 && <p>Mục này chưa có ảnh để tách.</p>}
          {media.map((item) => (
            <label key={item.id}>
              <input
                type="radio"
                name="muc-split-start"
                value={item.id}
                checked={chosen === item.id}
                onChange={() => setChosen(item.id)}
              />
              <img src={item.url.sm} alt="" loading="lazy" />
              <span>
                {item.caption || 'Ảnh trong mục'}
                <small>
                  {shortDate(item.takenAt)} · {timeLabel(item.takenAt)} · {item.place}
                </small>
              </span>
            </label>
          ))}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn nho" onClick={onClose}>
            Thôi
          </button>
          <button
            type="button"
            className="btn dac nho"
            disabled={!chosen}
            onClick={() => chosen && onSplit(chosen)}
          >
            Tách từ ảnh này
          </button>
        </div>
      </div>
    </div>
  );
}

interface MembersDialogProps {
  all: Member[];
  chosen: Member[];
  onClose: () => void;
  onSave: (members: Member[]) => void;
}

function MembersDialog({ all, chosen, onClose, onSave }: MembersDialogProps) {
  const [picked, setPicked] = useState<Set<string>>(new Set(chosen.map((m) => m.id)));
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div
      className="dialog-bg"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="muc-members">
        <button type="button" className="x" aria-label="Đóng" onClick={onClose}>
          <CloseIcon />
        </button>
        <h2 id="muc-members">Ai có mặt trong mục này</h2>
        <p>Chọn người có trong ảnh. Bạn gắn tay, mình không tự đoán.</p>
        <div className="member-pick">
          {all.length === 0 && <p>Chưa có ai trong danh sách người của nhà.</p>}
          {all.map((member) => (
            <button
              key={member.id}
              type="button"
              aria-pressed={picked.has(member.id)}
              onClick={() => toggle(member.id)}
            >
              <span className="av" style={{ background: member.color }}>
                {initialOf(member.name)}
              </span>
              {member.name}
            </button>
          ))}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn nho" onClick={onClose}>
            Thôi
          </button>
          <button
            type="button"
            className="btn dac nho"
            onClick={() => onSave(all.filter((member) => picked.has(member.id)))}
          >
            Lưu người có mặt
          </button>
        </div>
      </div>
    </div>
  );
}

interface ViewerBodyProps {
  media: Media;
  position: string;
  hidden: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleHidden: () => void;
}

function ViewerBody({ media, position, hidden, onClose, onPrev, onNext, onToggleHidden }: ViewerBodyProps) {
  return (
    <>
      <div className="viewer-stage">
        <button type="button" className="x" aria-label="Đóng ảnh" onClick={onClose}>
          <CloseIcon />
        </button>
        <button type="button" className="nav prev" aria-label="Ảnh trước" onClick={onPrev}>
          <PrevIcon />
        </button>
        <img src={media.url.lg || media.url.orig} alt={media.caption || 'Ảnh trong mục'} />
        <button type="button" className="nav next" aria-label="Ảnh sau" onClick={onNext}>
          <NextIcon />
        </button>
      </div>
      <div className="viewer-bar">
        <div className="txt">
          <b>{media.caption || 'Ảnh trong mục'}</b>
          <span>
            {dayLabel(media.takenAt)} · {timeLabel(media.takenAt)} · {media.place}
            {media.country ? `, ${media.country}` : ''} · {position}
          </span>
          {media.tags.length > 0 && (
            <div className="tags">
              {media.tags.map((tag) => (
                <i key={tag}>{tag}</i>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="btn nho" onClick={onToggleHidden}>
          {hidden ? 'Hiện lại ảnh này' : 'Ẩn ảnh này'}
        </button>
      </div>
    </>
  );
}

export default CollectionPage;
