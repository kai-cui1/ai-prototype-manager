#!/usr/bin/env bash
# =============================================================================
# 环境服务重启脚本 — 清理残留进程 + 启动指定环境的服务
#
# 用法: ./environments/restart-env.sh <env-name>
# 示例: ./environments/restart-env.sh dev1
#       ./environments/restart-env.sh dev2
#
# 注意：本脚本只负责清理旧进程和启动新进程，不会自动迁移数据。
#       DB 数据库由外部管理（Docker / 本地 PostgreSQL），不在本脚本范围内。
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENTS_DIR="$PROJECT_ROOT/environments"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
  echo "用法: $0 <环境名>"
  echo ""
  echo "可用环境:"
  for f in "$ENVIRONMENTS_DIR"/*.json; do
    [ -f "$f" ] || continue
    local name="$(basename "$f" .json)"
    local web_port=$(python3 -c "import json; print(json.load(open('$f'))['web']['port'])" 2>/dev/null || echo "?")
    local api_port=$(python3 -c "import json; print(json.load(open('$f'))['api']['port'])" 2>/dev/null || echo "?")
    echo "  $name  (Web=$web_port API=$api_port)"
  done
  exit 1
}

log() { echo -e "${GREEN}[restart-env]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[restart-env]${NC} $*"; }
log_err() { echo -e "${RED}[restart-env]${NC} $*"; }

# 参数检查
if [ $# -lt 1 ]; then usage; fi
ENV_NAME="$1"
ENV_FILE="$ENVIRONMENTS_DIR/${ENV_NAME}.json"

if [ ! -f "$ENV_FILE" ]; then
  log_err "环境定义不存在: $ENV_FILE"
  echo "可用环境:"
  ls "$ENVIRONMENTS_DIR"/*.json 2>/dev/null | xargs -I{} basename {} .json | sed 's/^/  /  /'
  exit 1
fi

# 读取环境配置
WEB_PORT=$(python3 -c "import json; print(json.load(open('$ENV_FILE'))['web']['port'])")
API_PORT=$(python3 -c "import json; print(json.load(open('$ENV_FILE'))['api']['port'])")
DB_PORT=$(python3 -c "import json; print(json.load(open('$ENV_FILE'))['db']['port'])")

log "===== 环境 [$ENV_NAME] 服务清理 & 重启 ======"
log "Web 端口 :$WEB_PORT"
log "API 端口 :$API_PORT"
log "DB 端口  :$DB_PORT"
echo ""

# ---- Step 1: 更新 .active ----
echo "$ENV_NAME" > "$ENVIRONMENTS_DIR/.active"
log "已激活环境: $ENV_NAME"

# ---- Step 2: 清理占用目标端口的进程 ----
cleanup_port() {
  local port="$1"
  local service_name="$2"

  local pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -z "$pids" ]; then
    log "$service_name (:$port) — 无残留进程，跳过"
    return 0
  fi

  log_warn "$service_name (:$port) — 发现残留进程，正在终止..."
  for pid in $pids; do
    local cmd=$(ps -p "$pid" -o command= 2>/dev/null | tail -1)
    log "  终止 PID=$pid ($cmd)"
    kill "$pid" 2>/dev/null || true
  done

  # 等待端口释放（最多等 3 秒）
  local wait=0
  while [ $wait -lt 3 ]; do
    if ! lsof -ti ":$port" >/dev/null 2>&1; then
      break
    fi
    sleep 1
    wait=$((wait + 1))
  done

  # 最终确认
  if lsof -ti ":$port" >/dev/null 2>&1; then
    log_err "$service_name (:$port) — 端口仍被占用，可能需要手动 kill -9"
  else
    log "$service_name (:$port) — 端口已释放 ✅"
  fi
}

echo ""
cleanup_port "$WEB_PORT" "Web 前端(Vite)"
cleanup_port "$API_PORT" "API 后端(Fastify)"

# ---- Step 3: 启动服务 ----
echo ""
log "===== 启动 [$ENV_NAME] 服务 ======"
log "正在启动 dev server (Web:$WEB_PORT + API:$API_PORT)..."
log ""
log "提示：如果启动后出现 EPERM 错误，可能是 macOS com.apple.provenance 属性导致。"
log "      可尝试: xattr -cr $PROJECT_ROOT （需要 sudo 或关闭 SIP）"
log ""

# 在项目根目录启动 turbo/dev（注入环境端口变量）
cd "$PROJECT_ROOT"
export WEB_PORT="$WEB_PORT"
export API_PORT="$API_PORT"
export DB_PORT="$DB_PORT"
pnpm dev &
DEV_PID=$!

log "dev server 已启动 (PID: $DEV_PID)"
log "等待服务就绪..."
echo ""

# 等待 Web 端口可达（最多 30 秒）
wait_count=0
while [ $wait_count -lt 30 ]; do
  if curl -s -o /dev/null --max-time 2 "http://localhost:${WEB_PORT}/" >/dev/null 2>&1; then
    log "✅ Web 前端已就绪 (http://localhost:${WEB_PORT}/)"
    break
  fi
  sleep 1
  wait_count=$((wait_count + 1))
  if [ $((wait_count % 5)) -eq 0 ]; then
    log "  ... 等待中 (${wait_count}s)"
  fi
done

if [ $wait_count -ge 30 ]; then
  log_err "❌ Web 前端 30s 内未就绪，请手动检查"
else
  # 等待 API 端口可达
  wait_count=0
  while [ $wait_count -lt 15 ]; do
    if curl -s -o /dev/null --max-time 2 "http://localhost:${API_PORT}/api/v1/projects" >/dev/null 2>&1; then
      log "✅ API 后端已就绪 (http://localhost:${API_PORT}/)"
      break
    fi
    sleep 1
    wait_count=$((wait_count + 1))
  done
  [ $wait_count -ge 15 ] && log_warn "⚠️ API 后端 15s 内未响应（可能正常，API 可能更慢启动）"
fi

echo ""
log "============================================="
log "  环境 [$ENV_NAME] 已启动"
log "  Web: http://localhost:${WEB_PORT}/"
log "  API: http://localhost:${API_PORT}/api/v1"
log "  DB:  localhost:${DB_PORT}"
log "============================================="
log ""
log "如需停止服务:  Ctrl+C 或 kill $DEV_PID"
