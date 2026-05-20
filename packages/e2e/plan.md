# E2E 测试框架搭建 Implementation Plan

## Context

Phase 1 基础设施（INF-1~INF-6）已全部执行完毕，项目可运行（`pnpm dev` 启动前后端）。现在需要搭建 E2E 测试框架，让 PM 能通过一条命令运行端到端测试，并把结果反馈给 AI 进行 bug 修复。

**设计文档**：`packages/e2e/README.md`（已写好完整方案设计）
**当前状态**：**已执行完毕（2026-04-30）** — 3/3 smoke test pass，框架可用

---

## 前置条件（执行前必须满足）

| 条件 | 验证方式 | 当前状态 |
|------|---------|---------|
| Docker Compose PG 运行中 | `docker compose -f workspace/dev/docker-compose.yml ps` | 需确认 |
| `pnpm dev` 可正常启动（api:13180 + web:13181） | `pnpm dev` 终端无报错 | 需确认 |
| 前端 Layout 非调试态 | `Layout.tsx` 中 `<Outlet />` 未被注释 | **当前为调试态**（见下方说明） |

### 关于前端调试状态的特别说明

当前 `packages/web/src/components/Layout.tsx` 第 182-190 行的 `<Outlet />` 被注释替换为硬编码调试 div。这意味着：

- **Smoke Test Case 1 的断言需适配当前实际渲染内容**（见 Task 2 代码）
- **建议**：在执行本 Plan 前，先恢复 `<Outlet />` 并移除调试 div；如果暂不恢复，Plan 中的 Case 1 已做了兼容处理（断言 Sidebar 区域而非路由内容）

---

## 文件结构（最终产出）

```
packages/e2e/
├── package.json                 # e2e 包配置 + 依赖
├── playwright.config.ts          # Playwright 配置（baseURL/浏览器/输出）
├── tests/
│   └── smoke.spec.ts             # 冒烟测试（3 个 case）
├── helpers/
│   ├── api-client.ts            # API 调用封装
│   └── db-setup.ts              # 测试数据准备 / 清理（骨架）
└── test-results/                 # 自动生成的报告 + 截图 + trace（gitignore）
# 注意：playwright-report/ 是 html reporter 独立生成的报告目录（gitignore）
# 区别：test-results/ = outputDir 配置的目录（截图/trace/json 结果）
#       playwright-report/ = html reporter 默认目录（show-report 打开的）
```

---

## Task 1: 初始化 e2e 包 + 安装 Playwright

### Step 1: 创建 `packages/e2e/package.json`

```json
{
  "name": "@apm/e2e",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --debug",
    "report": "playwright show-report"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0"
  }
}
```

关键点：
- 用 `@playwright/test`（不是 `playwright`），自带 test runner + 断言
- `test:headed` 有头模式：调试时可以看到浏览器操作过程
- `test:debug` 带 debugger 暂停：可以逐步执行
- `report` 打开 HTML 报告

