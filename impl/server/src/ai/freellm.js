import sharp from 'sharp';
import { keywordFilters } from '../search.js';

/** Mặc định đúng MEGAPLAN: 127.0.0.1 (KHÔNG dùng localhost). */
export const DEFAULT_FREELLM_BASE_URL = 'http://127.0.0.1:3001';

/**
 * Ảnh nhỏ gửi kèm cho LLM: JPEG, cạnh dài 384 px (tiết kiệm token, vẫn đọc được cảnh).
 * @returns {Promise<string>} data URL
 */
export async function imageDataUrl(filePath, { size = 384, quality = 72 } = {}) {
  const buffer = await sharp(filePath, { failOn: 'none' })
    .rotate()
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

/**
 * Parse JSON "an toàn": bỏ khối ```json, lấy {...} đầu tiên, bỏ dấu phẩy thừa.
 * Trả `null` khi không cứu được (nơi gọi tự quyết định lỗi).
 */
export function parseJsonLoose(text) {
  if (text && typeof text === 'object') return text;
  let raw = String(text ?? '').trim();
  if (!raw) return null;
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) raw = raw.slice(first, last + 1);
  raw = raw.replace(/,\s*([}\]])/g, '$1');
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

const KINDS = new Set(['trip', 'birthday', 'tet', 'holiday', 'weekend', 'everyday', 'baby', 'other']);

