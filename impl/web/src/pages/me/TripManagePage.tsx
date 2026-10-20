import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { ArrowLeftIcon, PlayIcon, PlusIcon } from '../../components/Icons';
import type { Visibility } from '../../api/types';
import { formatKm } from '../../lib/format';
import { ErrorPage } from '../ErrorPage';
import {
  ApiError,
  getManageTrip,
  mergeStep,
  moveMedia,
  patchStep,
  patchTrip,
  setMediaHidden,
  splitStep,
  uploadFile,
  type ManageMedia,
  type ManageStep,
  type ManageTrip,
} from './api';
import {
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  FolderIcon,
  InboxIcon,
  LinkIcon,
  MergeIcon,
  PhotoIcon,
  SparkleIcon,
  SplitIcon,
  TrashIcon,
  UploadIcon,
} from './icons';
import { useMe } from './useMe';
import './me.css';

type LoadState = 'loading' | 'ready' | 'forbidden' | 'notfound' | 'error';
type Selection = number | 'unsorted';

const VISIBILITIES: Array<{ value: Visibility; label: string; hint: string }> = [
  { value: 'private', label: 'riêng tư', hint: 'Chỉ bạn xem được chuyến này.' },
  { value: 'link', label: 'có liên kết', hint: 'Ai có đường dẫn đều xem được.' },
  { value: 'public', label: 'công khai', hint: 'Mọi người thấy trên trang cá nhân của bạn.' },
];

function humanError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'too_large') return 'tệp quá lớn';
    if (err.code === 'expected_multipart') return 'không đọc được tệp';
    if (err.code === 'network_error') return 'mất kết nối tới máy chủ';
    if (err.status === 403) return 'bạn không phải chủ chuyến';
    if (err.status === 404) return 'không tìm thấy';
    if (err.status === 401) return 'phiên đăng nhập đã hết';
  }
  return 'không gửi được tệp';
}

