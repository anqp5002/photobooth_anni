import fs from 'node:fs/promises';
import path from 'node:path';
import { distanceKm } from './util.js';

// GeoNames dùng ký tự Ð (U+00D0) trong một số tên tiếng Việt; đổi về Đ (U+0110).
const ETH = '\u00D0';
const DSTROKE = '\u0110';

/** Tên hiển thị tiếng Việt cho các địa danh hay gặp (GeoNames ghi tiếng Anh). */
const PLACE_ALIASES = new Map([
  ['Hanoi', 'Hà Nội'],
  ['Ho Chi Minh City', 'Thành phố Hồ Chí Minh'],
  ['Haiphong', 'Hải Phòng'],
  ['Da Nang', 'Đà Nẵng'],
  ['Hue', 'Huế'],
  ['Can Tho', 'Cần Thơ'],
  ['Phu Quoc', 'Phú Quốc'],
  ['Vung Tau', 'Vũng Tàu'],
  ['Da Lat', 'Đà Lạt'],
  ['Nha Trang', 'Nha Trang'],
  ['Hoi An', 'Hội An'],
  ['Bangkok', 'Bangkok'],
  ['Phnom Penh', 'Phnôm Pênh'],
  ['Siem Reap', 'Xiêm Riệp'],
  ['Vientiane', 'Viêng Chăn'],
  ['Luang Prabang', 'Luông Pha Băng'],
  ['Chiang Mai', 'Chiang Mai'],
  ['Singapore', 'Singapore'],
  ['Kuala Lumpur', 'Kuala Lumpur'],
]);

/** Tên nước tiếng Việt; không có thì dùng tên tiếng Anh của countryInfo. */
const COUNTRY_ALIASES = new Map([
  ['VN', 'Việt Nam'],
  ['TH', 'Thái Lan'],
  ['KH', 'Campuchia'],
  ['LA', 'Lào'],
  ['CN', 'Trung Quốc'],
  ['JP', 'Nhật Bản'],
  ['KR', 'Hàn Quốc'],
  ['TW', 'Đài Loan'],
  ['SG', 'Singapore'],
  ['MY', 'Malaysia'],
  ['ID', 'Indonesia'],
  ['PH', 'Philippines'],
  ['IN', 'Ấn Độ'],
  ['NP', 'Nepal'],
  ['FR', 'Pháp'],
  ['IT', 'Ý'],
  ['CH', 'Thụy Sĩ'],
  ['DE', 'Đức'],
  ['ES', 'Tây Ban Nha'],
  ['PT', 'Bồ Đào Nha'],
  ['GB', 'Vương quốc Anh'],
  ['US', 'Hoa Kỳ'],
  ['CA', 'Canada'],
  ['AU', 'Úc'],
  ['NZ', 'New Zealand'],
  ['TR', 'Thổ Nhĩ Kỳ'],
  ['EG', 'Ai Cập'],
  ['MA', 'Maroc'],
  ['AE', 'Các Tiểu vương quốc Ả Rập Thống nhất'],
  ['GE', 'Gruzia'],
  ['MN', 'Mông Cổ'],
  ['IS', 'Iceland'],
  ['NO', 'Na Uy'],
  ['SE', 'Thụy Điển'],
  ['FI', 'Phần Lan'],
  ['DK', 'Đan Mạch'],
  ['NL', 'Hà Lan'],
  ['BE', 'Bỉ'],
  ['AT', 'Áo'],
  ['CZ', 'Séc'],
  ['PL', 'Ba Lan'],
  ['GR', 'Hy Lạp'],
  ['HR', 'Croatia'],
  ['MX', 'Mexico'],
  ['PE', 'Peru'],
  ['AR', 'Argentina'],
  ['CL', 'Chile'],
  ['BR', 'Brasil'],
  ['ZA', 'Nam Phi'],
  ['KE', 'Kenya'],
  ['TZ', 'Tanzania'],
  ['RU', 'Nga'],
]);

export function normalizePlaceName(name) {
  if (!name) return '';
  const fixed = String(name).replaceAll(ETH, DSTROKE).trim();
  return PLACE_ALIASES.get(fixed) ?? fixed;
}

export function countryName(code, fallback) {
  if (!code) return fallback ?? null;
  return COUNTRY_ALIASES.get(code) ?? fallback ?? code;
}

