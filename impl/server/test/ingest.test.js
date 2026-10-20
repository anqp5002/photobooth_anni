process.env.TZ = 'UTC';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { ingestFile } from '../src/ingest.js';
import { analyzeImage, BLUR_VARIANCE_THRESHOLD } from '../src/ai.js';
import { detectMediaType } from '../src/media-type.js';

const stamp = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}:${p(d.getUTCMonth() + 1)}:${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(
    d.getUTCMinutes(),
  )}:${p(d.getUTCSeconds())}`;
};

const dms = (value) => {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const min = Math.floor((abs - deg) * 60);
  const sec = Math.round((((abs - deg) * 60 - min) * 60) * 100);
  return `${deg}/1 ${min}/1 ${sec}/100`;
};

async function photo({ width = 1200, height = 900, lat = 11.9404, lon = 108.4583, iso = '2026-08-01T02:00:00Z', hue = 210 } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="hsl(${hue},60%,50%)"/>
    <circle cx="${width * 0.35}" cy="${height * 0.3}" r="${height * 0.2}" fill="#fff" opacity="0.85"/>
    <path d="M0 ${height} L${width * 0.3} ${height * 0.55} L${width * 0.6} ${height} Z" fill="#243b2e"/>
    <text x="40" y="${height - 50}" font-size="60" fill="#fff">ảnh mẫu</text>
  </svg>`;
  return sharp(Buffer.from(svg))
    .jpeg({ quality: 85 })
    .withMetadata({
      exif: {
        IFD0: { Make: 'Hanh Trinh', DateTime: stamp(iso) },
        IFD2: { DateTimeOriginal: stamp(iso) },
        IFD3: {
          GPSLatitudeRef: 'N',
          GPSLatitude: dms(lat),
          GPSLongitudeRef: 'E',
          GPSLongitude: dms(lon),
        },
      },
    })
    .toBuffer();
}

function minimalMp4() {
  const ftyp = Buffer.alloc(16);
  ftyp.writeUInt32BE(16, 0);
  ftyp.write('ftyp', 4, 'latin1');
  ftyp.write('isom', 8, 'latin1');
  const mvhdContent = Buffer.alloc(20);
  mvhdContent.writeUInt32BE(1000, 12);
  mvhdContent.writeUInt32BE(4200, 16);
  const mvhd = Buffer.concat([Buffer.alloc(8), mvhdContent]);
  mvhd.writeUInt32BE(mvhd.length, 0);
  mvhd.write('mvhd', 4, 'latin1');

  const tkhdContent = Buffer.alloc(84);
  tkhdContent.writeUInt32BE(1920 * 65536, 76);
  tkhdContent.writeUInt32BE(1080 * 65536, 80);
  const tkhd = Buffer.concat([Buffer.alloc(8), tkhdContent]);
  tkhd.writeUInt32BE(tkhd.length, 0);
  tkhd.write('tkhd', 4, 'latin1');
  const trak = Buffer.concat([Buffer.alloc(8), tkhd]);
  trak.writeUInt32BE(trak.length, 0);
  trak.write('trak', 4, 'latin1');

  const moov = Buffer.concat([Buffer.alloc(8), mvhd, trak]);
  moov.writeUInt32BE(moov.length, 0);
  moov.write('moov', 4, 'latin1');
  const mdat = Buffer.concat([Buffer.alloc(8), Buffer.alloc(64, 7)]);
  mdat.writeUInt32BE(mdat.length, 0);
  mdat.write('mdat', 4, 'latin1');
  return Buffer.concat([ftyp, moov, mdat]);
}

test('tải ảnh JPEG: đọc EXIF, sinh orig/lg/sm đúng kích thước', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-ingest-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  const buffer = await photo();
  const result = await ingestFile({ buffer, filename: 'dalat.jpg', mediaDir: dir });
  assert.equal(result.ok, true, JSON.stringify(result));
  const media = result.media;
  assert.equal(media.type, 'photo');
  assert.equal(media.ext, 'jpg');
  assert.equal(media.width, 1200);
  assert.equal(media.height, 900);
  assert.ok(media.takenAt?.startsWith('2026-08-01T02:00:00'), media.takenAt);
  assert.ok(Math.abs(media.lat - 11.9404) < 0.01, String(media.lat));
  assert.ok(Math.abs(media.lon - 108.4583) < 0.01, String(media.lon));

  const code = media.code;
  assert.ok((await fs.stat(path.join(dir, code, 'orig.jpg'))).size > 0);
  const lg = await sharp(path.join(dir, code, 'lg.jpg')).metadata();
  const sm = await sharp(path.join(dir, code, 'sm.jpg')).metadata();
  assert.ok(Math.max(lg.width, lg.height) <= 1280);
  assert.ok(Math.max(sm.width, sm.height) <= 400);
  assert.equal(lg.width, 1200);
});

