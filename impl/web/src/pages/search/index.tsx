/**
 * Tìm ảnh bằng câu nói thường — `/tim-kiem?q=` (G2).
 *
 * - Ô hỏi lớn: gõ như đang kể ("ảnh sinh nhật Su năm nay"), Enter hoặc nút "Tìm ảnh".
 * - 4 câu mẫu bấm được (đúng 4 câu trong MEGAPLAN_r2.md).
 * - Bộ lọc AI hiểu được hiện thành **chip bỏ được**; bỏ chip thì tìm lại với bộ lọc còn lại
 *   (lọc ngay trên kết quả đã có bằng đúng các trường của `filters` — ngày, nơi, từ khoá, loại).
 * - Lưới kết quả (bấm ảnh để xem lớn) + mục kỷ niệm liên quan.
 * - Đang tải / rỗng / lỗi dùng `PageStates` + `InlineState` chung của nhóm B (G5).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ApiError,
  fetchSearch,
  kindLabel,
  type Collection,
  type Media,
  type SearchFilters,
  type SearchResult,
} from '../../api';
import { fetchCollections, fetchMembers, type Member } from '../../api-extra';
import { CloseIcon, SearchIcon, SparkleIcon } from '../../layout/Icons';
import { CURRENT_YEAR } from '../../layout/nav';
import { InlineState, PageStates, demoStateOf, type ViewState } from '../login/states';
import './search.css';

/** Trang chưa hỏi gì (`idle`) là trạng thái riêng, ngoài ba trạng thái chung. */
type Phase = ViewState | 'idle';

/** 4 câu mẫu trong MEGAPLAN_r2.md ("Tìm ảnh bằng câu nói thường"). */
const SAMPLE_QUERIES = [
  'ảnh sinh nhật Su năm nay',
  'đi biển tháng 8',
  'Tết ở quê',
  'ảnh có bánh kem',
];

/** Từ khoá loại mục (giống máy chủ) để lọc tại trình duyệt khi bỏ chip. */
const KIND_WORDS: Record<string, string[]> = {
  birthday: ['sinh nhat', 'thoi noi', 'banh kem'],
  tet: ['tet', 'giao thua', 'phong bao'],
  trip: ['chuyen di', 'du lich', 'nghi mat', 'di bien', 'di xa'],
  weekend: ['cuoi tuan'],
  holiday: ['nghi le', 'ngay le'],
  baby: ['em be', 'baby'],
  everyday: ['thuong ngay'],
};

