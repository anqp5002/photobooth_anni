/** Khai báo kiểu cho gifenc 1.0.3 (MIT) — bản đóng gói trong vendor/. */

export interface GifEncoder {
  writeFrame(
    index: Uint8Array,
    width: number,
    height: number,
    opts: {
      palette: number[][];
      delay?: number;
      repeat?: number;
      dispose?: number;
      transparent?: boolean;
      transparentIndex?: number;
    },
  ): void;
  finish(): void;
  bytes(): Uint8Array;
  reset(): void;
}

export declare function GIFEncoder(opt?: {
  initialCapacity?: number;
  auto?: boolean;
}): GifEncoder;

export declare function quantize(
  rgba: Uint8Array | Uint8ClampedArray,
  maxColors: number,
  opts?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean | number },
): number[][];

export declare function applyPalette(
  rgba: Uint8Array | Uint8ClampedArray,
  palette: number[][],
  format?: 'rgb565' | 'rgb444' | 'rgba4444',
): Uint8Array;
