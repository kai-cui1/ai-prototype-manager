#!/usr/bin/env bash
# =============================================================================
# 环境激活脚本 — 读取环境定义，export 环境变量到当前 shell
#
# 用法: source environments/set-env.sh [env-name]
# 示例: source environments/set-env.sh          # 使用 .active 记录的环境
#       source environments/set-env.sh dev1      # 指定环境
#
# ⚠️ 必须用 source（或 .）执行，不能直接运行！
#    source environments/set-env.sh dev1   ✅
#    ./environments/set-env.sh dev1        ❌ (子 shell 中 export 不会生效)
# =============================================================================

# 检测是否被 source 执行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "❌ 错误：请使用 source 执行本脚本（否则环境变量不会生效）"
  echo "   source environments/set-env.sh [env-name]"
  return 1 2>/dev/null || exit 1
fi

# 检测项目根目录：从 BASH_SOURCE 或 $PWD 向上查找含 environments/ 目录的路径
_find_project_root() {
  # 尝试从 BASH_SOURCE 推导
  if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
    if [[ -d "$script_dir" && -f "$script_dir/../AGENTS.md" ]]; then
      echo "$(cd "$script_dir/.." && pwd)"
      return 0
    fi
  fi
  # 回退：从 $PWD 向上查找
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/AGENTS.md" && -d "$dir/environments" ]]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  echo ""
  return 1
}

PROJECT_ROOT="$(_find_project_root)"
if [[ -z "$PROJECT_ROOT" ]]; then
  echo "❌ 错误：无法定位项目根目录（未找到 AGENTS.md + environments/）"
  echo "   请在项目根目录或其子目录中执行 source 命令"
  return 1
fi

ENVIRONMENTS_DIR="$PROJECT_ROOT/environments"

# 确定环境名：参数 > .active 文件
if [ $# -ge 1 ]; then
  ENV_NAME="$1"
else
  if [ -f "$ENVIRONMENTS_DIR/.active" ]; then
    ENV_NAME="$(cat "$ENVIRONMENTS_DIR/.active" | tr -d '[:space:]')"
  else
    echo "❌ 错误：未指定环境名，且 .active 文件不存在"
    echo "   用法: source environments/set-env.sh <env-name>"
    return 1
  fi
fi

# 验证环境定义文件
ENV_FILE="$ENVIRONMENTS_DIR/${ENV_NAME}.json"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 错误：环境定义不存在: $ENV_FILE"
  echo "可用环境:"
  for f in "$ENVIRONMENTS_DIR"/*.json; do
    [ -f "$f" ] || continue
    echo "  $(basename "$f" .json)"
  done
  return 1
fi

# 读取环境配置
DB_PORT=$(python3 -c "import json; print(json.load(open('$ENV_FILE'))['db']['port'])")
DB_NAME=$(python3 -c "import json; print(json.load(open('$ENV_FILE'))['db']['database'])")
DB_HOST=$(python3 -c "import json; print(json.load(open('$ENV_FILE'))['db']['host'])")
API_PORT=$(python3 -c "import json; print(json.load(open('$ENV_FILE'))['api']['port'])")
WEB_PORT=$(python3 -c "import json; print(json.load(open('$ENV_FILE'))['web']['port'])")

# 构造 DATABASE_URL
DB_USER="apm_dev"
DB_PASSWORD="apm_dev_secret"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Export 环境变量
export DATABASE_URL
export API_PORT
export WEB_PORT
export DB_PORT

# 更新 .active
echo "$ENV_NAME" > "$ENVIRONMENTS_DIR/.active"

echo "✅ 环境 [$ENV_NAME] 已激活"
echo "   DATABASE_URL = ${DATABASE_URL}"
echo "   API_PORT     = ${API_PORT}"
echo "   WEB_PORT     = ${WEB_PORT}"
echo "   DB_PORT      = ${DB_PORT}"
