import { CameraController, cameraErrorMessage, withMessage } from './camera';
import { filterById, FILTERS } from './filters';
import { encodeGif } from './gif';
import { ICONS } from './icons';
import {
  DEFAULT_COLOR,
  LAYOUTS,
  drawStrip,
  holesFor,
  layoutAvailable,
  layoutById,
  renderStripToCanvas,
  stripSize,
  type LayoutDef,
} from './layouts';
import { loadSamplePhotos, readImageFiles, readImageUrls, SAMPLE_PHOTOS } from './photos';
import { runSession } from './session';
import { playShutter } from './sound';
import { STYLE_ID, injectStyles } from './styles';
import type {
  AppState,
  CameraError,
  Orientation,
  PhotoCount,
  PhotoEntry,
  PhotoTransform,
  PhotoboothOptions,
  ScreenName,
  TimerSeconds,
} from './types';
import { PALETTE, clamp, el, slugifyTitle, textOn } from './util';

const COUNTS: PhotoCount[] = [2, 3, 4, 5, 6];
const TIMERS: TimerSeconds[] = [0, 3, 5, 10];
const TITLE_MAX = 40;

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = el('a', { href: url, download: filename });
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function icon(name: keyof typeof ICONS, size?: number): HTMLSpanElement {
  const span = el('span', { class: 'htpb-icon' });
  span.innerHTML = ICONS[name](size);
  span.style.display = 'inline-flex';
  return span;
}