/** Bỏ dấu + hạ chữ thường, giống `deaccent` của máy chủ. */
function deaccent(text: string): string {
  return text
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const MONTHS = [
  'tháng 1',
  'tháng 2',
  'tháng 3',
  'tháng 4',
  'tháng 5',
  'tháng 6',
  'tháng 7',
  'tháng 8',
  'tháng 9',
  'tháng 10',
  'tháng 11',
  'tháng 12',
];

/** "2026-05-01" → "1 tháng 5, 2026". */
function longDate(iso: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  if (!month) return iso;
  const monthLabel = MONTHS[Number(month) - 1] ?? `tháng ${Number(month)}`;
  return day ? `${Number(day)} ${monthLabel}, ${year}` : `${monthLabel}, ${year}`;
}

/** "2026-05-02T16:30:00+07:00" → "2 tháng 5, 2026". */
function dateOf(media: Media): string {
  return longDate(media.takenAt.slice(0, 10));
}

/** Nhãn ngắn cho bộ lọc thời gian: cả năm → "Năm 2026", cả tháng → "Tháng 5, 2026". */
function dateChipLabel(from: string | null, to: string | null): string {
  if (from && to) {
    const [fy, fm, fd] = from.split('-');
    const [ty, tm, td] = to.split('-');
    if (fy === ty && fm === '01' && fd === '01' && tm === '12' && td === '31') {
      return `Thời gian: năm ${fy}`;
    }
    if (fy === ty && fm === tm && fd === '01') {
      return `Thời gian: tháng ${Number(fm)}, ${fy}`;
    }
    return `Thời gian: ${longDate(from)} – ${longDate(to)}`;
  }
  if (from) return `Thời gian: từ ${longDate(from)}`;
  if (to) return `Thời gian: đến ${longDate(to)}`;
  return 'Thời gian';
}

interface Chip {
  key: string;
  /** Nhãn hiện trên chip, ví dụ "Nơi: Hà Nội". */
  label: string;
  group: 'date' | 'place' | 'tag' | 'kind' | 'member';
}

/** Tên người trong nhà: mock trả id ("m-su"), máy chủ trả tên ("Su"). */
function memberLabel(value: string, members: Member[]): string {
  const hit = members.find((member) => member.id === value || member.name === value);
  return hit?.name ?? value;
}

/** Bộ lọc của máy chủ → danh sách chip bỏ được. */
function chipsOf(filters: SearchFilters, members: Member[]): Chip[] {
  const chips: Chip[] = [];
  if (filters.from || filters.to) {
    chips.push({ key: 'date', group: 'date', label: dateChipLabel(filters.from, filters.to) });
  }
  for (const place of filters.places) {
    chips.push({ key: `place:${place}`, group: 'place', label: `Nơi: ${place}` });
  }
  for (const tag of filters.tags) {
    chips.push({ key: `tag:${tag}`, group: 'tag', label: `Từ khoá: ${tag}` });
  }
  for (const kind of filters.kinds) {
    chips.push({ key: `kind:${kind}`, group: 'kind', label: `Loại: ${kindLabel(kind)}` });
  }
  for (const person of filters.members) {
    chips.push({ key: `member:${person}`, group: 'member', label: `Người: ${memberLabel(person, members)}` });
  }
  return chips;
}

/** Bộ lọc còn lại sau khi bỏ chip. */
function remainingFilters(filters: SearchFilters, removed: Set<string>): SearchFilters {
  return {
    from: removed.has('date') ? null : filters.from,
    to: removed.has('date') ? null : filters.to,
    places: filters.places.filter((place) => !removed.has(`place:${place}`)),
    tags: filters.tags.filter((tag) => !removed.has(`tag:${tag}`)),
    kinds: filters.kinds.filter((kind) => !removed.has(`kind:${kind}`)),
    members: filters.members.filter((person) => !removed.has(`member:${person}`)),
  };
}

/**
 * Lọc lại kết quả theo bộ lọc còn lại — cùng quy tắc với máy chủ:
 * ngày theo `takenAt`, nơi/từ khoá so không dấu trên caption + tag + nơi, loại theo mục.
 * `Media` không có danh sách người nên chip "Người" không thu hẹp được ở trình duyệt.
 */
function filterResults(
  list: Media[],
  filters: SearchFilters,
  kindOf: Map<string, string>,
): Media[] {
  return list.filter((media) => {
    const date = media.takenAt.slice(0, 10);
    if (filters.from && date && date < filters.from) return false;
    if (filters.to && date && date > filters.to) return false;

    const haystack = deaccent(
      [media.caption, ...media.tags, media.place, media.country].join(' | '),
    );
    if (filters.places.length && !filters.places.some((place) => haystack.includes(deaccent(place)))) {
      return false;
    }
    if (filters.tags.length && !filters.tags.some((tag) => haystack.includes(deaccent(tag)))) {
      return false;
    }
    if (filters.kinds.length) {
      const kind = media.collectionId ? kindOf.get(media.collectionId) : undefined;
      const ok = filters.kinds.some(
        (wanted) =>
          kind === wanted || (KIND_WORDS[wanted] ?? []).some((word) => haystack.includes(word)),
      );
      if (!ok) return false;
    }
    return true;
  });
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const demo = demoStateOf(params.get('state'));

  const [draft, setDraft] = useState(query);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [phase, setPhase] = useState<Phase>(query ? 'loading' : 'idle');
  const [errorText, setErrorText] = useState('');
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [members, setMembers] = useState<Member[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  /* Người trong nhà — chỉ để hiện đúng tên trên chip "Người". */
  useEffect(() => {
    let alive = true;
    fetchMembers()
      .then((list) => {
        if (alive) setMembers(list);
      })
      .catch(() => {
        /* không có danh sách người thì chip vẫn hiện giá trị gốc */
      });
    return () => {
      alive = false;
    };
  }, []);

  /* Trang chưa hỏi gì: mời mở một mục kỷ niệm. */
  useEffect(() => {
    if (query || collections.length > 0) return undefined;
    let alive = true;
    fetchCollections({ year: String(CURRENT_YEAR) })
      .then((list) => {
        if (alive) setCollections(list);
      })
      .catch(() => {
        /* trống thì thôi */
      });
    return () => {
      alive = false;
    };
  }, [query, collections.length]);

  /* Tìm theo câu hỏi trên URL. */
  useEffect(() => {
    if (demo) {
      setPhase(demo);
      return undefined;
    }
    if (query.length < 2) {
      setPhase('idle');
      setResult(null);
      setRemoved(new Set());
      return undefined;
    }

    let alive = true;
    setPhase('loading');
    setErrorText('');
    fetchSearch(query)
      .then((data) => {
        if (!alive) return;
        setResult(data);
        setRemoved(new Set());
        setPhase(data.results.length === 0 && data.collections.length === 0 ? 'empty' : 'ready');
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setErrorText(
          error instanceof ApiError
            ? error.message
            : 'Không tìm được lúc này. Bạn thử lại giúp mình nhé.',
        );
        setPhase('error');
      });
    return () => {
      alive = false;
    };
  }, [query, demo, attempt]);

  /* Mở / đóng hộp xem ảnh lớn. */
  useEffect(() => {
    const box = dialogRef.current;
    if (!box) return;
    if (viewer !== null && !box.open) box.showModal();
    if (viewer === null && box.open) box.close();
  }, [viewer]);

  const submit = useCallback(
    (raw: string) => {
      const value = raw.trim().replace(/\s+/g, ' ');
      if (value.length === 0) {
        inputRef.current?.focus();
        return;
      }
      setRemoved(new Set());
      if (value === query) setAttempt((count) => count + 1);
      else setParams({ q: value });
    },
    [query, setParams],
  );

  const clearQuery = useCallback(() => {
    setParams({});
    setResult(null);
    setPhase('idle');
    setDraft('');
    inputRef.current?.focus();
  }, [setParams]);

  const chips = useMemo(
    () => (result ? chipsOf(result.filters, members) : []),
    [result, members],
  );

  const kindOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const collection of result?.collections ?? []) map.set(collection.id, collection.kind);
    return map;
  }, [result]);

  const active = useMemo(
    () => (result ? remainingFilters(result.filters, removed) : null),
    [result, removed],
  );

  const shown = useMemo(() => {
    if (!result || !active) return [];
    return filterResults(result.results, active, kindOf);
  }, [result, active, kindOf]);

  const related = useMemo(() => {
    if (!result || !active) return [];
    return result.collections.filter((collection) => {
      if (active.kinds.length && !active.kinds.includes(collection.kind)) return false;
      if (
        active.places.length &&
        !active.places.some(
          (place) =>
            deaccent(collection.place).includes(deaccent(place)) ||
            deaccent(collection.title).includes(deaccent(place)),
        )
      ) {
        return false;
      }
      return true;
    });
  }, [result, active]);

  const source = (result as (SearchResult & { source?: string }) | null)?.source;
  const pageState: ViewState = phase === 'idle' ? 'ready' : phase;
  const hiddenChips = chips.filter((chip) => !removed.has(chip.key));
  const step = useCallback(
    (delta: number) => {
      setViewer((current) => {
        if (current === null || shown.length === 0) return current;
        return (current + delta + shown.length) % shown.length;
      });
    },
    [shown.length],
  );

  const current = viewer !== null ? shown[viewer] : undefined;

  return (
    <main id="main">
      <div className="wrap page-body srch">
        <header className="srch-hero">
          <h1>Tìm lại kỷ niệm bằng một câu</h1>
          <p className="srch-lead">
            Gõ như đang kể với người nhà: thời gian, nơi chốn hay người trong ảnh. Mình sẽ tự hiểu
            rồi lục lại đúng những tấm ảnh đó.
          </p>

          <form
            className="srch-form"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              submit(draft);
            }}
          >
            <SearchIcon size={22} className="srch-form-icon" />
            <label className="sr srch-label" htmlFor="srch-input">
              Tìm ảnh bằng câu nói thường
            </label>
            <input
              id="srch-input"
              ref={inputRef}
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Tìm ảnh: sinh nhật Su năm nay"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            {draft ? (
              <button
                type="button"
                className="srch-clear"
                aria-label="Xoá câu hỏi"
                onClick={() => {
                  setDraft('');
                  inputRef.current?.focus();
                }}
              >
                <CloseIcon size={16} />
              </button>
            ) : null}
            <button type="submit" className="btn dac srch-submit">
              Tìm ảnh
            </button>
          </form>

          <div className="srch-samples" aria-label="Câu hỏi mẫu">
            <span className="srch-samples-label">Thử câu này</span>
            <ul>
              {SAMPLE_QUERIES.map((sample) => (
                <li key={sample}>
                  <button
                    type="button"
                    className={`srch-sample${sample === query ? ' is-on' : ''}`}
                    onClick={() => submit(sample)}
                  >
                    {sample}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </header>

        {phase === 'idle' && !demo ? (
          <section className="srch-idle">
            <h2>Hoặc mở một mục kỷ niệm</h2>
            {collections.length === 0 ? (
              <InlineState
                kind="empty"
                title="Chưa có mục nào để mở"
                text="Khi có ảnh mới, mình sẽ gom thành từng mục. Bạn cũng có thể hỏi mình bằng một câu ở trên."
              />
            ) : (
              <ul className="srch-collections">
                {collections.map((collection) => (
                  <li key={collection.id}>
                    <Link className="srch-muc" to={`/muc/${encodeURIComponent(collection.id)}`}>
                      <img
                        src={collection.cover?.url?.sm ?? ''}
                        alt=""
                        loading="lazy"
                        width={480}
                        height={320}
                      />
                      <span className="srch-muc-t">
                        <b>{collection.title}</b>
                        <small>
                          {collection.place} · {collection.count} ảnh
                        </small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <PageStates
          state={demo ?? pageState}
          loadingLabel="Đang tìm ảnh"
          loadingTiles={3}
          emptyTitle="Không thấy ảnh nào khớp câu này"
          emptyText="Bạn thử nói khác đi — bỏ bớt một chi tiết, hoặc bấm một trong bốn câu mẫu ở trên."
          emptyAction={
            query ? (
              <button type="button" className="btn nho" onClick={clearQuery}>
                Xoá câu hỏi
              </button>
            ) : undefined
          }
          errorTitle="Chưa tìm được ảnh"
          errorText={
            errorText || 'Kết nối đang chập chờn nên mình chưa lục được tủ ảnh. Bạn thử lại nhé.'
          }
          onRetry={() => {
            if (demo) {
              setParams({});
              return;
            }
            setAttempt((count) => count + 1);
          }}
        >
          {result ? (
            <>
              <section className="srch-filters" aria-label="Bộ lọc AI hiểu được">
                <div className="srch-filters-head">
                  <h2>
                    <SparkleIcon size={20} />
                    {source === 'keyword' ? 'Mình hiểu câu này thành' : 'AI hiểu câu này thành'}
                  </h2>
                  {removed.size > 0 ? (
                    <button
                      type="button"
                      className="srch-reset"
                      onClick={() => setRemoved(new Set())}
                    >
                      Tìm lại từ đầu
                    </button>
                  ) : null}
                </div>

                {chips.length === 0 ? (
                  <p className="srch-note">
                    Câu này không có mốc thời gian hay nơi riêng — mình đang tìm theo đúng các từ
                    khoá trong câu.
                  </p>
                ) : (
                  <ul className="srch-chips">
                    {hiddenChips.map((chip) => (
                      <li key={chip.key}>
                        <button
                          type="button"
                          className={`srch-chip is-${chip.group}`}
                          onClick={() =>
                            setRemoved((current) => {
                              const next = new Set(current);
                              next.add(chip.key);
                              return next;
                            })
                          }
                          aria-label={`Bỏ bộ lọc ${chip.label}`}
                        >
                          <span>{chip.label}</span>
                          <CloseIcon size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="srch-count" role="status">
                  {shown.length > 0
                    ? `${shown.length} ảnh khớp câu “${result.query}”${
                        removed.size > 0 ? ` sau khi bỏ ${removed.size} bộ lọc` : ''
                      }.`
                    : `Không còn ảnh nào khớp ${removed.size} bộ lọc còn lại.`}
                </p>
              </section>

              <section className="srch-results" aria-label="Kết quả tìm được">
                {shown.length === 0 ? (
                  <InlineState
                    kind="empty"
                    title="Bộ lọc còn lại hơi chặt"
                    text="Bạn bỏ thêm một chip, hoặc bấm “Tìm lại từ đầu” để xem tất cả kết quả."
                    action={
                      <button type="button" className="btn nho" onClick={() => setRemoved(new Set())}>
                        Tìm lại từ đầu
                      </button>
                    }
                  />
                ) : (
                  <div className="srch-grid">
                    {shown.map((media, index) => (
                      <figure className="srch-card" key={media.id}>
                        <button
                          type="button"
                          className="srch-photo"
                          onClick={() => setViewer(index)}
                          aria-label={`Xem ảnh: ${media.caption || media.place}`}
                        >
                          <img
                            src={media.url.lg || media.url.orig}
                            alt={media.caption || `Ảnh ở ${media.place}`}
                            loading={index < 6 ? 'eager' : 'lazy'}
                            width={media.width || 800}
                            height={media.height || 600}
                          />
                          {media.type === 'video' ? <span className="srch-video">Video</span> : null}
                        </button>
                        <figcaption>
                          <span className="srch-cap">{media.caption || media.place}</span>
                          <span className="srch-meta">
                            {dateOf(media)} · {media.place}
                          </span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </section>

              {related.length > 0 ? (
                <section className="srch-related" aria-label="Mục kỷ niệm liên quan">
                  <h2>Mục kỷ niệm liên quan</h2>
                  <ul className="srch-collections">
                    {related.map((collection) => (
                      <li key={collection.id}>
                        <Link className="srch-muc" to={`/muc/${encodeURIComponent(collection.id)}`}>
                          <img
                            src={collection.cover?.url?.sm ?? ''}
                            alt=""
                            loading="lazy"
                            width={480}
                            height={320}
                          />
                          <span className="srch-muc-t">
                            <b>{collection.title}</b>
                            <small>
                              {kindLabel(collection.kind)} · {collection.count} ảnh
                            </small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
        </PageStates>
      </div>

      <dialog
        ref={dialogRef}
        className="srch-dialog"
        onClose={() => setViewer(null)}
        onCancel={() => setViewer(null)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') step(1);
          if (event.key === 'ArrowLeft') step(-1);
        }}
      >
        {current ? (
          <div className="srch-dialog-in">
            <button
              type="button"
              className="srch-dialog-x"
              aria-label="Đóng ảnh"
              onClick={() => setViewer(null)}
            >
              <CloseIcon size={20} />
            </button>
            <img
              className="srch-dialog-img"
              src={current.url.lg || current.url.orig}
              alt={current.caption || `Ảnh ở ${current.place}`}
            />
            <div className="srch-dialog-bar">
              <div>
                <b>{current.caption || 'Ảnh trong kỷ niệm'}</b>
                <span>
                  {dateOf(current)} · {current.place}
                  {current.country ? `, ${current.country}` : ''}
                </span>
                {current.tags.length > 0 ? (
                  <div className="srch-tags">
                    {current.tags.map((tag) => (
                      <i key={tag}>{tag}</i>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="srch-dialog-actions">
                {current.collectionId ? (
                  <Link className="btn nho" to={`/muc/${encodeURIComponent(current.collectionId)}`}>
                    Mở mục kỷ niệm
                  </Link>
                ) : null}
                <span className="srch-dialog-nav">
                  <button type="button" className="btn nho" onClick={() => step(-1)}>
                    Ảnh trước
                  </button>
                  <span>
                    {(viewer ?? 0) + 1} / {shown.length}
                  </span>
                  <button type="button" className="btn nho" onClick={() => step(1)}>
                    Ảnh sau
                  </button>
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
    </main>
  );
}

export default SearchPage;
