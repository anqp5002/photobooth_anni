/**
 * CSS của photobooth — theo R-013 (màu), R-014 (chữ), R-031 (hệ nút),
 * R-131 (390px không tràn ngang, vùng chạm ≥ 44px), R-128 (giảm chuyển động).
 * Mọi lớp có tiền tố `htpb-` để không đụng CSS của app chính.
 */
export const STYLE_ID = 'htpb-style';

export const CSS = `
.htpb, .htpb-portal {
  --ink: #4A1F4F;
  --pink: #4A1F4F;
  --blue: #8E5A93;
  --gold: #F6C445;
  --gold-deep: #E0A81F;
  --page: transparent;
  --card: rgba(255, 255, 255, 0.62);
  --line: rgba(74, 31, 79, 0.18);
  --line-soft: rgba(74, 31, 79, 0.12);
  --muted: #A98CAE;
  --body: #6B4A70;
  --mid: #8E5A93;
  --font: "Inter", "Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  --head: "Oswald", "Arial Narrow", sans-serif;
  --btn-font: "Be Vietnam Pro", "Inter", system-ui, sans-serif;
  --radius-card: 28px;
  --radius-video: 20px;
}
.htpb {
  color: var(--ink);
  font-family: var(--font);
  font-size: 14px;
  line-height: 20px;
  background: var(--page);
  border-radius: var(--radius-card);
  padding: 24px;
  box-sizing: border-box;
  max-width: 100%;
}
.htpb-portal {
  color: var(--ink);
  font-family: var(--font);
  font-size: 14px;
  line-height: 20px;
}
.htpb *, .htpb *::before, .htpb *::after,
.htpb-portal *, .htpb-portal *::before, .htpb-portal *::after { box-sizing: border-box; }
.htpb [hidden], .htpb-portal [hidden] { display: none !important; }
.htpb h1, .htpb h2, .htpb h3, .htpb p { margin: 0; }
.htpb img, .htpb canvas, .htpb video { max-width: 100%; }
.htpb button, .htpb-portal button { font-family: inherit; }
.htpb :focus-visible, .htpb-portal :focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
.htpb .htpb-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* ---------- Nút (R-031) ---------- */
.htpb-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 44px; padding: 0 20px; border-radius: 999px;
  border: 1px solid transparent; cursor: pointer;
  font-size: 14px; font-weight: 700; line-height: 1;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease,
    opacity 160ms ease, transform 160ms ease;
}
.htpb-btn--primary { background: var(--pink); color: #fff; }
.htpb-btn--primary:hover:not(:disabled) { background: #d91843; }
.htpb-btn--secondary { background: #fff; color: var(--ink); border: 0.8px solid var(--line); }
.htpb-btn--secondary:hover:not(:disabled) { background: #f2f4f6; }
.htpb-btn--dark { background: var(--ink); color: #fff; }
.htpb-btn--dark:hover:not(:disabled) { background: #001c2a; }
.htpb-btn--ghost { background: transparent; color: var(--ink); border: 0.8px solid var(--line); }
.htpb-btn--link { background: none; border: 0; color: var(--blue); font-size: 14px; padding: 8px 12px; min-height: 44px; }
.htpb-btn--lg { min-height: 48px; font-size: 16px; padding: 0 24px; }
.htpb-btn--sm { min-height: 44px; font-size: 12px; padding: 0 14px; }
.htpb-btn:disabled { cursor: not-allowed; opacity: 0.45; }
.htpb-btn--block { width: 100%; }

/* ---------- Màn vào ---------- */
.htpb-entry {
  display: grid; grid-template-columns: 1fr; gap: 20px; align-items: start;
}
.htpb-entry__title { font-size: 24px; line-height: 28px; font-weight: 700; }
.htpb-entry__lead { font-size: 14px; line-height: 20px; color: var(--body); }
.htpb-card {
  background: var(--card); border: 1px solid var(--line-soft);
  border-radius: var(--radius-card); padding: 20px;
}
.htpb-guide { display: flex; flex-direction: column; gap: 12px; }
.htpb-guide__step { display: flex; gap: 10px; font-size: 14px; line-height: 20px; color: var(--body); }
.htpb-guide__num {
  flex: 0 0 auto; width: 24px; height: 24px; border-radius: 999px;
  background: var(--ink); color: #fff; font-size: 12px; font-weight: 700;
  display: grid; place-items: center;
}
.htpb-main-card { display: flex; flex-direction: column; gap: 16px; padding: 24px; }
.htpb-main-card__desc { font-size: 14px; line-height: 20px; color: var(--body); }
.htpb-entry__actions { display: flex; flex-wrap: wrap; gap: 12px; }
.htpb-drop {
  border: 2px dashed var(--line); border-radius: 20px; padding: 24px 16px;
  text-align: center; background: #fbfbfa; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
}
.htpb-drop:hover { border-color: var(--mid); }
.htpb-drop.is-over { background: #fff0f3; border-color: var(--pink); transform: scale(1.01); }
.htpb-drop strong { font-size: 14px; font-weight: 700; }
.htpb-drop span { font-size: 12px; line-height: 18px; color: var(--mid); }
.htpb-drop__icon { width: 40px; height: 40px; color: var(--ink); }
.htpb-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.htpb-fact {
  background: #fbfbfa; border: 1px solid var(--line-soft); border-radius: 16px;
  padding: 12px; display: flex; gap: 8px; align-items: flex-start;
}
.htpb-fact strong { display: block; font-size: 12px; font-weight: 700; }
.htpb-fact span { font-size: 12px; line-height: 16px; color: var(--mid); }
.htpb-fact svg { flex: 0 0 auto; color: var(--ink); }
.htpb-samples { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.htpb-samples figure { margin: 0; min-width: 0; }
.htpb-samples figcaption { font-size: 11px; line-height: 15px; color: var(--mid); margin-top: 6px; text-align: center; }
/* Ảnh thật (ảnh của mục hoặc ảnh proto): thu vừa khung, KHÔNG cắt đáy cột mẫu.
   Cao cố định + object-fit: contain ⇒ cả dải luôn nằm trong khung 1440x900. */
.htpb-samples canvas {
  display: block; width: 100%; height: 340px; object-fit: contain;
  filter: drop-shadow(0 6px 14px rgba(74, 31, 79, 0.22));
}
.htpb-samples canvas.is-empty {
  height: 340px; border-radius: 6px;
  background: rgba(255, 255, 255, 0.55); border: 1px dashed var(--line);
}
.htpb-alert {
  display: flex; gap: 10px; align-items: flex-start;
  border: 1px solid #f7c6d1; background: #fff5f7; color: #8c1230;
  border-radius: 16px; padding: 12px 14px; font-size: 14px; line-height: 20px;
}
.htpb-alert svg { flex: 0 0 auto; margin-top: 2px; }
.htpb-alert p + .htpb-btn { margin-top: 8px; }
.htpb-alert__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }

/* ---------- Màn camera ---------- */
.htpb-camera { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.htpb-camera__left { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.htpb-panel { background: var(--card); border: 1px solid var(--line-soft); border-radius: 20px; padding: 16px; }
.htpb-panel__head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 12px;
}
.htpb-panel__title { font-size: 14px; font-weight: 700; }
.htpb-panel__hint { font-size: 12px; color: var(--mid); }
.htpb-lock {
  display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;
  color: #8c1230; background: #fff5f7; border-radius: 999px; padding: 4px 10px;
}
.htpb-filters { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; }.htpb-filter {
  flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 4px;
  background: none; border: 0; padding: 4px; cursor: pointer; border-radius: 12px;
  min-width: 56px; min-height: 44px;
}
.htpb-filter__swatch {
  width: 40px; height: 40px; border-radius: 999px; border: 2px solid transparent;
  background: linear-gradient(135deg, #cfe3ee 0%, #f6d9c0 55%, #b9c9b0 100%);
  display: grid; place-items: center; overflow: hidden;
}
.htpb-filter__swatch span { font-size: 12px; font-weight: 700; color: var(--ink); }
.htpb-filter[aria-pressed="true"] .htpb-filter__swatch { border-color: var(--pink); box-shadow: 0 0 0 2px #fff inset; }
.htpb-filter__label { font-size: 12px; line-height: 16px; color: var(--body); white-space: nowrap; }
.htpb-filter[aria-pressed="true"] .htpb-filter__label { color: var(--ink); font-weight: 700; }
.htpb-filter:disabled { opacity: 0.45; cursor: not-allowed; }

.htpb-field { margin-bottom: 14px; }
.htpb-field:last-child { margin-bottom: 0; }
.htpb-field__label { display: block; font-size: 12px; font-weight: 700; color: var(--body); margin-bottom: 6px; }
.htpb-seg { display: flex; gap: 6px; flex-wrap: wrap; }
.htpb-field--count .htpb-seg { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
.htpb-field--orientation .htpb-seg { display: grid; grid-template-columns: 1fr 1fr; }
.htpb-seg button {
  min-width: 44px; min-height: 44px; padding: 0 12px; border-radius: 999px;
  border: 1px solid var(--line); background: #fff; color: var(--ink);
  font-size: 13px; font-weight: 700; cursor: pointer;
}
.htpb-seg button[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: #fff; }
.htpb-seg button:disabled { opacity: 0.45; cursor: not-allowed; }

.htpb-stage { display: flex; flex-direction: column; gap: 12px; align-items: center; }
.htpb-video-wrap {
  position: relative; width: 100%; max-width: min(100%, calc(60vh * 4 / 3));
  aspect-ratio: 4 / 3; margin: 0 auto;
  background: #0b1c25; border-radius: var(--radius-video);
  overflow: hidden; display: flex; align-items: center; justify-content: center;
  --band-l: 21.875%; --band-r: 21.875%; --band-t: 0%; --band-b: 0%;
}
.htpb-video-wrap.is-portrait { max-width: min(100%, calc(80vh * 4 / 3)); }
.htpb-video-wrap video {
  width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); display: block;
}
.htpb-mask {
  position: absolute; inset: 0; pointer-events: none; display: none;
}
.htpb-video-wrap.is-portrait .htpb-mask { display: block; }
.htpb-mask__band { position: absolute; background: rgba(0,20,32,0.55); }
.htpb-mask__band--left { left: 0; top: 0; bottom: 0; width: var(--band-l); }
.htpb-mask__band--right { right: 0; top: 0; bottom: 0; width: var(--band-r); }
.htpb-mask__band--top { top: 0; left: 0; right: 0; height: var(--band-t); }
.htpb-mask__band--bottom { bottom: 0; left: 0; right: 0; height: var(--band-b); }
.htpb-mask__box {
  position: absolute;
  top: var(--band-t); bottom: var(--band-b);
  left: var(--band-l); right: var(--band-r);
  border: 2px dashed rgba(255,255,255,0.9); border-radius: 4px;
}
.htpb-video-badge {
  position: absolute; top: 12px; right: 12px; z-index: 3;
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(0,22,34,0.9); color: #fff; border-radius: 999px;
  padding: 6px 12px; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
}
.htpb-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--pink); }
.htpb-dot.is-live { animation: htpb-blink 1s steps(2, start) infinite; }
.htpb-close {
  position: absolute; top: 12px; left: 12px; z-index: 4;
  width: 44px; height: 44px; border-radius: 999px; border: 0;
  background: rgba(0,22,34,0.9); color: #fff; cursor: pointer;
  display: grid; place-items: center;
}
.htpb-close:hover { background: rgba(0,16,26,0.96); }
.htpb-countdown {
  position: absolute; inset: 0; z-index: 5; display: none;
  align-items: center; justify-content: center; pointer-events: none;
}
.htpb-countdown.is-on { display: flex; }
.htpb-countdown span {
  font-size: clamp(72px, 18vw, 168px); line-height: 1; font-weight: 700; color: #fff;
  text-shadow: 0 8px 32px rgba(0,0,0,0.45);
  animation: htpb-count 1s ease-out both;
}
.htpb-flash {
  position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 6;
}
.htpb-flash.is-on { animation: htpb-flash 150ms ease-out both; }
.htpb-preview {
  position: absolute; inset: 0; z-index: 7; display: none;
  align-items: center; justify-content: center; background: rgba(0,20,32,0.55);
}
.htpb-preview.is-on { display: flex; }
.htpb-preview__card {
  background: #fff; padding: 8px 8px 14px; border-radius: 6px;
  box-shadow: 0 18px 40px rgba(0,0,0,0.35); transform: rotate(-3deg);
  animation: htpb-pop 200ms ease-out both; max-width: 62%; max-height: 78%;
  display: flex; flex-direction: column; gap: 6px;
}
.htpb-preview__card canvas { display: block; max-height: 46vh; width: auto; height: auto; }
.htpb-preview__card span { font-size: 12px; color: var(--mid); text-align: center; }
.htpb-shoot {
  display: inline-flex; align-items: center; gap: 10px;
  min-height: 52px; padding: 0 26px; border-radius: 999px; border: 0;
  background: var(--ink); color: #fff; font-size: 16px; font-weight: 700; cursor: pointer;
}
.htpb-shoot:hover:not(:disabled) { background: #001c2a; }
.htpb-shoot:disabled { opacity: 0.45; cursor: not-allowed; }
.htpb-shoot__dot { width: 12px; height: 12px; border-radius: 999px; background: var(--pink); }
.htpb-stage__bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center; }
.htpb-sound { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--body); cursor: pointer; min-height: 44px; }
.htpb-sound input { width: 18px; height: 18px; accent-color: var(--ink); }

/* ---------- Phiên chụp ---------- */
.htpb-session__count { font-size: 24px; line-height: 28px; font-weight: 700; }
.htpb-progress { height: 8px; border-radius: 999px; background: var(--line-soft); overflow: hidden; margin: 8px 0 12px; }
.htpb-progress__fill { height: 100%; width: 0; background: var(--ink); border-radius: 999px; transition: width 300ms ease; }
.htpb-thumbs { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0 8px; }
.htpb-thumbs canvas, .htpb-thumbs img { width: 56px; height: 42px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); flex: 0 0 auto; }
.htpb-empty-slots { display: flex; gap: 8px; flex-wrap: wrap; }
.htpb-empty-slot {
  width: 56px; height: 42px; border-radius: 6px; border: 1px dashed var(--line);
  display: grid; place-items: center; font-size: 12px; color: var(--mid); background: #fbfbfa;
}
.htpb-next { margin-top: 12px; }
.htpb-next.is-ready { animation: htpb-pulse 1.2s ease-in-out infinite; }
.htpb-hint-line { font-size: 12px; line-height: 18px; color: var(--mid); margin-top: 8px; }

/* ---------- Màn chỉnh sửa ---------- */
.htpb-editor { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.htpb-editor__top { display: flex; gap: 10px; justify-content: space-between; align-items: center; }
.htpb-editor__center { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.htpb-strip-scroll { overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding: 8px 0 16px; }
.htpb-strip {
  display: block; touch-action: none; cursor: grab;
  border-radius: 4px; box-shadow: 0 10px 30px rgba(0,41,61,0.12);
  background: #fff; max-width: 100%; height: auto; flex: 0 0 auto;
}
.htpb-strip:active { cursor: grabbing; }
.htpb-layouts { display: flex; flex-direction: column; gap: 6px; }
.htpb-layout {
  display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 6px 10px;
  border-radius: 12px; border: 1px solid transparent; background: none;
  text-align: left; cursor: pointer; color: var(--ink); width: 100%;
}
.htpb-layout:hover:not(:disabled) { background: #f7f8f9; }
.htpb-layout[aria-pressed="true"] { background: #f2f4f6; border-color: var(--line); }
.htpb-layout:disabled { opacity: 0.42; cursor: not-allowed; }
.htpb-layout__dot { width: 14px; height: 14px; border-radius: 999px; border: 1px solid var(--line); flex: 0 0 auto; }
.htpb-layout__body { display: flex; flex-direction: column; }
.htpb-layout__label { font-size: 13px; font-weight: 700; }
.htpb-layout__meta { font-size: 12px; color: var(--mid); }
.htpb-swatches { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.htpb-swatch {
  min-height: 44px; border-radius: 12px; border: 1px solid var(--line); cursor: pointer;
  display: grid; place-items: center; font-size: 12px; font-weight: 700;
  position: relative; padding: 0;
}
/* Dấu "đang chọn" của ô màu: vòng trong bằng box-shadow inset theo currentColor
   (currentColor đã được chọn tương phản với màu ô, nên vòng luôn thấy được).
   KHÔNG dùng outline — outline dành riêng cho :focus-visible (R-031: 2px #0099E5 cách 2px). */
.htpb-swatch[aria-pressed="true"] {
  box-shadow: inset 0 0 0 3px currentColor;
}
.htpb-swatch svg { position: absolute; right: 4px; bottom: 4px; }
.htpb-title-field { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
.htpb-title-field label { font-size: 12px; font-weight: 700; color: var(--body); }
.htpb-title-field input {
  min-height: 44px; border-radius: 12px; border: 1px solid var(--line);
  padding: 0 12px; font-size: 14px; font-family: inherit; color: var(--ink);
  text-transform: uppercase; background: #fff; width: 100%;
}
.htpb-title-field small { font-size: 12px; color: var(--mid); }
.htpb-editor-tabs { display: flex; gap: 8px; }
@media (min-width: 1024px) {
  .htpb-editor-tabs { display: none; }
}
.htpb-editor-tabs button {
  flex: 1; min-height: 44px; border-radius: 999px; border: 1px solid var(--line);
  background: #fff; font-size: 13px; font-weight: 700; color: var(--ink); cursor: pointer;
}
.htpb-editor-tabs button[aria-selected="true"] { background: var(--ink); color: #fff; border-color: var(--ink); }
.htpb-retake { display: flex; flex-direction: column; gap: 8px; }
.htpb-retake p { font-size: 12px; line-height: 18px; color: var(--body); }
.htpb-export-btn { margin-top: 12px; }
.htpb-flash-note { font-size: 12px; color: var(--mid); text-align: center; }

/* ---------- Hộp xuất ---------- */
.htpb-portal.htpb-overlay {
  position: fixed; inset: 0; z-index: 900; background: rgba(0,41,61,0.85);
  backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center;
  padding: 16px; animation: htpb-fade 300ms ease-out both;
}
.htpb-dialog {
  background: #fff; border-radius: 24px; width: min(560px, 100%);
  max-height: calc(100vh - 32px); display: flex; flex-direction: column;
  box-shadow: 0 24px 60px rgba(0,0,0,0.35); overflow: hidden;
}
.htpb-dialog__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; }
.htpb-dialog__head h2 { font-size: 20px; line-height: 26px; font-weight: 700; }
.htpb-dialog__body { padding: 0 20px 8px; overflow: auto; display: flex; justify-content: center; align-items: flex-start; }
.htpb-dialog__body canvas {
  width: auto; height: auto; max-width: 100%; flex: 0 0 auto;
  /* Dải nhiều ảnh rất cao: giữ bề ngang đọc được, cho cuộn dọc thay vì bóp còn một sợi. */
  min-width: min(220px, 100%);
  box-shadow: 0 8px 24px rgba(0,41,61,0.14);
}
.htpb-dialog__foot { padding: 16px 20px 20px; border-top: 1px solid var(--line-soft); display: flex; flex-direction: column; gap: 12px; }
.htpb-dialog__title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; word-break: break-word; }
.htpb-dialog__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.htpb-dialog__actions .htpb-btn { flex: 1 1 auto; }
.htpb-dialog__status { font-size: 12px; line-height: 18px; color: var(--body); min-height: 18px; }
.htpb-dialog__status.is-error { color: #8c1230; }
.htpb-spinner {
  width: 14px; height: 14px; border-radius: 999px; border: 2px solid rgba(255,255,255,0.45);
  border-top-color: #fff; animation: htpb-spin 0.7s linear infinite;
}
.htpb-btn--secondary .htpb-spinner, .htpb-btn--ghost .htpb-spinner { border-color: rgba(0,41,61,0.25); border-top-color: var(--ink); }
.htpb-close-dialog {
  width: 44px; height: 44px; border-radius: 999px; border: 1px solid var(--line);
  background: #fff; color: var(--ink); cursor: pointer; display: grid; place-items: center;
}
.htpb-close-dialog:hover { background: #f2f4f6; }

/* ---------- Màn hẹp ---------- */
@media (max-width: 1023px) {
  .htpb { padding: 16px; border-radius: 20px; }
  .htpb-main-card { padding: 18px; }
  /* Điện thoại: vẫn 3 cột để ba kiểu dải nằm chung một hàng, mỗi ô thấp hơn. */
  .htpb-samples { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .htpb-samples canvas, .htpb-samples canvas.is-empty { height: 230px; }
  .htpb-entry__actions .htpb-btn { flex: 1 1 160px; }
  .htpb-dialog__actions .htpb-btn { flex: 1 1 100%; }
}
@media (max-width: 420px) {
  .htpb-facts { grid-template-columns: 1fr; }
}
.htpb-editor__top { display: none; }
.htpb-back-panel { margin-bottom: 14px; }
@media (max-width: 1023px) {
  .htpb-editor__top { display: flex; }
  /* R-126 điện thoại: hàng trên quay lại / xuất, hai tab "kiểu"/"màu", rồi hàng ảnh.
     Nút trong bảng bên trái và khối "chụp lại" chỉ dành cho desktop. */
  .htpb-back-panel, .htpb-retake--panel { display: none; }
}
@media (min-width: 1024px) {
  .htpb-entry { grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 24px; }
  .htpb-entry__aside { grid-column: 1 / span 3; position: sticky; top: 16px; }
  .htpb-entry__main { grid-column: 4 / span 6; }
  .htpb-entry__samples { grid-column: 10 / span 3; position: sticky; top: 16px; }
  .htpb-camera { grid-template-columns: 280px minmax(0, 1fr) 280px; align-items: start; }
  .htpb-editor { grid-template-columns: 260px minmax(0, 1fr) 280px; align-items: start; }
  /* R-126: cột giữa cuộn dọc khi dải dài, hai cột hai bên dính khi cuộn. */
  .htpb-strip-scroll { max-height: calc(100vh - 220px); }
  .htpb-editor__aside-left, .htpb-editor__aside-right { position: sticky; top: 16px; }
  /* R-125: desktop bộ lọc dạng danh sách dọc (mobile mới cuộn ngang). */
  .htpb-filters {
    flex-direction: column; overflow: visible; gap: 2px;
  }
  .htpb-filter {
    flex-direction: row; justify-content: flex-start; gap: 10px;
    width: 100%; min-height: 44px; padding: 2px 4px; border-radius: 12px;
  }
  .htpb-filter:hover { background: #f7f8f9; }
  .htpb-filter__swatch { width: 28px; height: 28px; }
  .htpb-filter__swatch span { font-size: 12px; }
  .htpb-filter[aria-pressed="true"] { background: #f2f4f6; }
  .htpb-filter[aria-pressed="true"] .htpb-filter__swatch { border-width: 2px; box-shadow: none; }
  .htpb-editor__aside-left { order: 0; }
  .htpb-editor__center { order: 1; }
  .htpb-editor__aside-right { order: 2; }
  .htpb-stage__bar { margin-top: 4px; }
}
@media (min-width: 1280px) {
  .htpb-camera { grid-template-columns: 260px minmax(0, 1fr) 300px; gap: 20px; }
  .htpb-editor { grid-template-columns: 280px minmax(0, 1fr) 300px; gap: 20px; }
}
@media (max-width: 1023px) {
  .htpb-camera { display: flex; flex-direction: column; }
  .htpb-camera__left { display: contents; }
  .htpb-camera > .htpb-camera__left > .htpb-camera__filters { order: 0; }
  .htpb-camera > .htpb-stage { order: 1; }
  .htpb-camera > .htpb-camera__left > .htpb-camera__options { order: 2; }
  .htpb-camera__options { display: grid; grid-template-columns: 1fr; gap: 10px; }
  .htpb-camera > .htpb-camera__session { order: 3; }
  .htpb-editor { display: flex; flex-direction: column; }
  .htpb-editor > .htpb-editor__center { order: 1; }
  .htpb-editor > .htpb-editor__aside-left { order: 2; }
  .htpb-editor > .htpb-editor__aside-right { order: 3; }
}

@keyframes htpb-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.25; } }
@keyframes htpb-count {
  0% { transform: scale(1.35); opacity: 0; }
  20% { transform: scale(1); opacity: 1; }
  80% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.85); opacity: 0; }
}
@keyframes htpb-flash { 0% { opacity: 0.95; } 100% { opacity: 0; } }
@keyframes htpb-pop { 0% { transform: rotate(-3deg) scale(0.9); opacity: 0; } 100% { transform: rotate(-3deg) scale(1); opacity: 1; } }
@keyframes htpb-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
@keyframes htpb-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes htpb-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .htpb *, .htpb *::before, .htpb *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
  .htpb-next.is-ready { animation: none; }
  .htpb-dot.is-live { animation: none; }
}

/* ------------------------------------------------------------------ */
/* r2: bản sắc Hành Trình — hồng phấn, thẻ kính mờ, Oswald, vàng nhấn  */
/* ------------------------------------------------------------------ */
.htpb {
  padding: 0;
  background: transparent;
  font-size: 15px;
  line-height: 22px;
}
.htpb h1, .htpb h2, .htpb h3 {
  font-family: var(--head);
  font-weight: 600;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  color: var(--ink);
}
.htpb-entry__title {
  font-size: 34px;
  line-height: 1.12;
  letter-spacing: 1.8px;
}
.htpb-entry__lead, .htpb-main-card__desc, .htpb-guide__step, .htpb-retake p { color: var(--body); }
.htpb-card {
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: var(--radius-card);
  box-shadow: 0 26px 60px -32px rgba(74, 31, 79, 0.5);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.htpb-panel {
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.85);
  border-radius: 22px;
  box-shadow: 0 12px 30px -20px rgba(74, 31, 79, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.htpb-panel__title { font-size: 13px; letter-spacing: 2px; }
.htpb-guide__num {
  background: var(--gold);
  color: #3A2233;
  font-family: var(--btn-font);
  font-weight: 700;
}
.htpb-guide__num { border-radius: 999px; }
.htpb-fact { background: rgba(255, 255, 255, 0.5); border-radius: 18px; }
.htpb-fact strong { font-family: var(--btn-font); letter-spacing: 0.2px; }
.htpb-btn {
  font-family: var(--btn-font);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  border-width: 1.5px;
}
.htpb-btn--primary {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
  box-shadow: 0 14px 26px -14px rgba(74, 31, 79, 0.75);
}
.htpb-btn--primary:hover:not(:disabled) { background: #5C2762; }
.htpb-btn--secondary {
  background: rgba(255, 255, 255, 0.82);
  border: 1.5px solid rgba(74, 31, 79, 0.4);
  color: var(--ink);
}
.htpb-btn--secondary:hover:not(:disabled) { background: #fff; }
.htpb-btn--ghost { background: transparent; border: 1.5px solid rgba(74, 31, 79, 0.32); }
.htpb-btn--ghost:hover:not(:disabled) { background: rgba(255, 255, 255, 0.6); }
.htpb-btn--dark { background: var(--ink); border-color: var(--ink); }
.htpb-btn--link { color: var(--mid); letter-spacing: 0.4px; text-transform: none; }
.htpb-export-btn,
.htpb-dialog__actions .htpb-btn--primary {
  background: var(--gold);
  border-color: var(--gold);
  color: #3A2233;
  box-shadow: 0 14px 26px -14px rgba(224, 168, 31, 0.85);
}
.htpb-export-btn:hover:not(:disabled),
.htpb-dialog__actions .htpb-btn--primary:hover:not(:disabled) { background: var(--gold-deep); }
.htpb-shoot { background: var(--ink); }
.htpb-shoot__dot { background: var(--gold); }
.htpb-drop {
  background: rgba(255, 255, 255, 0.5);
  border: 2px dashed rgba(142, 90, 147, 0.45);
  border-radius: var(--radius-card);
}
.htpb-drop.is-over {
  background: #FFF4F8;
  border-color: var(--ink);
}
.htpb-seg button,
.htpb-editor-tabs button {
  border: 1.5px solid rgba(74, 31, 79, 0.26);
  border-radius: 999px;
  font-family: var(--btn-font);
  background: rgba(255, 255, 255, 0.7);
}
.htpb-seg button[aria-pressed="true"],
.htpb-editor-tabs button[aria-selected="true"] {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
}
.htpb-layout {
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.55);
}
.htpb-layout:hover:not(:disabled) { background: rgba(255, 255, 255, 0.9); }
.htpb-layout[aria-pressed="true"] {
  background: rgba(246, 196, 69, 0.24);
  border-color: rgba(224, 168, 31, 0.8);
}
.htpb-layout__label { font-family: var(--btn-font); font-size: 13px; }
.htpb-swatch { border-radius: 14px; }
.htpb-title-field input {
  border-radius: 999px;
  border: 1.5px solid rgba(74, 31, 79, 0.28);
  padding: 10px 18px;
  font-family: var(--btn-font);
  background: rgba(255, 255, 255, 0.85);
}
.htpb-strip-scroll {
  background:
    radial-gradient(70% 60% at 50% 0%, rgba(142, 90, 147, 0.55) 0, transparent 70%),
    linear-gradient(170deg, #2B1330 0%, #0B1D26 100%);
  border-radius: var(--radius-card);
  padding: 22px 16px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}
.htpb-entry__samples { grid-column: auto; }
@media (min-width: 1024px) {
  /* Bản gốc đặt 10 / span 3 → tràn sang cột 13 ngoài lưới 12 cột, cắt mất mép phải. */
  .htpb-entry__samples { grid-column: 10 / -1; }
}
.htpb-dialog__body canvas { max-height: 58vh; }
.htpb-strip { box-shadow: 0 28px 60px -18px rgba(4, 11, 18, 0.7); border-radius: 4px; }
.htpb-flash-note { color: var(--mid); }
.htpb-video-wrap { border-radius: var(--radius-video); }
.htpb-thumbs canvas, .htpb-thumbs img { border-radius: 10px; border: 1.5px solid rgba(255, 255, 255, 0.9); }
.htpb-samples canvas { filter: drop-shadow(0 12px 24px rgba(74, 31, 79, 0.28)); }
.htpb-dialog {
  border-radius: var(--radius-card);
  background: #FFF7FB;
  box-shadow: 0 40px 90px -30px rgba(11, 29, 38, 0.6);
}
.htpb-dialog__head h2 { font-size: 20px; letter-spacing: 2px; }
.htpb-dialog__title { font-family: var(--btn-font); letter-spacing: 0.06em; }
.htpb-dialog__status { color: var(--body); }
.htpb-dialog__status.is-error { color: #A3244B; }
.htpb-alert { border-radius: 18px; }
.htpb-next.is-ready { box-shadow: 0 0 0 3px rgba(246, 196, 69, 0.45); }
`;

export function injectStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.append(style);
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
