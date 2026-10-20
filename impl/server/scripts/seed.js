// Tạo dữ liệu mẫu: user "minh" + chuyến công khai "Xuyen Viet".
// Ảnh do code sinh ra (SVG → JPEG) kèm EXIF thời gian + GPS, không dùng ảnh ngoài.
process.env.TZ = 'UTC';

import sharp from 'sharp';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { loadGeoIndex } from '../src/geo.js';
import { createUser, hashPassword } from '../src/auth.js';
import { ingestFile, insertMedia } from '../src/ingest.js';
import { applyAutoSegments } from '../src/cluster.js';
import { applyHeuristics } from '../src/ai.js';
import { nowIso, slugify } from '../src/util.js';

const TRIP_NAME = 'Xuyen Viet';
const USERNAME = 'minh';
const EMAIL = 'minh@example.com';
const PASSWORD = 'hanhtrinh123';

/** 10 chặng, 9 đoạn, 3 nước, đủ 8 loại phương tiện. */
const STEPS = [
  {
    name: 'Hà Nội',
    place: 'Hà Nội',
    country: ['VN', 'Việt Nam'],
    lat: 21.0285,
    lon: 105.8542,
    at: '2026-09-12T01:30:00Z',
    hue: 205,
    weather: [30, 'sunny'],
  },
  {
    name: 'Ninh Bình',
    place: 'Ninh Bình',
    country: ['VN', 'Việt Nam'],
    lat: 20.2506,
    lon: 105.9745,
    at: '2026-09-12T07:10:00Z',
    hue: 95,
    weather: [29, 'cloud'],
  },
  {
    name: 'Huế',
    place: 'Huế',
    country: ['VN', 'Việt Nam'],
    lat: 16.4637,
    lon: 107.5905,
    at: '2026-09-13T02:00:00Z',
    hue: 165,
    weather: [31, 'rain'],
  },
  {
    name: 'Hội An',
    place: 'Hội An',
    country: ['VN', 'Việt Nam'],
    lat: 15.8801,
    lon: 108.338,
    at: '2026-09-14T03:00:00Z',
    hue: 28,
    weather: [32, 'sunny'],
  },
  {
    name: 'Cù Lao Chàm',
    place: 'Cù Lao Chàm',
    country: ['VN', 'Việt Nam'],
    lat: 15.95,
    lon: 108.5333,
    at: '2026-09-14T06:00:00Z',
    hue: 190,
    weather: [30, 'cloud'],
  },
  {
    name: 'Nha Trang',
    place: 'Nha Trang',
    country: ['VN', 'Việt Nam'],
    lat: 12.2388,
    lon: 109.1967,
    at: '2026-09-15T02:00:00Z',
    hue: 200,
    weather: [33, 'sunny'],
  },
  {
    name: 'Đà Lạt',
    place: 'Đà Lạt',
    country: ['VN', 'Việt Nam'],
    lat: 11.9404,
    lon: 108.4583,
    at: '2026-09-16T01:00:00Z',
    hue: 265,
    weather: [21, 'fog'],
  },
  {
    name: 'Phnôm Pênh',
    place: 'Phnôm Pênh',
    country: ['KH', 'Campuchia'],
    lat: 11.5564,
    lon: 104.9282,
    at: '2026-09-18T03:00:00Z',
    hue: 40,
    weather: [34, 'sunny'],
  },
  {
    name: 'Bangkok',
    place: 'Bangkok',
    country: ['TH', 'Thái Lan'],
    lat: 13.7563,
    lon: 100.5018,
    at: '2026-09-20T02:00:00Z',
    hue: 320,
    weather: [35, 'sunny'],
  },
  {
    name: 'Chùa Arun',
    place: 'Bangkok',
    country: ['TH', 'Thái Lan'],
    lat: 13.7437,
    lon: 100.4889,
    at: '2026-09-20T08:00:00Z',
    hue: 15,
    weather: [33, 'cloud'],
  },
];

/** Phương tiện cho 9 đoạn, theo thứ tự chặng (đủ 8 loại). */
const VEHICLES = ['motorbike', 'train', 'bus', 'ferry', 'ship', 'car', 'car', 'plane', 'none'];

const PHOTOS_PER_STEP = [3, 3, 3, 3, 2, 4, 3, 3, 3, 2];

