import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMedia, inferVehicle } from '../src/cluster.js';
import { decodePolyline, encodePolyline } from '../src/polyline.js';
import { createGeoIndex, normalizePlaceName } from '../src/geo.js';
import {
  calendarDays,
  distanceKm,
  partOfDay,
  round2,
  slugify,
  timeInTimezone,
} from '../src/util.js';
import { detectMediaType, readMp4Duration } from '../src/media-type.js';
import { dhashFromGray, dhashToHex, hammingHex, variance } from '../src/ai.js';

const DALAT = { lat: 11.9404, lon: 108.4583 };
const NHATRANG = { lat: 12.2388, lon: 109.1967 };

test('B-02: 3 ảnh Đà Lạt sáng 1/8, 2 chiều 2/8, 1 Nha Trang 3/8 → 3 chặng đúng thứ tự', () => {
  const media = [
    { id: 1, takenAt: '2026-08-01T02:00:00Z', ...DALAT },
    { id: 2, takenAt: '2026-08-01T02:30:00Z', ...DALAT },
    { id: 3, takenAt: '2026-08-01T03:00:00Z', ...DALAT },
    { id: 4, takenAt: '2026-08-02T06:00:00Z', ...DALAT },
    { id: 5, takenAt: '2026-08-02T06:20:00Z', ...DALAT },
    { id: 6, takenAt: '2026-08-03T02:00:00Z', ...NHATRANG },
  ];
  const { groups, unsorted } = groupMedia(media);
  assert.equal(groups.length, 3);
  assert.deepEqual(unsorted, []);
  assert.deepEqual(groups.map((g) => g.mediaIds), [[1, 2, 3], [4, 5], [6]]);
  assert.deepEqual(
    groups.map((g) => g.startedAt),
    ['2026-08-01T02:00:00.000Z', '2026-08-02T06:00:00.000Z', '2026-08-03T02:00:00.000Z'],
  );
});

test('B-02: cách nhau quá 3 giờ thì tách chặng', () => {
  const media = [
    { id: 1, takenAt: '2026-08-01T02:00:00Z', ...DALAT },
    { id: 2, takenAt: '2026-08-01T05:00:01Z', ...DALAT },
  ];
  assert.equal(groupMedia(media).groups.length, 2);
});

test('B-02: cách nhau quá 5 km thì tách chặng dù cùng giờ', () => {
  const media = [
    { id: 1, takenAt: '2026-08-01T02:00:00Z', ...DALAT },
    { id: 2, takenAt: '2026-08-01T02:10:00Z', lat: DALAT.lat + 0.06, lon: DALAT.lon },
  ];
  assert.equal(groupMedia(media).groups.length, 2);
});

test('B-02: ảnh không GPS gán vào chặng gần nhất theo thời gian', () => {
  const media = [
    { id: 1, takenAt: '2026-08-01T02:00:00Z', ...DALAT },
    { id: 2, takenAt: '2026-08-01T02:30:00Z', lat: null, lon: null },
    { id: 3, takenAt: '2026-08-03T02:00:00Z', ...NHATRANG },
    { id: 4, takenAt: '2026-08-03T02:10:00Z', lat: null, lon: null },
  ];
  const { groups } = groupMedia(media);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].mediaIds, [1, 2]);
  assert.deepEqual(groups[1].mediaIds, [3, 4]);
});

test('B-02: ảnh không có cả thời gian lẫn GPS vào "chưa xếp"', () => {
  const media = [
    { id: 1, takenAt: '2026-08-01T02:00:00Z', ...DALAT },
    { id: 2, takenAt: null, lat: null, lon: null },
  ];
  const { groups, unsorted } = groupMedia(media);
  assert.equal(groups.length, 1);
  assert.deepEqual(unsorted, [2]);
});

test('B-02: ảnh có GPS nhưng không có thời gian gán theo khoảng cách', () => {
  const media = [
    { id: 1, takenAt: '2026-08-01T02:00:00Z', ...DALAT },
    { id: 2, takenAt: null, lat: DALAT.lat + 0.001, lon: DALAT.lon },
  ];
  const { groups, unsorted } = groupMedia(media);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].mediaIds, [1, 2]);
  assert.deepEqual(unsorted, []);
});

test('inferVehicle: bay xa → plane, đi bộ gần → none', () => {
  assert.equal(inferVehicle(900, 2), 'plane');
  assert.equal(inferVehicle(0.4, 0.2), 'none');
  assert.equal(inferVehicle(30, 1), 'motorbike');
});

