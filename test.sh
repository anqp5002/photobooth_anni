#!/usr/bin/env bash
# test.sh <thư mục impl> — Hành Trình r2 (QA)
# 1) cài deps nếu thiếu            2) build web (Vite)         3) server DB tạm + seed-family.js
# 4) test API hợp đồng (node:test) 5) Playwright smoke 9 trang  6) dọn tiến trình, exit 0 khi pass hết
#
# Dùng: bash test.sh impl        (mặc định PORT=8971)
# Biến môi trường: TEST_PORT, BASE_URL, KEEP=1 (giữ DB tạm để debug)
set -u

IMPL="${1:-impl}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
TESTS="$ROOT/tests"
IMPL_DIR="$ROOT/$IMPL"
PORT="${TEST_PORT:-8971}"
BASE_URL="${BASE_URL:-http://127.0.0.1:$PORT}"
SERVER_PID=""
TMPDIR_DB=""
API_RC=0
WEB_RC=0

log() { printf '[test.sh] %s\n' "$*"; }

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    taskkill //F //T //PID "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$TMPDIR_DB" ] && [ -d "$TMPDIR_DB" ] && [ "${KEEP:-0}" != "1" ]; then
    rm -rf "$TMPDIR_DB" 2>/dev/null || true
  elif [ -n "$TMPDIR_DB" ]; then
    log "giữ DB tạm: $TMPDIR_DB"
  fi
}
trap cleanup EXIT

log "root: $ROOT"
log "impl: $IMPL_DIR"
log "cổng: $PORT"

# --- 1) cài deps nếu thiếu ---
cd "$TESTS" || { echo "thiếu tests/"; exit 2; }
if [ ! -d node_modules ]; then
  log "npm install (tests)"
  npm install --no-audit --no-fund || exit 2
fi
if ! npx playwright --version >/dev/null 2>&1; then
  log "cài Playwright"
  npm install --no-audit --no-fund || exit 2
fi
if [ ! -d "$HOME/AppData/Local/ms-playwright" ] || [ -z "$(ls "$HOME/AppData/Local/ms-playwright" 2>/dev/null | grep -i chromium 2>/dev/null)" ]; then
  log "npx playwright install chromium"
  npx playwright install chromium || exit 2
fi

# --- 2) build web ---
if [ -f "$IMPL_DIR/web/package.json" ]; then
  (
    cd "$IMPL_DIR/web" || exit 1
    [ -d node_modules ] || { log "npm install (web)"; npm install --no-audit --no-fund; }
    log "npm run build (web)"
    npm run build
  ) || log "CẢNH BÁO: build web lỗi — web pane (w1:pP) phụ trách"
else
  log "CẢNH BÁO: không thấy $IMPL_DIR/web/package.json"
fi

# --- 3) DB tạm + seed gia đình "Nhà Bin & Su" ---
TMPDIR_DB="$(mktemp -d -t ht_db_XXXXXXXX 2>/dev/null || echo "$TESTS/.tmp-db")"
mkdir -p "$TMPDIR_DB"
WIN_DB="$(cygpath -w "$TMPDIR_DB" 2>/dev/null || echo "$TMPDIR_DB")"
log "DB tạm: $TMPDIR_DB"

if [ -f "$IMPL_DIR/server/package.json" ]; then
  (
    cd "$IMPL_DIR/server" || exit 1
    [ -d node_modules ] || { log "npm install (server)"; npm install --no-audit --no-fund; }
    log "seed-family.js (gia đình Nhà Bin & Su: bo@bin-su.vn / me@bin-su.vn)"
    DB_PATH="$WIN_DB\\db.sqlite" MEDIA_DIR="$WIN_DB\\media" node scripts/seed-family.js \
      || { log "CẢNH BÁO: seed lỗi — qa pane phụ trách"; touch "$TMPDIR_DB/.seed-fail"; }
  )
  (
    cd "$IMPL_DIR/server" || exit 1
    log "chạy server PORT=$PORT (AI_PROVIDER=mock)"
    DB_PATH="$WIN_DB\\db.sqlite" MEDIA_DIR="$WIN_DB\\media" PORT="$PORT" HOST="127.0.0.1" AI_PROVIDER=mock \
      node src/index.js >"$TMPDIR_DB/server.log" 2>&1 &
    echo $! > "$TMPDIR_DB/server.pid"
  )
  SERVER_PID="$(cat "$TMPDIR_DB/server.pid" 2>/dev/null || echo '')"
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null "http://127.0.0.1:$PORT/api/health"; then
      log "server sẵn sàng"
      break
    fi
    sleep 0.5
  done
else
  log "CẢNH BÁO: không thấy $IMPL_DIR/server/package.json"
fi

# --- 4) test API hợp đồng (node:test, dựng app trong tiến trình) ---
cd "$TESTS" || exit 2
log "test API hợp đồng r2 (node --test api/r2-contract.test.mjs)"
node --test api/r2-contract.test.mjs
API_RC=$?
log "test API exit code = $API_RC"

log "test dữ liệu giả (node mock-contract.mjs)"
node mock-contract.mjs
MOCK_RC=$?
log "test mock exit code = $MOCK_RC"

# --- 5) Playwright smoke 9 trang ---
log "Playwright smoke (9 trang, 1440 + 390)"
TEST_PORT="$PORT" BASE_URL="$BASE_URL" npx playwright test --config=playwright.config.ts
WEB_RC=$?

log "kết thúc: API=$API_RC MOCK=$MOCK_RC WEB=$WEB_RC"
if [ "$API_RC" -ne 0 ] || [ "$WEB_RC" -ne 0 ] || [ "$MOCK_RC" -ne 0 ]; then
  log "CÓ TEST ĐỎ — xem REPORT_Q4.md (danh sách test đỏ và pane chịu trách nhiệm)"
  exit 1
fi
log "TẤT CẢ PASS"
exit 0