/** Ảnh minh hoạ sinh bằng SVG (không lấy ảnh của sản phẩm nào). */
function artwork({ hue, variant, label }) {
  const sunX = 220 + ((variant * 197) % 840);
  const peak = 300 + ((variant * 83) % 180);
  const trees = Array.from({ length: 6 }, (_, i) => {
    const x = 90 + i * 190 + ((variant * 29) % 40);
    const h = 70 + ((i * 31 + variant * 17) % 70);
    return `<path d="M${x} ${790 - h} L${x + 34} 790 L${x - 34} 790 Z" fill="#16352a" opacity="0.9"/>`;
  }).join('');
  const waves = Array.from({ length: 26 }, (_, i) => {
    const y = 760 + ((i * 23 + variant * 13) % 170);
    return `<rect x="${(i * 97 + variant * 37) % 1230}" y="${y}" width="${60 + (i % 4) * 26}" height="4" rx="2" fill="#ffffff" opacity="0.35"/>`;
  }).join('');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="960">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="hsl(${hue},58%,45%)"/>
          <stop offset="0.55" stop-color="hsl(${(hue + 25) % 360},62%,70%)"/>
          <stop offset="1" stop-color="hsl(${(hue + 45) % 360},70%,88%)"/>
        </linearGradient>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="hsl(${(hue + 190) % 360},45%,32%)"/>
          <stop offset="1" stop-color="hsl(${(hue + 200) % 360},50%,16%)"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="960" fill="url(#sky)"/>
      <circle cx="${sunX}" cy="200" r="86" fill="#fff3cc" opacity="0.95"/>
      <path d="M0 720 L250 ${peak - 120} L470 640 L640 ${peak - 190} L900 700 L1280 560 L1280 760 L0 760 Z" fill="hsl(${(hue + 140) % 360},24%,28%)"/>
      <path d="M0 780 L340 600 L610 760 L860 620 L1280 780 L1280 820 L0 820 Z" fill="hsl(${(hue + 150) % 360},22%,19%)" opacity="0.9"/>
      <rect y="770" width="1280" height="190" fill="url(#water)"/>
      ${waves}
      ${trees}
      <rect x="0" y="0" width="1280" height="960" fill="#000000" opacity="0.05"/>
      <text x="64" y="100" font-family="Segoe UI, Arial, sans-serif" font-size="46" font-weight="700" fill="#ffffff" opacity="0.92">${label}</text>
    </svg>`,
  );
}

function dms(value) {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minutesFloat = (abs - deg) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60 * 100);
  return `${deg}/1 ${minutes}/1 ${seconds}/100`;
}

function exifStamp(iso) {
  // EXIF không có múi giờ: seed chạy với TZ=UTC nên giờ ghi = giờ UTC.
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}:${pad(d.getUTCMonth() + 1)}:${pad(d.getUTCDate())} ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

async function makePhoto(step, index, iso, jitter) {
  const label = `${step.place.toUpperCase()} ${String(index + 1).padStart(2, '0')}`;
  const svg = artwork({
    hue: (step.hue + index * 17) % 360,
    variant: index + 1 + step.lat * 10,
    label,
  });
  const stamp = exifStamp(iso);
  const lat = step.lat + jitter;
  const lon = step.lon - jitter * 0.6;
  return sharp(svg)
    .jpeg({ quality: 86 })
    .withMetadata({
      exif: {
        IFD0: {
          Make: 'Hanh Trinh',
          Model: 'Seed Camera',
          Software: 'hanh-trinh-seed',
          DateTime: stamp,
        },
        IFD2: {
          DateTimeOriginal: stamp,
          DateTimeDigitized: stamp,
          OffsetTimeOriginal: '+00:00',
        },
        IFD3: {
          GPSLatitudeRef: lat >= 0 ? 'N' : 'S',
          GPSLatitude: dms(lat),
          GPSLongitudeRef: lon >= 0 ? 'E' : 'W',
          GPSLongitude: dms(lon),
        },
      },
    })
    .toBuffer();
}

function ensureUser(db) {
  const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(USERNAME);
  if (existing) return existing;
  const takenEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(EMAIL);
  if (takenEmail) {
    db.prepare('UPDATE users SET username = ?, display_name = ?, password_hash = ? WHERE id = ?').run(
      USERNAME,
      'Minh',
      hashPassword(PASSWORD),
      takenEmail.id,
    );
    return db.prepare('SELECT * FROM users WHERE id = ?').get(takenEmail.id);
  }
  return db.prepare('SELECT * FROM users WHERE id = ?').get(
    createUser(db, {
      username: USERNAME,
      email: EMAIL,
      password: PASSWORD,
      displayName: 'Minh',
    }).user.id,
  );
}

async function main() {
  const config = loadConfig();
  const db = openDb(config.dbPath);
  const geo = await loadGeoIndex(config.dataDir);
  const user = ensureUser(db);

  // Chạy lại seed: xoá chuyến cũ cùng tên của user mẫu.
  const old = db
    .prepare('SELECT id FROM trips WHERE user_id = ? AND name = ?')
    .all(user.id, TRIP_NAME);
  for (const row of old) db.prepare('DELETE FROM trips WHERE id = ?').run(row.id);

  const stamp = nowIso();
  const info = db
    .prepare(
      `INSERT INTO trips (user_id, family_id, name, slug, visibility, timezone, views, likes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'public', 'Asia/Ho_Chi_Minh', 1284, 96, ?, ?)`,
    )
    .run(user.id, user.family_id, TRIP_NAME, slugify(TRIP_NAME), stamp, stamp);
  const tripId = Number(info.lastInsertRowid);

  let accepted = 0;
  for (let s = 0; s < STEPS.length; s += 1) {
    const step = STEPS[s];
    const base = Date.parse(step.at);
    for (let p = 0; p < PHOTOS_PER_STEP[s]; p += 1) {
      // Trong cùng chặng: cách nhau 35 phút, lệch GPS ±0,0012° (< 200 m).
      const iso = new Date(base + p * 35 * 60 * 1000).toISOString();
      const jitter = (p - 1) * 0.0012;
      let buffer = await makePhoto(step, p, iso, jitter);
      if (s === 5 && p === 3) {
        // Một ảnh gần trùng ảnh trước để B-03 có ví dụ.
        buffer = await makePhoto(step, 2, iso, 0.0011);
      }
      const result = await ingestFile({
        buffer,
        filename: `${slugify(step.place)}-${p + 1}.jpg`,
        mediaDir: config.mediaDir,
      });
      if (!result.ok) throw new Error(`seed: ${result.reason}`);
      insertMedia(db, tripId, result.media);
      accepted += 1;
    }
  }

  applyAutoSegments(db, tripId, { geo, config });

  // Đặt tên/thời tiết/số liệu cho đẹp (chia chặng đã xong ở bước trên).
  const steps = db.prepare('SELECT * FROM steps WHERE trip_id = ? ORDER BY sort_order, id').all(tripId);
  const updateStep = db.prepare(
    `UPDATE steps SET name = ?, place_name = ?, country_code = ?, country_name = ?,
      weather_temp_c = ?, weather_icon = ?, comments = ?, likes = ?, description = ?
     WHERE id = ?`,
  );
  steps.forEach((step, index) => {
    const def = STEPS[index] ?? STEPS[STEPS.length - 1];
    const [code, country] = def.country;
    updateStep.run(
      def.name,
      def.place,
      code,
      country,
      def.weather[0],
      def.weather[1],
      3 + ((index * 7) % 9),
      20 + ((index * 13) % 60),
      descriptions[index] ?? null,
      step.id,
    );
  });

  // Phương tiện từng đoạn theo kịch bản (đủ 8 loại).
  const segments = db
    .prepare('SELECT * FROM segments WHERE trip_id = ? ORDER BY id')
    .all(tripId);
  segments.forEach((segment, index) => {
    db.prepare('UPDATE segments SET vehicle = ? WHERE id = ?').run(
      VEHICLES[index] ?? 'none',
      segment.id,
    );
  });

  await applyHeuristics(db, tripId, {
    mediaDir: config.mediaDir,
    provider: config.aiProvider,
    timezone: 'Asia/Ho_Chi_Minh',
  });

  const lastStep = db
    .prepare('SELECT MAX(started_at) AS t FROM steps WHERE trip_id = ?')
    .get(tripId).t;
  const endedAt = lastStep ? new Date(Date.parse(lastStep) + 6 * 3600 * 1000).toISOString() : null;
  db.prepare('UPDATE trips SET ended_at = ?, updated_at = ? WHERE id = ?').run(
    endedAt,
    nowIso(),
    tripId,
  );

  const countryRows = db
    .prepare('SELECT DISTINCT country_code FROM steps WHERE trip_id = ? AND country_code IS NOT NULL')
    .all(tripId);
  console.log(
    `Seeded: user=${USERNAME} (${PASSWORD}), trip=${tripId} "${TRIP_NAME}", ` +
      `media=${accepted}, steps=${steps.length}, countries=${countryRows.map((r) => r.country_code).join(',')}`,
  );
  console.log(`DB: ${config.dbPath}`);
  console.log(`Media: ${config.mediaDir}`);
  db.close();
}

const descriptions = [
  'Chuyến đi bắt đầu từ phố cổ, mang theo một ba lô và tấm bản đồ giấy. Buổi sáng Hà Nội se lạnh, quán cà phê ven hồ đông người.',
  'Ruộng lúa hai bên đường và những dãy núi đá vôi. Đạp xe quanh cố đô mất gần trọn một buổi chiều.',
  'Mưa Huế rơi dai dẳng, ngồi trong quán bánh canh nghe tiếng nước chảy trên mái ngói.',
  'Phố cổ lên đèn, thuyền nhỏ trôi trên sông Hoài. Ăn cao lầu rồi đi bộ ra cầu Nhật Bản.',
  'Tàu gỗ ra đảo mất bốn mươi phút. Nước trong đến mức nhìn thấy san hô dưới đáy.',
  'Nha Trang nắng gắt, cả nhóm thuê xe máy chạy dọc đường Trần Phú. Chiều tối ăn hải sản ở chợ Xóm Mới.',
  'Đà Lạt mát lạnh, sương phủ kín đồi thông. Thuê xe đạp đôi quanh hồ Xuân Hương.',
  'Qua cửa khẩu Mộc Bài, đường đất đỏ và những ngôi chùa vàng. Hoàng hôn trên sông Mekong.',
  'Bangkok ồn ào, xe tuk-tuk chạy kín đường. Lên tầng cao ngắm thành phố lúc lên đèn.',
  'Chùa Arun bên bờ sông Chao Phraya, tháp chính cao và hẹp, bậc thang dốc đứng.',
];

main().catch((err) => {
  console.error('Seed lỗi:', err);
  process.exit(1);
});