test('polyline mã hoá/giải mã giữ nguyên toạ độ (độ chính xác 5)', () => {
  const points = [DALAT, NHATRANG, { lat: 21.0285, lon: 105.8542 }];
  const encoded = encodePolyline(points);
  const decoded = decodePolyline(encoded);
  assert.equal(decoded.length, 3);
  for (let i = 0; i < points.length; i += 1) {
    assert.ok(Math.abs(decoded[i].lat - points[i].lat) < 1e-5);
    assert.ok(Math.abs(decoded[i].lon - points[i].lon) < 1e-5);
  }
  assert.equal(encodePolyline([{ lat: 38.5, lon: -120.2 }, { lat: 40.7, lon: -120.95 }]), '_p~iF~ps|U_ulLnnqC');
});

test('geo: tra địa danh gần nhất, tên tiếng Việt, nước từ countryInfo', () => {
  const geo = createGeoIndex(
    [
      { name: 'Đà Lạt', lat: 11.94646, lon: 108.44193, countryCode: 'VN', timezone: 'Asia/Ho_Chi_Minh' },
      { name: 'Nha Trang', lat: 12.24507, lon: 109.19432, countryCode: 'VN', timezone: 'Asia/Ho_Chi_Minh' },
    ],
    [['VN', 'Vietnam']],
  );
  const place = geo.nearest(11.9404, 108.4583);
  assert.equal(place.name, 'Đà Lạt');
  assert.equal(place.countryName, 'Việt Nam');
  assert.equal(place.timezone, 'Asia/Ho_Chi_Minh');
  assert.equal(geo.nearest(0, 0), null);
});

test('geo: sửa ký tự Ð của GeoNames thành Đ', () => {
  assert.equal(normalizePlaceName('Ðà Lạt'), 'Đà Lạt');
});

test('util: slug bỏ dấu, km, số ngày, buổi, giờ địa phương', () => {
  assert.equal(slugify('Chuyến thử API'), 'chuyen-thu-api');
  assert.equal(slugify('Đà Lạt 2026!'), 'da-lat-2026');
  const dalatNhatrang = distanceKm(DALAT, NHATRANG);
  assert.ok(dalatNhatrang > 80 && dalatNhatrang < 95, `km=${dalatNhatrang}`);
  assert.equal(calendarDays('2026-08-01T10:00:00Z', '2026-08-03T01:00:00Z'), 2);
  assert.equal(round2(11.94049), 11.94);
  assert.equal(partOfDay(9), 'Buổi sáng');
  assert.equal(partOfDay(15), 'Buổi chiều');
  assert.equal(timeInTimezone('2026-08-01T02:00:00Z', 'Asia/Ho_Chi_Minh'), '09:00');
});

test('media-type: nhận diện bằng chữ ký nhị phân', () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
  assert.equal(detectMediaType(jpeg).ext, 'jpg');
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
  assert.equal(detectMediaType(png).ext, 'png');
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(8)]);
  assert.equal(detectMediaType(webp).ext, 'webp');
  const heic = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic'), Buffer.alloc(12)]);
  assert.equal(detectMediaType(heic).kind, 'photo');
  const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom'), Buffer.alloc(12)]);
  assert.equal(detectMediaType(mp4).kind, 'video');
  const mov = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypqt  '), Buffer.alloc(12)]);
  assert.equal(detectMediaType(mov).ext, 'mov');
  assert.equal(detectMediaType(Buffer.from('không phải ảnh đâu nhé')), null);
});

test('media-type: đọc thời lượng mvhd của MP4', () => {
  const ftyp = Buffer.alloc(16);
  ftyp.writeUInt32BE(16, 0);
  ftyp.write('ftyp', 4, 'latin1');
  ftyp.write('isom', 8, 'latin1');

  const mvhdContent = Buffer.alloc(20);
  mvhdContent.writeUInt32BE(1000, 12); // timescale
  mvhdContent.writeUInt32BE(5000, 16); // duration
  const mvhd = Buffer.concat([Buffer.alloc(8), mvhdContent]);
  mvhd.writeUInt32BE(mvhd.length, 0);
  mvhd.write('mvhd', 4, 'latin1');

  const moov = Buffer.concat([Buffer.alloc(8), mvhd]);
  moov.writeUInt32BE(moov.length, 0);
  moov.write('moov', 4, 'latin1');

  const file = Buffer.concat([ftyp, moov]);
  assert.equal(readMp4Duration(file), 5);
});

test('B-03: dHash giống nhau → khoảng cách 0, khác nhau → > ngưỡng', () => {
  const base = new Uint8Array(9 * 8);
  for (let i = 0; i < base.length; i += 1) base[i] = (i * 37) % 255;
  const hash = dhashToHex(dhashFromGray(base));
  assert.equal(hammingHex(hash, hash), 0);
  const inverted = Uint8Array.from(base, (v) => 255 - v);
  assert.ok(hammingHex(hash, dhashToHex(dhashFromGray(inverted))) > 6);
});

test('B-03: phương sai ảnh phẳng = 0', () => {
  assert.equal(variance(new Uint8Array(100)), 0);
  assert.ok(variance(Uint8Array.from({ length: 100 }, (_, i) => (i % 2 ? 255 : 0))) > 1000);
});