### Step 2: 创建 `packages/e2e/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,       // E2E 测试串行（避免 DB 并发冲突）
  forbidOnly: 'fixme',        // 只跑全部 case，不跳过
  retries: 0,                // 失败不重试（快速看到错误）

  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    baseURL: 'http://localhost:13181',  // Web 前端端口（见 CLAUDE.md「全局端口约定」）
  },

  // 单 webServer：只等 Web 前端(13181)
  // API 请求(/api/*) 通过 Vite proxy 自动转发到 Fastify(13180)
  // 无需双 webServer 避免重复启动 turbo 进程的竞态风险
  webServer: {
    command: 'npx turbo run dev',
    port: 13181,
    timeout: 120_000,
    reuseExistingServer: true,   // 已运行 pnpm dev 时复用，不重复启动
  },

  outputDir: './test-results',
  screenshot: 'only-on-failure',  // 仅失败时截图
  trace: 'retain-on-failure',     // 首次失败即记录 trace（配合 retries=0 使用）

  reporter: [
    ['html', { open: 'never' }],  // 生成 HTML 报告但不自动打开
    ['json'],                     // 同时输出 JSON（供 AI 解析）
  ],
});
```

关键设计决策：
- **单 `webServer`** — 只等待 Web 前端(:13181)，API 请求通过 Vite proxy (`/api` → `localhost:13180`) 转发到 Fastify。无需双 webServer，避免同一 command 重复启动 turbo 的竞态问题
- **显式 `baseURL`** — 不依赖 webServer 隐式推导，配置更明确、更易维护
- **`command: 'npx turbo run dev'`** — 不带 `--port` 参数（turbo 不支持端口透传，Vite 端口在 `vite.config.ts` 中配置为 13181）
- **`reuseExistingServer: true`** — 如果已运行 `pnpm dev`，不会重复启动
- **`fullyParallel: false`** — E2E 串行，避免 PG 并发写入冲突
- **`screenshot: 'only-on-failure'`** — pass 时不截图节省时间
- **`trace: 'retain-on-failure'`** — 配合 `retries: 0`，首次失败即记录 trace（`on-first-retry` 在 retries=0 时永不触发）

### Step 3: 更新根 `turbo.json`，添加 `test:e2e` 任务

在现有 `turbo.json` 的 `tasks` 中添加：

```json
"test:e2e": {
  "cache": false
}
```

注意：不加 `persistent: true`——E2E 测试跑完即结束，不是持久运行的服务。

### Step 4: 更新根 `package.json`，添加 `test:e2e` 脚本

在 `scripts` 中添加：

```json
"test:e2e": "turbo run test:e2e"
```

这样 PM 可以直接运行 `pnpm test:e2e`。

### Step 5: 更新根 `.gitignore`，添加 e2e 产物忽略

添加以下条目（带注释说明用途）：

```
# E2E test artifacts (Playwright 生成)
test-results/
playwright-report/
```

### Step 6: 运行 `pnpm install` 安装 Playwright + 浏览器

Run: `pnpm install`
Expected: `@apm/e2e` 下安装了 playwright + 浏览器二进制

首次安装后需要初始化浏览器：
Run: `npx playwright install chromium`

---

## Task 2: 编写 Smoke Test（冒烟测试）

### Step 1: 创建 `packages/e2e/tests/smoke.spec.ts`

3 个 case，验证基础设施三层就绪。Case 1 兼容 Layout 当前调试状态和恢复后的正常状态：

```typescript
import { test, expect } from '@playwright/test';

test.describe('基础设施冒烟', () => {
  test('前端能加载', async ({ page }) => {
    await page.goto('/projects');
    // Layout 渲染完成：APM 标题可见（Sidebar header）
    await expect(page.locator('text=APM')).toBeVisible();
    // 默认菜单「项目管理」可见（Sidebar menu item）
    await expect(page.locator('text=项目管理')).toBeVisible();
    // 页面 URL 正确（非重定向方式，直接访问目标路径）
    expect(page.url()).toContain('/projects');
  });

  test('后端 health check', async ({ request }) => {
    const resp = await request.get('/api/v1/health');
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.data.status).toBe('ok');
  });

  test('数据库连通', async ({ request }) => {
    const resp = await request.get('/api/v1/health');
    const body = await resp.json();
    // 先确认整体状态正常
    expect(body.data.status).toBe('ok');
    // DB 连通时 health 返回 { status: 'ok' } 无 db 字段
    // DB 不通时返回 { status: 'degraded', db: 'unreachable' }
    expect(body.data.db).toBeUndefined();
  });
});
```

case 设计说明：
- Case 1 用 `goto('/projects')` 直接访问目标路径（与 README 设计文档一致），验证 React → Router → Layout → Sidebar 全链路渲染。不依赖 `<Outlet />` 路由内容渲染，只断言 Sidebar 区域（无论 Outlet 是否被注释都能通过）
- Case 2 验证 Fastify 响应 + JSON 格式正确
- Case 3 用正向断言 `expect(body.data.db).toBeUndefined()` 验证 PostgreSQL 连通（比 silent pass 更安全）

---

## Task 3: 创建 Helpers

### Step 3.1 创建 `packages/e2e/helpers/api-client.ts`

封装 API 调用，供后续 M1~M6 spec 复用：

```typescript
/**
 * E2E 测试专用 API Client
 * 直接调用后端 REST API，绕过前端 UI
 * 用于数据准备、边界场景测试等
 */
