/** Tiện ích nhỏ: tạo DOM, vẽ, màu, tên tệp. */

type Attrs = Record<string, string | number | boolean | undefined>;

/** Tạo phần tử với thuộc tính + con. `text` đặt textContent (an toàn với chuỗi người dùng). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'text') {
      node.textContent = String(value);
    } else if (key === 'class') {
      node.className = String(value);
    } else if (key === 'value') {
      (node as HTMLInputElement).value = String(value);
    } else {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/** Bo góc, có đường lui cho trình duyệt chưa có ctx.roundRect. */
export function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

/** Vẽ chữ có giãn chữ (letter-spacing) — canvas cũ chưa hỗ trợ ctx.letterSpacing. */
export function drawSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  baseline: number,
  spacing: number,
  align: 'left' | 'center' | 'right' = 'left',
): void {
  const chars = Array.from(text);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total =
    widths.reduce((sum, w) => sum + w, 0) + Math.max(0, chars.length - 1) * spacing;
  let cursor = x;
  if (align === 'center') cursor = x - total / 2;
  if (align === 'right') cursor = x - total;
  const previous = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((char, i) => {
    ctx.fillText(char, cursor, baseline);
    cursor += widths[i] + spacing;
  });
  ctx.textAlign = previous;
}

/** Thu gọn tiêu đề thành tên tệp: thường, bỏ dấu, khoảng trắng → gạch nối. */
export function slugifyTitle(raw: string): string {
  const base = (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'dai-anh';
}

function channel(hex: string, i: number): number {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
}

/** Độ chói tương đối theo WCAG. */
export function luminance(hex: string): number {
  const [r, g, b] = [channel(hex, 0), channel(hex, 1), channel(hex, 2)].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export const INK = '#00293D';
export const PAPER = '#FFFFFF';

/** Chọn trắng hay mực cho chữ trên nền màu (theo tương phản, không theo cảm tính). */
export function textOn(bg: string): string {
  return contrast(bg, PAPER) >= contrast(bg, INK) ? PAPER : INK;
}

/** 8 màu dải (R-112). */
export const PALETTE: Array<{ id: string; hex: string; label: string }> = [
  { id: 'white', hex: '#FFFFFF', label: 'Trắng' },
  { id: 'cream', hex: '#FFF2E5', label: 'Kem' },
  { id: 'blush', hex: '#FFD9E1', label: 'Hồng nhạt' },
  { id: 'pink', hex: '#F11F4C', label: 'Đỏ hồng' },
  { id: 'blue', hex: '#0099E5', label: 'Xanh lam' },
  { id: 'mint', hex: '#DFF1EA', label: 'Bạc hà' },
  { id: 'ink', hex: '#00293D', label: 'Xanh mực' },
  { id: 'gray', hex: '#E7EAEE', label: 'Xám' },
];

export const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
export const SANS =
  '"Plus Jakarta Sans", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

/** Kẹp số. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Chờ, có thể huỷ bằng AbortSignal. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    const id = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      window.clearTimeout(id);
      reject(new DOMException('aborted', 'AbortError'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
