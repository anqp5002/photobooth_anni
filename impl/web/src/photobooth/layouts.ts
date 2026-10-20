import type { PhotoEntry, PhotoTransform, Rect } from './types';
import { MONO, PALETTE, SANS, drawSpaced, rr, textOn } from './util';

/**
 * Dải ảnh: "dải cổ điển" (R-129) và 3 khung dựng sẵn chủ đề du lịch (R-130).
 * Toạ độ vẽ theo đơn vị CSS px của dải; xuất PNG nhân 2 bằng ctx.scale.
 */

export interface LayoutDef {
  id: string;
  label: string;
  /** Số ô cố định; null = nhận mọi số ảnh (dải cổ điển). */
  slots: number | null;
  /** Màu nền mặc định của kiểu này. */
  color: string;
  kind: 'classic' | 'frame';
  /** Mô tả ngắn cho phần trợ năng. */
  hint: string;
}

export const CLASSIC_WIDTH = 260;
/** Ảnh 4:3 rộng 236 → cao 177; hàng nhãn 18; khe 8 ⇒ mỗi ô 203. 4 ảnh ⇒ cao 910 ⇒ xuất 520x1820 (R-115). */
const CLASSIC_CELL = 203;
const CLASSIC_HEAD = 34;
const CLASSIC_FOOT = 40;
const CLASSIC_PAD = 12;

export const LAYOUTS: LayoutDef[] = [
  {
    id: 'classic',
    label: 'Dải cổ điển',
    slots: null,
    color: '#FFFFFF',
    kind: 'classic',
    hint: 'Nhận mọi số ảnh, có tiêu đề và nhãn từng ảnh',
  },
  {
    id: 'ticket',
    label: 'Vé máy bay',
    slots: 4,
    color: '#FFF2E5',
    kind: 'frame',
    hint: '4 ô dọc, khung vé máy bay',
  },
  {
    id: 'postcard',
    label: 'Bưu thiếp',
    slots: 4,
    color: '#E7EAEE',
    kind: 'frame',
    hint: '4 ô lưới 2x2, khung bưu thiếp',
  },
  {
    id: 'film',
    label: 'Phim cuộn',
    slots: 5,
    color: '#00293D',
    kind: 'frame',
    hint: '5 ô dọc, khung phim cuộn',
  },
];

