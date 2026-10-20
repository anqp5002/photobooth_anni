import { serializeCollection } from './collections.js';
import { searchMediaIds } from './fts.js';
import { parseTags, serializeMedia } from './media.js';

export const SEARCH_LIMIT_DEFAULT = 40;
export const SEARCH_LIMIT_MAX = 100;
export const SEARCH_COLLECTION_LIMIT = 8;

/** Bỏ dấu + hạ chữ thường để so khớp không phân biệt dấu ("da lat" ≈ "Đà Lạt"). */
export function deaccent(text) {
  return String(text ?? '')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const STOPWORDS = new Set([
  'anh',
  'hinh',
  'co',
  'cua',
  'va',
  'o',
  'tai',
  'nhung',
  'cac',
  'mot',
  'nay',
  'do',
  'la',
  'gi',
  'cho',
  'toi',
  'minh',
  'nha',
  'nam',
  'thang',
  'ngay',
  'di',
  've',
  'khi',
  'trong',
  'ra',
  'lai',
  'roi',
  'chiec',
  'tam',
  'buc',
  'voi',
  'cung',
]);

export function queryTokens(query) {
  return deaccent(query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token))
    .slice(0, 12);
}

const KIND_WORDS = {
  birthday: ['sinh nhat', 'thoi noi', 'banh kem'],
  tet: ['tet', 'giao thua', 'phong bao'],
  trip: ['chuyen di', 'du lich', 'nghi mat', 'di bien', 'di xa'],
  weekend: ['cuoi tuan'],
  holiday: ['nghi le', 'ngay le'],
  baby: ['em be', 'baby'],
  everyday: ['thuong ngay'],
  other: [],
};

const PLACE_WORDS = [
  'ha noi',
  'da lat',
  'nha trang',
  'da nang',
  'hoi an',
  'hue',
  'sa pa',
  'sapa',
  'phu quoc',
  'ha long',
  'vinh ha long',
  'ninh binh',
  'quy nhon',
  'can tho',
  'vung tau',
  'mui ne',
  'ha giang',
  'ho chi minh',
  'sai gon',
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_DAY = /^\d{4}-\d{2}$/;

function cleanDate(value) {
  const text = String(value ?? '').trim();
  if (ISO_DATE.test(text)) return text;
  if (MONTH_DAY.test(text)) return { month: text };
  return null;
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function endOfMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return `${monthKey}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`;
}

/** Chuẩn hoá JSON bộ lọc của LLM (hoặc của mock) về đúng một dạng. */
export function normalizeFilters(raw) {
  const out = { from: null, to: null, places: [], tags: [], kinds: [], members: [] };
  const from = cleanDate(raw?.from);
  const to = cleanDate(raw?.to);
  if (typeof from === 'string') out.from = from;
  if (typeof to === 'string') out.to = to;
  // LLM hay trả "2026-08" cho tháng → mở rộng thành cả tháng.
  if (from && typeof from === 'object') out.from = `${from.month}-01`;
  if (to && typeof to === 'object') out.to = endOfMonth(to.month);
  if (!out.to && out.from && typeof from === 'object') out.to = endOfMonth(from.month);
  if (!out.from && out.to && typeof to === 'object') out.from = `${to.month}-01`;

  const list = (value, max = 6) =>
    (Array.isArray(value) ? value : [])
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length >= 2 && item.length <= 60)
      .slice(0, max);
  out.places = list(raw?.places);
  out.tags = list(raw?.tags);
  out.kinds = list(raw?.kinds).filter((kind) => Object.hasOwn(KIND_WORDS, kind));
  out.members = list(raw?.members);
  return out;
}

/** Tìm từ khoá khi không có LLM: đoán tháng/năm/loại từ chính câu người dùng. */
export function keywordFilters(query, { today = new Date() } = {}) {
  const text = deaccent(query);
  const year = today.getUTCFullYear();
  const filters = { from: null, to: null, places: [], tags: [], kinds: [], members: [] };

  const explicitYear = text.match(/\b(19|20)\d{2}\b/);
  const targetYear = explicitYear ? Number(explicitYear[0]) : /nam nay/.test(text) ? year : null;
  const month = text.match(/thang\s*(\d{1,2})/);
  if (month && Number(month[1]) >= 1 && Number(month[1]) <= 12) {
    const y = targetYear ?? year;
    const key = `${y}-${String(Number(month[1])).padStart(2, '0')}`;
    filters.from = `${key}-01`;
    filters.to = endOfMonth(key);
  } else if (/nam nay/.test(text)) {
    filters.from = `${year}-01-01`;
    filters.to = `${year}-12-31`;
  } else if (targetYear) {
    filters.from = `${targetYear}-01-01`;
    filters.to = `${targetYear}-12-31`;
  }

  for (const [kind, words] of Object.entries(KIND_WORDS)) {
    if (words.some((word) => text.includes(word))) filters.kinds.push(kind);
  }
  for (const place of PLACE_WORDS) {
    if (text.includes(place)) filters.places.push(place);
  }
  if (/banh kem/.test(text)) filters.tags.push('bánh kem');
  if (/\bbien\b/.test(text)) filters.tags.push('biển');
  return filters;
}

