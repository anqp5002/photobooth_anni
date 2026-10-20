export type LatLon = [number, number];

/** Mã hoá polyline kiểu Google, độ chính xác 5 (SPEC R-038). */
export function encodePolyline(points: LatLon[], precision = 5): string {
  const factor = 10 ** precision;
  let output = '';
  let prevLat = 0;
  let prevLon = 0;
  for (const [lat, lon] of points) {
    const iLat = Math.round(lat * factor);
    const iLon = Math.round(lon * factor);
    output += encodeSigned(iLat - prevLat) + encodeSigned(iLon - prevLon);
    prevLat = iLat;
    prevLon = iLon;
  }
  return output;
}

function encodeSigned(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  out += String.fromCharCode(v + 63);
  return out;
}

/** Giải mã polyline độ chính xác 5 (SPEC R-038). */
export function decodePolyline(encoded: string, precision = 5): LatLon[] {
  const factor = 10 ** precision;
  const points: LatLon[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lon += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / factor, lon / factor]);
  }
  return points;
}