/** Đọc `cities15000.txt` (GeoNames, CC BY 4.0) → mảng {name, lat, lon, countryCode, timezone}. */
export function parseCities(text) {
  const cities = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const f = line.split('\t');
    if (f.length < 18) continue;
    const lat = Number(f[4]);
    const lon = Number(f[5]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const name = normalizePlaceName(f[1]);
    if (!name) continue;
    cities.push({
      name,
      ascii: f[2],
      lat,
      lon,
      countryCode: f[8] || null,
      population: Number(f[14]) || 0,
      timezone: f[17] || null,
    });
  }
  return cities;
}

/** Đọc `countryInfo.txt` → Map mã ISO → tên nước (tiếng Anh). */
export function parseCountries(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const f = line.split('\t');
    if (f.length < 5) continue;
    map.set(f[0], f[4]);
  }
  return map;
}

const CELL = 0.5; // độ — lưới tra cứu

/** Chỉ mục địa danh trong bộ nhớ, tra theo lưới 0,5°. */
export class GeoIndex {
  constructor(cities, countries) {
    this.cities = cities;
    this.countries = countries;
    this.grid = new Map();
    for (const city of cities) {
      const key = this.#key(city.lat, city.lon);
      let bucket = this.grid.get(key);
      if (!bucket) {
        bucket = [];
        this.grid.set(key, bucket);
      }
      bucket.push(city);
    }
  }

  #key(lat, lon) {
    return `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`;
  }

  /**
   * Địa danh gần nhất. Trả `null` nếu xa hơn `maxKm`.
   * @param {number} lat
   * @param {number} lon
   * @param {{maxKm?: number}} [opts]
   */
  nearest(lat, lon, { maxKm = 200 } = {}) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const point = { lat, lon };
    let best = null;
    let bestDistance = Infinity;
    const rings = Math.max(2, Math.ceil(maxKm / (CELL * 111)));
    const baseLat = Math.floor(lat / CELL);
    const baseLon = Math.floor(lon / CELL);
    for (let ring = 0; ring <= rings; ring += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        for (let dx = -ring; dx <= ring; dx += 1) {
          // chỉ quét viền của vòng để không lặp ô
          if (ring > 0 && Math.abs(dy) !== ring && Math.abs(dx) !== ring) continue;
          const bucket = this.grid.get(`${baseLat + dy}:${baseLon + dx}`);
          if (!bucket) continue;
          for (const city of bucket) {
            const d = distanceKm(point, city);
            if (d < bestDistance) {
              bestDistance = d;
              best = city;
            }
          }
        }
      }
      // Mọi điểm ở vòng kế tiếp cách ít nhất ring * CELL độ theo vĩ độ.
      if (best && bestDistance <= ring * CELL * 111) break;
    }
    if (!best || bestDistance > maxKm) return null;
    return {
      name: best.name,
      countryCode: best.countryCode,
      countryName: countryName(best.countryCode, this.countries.get(best.countryCode)),
      timezone: best.timezone,
      lat: best.lat,
      lon: best.lon,
      distanceKm: bestDistance,
    };
  }

  countryOf(code) {
    if (!code) return null;
    return {
      code,
      name: countryName(code, this.countries.get(code)),
    };
  }
}

/** Nạp chỉ mục từ thư mục `data/`. */
export async function loadGeoIndex(dataDir) {
  // Đường dẫn viết tĩnh để công cụ đóng gói (Vercel) nhận ra và mang theo 2 tệp dữ liệu.
  const bundled = {
    cities: new URL('../data/cities15000.txt', import.meta.url),
    countries: new URL('../data/countryInfo.txt', import.meta.url),
  };
  const [citiesText, countriesText] = await Promise.all([
    fs.readFile(dataDir ? path.join(dataDir, 'cities15000.txt') : bundled.cities, 'utf8'),
    fs.readFile(dataDir ? path.join(dataDir, 'countryInfo.txt') : bundled.countries, 'utf8'),
  ]);
  return new GeoIndex(parseCities(citiesText), parseCountries(countriesText));
}

/** Chỉ mục rỗng dùng cho test đơn vị. */
export function createGeoIndex(cities, countries = []) {
  return new GeoIndex(cities, new Map(Array.isArray(countries) ? countries : Object.entries(countries)));
}
