/**
 * Tải ảnh lên `/tai-anh` (G3).
 *
 * - Kéo thả nhiều tệp hoặc bấm để chọn.
 * - Tiến độ **từng tệp** (dùng `XMLHttpRequest` vì `fetch` không có tiến độ tải lên).
 * - Trạng thái AI từng ảnh: hỏi lại `GET /api/media/status` và hiện caption khi xong.
 * - Các mục AI vừa gợi ý: nhận hoặc bỏ qua từng gợi ý.
 * - Lỗi từng tệp (bị máy chủ từ chối) hiện ngay trên dòng của tệp đó.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCollections, type Collection } from '../../api';
import {
  acceptSuggestion,
  dismissSuggestion,
  fetchCollectionDetail,
  fetchMediaStatus,
  uploadMediaFile,
  type AiStatus,
  type CollectionDetail,
} from '../../api-qa';
import { ImageIcon, SparkleIcon, UploadIcon } from '../../layout/Icons';
import { CURRENT_YEAR } from '../../layout/nav';
import { InlineState, LoadingBlock } from '../login/states';
import './upload.css';

type ItemStatus = 'queued' | 'uploading' | 'uploaded' | 'error';

interface UploadItem {
  key: string;
  name: string;
  size: number;
  status: ItemStatus;
  progress: number;
  mediaId?: string | number;
  aiStatus?: AiStatus;
  caption?: string | null;
  error?: string;
}

const AI_LABEL: Record<AiStatus, string> = {
  pending: 'AI đang xem ảnh…',
  done: 'AI đã đọc xong',
  failed: 'AI không đọc được ảnh này',
  skipped: 'AI đang tắt, ảnh sẽ được phân tích khi AI bật lại',
};

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadPage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [suggestions, setSuggestions] = useState<CollectionDetail[]>([]);
  /** Trạng thái khối gợi ý của AI: dùng chung khung tải / lỗi với các trang nhóm B (G5). */
  const [sugState, setSugState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((key: string, changes: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    );
  }, []);

  /** Cập nhật theo id ảnh (máy chủ trả về) — dùng khi hỏi trạng thái AI. */
  const patchByMediaId = useCallback((mediaId: string | number, changes: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) =>
        String(item.mediaId) === String(mediaId) ? { ...item, ...changes } : item,
      ),
    );
  }, []);

  /** Đưa danh sách tệp vào hàng đợi tải lên. */
  const enqueue = useCallback((files: File[]): { files: File[]; keys: string[] } => {
    const accepted = files.filter(
      (file) => file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|mp4)$/i.test(file.name),
    );
    const rejected = files.filter((file) => !accepted.includes(file));
    const stamp = Date.now().toString(36);
    const next: UploadItem[] = [
      ...accepted.map((file, index) => ({
        key: `${stamp}-${index}-${file.name}`,
        name: file.name,
        size: file.size,
        status: 'queued' as ItemStatus,
        progress: 0,
      })),
      ...rejected.map((file, index) => ({
        key: `${stamp}-x${index}-${file.name}`,
        name: file.name,
        size: file.size,
        status: 'error' as ItemStatus,
        progress: 0,
        error: 'Tệp này không phải ảnh hoặc video.',
      })),
    ];
    setItems((current) => [...next, ...current]);
    return { files: accepted, keys: next.slice(0, accepted.length).map((item) => item.key) };
  }, []);

  /** Tải lên một tệp, cập nhật tiến độ theo từng tệp. */
  const send = useCallback(
    async (file: File, key: string) => {
      patch(key, { status: 'uploading', progress: 0 });
      try {
        const result = await uploadMediaFile(file, (percent) => patch(key, { progress: percent }));
        const accepted = result.accepted[0];
        if (!accepted) {
          patch(key, {
            status: 'error',
            error: result.rejected[0]?.reason ?? 'Máy chủ không nhận tệp này.',
          });
          return;
        }
        patch(key, {
          status: 'uploaded',
          progress: 100,
          mediaId: accepted.id,
          aiStatus: 'pending',
        });
      } catch (error) {
        patch(key, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Không tải được tệp này.',
        });
      }
    },
    [patch],
  );

  const start = useCallback(
    (files: File[]) => {
      const { files: queued, keys } = enqueue(files);
      if (queued.length === 0) return;
      setBusy(true);
      void Promise.all(queued.map((file, index) => send(file, keys[index])))
        .finally(() => setBusy(false));
    },
    [enqueue, send],
  );

  /* Hỏi trạng thái AI của các ảnh vừa tải lên. */
  const pendingIds = items
    .filter((item) => item.mediaId !== undefined && item.aiStatus === 'pending')
    .map((item) => item.mediaId as string | number);

  useEffect(() => {
    if (pendingIds.length === 0) return undefined;
    let alive = true;
    const timer = setInterval(() => {
      fetchMediaStatus(pendingIds)
        .then((list) => {
          if (!alive) return;
          for (const status of list) {
            patchByMediaId(status.id, {
              aiStatus: status.aiStatus,
              caption: status.caption ?? null,
            });
          }
        })
        .catch(() => {
          /* hỏi lại lần sau */
        });
    }, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pendingIds, patchByMediaId]);

  /* Lấy các mục AI vừa gợi ý (status = suggested) kèm gợi ý của từng mục. */
  const loadSuggestions = useCallback(() => {
    setSugState((current) => (current === 'error' ? 'loading' : current));
    fetchCollections({ year: String(CURRENT_YEAR) })
      .then((list: Collection[]) => {
        const suggested = list.filter((collection) => collection.status === 'suggested');
        return Promise.all(suggested.map((collection) => fetchCollectionDetail(collection.id)));
      })
      .then((details) => {
        setSuggestions(details.filter((detail) => detail.suggestions.length > 0));
        setSugState('ready');
      })
      .catch(() => {
        // Không có gợi ý thì không hiện; mất mạng thì hiện khung lỗi có nút thử lại.
        setSugState('error');
      });
  }, []);

  useEffect(() => {
    loadSuggestions();
    const timer = setInterval(loadSuggestions, 8000);
    return () => clearInterval(timer);
  }, [loadSuggestions]);

  const decide = useCallback(
    (id: string | number, accept: boolean) => {
      const call = accept ? acceptSuggestion : dismissSuggestion;
      call(id)
        .then(() => loadSuggestions())
        .catch(() => {
          /* giữ nguyên danh sách nếu lỗi */
        });
    },
    [loadSuggestions],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) start(files);
    },
    [start],
  );

  const uploaded = items.filter((item) => item.status === 'uploaded').length;
  const failed = items.filter((item) => item.status === 'error').length;

  return (
    <main id="main">
      <div className="wrap page-body upl">
        <div className="head">
          <h2>Tải ảnh lên</h2>
          <p>
            Kéo thả ảnh của cả nhà vào đây. Ảnh có ngày giờ và vị trí sẽ tự về đúng mục và đúng nơi.
          </p>
        </div>

        <div
          className={`drop${dragging ? ' on' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <ImageIcon size={32} className="ic" />
          <p>Kéo ảnh vào đây, hoặc chọn từ máy. Có thể chọn nhiều tệp một lượt.</p>
          <button
            type="button"
            className="btn dac"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <UploadIcon size={20} />
            Chọn ảnh từ máy
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="sr"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 0) start(files);
              event.target.value = '';
            }}
          />
        </div>

        {items.length > 0 ? (
          <section className="upl-list" aria-label="Các tệp vừa chọn">
            <div className="upl-list-head">
              <h3>Tệp vừa chọn</h3>
              <span>
                {uploaded}/{items.length} đã tải lên
                {failed > 0 ? ` · ${failed} lỗi` : ''}
              </span>
            </div>
            <ul>
              {items.map((item) => (
                <li key={item.key} className={`upl-item is-${item.status}`}>
                  <div className="upl-item-top">
                    <b>{item.name}</b>
                    <span>{humanSize(item.size)}</span>
                  </div>
                  {item.status === 'uploading' || item.status === 'queued' ? (
                    <div
                      className="upl-bar"
                      role="progressbar"
                      aria-valuenow={item.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <i style={{ width: `${item.progress}%` }} />
                    </div>
                  ) : null}
                  {item.status === 'uploaded' ? (
                    <p className="upl-ai">
                      <span className={`upl-dot ai-${item.aiStatus ?? 'pending'}`} />
                      {AI_LABEL[item.aiStatus ?? 'pending']}
                      {item.caption ? ` — “${item.caption}”` : ''}
                    </p>
                  ) : null}
                  {item.error ? <p className="upl-error">{item.error}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="upl-ai-suggestions" aria-label="Gợi ý của AI">
          <div className="upl-list-head">
            <h3>
              <SparkleIcon size={20} />
              AI vừa gợi ý
            </h3>
            <span>
              {sugState === 'loading'
                ? 'Đang xem gợi ý…'
                : suggestions.length > 0
                  ? `${suggestions.length} mục`
                  : 'Chưa có gợi ý mới'}
            </span>
          </div>
          {sugState === 'loading' ? (
            <LoadingBlock label="Đang xem gợi ý của AI" lines={1} tiles={0} />
          ) : sugState === 'error' ? (
            <InlineState
              kind="error"
              title="Chưa lấy được gợi ý của AI"
              text="Kết nối bị gián đoạn. Ảnh đã tải lên vẫn an toàn, bạn thử lại sau nhé."
              action={
                <button type="button" className="btn nho" onClick={loadSuggestions}>
                  Thử lại
                </button>
              }
            />
          ) : suggestions.length === 0 ? (
            <p className="upl-empty">
              Khi nào có ảnh mới, mình sẽ gom thành mục và xin bạn nhận hoặc bỏ qua ở đây.
            </p>
          ) : (
            suggestions.map((detail) => (
              <article className="upl-card" key={detail.id}>
                <div className="upl-card-head">
                  <div>
                    <h4>{detail.title}</h4>
                    <span>
                      {detail.place} · {detail.count} ảnh
                    </span>
                  </div>
                  <Link className="btn kinh nho" to={`/muc/${detail.id}`}>
                    Xem mục
                  </Link>
                </div>
                <ul className="upl-suggestions">
                  {detail.suggestions.map((suggestion) => (
                    <li key={suggestion.id}>
                      <p>{suggestion.text}</p>
                      <div className="upl-suggestions-actions">
                        <button
                          type="button"
                          className="btn dac nho"
                          onClick={() => decide(suggestion.id, true)}
                        >
                          Nhận
                        </button>
                        <button
                          type="button"
                          className="btn kinh nho"
                          onClick={() => decide(suggestion.id, false)}
                        >
                          Bỏ qua
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

export default UploadPage;
