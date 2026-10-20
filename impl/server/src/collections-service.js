import { regroupFamily } from './collections.js';

/**
 * Gom mục chạy nền sau khi tải ảnh (gộp nhiều lần tải trong ~0,3 giây làm một lần),
 * chờ hàng đợi AI xong trước để LLM có caption mà đặt tên mục.
 */
export function createCollectionService({
  db,
  provider = null,
  logger = null,
  waitFor = null,
  debounceMs = 300,
}) {
  const timers = new Map();
  const running = new Set();
  const chains = new Map();
  let closed = false;

  /** Xếp hàng gom mục cho từng gia đình: hai lần gom không bao giờ chạy chồng nhau. */
  function enqueue(family, task) {
    const prev = chains.get(family) ?? Promise.resolve();
    const job = prev
      .catch(() => {})
      .then(task)
      .catch((err) => logger?.warn?.({ err, familyId: family }, 'gom mục lỗi'))
      .finally(() => {
        running.delete(job);
        if (chains.get(family) === job) chains.delete(family);
      });
    chains.set(family, job);
    running.add(job);
    return job;
  }

  function schedule(familyId, { delayMs = debounceMs } = {}) {
    if (closed) return;
    const family = Number(familyId);
    if (!Number.isFinite(family)) return;
    const existing = timers.get(family);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      timers.delete(family);
      enqueue(family, async () => {
        try {
          if (waitFor) await waitFor();
        } catch {
          /* hàng đợi AI lỗi thì vẫn gom mục bằng caption đang có */
        }
        return regroupFamily(db, family, { provider });
      });
    }, delayMs);
    timer.unref?.();
    timers.set(family, timer);
  }

  /** Gom ngay (seed/script), trả promise hoàn tất. */
  function regroupNow(familyId) {
    const family = Number(familyId);
    return enqueue(family, () => regroupFamily(db, family, { provider }));
  }

  /** Chờ mọi việc gom mục đang chờ/đang chạy xong (test). */
  async function idle() {
    while (timers.size > 0 || running.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  function stop() {
    closed = true;
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  }

  return { schedule, regroupNow, idle, stop, stats: () => ({ timers: timers.size, running: running.size }) };
}