function dateLabel(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

class PhotoboothApp {
  private opts: PhotoboothOptions;
  private root: HTMLElement;
  private camera = new CameraController();
  private sessionAbort: AbortController | null = null;
  private destroyed = false;
  private lastFocus: HTMLElement | null = null;
  private dialogOpen = false;
  private busy: 'png' | 'gif' | 'trip' | null = null;
  private statusTimer = 0;

  private els!: {
    entry: HTMLElement;
    camera: HTMLElement;
    editor: HTMLElement;
    title: HTMLHeadingElement;
    entryAlert: HTMLElement;
    drop: HTMLElement;
    fileInput: HTMLInputElement;
    sourceButton: HTMLButtonElement;
    video: HTMLVideoElement;
    videoWrap: HTMLElement;
    countdown: HTMLElement;
    countdownLive: HTMLElement;
    flash: HTMLElement;
    preview: HTMLElement;
    previewCanvas: HTMLCanvasElement;
    previewCaption: HTMLElement;
    badge: HTMLElement;
    badgeDot: HTMLElement;
    badgeText: HTMLElement;
    filters: HTMLElement;
    options: HTMLElement;
    sessionCount: HTMLElement;
    progressFill: HTMLElement;
    thumbs: HTMLElement;
    nextButton: HTMLButtonElement;
    nextHint: HTMLElement;
    shootButton: HTMLButtonElement;
    stopButton: HTMLButtonElement;
    soundToggle: HTMLInputElement;
    lockBadge: HTMLElement;
    cameraTitle: HTMLHeadingElement;
    editorStrip: HTMLCanvasElement;
    stripScroll: HTMLElement;
    layouts: HTMLElement;
    samples: HTMLElement;
    colorHint: HTMLElement;
    swatches: HTMLElement;
    titleInput: HTMLInputElement;
    titleCount: HTMLElement;
    editorSessionCount: HTMLElement;
    editorThumbs: HTMLElement;
    editorTabStyle: HTMLButtonElement;
    editorTabColor: HTMLButtonElement;
    styleGroup: HTMLElement;
    colorGroup: HTMLElement;
    exportButton: HTMLButtonElement;
    exportTopButton: HTMLButtonElement;
  };

  private dialog: {
    overlay: HTMLElement;
    canvas: HTMLCanvasElement;
    title: HTMLElement;
    status: HTMLElement;
    close: HTMLButtonElement;
    edit: HTMLButtonElement;
    gif: HTMLButtonElement;
    png: HTMLButtonElement;
    saveTrip: HTMLButtonElement;
  } | null = null;

  private state: AppState;
  private samplePreviews: Array<[string, string]> = [];
  private sampleBitmaps: PhotoEntry[] = [];

  constructor(root: HTMLElement, opts: PhotoboothOptions) {
    this.root = root;
    this.opts = opts;
    injectStyles();
    this.state = {
      screen: 'entry',
      count: 4,
      timer: 3,
      orientation: 'landscape',
      filterId: 'none',
      soundOn: true,
      photos: [],
      sessionTotal: 4,
      running: false,
      layoutId: 'classic',
      color: DEFAULT_COLOR,
      title: (opts.title ?? '').trim().slice(0, TITLE_MAX),
      transforms: [],
      selected: -1,
      tab: 'style',
      cameraError: null,
      cameraReady: false,
    };
  }

  mount(): void {
    this.root.classList.add('htpb');
    this.root.setAttribute('data-photobooth', 'root');
    this.build();
    this.showScreen('entry');
    void this.paintSamples();
    document.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('beforeunload', this.onBeforeUnload);
  }

  /**
   * Cột "Kiểu dải có sẵn": ảnh thật của mục đang mở (nếu có), không thì ảnh proto
   * trong `design/proto/assets/photos/` — AGENTS.md mục 3 cấm ảnh tự vẽ.
   */
  private async paintSamples(): Promise<void> {
    const urls = (this.opts.sourcePhotos?.length ? this.opts.sourcePhotos : SAMPLE_PHOTOS).slice(0, 5);
    const loaded = await loadSamplePhotos(urls);
    if (this.destroyed) return;
    this.sampleBitmaps = loaded;
    const canvases = Array.from(this.els.samples.querySelectorAll('canvas'));
    this.samplePreviews.forEach(([id], index) => {
      const canvas = canvases[index];
      if (!canvas) return;
      const layout = layoutById(id);
      // Dải cổ điển nhận mọi số ảnh: vẽ 3 ô để ô mẫu không cao quá, vẫn đúng kiểu.
      const photoCount = layout.slots ?? 3;
      if (loaded.length === 0) {
        // Không tải được ảnh nào: vẽ khung số thứ tự, tuyệt đối không vẽ ảnh giả.
        canvas.width = 1;
        canvas.height = 1;
        canvas.classList.add('is-empty');
        return;
      }
      canvas.classList.remove('is-empty');
      const photos: PhotoEntry[] = Array.from({ length: photoCount }, (_, k) => ({
        ...loaded[(index * 2 + k) % loaded.length],
        id: `sample-${id}-${k}`,
      }));
      // Vẽ ở tỉ lệ 1 rồi thu bằng CSS: dải cổ điển 4 ảnh rất cao, cần thu cho vừa khung.
      const rendered = renderStripToCanvas(
        {
          layout,
          photos,
          transforms: photos.map(() => ({ scale: 1, dx: 0, dy: 0 })),
          color: layout.color,
          title: 'HÀNH TRÌNH',
          dateLabel: '20/10/2026',
        },
        1,
      );
      canvas.width = rendered.width;
      canvas.height = rendered.height;
      canvas.getContext('2d')?.drawImage(rendered, 0, 0);
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    document.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    this.sessionAbort?.abort();
    this.camera.stop();
    for (const bitmap of this.sampleBitmaps) (bitmap.source as ImageBitmap).close?.();
    this.sampleBitmaps = [];
    this.closeDialog(true);
    this.root.classList.remove('htpb');
    this.root.innerHTML = '';
    const style = document.getElementById(STYLE_ID);
    // Chỉ gỡ CSS khi không còn photobooth nào khác trên trang.
    if (style && !document.querySelector('[data-photobooth="root"].htpb')) style.remove();
  }

  private onBeforeUnload = (): void => {
    // Không lưu gì (R-135); chỉ tắt track cho sạch khi rời trang.
    this.camera.stop();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.dialogsKeydown(event)) return;
    if (this.state.screen !== 'camera') return;
    if (event.code !== 'Space' && event.key !== ' ') return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
      return;
    }
    if (target?.closest('button, a, [role="button"]')) return;
    if (this.state.running || this.state.cameraError) return;
    event.preventDefault();
    void this.startSession();
  };

  private dialogsKeydown(event: KeyboardEvent): boolean {
    if (!this.dialogOpen) return false;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDialog();
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- build ---

  private build(): void {
    const entry = this.buildEntry();
    const camera = this.buildCameraScreen();
    const editor = this.buildEditorScreen();
    this.root.append(entry, camera, editor);
  }

  private buildEntry(): HTMLElement {
    const section = el('section', { class: 'htpb-entry', 'aria-labelledby': 'htpb-entry-title' });

    const aside = el('div', { class: 'htpb-entry__aside' });
    const guide = el('div', { class: 'htpb-card htpb-guide' });
    guide.append(el('h2', { class: 'htpb-panel__title', text: 'Cách chụp' }));
    const steps = [
      ['1', 'Mở camera hoặc tải ảnh lên'],
      ['2', 'Chọn số ảnh, hẹn giờ và hướng khung'],
      ['3', 'Chọn kiểu dải, màu và tiêu đề rồi xuất'],
    ];
    for (const [num, text] of steps) {
      guide.append(
        el('div', { class: 'htpb-guide__step' }, el('span', { class: 'htpb-guide__num', text: num }), el('p', { text })),
      );
    }
    aside.append(guide);

    const main = el('div', { class: 'htpb-entry__main' });
    const card = el('div', { class: 'htpb-card htpb-main-card' });

    const title = el('h1', { class: 'htpb-entry__title', id: 'htpb-entry-title', text: 'Photobooth kỷ niệm' });
    this.els = { ...(this.els ?? ({} as typeof this.els)), title };

    const desc = el('p', {
      class: 'htpb-main-card__desc',
      text:
        'Chụp một dải ảnh giữ lại cho mục kỷ niệm. Mọi thứ chạy ngay trong trình duyệt: ảnh không đi đâu cả cho tới khi bạn tự lưu.',
    });

    const openCamera = el('button', { class: 'htpb-btn htpb-btn--primary htpb-btn--lg', type: 'button' });
    openCamera.append(icon('camera', 20), document.createTextNode('Mở camera'));

    const fileInput = el('input', {
      type: 'file',
      accept: 'image/*',
      multiple: true,
      class: 'htpb-sr',
      tabindex: -1,
      'aria-hidden': 'true',
    });
    const uploadButton = el('button', { class: 'htpb-btn htpb-btn--secondary htpb-btn--lg', type: 'button' });
    uploadButton.append(icon('upload', 20), document.createTextNode('Tải ảnh lên'));

    const sourceButton = el('button', { class: 'htpb-btn htpb-btn--secondary htpb-btn--lg', type: 'button' });
    sourceButton.append(icon('image', 20), document.createTextNode('Lấy ảnh từ mục'));
    sourceButton.hidden = !(this.opts.sourcePhotos && this.opts.sourcePhotos.length);

    const actions = el('div', { class: 'htpb-entry__actions' }, openCamera, uploadButton, sourceButton);

    const drop = el('div', {
      class: 'htpb-drop',
      role: 'button',
      tabindex: 0,
      'aria-label': 'Vùng kéo thả hoặc bấm để chọn ảnh từ máy',
    });
    const dropIcon = el('span', { class: 'htpb-drop__icon' });
    dropIcon.innerHTML = ICONS.upload(40);
    drop.append(
      dropIcon,
      el('strong', { text: 'Kéo ảnh vào đây' }),
      el('span', { text: 'hoặc bấm để chọn nhiều ảnh · JPEG, PNG, WebP, HEIC tuỳ trình duyệt' }),
      fileInput,
    );

    const facts = el('div', { class: 'htpb-facts' });
    const factA = el('div', { class: 'htpb-fact' });
    const factAIcon = el('span');
    factAIcon.innerHTML = ICONS.laptop(20);
    factA.append(factAIcon, el('div', {}, el('strong', { text: 'Xử lý ngay trên máy' }), el('span', { text: 'Chụp, lọc, ghép khung, xuất đều chạy trong trình duyệt' })));
    const factB = el('div', { class: 'htpb-fact' });
    const factBIcon = el('span');
    factBIcon.innerHTML = ICONS.shield(20);
    factB.append(factBIcon, el('div', {}, el('strong', { text: 'Ảnh không rời máy' }), el('span', { text: 'Không tải ảnh lên máy chủ, không lưu ngầm' })));
    facts.append(factA, factB);

    const entryAlert = el('div', { class: 'htpb-alert', role: 'alert', hidden: true });

    card.append(title, desc, actions, entryAlert, drop, facts);
    main.append(card);

    const samplesAside = el('div', { class: 'htpb-entry__samples' });
    const samplesHead = el('h2', { class: 'htpb-panel__title', text: 'Kiểu dải có sẵn' });
    const samples = el('div', { class: 'htpb-samples' });
    this.els.samples = samples;
    const previews: Array<[string, string]> = [
      ['classic', 'Dải cổ điển'],
      ['ticket', 'Vé máy bay'],
      ['film', 'Phim cuộn'],
    ];
    this.samplePreviews = previews;
    previews.forEach(([, label]) => {
      const canvas = el('canvas', { 'aria-hidden': 'true' });
      const figure = el('figure', {}, canvas, el('figcaption', { text: label }));
      samples.append(figure);
    });
    samplesAside.append(samplesHead, samples);

    section.append(aside, main, samplesAside);

    // Hành vi màn vào.
    openCamera.addEventListener('click', () => void this.openCamera());
    uploadButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length) void this.handleFiles(fileInput.files);
      fileInput.value = '';
    });
    const triggerDrop = () => fileInput.click();
    drop.addEventListener('click', (event) => {
      if (event.target === fileInput) return;
      triggerDrop();
    });
    drop.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        triggerDrop();
      }
    });
    drop.addEventListener('dragover', (event) => {
      event.preventDefault();
      drop.classList.add('is-over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (event) => {
      event.preventDefault();
      drop.classList.remove('is-over');
      const files = event.dataTransfer?.files;
      if (files && files.length) void this.handleFiles(files);
      else this.showEntryError('Không nhận được tệp nào. Kéo ảnh từ thư mục hoặc bấm để chọn.');
    });
    sourceButton.addEventListener('click', () => void this.loadSourcePhotos());

    this.els.entry = section;
    this.els.entryAlert = entryAlert;
    this.els.drop = drop;
    this.els.fileInput = fileInput;
    this.els.sourceButton = sourceButton;
    return section;
  }

  private buildCameraScreen(): HTMLElement {
    const section = el('section', { class: 'htpb-camera', 'aria-labelledby': 'htpb-camera-title' });

    // ---- Bộ lọc ----
    const filtersPanel = el('div', { class: 'htpb-panel htpb-camera__filters' });
    const screenTitle = el('h1', { class: 'htpb-sr', id: 'htpb-camera-title', text: 'Chụp ảnh' });
    const filtersHead = el('div', { class: 'htpb-panel__head' });
    filtersHead.append(el('h2', { class: 'htpb-panel__title', text: 'Bộ lọc' }));
    const lockBadge = el('span', { class: 'htpb-lock', hidden: true });
    lockBadge.append(el('span', { text: 'Đang chụp' }));
    filtersHead.append(lockBadge);
    const filters = el('div', { class: 'htpb-filters' });
    FILTERS.forEach((filter) => {
      const button = el('button', {
        class: 'htpb-filter',
        type: 'button',
        'data-filter': filter.id,
        'aria-pressed': 'false',
      });
      const swatch = el('span', { class: 'htpb-filter__swatch' });
      swatch.style.filter = filter.css === 'none' ? 'none' : filter.css;
      swatch.append(el('span', { text: filter.label.charAt(0), 'aria-hidden': 'true' }));
      button.append(swatch, el('span', { class: 'htpb-filter__label', text: filter.label }));
      button.addEventListener('click', () => {
        if (this.state.running) return;
        this.state.filterId = filter.id;
        this.applyFilterToPreview();
        this.syncCamera();
      });
      filters.append(button);
    });
    filtersPanel.append(filtersHead, filters);

    // ---- Khung video ----
    const stage = el('div', { class: 'htpb-stage' });
    const videoWrap = el('div', { class: 'htpb-video-wrap' });

    const closeButton = el('button', { class: 'htpb-close', type: 'button', 'aria-label': 'Tắt camera, về màn vào' });
    closeButton.innerHTML = ICONS.close(22);
    closeButton.addEventListener('click', () => this.closeCamera());

    const badge = el('div', { class: 'htpb-video-badge' });
    const badgeDot = el('span', { class: 'htpb-dot' });
    const badgeText = el('span', { text: '0 / 4' });
    badge.append(badgeDot, badgeText);

    const video = el('video', { class: 'htpb-video', playsinline: true, autoplay: true, muted: true, 'aria-label': 'Xem trước camera, hình lật gương' });
    video.muted = true;

    const mask = el('div', { class: 'htpb-mask' });
    mask.append(
      el('div', { class: 'htpb-mask__band htpb-mask__band--left' }),
      el('div', { class: 'htpb-mask__band htpb-mask__band--right' }),
      el('div', { class: 'htpb-mask__band htpb-mask__band--top' }),
      el('div', { class: 'htpb-mask__band htpb-mask__band--bottom' }),
      el('div', { class: 'htpb-mask__box' }),
    );

    const countdown = el('div', { class: 'htpb-countdown', 'aria-hidden': 'true' });
    const countdownNumber = el('span');
    countdown.append(countdownNumber);
    const countdownLive = el('div', { class: 'htpb-sr', 'aria-live': 'assertive', 'aria-atomic': 'true' });

    const flash = el('div', { class: 'htpb-flash' });
    const preview = el('div', { class: 'htpb-preview', 'aria-hidden': 'true' });
    const previewCard = el('div', { class: 'htpb-preview__card' });
    const previewCanvas = el('canvas', { width: 480, height: 360 });
    const previewCaption = el('span');
    previewCard.append(previewCanvas, previewCaption);
    preview.append(previewCard);

    videoWrap.append(video, mask, closeButton, badge, countdown, flash, preview);

    const controls = el('div', { class: 'htpb-stage__bar' });
    const shootButton = el('button', { class: 'htpb-shoot', type: 'button' });
    const shootDot = el('span', { class: 'htpb-shoot__dot' });
    const shootLabel = el('span', { text: 'Bắt đầu chụp' });
    shootButton.append(shootDot, shootLabel);
    shootButton.addEventListener('click', () => void this.startSession());

    const stopButton = el('button', { class: 'htpb-btn htpb-btn--secondary htpb-stop', type: 'button', hidden: true });
    stopButton.append(icon('stop', 18), document.createTextNode('Dừng'));
    stopButton.addEventListener('click', () => this.stopSession());

    const soundLabel = el('label', { class: 'htpb-sound' });
    const soundToggle = el('input', { type: 'checkbox' });
    soundToggle.checked = true;
    soundToggle.addEventListener('change', () => {
      this.state.soundOn = soundToggle.checked;
    });
    soundLabel.append(soundToggle, document.createTextNode('Tiếng màn trập'));

    controls.append(shootButton, stopButton, soundLabel);
    stage.append(videoWrap, controls);

    // ---- Tuỳ chọn ----
    const options = el('div', { class: 'htpb-panel htpb-camera__options' });
    const optionsHead = el('div', { class: 'htpb-panel__head' });
    optionsHead.append(el('h2', { class: 'htpb-panel__title', text: 'Bố cục' }));
    const countField = this.buildSegmented(
      'Số ảnh',
      COUNTS.map((n) => ({ value: String(n), label: String(n) })),
      (value) => {
        if (this.state.running) return;
        this.state.count = Number(value) as PhotoCount;
        this.syncCamera();
      },
      'htpb-field--count',
    );
    const timerField = this.buildSegmented(
      'Hẹn giờ',
      TIMERS.map((n) => ({ value: String(n), label: n === 0 ? 'Không' : `${n}s` })),
      (value) => {
        if (this.state.running) return;
        this.state.timer = Number(value) as TimerSeconds;
        this.syncCamera();
      },
      'htpb-field--timer',
    );
    const orientationField = this.buildSegmented(
      'Hướng',
      [
        { value: 'landscape', label: 'Ngang 4:3' },
        { value: 'portrait', label: 'Dọc 3:4' },
      ],
      (value) => {
        if (this.state.running) return;
        this.state.orientation = value as Orientation;
        this.syncCamera();
      },
      'htpb-field--orientation',
    );
    options.append(optionsHead, countField.node, timerField.node, orientationField.node);
    (options as HTMLElement & { _fields?: unknown })._fields = { countField, timerField, orientationField };

    // ---- Phiên chụp ----
    const session = el('div', { class: 'htpb-panel htpb-camera__session' });
    const sessionHead = el('div', { class: 'htpb-panel__head' });
    sessionHead.append(el('h2', { class: 'htpb-panel__title', text: 'Phiên chụp' }));
    const sessionCount = el('span', { class: 'htpb-session__count', text: '0 / 4' });
    sessionHead.append(sessionCount);
    const progress = el('div', {
      class: 'htpb-progress',
      role: 'progressbar',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': '0',
      'aria-label': 'Tiến độ chụp',
    });
    const progressFill = el('div', { class: 'htpb-progress__fill' });
    progress.append(progressFill);
    const thumbs = el('div', { class: 'htpb-thumbs', 'aria-label': 'Ảnh đã chụp' });
    const nextButton = el('button', { class: 'htpb-btn htpb-btn--primary htpb-btn--lg htpb-btn--block htpb-next', type: 'button' });
    nextButton.append(icon('check', 18), document.createTextNode('Sang bước chỉnh sửa'));
    nextButton.addEventListener('click', () => this.goEditor());
    const nextHint = el('p', { class: 'htpb-hint-line' });
    session.append(sessionHead, progress, thumbs, nextButton, nextHint);

    section.append(filtersPanel, stage, options, session);
    const left = el('div', { class: 'htpb-camera__left' }, screenTitle, filtersPanel, options);
    section.replaceChildren(left, stage, session);

    this.els.video = video;
    this.els.videoWrap = videoWrap;
    this.els.camera = section;
    this.els.filters = filters;
    this.els.options = options;
    this.els.countdown = countdown;
    this.els.countdownLive = countdownLive;
    (countdown as HTMLElement & { _number?: HTMLElement })._number = countdownNumber;
    this.els.flash = flash;
    this.els.preview = preview;
    this.els.previewCanvas = previewCanvas;
    this.els.previewCaption = previewCaption;
    this.els.badge = badge;
    this.els.badgeDot = badgeDot;
    this.els.badgeText = badgeText;
    this.els.sessionCount = sessionCount;
    this.els.progressFill = progressFill;
    this.els.thumbs = thumbs;
    this.els.nextButton = nextButton;
    this.els.nextHint = nextHint;
    this.els.shootButton = shootButton;
    this.els.stopButton = stopButton;
    this.els.soundToggle = soundToggle;
    this.els.lockBadge = lockBadge;
    this.els.cameraTitle = section.querySelector('#htpb-camera-title') as HTMLHeadingElement;
    this.els.countdownLive = countdownLive;
    section.prepend(countdownLive);
    (progress as HTMLElement).setAttribute('data-progress', '');
    (section as HTMLElement & { _progress?: HTMLElement })._progress = progress;
    return section;
  }

  private buildEditorScreen(): HTMLElement {
    const section = el('section', { class: 'htpb-editor', 'aria-labelledby': 'htpb-editor-title' });

    const mobileTop = el('div', { class: 'htpb-editor__top' });
    const backTop = el('button', { class: 'htpb-btn htpb-btn--ghost htpb-btn--sm', type: 'button' });
    backTop.append(el('span', { text: '← Quay lại camera' }));
    backTop.addEventListener('click', () => void this.backToCamera());
    const exportTop = el('button', { class: 'htpb-btn htpb-btn--primary htpb-btn--sm', type: 'button', text: 'Xuất' });
    exportTop.addEventListener('click', () => this.openDialog());
    mobileTop.append(backTop, exportTop);

    const left = el('div', { class: 'htpb-editor__aside-left' });
    const leftInner = el('div', { class: 'htpb-card htpb-guide' });
    const backButton = el('button', { class: 'htpb-btn htpb-btn--ghost htpb-btn--block htpb-back-panel', type: 'button' });
    backButton.append(el('span', { text: '← Quay lại camera' }));
    backButton.addEventListener('click', () => void this.backToCamera());

    const styleGroup = el('div', {});
    leftInner.append(el('h1', { class: 'htpb-sr', id: 'htpb-editor-title', text: 'Chỉnh dải ảnh' }));
    styleGroup.append(el('h2', { class: 'htpb-panel__title', text: 'Kiểu dải' }));
    const layouts = el('div', { class: 'htpb-layouts', role: 'group', 'aria-label': 'Kiểu dải' });
    LAYOUTS.forEach((layout) => {
      const button = el('button', {
        class: 'htpb-layout',
        type: 'button',
        'data-layout': layout.id,
        'aria-pressed': 'false',
      });
      const dot = el('span', { class: 'htpb-layout__dot' });
      dot.style.background = layout.color;
      const body = el('span', { class: 'htpb-layout__body' });
      body.append(
        el('span', { class: 'htpb-layout__label', text: layout.label }),
        el('span', { class: 'htpb-layout__meta', text: layout.slots ? `${layout.slots} ô` : 'mọi số ảnh' }),
      );
      button.append(dot, body);
      button.title = layout.hint;
      button.addEventListener('click', () => this.selectLayout(layout));
      layouts.append(button);
    });
    styleGroup.append(layouts);

    const colorGroup = el('div', {});
    colorGroup.append(el('h2', { class: 'htpb-panel__title', text: 'Màu dải' }));
    const swatches = el('div', { class: 'htpb-swatches', role: 'group', 'aria-label': 'Màu nền dải' });
    PALETTE.forEach((color) => {
      const button = el('button', {
        class: 'htpb-swatch',
        type: 'button',
        'data-color': color.hex,
        'aria-pressed': 'false',
        'aria-label': color.label,
        title: color.label,
      });
      button.style.background = color.hex;
      button.style.color = textOn(color.hex);
      button.append(el('span', { text: 'AB' }));
      button.addEventListener('click', () => this.selectColor(color.hex));
      swatches.append(button);
    });
    const resetColor = el('button', { class: 'htpb-btn htpb-btn--ghost htpb-btn--sm htpb-btn--block', type: 'button', text: 'Đặt lại màu' });
    resetColor.addEventListener('click', () => this.selectColor(layoutById(this.state.layoutId).color));

    const titleField = el('div', { class: 'htpb-title-field' });
    const titleId = 'htpb-strip-title';
    titleField.append(el('label', { for: titleId, text: 'Tiêu đề dải' }));
    const titleInput = el('input', { id: titleId, type: 'text', maxlength: String(TITLE_MAX), autocomplete: 'off', spellcheck: 'false' });
    const titleCount = el('small', { text: `0 / ${TITLE_MAX} ký tự · tự đổi sang chữ in hoa` });
    titleInput.addEventListener('input', () => {
      const value = titleInput.value.slice(0, TITLE_MAX);
      this.state.title = value;
      titleCount.textContent = `${value.length} / ${TITLE_MAX} ký tự · tự đổi sang chữ in hoa`;
      this.drawEditorStrip();
    });
    titleField.append(titleInput, titleCount);
    const colorHint = el('p', { class: 'htpb-hint-line' });

    colorGroup.append(swatches, resetColor, titleField, colorHint);
    leftInner.append(backButton, styleGroup, colorGroup);
    left.append(leftInner);

    const center = el('div', { class: 'htpb-editor__center' });
    const tabs = el('div', { class: 'htpb-editor-tabs', role: 'tablist', 'aria-label': 'Bảng chỉnh dải' });
    const tabStyle = el('button', { type: 'button', role: 'tab', 'aria-selected': 'true', text: 'Kiểu' });
    const tabColor = el('button', { type: 'button', role: 'tab', 'aria-selected': 'false', text: 'Màu & tiêu đề' });
    tabStyle.addEventListener('click', () => this.setEditorTab('style'));
    tabColor.addEventListener('click', () => this.setEditorTab('color'));
    tabs.append(tabStyle, tabColor);

    const stripScroll = el('div', { class: 'htpb-strip-scroll' });
    const strip = el('canvas', { class: 'htpb-strip', role: 'img' });
    strip.setAttribute('aria-label', 'Dải ảnh đang chỉnh. Kéo để dời ảnh, cuộn hoặc chụm hai ngón để phóng.');
    strip.addEventListener('pointerdown', this.onPointerDown as EventListener);
    strip.addEventListener('pointermove', this.onPointerMove as EventListener);
    strip.addEventListener('pointerup', this.onPointerUp as EventListener);
    strip.addEventListener('pointercancel', this.onPointerUp as EventListener);
    strip.addEventListener('wheel', this.onWheel as EventListener, { passive: false });
    strip.addEventListener('keydown', this.onStripKeyDown);
    strip.tabIndex = 0;
    stripScroll.append(strip);
    const flashNote = el('p', { class: 'htpb-flash-note', text: 'Giữ và kéo ảnh để dời · cuộn hoặc chụm hai ngón để phóng 1,00–3,00' });

    center.append(tabs, stripScroll, flashNote);

    const right = el('div', { class: 'htpb-editor__aside-right' });
    const rightCard = el('div', { class: 'htpb-panel' });
    const editorSessionHead = el('div', { class: 'htpb-panel__head' });
    editorSessionHead.append(el('h2', { class: 'htpb-panel__title', text: 'Phiên chụp' }));
    const editorSessionCount = el('span', { class: 'htpb-session__count', text: '0 / 0' });
    editorSessionHead.append(editorSessionCount);
    const editorThumbs = el('div', { class: 'htpb-thumbs htpb-editor-thumbs' });
    const retake = el('div', { class: 'htpb-retake htpb-retake--panel' });
    retake.append(
      el('h3', { class: 'htpb-panel__title', text: 'Chụp lại' }),
      el('p', { text: 'Quay lại camera giữ nguyên ảnh đang có. Bấm "bắt đầu chụp" sẽ chụp lại cả phiên.' }),
    );
    const retakeButton = el('button', { class: 'htpb-btn htpb-btn--secondary htpb-btn--block', type: 'button', text: 'Quay lại camera' });
    retakeButton.addEventListener('click', () => void this.backToCamera());
    retake.append(retakeButton);

    const exportButton = el('button', { class: 'htpb-btn htpb-btn--primary htpb-btn--lg htpb-btn--block htpb-export-btn', type: 'button', text: 'Xuất' });
    exportButton.addEventListener('click', () => this.openDialog());

    rightCard.append(editorSessionHead, editorThumbs, el('hr', { class: 'htpb-rule' }), retake, exportButton);
    right.append(rightCard);

    section.append(mobileTop, left, center, right);

    this.els.editor = section;
    this.els.editorStrip = strip;
    this.els.stripScroll = stripScroll;
    this.els.layouts = layouts;
    this.els.swatches = swatches;
    this.els.colorHint = colorHint;
    this.els.titleInput = titleInput;
    this.els.titleCount = titleCount;
    this.els.editorSessionCount = editorSessionCount;
    this.els.editorThumbs = editorThumbs;
    this.els.editorTabStyle = tabStyle;
    this.els.editorTabColor = tabColor;
    this.els.styleGroup = styleGroup;
    this.els.colorGroup = colorGroup;
    this.els.exportButton = exportButton;
    this.els.exportTopButton = exportTop;
    this.els.editorThumbs = editorThumbs;
    this.paintTitle();
    return section;
  }

  private buildSegmented(
    label: string,
    options: Array<{ value: string; label: string }>,
    onPick: (value: string) => void,
    fieldClass: string,
  ): { node: HTMLElement; buttons: Map<string, HTMLButtonElement>; setDisabled: (v: boolean) => void } {
    const field = el('div', { class: `htpb-field ${fieldClass}` });
    field.append(el('span', { class: 'htpb-field__label', text: label }));
    const group = el('div', { class: 'htpb-seg', role: 'group', 'aria-label': label });
    const buttons = new Map<string, HTMLButtonElement>();
    options.forEach((option) => {
      const button = el('button', { type: 'button', 'aria-pressed': 'false', 'data-value': option.value, text: option.label });
      button.addEventListener('click', () => {
        if (button.disabled) return;
        onPick(option.value);
      });
      buttons.set(option.value, button);
      group.append(button);
    });
    field.append(group);
    return { node: field, buttons, setDisabled: (v) => buttons.forEach((b) => (b.disabled = v)) };
  }

  // ------------------------------------------------------------- screens ---

  private showScreen(screen: ScreenName): void {
    this.state.screen = screen;
    this.els.entry.hidden = screen !== 'entry';
    this.els.camera.hidden = screen !== 'camera';
    this.els.editor.hidden = screen !== 'editor';
    if (screen === 'camera') {
      this.syncThumbs();
      this.syncCamera();
    }
    if (screen === 'editor') this.syncEditor();
    this.els.entry.setAttribute('aria-hidden', screen === 'entry' ? 'false' : 'true');
    this.els.camera.setAttribute('aria-hidden', screen === 'camera' ? 'false' : 'true');
    this.els.editor.setAttribute('aria-hidden', screen === 'editor' ? 'false' : 'true');
    if (screen === 'editor') this.focusHeading(this.els.editor);
  }

  /** Đưa focus về tiêu đề màn mới để trình đọc màn hình đọc đúng ngữ cảnh. */
  private focusHeading(section: HTMLElement): void {
    const heading = section.querySelector<HTMLHeadingElement>('h1');
    if (!heading) return;
    heading.tabIndex = -1;
    window.setTimeout(() => heading.focus({ preventScroll: true }), 0);
  }  // ------------------------------------------------------------- camera ----

  private async openCamera(): Promise<void> {
    if (this.camera.active) {
      this.showScreen('camera');
      return;
    }
    this.hideEntryError();
    try {
      const stream = await this.camera.start();
      this.attachStream(stream);
      this.state.cameraReady = true;
      this.state.cameraError = null;
      this.showScreen('camera');
    } catch (error) {
      const cameraError = (error as CameraError) ?? withMessage({ kind: 'other', message: '' });
      this.state.cameraReady = false;
      this.state.cameraError = cameraError;
      this.showCameraError(cameraError);
    }
  }

  private attachStream(stream: MediaStream): void {
    this.els.video.srcObject = stream;
    void this.els.video.play().catch(() => {
      /* Tự phát lại khi người dùng bấm; không chặn luồng. */
    });
  }

  private closeCamera(): void {
    this.stopSession();
    this.camera.stop();
    this.els.video.srcObject = null;
    this.state.cameraReady = false;
    this.state.cameraError = null;
    this.state.running = false;
    this.state.photos = [];
    this.syncThumbs();
    this.showScreen('entry');
  }

  private showCameraError(error: CameraError): void {
    this.showScreen('entry');
    this.els.entryAlert.hidden = false;
    this.els.entryAlert.replaceChildren();
    const iconSpan = el('span');
    iconSpan.innerHTML = ICONS.alert(20);
    const body = el('div');
    body.append(el('p', { text: cameraErrorMessage(error) }));
    const actions = el('div', { class: 'htpb-alert__actions' });
    const retry = el('button', { class: 'htpb-btn htpb-btn--primary htpb-btn--sm', type: 'button', text: 'Thử lại' });
    retry.addEventListener('click', () => void this.openCamera());
    const upload = el('button', { class: 'htpb-btn htpb-btn--secondary htpb-btn--sm', type: 'button', text: 'Tải ảnh lên' });
    upload.addEventListener('click', () => this.els.fileInput.click());
    actions.append(retry, upload);
    body.append(actions);
    this.els.entryAlert.append(iconSpan, body);
    requestAnimationFrame(() => retry.focus());
  }

  private showEntryError(message: string): void {
    this.els.entryAlert.hidden = false;
    this.els.entryAlert.replaceChildren();
    const iconSpan = el('span');
    iconSpan.innerHTML = ICONS.alert(20);
    const body = el('div');
    body.append(el('p', { text: message }));
    this.els.entryAlert.append(iconSpan, body);
  }

  private hideEntryError(): void {
    this.els.entryAlert.hidden = true;
    this.els.entryAlert.replaceChildren();
  }

  private applyFilterToPreview(): void {
    const filter = filterById(this.state.filterId);
    this.els.video.style.filter = filter.css === 'none' ? 'none' : filter.css;
  }

  private async startSession(): Promise<void> {
    if (this.state.running || this.state.photos.length > 0 && !this.state.cameraReady) {
      if (!this.state.cameraReady) return;
    }
    if (this.state.running) return;
    if (!this.camera.active) {
      await this.openCamera();
      if (!this.camera.active) return;
    }

    this.disposePhotos();
    this.state.photos = [];
    this.state.sessionTotal = this.state.count;
    this.state.transforms = [];
    this.state.running = true;
    this.sessionAbort = new AbortController();
    this.syncCamera();
    this.syncThumbs();
    this.els.badgeDot.classList.add('is-live');

    try {
      await runSession({
        video: this.els.video,
        count: this.state.count,
        timer: this.state.timer,
        orientation: this.state.orientation,
        filterId: this.state.filterId,
        signal: this.sessionAbort.signal,
        onCountdown: (value) => this.setCountdown(value),
        onCapture: (canvas, index) => {
          void this.addCapturedPhoto(canvas, index);
        },
        onPreview: (canvas, index) => this.showPreview(canvas, index),
        onFlash: () => this.flash(),
      });
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') {
        this.showEntryError(`Phiên chụp dừng vì lỗi: ${(error as Error)?.message ?? 'không rõ'}`);
      }
    } finally {
      if (!this.destroyed) {
        this.state.running = false;
        this.setCountdown(null);
        this.els.badgeDot.classList.remove('is-live');
        this.showPreview(null);
        this.syncCamera();
        this.syncThumbs();
      }
    }
  }

  private async addCapturedPhoto(canvas: HTMLCanvasElement, index: number): Promise<void> {
    if (this.destroyed) return;
    if (this.state.soundOn) playShutter();
    let source: ImageBitmap | HTMLCanvasElement = canvas;
    try {
      source = await createImageBitmap(canvas);
    } catch {
      source = canvas;
    }
    const photo: PhotoEntry = {
      id: `shot-${Date.now()}-${index}`,
      source,
      width: canvas.width,
      height: canvas.height,
      alt: `Ảnh ${this.state.photos.length + 1}`,
      origin: 'camera',
    };
    this.state.photos.push(photo);
    this.syncCamera();
    this.syncThumbs();
  }

  private stopSession(): void {
    this.sessionAbort?.abort();
    this.sessionAbort = null;
    this.state.running = false;
    this.setCountdown(null);
    this.showPreview(null);
    this.els.badgeDot.classList.remove('is-live');
    this.syncCamera();
    this.syncThumbs();
  }

  private setCountdown(value: number | null): void {
    const box = this.els.countdown;
    const number = (box as HTMLElement & { _number?: HTMLElement })._number;
    if (value === null) {
      box.classList.remove('is-on');
      this.els.countdownLive.textContent = '';
      return;
    }
    box.classList.add('is-on');
    if (number) {
      number.textContent = String(value);
      // Chạy lại animation mỗi giây.
      number.style.animation = 'none';
      void number.offsetWidth;
      number.style.animation = '';
    }
    this.els.countdownLive.textContent = `Chụp sau ${value} giây`;
  }

  private flash(): void {
    const node = this.els.flash;
    node.classList.remove('is-on');
    void node.offsetWidth;
    node.classList.add('is-on');
    window.setTimeout(() => node.classList.remove('is-on'), 200);
  }

  private showPreview(canvas: HTMLCanvasElement | null, index = 0): void {
    if (!canvas) {
      this.els.preview.classList.remove('is-on');
      return;
    }
    const target = this.els.previewCanvas;
    target.width = canvas.width;
    target.height = canvas.height;
    const ctx = target.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(canvas, 0, 0);
    }
    this.els.previewCaption.textContent = `Ảnh ${index + 1} / ${this.state.sessionTotal}`;
    this.els.preview.classList.add('is-on');
  }

  private syncCamera(): void {
    if (this.state.screen !== 'camera') return;
    const { count, timer, orientation, running, filterId, photos, sessionTotal } = this.state;

    this.els.videoWrap.classList.toggle('is-portrait', orientation === 'portrait');
    this.els.badgeText.textContent = `${photos.length} / ${sessionTotal}`;
    this.els.badgeDot.classList.toggle('is-live', running);

    this.els.filters.querySelectorAll<HTMLButtonElement>('.htpb-filter').forEach((button) => {
      const on = button.dataset.filter === filterId;
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      button.disabled = running;
    });

    const fields = (this.els.options as HTMLElement & {
      _fields?: Record<string, { buttons: Map<string, HTMLButtonElement>; setDisabled: (v: boolean) => void }>;
    })._fields;
    if (fields) {
      fields.countField.setDisabled(running);
      fields.timerField.setDisabled(running);
      fields.orientationField.setDisabled(running);
      const mark = (key: string, value: string) => {
        fields[key].buttons.forEach((button, optionValue) => {
          button.setAttribute('aria-pressed', optionValue === value ? 'true' : 'false');
        });
      };
      mark('countField', String(count));
      mark('timerField', String(timer));
      mark('orientationField', orientation);
    }
    this.els.lockBadge.hidden = !running;

    this.els.shootButton.hidden = running;
    this.els.stopButton.hidden = !running;
    this.els.soundToggle.disabled = false;

    this.syncSession();
    this.applyFilterToPreview();
  }

  private syncSession(): void {
    const total = this.state.sessionTotal;
    const done = this.state.photos.length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    this.els.sessionCount.textContent = `${done} / ${total}`;
    this.els.progressFill.style.width = `${percent}%`;
    const bar = this.els.camera.querySelector('[data-progress]');
    bar?.setAttribute('aria-valuenow', String(percent));

    const ready = done > 0 && !this.state.running;
    this.els.nextButton.disabled = !ready;
    this.els.nextButton.classList.toggle('is-ready', ready && done === total);
    if (this.state.running) {
      this.els.nextHint.textContent = 'Đang chụp, chờ xong hoặc bấm dừng.';
    } else if (done === 0) {
      this.els.nextHint.textContent = 'Chụp ít nhất 1 ảnh để sang bước chỉnh sửa.';
    } else if (done === total) {
      this.els.nextHint.textContent = `Đủ ${total} ảnh. Có thể sang bước chỉnh sửa.`;
    } else {
      this.els.nextHint.textContent = `Đã có ${done}/${total} ảnh. Có thể chụp tiếp hoặc sang chỉnh sửa.`;
    }
  }

  private syncThumbs(): void {
    const { photos, sessionTotal } = this.state;
    for (const container of [this.els.thumbs, this.els.editorThumbs]) {
      container.replaceChildren();
      photos.forEach((photo, index) => {
        const thumb = el('canvas', { width: 112, height: 84 });
        thumb.setAttribute('role', 'img');
        thumb.setAttribute('aria-label', `Ảnh ${index + 1}`);
        thumb.title = `Ảnh ${index + 1}`;
        const ctx = thumb.getContext('2d');
        if (ctx) {
          const scale = Math.max(112 / photo.width, 84 / photo.height);
          const dw = photo.width * scale;
          const dh = photo.height * scale;
          ctx.drawImage(photo.source, (112 - dw) / 2, (84 - dh) / 2, dw, dh);
        }
        container.append(thumb);
      });
      const missing = Math.max(0, sessionTotal - photos.length);
      for (let i = 0; i < missing; i += 1) {
        container.append(el('span', { class: 'htpb-empty-slot', text: String(photos.length + i + 1) }));
      }
    }
    this.els.editorSessionCount.textContent = `${photos.length} / ${Math.max(sessionTotal, photos.length)}`;
    this.els.exportButton.disabled = photos.length === 0;
    this.els.exportTopButton.disabled = photos.length === 0;
  }

  // -------------------------------------------------------------- editor ---

  private async handleFiles(files: FileList | File[]): Promise<void> {
    this.hideEntryError();
    this.els.drop.classList.remove('is-over');
    const result = await readImageFiles(files);
    if (!result.photos.length) {
      const reason = result.rejected[0] ?? 'Không có tệp ảnh nào được chọn.';
      this.showEntryError(reason);
      return;
    }
    if (result.rejected.length) {
      this.showEntryError(
        `Đã bỏ qua ${result.rejected.length} tệp: ${result.rejected.slice(0, 3).join('; ')}${result.rejected.length > 3 ? '…' : ''}`,
      );
    }
    this.disposePhotos();
    this.state.photos = result.photos;
    this.state.sessionTotal = result.photos.length;
    this.state.layoutId = 'classic';
    this.state.color = DEFAULT_COLOR;
    this.state.transforms = result.photos.map(() => ({ scale: 1, dx: 0, dy: 0 }));
    this.syncThumbs();
    this.goEditor(true);
  }

  private async loadSourcePhotos(): Promise<void> {
    const urls = this.opts.sourcePhotos ?? [];
    if (!urls.length) return;
    this.hideEntryError();
    const result = await readImageUrls(urls);
    if (!result.photos.length) {
      this.showEntryError('Không tải được ảnh của mục. Có thể ảnh đang ẩn hoặc đường dẫn đã đổi.');
      return;
    }
    if (result.rejected.length) {
      this.showEntryError(`Bỏ qua ${result.rejected.length} ảnh: ${result.rejected.join('; ')}`);
    }
    this.disposePhotos();
    this.state.photos = result.photos;
    this.state.sessionTotal = result.photos.length;
    this.state.layoutId = 'classic';
    this.state.color = DEFAULT_COLOR;
    this.state.transforms = result.photos.map(() => ({ scale: 1, dx: 0, dy: 0 }));
    this.syncThumbs();
    this.goEditor(true);
  }

  private goEditor(fromUpload = false): void {
    if (!fromUpload) {
      if (this.state.running || this.state.photos.length === 0) return;
      this.stopSession();
    }
    this.state.layoutId = 'classic';
    this.state.color = DEFAULT_COLOR;
    this.state.transforms = this.state.photos.map(() => ({ scale: 1, dx: 0, dy: 0 }));
    this.paintTitle();
    this.showScreen('editor');
    this.syncEditor();
    this.syncThumbs();
  }

  private async backToCamera(): Promise<void> {
    // R-114: camera vẫn chạy, ảnh cũ còn nguyên.
    if (!this.camera.active) {
      await this.openCamera();
      if (!this.camera.active) return;
    }
    this.showScreen('camera');
    this.syncCamera();
  }

  private selectLayout(layout: LayoutDef): void {
    if (!layoutAvailable(layout, this.state.photos.length)) return;
    this.state.layoutId = layout.id;
    this.state.color = layout.color;
    this.state.transforms = this.state.photos.map(() => ({ scale: 1, dx: 0, dy: 0 }));
    this.state.selected = -1;
    this.syncEditor();
  }

  private selectColor(hex: string): void {
    const layout = layoutById(this.state.layoutId);
    if (layout.kind !== 'classic') return;
    this.state.color = hex;
    this.syncEditor();
  }

  private setEditorTab(tab: 'style' | 'color'): void {
    this.state.tab = tab;
    this.syncEditor();
  }

  private paintTitle(): void {
    const value = this.state.title.slice(0, TITLE_MAX);
    this.els.titleInput.value = value;
    this.els.titleCount.textContent = `${value.length} / ${TITLE_MAX} ký tự · tự đổi sang chữ in hoa`;
  }

  private syncEditor(): void {
    if (this.state.screen !== 'editor') return;
    const layout = layoutById(this.state.layoutId);
    const count = this.state.photos.length;
    const isClassic = layout.kind === 'classic';

    this.els.layouts.querySelectorAll<HTMLButtonElement>('.htpb-layout').forEach((button) => {
      const id = button.dataset.layout ?? '';
      const def = layoutById(id);
      const available = layoutAvailable(def, count);
      button.disabled = !available;
      button.setAttribute('aria-pressed', id === layout.id ? 'true' : 'false');
      const meta = button.querySelector('.htpb-layout__meta');
      if (meta) {
        meta.textContent = def.slots ? `${def.slots} ô${available ? '' : ` · cần ${def.slots} ảnh`}` : 'mọi số ảnh';
      }
    });

    this.els.swatches.querySelectorAll<HTMLButtonElement>('.htpb-swatch').forEach((button) => {
      const hex = button.dataset.color ?? '';
      button.setAttribute('aria-pressed', hex.toLowerCase() === this.state.color.toLowerCase() ? 'true' : 'false');
      button.disabled = !isClassic;
    });
    this.els.titleInput.disabled = false;
    this.els.colorHint.textContent = isClassic
      ? 'Màu chỉ áp cho dải cổ điển. Đổi kiểu khung thì màu về mặc định của kiểu đó.'
      : `Khung "${layout.label}" dùng màu cố định của khung; chọn "Dải cổ điển" để đổi màu nền.`;

    const showStyle = this.isWide() || this.state.tab === 'style';
    this.els.styleGroup.hidden = !showStyle;
    this.els.colorGroup.hidden = !this.isWide() && showStyle;
    this.els.editorTabStyle.setAttribute('aria-selected', showStyle ? 'true' : 'false');
    this.els.editorTabColor.setAttribute('aria-selected', showStyle ? 'false' : 'true');

    this.drawEditorStrip();
  }

  private isWide(): boolean {
    return typeof matchMedia === 'function' ? matchMedia('(min-width: 1024px)').matches : true;
  }

  private notifyTransform(index: number): void {
    const transform = this.state.transforms[index];
    if (!transform) return;
    this.root.dispatchEvent(
      new CustomEvent('htpb:transform', {
        detail: { index, scale: transform.scale, dx: transform.dx, dy: transform.dy },
      }),
    );
  }

  private drawEditorStrip(): void {
    const layout = layoutById(this.state.layoutId);
    const photos = this.state.photos;
    const size = stripSize(layout, Math.max(1, photos.length));
    const width = Math.min(size.width, Math.max(180, this.els.stripScroll.clientWidth - 8));
    const ratio = 2; // canvas nét gấp đôi, hiển thị theo CSS
    const canvas = this.els.editorStrip;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round((size.height * width * ratio) / size.width);
    canvas.style.width = `${width}px`;
    canvas.style.height = 'auto';
    canvas.dataset.photos = String(photos.length);
    canvas.dataset.layout = layout.id;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, canvas.height / ratio);
    ctx.scale(width / size.width, width / size.width);
    drawStrip(ctx, {
      layout,
      photos,
      transforms: this.state.transforms,
      color: this.state.color,
      title: this.state.title,
      dateLabel: dateLabel(),
      placeholders: true,
    });
  }

  // ------------------------------------------------------- drag and zoom ---

  private pointers = new Map<number, { x: number; y: number }>();
  private dragIndex = -1;
  private dragStart = { x: 0, y: 0 };
  private dragOrigin = { dx: 0, dy: 0 };
  private pinchStart = 0;
  private pinchScale = 1;

  private toStripPoint(event: PointerEvent | WheelEvent): { x: number; y: number } {
    const rect = this.els.editorStrip.getBoundingClientRect();
    const layout = layoutById(this.state.layoutId);
    const size = stripSize(layout, Math.max(1, this.state.photos.length));
    const scale = size.width / rect.width;
    return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale };
  }

  private holeIndexAt(point: { x: number; y: number }): number {
    const layout = layoutById(this.state.layoutId);
    const holes = holesFor(layout, Math.max(1, this.state.photos.length));
    for (let i = 0; i < holes.length; i += 1) {
      const hole = holes[i];
      if (point.x >= hole.x && point.x <= hole.x + hole.w && point.y >= hole.y && point.y <= hole.y + hole.h) {
        return i;
      }
    }
    return -1;
  }

  private ensureTransform(index: number): PhotoTransform {
    while (this.state.transforms.length <= index) {
      this.state.transforms.push({ scale: 1, dx: 0, dy: 0 });
    }
    return this.state.transforms[index];
  }

  private onPointerDown = (event: PointerEvent): void => {
    const point = this.toStripPoint(event);
    const index = this.holeIndexAt(point);
    if (index < 0 || index >= this.state.photos.length) return;
    this.els.editorStrip.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.state.selected = index;

    if (this.pointers.size === 2) {
      const [a, b] = Array.from(this.pointers.values());
      this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      this.pinchScale = this.ensureTransform(index).scale;
      this.dragIndex = index;
      return;
    }
    const transform = this.ensureTransform(index);
    this.dragIndex = index;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.dragOrigin = { dx: transform.dx, dy: transform.dy };
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId) && this.pointers.size === 0) return;
    if (this.pointers.has(event.pointerId)) {
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (this.pointers.size === 2) {
      const [a, b] = Array.from(this.pointers.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchStart > 0 && this.dragIndex >= 0) {
        const raw = this.pinchScale * (distance / this.pinchStart);
        const stepped = clamp(Math.round(raw / 0.05) * 0.05, 1, 3);
        this.ensureTransform(this.dragIndex).scale = Number(stepped.toFixed(2));
        this.notifyTransform(this.dragIndex);
        this.drawEditorStrip();
      }
      return;
    }

    if (this.dragIndex < 0) return;
    const rect = this.els.editorStrip.getBoundingClientRect();
    const layout = layoutById(this.state.layoutId);
    const size = stripSize(layout, Math.max(1, this.state.photos.length));
    const factor = size.width / rect.width;
    const transform = this.ensureTransform(this.dragIndex);
    transform.dx = this.dragOrigin.dx + (event.clientX - this.dragStart.x) * factor;
    transform.dy = this.dragOrigin.dy + (event.clientY - this.dragStart.y) * factor;
    this.notifyTransform(this.dragIndex);
    this.drawEditorStrip();
  };

  private onPointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size === 0) {
      this.dragIndex = -1;
      this.pinchStart = 0;
    }
  };

  private onWheel = (event: WheelEvent): void => {
    const point = this.toStripPoint(event);
    const index = this.holeIndexAt(point);
    if (index < 0 || index >= this.state.photos.length) return;
    event.preventDefault();
    const transform = this.ensureTransform(index);
    const direction = event.deltaY < 0 ? 1 : -1;
    const next = clamp(Math.round((transform.scale + direction * 0.05) * 100) / 100, 1, 3);
    transform.scale = Number(next.toFixed(2));
    this.state.selected = index;
    this.notifyTransform(index);
    this.drawEditorStrip();
  };

  private onStripKeyDown = (event: KeyboardEvent): void => {
    if (this.state.selected < 0) return;
    const transform = this.ensureTransform(this.state.selected);
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      transform.scale = Number(clamp(transform.scale + 0.05, 1, 3).toFixed(2));
      this.notifyTransform(this.state.selected);
      this.drawEditorStrip();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      transform.scale = Number(clamp(transform.scale - 0.05, 1, 3).toFixed(2));
      this.notifyTransform(this.state.selected);
      this.drawEditorStrip();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const step = event.key === 'ArrowLeft' ? -10 : 10;
      transform.dx += step;
      this.notifyTransform(this.state.selected);
      this.drawEditorStrip();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const step = event.key === 'ArrowUp' ? -10 : 10;
      transform.dy += step;
      this.notifyTransform(this.state.selected);
      this.drawEditorStrip();
    }
  };

  // -------------------------------------------------------------- dialog ---

  private openDialog(): void {
    if (!this.state.photos.length) return;
    this.lastFocus = document.activeElement as HTMLElement | null;
    const overlay = el('div', { class: 'htpb-portal htpb-overlay', role: 'presentation' });
    const dialog = el('div', {
      class: 'htpb-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'htpb-dialog-title',
    });
    const head = el('div', { class: 'htpb-dialog__head' });
    head.append(el('h2', { id: 'htpb-dialog-title', text: 'Xem lại dải ảnh' }));
    const close = el('button', { class: 'htpb-close-dialog', type: 'button', 'aria-label': 'Đóng hộp xem lại' });
    close.innerHTML = ICONS.close(20);
    close.addEventListener('click', () => this.closeDialog());
    head.append(close);

    const body = el('div', { class: 'htpb-dialog__body' });
    // Giới hạn bề ngang bản xem trước theo chiều cao hộp: dải 1 ảnh và dải 30 ảnh đều đọc được.
    const previewWidth = Math.max(
      160,
      Math.min(320, Math.round((window.innerHeight * 0.5 * 260) / 910)),
    );
    const canvas = renderStripToCanvas(this.stripOptions(), previewWidth / 260);
    canvas.style.width = `${previewWidth}px`;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Xem trước dải ảnh sắp xuất');
    body.append(canvas);

    const foot = el('div', { class: 'htpb-dialog__foot' });
    const title = el('div', { class: 'htpb-dialog__title', text: (this.state.title || 'KỶ NIỆM').toUpperCase() });
    const actions = el('div', { class: 'htpb-dialog__actions' });
    const edit = el('button', { class: 'htpb-btn htpb-btn--secondary', type: 'button', text: 'Sửa tiếp' });
    edit.addEventListener('click', () => this.closeDialog());
    const gif = el('button', { class: 'htpb-btn htpb-btn--dark', type: 'button' });
    gif.append(icon('image', 18), document.createTextNode('GIF động'));
    gif.addEventListener('click', () => void this.exportGif());
    const png = el('button', { class: 'htpb-btn htpb-btn--primary', type: 'button' });
    png.append(icon('upload', 18), document.createTextNode('Lưu dải ảnh'));
    png.addEventListener('click', () => void this.exportPng());
    const saveTrip = el('button', { class: 'htpb-btn htpb-btn--ghost htpb-btn--block', type: 'button' });
    saveTrip.append(icon('heart', 16), document.createTextNode('Lưu vào mục'));
    saveTrip.hidden = typeof this.opts.onSaveToTrip !== 'function';
    saveTrip.addEventListener('click', () => void this.saveToTrip());
    actions.append(edit, gif, png);

    const status = el('p', { class: 'htpb-dialog__status', role: 'status', 'aria-live': 'polite' });
    foot.append(title, actions, saveTrip, status);
    dialog.append(head, body, foot);
    overlay.append(dialog);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.closeDialog();
    });

    document.body.append(overlay);
    this.dialog = { overlay, canvas, title, status, close, edit, gif, png, saveTrip };
    this.dialogOpen = true;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => close.focus(), 0);
    // Giữ focus trong hộp.
    overlay.addEventListener('keydown', this.trapFocus);
  }

  private trapFocus = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || !this.dialog) return;
    const focusable = Array.from(
      this.dialog.overlay.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, [tabindex]:not([tabindex="-1"])'),
    ).filter((node) => !node.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  private closeDialog(force = false): void {
    if (!this.dialog && !force) return;
    this.dialog?.overlay.remove();
    this.dialog = null;
    this.dialogOpen = false;
    document.body.style.overflow = '';
    if (!force && this.lastFocus && document.contains(this.lastFocus)) {
      this.lastFocus.focus();
    }
    this.lastFocus = null;
  }

  private stripOptions() {
    return {
      layout: layoutById(this.state.layoutId),
      photos: this.state.photos,
      transforms: this.state.transforms,
      color: this.state.color,
      title: this.state.title,
      dateLabel: dateLabel(),
      placeholders: true,
    };
  }

  private async exportPng(): Promise<void> {
    if (!this.dialog || this.busy) return;
    this.setBusy('png', 'Đang ghép dải ảnh…');
    try {
      const canvas = renderStripToCanvas(this.stripOptions(), 2);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Trình duyệt không tạo được tệp PNG.');
      download(blob, `hanh-trinh-${slugifyTitle(this.state.title)}.png`);
      this.setStatus(`Đã lưu hanh-trinh-${slugifyTitle(this.state.title)}.png`, false);
      window.setTimeout(() => this.closeDialog(), 350);
    } catch (error) {
      this.setStatus(`Không xuất được PNG: ${(error as Error).message}`, true);
    } finally {
      this.setBusy(null);
    }
  }

  private async exportGif(): Promise<void> {
    if (!this.dialog || this.busy) return;
    this.setBusy('gif', 'Đang chuẩn bị GIF…');
    try {
      const blob = await encodeGif(this.state.photos, (percent) => this.setStatus(`Đang tạo GIF… ${percent}%`, false));
      download(blob, `hanh-trinh-${slugifyTitle(this.state.title)}.gif`);
      this.setStatus(`Đã lưu hanh-trinh-${slugifyTitle(this.state.title)}.gif`, false);
      window.setTimeout(() => this.closeDialog(), 350);
    } catch (error) {
      this.setStatus(`Không tạo được GIF: ${(error as Error).message}`, true);
    } finally {
      this.setBusy(null);
    }
  }

  private async saveToTrip(): Promise<void> {
    if (!this.dialog || this.busy || !this.opts.onSaveToTrip) return;
    this.setBusy('trip', 'Đang lưu vào mục…');
    try {
      const canvas = renderStripToCanvas(this.stripOptions(), 2);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Trình duyệt không tạo được tệp PNG.');
      await this.opts.onSaveToTrip(blob);
      this.setStatus('Đã lưu dải ảnh vào mục.', false);
      window.setTimeout(() => this.closeDialog(), 600);
    } catch (error) {
      this.setStatus(`Không lưu được vào mục: ${(error as Error).message}`, true);
    } finally {
      this.setBusy(null);
    }
  }

  private setBusy(kind: 'png' | 'gif' | 'trip' | null, message?: string): void {
    this.busy = kind;
    if (!this.dialog) return;
    const { gif, png, saveTrip, edit } = this.dialog;
    const all = [gif, png, saveTrip];
    // R-116/R-127: hai nút xuất khoá lẫn nhau khi một việc đang chạy.
    all.forEach((button) => {
      button.disabled = kind !== null;
    });
    edit.disabled = kind !== null;
    for (const button of all) {
      const spinner = button.querySelector('.htpb-spinner');
      if (spinner) spinner.remove();
    }
    if (kind) {
      const target = kind === 'png' ? png : kind === 'gif' ? gif : saveTrip;
      target.prepend(el('span', { class: 'htpb-spinner', 'aria-hidden': 'true' }));
      if (message) this.setStatus(message, false);
    }
    window.clearTimeout(this.statusTimer);
  }

  private setStatus(message: string, isError: boolean): void {
    if (!this.dialog) return;
    this.dialog.status.textContent = message;
    this.dialog.status.classList.toggle('is-error', isError);
  }

  // ------------------------------------------------------------- cleanup ---

  private disposePhotos(): void {
    for (const photo of this.state.photos) {
      const source = photo.source as { close?: () => void };
      if (typeof source.close === 'function') {
        try {
          source.close();
        } catch {
          /* ảnh đã đóng */
        }
      }
    }
  }
}

/**
 * Gắn photobooth vào phần tử. Trả về hàm gỡ.
 * Không dùng localStorage/cookie/IndexedDB, không gọi mạng ngoài (R-132, R-135).
 */
export function mountPhotobooth(el: HTMLElement, opts: PhotoboothOptions = {}): () => void {
  const app = new PhotoboothApp(el, opts);
  app.mount();
  return () => app.destroy();
}

export type { PhotoboothOptions };
