import { useEffect, useRef, useState, type RefObject } from 'react';

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Hiện dần khi cuộn tới — chép theo `design/proto/tong-ket.html`
 * (class `.rv` rồi thêm `.in` khi phần tử vào khung nhìn).
 *
 * `deps` phải đổi khi nội dung trong `ref` được dựng lại, vì các phần tử `.rv`
 * chỉ tồn tại sau khi dữ liệu về.
 */
export function useReveal<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const targets = root.querySelectorAll<HTMLElement>('.rv');
    if (reduceMotion()) {
      for (const target of targets) target.classList.add('in');
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.18 },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/**
 * Parallax khi cuộn: ảnh bìa chương, dải ảnh toàn màn và phần mở đầu
 * (chép đúng công thức trong `design/proto/tong-ket.html`).
 *
 * `deps` phải đổi khi nội dung trong `root` được dựng lại.
 */
export function useScrollMotion(root: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const scope = root.current;
    if (!scope) return undefined;

    const hero = scope.querySelector<HTMLElement>('.open');
    const heroBg = scope.querySelector<HTMLElement>('.open-bg');
    const heroText = scope.querySelector<HTMLElement>('.open-t');
    const chapters = scope.querySelector<HTMLElement>('.chapters');
    const rail = scope.querySelector<HTMLElement>('.rail');
    const parallax = Array.from(scope.querySelectorAll<HTMLElement>('[data-par]'));
    const backgrounds = Array.from(scope.querySelectorAll<HTMLElement>('[data-bg]'));

    let frame = 0;
    const tick = () => {
      const vh = window.innerHeight;
      const scrollY = window.scrollY;

      if (chapters && rail) {
        const box = chapters.getBoundingClientRect();
        rail.classList.toggle('show', box.top < vh * 0.6 && box.bottom > vh * 0.4);
      }

      if (reduceMotion()) return;

      for (const element of parallax) {
        const box = element.getBoundingClientRect();
        if (box.bottom < -100 || box.top > vh + 100) continue;
        const strength = Number(element.dataset.par ?? 1);
        const offset = (box.top + box.height / 2 - vh / 2) / vh;
        const image = element.querySelector<HTMLElement>('img');
        if (image) image.style.transform = `translateY(${-offset * 40 * strength}px) scale(1.12)`;
      }

      for (const element of backgrounds) {
        const box = element.parentElement?.getBoundingClientRect();
        if (!box || box.bottom < 0 || box.top > vh) continue;
        const offset = (box.top + box.height / 2 - vh / 2) / vh;
        const image = element.querySelector<HTMLElement>('img');
        if (image) image.style.transform = `translateY(${-offset * 120}px) scale(1.2)`;
      }

      if (hero && heroBg && heroText && scrollY < vh * 1.2) {
        heroBg.style.transform = `translateY(${scrollY * 0.35}px) scale(${1 + (scrollY / vh) * 0.12})`;
        heroText.style.transform = `translateY(${scrollY * 0.25}px)`;
        heroText.style.opacity = String(Math.max(0, 1 - scrollY / (vh * 0.7)));
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };

    tick();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Chương đang xem, để tô mục tương ứng trên thanh bên phải. */
export function useActiveChapter(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length === 0) return undefined;
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (sections.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

/** Đếm số tăng dần khi con số chạm vào khung nhìn. */
export function useCountUp(value: number) {
  const [display, setDisplay] = useState(reduceMotion() ? value : 0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduceMotion()) {
      setDisplay(value);
      return undefined;
    }
    const element = ref.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          const started = performance.now();
          const step = (now: number) => {
            const progress = Math.min(1, (now - started) / 1400);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(value * eased));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);

  return { ref, display };
}
