/**
 * Polyline mã hoá (Google encoded polyline) — R-038.
 * Hợp đồng API chốt "polyline mã hoá độ chính xác 5".
 */
export function encodePolyline(points, precision = 5) {
  const factor = 10 ** precision;
  let lastLat = 0;
  let lastLon = 0;
  let out = '';
  for (const point of points) {
    const lat = Math.round(Number(point.lat) * factor);
    const lon = Math.round(Number(point.lon) * factor);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out += encodeValue(lat - lastLat);
    out += encodeValue(lon - lastLon);
    lastLat = lat;
    lastLon = lon;
  }
  return out;
}

function encodeValue(value) {
  let v = value < 0 ? -value * 2 - 1 : value * 2;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v = Math.floor(v / 32);
  }
  out += String.fromCharCode(v + 63);
  return out;
}

/** Giải mã polyline → [{lat, lon}]. */
export function decodePolyline(encoded, precision = 5) {
  const factor = 10 ** precision;
  const points = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < encoded.length) {
    const [dLat, nextLat] = decodeValue(encoded, index);
    index = nextLat;
    const [dLon, nextLon] = decodeValue(encoded, index);
    index = nextLon;
    lat += dLat;
    lon += dLon;
    points.push({ lat: lat / factor, lon: lon / factor });
  }
  return points;
}

function decodeValue(encoded, start) {
  let result = 0;
  let shift = 0;
  let index = start;
  let byte;
  do {
    byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  const value = result & 1 ? -(result >> 1) : result >> 1;
  return [value, index];
}

/**
 * Đường nối hai chặng. Không có dịch vụ chỉ đường trả phí nên đoạn là
 * "nối thẳng" (hợp đồng cho phép kind = straight | road).
 */
export function pathBetween(from, to) {
  return encodePolyline([
    { lat: from.lat, lon: from.lon },
    { lat: to.lat, lon: to.lon },
  ]);
}