const API_BASE = '/api/v1';

export interface ApiResponse<T> {
  data: T;
  meta?: { total: number; page: number; pageSize: number; totalPages: number };
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown; requestId?: string };
}

class E2eApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options?: RequestInit & { params?: Record<string, string> },
  ): Promise<ApiResponse<T>> {
    let url = `${this.baseUrl}${path}`;
    if (options?.params) {
      url += '?' + new URLSearchParams(options.params).toString();
      delete options.params;
    }

    const resp = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });

    if (!resp.ok) {
      const error: ApiError = await resp.json().catch(() => ({
        error: { code: 'UNKNOWN_ERROR', message: `HTTP ${resp.status}` },
      }));
      throw new Error(`${error.error.code}: ${error.error.message}`);
    }

    return resp.json() as Promise<ApiResponse<T>>;
  }

  async get<T>(path: string, params?: Record<string, string>) {
    return this.request<T>(path, { method: 'GET', params });
  }

  async post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

/** 全局单例 */
export const api = new E2eApiClient();
```

关键点：
- baseURL 用 `/api/v1` 相对路径（Playwright 会自动解析到 dev server）
- 移除了错误的 `as Response` 类型断言，fetch 参数类型正确传递
- 错误时抛出清晰 Error，fail message 里直接显示 code:message
- 后续 M1~M6 spec 可直接 `api.get('/projects')` 调用

### Step 3.2 创建 `packages/e2e/helpers/db-setup.ts`（骨架）

README 设计文档中定义了此文件，先行创建骨架供后续 M1~M6 spec 扩展：

```typescript
/**
 * E2E 测试数据准备 & 清理工具
 *
 * 使用方式（在各 spec 的 beforeAll/afterAll 中）：
 *   import { TEST_PREFIX, cleanupTestData } from '../helpers/db-setup.js';
 *
 *   test.beforeAll(async () => { /* 准备前置数据 */ });
 *   test.afterAll(async () => { await cleanupTestData(); });
 */

/** 所有测试数据以此前缀命名，确保跨 spec 隔离 */
export const TEST_PREFIX = 'e2e-';

/**
 * 清理所有以 TEST_PREFIX 开头的测试数据
 * 当前为骨架实现，M1 完成后补充具体的清理逻辑
 * （通过 API 调用按名称前缀删除 / 或直连 DB 执行 DELETE）
 */
export async function cleanupTestData(): Promise<void> {
  // TODO(M1): 实现 projects 表清理
  // TODO(M2): 实现 domain_entities 表清理
  // TODO(M3-M6): 补充其余表清理
  console.log(`[db-setup] 清理 ${TEST_PREFIX}* 数据（骨架，待补充）`);
}
```

---

## Task 4: 验证全流程

### Step 1: 确保 dev server 可用

确认 Docker Compose PG 在运行，且 `pnpm dev` 可正常启动（api:13180 + web:13181）。

### Step 2: 运行 smoke test

```bash
# 方式 A：通过 turbo（推荐，自动管理 dev server）
pnpm test:e2e -- tests/smoke.spec.ts

# 方式 B：如果你已手动启动了 pnpm dev（复用已有 server）
cd packages/e2e && npx playwright test tests/smoke.spec.ts

