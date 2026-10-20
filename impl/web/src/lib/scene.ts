/**
 * Ảnh mẫu tự sinh bằng code (AGENTS.md: không chép ảnh của sản phẩm khác).
 * Mỗi ảnh là một SVG vẽ tay: cảnh phong cảnh, avatar.
 * Dùng chung cho trang giới thiệu (ảnh thiên nhiên) và cho dữ liệu giả trong src/dev/.
 */

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SceneKind =
  | 'mountain'
  | 'sea'
  | 'city'
  | 'temple'
  | 'snow'
  | 'field'
  | 'forest'
  | 'desert'
  | 'lake'
  | 'town';

interface Palette {
  sky: [string, string];
  layers: string[];
  accent: string;
}

const PALETTES: Record<SceneKind, Palette> = {
  mountain: { sky: ['#4d92d6', '#dcefff'], layers: ['#5b8f63', '#3d6b4a', '#254733'], accent: '#ffd36e' },
  sea: { sky: ['#1f83bd', '#cdeeff'], layers: ['#126f98', '#0b5175', '#083c58'], accent: '#ffe9a8' },
  city: { sky: ['#f7a35c', '#6b4a91'], layers: ['#3d3050', '#261d38', '#151021'], accent: '#ffd27d' },
  temple: { sky: ['#ffd9a0', '#fff6df'], layers: ['#238f8f', '#157070', '#0f5454'], accent: '#ff8a5b' },
  snow: { sky: ['#7fb0d8', '#eef7ff'], layers: ['#d7e6f1', '#a9c3d6', '#7793ab'], accent: '#ffffff' },
  field: { sky: ['#69bcec', '#eaf8ff'], layers: ['#96cf72', '#63a64c', '#3f7c36'], accent: '#ffe08a' },
  forest: { sky: ['#93c98f', '#eef8e6'], layers: ['#356f42', '#24522f', '#153920'], accent: '#ffe08a' },
  desert: { sky: ['#f3c286', '#fdead0'], layers: ['#dda25c', '#bb7339', '#8d4f27'], accent: '#fff3c4' },
  lake: { sky: ['#9ec9e8', '#f0f9ff'], layers: ['#2b7fa8', '#1d5f80', '#134458'], accent: '#ffe9a8' },
  town: { sky: ['#ffcf8f', '#fdf0d8'], layers: ['#c98a52', '#a86a3d', '#84512d'], accent: '#fff0c2' },
};

function ridgePath(
  rng: () => number,
  w: number,
  h: number,
  baseY: number,
  amp: number,
  segments: number,
): string {
  const step = w / segments;
  const pts: string[] = [`M0 ${h}`, `L0 ${baseY.toFixed(1)}`];
  let prevY = baseY;
  for (let i = 1; i <= segments; i += 1) {
    const x = i * step;
    const target = baseY - rng() * amp - Math.abs(Math.sin(i * 1.3)) * amp * 0.35;
    const y = Math.min(baseY, Math.max(prevY + (target - prevY) * 0.8, baseY - amp * 1.6));
    prevY = y;
    pts.push(`L${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  pts.push(`L${w} ${h}`, 'Z');
  return pts.join(' ');
}

function clouds(rng: () => number, w: number, h: number, count: number, color = '#ffffff'): string {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const cx = rng() * w;
    const cy = h * (0.08 + rng() * 0.3);
    const r = h * (0.03 + rng() * 0.05);
    out += `<g fill="${color}" opacity="0.55"><ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${(r * 2.4).toFixed(0)}" ry="${r.toFixed(0)}"/><ellipse cx="${(cx + r * 1.6).toFixed(0)}" cy="${(cy + r * 0.3).toFixed(0)}" rx="${(r * 1.5).toFixed(0)}" ry="${(r * 0.75).toFixed(0)}"/></g>`;
  }
  return out;
}

function cityscape(rng: () => number, w: number, h: number, color: string, windows: string): string {
  let out = '';
  let x = -10;
  const base = h * 0.92;
  while (x < w + 10) {
    const bw = w * (0.04 + rng() * 0.07);
    const bh = h * (0.12 + rng() * 0.34);
    out += `<rect x="${x.toFixed(0)}" y="${(base - bh).toFixed(0)}" width="${bw.toFixed(0)}" height="${(bh + 20).toFixed(0)}" fill="${color}"/>`;
    if (windows) {
      const cols = Math.max(1, Math.floor(bw / (w * 0.018)));
      const rows = Math.max(1, Math.floor(bh / (h * 0.05)));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (rng() > 0.45) {
            out += `<rect x="${(x + 4 + c * bw * 0.22).toFixed(0)}" y="${(base - bh + 8 + r * bh * 0.2).toFixed(0)}" width="${(bw * 0.12).toFixed(0)}" height="${(bh * 0.06).toFixed(0)}" fill="${windows}" opacity="0.85"/>`;
          }
        }
      }
    }
    x += bw + w * 0.012;
  }
  return out;
}