export function layoutById(id: string): LayoutDef {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

/** Kiểu khung cố định chỉ chọn được khi số ảnh khớp (R-111). */
export function layoutAvailable(layout: LayoutDef, count: number): boolean {
  return layout.slots === null || layout.slots === count;
}

export interface StripSize {
  width: number;
  height: number;
}

export function stripSize(layout: LayoutDef, count: number): StripSize {
  if (layout.kind === 'classic') {
    const n = Math.max(1, count);
    return {
      width: CLASSIC_WIDTH,
      height: CLASSIC_PAD * 2 + CLASSIC_HEAD + n * CLASSIC_CELL + CLASSIC_FOOT,
    };
  }
  return { width: 320, height: 800 };
}

export interface DrawOptions {
  layout: LayoutDef;
  photos: PhotoEntry[];
  transforms: PhotoTransform[];
  color: string;
  title: string;
  /** Ngày in ở chân dải (R-129). */
  dateLabel?: string;
  /** Vẽ cả phần nền/khung hay chỉ ảnh (dùng cho ảnh mẫu ở màn vào). */
  placeholders?: boolean;
}

/** Toạ độ các ô (dùng cho cả vẽ và xử lý kéo/chạm). */
export function holesFor(layout: LayoutDef, count: number): Rect[] {
  if (layout.kind === 'classic') {
    const holes: Rect[] = [];
    const w = CLASSIC_WIDTH - CLASSIC_PAD * 2;
    const h = Math.round((w * 3) / 4);
    for (let i = 0; i < Math.max(1, count); i += 1) {
      const top = CLASSIC_PAD + CLASSIC_HEAD + i * CLASSIC_CELL;
      holes.push({ x: CLASSIC_PAD, y: top, w, h, r: 3 });
    }
    return holes;
  }
  if (layout.id === 'postcard') {
    // Bưu thiếp: 4 ô lưới 2x2 (ô dọc, ảnh cắt giữa), chừa dải địa chỉ ở chân.
    const pad = 22;
    const gapX = 14;
    const gapY = 16;
    const cellW = Math.round((320 - pad * 2 - gapX) / 2);
    const cellH = 290;
    const top = 98;
    return [0, 1, 2, 3].map((i) => ({
      x: pad + (i % 2) * (cellW + gapX),
      y: top + Math.floor(i / 2) * (cellH + gapY),
      w: cellW,
      h: cellH,
      r: 2,
    }));
  }
  const n = layout.slots ?? count;
  const gap = layout.id === 'film' ? 12 : 14;
  const top = layout.id === 'ticket' ? 76 : 74;
  const bottom = layout.id === 'ticket' ? 76 : 44;
  const availH = 800 - top - bottom;
  const h = (availH - gap * (n - 1)) / n;
  const w = Math.round((h * 4) / 3);
  const holes: Rect[] = [];
  for (let i = 0; i < n; i += 1) {
    holes.push({
      x: Math.round((320 - w) / 2),
      y: Math.round(top + i * (h + gap)),
      w,
      h: Math.round(h),
      r: layout.id === 'film' ? 1 : 4,
    });
  }
  return holes;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  photo: PhotoEntry,
  hole: Rect,
  transform: PhotoTransform,
): void {
  ctx.save();
  rr(ctx, hole.x, hole.y, hole.w, hole.h, hole.r ?? 0);
  ctx.clip();
  const base = Math.max(hole.w / photo.width, hole.h / photo.height);
  const scale = base * transform.scale;
  const dw = photo.width * scale;
  const dh = photo.height * scale;
  const cx = hole.x + hole.w / 2 + transform.dx;
  const cy = hole.y + hole.h / 2 + transform.dy;
  ctx.drawImage(photo.source, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, hole: Rect, index: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,41,61,0.07)';
  rr(ctx, hole.x, hole.y, hole.w, hole.h, hole.r ?? 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,41,61,0.45)';
  ctx.font = `700 13px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index + 1).padStart(2, '0'), hole.x + hole.w / 2, hole.y + hole.h / 2);
  ctx.restore();
}

function classicChrome(ctx: CanvasRenderingContext2D, opts: DrawOptions, holes: Rect[]): void {
  const { width, height } = stripSize(opts.layout, opts.photos.length);
  const ink = textOn(opts.color);
  ctx.fillStyle = opts.color;
  ctx.fillRect(0, 0, width, height);

  // Tiêu đề: chữ nhỏ, giãn rộng, đậm + dấu trái tim (R-129).
  const title = (opts.title || 'KỶ NIỆM').toUpperCase();
  ctx.save();
  ctx.fillStyle = ink;
  ctx.font = `700 10px ${SANS}`;
  ctx.textBaseline = 'middle';
  let size = 10;
  // Thu nhỏ nếu quá dài so với bề ngang dải.
  while (size > 7 && measureSpaced(ctx, title, 1.6) > width - CLASSIC_PAD * 2 - 16) {
    size -= 0.5;
    ctx.font = `700 ${size}px ${SANS}`;
  }
  drawSpaced(ctx, title, CLASSIC_PAD, CLASSIC_PAD + CLASSIC_HEAD / 2, 1.6, 'left');
  ctx.font = `700 11px ${SANS}`;
  ctx.textAlign = 'right';
  ctx.fillText('♥', width - CLASSIC_PAD, CLASSIC_PAD + CLASSIC_HEAD / 2 + 0.5);
  ctx.restore();

  // Vạch ngăn mảnh giữa các ô.
  ctx.save();
  ctx.strokeStyle = ink === '#FFFFFF' ? 'rgba(255,255,255,0.28)' : 'rgba(0,41,61,0.14)';
  ctx.lineWidth = 0.7;
  for (let i = 1; i < holes.length; i += 1) {
    const y = holes[i].y - 4;
    ctx.beginPath();
    ctx.moveTo(CLASSIC_PAD, y);
    ctx.lineTo(width - CLASSIC_PAD, y);
    ctx.stroke();
  }
  ctx.restore();
}

function classicLabels(
  ctx: CanvasRenderingContext2D,
  opts: DrawOptions,
  holes: Rect[],
): void {
  const { width, height } = stripSize(opts.layout, opts.photos.length);
  const ink = textOn(opts.color);
  const total = String(Math.max(1, opts.photos.length)).padStart(2, '0');
  ctx.save();
  ctx.fillStyle = ink;
  ctx.font = `400 9px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  holes.forEach((hole, i) => {
    ctx.fillText(`${String(i + 1).padStart(2, '0')} / ${total}`, hole.x + hole.w, hole.y + hole.h + 10);
  });

  // Chân dải: 5 chấm (giữa lớn nhất) + tên sản phẩm + ngày.
  const footTop = height - CLASSIC_FOOT - CLASSIC_PAD + 6;
  const cx = width / 2;
  const radii = [1.6, 2.6, 3.6, 2.6, 1.6];
  let dotX = cx - 18;
  ctx.fillStyle = ink;
  radii.forEach((r) => {
    ctx.beginPath();
    ctx.arc(dotX, footTop + 5, r, 0, Math.PI * 2);
    ctx.fill();
    dotX += r * 2 + 5;
  });
  ctx.font = `700 7px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (opts.dateLabel) {
    ctx.fillText(
      `HÀNH TRÌNH · ${opts.dateLabel}`.toUpperCase(),
      cx,
      footTop + 18,
    );
  } else {
    ctx.fillText('HÀNH TRÌNH', cx, footTop + 18);
  }
  ctx.restore();
}

function measureSpaced(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  const chars = Array.from(text);
  const base = chars.reduce((sum, c) => sum + ctx.measureText(c).width, 0);
  return base + Math.max(0, chars.length - 1) * spacing;
}

function frameChrome(
  ctx: CanvasRenderingContext2D,
  opts: DrawOptions,
  holes: Rect[],
): void {
  const { width, height } = stripSize(opts.layout, opts.photos.length);
  const ink = textOn(opts.color);
  ctx.fillStyle = opts.color;
  ctx.fillRect(0, 0, width, height);
  const title = (opts.title || 'KỶ NIỆM').toUpperCase();

  if (opts.layout.id === 'ticket') {
    // Vé máy bay: đầu vé có mã chuyến, chân vé có vạch xé + mã vạch.
    ctx.save();
    ctx.fillStyle = '#F11F4C';
    ctx.fillRect(0, 0, width, 6);
    ctx.fillStyle = '#00293D';
    ctx.font = `700 12px ${SANS}`;
    ctx.textBaseline = 'middle';
    drawSpaced(ctx, 'VÉ HÀNH TRÌNH', 18, 26, 1.8, 'left');
    ctx.font = `400 8px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText('HÀNH TRÌNH AIR', width - 18, 26);
    ctx.textAlign = 'left';
    ctx.font = `700 15px ${SANS}`;
    ctx.fillText(fit(ctx, title, width - 36, `700 15px ${SANS}`), 18, 48);

    // Vạch xé dọc hai bên + lỗ bấm.
    ctx.strokeStyle = 'rgba(0,41,61,0.22)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(16, 60);
    ctx.lineTo(16, height - 24);
    ctx.moveTo(width - 16, 60);
    ctx.lineTo(width - 16, height - 24);
    ctx.stroke();
    ctx.setLineDash([]);

    // Con dấu tròn mờ ở góc dưới phải, đè lên mép ảnh cuối cho giống vé đã dùng.
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#F11F4C';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(width - 52, height - 44, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#00293D';
    ctx.font = `400 7px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('BOARDED', width - 52, height - 48);
    ctx.fillText('★', width - 52, height - 38);
    ctx.restore();
  }

  if (opts.layout.id === 'postcard') {
    ctx.save();
    ctx.fillStyle = '#00293D';
    ctx.font = `700 11px ${SANS}`;
    ctx.textBaseline = 'middle';
    drawSpaced(ctx, 'BƯU THIẾP', 14, 28, 2, 'left');
    ctx.font = `400 8px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText('POST · 2026', width - 18, 28);
    ctx.textAlign = 'left';
    ctx.font = `700 15px ${SANS}`;
    ctx.fillText(fit(ctx, title, width - 130, `700 15px ${SANS}`), 18, 50);

    // Tem bưu chính góc trên phải, viền răng cưa đơn giản.
    const stamp = { x: width - 62, y: 40, w: 34, h: 26 };
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(stamp.x, stamp.y, stamp.w, stamp.h);
    ctx.strokeStyle = '#F11F4C';
    ctx.lineWidth = 1;
    ctx.strokeRect(stamp.x + 2.5, stamp.y + 2.5, stamp.w - 5, stamp.h - 5);
    ctx.fillStyle = '#F11F4C';
    ctx.font = `700 7px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('VIỆT NAM', stamp.x + stamp.w / 2, stamp.y + stamp.h / 2);

    // Keo dán 4 góc mỗi ảnh.
    holes.forEach((hole) => {
      ctx.fillStyle = 'rgba(255,242,229,0.9)';
      const tape = 9;
      const corners: Array<[number, number]> = [
        [hole.x - tape / 2, hole.y - tape / 2],
        [hole.x + hole.w - tape / 2, hole.y - tape / 2],
        [hole.x - tape / 2, hole.y + hole.h - tape / 2],
        [hole.x + hole.w - tape / 2, hole.y + hole.h - tape / 2],
      ];
      corners.forEach(([tx, ty]) => {
        ctx.save();
        ctx.translate(tx + tape / 2, ty + tape / 2);
        ctx.rotate(-0.18);
        ctx.fillRect(-tape / 2, -tape / 3.4, tape, tape / 1.7);
        ctx.restore();
      });
    });

    ctx.fillStyle = '#00293D';
    ctx.font = `400 8px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('CHÚC MỘT CHUYẾN ĐI VUI', width / 2, height - 58);

    // Ba dòng kẻ địa chỉ ở chân bưu thiếp (chủ đề du lịch, không chép khung nào).
    ctx.strokeStyle = 'rgba(0,41,61,0.35)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 3; i += 1) {
      const y = height - 40 + i * 9;
      ctx.beginPath();
      ctx.moveTo(26, y);
      ctx.lineTo(width - 26, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (opts.layout.id === 'film') {
    // Phim cuộn: nền mực, lỗ nhựa hai bên, mã kiểu DX.
    ctx.save();
    ctx.fillStyle = '#001B28';
    const holeW = 12;
    for (let y = 12; y < height - 12; y += 22) {
      rr(ctx, 5, y, holeW, 13, 2);
      ctx.fill();
      rr(ctx, width - holeW - 5, y, holeW, 13, 2);
      ctx.fill();
    }
    ctx.fillStyle = '#FFF2E5';
    ctx.font = `700 10px ${SANS}`;
    ctx.textBaseline = 'middle';
    drawSpaced(ctx, 'PHIM 35MM · HÀNH TRÌNH', 24, 26, 1.4, 'left');
    ctx.fillStyle = '#F11F4C';
    ctx.font = `700 15px ${SANS}`;
    ctx.textAlign = 'right';
    ctx.fillText(fit(ctx, title, width - 48, `700 15px ${SANS}`), width - 24, 48);
    ctx.fillStyle = '#FFD9E1';
    ctx.font = `400 8px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('ISO 200 · 24 EXP', width / 2, height - 24);
    ctx.restore();
  }

  ctx.fillStyle = ink;
}

/** Vẽ ảnh vào ô (khung phủ lên ảnh sau khi vẽ nền + trang trí). */
export function drawStrip(ctx: CanvasRenderingContext2D, opts: DrawOptions): void {
  const holes = holesFor(opts.layout, Math.max(1, opts.photos.length));
  if (opts.layout.kind === 'classic') {
    classicChrome(ctx, opts, holes);
    holes.forEach((hole, i) => {
      const photo = opts.photos[i];
      if (photo) drawCover(ctx, photo, hole, opts.transforms[i] ?? { scale: 1, dx: 0, dy: 0 });
      else drawPlaceholder(ctx, hole, i);
    });
    classicLabels(ctx, opts, holes);
    return;
  }

  // Khung dựng sẵn: nền + ảnh, rồi khung phủ lên trên (R-130).
  frameChrome(ctx, opts, holes);
  holes.forEach((hole, i) => {
    const photo = opts.photos[i];
    if (photo) drawCover(ctx, photo, hole, opts.transforms[i] ?? { scale: 1, dx: 0, dy: 0 });
    else drawPlaceholder(ctx, hole, i);
    if (opts.layout.id === 'ticket') {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,41,61,0.25)';
      ctx.lineWidth = 0.8;
      rr(ctx, hole.x - 3, hole.y - 3, hole.w + 6, hole.h + 6, hole.r ?? 0 + 2);
      ctx.stroke();
      ctx.restore();
    }
  });
  // Lớp trang trí nằm trên ảnh: khung vé / tem bưu chính / lỗ phim đã vẽ ở nền,
  // riêng dải phim cần vẽ lại lỗ nhựa đè lên mép ảnh cho đúng "khung phủ lên ảnh".
  if (opts.layout.id === 'film') {
    ctx.save();
    ctx.fillStyle = '#001B28';
    const { width, height } = stripSize(opts.layout, opts.photos.length);
    const holeW = 12;
    for (let y = 12; y < height - 12; y += 22) {
      rr(ctx, 5, y, holeW, 13, 2);
      ctx.fill();
      rr(ctx, width - holeW - 5, y, holeW, 13, 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string): string {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

/** Vẽ dải ra canvas mới ở tỉ lệ cho trước (1 = hiển thị, 2 = xuất PNG). */
export function renderStripToCanvas(opts: DrawOptions, scale: number): HTMLCanvasElement {
  const { width, height } = stripSize(opts.layout, Math.max(1, opts.photos.length));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không tạo được canvas 2D.');
  ctx.scale(scale, scale);
  drawStrip(ctx, opts);
  return canvas;
}

export const DEFAULT_COLOR = PALETTE[0].hex;