/** Tên thành viên có trong câu ("sinh nhật Su") → lọc theo người được gắn. */
export function matchMembers(db, familyId, query) {
  const text = deaccent(query);
  const members = db.prepare('SELECT id, name FROM members WHERE family_id = ?').all(Number(familyId));
  return members
    .filter((member) => member.name && member.name.length >= 2 && text.includes(deaccent(member.name)))
    .map((member) => member.name);
}

function loadCandidates(db, familyId) {
  const rows = db
    .prepare(
      `SELECT m.*, c.kind AS collection_kind, c.title AS collection_title
       FROM media m LEFT JOIN collections c ON c.id = m.collection_id
       WHERE m.family_id = ? AND m.hidden = 0
       ORDER BY m.id`,
    )
    .all(Number(familyId));
  if (rows.length === 0) return [];
  const memberRows = db
    .prepare(
      `SELECT mm.media_id, mem.name FROM media_members mm
       JOIN members mem ON mem.id = mm.member_id WHERE mem.family_id = ?`,
    )
    .all(Number(familyId));
  const byMedia = new Map();
  for (const row of memberRows) {
    const list = byMedia.get(Number(row.media_id)) ?? [];
    list.push(row.name);
    byMedia.set(Number(row.media_id), list);
  }
  for (const row of rows) {
    row.member_names = byMedia.get(row.id) ?? [];
    row.date = String(row.taken_at ?? row.created_at ?? '').slice(0, 10);
    row.haystack = [
      deaccent(row.ai_caption ?? ''),
      deaccent(parseTags(row.ai_tags).join(' ')),
      deaccent(row.place ?? ''),
      deaccent(row.country ?? ''),
      deaccent(row.collection_title ?? ''),
    ].join(' | ');
  }
  return rows;
}

const includesLoose = (haystack, value) => {
  const needle = deaccent(value);
  return needle.length >= 2 && haystack.includes(needle);
};

function matchesFilters(row, filters) {
  if (filters.from && row.date && row.date < filters.from) return false;
  if (filters.to && row.date && row.date > filters.to) return false;
  if (filters.places.length && !filters.places.some((place) => includesLoose(row.haystack, place))) return false;
  if (filters.tags.length && !filters.tags.some((tag) => includesLoose(row.haystack, tag))) return false;
  if (filters.members.length) {
    const names = row.member_names.map(deaccent);
    if (!filters.members.some((name) => names.some((own) => own.includes(deaccent(name))))) return false;
  }
  if (filters.kinds.length) {
    const kindOk = filters.kinds.some(
      (kind) =>
        row.collection_kind === kind ||
        row.ai_kind_hint === kind ||
        (KIND_WORDS[kind] ?? []).some((word) => row.haystack.includes(word)),
    );
    if (!kindOk) return false;
  }
  return true;
}

/** Điểm khớp: caption nặng nhất, rồi tới tag/nơi/tiêu đề mục, cộng điểm ảnh đẹp của AI. */
export function scoreRow(row, tokens, filters) {
  let score = 0;
  const caption = deaccent(row.ai_caption ?? '');
  for (const token of tokens) {
    if (caption.includes(token)) score += 3;
    if (row.haystack.includes(token)) score += 1;
  }
  for (const place of filters.places) if (includesLoose(row.haystack, place)) score += 4;
  for (const tag of filters.tags) if (includesLoose(row.haystack, tag)) score += 3;
  for (const kind of filters.kinds) {
    if (row.collection_kind === kind || row.ai_kind_hint === kind) score += 2;
  }
  if (filters.members.length && row.member_names.length) score += 2;
  return score + (row.ai_score ?? 0) / 10;
}

