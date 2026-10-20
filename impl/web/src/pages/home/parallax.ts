import { useEffect, useRef } from 'react';

/**
 * Parallax theo con trỏ cho hero trang chủ — chép theo `design/proto/assets/app.js`.
 * Mỗi lớp có `data-depth` (px) nên lớp nào sâu hơn thì dịch nhiều hơn.
 * Tôn trọng `prefers-reduced-motion` và chỉ chạy khi có con trỏ thật.
 */
export function useParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (!window.matchMedia('(pointer: fine)').matches) return undefined;

    const layers = Array.from(root.querySelectorAll<HTMLElement>('[data-depth]'));
    if (layers.length === 0) return undefined;

    let frame = 0;
    const move = (event: PointerEvent) => {
      const box = root.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        for (const layer of layers) {
          const depth = Number(layer.dataset.depth ?? 0);
          layer.style.translate = `${x * depth}px ${y * depth}px`;
        }
      });
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      for (const layer of layers) layer.style.translate = '0 0';
    };

    root.addEventListener('pointermove', move);
    root.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', leave);
    };
  }, []);

  return ref;
}