/** Chuẩn hoá kết quả LLM về đúng kiểu ta cần; thiếu thì bỏ qua từng trường. */
export function normalizeAnalysis(raw, { seed = '' } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const caption = String(raw.caption ?? '').trim().slice(0, 300);
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .map((tag) => String(tag ?? '').trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const scoreNumber = Number(raw.score);
  const score = Number.isFinite(scoreNumber) ? Math.min(10, Math.max(1, Math.round(scoreNumber))) : null;
  const hint = String(raw.kind_hint ?? raw.kindHint ?? '').trim().toLowerCase();
  return {
    caption: caption || null,
    tags,
    score,
    kindHint: KINDS.has(hint) ? hint : null,
    seed,
  };
}

const CAPTIONS = [
  'Cả nhà quây quần bên nhau',
  'Một buổi chiều yên ả',
  'Khoảnh khắc đáng nhớ của gia đình',
  'Nụ cười của bọn trẻ',
  'Bữa ăn ấm cúng',
  'Cảnh đẹp trên đường đi',
  'Một ngày nắng đẹp',
  'Kỷ niệm nhỏ, nhớ lâu',
];
const TAGS = [
  'gia đình',
  'bọn trẻ',
  'du lịch',
  'biển',
  'núi',
  'đồ ăn',
  'sinh nhật',
  'Tết',
  'bánh kem',
  'nụ cười',
  'hoàng hôn',
  'cà phê',
];

function hashSeed(seed) {
  let hash = 7;
  for (const char of String(seed)) hash = (hash * 31 + char.codePointAt(0)) % 1000003;
  return hash;
}

/** Kết quả cố định theo tên tệp/mã ảnh — dùng cho test và khi `AI_PROVIDER=mock`. */
export function mockAnalysis(seed = '') {
  const hash = hashSeed(seed);
  return {
    caption: CAPTIONS[hash % CAPTIONS.length],
    tags: [TAGS[hash % TAGS.length], TAGS[(hash + 3) % TAGS.length], TAGS[(hash + 7) % TAGS.length]]
      .filter((tag, index, all) => all.indexOf(tag) === index),
    score: 5 + (hash % 5),
    kindHint: ['trip', 'birthday', 'tet', 'weekend', 'everyday'][hash % 5],
    seed,
  };
}

const SYSTEM_PROMPT =
  'Bạn là người viết chú thích ảnh cho album gia đình Việt Nam. ' +
  'Chỉ trả về MỘT đối tượng JSON, không kèm giải thích, đúng dạng: ' +
  '{"caption":"một câu tiếng Việt có dấu mô tả ảnh","tags":["tối đa 8 từ khoá tiếng Việt"],' +
  '"kind_hint":"trip|birthday|tet|holiday|weekend|everyday|baby|other","score":1-10}. ' +
  'score là độ đẹp/đáng nhớ (1–10). Không bịa tên người không thấy trong ảnh.';

/**
 * Client OpenAI-compatible cho FreeLLMAPI (router local).
 * Timeout 60 s mỗi lần, thử lại `retries` lần (mặc định 2) khi lỗi mạng/JSON.
 */
export function createFreeLlmClient({
  baseUrl = DEFAULT_FREELLM_BASE_URL,
  apiKey = '',
  model = 'auto',
  timeoutMs = 60_000,
  retries = 2,
  fetchImpl = globalThis.fetch,
} = {}) {
  const url = `${String(baseUrl).replace(/\/+$/, '')}/v1/chat/completions`;

  async function once(messages) {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, messages, temperature: 0.2 }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`FreeLLM ${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') throw new Error('FreeLLM trả rỗng');
    return content;
  }

  /** Gọi lại khi lỗi (mặc định tổng 3 lượt), trả nội dung thô của trợ lý. */
  async function request(messages) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await once(messages);
      } catch (err) {
        lastError = err;
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
    throw lastError ?? new Error('FreeLLM lỗi');
  }

  return {
    model,
    url,
    /** Gửi ảnh + ngữ cảnh, nhận JSON đã chuẩn hoá; ném lỗi sau khi hết lượt thử. */
    async analyzePhoto({ dataUrl, takenAt = null, place = null, seed = '' }) {
      const lines = [
        `Ngày giờ chụp: ${takenAt ?? 'không rõ'}.`,
        `Nơi chụp: ${place ?? 'không rõ'}.`,
        'Hãy mô tả ảnh gia đình này bằng tiếng Việt.',
      ];
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: lines.join(' ') },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ];
      const raw = await this.chatJson({ messages });
      const out = normalizeAnalysis(raw, { seed });
      if (!out || !out.caption) throw new Error('FreeLLM thiếu caption');
      return out;
    },

    /** Gọi chỉ bằng chữ (đặt tên mục, hiểu câu tìm kiếm…), trả JSON thô đã parse. */
    async chatJson({ system = null, user = null, messages = null }) {
      const payload =
        messages ?? [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: user ?? '' },
        ];
      const content = await request(payload);
      const parsed = parseJsonLoose(content);
      if (!parsed) throw new Error('FreeLLM trả JSON không đọc được');
      return parsed;
    },

    /** Gọi chỉ bằng chữ, trả nguyên văn (dùng cho lời mở đầu tổng kết). */
    async chatText({ system = null, user = null }) {
      const payload = [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user ?? '' },
      ];
      return (await request(payload)).trim();
    },
  };
}

/**
 * Nhà cung cấp AI đang bật:
 * - `none`: không gọi mạng, trả null (hàng đợi ghi `ai_status='skipped'`)
 * - `mock`: kết quả cố định theo tên tệp/mã ảnh
 * - `freellm` (hoặc URL http…): gọi router local
 */
export function createAiProvider(config = {}) {
  const provider = String(config.aiProvider ?? config.provider ?? 'none').toLowerCase();
  if (provider === 'none' || provider === '') {
    return { name: 'none', analyzePhoto: null };
  }
  if (provider === 'mock') {
    return {
      name: 'mock',
      analyzePhoto: async ({ seed }) => mockAnalysis(seed),
      describeCollection: async ({ place, count, from, to, kindHint }) => {
        const month = from ? Number(String(from).slice(5, 7)) : null;
        const where = place ? ` ở ${place}` : '';
        return {
          kind: kindHint ?? 'everyday',
          title: `${kindHint === 'trip' ? 'Chuyến đi' : 'Kỷ niệm'} tháng ${month ?? '?'}${where}`,
          summary: `${count} ảnh${where}${from ? `, từ ${String(from).slice(0, 10)}` : ''}${
            to ? ` đến ${String(to).slice(0, 10)}` : ''
          }.`,
        };
      },
      recapIntro: async ({ sample }) => sample,
      // Mock hiểu câu bằng chính heuristic từ khoá → 4 câu mẫu của MEGAPLAN đều ra bộ lọc.
      searchFilters: async ({ query, today }) =>
        keywordFilters(query, { today: new Date(`${today ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`) }),
    };
  }
  if (provider === 'freellm' || /^https?:\/\//.test(provider)) {
    const client = createFreeLlmClient({
      baseUrl: /^https?:\/\//.test(provider) ? provider : config.aiBaseUrl,
      apiKey: config.aiApiKey,
      model: config.aiModel,
      timeoutMs: config.aiTimeoutMs,
      retries: config.aiRetries,
    });
    return {
      name: 'freellm',
      provider: 'freellm',
      analyzePhoto: ({ dataUrl, takenAt, place, seed }) =>
        client.analyzePhoto({ dataUrl, takenAt, place, seed }),
      describeCollection: ({ captions, place, count, from, to, tetDates }) => {
        const lines = [
          `Có ${count} ảnh${place ? ` ở ${place}` : ''}, từ ${from ?? '?'} đến ${to ?? '?'}.`,
          captions.length ? `Chú thích từng ảnh:\n- ${captions.slice(0, 25).join('\n- ')}` : '',
          tetDates?.length ? `Tết âm lịch các năm: ${tetDates.join(', ')}.` : '',
          'Đặt tên ngắn cho mục ảnh gia đình này.',
        ].filter(Boolean);
        const system =
          'Bạn là người sắp xếp album ảnh gia đình Việt Nam. Chỉ trả về MỘT đối tượng JSON, không giải thích: ' +
          '{"kind":"trip|birthday|tet|holiday|weekend|everyday|baby|other","title":"tối đa 8 từ, tiếng Việt có dấu",' +
          '"summary":"2 câu tiếng Việt"}. Dùng kind "tet" khi ảnh rơi vào dịp Tết âm lịch, "trip" khi cả nhà đi xa.';
        return client.chatJson({ system, user: lines.join('\n') });
      },
      recapIntro: async ({ year, stats, topPlaces, sample }) => {
        const lines = [
          `Năm ${year}: ${stats.photos} ảnh, ${stats.videos} video, ${stats.places} nơi, ${stats.collections} mục, ${stats.trips} chuyến đi, ${stats.birthdays} sinh nhật.`,
          topPlaces?.length
            ? `Nơi nhiều ảnh nhất: ${topPlaces.map((item) => `${item.place} (${item.count})`).join(', ')}.`
            : '',
          `Câu mẫu: ${sample}`,
          'Viết lại thành lời mở đầu ấm áp cho trang tổng kết năm của gia đình.',
        ].filter(Boolean);
        const system =
          'Bạn viết lời mở đầu cho album tổng kết năm của một gia đình Việt Nam. ' +
          'Trả về đúng MỘT đoạn văn 2–3 câu, tiếng Việt có dấu, xưng "nhà mình", không dùng emoji, ' +
          'không đặt tiêu đề, không dùng dấu ngoặc kép, tối đa 400 ký tự.';
        return client.chatText({ system, user: lines.join('\n') });
      },
      searchFilters: async ({ query, today }) => {
        const system =
          'Bạn đổi câu tìm ảnh của gia đình Việt Nam thành bộ lọc. Chỉ trả về MỘT đối tượng JSON, không giải thích: ' +
          '{"from":"YYYY-MM-DD hoặc null","to":"YYYY-MM-DD hoặc null","places":["tên nơi"],' +
          '"tags":["từ khoá trong ảnh, ví dụ bánh kem, biển"],' +
          '"kinds":["trip|birthday|tet|holiday|weekend|everyday|baby|other"],"members":["tên người trong nhà"]}. ' +
          'Để trống mảng nếu câu không nhắc tới. "tháng 8" → from/to trong tháng 8 của năm hợp lý; ' +
          '"năm nay" → cả năm nay.';
        const user = `Hôm nay là ${today}. Câu tìm: "${query}".`;
        return client.chatJson({ system, user });
      },
    };
  }
  return { name: 'none', analyzePhoto: null };
}