/**
 * Tìm ảnh bằng câu nói thường:
 * LLM (hoặc heuristic) → bộ lọc → chấm điểm → sắp theo độ khớp rồi `ai_score`.
 * Bộ lọc quá chặt (0 kết quả) thì nới dần: người → loại → nơi/tag → ngày.
 */
export async function searchPhotos(db, familyId, { q, limit = SEARCH_LIMIT_DEFAULT, provider = null, today = new Date() } = {}) {
  const query = String(q ?? '').trim();
  const cap = Math.min(SEARCH_LIMIT_MAX, Math.max(1, Number(limit) || SEARCH_LIMIT_DEFAULT));
  const tokens = queryTokens(query);

  let filters = keywordFilters(query, { today });
  let source = 'keyword';
  if (provider?.searchFilters) {
    try {
      const raw = await provider.searchFilters({ query, today: today.toISOString().slice(0, 10) });
      if (raw && typeof raw === 'object') {
        const parsed = normalizeFilters(raw);
        // LLM trả rỗng (không hiểu câu) → giữ bộ lọc từ khoá thay vì trả cả album.
        const empty =
          !parsed.from &&
          !parsed.to &&
          parsed.places.length === 0 &&
          parsed.tags.length === 0 &&
          parsed.kinds.length === 0 &&
          parsed.members.length === 0;
        if (!empty) {
          filters = parsed;
          source = 'ai';
        }
      }
    } catch {
      /* LLM lỗi → giữ bộ lọc từ khoá */
    }
  }
  if (!filters.members.length) {
    const names = matchMembers(db, familyId, query);
    if (names.length) filters.members = names;
  }

  const rows = loadCandidates(db, familyId);
  const attempts = [
    filters,
    { ...filters, members: [] },
    { ...filters, members: [], kinds: [] },
    { ...filters, members: [], kinds: [], places: [], tags: [] },
    { ...filters, members: [], kinds: [], places: [], tags: [], from: null, to: null },
  ];

  let matched = [];
  let used = null;
  for (const attempt of attempts) {
    matched = rows.filter((row) => matchesFilters(row, attempt));
    if (matched.length > 0) {
      used = attempt;
      filters = { ...filters, ...attempt };
      break;
    }
  }

  // LLM hiểu sai (0 kết quả, hoặc phải nới sạch bộ lọc) → thử bộ lọc từ khoá;
  // chỉ nhận nếu nó cho kết quả ít hơn/đúng hơn "cả album".
  const cleared =
    used != null &&
    !used.from &&
    !used.to &&
    used.places.length === 0 &&
    used.tags.length === 0 &&
    used.kinds.length === 0 &&
    used.members.length === 0;
  if (source === 'ai' && (matched.length === 0 || cleared)) {
    const keyword = keywordFilters(query, { today });
    const hits = rows.filter((row) => matchesFilters(row, keyword));
    if (hits.length > 0 && (matched.length === 0 || hits.length <= matched.length)) {
      matched = hits;
      filters = keyword;
      source = 'keyword';
    }
  }

  // FTS5: ảnh khớp đủ từ khoá được cộng nhẹ để đứng trước.
  const ftsHits = tokens.length ? searchMediaIds(db, tokens.join(' '), { familyId, limit: 200 }) : null;
  const ftsBonus = new Map((ftsHits ?? []).map((hit) => [hit.mediaId, 1.5]));

  const ranked = matched
    .map((row) => ({
      row,
      score: scoreRow(row, tokens, filters) + (ftsBonus.get(row.id) ?? 0),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        String(b.row.date).localeCompare(String(a.row.date)) ||
        b.row.id - a.row.id,
    )
    .slice(0, cap);

  const results = ranked.map((item) => serializeMedia(item.row));
  const collectionIds = [...new Set(ranked.map((item) => item.row.collection_id).filter((id) => id != null))];
  const collections = collectionIds.slice(0, SEARCH_COLLECTION_LIMIT).map((id) => {
    const row = db
      .prepare('SELECT * FROM collections WHERE id = ? AND family_id = ?')
      .get(Number(id), Number(familyId));
    return row ? serializeCollection(db, row) : null;
  });

  return {
    query,
    filters: {
      from: filters.from ?? null,
      to: filters.to ?? null,
      places: filters.places,
      tags: filters.tags,
      kinds: filters.kinds,
      members: filters.members,
    },
    source,
    results,
    collections: collections.filter(Boolean),
  };
}
