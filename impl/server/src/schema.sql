-- Lược đồ Hành Trình r2 — web kỷ niệm gia đình.
-- Mọi thời điểm lưu dạng ISO-8601 UTC (TEXT).
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------ gia đình
CREATE TABLE IF NOT EXISTS families (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  slug       TEXT    NOT NULL,
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_families_slug ON families(slug);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  email         TEXT    NOT NULL UNIQUE,
  display_name  TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  avatar        TEXT,
  avatar_color  TEXT,
  family_id     INTEGER REFERENCES families(id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_family ON users(family_id);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL,
  expires_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Người trong nhà, gắn tay vào ảnh/mục (không nhất thiết có tài khoản).
CREATE TABLE IF NOT EXISTS members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id  INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  color      TEXT,
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_members_family ON members(family_id);

-- ------------------------------------------------------- chuyến đi kiểu r1
-- Giữ lại để dữ liệu r1 còn đọc được; trang web r2 không dùng.
CREATE TABLE IF NOT EXISTS trips (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id  INTEGER REFERENCES families(id) ON DELETE SET NULL,
  name       TEXT    NOT NULL,
  slug       TEXT    NOT NULL,
  visibility TEXT    NOT NULL DEFAULT 'private'
             CHECK (visibility IN ('private', 'link', 'public')),
  timezone   TEXT    NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  started_at TEXT,
  ended_at   TEXT,
  views      INTEGER NOT NULL DEFAULT 0,
  likes      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_family ON trips(family_id);

CREATE TABLE IF NOT EXISTS steps (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  description  TEXT,
  started_at   TEXT,
  lat          REAL,
  lon          REAL,
  place_name   TEXT,
  country_code TEXT,
  country_name TEXT,
  weather_temp_c REAL,
  weather_icon TEXT,
  comments     INTEGER NOT NULL DEFAULT 0,
  likes        INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  auto         INTEGER NOT NULL DEFAULT 1, -- 1: do máy chia, 0: người dùng đã can thiệp
  draft_name   TEXT,
  draft_description TEXT,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_steps_trip ON steps(trip_id, started_at);
CREATE INDEX IF NOT EXISTS idx_steps_order ON steps(trip_id, sort_order);

-- ------------------------------------------------------------------ mục ảnh
CREATE TABLE IF NOT EXISTS collections (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id      INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  kind           TEXT    NOT NULL DEFAULT 'other'
                 CHECK (kind IN ('trip', 'birthday', 'tet', 'holiday', 'weekend',
                                 'everyday', 'baby', 'other')),
  title          TEXT    NOT NULL,
  summary        TEXT,
  place          TEXT,
  start_at       TEXT,
  end_at         TEXT,
  cover_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  status         TEXT    NOT NULL DEFAULT 'suggested'
                 CHECK (status IN ('suggested', 'accepted')),
  source         TEXT    NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'user')),
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_collections_family ON collections(family_id, start_at);
CREATE INDEX IF NOT EXISTS idx_collections_kind ON collections(family_id, kind);

-- --------------------------------------------------------------------- ảnh
-- `trip_id`/`step_id` còn cho dữ liệu r1; ảnh r2 thuộc gia đình + mục.
CREATE TABLE IF NOT EXISTS media (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id       INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  uploader_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  trip_id         INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  step_id         INTEGER REFERENCES steps(id) ON DELETE SET NULL,
  collection_id   INTEGER REFERENCES collections(id) ON DELETE SET NULL,
  type            TEXT    NOT NULL CHECK (type IN ('photo', 'video')),
  code            TEXT    NOT NULL UNIQUE,
  ext             TEXT    NOT NULL,
  orig_name       TEXT,
  width           INTEGER,
  height          INTEGER,
  duration        REAL,
  taken_at        TEXT,
  lat             REAL,
  lon             REAL,
  place           TEXT,
  country         TEXT,
  order_index     INTEGER NOT NULL DEFAULT 0,
  blurry          INTEGER NOT NULL DEFAULT 0,
  near_duplicate  INTEGER NOT NULL DEFAULT 0,
  hidden          INTEGER NOT NULL DEFAULT 0,
  auto            INTEGER NOT NULL DEFAULT 1,
  ai_status       TEXT    NOT NULL DEFAULT 'pending'
                  CHECK (ai_status IN ('pending', 'done', 'failed', 'skipped')),
  ai_caption      TEXT,
  ai_tags         TEXT,   -- JSON array từ khoá tiếng Việt
  ai_score        INTEGER CHECK (ai_score IS NULL OR (ai_score BETWEEN 1 AND 10)),
  ai_kind_hint    TEXT,
  dhash           TEXT,   -- dấu vân tay 64-bit (dHash) để phát hiện ảnh gần trùng
  created_at      TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_family ON media(family_id, taken_at);
CREATE INDEX IF NOT EXISTS idx_media_collection ON media(collection_id);
CREATE INDEX IF NOT EXISTS idx_media_trip ON media(trip_id, step_id, order_index);
CREATE INDEX IF NOT EXISTS idx_media_step ON media(step_id);
CREATE INDEX IF NOT EXISTS idx_media_ai_status ON media(family_id, ai_status);

CREATE TABLE IF NOT EXISTS media_members (
  media_id  INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_media_members_member ON media_members(member_id);

CREATE TABLE IF NOT EXISTS collection_members (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  member_id     INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_collection_members_member ON collection_members(member_id);

-- Gợi ý của AI cho người dùng nhận/bỏ qua (ẩn ảnh mờ, gộp, tách, đổi tên).
CREATE TABLE IF NOT EXISTS suggestions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id     INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
  media_id      INTEGER REFERENCES media(id) ON DELETE CASCADE,
  type          TEXT    NOT NULL
                CHECK (type IN ('hide_blurry', 'merge', 'split', 'rename')),
  text          TEXT    NOT NULL,
  payload       TEXT,   -- JSON: {intoId}, {mediaId}, {title}…
  status        TEXT    NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'accepted', 'dismissed')),
  created_at    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_suggestions_family ON suggestions(family_id, status);
-- Mỗi đối tượng chỉ có một gợi ý đang mở cho mỗi loại.
CREATE UNIQUE INDEX IF NOT EXISTS idx_suggestions_open
  ON suggestions(type, IFNULL(media_id, 0), IFNULL(collection_id, 0))
  WHERE status = 'open';

-- Câu mở đầu trang tổng kết, cache theo gia đình + năm (không gọi LLM lại mỗi lần xem).
CREATE TABLE IF NOT EXISTS recaps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id  INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  year       INTEGER NOT NULL,
  stats_hash TEXT    NOT NULL,
  intro      TEXT    NOT NULL,
  source     TEXT    NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'sample')),
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recaps_family_year ON recaps(family_id, year);

CREATE TABLE IF NOT EXISTS segments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_step_id INTEGER NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  to_step_id   INTEGER NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  vehicle      TEXT    NOT NULL DEFAULT 'none',
  kind         TEXT    NOT NULL DEFAULT 'straight',
  polyline     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_segments_trip ON segments(trip_id);
