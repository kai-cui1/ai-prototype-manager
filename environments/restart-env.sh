#!/usr/bin/env bash
# =============================================================================
# 环境服务重启脚本 — 清理残留进程 + 启动指定环境的服务
#
# 用法: ./environments/restart-env.sh <env-name>
# 示例: ./environments/restart-env.sh dev1
#       ./environments/restart-env.sh dev2
#
# 本脚本内部调用 set-env.sh 激活环境（设置 DATABASE_URL 等环境变量），
# 然后执行进程清理和服务启动。如只需设置环境变量而不重启服务，请使用：
#   source environments/set-env.sh <env-name>
#
# 注意：本脚本只负责清理旧进程和启动新进程，不会自动迁移数据。
#       DB 数据库由外部管理（Docker / 本地 PostgreSQL），不在本脚本范围内。
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
  echo "用法: $0 <环境名>"
  echo ""
  echo "可用环境:"
  for f in "$SCRIPT_DIR"/*.json; do
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

# ---- Step 1: 通过 set-env.sh 激活环境（设置环境变量 + 更新 .active） ----
# set-env.sh 会 export DATABASE_URL, API_PORT, WEB_PORT, DB_PORT
if ! source "$SCRIPT_DIR/set-env.sh" "$ENV_NAME"; then
  log_err "环境激活失败，终止重启"
  exit 1
fi

# 此时环境变量已由 set-env.sh 设置
log "===== 环境 [$ENV_NAME] 服务清理 & 重启 ======"
echo ""

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
cleanup_port "$MCP_PORT" "MCP Server(Sidecar)"

# ---- Step 3: 启动服务 ----
echo ""
log "===== 启动 [$ENV_NAME] 服务 ======"
log "正在启动 dev server (Web:$WEB_PORT + API:$API_PORT)..."
log ""
log "提示：如果启动后出现 EPERM 错误，可能是 macOS com.apple.provenance 属性导致。"
log "      可尝试: xattr -cr $PROJECT_ROOT （需要 sudo 或关闭 SIP）"
log ""

# 在项目根目录启动 turbo/dev（环境变量已由 set-env.sh export）
cd "$PROJECT_ROOT"
pnpm dev &
DEV_PID=$!

# 启动 MCP Server（sidecar 进程）
log "正在启动 MCP Server (Sidecar :${MCP_PORT})..."
cd "$PROJECT_ROOT/packages/mcp" && pnpm dev &
MCP_PID=$!
cd "$PROJECT_ROOT"

log "dev server 已启动 (PID: $DEV_PID)"
log "MCP Server 已启动 (PID: $MCP_PID)"
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

# 等待 MCP Server 端口可达
wait_count=0
while [ $wait_count -lt 10 ]; do
  if curl -s -o /dev/null --max-time 2 "http://localhost:${MCP_PORT}/health" >/dev/null 2>&1; then
    log "✅ MCP Server 已就绪 (http://localhost:${MCP_PORT}/sse)"
    break
  fi
  sleep 1
  wait_count=$((wait_count + 1))
done
[ $wait_count -ge 10 ] && log_warn "⚠️ MCP Server 10s 内未响应（可能正常，tsx watch 冷启动较慢）"

echo ""
log "============================================="
log "  环境 [$ENV_NAME] 已启动"
log "  Web: http://localhost:${WEB_PORT}/"
log "  API: http://localhost:${API_PORT}/api/v1"
log "  MCP: http://localhost:${MCP_PORT}/sse"
log "  DB:  localhost:${DB_PORT}"
log "============================================="
log ""
log "如需停止服务:  Ctrl+C 或 kill -- -$DEV_PID; kill $MCP_PID"
