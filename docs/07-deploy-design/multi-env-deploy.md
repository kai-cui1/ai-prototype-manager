# 多环境构建与部署架构设计

> **文档编号**: D07-001
> **状态**: 设计中（待审核）
> **创建日期**: 2026-05-13
> **对应阶段**: Phase 1 Step 7 — 部署方案设计

---

## 1. 背景与问题定义

### 1.1 现状

项目当前的多环境机制存在根本性缺陷：

| 问题 | 具体表现 |
|------|---------|
| **端口注入失效** | `restart-env.sh` export 的 `WEB_PORT`/`API_PORT` 被根目录 `.env` 文件覆盖（Turborepo/Vite 加载 .env 优先级高于 shell export） |
| **同一时刻只能跑一个环境** | 切换环境需要 kill 旧进程 → 启动新进程，无法并存 |
| **dev1 "正常"是假象** | `.env` 硬编码的 `13181/13180` 恰好和 dev1 一致，掩盖了机制缺陷 |
| **DB 配置不一致** | `.env` 写的是 `apm_prototype`，但 environments/*.json 定义的是 `apm_dev1`/`apm_dev2` |
| **无生产部署能力** | 无 Dockerfile、无 start 脚本、无反向代理、无 CI/CD |

### 1.2 目标

建立「**代码零配置，运行时注入**」的多环境部署架构：

- 每个环境独立运行，可同时共存于同一台机器
- 代码仓库中不包含任何硬编码的端口号、数据库地址
- 所有配置通过部署层（Docker Compose / 环境变量）注入
- 与现有 `pnpm dev` 开发流程完全兼容

---

## 2. 架构设计

### 2.1 整体架构图

```
                        开发者机器 (localhost)
                        ┌──────────────────────────────────────┐
                        │                                      │
   ┌────────────────────┼─── apm-dev1 项目 ────────────────────┤
   │                    │                                      │
   │    :13181          │   ┌────────┐                         │
   │  ┌──────┐  HTTP    │   │  web   │ nginx:alpine            │
   │  │浏览器│─────────▶│   │(nginx) │ SPA 静态文件 + API 反代  │
   │  └──────┘          │   └───┬────┘                         │
   │                    │       │ /api/*                       │
   │    :13180          │       ▼                              │
   │              ┌──────────┐                                │
   │              │   api    │ node:20-alpine                  │
   │              │ (fastify)│ dist/app.js                     │
   │              └────┬─────┘                                │
   │                   │ SQL                                 │
   │    :5432           ▼                                     │
   │              ┌──────────┐                                │
   │              │    db    │ postgres:16-alpine              │
   │              │ (pg16)   │ 数据库: apm_dev1                │
   │              └──────────┘   卷: pgdata-dev1               │
   │                                                              │
   ├────────────────────┼─── apm-dev2 项目 ────────────────────┤
   │                    │                                      │
   │    :13281          │   web(:13281) + api(:13280) + db(:5433)│
   │                    │   数据库: apm_dev2, 卷: pgdata-dev2     │
   │                                                              │
   ├────────────────────┼─── apm-uat 项目 ─────────────────────┤
   │                    │                                      │
   │    :13381          │   web(:13381) + api(:13380) + db(:5435)│
   │                    │   数据库: apm_uat, 卷: pgdata-uat      │
   │                                                              │
   └────────────────────┴──────────────────────────────────────┘
```

**关键设计决策**：nginx 容器作为每个环境的**单入口点**。

- 浏览器只访问 Web 端口（如 `:13181`）
- nginx 负责两件事：
  1. 提供 SPA 静态文件（HTML/JS/CSS）
  2. 将 `/api/*` 请求反代到同 compose 网络内的 api 容器
- 前端代码只需知道 API 在相对路径 `/api/v1/...`，无需硬编码 host:port
- 浏览器视角是**同源请求**，CORS 不再是问题

### 2.2 环境清单

| 环境 | Web 端口 | API 端口 | DB 端口 | 数据库 | 用途 |
|------|---------|---------|---------|--------|------|
| dev1 | 13181 | 13180 | 5432 | apm_dev1 | 日常开发（默认） |
| dev2 | 13281 | 13280 | 5433 | apm_dev2 | 并行开发/测试隔离 |
| uat | 13381 | 13380 | 5435 | apm_uat | 用户验收测试 |

> 端口分配规则：Web = 13181 + N×100, API = 13180 + N×100, DB = 5432 + N

### 2.3 配置注入三层模型

```
Layer 1: docker-compose.<env>.yml  （端口映射 + 容器环境变量）
    ↓ 注入到容器运行时
Layer 2: process.env              （Node.js 运行时读取）
    ↓ 应用层消费
Layer 3: app.ts / db.ts / vite.config.ts  （已有逻辑，无需修改读取方式）
```

**各服务消费的环境变量**：

| 变量名 | 消费方 | 说明 |
|--------|--------|------|
| `API_PORT` | api/app.ts | Fastify 监听端口（容器内固定为 3000） |
| `API_HOST` | api/app.ts | 绑定地址（容器内固定为 0.0.0.0） |
| `DATABASE_URL` | api/db.ts | PostgreSQL 连接串（含主机名 `db` 即 Docker DNS） |
| `LOG_LEVEL` | api/app.ts | 日志级别（debug/info/warn） |
| `VITE_API_BASE_URL` | **构建时**写入前端 JS | 空=使用相对路径（nginx 反代场景）；非空=直接调用远程 API |

---

## 3. 构建流程设计

### 3.1 当前构建能力分析

| 包 | 构建命令 | 输出目录 | 生产就绪度 |
|---|---------|---------|-----------|
| @apm/shared | `tsc` | packages/shared/dist/ | ✅ 纯类型库 |
| @apm/validation-schemas | `tsc` | packages/validation-schemas/dist/ | ✅ 纯类型库 |
| @apm/api | `tsc` | packages/api/dist/ | ⚠️ 缺少 `start` 脚本 + graceful shutdown |
| @apm/web | `tsc -b && vite build` | packages/web/dist/ | ⚠️ 缺少 `base` 路径配置 |

现有 `pnpm build`（即 `turbo run build`）已能按依赖顺序正确构建全部包。Dockerfile 中复用此命令即可。

### 3.2 需要补充的构建基础设施

#### 3.2.1 API 包：添加 start 脚本

**文件**: `packages/api/package.json`

```json
{
  "scripts": {
    "dev": "tsx watch src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js"
  }
}
```

> **原因**：当前 `tsc` 编译输出到 `dist/app.js`，但没有脚本执行它。Docker 运行时需要 `npm start` 或等效命令。

#### 3.2.2 API 包：添加优雅关闭

**文件**: `packages/api/src/app.ts`（在 L103 `if (!process.env.VITEST)` 之前插入）

```typescript
// ============================================
// Graceful shutdown (for Docker / production)
// ============================================

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Received shutdown signal, closing server...');
  try {
    await app.close();        // Fastify: drain active connections + stop accepting new ones
    process.exit(0);
  } catch (err) {
    app.log.error(err, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

> **原因**：Docker stop 时发送 SIGTERM。没有 handler 的话 Node.js 直接终止，可能丢失正在处理的请求或导致 DB 连接池未正常释放。

#### 3.2.3 Web 包：添加 base 路径

**文件**: `packages/web/vite.config.ts`

```typescript
export default defineConfig({
  base: './',                // ← 新增：资源引用用相对路径
  plugins: [react()],
  // ... 其余不变
});
```

> **原因**：Vite 默认 `base: '/'`，生成的 HTML 中资源路径为 `/assets/xxx.js`。当 nginx 在任意路径下提供 SPA 时（或未来部署到子路径），绝对路径会导致 404。改为 `'./'` 后生成 `./assets/xxx.js`，在任何部署路径下都能正确解析。
>
> **不影响 dev server**：Vite dev server 忽略 `base` 配置用于 HMR。

### 3.3 Docker 构建策略

采用**多阶段构建（Multi-stage Build）**：

#### Web 镜像构建流程

```
Stage 1 (builder): node:20-alpine (~500MB 临时)
  ├── 复制 pnpm-lock.yaml + package.json (workspace 根 + 各包)
  ├── pnpm install --frozen-lockfile
  ├── 复制源码 (shared, validation-schemas, web)
  └── pnpm build --filter=@apm/web  → 产出 packages/web/dist/

Stage 2 (runner): nginx:alpine (~25MB 最终)
  ├── 复制自定义 nginx.conf
  └── 复制 Stage 1 的 packages/web/dist/ → /usr/share/nginx/html
```

**最终镜像大小**: ~25MB（仅含静态文件 + nginx）

#### API 镜像构建流程

```
Stage 1 (builder): node:20-alpine (~800MB 临时)
  ├── 同上安装依赖
  ├── 复制源码 (shared, validation-schemas, api)
  └── pnpm build --filter=@apm/api  → 产出 packages/api/dist/

Stage 2 (runner): node:20-alpine (~180MB 最终)
  ├── 仅复制 node_modules (生产依赖)
  ├── 复制 packages/api/dist/
  ├── 复制共享包源码 (shared/, validation-schemas/)
  ├── 创建非 root 用户 (安全加固)
  └── CMD ["node", "dist/app.js"]
```

**最终镜像大小**: ~180MB（含 Node.js 运行时 + 编译后代码）

---

## 4. 部署制品设计

### 4.1 目录结构

```
ai-prototype-manager/
├── docker/                          # 新建：所有 Docker 制品
│   ├── docker-compose.yml          # 基础模板（共享服务定义）
│   ├── docker-compose.dev1.yml     # dev1 覆写（端口 + 环境 + 卷）
│   ├── docker-compose.dev2.yml     # dev2 覆写
│   ├── docker-compose.uat.yml      # uat 覆写
│   ├── web/
│   │   ├── Dockerfile              # Web 多阶段构建
│   │   └── nginx.conf              # Nginx 配置（SPA + API 反代）
│   └── api/
│       └── Dockerfile              # API 多阶段构建
├── scripts/
│   └── deploy.sh                   # 新建：部署操作 CLI
└── docs/07-deploy-design/
    └── multi-env-deploy.md         # 本文档
```

### 4.2 Nginx 配置

**文件**: `docker/web/nginx.conf`

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;

    # === API 反向代理 ===
    # 将 /api/* 转发到同 compose 网络内的 api 容器
    location /api/ {
        proxy_pass http://api:3000;          # Docker DNS 服务名解析
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # === 健康检查端点 ===
    location /health {
        access_log off;
        return 200 'ok';
        add_header Content-Type text/plain;
    }

    # === 静态资源缓存 ===
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # === SPA 路由回退 ===
    # React Router browser history 模式要求所有前端路由都返回 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**关键点说明**：

| 配置项 | 为什么需要 |
|--------|----------|
| `proxy_pass http://api:3000` | Docker Compose 内部网络中，服务名就是 DNS 主机名 |
| `/assets/` 的 immutable 缓存 | Vite 构建产物带 content-hash 文件名（如 `index-abc123.js`），永不改变 |
| `try_files $uri /index.html` | 支持 React Router 的 `/projects`, `/projects/:id` 等路由 |
| `/health` 端点 | Docker healthcheck 和运维脚本探活用 |

### 4.3 Docker Compose 基础模板

**文件**: `docker/docker-compose.yml`

```yaml
# 基础模板 — 共享的服务定义
# 端口、环境变量、数据卷由覆写文件 (docker-compose.<env>.yml) 定义

services:
  # ===== Web 前端 (Nginx) =====
  web:
    build:
      context: ../
      dockerfile: docker/web/Dockerfile
    depends_on:
      api:
        condition: service_healthy     # API 就绪后才启动 Web
    networks:
      - apm-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 10s
      timeout: 3s
      retries: 3

  # ===== API 后端 (Fastify) =====
  api:
    build:
      context: ../
      dockerfile: docker/api/Dockerfile
    depends_on:
      db:
        condition: service_healthy     # DB 就绪后才启动 API
    networks:
      - apm-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/v1/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s               # 给 DB migration 留时间

  # ===== 数据库 (PostgreSQL) =====
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: apm_dev
      POSTGRES_PASSWORD: apm_dev_secret
    networks:
      - apm-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 3s
      retries: 5

networks:
  apm-network:
    driver: bridge
```

**设计原则**：基础模板**不包含任何端口号、数据库名称、卷名**——这些全在覆写文件中定义。

### 4.4 环境覆写文件示例

**文件**: `docker/docker-compose.dev1.yml`

```yaml
# Dev1 覆写 — 日常开发环境（默认）

services:
  web:
    ports: ["13181:80"]                 # 宿主机 13181 → 容器 80
    environment:
      - VITE_API_BASE_URL=              # 空 = 使用相对路径 /api/v1/*

  api:
    ports: ["13180:3000"]               # 宿主机 13180 → 容器 3000
    environment:
      - API_PORT=3000                   # 容器内监听端口（固定值）
      - API_HOST=0.0.0.0
      - LOG_LEVEL=debug
      - DATABASE_URL=postgresql://apm_dev:apm_dev_secret@db:5432/apm_dev1

  db:
    ports: ["5432:5432"]                # 宿主机 5432 → 容器 5432
    environment:
      - POSTGRES_DB=apm_dev1
    volumes:
      - pgdata-dev1:/var/lib/postgresql/data

volumes:
  pgdata-dev1:                          # 独立数据卷（不会与其他环境冲突）
```

**文件**: `docker/docker-compose.dev2.yml`

```yaml
# Dev2 覆写 — 隔离测试环境

services:
  web:
    ports: ["13281:80"]
    environment:
      - VITE_API_BASE_URL=

  api:
    ports: ["13280:3000"]
    environment:
      - API_PORT=3000
      - API_HOST=0.0.0.0
      - LOG_LEVEL=debug
      - DATABASE_URL=postgresql://apm_dev:apm_dev_secret@db:5432/apm_dev2

  db:
    ports: ["5433:5432"]
    environment:
      - POSTGRES_DB=apm_dev2
    volumes:
      - pgdata-dev2:/var/lib/postgresql/data

volumes:
  pgdata-dev2:
```

**文件**: `docker/docker-compose.uat.yml`

```yaml
# UAT 覆写 — 用户验收测试

services:
  web:
    ports: ["13381:80"]
    environment:
      - VITE_API_BASE_URL=

  api:
    ports: ["13380:3000"]
    environment:
      - API_PORT=3000
      - API_HOST=0.0.0.0
      - LOG_LEVEL=info                  # UAT 用 info 级别日志
      - DATABASE_URL=postgresql://apm_dev:apm_dev_secret@db:5432/apm_uat

  db:
    ports: ["5435:5432"]
    environment:
      - POSTGRES_DB=apm_uat
    volumes:
      - pgdata-uat:/var/lib/postgresql/data

volumes:
  pgdata-uat:
```

### 4.5 操作脚本设计

**文件**: `scripts/deploy.sh`

```bash
#!/usr/bin/env bash
# =============================================================================
# Deploy CLI — 多环境构建 + 部署操作
#
# Usage: ./scripts/deploy.sh <env-name> [action]
#   env-name: dev1 | dev2 | uat
#   action:   up (默认) | down | rebuild | status | logs
#
# Examples:
#   ./scripts/deploy.sh dev1 up        # 构建并启动 dev1
#   ./scripts/deploy.sh dev2 up        # 同时启动 dev2（与 dev1 共存！）
#   ./scripts/deploy.sh dev1 down      # 停止 dev1（不影响 dev2）
#   ./scripts/deploy.sh dev1 rebuild   # 无缓存重建 + 重启
#   ./scripts/deploy.sh dev1 status    # 健康检查
#   ./scripts/deploy.sh dev1 logs      # 查看日志
# =============================================================================

# 核心实现要点：
# 1. 使用 -p apm-<env> 作为 Docker Compose project name → 完全隔离
# 2. 组合基础模板 + 环境覆写: -f docker-compose.yml -f docker-compose.<env>.yml
# 3. up 动作: build --no-cache → up -d → 等 healthcheck → 报告 URL
# 4. status 动作: docker compose ps + curl HTTP 探针
# 5. down 动作: docker compose down（保留 volume 数据）
```

**使用方式一览**：

| 命令 | 效果 |
|------|------|
| `./scripts/deploy.sh dev1 up` | 构建镜像 → 启动 3 个容器 → 等待健康 → 报告 URL |
| `./scripts/deploy.sh dev2 up` | **同时启动第二个环境**（不同端口，互不干扰） |
| `./scripts/deploy.sh dev1 status` | 显示容器状态 + HTTP 健康探针结果 |
| `./scripts/deploy.sh dev1 logs` | tail -f 聚合日志 |
| `./scripts/deploy.sh dev1 down` | 停止并移除容器（**保留数据卷**） |
| `./scripts/deploy.sh dev1 rebuild` | 全量重建（代码变更后使用） |

也可通过根 package.json 快捷调用：
```bash
pnpm deploy:dev1 up      # 等价于 ./scripts/deploy.sh dev1 up
pnpm deploy:uat rebuild
```

---

## 5. 数据库迁移策略

### 5.1 初始化流程

每个环境的 PostgreSQL 容器启动后是**空数据库**，需要执行 Drizzle schema migration。

**Phase 1 方案（手动触发）**：

```bash
# 启动环境后，从宿主机执行迁移（通过暴露的 DB 端口连接）
DATABASE_URL="postgresql://apm_dev:apm_dev_secret@localhost:5432/apm_dev1" \
  npx --filter @apm/api db:migrate

DATABASE_URL="postgresql://apm_dev:apm_dev_secret@localhost:5433/apm_dev2" \
  npx --filter @apm/api db:migrate
```

### 5.2 未来增强方向

| 方案 | 适用时机 | 说明 |
|------|---------|------|
| **init-container** | Phase 2+ | 在 docker-compose.yml 中加一个一次性迁移容器，依赖 db healthy 后自动执行 `db:migrate` 再退出 |
| **API entrypoint 脚本** | Phase 2+ | API 容器启动时先检查 migration 版本，落后则自动迁移再启动 Fastify |
| **外部管理工具** | 有专职 DBA 时 | 使用 Flyway/Liquibase 等专业工具，独立于应用生命周期 |

---

## 6. 向后兼容性保证

### 6.1 不受影响的现有功能

| 功能 | 原因 |
|------|------|
| `pnpm dev` (turbo run dev) | 走源码路径 (`tsx watch` + `vite`)，与 Docker 完全无关 |
| `restart-env.sh` | 仍走 export + pnpm dev 路径，不受 Docker 制品影响 |
| E2E 测试 (Playwright) | 直接访问 localhost:13181，dev 环境不变则测试不变 |
| `vite.config.ts` 的 `base: './'` | **仅影响 `vite build` 产物**；dev server 忽略此配置用于 HMR |
| Graceful shutdown handler | **被动注册**（listener），dev 模式下不会收到 SIGTERM |

### 6.2 现有 `.env` 文件处理

根目录 `.env` 文件继续服务于 `pnpm dev` 开发模式。Docker 部署**不读取此文件**——所有配置来自 compose 覆写文件中的 `environment:` 字段。

建议在文档中标注清楚两条路径的关系：

```
开发路径（保持不变）:
  .env → pnpm dev → turbo run dev → tsx watch + vite dev server

部署路径（新增）:
  docker-compose.<env>.yml → docker compose up → 容器内 process.env
```

---

## 7. 安全考量（Phase 1 基线）

| 项目 | Phase 1 做法 | 未来增强 |
|------|------------|---------|
| **容器用户** | API 容器以非 root 用户运行 | 已包含在 Dockerfile 中 |
| **DB 密码** | compose 文件明文（本地开发可接受） | 提取到 `.env.<env>` 文件 + gitignore |
| **CORS** | 保持 `origin: true`（宽松） | 改为 `process.env.CORS_ORIGIN` 按环境配置 |
| **网络隔离** | 每个 compose project 独立 bridge 网络 | 如需跨环境通信，考虑 overlay network |
| **镜像供应链** | 本地构建（`docker compose build`） | 可选：推送到私有 registry 或 GitHub Container Registry |

---

## 8. 文件变更清单

### 8.1 修改现有文件（4 个）

| 文件 | 变更内容 | 影响 |
|------|---------|------|
| `packages/api/package.json` | 添加 `"start": "node dist/app.js"` | Docker 运行时需要 |
| `packages/api/src/app.ts` | 添加 SIGTERM/SIGINT graceful shutdown handler (~12 行) | Docker stop 正常工作 |
| `packages/web/vite.config.ts` | 添加 `base: './'` | 构建产物的资源路径正确 |
| 根 `package.json` | 添加 `deploy:*` 脚本 | 便捷调用 |

### 8.2 新建文件（9 个）

| 文件 | 类型 | 大小估算 | 说明 |
|------|------|---------|------|
| `docker/web/Dockerfile` | 构建配置 | ~40 行 | Web 两阶段构建 |
| `docker/web/nginx.conf` | 服务配置 | ~50 行 | SPA + API 反代 |
| `docker/api/Dockerfile` | 构建配置 | ~45 行 | API 两阶段构建 |
| `docker/docker-compose.yml` | 编排配置 | ~55 行 | 基础模板 |
| `docker/docker-compose.dev1.yml` | 环境配置 | ~30 行 | dev1 端口/DB/卷 |
| `docker/docker-compose.dev2.yml` | 环境配置 | ~30 行 | dev2 端口/DB/卷 |
| `docker/docker-compose.uat.yml` | 环境配置 | ~30 行 | uat 端口/DB/卷 |
| `scripts/deploy.sh` | 操作脚本 | ~120 行 | 部署 CLI |
| `docs/07-deploy-design/multi-env-deploy.md` | 设计文档 | — | 本文档 |

---

## 9. 执行顺序

```
Phase 1A: 改现有代码（低风险，先做）
  Step 1  packages/api/package.json  → 加 start 脚本
  Step 2  packages/api/src/app.ts   → 加 graceful shutdown
  Step 3  packages/web/vite.config.ts → 加 base:'./'
  Step 4  验证: pnpm build 成功 + ppm dev 正常

Phase 1B: 创建 Docker 制品
  Step 5  docker/web/Dockerfile
  Step 6  docker/web/nginx.conf
  Step 7  docker/api/Dockerfile
  Step 8  docker/docker-compose.yml (base template)
  Step 9  docker/docker-compose.dev1.yml
  Step 10 语法验证: docker compose -p apm-dev1 -f docker/docker-compose.yml \
           -f docker/docker-compose.dev1.yml config

Phase 1C: 操作工具 + 剩余环境
  Step 11 scripts/deploy.sh (+ chmod +x)
  Step 12 docker/docker-compose.dev2.yml
  Step 13 docker/docker-compose.uat.yml
  Step 14 根 package.json 加 deploy:* 脚本

Phase 1D: 文档
  Step 15 docs/07-deploy-design/multi-env-deploy.md（本文档）
```

## 10. 验证标准

```bash
# TC-DEPLOY-001: 单环境构建 + 启动
pnpm deploy:dev1 up
curl http://localhost:13181/health        # → ok
curl http://localhost:13180/api/v1/health  # → {"data":{"status":"ok"}}

# TC-DEPLOY-002: 多环境共存
pnpm deploy:dev2 up
curl http://localhost:13281/health        # → ok
curl http://localhost:13280/api/v1/health  # → {"data":{"status":"ok"}}
# 此时 dev1 仍在运行

# TC-DEPLOY-003: 独立停止
pnpm deploy:dev1 down
curl http://localhost:13281/health        # → ok (dev2 不受影响)

# TC-DEPLOY-004: SPA 路由回退
curl http://localhost:13281/projects       # → 200 (返回 index.html)

# TC-DEPLOY-005: API 反向代理
curl http://localhost:13281/api/v1/projects  # → API 响应（经 nginx 转发）

# TC-DEPLOY-006: 回归 — 原有开发流程
pnpm dev                                  # turbo run dev 正常启动
# E2E 测试仍走 localhost:13181，不受影响
```