function stiltHouses(rng: () => number, w: number, h: number, base: number): string {
  let out = '';
  const count = 4;
  for (let i = 0; i < count; i += 1) {
    const cx = w * (0.12 + i * 0.24 + rng() * 0.05);
    const cw = w * 0.14;
    const ch = h * 0.1;
    const y = base - h * (0.16 + rng() * 0.1);
    out += `<rect x="${(cx - cw / 2).toFixed(0)}" y="${y.toFixed(0)}" width="${cw.toFixed(0)}" height="${ch.toFixed(0)}" fill="#f6e7cf"/>`;
    out += `<path d="M${(cx - cw * 0.72).toFixed(0)} ${y.toFixed(0)} L${cx.toFixed(0)} ${(y - ch * 0.75).toFixed(0)} L${(cx + cw * 0.72).toFixed(0)} ${y.toFixed(0)} Z" fill="#b3542f"/>`;
    out += `<rect x="${(cx - cw * 0.18).toFixed(0)}" y="${(y + ch * 0.2).toFixed(0)}" width="${(cw * 0.36).toFixed(0)}" height="${(ch * 0.8).toFixed(0)}" fill="#8a6a4a"/>`;
    out += `<rect x="${(cx - cw * 0.3).toFixed(0)}" y="${(y - ch * 0.45).toFixed(0)}" width="${(cw * 0.2).toFixed(0)}" height="${(ch * 0.35).toFixed(0)}" fill="#7fb7c9"/>`;
  }
  return out;
}

function waterBands(rng: () => number, w: number, top: number, h: number, light: string): string {
  let out = '';
  for (let i = 0; i < 14; i += 1) {
    const y = top + (i / 14) * (h - top) + rng() * 6;
    const len = w * (0.06 + rng() * 0.3);
    const x = rng() * (w - len);
    out += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${len.toFixed(0)}" height="${(2 + rng() * 3).toFixed(0)}" rx="2" fill="${light}" opacity="0.35"/>`;
  }
  return out;
}

/** Sinh ảnh phong cảnh dạng SVG, trả về data URI. */
export function scenePhoto(seed: number, kind: SceneKind, w = 960, h = 1280, grain = false): string {
  const rng = mulberry32(seed * 2654435761);
  const p = PALETTES[kind];
  const sunX = w * (0.2 + rng() * 0.6);
  const sunY = h * (0.12 + rng() * 0.18);
  const sunR = h * 0.075;

  let body = '';
  const horizon = h * 0.62;

  if (kind === 'city' || kind === 'town') {
    body += cityscape(rng, w, h * 0.72, p.layers[0], p.accent);
    body += cityscape(rng, w, h * 0.78, p.layers[1], p.accent);
    body += cityscape(rng, w, h * 0.86, p.layers[2], p.accent);
    body += `<rect x="0" y="${(h * 0.86).toFixed(0)}" width="${w}" height="${(h * 0.14).toFixed(0)}" fill="${p.layers[2]}"/>`;
  } else if (kind === 'sea' || kind === 'lake') {
    body += `<rect x="0" y="${horizon.toFixed(0)}" width="${w}" height="${(h - horizon).toFixed(0)}" fill="${p.layers[0]}"/>`;
    body += `<rect x="0" y="${(horizon + (h - horizon) * 0.45).toFixed(0)}" width="${w}" height="${(h - horizon) * 0.55}" fill="${p.layers[1]}"/>`;
    body += waterBands(rng, w, horizon, h, '#ffffff');
  } else if (kind === 'temple') {
    body += `<rect x="0" y="${horizon.toFixed(0)}" width="${w}" height="${(h - horizon).toFixed(0)}" fill="${p.layers[0]}"/>`;
    body += stiltHouses(rng, w, h, horizon);
    body += waterBands(rng, w, horizon, h, '#ffffff');
  } else {
    body += `<path d="${ridgePath(rng, w, h, horizon + h * 0.04, h * 0.16, 6)}" fill="${p.layers[0]}"/>`;
    body += `<path d="${ridgePath(rng, w, h, horizon + h * 0.12, h * 0.14, 8)}" fill="${p.layers[1]}"/>`;
    body += `<path d="${ridgePath(rng, w, h, horizon + h * 0.2, h * 0.1, 11)}" fill="${p.layers[2]}"/>`;
    if (kind === 'field' || kind === 'forest') {
      for (let i = 0; i < 26; i += 1) {
        const tx = rng() * w;
        const ty = h * (0.72 + rng() * 0.26);
        const th = h * (0.03 + rng() * 0.05);
        body += `<path d="M${tx.toFixed(0)} ${ty.toFixed(0)} l${(-th * 0.42).toFixed(1)} ${th.toFixed(1)} h${(th * 0.84).toFixed(1)} Z" fill="${p.layers[2]}"/>`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient>
<radialGradient id="g"><stop offset="0" stop-color="${p.accent}" stop-opacity="1"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/></radialGradient>
${
  grain
    ? '<filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>'
    : ''
}</defs>
<rect width="${w}" height="${h}" fill="url(#s)"/>
<circle cx="${sunX.toFixed(0)}" cy="${sunY.toFixed(0)}" r="${(sunR * 3).toFixed(0)}" fill="url(#g)"/>
<circle cx="${sunX.toFixed(0)}" cy="${sunY.toFixed(0)}" r="${sunR.toFixed(0)}" fill="${p.accent}" opacity="0.92"/>
${clouds(rng, w, h, kind === 'desert' ? 1 : 3)}
${body}
${
  grain
    ? `<rect width="${w}" height="${h}" filter="url(#n)" opacity="0.07" style="mix-blend-mode:overlay"/>`
    : ''
}
</svg>`;
  return svgDataUri(svg);
}

/** Avatar vòng tròn với chữ cái đầu. */
export function avatarImage(displayName: string, seed = 1): string {
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const rng = mulberry32(seed * 97 + 13);
  const hue = Math.floor(rng() * 360);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 58% 46%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 62% 34%)"/></linearGradient></defs>
<rect width="160" height="160" fill="url(#a)"/>
<text x="80" y="80" dy="0.36em" font-family="Plus Jakarta Sans, sans-serif" font-size="62" font-weight="700" fill="#ffffff" text-anchor="middle">${initials}</text>
</svg>`;
  return svgDataUri(svg);
}