function formatBytes(size: number): string {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ tải lên */

interface UploadRow {
  key: string;
  name: string;
  size: number;
  status: 'wait' | 'uploading' | 'done' | 'error';
  progress: number;
  reason?: string;
}

function UploadPanel({
  tripId,
  onFinished,
  onUnauthorized,
}: {
  tripId: number;
  onFinished: (summary: { accepted: number; failed: number; total: number }) => void;
  onUnauthorized: () => void;
}) {
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const running = useRef(false);

  const update = (key: string, patch: Partial<UploadRow>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const run = async (files: File[]) => {
    if (!files.length || running.current) return;
    running.current = true;
    const batch: UploadRow[] = files.map((file, index) => ({
      key: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      size: file.size,
      status: 'wait',
      progress: 0,
    }));
    setRows(batch);
    let accepted = 0;
    let failed = 0;
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const row = batch[index];
      update(row.key, { status: 'uploading', progress: 0 });
      try {
        const result = await uploadFile(tripId, file, (percent) => {
          update(row.key, { progress: percent });
        });
        if (result.accepted.length > 0) {
          accepted += 1;
          update(row.key, { status: 'done', progress: 100 });
        } else {
          failed += 1;
          update(row.key, {
            status: 'error',
            reason: result.rejected[0]?.reason ?? 'không nhận được tệp',
          });
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          onUnauthorized();
          break;
        }
        failed += 1;
        update(row.key, { status: 'error', reason: humanError(err) });
      }
    }
    running.current = false;
    onFinished({ accepted, failed, total: files.length });
  };

  const takeFiles = (list: FileList | null) => {
    if (!list) return;
    void run(Array.from(list));
  };

  return (
    <section className="me-upload" aria-labelledby="me-upload-title">
      <div
        className={`me-dropzone ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length) takeFiles(event.dataTransfer.files);
        }}
      >
        <span className="me-dropzone-icon" aria-hidden="true">
          <UploadIcon size={24} />
        </span>
        <div className="me-dropzone-text">
          <h2 id="me-upload-title">Thêm ảnh và video</h2>
          <p>
            Kéo thả tệp vào đây, hoặc chọn nhiều tệp từ máy. Tệp lỗi sẽ được liệt kê riêng.
            <span className="me-dropzone-formats"> JPEG · PNG · HEIC · WebP · MP4 · MOV</span>
          </p>
        </div>
        <label className="btn btn-lg btn-primary me-file-button">
          chọn tệp
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/heic,image/webp,video/mp4,video/quicktime,.heic,.heif,.mov"
            onChange={(event) => {
              takeFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
      </div>

      {rows.length > 0 && (
        <div className="me-upload-list">
          <div className="me-upload-list-head">
            <span>{`${rows.filter((row) => row.status === 'done').length}/${rows.length} tệp xong`}</span>
            <button type="button" className="me-link-button" onClick={() => setRows([])}>
              ẩn danh sách
            </button>
          </div>
          <ul>
            {rows.map((row) => (
              <li key={row.key} className={`me-upload-row is-${row.status}`}>
                <span className="me-upload-name" title={row.name}>
                  {row.name}
                </span>
                <span className="me-upload-size">{formatBytes(row.size)}</span>
                <span
                  className="me-progress"
                  role="progressbar"
                  aria-label={`Tiến độ tải ${row.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={row.progress}
                >
                  <span className="me-progress-fill" style={{ width: `${row.progress}%` }} />
                </span>
                <span className="me-upload-status">
                  {row.status === 'wait' && 'chờ tải'}
                  {row.status === 'uploading' && `${row.progress}%`}
                  {row.status === 'done' && (
                    <>
                      <CheckIcon size={14} /> xong
                    </>
                  )}
                  {row.status === 'error' && `lỗi: ${row.reason ?? 'không rõ'}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- ảnh trong chặng */

function MediaTile({
  media,
  stepName,
  canSplit,
  steps,
  busy,
  onToggleHidden,
  onSplit,
  onMove,
  onDragStart,
}: {
  media: ManageMedia;
  stepName: string;
  canSplit: boolean;
  steps: ManageStep[];
  busy: boolean;
  onToggleHidden: (media: ManageMedia) => void;
  onSplit: (media: ManageMedia) => void;
  onMove: (media: ManageMedia, stepId: number) => void;
  onDragStart: (media: ManageMedia) => void;
}) {
  const flagged = media.flags.blurry || media.flags.nearDuplicate;
  return (
    <figure
      className={`me-photo ${media.flags.hidden ? 'is-hidden' : ''}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(media.id));
        onDragStart(media);
      }}
    >
      <div className="me-photo-thumb">
        <img
          src={media.sm}
          alt={`${media.type === 'video' ? 'Video' : 'Ảnh'} trong ${stepName}`}
          loading="lazy"
          draggable={false}
        />
        {media.type === 'video' && (
          <>
            <span className="me-photo-play" aria-hidden="true">
              <PlayIcon size={16} />
            </span>
            {media.duration ? (
              <span className="me-photo-duration">{formatDuration(media.duration)}</span>
            ) : null}
          </>
        )}
        {media.flags.hidden && <span className="me-photo-hidden">đang ẩn</span>}
        {flagged && (
          <span className="me-photo-flags">
            {media.flags.blurry && <span className="me-badge is-blur">mờ</span>}
            {media.flags.nearDuplicate && <span className="me-badge is-dup">gần trùng</span>}
          </span>
        )}
      </div>
      <figcaption className="me-photo-meta">
        <span className="me-photo-order">{`#${media.order + 1}`}</span>
        <span className="me-photo-actions">
          <button
            type="button"
            className="me-icon-button"
            onClick={() => onToggleHidden(media)}
            disabled={busy}
            aria-label={media.flags.hidden ? 'Hiện ảnh này' : 'Ẩn ảnh này'}
            title={media.flags.hidden ? 'Hiện ảnh' : 'Ẩn ảnh'}
          >
            {media.flags.hidden ? <EyeIcon size={15} /> : <EyeOffIcon size={15} />}
          </button>
          {canSplit && (
            <button
              type="button"
              className="me-icon-button"
              onClick={() => onSplit(media)}
              disabled={busy}
              aria-label="Tách chặng bắt đầu từ ảnh này"
              title="Tách chặng từ ảnh này"
            >
              <SplitIcon size={15} />
            </button>
          )}
          <select
            className="me-move-select"
            aria-label={`Chuyển ảnh sang chặng khác`}
            value=""
            disabled={busy || steps.length === 0}
            onChange={(event) => {
              const target = Number(event.target.value);
              event.target.value = '';
              if (Number.isFinite(target) && target > 0) onMove(media, target);
            }}
          >
            <option value="">chuyển…</option>
            {steps.map((step) => (
              <option key={step.id} value={step.id}>
                {step.name}
              </option>
            ))}
          </select>
        </span>
      </figcaption>
    </figure>
  );
}

/* ----------------------------------------------------------------- chặng */

function StepDetail({
  step,
  steps,
  busy,
  activeDrop,
  onSave,
  onAcceptDraft,
  onDismissDraft,
  onMerge,
  onSplit,
  onToggleHidden,
  onMove,
  onHideFlagged,
  onDragStart,
  onDropMedia,
}: {
  step: ManageStep;
  steps: ManageStep[];
  busy: boolean;
  activeDrop: boolean;
  onSave: (step: ManageStep, name: string, description: string) => void;
  onAcceptDraft: (step: ManageStep) => void;
  onDismissDraft: (step: ManageStep) => void;
  onMerge: (step: ManageStep, intoStepId: number) => void;
  onSplit: (step: ManageStep, media: ManageMedia) => void;
  onToggleHidden: (media: ManageMedia) => void;
  onMove: (media: ManageMedia, stepId: number) => void;
  onHideFlagged: (step: ManageStep) => void;
  onDragStart: (media: ManageMedia) => void;
  onDropMedia: (mediaId: number, stepId: number) => void;
}) {
  const [name, setName] = useState(step.name);
  const [description, setDescription] = useState(step.description ?? '');
  const [mergeInto, setMergeInto] = useState('');
  const index = steps.findIndex((item) => item.id === step.id);
  const others = steps.filter((item) => item.id !== step.id);
  const flagged = step.media.filter(
    (media) => (media.flags.blurry || media.flags.nearDuplicate) && !media.flags.hidden,
  );

  useEffect(() => {
    setName(step.name);
    setDescription(step.description ?? '');
  }, [step.id, step.name, step.description]);

  useEffect(() => {
    setMergeInto('');
  }, [step.id]);

  const dirty = name.trim() !== step.name || description !== (step.description ?? '');
  const draft = step.draft;

  return (
    <section
      className={`me-detail ${activeDrop ? 'is-drop' : ''}`}
      aria-label={`Chặng ${step.name}`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        const id = Number(event.dataTransfer.getData('text/plain'));
        if (Number.isFinite(id) && id > 0) onDropMedia(id, step.id);
      }}
    >
      <div className="me-detail-head">
        <span className="me-detail-icon" aria-hidden="true">
          <FolderIcon size={22} />
        </span>
        <div className="me-detail-title">
          <p className="me-detail-index">{`Chặng ${String(index + 1).padStart(2, '0')}`}</p>
          <input
            className="me-input me-input-title"
            value={name}
            maxLength={160}
            onChange={(event) => setName(event.target.value)}
            aria-label="Tên chặng"
          />
        </div>
        <span className="me-detail-count">{`${step.media.length} ảnh`}</span>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={busy || !dirty || !name.trim()}
          onClick={() => onSave(step, name.trim(), description)}
        >
          lưu chặng
        </button>
      </div>

      <label className="me-field">
        <span className="me-field-label">Mô tả chặng</span>
        <textarea
          className="me-textarea"
          value={description}
          rows={2}
          maxLength={4000}
          placeholder="Viết vài dòng về chặng này…"
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      {draft && (
        <div className="me-draft">
          <span className="me-draft-icon" aria-hidden="true">
            <SparkleIcon size={18} />
          </span>
          <div className="me-draft-body">
            <p className="me-draft-label">Gợi ý AI</p>
            <p className="me-draft-name">{draft.name}</p>
            {draft.description ? <p className="me-draft-desc">{draft.description}</p> : null}
          </div>
          <div className="me-draft-actions">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={busy}
              onClick={() => onAcceptDraft(step)}
            >
              nhận
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() => onDismissDraft(step)}
            >
              <TrashIcon size={13} />
              xoá
            </button>
          </div>
        </div>
      )}

      <div className="me-detail-actions">
        <span className="me-detail-hint">
          Kéo ảnh vào thư mục bên trái để chuyển chặng, hoặc dùng ô “chuyển…”.
        </span>
        {flagged.length > 0 && (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={busy}
            onClick={() => onHideFlagged(step)}
          >
            <EyeOffIcon size={14} />
            {`ẩn ${flagged.length} ảnh mờ/trùng`}
          </button>
        )}
        {others.length > 0 && (
          <div className="me-merge">
            <select
              className="me-select"
              value={mergeInto}
              onChange={(event) => setMergeInto(event.target.value)}
              aria-label="Chọn chặng để gộp vào"
            >
              <option value="">gộp chặng này vào…</option>
              {others.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy || !mergeInto}
              onClick={() => {
                if (mergeInto) onMerge(step, Number(mergeInto));
              }}
            >
              <MergeIcon size={14} />
              gộp
            </button>
          </div>
        )}
      </div>

      {step.media.length === 0 ? (
        <p className="me-empty-inline">Chặng này chưa có ảnh. Kéo ảnh từ chặng khác vào đây.</p>
      ) : (
        <div className="me-photo-grid">
          {step.media.map((media) => (
            <MediaTile
              key={media.id}
              media={media}
              stepName={step.name}
              canSplit={step.media.length > 1}
              steps={steps}
              busy={busy}
              onToggleHidden={onToggleHidden}
              onSplit={(item) => onSplit(step, item)}
              onMove={onMove}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ trang quản lý */

export function TripManagePage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { me, state } = useMe();
  const [trip, setTrip] = useState<ManageTrip | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [selected, setSelected] = useState<Selection | null>(null);
  const [tripName, setTripName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [dropStep, setDropStep] = useState<number | null>(null);
  const draggingId = useRef<number | null>(null);
  const pickedUnsorted = useRef(false);

  const goLogin = useCallback(() => navigate('/login', { replace: true }), [navigate]);

  useEffect(() => {
    if (state === 'unauth') goLogin();
  }, [state, goLogin]);

  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      const data = await getManageTrip(tripId);
      const owner = data.author?.username;
      if (!me || owner !== me.username) {
        setLoadState('forbidden');
        return;
      }
      setTrip(data);
      setTripName(data.name);
      setLoadState('ready');
      setSelected((current) => {
        if (current === 'unsorted' && pickedUnsorted.current) return current;
        if (typeof current === 'number' && data.steps.some((step) => step.id === current)) {
          return current;
        }
        // Sau khi tải lên, ưu tiên mở chặng đầu tiên để thấy ảnh vừa chia;
        // "chưa xếp" chỉ tự mở khi chuyến chưa có chặng nào.
        return data.steps[0]?.id ?? 'unsorted';
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          goLogin();
          return;
        }
        if (err.status === 403) {
          setLoadState('forbidden');
          return;
        }
        if (err.status === 404) {
          setLoadState('notfound');
          return;
        }
      }
      setLoadState('error');
    }
  }, [tripId, me, goLogin]);

  useEffect(() => {
    if (state === 'ready' && me) void load();
  }, [state, me, load]);

  useEffect(() => {
    if (!selected) return;
    const active = document.querySelector<HTMLElement>('.me-folder.is-active');
    const list = active?.closest<HTMLElement>('.me-folders-list');
    if (!active || !list || list.scrollWidth <= list.clientWidth) return;
    const listRect = list.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    list.scrollLeft +=
      activeRect.left - listRect.left - (listRect.width - activeRect.width) / 2;
  }, [selected]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 5200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      await load();
      if (success) setNotice({ kind: 'ok', text: success });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        goLogin();
        return;
      }
      setNotice({ kind: 'error', text: 'Thao tác không thành công. Thử lại nhé.' });
    } finally {
      setBusy(false);
    }
  };

  if (state === 'unauth') return null;
  if (state === 'error' || loadState === 'error') return <ErrorPage kind="general" />;
  if (loadState === 'notfound') return <ErrorPage kind="not_found" />;
  if (loadState === 'forbidden') return <ErrorPage kind="private" />;

  if (state === 'loading' || loadState === 'loading' || !trip) {
    return (
      <div className="me-page">
        <Header />
        <main className="me-main">
          <div className="loading-spinner" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>Đang mở thư mục chuyến…</span>
          </div>
        </main>
      </div>
    );
  }

  const unsorted = trip.unsorted ?? [];
  const mediaCount = trip.steps.reduce((sum, step) => sum + step.media.length, 0) + unsorted.length;
  const selectedStep =
    typeof selected === 'number' ? trip.steps.find((step) => step.id === selected) : undefined;
  const showUnsorted = !selectedStep;
  const visibility = trip.visibility;
  const visibilityHint = VISIBILITIES.find((item) => item.value === visibility)?.hint ?? '';

  const saveTripName = () => {
    const name = tripName.trim();
    if (!name || name === trip.name) return;
    void run(() => patchTrip(trip.id, { name }), 'Đã đổi tên chuyến.');
  };

  const changeVisibility = (next: Visibility) => {
    if (next === visibility) return;
    void run(
      () => patchTrip(trip.id, { visibility: next }),
      'Đã đổi mức riêng tư — trang chuyến cập nhật ngay.',
    );
  };

  const toggleHidden = (media: ManageMedia) => {
    void run(
      () => setMediaHidden(media.id, !media.flags.hidden),
      media.flags.hidden ? 'Đã hiện lại ảnh.' : 'Đã ẩn ảnh khỏi trang chuyến.',
    );
  };

  const hideFlagged = (step: ManageStep) => {
    const flagged = step.media.filter(
      (media) => (media.flags.blurry || media.flags.nearDuplicate) && !media.flags.hidden,
    );
    if (!flagged.length) return;
    void run(
      () => Promise.all(flagged.map((media) => setMediaHidden(media.id, true))),
      `Đã ẩn ${flagged.length} ảnh mờ/gần trùng.`,
    );
  };

  const move = (media: ManageMedia, stepId: number) => {
    const target = trip.steps.find((step) => step.id === stepId);
    void run(
      () => moveMedia(media.id, stepId),
      target ? `Đã chuyển ảnh sang ${target.name}.` : 'Đã chuyển ảnh.',
    );
  };

  const merge = (step: ManageStep, intoStepId: number) => {
    const target = trip.steps.find((item) => item.id === intoStepId);
    if (!target) return;
    if (
      !window.confirm(
        `Gộp “${step.name}” vào “${target.name}”? Ảnh của chặng bị gộp sẽ chuyển sang chặng kia.`,
      )
    ) {
      return;
    }
    void run(async () => {
      await mergeStep(step.id, intoStepId);
      setSelected(intoStepId);
    }, 'Đã gộp hai chặng.');
  };

  const split = (step: ManageStep, media: ManageMedia) => {
    if (
      !window.confirm(
        `Tách “${step.name}” từ ảnh #${media.order + 1}? Ảnh này và các ảnh sau chuyển sang chặng mới.`,
      )
    ) {
      return;
    }
    void run(async () => {
      const result = await splitStep(step.id, media.id);
      if (result?.stepId) setSelected(result.stepId);
    }, 'Đã tách chặng mới.');
  };

  const acceptDraft = (step: ManageStep) => {
    if (!step.draft) return;
    void run(
      () =>
        patchStep(step.id, {
          name: step.draft?.name || step.name,
          description: step.draft?.description || step.description || '',
        }),
      'Đã nhận gợi ý.',
    );
  };

  const dismissDraft = (step: ManageStep) => {
    void run(() => patchStep(step.id, { name: step.name }), 'Đã xoá gợi ý.');
  };

  const saveStep = (step: ManageStep, name: string, description: string) => {
    void run(() => patchStep(step.id, { name, description }), 'Đã lưu chặng.');
  };

  const dropOnStep = (stepId: number) => {
    const mediaId = draggingId.current;
    setDropStep(null);
    draggingId.current = null;
    if (!mediaId) return;
    const media =
      unsorted.find((item) => item.id === mediaId) ??
      trip.steps.flatMap((step) => step.media).find((item) => item.id === mediaId);
    if (media) move(media, stepId);
  };

  return (
    <div className="me-page">
      <a className="skip-link" href="#main">
        bỏ qua tới nội dung chính
      </a>
      <Header />
      <main className="me-main me-main-wide" id="main">
        <Link to="/me" className="me-back">
          <ArrowLeftIcon size={16} />
          chuyến của tôi
        </Link>

        <header className="me-trip-head">
          <div className="me-trip-line">
            <span className="me-trip-kicker">
              <FolderIcon size={15} />
              thư mục chuyến
            </span>
            <form
              className="me-trip-name-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveTripName();
              }}
            >
              <input
                className="me-input me-trip-name"
                value={tripName}
                maxLength={120}
                aria-label="Tên chuyến"
                onChange={(event) => setTripName(event.target.value)}
              />
              <button
                type="submit"
                className="btn btn-sm btn-secondary"
                disabled={busy || !tripName.trim() || tripName.trim() === trip.name}
              >
                lưu tên
              </button>
            </form>
          </div>
          <p className="me-trip-sub">
            {`${trip.stepsTotal} chặng · ${mediaCount} ảnh/video · ${formatKm(trip.km)}`}
            {trip.days ? ` · ${trip.days} ngày` : ''}
            <span className="me-trip-live"> · thay đổi hiện ngay trên trang chuyến</span>
          </p>
          <div className="me-trip-tools">
            <Link
              className="btn btn-sm btn-dark"
              to={`/${trip.author.username}/${trip.id}-${trip.slug}`}
            >
              <LinkIcon size={14} />
              xem trang chuyến
            </Link>
            <div className="me-visibility" role="group" aria-label="Mức riêng tư của chuyến">
              {VISIBILITIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`me-visibility-button ${visibility === item.value ? 'is-active' : ''}`}
                  aria-pressed={visibility === item.value}
                  disabled={busy}
                  onClick={() => changeVisibility(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <p className="me-visibility-hint">{visibilityHint}</p>
        </header>

        <UploadPanel
          tripId={trip.id}
          onUnauthorized={goLogin}
          onFinished={({ accepted, failed, total }) => {
            if (accepted > 0) {
              void load();
              setNotice({
                kind: failed > 0 ? 'error' : 'ok',
                text:
                  failed > 0
                    ? `Đã thêm ${accepted}/${total} tệp, ${failed} tệp lỗi.`
                    : `Đã thêm ${accepted} tệp — hệ thống vừa chia lại chặng.`,
              });
            } else {
              setNotice({ kind: 'error', text: `${failed}/${total} tệp không nhận được.` });
            }
          }}
        />

        <div className="me-manage-grid">
          <aside className="me-folders" aria-label="Thư mục chặng">
            <div className="me-folders-head">
              <h2>Thư mục chặng</h2>
              <span>{trip.steps.length}</span>
            </div>
            <div className="me-folders-list">
              {trip.steps.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  className={`me-folder ${selectedStep?.id === step.id ? 'is-active' : ''} ${
                    dropStep === step.id ? 'is-drop' : ''
                  }`}
                  onClick={() => {
                    pickedUnsorted.current = false;
                    setSelected(step.id);
                  }}
                  aria-current={selectedStep?.id === step.id ? 'true' : undefined}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDropStep(step.id);
                  }}
                  onDragLeave={() => setDropStep((current) => (current === step.id ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    dropOnStep(step.id);
                  }}
                >
                  <span className="me-folder-icon" aria-hidden="true">
                    <FolderIcon size={18} />
                  </span>
                  <span className="me-folder-label">
                    <span className="me-folder-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="me-folder-row-name">{step.name}</span>
                  </span>
                  <span className="me-folder-count">{step.media.length}</span>
                </button>
              ))}
              <button
                type="button"
                className={`me-folder me-folder-inbox ${
                  showUnsorted ? 'is-active' : ''
                }`}
                onClick={() => {
                  pickedUnsorted.current = true;
                  setSelected('unsorted');
                }}
                aria-current={showUnsorted ? 'true' : undefined}
              >
                <span className="me-folder-icon" aria-hidden="true">
                  <InboxIcon size={18} />
                </span>
                <span className="me-folder-label">
                  <span className="me-folder-index">—</span>
                  <span className="me-folder-row-name">chưa xếp</span>
                </span>
                <span className="me-folder-count">{unsorted.length}</span>
              </button>
            </div>
            <p className="me-folders-hint">
              Kéo ảnh thả vào một thư mục để chuyển chặng. Thư mục “chưa xếp” giữ ảnh thiếu thời
              gian và GPS.
            </p>
          </aside>

          {showUnsorted ? (
            <section className="me-detail" aria-label="Ảnh chưa xếp">
              <div className="me-detail-head">
                <span className="me-detail-icon" aria-hidden="true">
                  <InboxIcon size={22} />
                </span>
                <div className="me-detail-title">
                  <p className="me-detail-index">Chưa xếp</p>
                  <p className="me-detail-name">Ảnh thiếu thời gian hoặc GPS</p>
                </div>
                <span className="me-detail-count">{`${unsorted.length} ảnh`}</span>
              </div>
              <div className="me-detail-actions">
                <span className="me-detail-hint">
                  Kéo ảnh vào một thư mục chặng bên trái, hoặc chọn “chuyển…” trên từng ảnh.
                </span>
              </div>
              {unsorted.length === 0 ? (
                <p className="me-empty-inline">
                  Không có ảnh nào chưa xếp. Mọi ảnh đã nằm trong chặng.
                </p>
              ) : (
                <div className="me-photo-grid">
                  {unsorted.map((media) => (
                    <MediaTile
                      key={media.id}
                      media={media}
                      stepName="chưa xếp"
                      canSplit={false}
                      steps={trip.steps}
                      busy={busy}
                      onToggleHidden={toggleHidden}
                      onSplit={() => undefined}
                      onMove={move}
                      onDragStart={(item) => {
                        draggingId.current = item.id;
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : selectedStep ? (
            <StepDetail
              key={selectedStep.id}
              step={selectedStep}
              steps={trip.steps}
              busy={busy}
              activeDrop={dropStep === selectedStep.id}
              onSave={saveStep}
              onAcceptDraft={acceptDraft}
              onDismissDraft={dismissDraft}
              onMerge={merge}
              onSplit={split}
              onToggleHidden={toggleHidden}
              onMove={move}
              onHideFlagged={hideFlagged}
              onDragStart={(item) => {
                draggingId.current = item.id;
              }}
              onDropMedia={(mediaId, stepId) => {
                const media =
                  unsorted.find((item) => item.id === mediaId) ??
                  trip.steps.flatMap((item) => item.media).find((item) => item.id === mediaId);
                if (media) move(media, stepId);
              }}
            />
          ) : (
            <section className="me-detail">
              <p className="me-empty-inline">
                Chuyến chưa có chặng nào. Tải ảnh lên để hệ thống tự chia chặng.
              </p>
            </section>
          )}
        </div>

        <div className="me-quick-actions">
          <button
            type="button"
            className="btn btn-lg btn-secondary"
            onClick={() => {
              pickedUnsorted.current = true;
              setSelected('unsorted');
            }}
          >
            <PhotoIcon size={17} />
            xem ảnh chưa xếp
            <span className="me-count-pill">{unsorted.length}</span>
          </button>
          <button
            type="button"
            className="btn btn-lg btn-secondary"
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>('.me-file-button input');
              input?.click();
            }}
          >
            <PlusIcon size={17} />
            thêm ảnh
          </button>
        </div>
      </main>
      <Footer />

      {notice && (
        <div
          className={`me-toast is-${notice.kind}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}
