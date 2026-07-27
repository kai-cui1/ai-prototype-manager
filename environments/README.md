# 环境管理

> 定义 AI 工作流中使用的服务连接环境。**只有用户可以修改此目录下的文件**，AI 只读。

## 核心原则：先指定环境，再启动服务

**不允许任何隐式默认值绕过环境系统。** 启动服务、执行数据库操作前，必须先激活环境。

## 目录结构

```
environments/
├── README.md           # 本文件
├── set-env.sh          # 轻量级环境激活脚本（source 执行）
├── restart-env.sh      # 完整重启脚本（清理进程+启动服务）
├── dev1.json           # 日常开发环境（默认）
├── dev2.json           # 隔离测试环境
├── uat.json            # UAT 测试环境
└── .active             # 当前激活的环境名
```

## 使用方式

### 1. 激活环境（推荐）

**轻量激活**（仅 export 环境变量，不启动服务）：

```bash
# 使用 .active 记录的环境
source environments/set-env.sh

# 指定环境名
source environments/set-env.sh dev1
source environments/set-env.sh dev2
```

> ⚠️ 必须用 `source`（或 `.`）执行，直接运行不会生效！

**完整重启**（清理旧进程 + 启动新服务）：

```bash
./environments/restart-env.sh dev1
./environments/restart-env.sh dev2
```

### 2. 声明当前环境（对 AI）

在对话中告知 AI 当前环境：

```
"当前在 dev1 环境"
"/env dev1"
"切换到 dev2"
```

AI 收到后会：
1. 读取 `environments/.active` 确认
2. 加载对应 JSON 获取端口和连接参数
3. 用 `curl` / `lsof` 验证服务可达性
4. 如果不可达 → 暂停并提示你检查

**AI 执行需要数据库的命令前，必须先 `source environments/set-env.sh` 激活环境。**

### 3. 新增环境

复制一个现有 JSON 文件，修改端口号和描述：

```bash
cp environments/dev1.json environments/dev3.json
# 编辑 dev3.json 中的所有 port 和 database 字段
echo "dev3" > environments/.active
```

## 端口分配规则

| 服务 | dev1 | dev2 | uat | devN |
|------|------|------|-----|------|
| Web (Vite) | 13181 | 13281 | 13381 | 13181 + N×100 |
| API (Fastify) | 13180 | 13280 | 13380 | 13180 + N×100 |
| MCP Server | 13182 | 13282 | — | 13182 + N×100 |
| Agent Server | 13183 | 13283 | 13383 | 13183 + N×100 |
| DB (PostgreSQL) | 5432 | 5433 | 5435 | 5432 + N |

> 规则：同一服务的不同环境端口间隔 ≥ 100，避免相邻端口冲突。

## AI 行为约束

| 操作 | 允许？ | 说明 |
|------|--------|------|
| 读取 `.active` + `*.json` | ✅ | 获取环境配置 |
| `curl` / `lsof` 检查端口 | ✅ | 验证服务状态 |
| `source set-env.sh` 激活环境 | ✅ | AI 执行数据库命令前必须先激活 |
| 编辑 `.active` 或 `*.json` | ❌ | 只有用户可以修改 |
| 启动/停止/重启任何服务 | ❌ | 只有用户可以操作 |

## 与其他文件的关联

| 文件 | 关联方式 |
|------|---------|
| `AGENTS.md`/`CLAUDE.md`「环境优先铁律」 | DATABASE_URL 禁止硬编码或写死在 .env 中，未设置时抛错 |
| `.env` | 不再包含 DATABASE_URL（由环境系统动态生成） |
| `packages/api/src/db.ts` | `DATABASE_URL` 未设置时抛错，不再有 fallback |
| `packages/api/drizzle/config.ts` | 同上 |
| `playwright.config.ts` | `baseURL` 从环境 JSON 的 `web.url` 读取（当前硬编码为 dev1）|
