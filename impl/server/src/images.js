import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/** Ảnh lớn: cạnh dài ≤ 1280; ảnh nhỏ: ≤ 400 (R-041, hợp đồng API). */
export const LG_MAX = 1280;
export const SM_MAX = 400;

const POSTER_BG = '#0b2230';

function placeholderSvg({ label = '', width = 1280, height = 720, video = false } = {}) {
  const play = video
    ? `<circle cx="${width / 2}" cy="${height / 2}" r="${Math.round(height * 0.11)}" fill="#ffffff" opacity="0.92"/>
       <path d="M ${width / 2 - height * 0.04} ${height / 2 - height * 0.06} L ${width / 2 + height * 0.07} ${height / 2} L ${width / 2 - height * 0.04} ${height / 2 + height * 0.06} Z" fill="${POSTER_BG}"/>`
    : `<rect x="${width * 0.34}" y="${height * 0.42}" width="${width * 0.32}" height="${height * 0.16}" rx="${height * 0.03}" fill="#ffffff" opacity="0.16"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0b2230"/><stop offset="0.55" stop-color="#124055"/><stop offset="1" stop-color="#0a1a26"/>
      </linearGradient></defs>
      <rect width="${width}" height="${height}" fill="url(#g)"/>
      ${play}
      <text x="${width / 2}" y="${height * 0.78}" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(height * 0.045)}" fill="#b8c1cc" letter-spacing="4">${label}</text>
    </svg>`,
  );
}

async function resizeToJpeg(input, maxEdge, outPath) {
  await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toFile(outPath);
}

/**
 * Ghi ảnh gốc + bản lớn + bản nhỏ vào `<mediaDir>/<code>/`.
 * @returns {Promise<{width:number|null,height:number|null,fallback:boolean}>}
 */
export async function storePhotoRenditions({ buffer, dir, ext, width, height }) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `orig.${ext}`), buffer);
  try {
    await resizeToJpeg(buffer, LG_MAX, path.join(dir, 'lg.jpg'));
    await resizeToJpeg(buffer, SM_MAX, path.join(dir, 'sm.jpg'));
  } catch (err) {
    // HEIC của một số máy không giải mã được bằng libvips: vẫn giữ tệp gốc,
    // dùng ảnh giữ chỗ để giao diện không vỡ.
    const w = width || 1200;
    const h = height || 900;
    const svg = placeholderSvg({ label: 'HEIC', width: 1200, height: 900, video: false });
    await sharp(svg).jpeg({ quality: 80 }).toFile(path.join(dir, 'lg.jpg'));
    await resizeToJpeg(path.join(dir, 'lg.jpg'), SM_MAX, path.join(dir, 'sm.jpg'));
    return { width: w, height: h, fallback: true, error: err.message };
  }
  return { width, height, fallback: false };
}

/** Video: giữ nguyên tệp gốc, sinh ảnh bìa tự vẽ (không có ffmpeg trong ngăn xếp). */
export async function storeVideoRenditions({ buffer, dir, ext }) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `orig.${ext}`), buffer);
  const svg = placeholderSvg({ label: 'VIDEO', video: true });
  await sharp(svg).jpeg({ quality: 82 }).toFile(path.join(dir, 'lg.jpg'));
  await resizeToJpeg(path.join(dir, 'lg.jpg'), SM_MAX, path.join(dir, 'sm.jpg'));
}

/** Kích thước ảnh (sau khi xoay theo EXIF). */
export async function probeImageSize(buffer) {
  try {
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    return { width: meta.width ?? null, height: meta.height ?? null, orientation: meta.orientation ?? 1 };
  } catch {
    return { width: null, height: null, orientation: 1 };
  }
}
