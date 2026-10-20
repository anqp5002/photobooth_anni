/** Icon phương tiện vẽ tay dạng SVG (SPEC R-021). */
export const VEHICLE_GLYPHS: Record<string, string> = {
  motorbike:
    '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M8.4 17h4.2l2.9-7.5h-3.4M12.5 9.5L9 5H6.2"/>',
  train: '<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10.5h14M8.5 19.5L7 22M15.5 19.5L17 22M8 19.5h8"/>',
  bus: '<rect x="4" y="3.5" width="16" height="13" rx="2.5"/><path d="M4 11h16M7.5 19.5L6 22M16.5 19.5L18 22M7.5 19.5h9"/>',
  car: '<path d="M3.5 16.5v-3l2-5h13l2 5v3"/><path d="M3.5 13.5h17"/><circle cx="7.5" cy="16.5" r="1.6"/><circle cx="16.5" cy="16.5" r="1.6"/>',
  plane:
    '<path d="M21 15.5v-2l-8-4.5V3.8a1.6 1.6 0 0 0-3.2 0V9l-8 4.5v2l8-2.4v5.6l-2.2 1.6V22l3.4-1 3.4 1v-1.7L13 18.7v-5.6z"/>',
  ferry:
    '<path d="M3.5 14.5l1.6-4h13.8l1.6 4"/><path d="M8 10.5V7h8v3.5"/><path d="M2.5 18c1.6 1.2 3.2 1.2 4.8 0 1.6 1.2 3.2 1.2 4.8 0 1.6 1.2 3.2 1.2 4.8 0 1.6 1.2 3.2 1.2 4.7 0"/>',
  ship:
    '<path d="M3 15.5h18l-2.4 4.2a3 3 0 0 1-2.4 1.3H7.8a3 3 0 0 1-2.4-1.3z"/><path d="M6 15.5V9h12v6.5M9.5 9V5.5h5V9"/>',
  none: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.2 2.4v1.6"/><circle cx="12.5" cy="17" r="0.8" fill="currentColor" stroke="none"/>',
};

export const VEHICLE_LABELS: Record<string, string> = {
  motorbike: 'Xe máy',
  train: 'Tàu hoả',
  bus: 'Xe buýt',
  ferry: 'Phà',
  ship: 'Tàu thuỷ',
  plane: 'Máy bay',
  car: 'Ô tô',
  none: 'Không rõ',
};

export function vehicleGlyphSvg(vehicle: string, size = 16): string {
  const path = VEHICLE_GLYPHS[vehicle] ?? VEHICLE_GLYPHS.none;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
