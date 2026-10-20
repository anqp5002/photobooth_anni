#!/usr/bin/env bash
# Chạy một lệnh với key FreeLLM nạp từ máy (không in key ra màn hình).
# Dùng: bash scripts/with-ai.sh node src/index.js
# Key nằm ngoài dự án; KHÔNG đọc, KHÔNG in, KHÔNG chép file key vào dự án.
KEY_FILE="/d/hdv/backend/.env"
if [ -f "$KEY_FILE" ]; then
  FREELLM_API_KEY="$(grep -E '^FREELLM_API_KEY=' "$KEY_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
  export FREELLM_API_KEY
fi
export FREELLM_BASE_URL="${FREELLM_BASE_URL:-http://127.0.0.1:3001}"
export AI_PROVIDER="${AI_PROVIDER:-freellm}"
exec "$@"
