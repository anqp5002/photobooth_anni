/**
 * Nhận dạng tệp tải lên bằng "chữ ký" nhị phân, không tin đuôi tệp
 * (B-01: chỉ nhận JPEG, PNG, HEIC, WebP, MP4, MOV).
 */

const HEIF_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']);
const MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'avc1',
  'dash',
  'M4V ',
  'mmp4',
  'MSNV',
]);
const MOV_BRANDS = new Set(['qt  ', 'moov']);

const ascii = (buf, start, end) => buf.subarray(start, end).toString('latin1');

/**
 * @param {Buffer} buffer
 * @returns {{kind: 'photo'|'video', ext: string, mime: string}|null}
 */
export function detectMediaType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  const b = buffer;

  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { kind: 'photo', ext: 'jpg', mime: 'image/jpeg' };
  }
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return { kind: 'photo', ext: 'png', mime: 'image/png' };
  }
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') {
    return { kind: 'photo', ext: 'webp', mime: 'image/webp' };
  }
  if (ascii(b, 4, 8) === 'ftyp') {
    const brand = ascii(b, 8, 12);
    if (HEIF_BRANDS.has(brand)) {
      return { kind: 'photo', ext: 'heic', mime: 'image/heic' };
    }
    if (MOV_BRANDS.has(brand)) {
      return { kind: 'video', ext: 'mov', mime: 'video/quicktime' };
    }
    if (MP4_BRANDS.has(brand)) {
      return { kind: 'video', ext: 'mp4', mime: 'video/mp4' };
    }
    // Một số máy quay ghi brand lạ nhưng vẫn là MP4: nhận nếu có "ftyp".
    return { kind: 'video', ext: 'mp4', mime: 'video/mp4' };
  }
  return null;
}

/** Kích thước khung hình thật của PNG (IHDR) — dùng khi sharp không đọc được. */
export function pngSize(buffer) {
  if (ascii(buffer, 12, 16) !== 'IHDR') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

/**
 * Đọc thời lượng video từ hộp `mvhd` của MP4/MOV. Không cần ffmpeg.
 * @returns {number|null} giây
 */
export function readMp4Duration(buffer) {
  if (!buffer || buffer.length < 32) return null;
  const limit = buffer.length;
  const moov = findBox(buffer, 0, limit, 'moov');
  if (!moov) return null;
  const mvhd = findBox(buffer, moov.start, moov.end, 'mvhd');
  if (!mvhd) return null;
  const version = buffer[mvhd.start];
  if (version === 1) {
    if (mvhd.start + 32 > buffer.length) return null;
    const timescale = buffer.readUInt32BE(mvhd.start + 20);
    const duration = Number(buffer.readBigUInt64BE(mvhd.start + 24));
    if (!timescale) return null;
    return duration / timescale;
  }
  if (mvhd.start + 20 > buffer.length) return null;
  const timescale = buffer.readUInt32BE(mvhd.start + 12);
  const duration = buffer.readUInt32BE(mvhd.start + 16);
  if (!timescale) return null;
  return duration / timescale;
}

/**
 * Đọc thời gian tạo video từ `mvhd` (giây kể từ 1904-01-01). Không có → null.
 */
export function readMp4CreationTime(buffer) {
  if (!buffer || buffer.length < 32) return null;
  const moov = findBox(buffer, 0, buffer.length, 'moov');
  if (!moov) return null;
  const mvhd = findBox(buffer, moov.start, moov.end, 'mvhd');
  if (!mvhd) return null;
  const version = buffer[mvhd.start];
  let seconds;
  if (version === 1) {
    if (mvhd.start + 12 > buffer.length) return null;
    seconds = Number(buffer.readBigUInt64BE(mvhd.start + 4));
  } else {
    if (mvhd.start + 8 > buffer.length) return null;
    seconds = buffer.readUInt32BE(mvhd.start + 4);
  }
  if (!seconds || seconds < 86400) return null;
  const epoch1904 = Date.UTC(1904, 0, 1);
  const ms = epoch1904 + seconds * 1000;
  if (!Number.isFinite(ms) || ms < Date.UTC(1990, 0, 1)) return null;
  return new Date(ms).toISOString();
}

/**
 * Kích thước khung hình video từ hộp `tkhd` (16.16 fixed point).
 * @returns {{width:number,height:number}|null}
 */
export function readMp4VideoSize(buffer) {
  if (!buffer || buffer.length < 32) return null;
  const moov = findBox(buffer, 0, buffer.length, 'moov');
  if (!moov) return null;
  const trak = findBox(buffer, moov.start, moov.end, 'trak');
  if (!trak) return null;
  const tkhd = findBox(buffer, trak.start, trak.end, 'tkhd');
  if (!tkhd) return null;
  const offset = buffer[tkhd.start] === 1 ? 88 : 76;
  if (tkhd.start + offset + 8 > buffer.length) return null;
  const width = buffer.readUInt32BE(tkhd.start + offset) / 65536;
  const height = buffer.readUInt32BE(tkhd.start + offset + 4) / 65536;
  if (!(width > 0) || !(height > 0)) return null;
  return { width: Math.round(width), height: Math.round(height) };
}

function findBox(buffer, offset, end, name) {
  let pos = offset;
  while (pos + 8 <= end) {
    let size = buffer.readUInt32BE(pos);
    const type = buffer.subarray(pos + 4, pos + 8).toString('latin1');
    let header = 8;
    if (size === 1) {
      if (pos + 16 > end) return null;
      size = Number(buffer.readBigUInt64BE(pos + 8));
      header = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < header || pos + size > end) return null;
    if (type === name) {
      return { start: pos + header, end: pos + size };
    }
    pos += size;
  }
  return null;
}
