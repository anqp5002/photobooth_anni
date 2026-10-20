import path from 'node:path';
import {
  BLUR_VARIANCE_THRESHOLD,
  DHASH_MAX_DISTANCE,
  analyzeImage,
  hammingHex,
} from '../ai.js';
import { createAiProvider, imageDataUrl } from './freellm.js';
import { syncMediaFts } from '../fts.js';
import { ensureSuggestion } from '../suggestions.js';

/**
 * Hàng đợi phân tích ảnh của một gia đình:
 * - chấm mờ / gần trùng bằng dHash ngay tại máy (không cần AI)
 * - gọi LLM (mock/freellm) để lấy caption, tags, score, kind_hint
 * - cập nhật `media.ai_*`, FTS, và tạo gợi ý ẩn ảnh mờ/trùng
 * Chạy 2 việc song song; lỗi AI không chặn việc tải lên.
 */
export function createAiService({ db, mediaDir, config = {}, logger = null, provider = null }) {
  const ai = provider ?? createAiProvider(config);
  const concurrency = Math.max(1, Number(config.aiConcurrency ?? 2));
  const pending = [];
  const active = new Set();
  let closed = false;

  function markStatus(id, status) {
    db.prepare('UPDATE media SET ai_status = ? WHERE id = ?').run(status, id);
  }

  async function detectQuality(row) {
    if (row.type !== 'photo') {
      return { dhash: row.dhash ?? null, blurry: Boolean(row.blurry), nearDuplicate: Boolean(row.near_duplicate) };
    }
    const file = path.join(mediaDir, row.code, 'lg.jpg');
    try {
      const { hash, blurVariance } = await analyzeImage(file);
      const blurry = blurVariance < BLUR_VARIANCE_THRESHOLD;
      const others = db
        .prepare(
          `SELECT id, dhash FROM media
           WHERE family_id = ? AND id <> ? AND dhash IS NOT NULL
           ORDER BY id DESC LIMIT 300`,
        )
        .all(row.family_id, row.id);
      const nearDuplicate = others.some((other) => hammingHex(other.dhash, hash) <= DHASH_MAX_DISTANCE);
      return { dhash: hash, blurry, nearDuplicate };
    } catch {
      return { dhash: row.dhash ?? null, blurry: false, nearDuplicate: false };
    }
  }

  function suggestHidden(row, { blurry, nearDuplicate }) {
    if (blurry) {
      ensureSuggestion(db, {
        familyId: row.family_id,
        mediaId: row.id,
        type: 'hide_blurry',
        text: 'Ảnh này hơi mờ, ẩn khỏi dòng thời gian nhé?',
        payload: { reason: 'blurry' },
      });
      return;
    }
    if (nearDuplicate) {
      ensureSuggestion(db, {
        familyId: row.family_id,
        mediaId: row.id,
        type: 'hide_blurry',
        text: 'Ảnh này gần trùng với ảnh khác, ẩn bớt nhé?',
        payload: { reason: 'near_duplicate' },
      });
    }
  }

  /** Phân tích một ảnh (gọi trực tiếp được cho test/backfill). */
  async function analyzeMedia(mediaId) {
    const row = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(mediaId));
    if (!row) return null;

    const quality = await detectQuality(row);
    db.prepare('UPDATE media SET blurry = ?, near_duplicate = ?, dhash = ? WHERE id = ?').run(
      quality.blurry ? 1 : 0,
      quality.nearDuplicate ? 1 : 0,
      quality.dhash,
      row.id,
    );
    suggestHidden(row, quality);

    if (!ai.analyzePhoto) {
      markStatus(row.id, 'skipped');
      syncMediaFts(db, row.id);
      return { id: row.id, aiStatus: 'skipped', caption: null };
    }

    let analysis = null;
    try {
      const dataUrl = await imageDataUrl(path.join(mediaDir, row.code, 'lg.jpg'));
      analysis = await ai.analyzePhoto({
        dataUrl,
        takenAt: row.taken_at,
        place: row.place,
        seed: row.orig_name || row.code,
      });
    } catch (err) {
      logger?.warn?.({ err, mediaId: row.id }, 'AI phân tích ảnh lỗi');
    }

    if (!analysis || !analysis.caption) {
      markStatus(row.id, 'failed');
      syncMediaFts(db, row.id);
      return { id: row.id, aiStatus: 'failed', caption: null };
    }

    db.prepare(
      `UPDATE media SET ai_status = 'done', ai_caption = ?, ai_tags = ?, ai_score = ?,
        ai_kind_hint = ? WHERE id = ?`,
    ).run(
      analysis.caption,
      JSON.stringify(analysis.tags ?? []),
      analysis.score ?? null,
      analysis.kindHint ?? null,
      row.id,
    );
    syncMediaFts(db, row.id);
    return { id: row.id, aiStatus: 'done', caption: analysis.caption };
  }

  function pump() {
    while (!closed && active.size < concurrency && pending.length > 0) {
      const id = pending.shift();
      const job = analyzeMedia(id)
        .catch((err) => {
          logger?.warn?.({ err, mediaId: id }, 'hàng đợi AI lỗi');
          try {
            markStatus(id, 'failed');
          } catch {
            /* ảnh có thể đã bị xoá */
          }
        })
        .finally(() => {
          active.delete(job);
          pump();
        });
      active.add(job);
    }
  }

  /** Đưa ảnh vào hàng đợi (trả về ngay; theo dõi bằng `GET /api/media/status`). */
  function enqueue(mediaId) {
    const id = Number(mediaId);
    if (!Number.isFinite(id)) return;
    markStatus(id, 'pending');
    if (closed) return;
    pending.push(id);
    pump();
  }

  /** Chờ tới khi hàng đợi rỗng (test + script seed). */
  async function idle() {
    while (pending.length > 0 || active.size > 0) {
      await Promise.allSettled([...active]);
    }
  }

  function stop() {
    closed = true;
    pending.length = 0;
  }

  return {
    name: ai.name,
    provider: ai,
    enqueue,
    idle,
    stop,
    analyzeMedia,
    stats: () => ({ pending: pending.length, active: active.size, provider: ai.name }),
  };
}