test('ảnh lớn 3000x2000: cạnh dài ảnh lớn ≤ 1280, ảnh nhỏ ≤ 400', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-ingest-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const result = await ingestFile({
    buffer: await photo({ width: 3000, height: 2000, hue: 40 }),
    filename: 'to.jpg',
    mediaDir: dir,
  });
  assert.equal(result.ok, true);
  const lg = await sharp(path.join(dir, result.media.code, 'lg.jpg')).metadata();
  const sm = await sharp(path.join(dir, result.media.code, 'sm.jpg')).metadata();
  assert.equal(Math.max(lg.width, lg.height), 1280);
  assert.ok(Math.max(sm.width, sm.height) <= 400);
  assert.equal(result.media.width, 3000);
});

test('B-01: tệp .txt bị từ chối với lý do "không phải ảnh/video"', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-ingest-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const result = await ingestFile({
    buffer: Buffer.from('ghi chú chuyến đi'),
    filename: 'ghichu.txt',
    mediaDir: dir,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'không phải ảnh/video');
});

test('video MP4: nhận, đọc thời lượng, sinh ảnh bìa', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-ingest-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const buffer = minimalMp4();
  assert.equal(detectMediaType(buffer).kind, 'video');
  const result = await ingestFile({ buffer, filename: 'clip.mp4', mediaDir: dir });
  assert.equal(result.ok, true);
  assert.equal(result.media.type, 'video');
  assert.equal(result.media.duration, 4.2);
  assert.equal(result.media.width, 1920);
  assert.equal(result.media.height, 1080);
  assert.ok((await fs.stat(path.join(dir, result.media.code, 'orig.mp4'))).size > 0);
  assert.ok((await fs.stat(path.join(dir, result.media.code, 'sm.jpg'))).size > 0);
});

test('B-03: ảnh nét có phương sai Laplacian trên ngưỡng, ảnh làm mờ thì dưới', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-blur-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const sharpBuf = await photo({ hue: 120 });
  const blurred = await sharp(sharpBuf).blur(10).jpeg({ quality: 85 }).toBuffer();
  await fs.writeFile(path.join(dir, 'sharp.jpg'), sharpBuf);
  await fs.writeFile(path.join(dir, 'blur.jpg'), blurred);

  const a = await analyzeImage(path.join(dir, 'sharp.jpg'));
  const b = await analyzeImage(path.join(dir, 'blur.jpg'));
  assert.ok(a.blurVariance > BLUR_VARIANCE_THRESHOLD, `nét=${a.blurVariance}`);
  assert.ok(b.blurVariance < BLUR_VARIANCE_THRESHOLD, `mờ=${b.blurVariance}`);
});

test('nhận PNG và WebP (B-01)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-ingest-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const source = await photo({ width: 800, height: 600, hue: 300 });
  const png = await sharp(source).png().toBuffer();
  const webp = await sharp(source).webp().toBuffer();

  const a = await ingestFile({ buffer: png, filename: 'a.png', mediaDir: dir });
  assert.equal(a.ok, true);
  assert.equal(a.media.ext, 'png');
  const b = await ingestFile({ buffer: webp, filename: 'b.webp', mediaDir: dir });
  assert.equal(b.ok, true);
  assert.equal(b.media.ext, 'webp');
  assert.ok((await fs.stat(path.join(dir, b.media.code, 'lg.jpg'))).size > 0);
});

test('HEIC không giải mã được vẫn nhận: giữ tệp gốc + ảnh giữ chỗ', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-ingest-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  // Chỉ có phần đầu hợp lệ của hộp ftyp; libvips không giải mã được.
  const heic = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic'), Buffer.alloc(64, 1)]);
  assert.equal(detectMediaType(heic).ext, 'heic');
  const result = await ingestFile({ buffer: heic, filename: 'anh.heic', mediaDir: dir });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.media.ext, 'heic');
  assert.ok((await fs.stat(path.join(dir, result.media.code, 'orig.heic'))).size > 0);
  const lg = await sharp(path.join(dir, result.media.code, 'lg.jpg')).metadata();
  assert.ok(lg.width > 0 && lg.height > 0);
});