# 方式 C：有头模式（调试时看浏览器操作）
cd packages/e2e && npx playwright test --headed tests/smoke.spec.ts
```

Expected: 3 个 case 全部 pass，终端输出绿色 ✅

### Step 3: 查看报告

Playwright 生成两个报告目录：

| 目录 | 来源 | 内容 | 查看方式 |
|------|------|------|---------|
| `test-results/` | `outputDir` 配置 | 截图、trace、JSON 结果 | 直接打开 `index.html` |
| `playwright-report/` | html reporter 默认 | HTML 格式完整报告 | `npx playwright show-report` |

```bash
cd packages/e2e && npx playwright show-report
```

浏览器打开 HTML 报告，确认报告结构正确（pass/fail 状态、截图位置等）。

### Step 4: 验证 gitignore

Run: `git status`
确认 `test-results/` 和 `playwright-report/` 未被 git 追踪。

---

## 执行顺序总结

| 步骤 | 任务 | 产出文件 | 涉及修改的已有文件 |
|------|------|---------|-------------------|
| 1 | 初始化 e2e 包 + Playwright | `package.json`, `playwright.config.ts` | — |
| 2 | 接入 turbo + 注册脚本 | — | `turbo.json`, 根 `package.json`, `.gitignore` |
| 3 | 安装依赖 + 浏览器 | node_modules, chromium binary | — |
| 4 | 写 smoke test | `tests/smoke.spec.ts` | — |
| 5 | 写 API helper | `helpers/api-client.ts` | — |
| 6 | 写 DB setup 骨架 | `helpers/db-setup.ts` | — |
| 7 | 运行验证 | 终端 pass + 两个报告目录生成 | — |

## 验证标准

- [ ] `pnpm install` 无报错，`@apm/e2e/node_modules/@playwright` 存在
- [ ] `npx playwright install chromium` 完成浏览器安装
- [ ] `pnpm test:e2e -- tests/smoke.spec.ts` 输出 3/3 pass
- [ ] `test-results/` 目录存在且含 index.html + results.json
- [ ] `playwright show-report` 可打开 HTML 报告
- [ ] `git status` 不显示 `test-results/` 或 `playwright-report/` 为未跟踪
- [ ] `helpers/api-client.ts` 和 `helpers/db-setup.ts` 文件存在且无语法错误

## 后续动作（Plan 执行完毕后）

更新 `packages/e2e/README.md` 第 9 节「待定事项」，回标已决策项：
- [x] Playwright 安装方式 → 项目内 devDependency
- [x] `pnpm test:e2e` 脚本接入 turbo.json → 已添加
- [x] 是否需要视频录制 → trace retain-on-failure 已覆盖（首次失败即记录）
- [ ] 是否需要在 CI/CD 中运行 → 当前仅本地，后续再议
- [ ] 截图基线对比需求 → 视觉回归暂不需要

---

## 执行记录（2026-04-30）

### 验证标准完成情况

- [x] `pnpm install` 无报错，`@apm/e2e/node_modules/@playwright` 存在
- [x] 浏览器：使用系统 Google Chrome（`channel: 'chrome'`），无需下载 Chromium（CDN 网络不通）
- [x] `npx playwright test tests/smoke.spec.ts` 输出 **3/3 pass**（832ms）
- [x] `playwright-report/index.html` 可打开（HTML 报告 525KB）
- [x] `test-results/.last-run.json` 存在（JSON 结果）
- [x] `git status` 不显示 test-results/ 或 playwright-report/ 为未跟踪
- [x] `helpers/api-client.ts` 和 `helpers/db-setup.ts` 文件存在且无语法错误

### 执行过程中发现的额外问题及修复

| # | 问题 | 修复 |
|---|------|------|
| E1 | `forbidOnly: 'fixme'` 在 Playwright 1.59 中不支持（需 boolean） | 改为 `forbidOnly: true` |
| E2 | Playwright CDN 下载 Chromium 失败（网络连接被关闭） | 改用 `channel: 'chrome'` 使用系统已安装的 Google Chrome |
| E3 | `text=APM` 选择器匹配 2 个元素（header + footer "APM v0.1"） | 加 `.first()` 取第一个匹配 |
| E4 | `text=项目管理` 选择器匹配 2 个元素（Sidebar + 调试区域文字） | 加 `.first()` 取第一个匹配 |
| E5 | `pnpm test:e2e` 通过 turbo 运行报 workspace 冲突（validation-schemas 重复） | 预存在问题，绕过：直接 `cd packages/e2e && npx playwright test` 运行 |

### 已知遗留问题（非阻断）

1. **turbo workspace 冲突**：`validation-schemas` 同时存在于 `packages/` 和根目录，导致 `turbo run test:e2e` 失败。当前通过直接运行 playwright 绕过，后续需清理重复包。
2. **Layout 调试状态**：`<Outlet />` 仍被注释，smoke test 的 Case 1 断言已做兼容处理（`.first()` + 只断言 Sidebar 区域）。M1 开发前应恢复 Outlet。
