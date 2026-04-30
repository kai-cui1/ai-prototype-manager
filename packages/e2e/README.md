# E2E 测试方案设计文档

> **创建日期**：2026-04-30
> **状态**：框架搭建准备中
> **适用阶段**：Phase 1（M1 ~ M6）及后续 Phase

---

## 1. 设计目标

在浏览器层面验证**端到端的用户操作路径**是否正确工作。E2E 测试模拟真实用户操作（点击、输入、导航），覆盖前后端全链路：React 前端 → REST API → Fastify 后端 → PostgreSQL 数据库。

### 核心价值

| 角色 | 获得什么 |
|------|----------|
| **PM（你）** | 运行一条命令即可获得结构化的测试结果，把失败信息贴给 AI 即可触发 bug 修复 |
| **AI（我）** | 通过终端输出 + HTML 报告 + 截图/trace 精确定位问题根因，无需复现环境 |

### 不是 E2E 的职责

- 不测像素级 UI 还原度（那是视觉回归测试的事）
- 不测每个组件的 props 边界情况（那是单元/组件测试的事）
- 不测性能/负载/安全（那是专门的测试类型）

---

## 2. 技术选型

| 项目 | 选择 | 版本要求 | 理由 |
|------|------|---------|------|
| 框架 | **Playwright** (`@playwright/test`) | latest | 零配置、自动截图/视频/trace、HTML 报告、并行执行快 |
| 断言库 | **@playwright/assert** | 内置 | 无需额外安装，API 友好 |
| 浏览器 | Chromium（默认） | 系统 | 开发阶段够用；后续可加 WebKit/Firefox |
| 测试数据源 | **真实 PostgreSQL** | 16 | E2E 就是要测真实链路，不 mock 数据库 |
| ORM | **Drizzle ORM** | 0.30+ | 与项目一致，测试数据通过 API 写入 |
| 包管理 | pnpm workspace | — | 作为 `packages/e2e` 独立包或集成到 web 下 |

### 为什么选 Playwright 而非 Cypress / Puppeteer

| 维度 | Playwright | Cypress | Puppeteer |
|------|-----------|---------|-----------|
| 配置复杂度 | 低（`npx @playwright/init` 一键生成） | 中等（需写 plugin） | 高（手写全部） |
| 自动截图/视频 | 内置 | 需插件 | 手动实现 |
| 并行执行 | 内置（worker 并行） | 有限 | 无 |
| Trace 复现 | 一行命令 `--trace` | 需插件 | 无 |
| HTML 报告 | 内置美观报告 | 需配置 | 无 |
| 等待策略 | Auto-waiting（智能等待元素就绪） | 显式 wait | 全手动 |
| 社区生态 | 活跃（Microsoft 维护） | 活跃 | 维护模式 |

---

## 3. 文件结构

```
packages/e2e/
├── README.md                    # 本文件
├── package.json                 # e2e 包配置
├── playwright.config.ts          # Playwright 配置
│   ├── baseURL: http://localhost:5173   # Vite dev server
│   ├── webServer: 启动/关闭钩子          # 自动管理前后端
│   ├── outputDir: ./test-results/        # 报告输出目录
│   └── screenshot: only-on-failure      # 仅失败时截图
├── tests/
│   ├── smoke.spec.ts              # 冒烟测试（基础设施就绪验证）
│   ├── m1-project.spec.ts          # M1: 项目 CRUD 用户旅程
│   ├── m2-domain.spec.ts           # M2: 领域模型 CRUD
│   ├── m3-process.spec.ts          # M3: 业务流程 CRUD
│   ├── m4-organization.spec.ts     # M4: 组织架构 CRUD
│   ├── m5-architecture.spec.ts     # M5: 业务架构 CRUD
│   └── m6-menu.spec.ts            # M6: 菜单管理 CRUD
├── helpers/
│   ├── db-setup.ts               # 测试前数据准备 / 测试后清理
│   └── api-client.ts             # API 调用封装（独立于 web 的 client）
└── test-results/                  # 自动生成的报告（gitignore）
    ├── index.html                # 完整 HTML 报告
    ├── results.json              # 结构化结果（JSON 格式）
    └── <spec-name>/              # 每个 spec 的截图和 trace
```

### 设计原则

- **tests/** 按 M 模块组织** — 一个功能模块一个 spec 文件，与开发顺序对齐
- **helpers/** 放共享工具 — 数据隔离、清理逻辑、API 封装
- **test-results/** 不入库 — gitignore，每次运行重新生成
- **e2e 作为独立包** — 不污染 api/web/shared 的依赖树

---

## 4. 反馈工作流

### 4.1 你要做的

```bash
# 1. 启动基础设施（如果还没启动）
docker compose -f workspace/dev/docker-compose.yml up -d
pnpm install          # 确保 turbo 等依赖已装

# 2. 启动开发服务器
pnpm dev             # turbo run dev → 同时启动 api(:3000) + web(:5173)

# 3. 运行 E2E 测试
pnpm test:e2e         # 运行全部 E2E 测试
pnpm test:e2e -- tests/smoke.spec.ts   # 只跑冒烟测试
pnpm test:e2e -- tests/m1-project.spec.ts  # 只跑 M1
```

### 4.2 你会看到什么

#### 终端输出（快速概览）

```
✓ smoke.spec.ts:3:1 › 前端能加载 (823ms)
✓ smoke.spec.ts:7:1 › 后端 health check (45ms)
✓ smoke.spec.ts:12:1 › 数据库连通 (52ms)
✗ m1-project.spec.ts:15:1 › 创建项目 (1.2s)

    Error: expect(locator('.project-name')).toHaveValue('换电站')
    Received: ''
    Screenshot: test-results/m1-project-spec-ts-create-project-1.png
    Trace: test-results/trace.zip
```

#### test-results/ 目录（详细分析）

```
test-results/
├── index.html              # 在浏览器打开的完整报告
│   ├── 所有 case 的 pass/fail 状态
│   ├── 每个 fail case 的截图
│   ├── 错误信息详情
│   └── 过滤/排序功能
├── results.json            # 结构化 JSON（可供 AI 直接读取解析）
└── m1-project-spec-ts-create-project-1/
    ├── screenshot.png       # 失败时的页面截图
    └── trace.zip             # 可重现的 trace 文件
```

### 4.3 把什么给我

| 方式 | 内容 | 适用场景 |
|------|------|---------|
| **终端文字** | fail 的错误信息和上下文 | 快速反馈，问题简单时 |
| **报告路径** | "报告在 `test-results/`" | 问题复杂，需要我看截图/trace 分析 |
| **两者都给** | 终端输出 + 报告路径 | 推荐默认方式 |

### 4.4 我会做什么

1. **读取报告** — 如果给了路径，我会直接读 `index.html` 或 `results.json`
2. **查看截图** — 失败时的页面长什么样，一眼看出是前端渲染问题还是后端数据问题
3. **分析 trace** — 如果需要，解压 trace 看 network 请求 / console log / 操作序列
4. **定位根因** — 判断是：
   - 前端 bug（组件渲染/状态/路由）
   - 后端 bug（API 逻辑/数据库操作/校验失败）
   - 数据问题（测试数据脏/时序/隔离不足）
   - 环境问题（DB 未启动/端口冲突/migration 未跑）
5. **修复代码** — 直接改对应文件
6. **验证修复** — 你再跑一次 `pnpm test:e2e` 确认 pass

---

## 5. 测试数据策略

### 5.1 数据隔离原则

每个 E2E spec 使用**唯一的项目名前缀**，确保测试之间互不干扰：

```typescript
const TEST_PREFIX = 'e2e-';  // 所有测试数据以此前缀命名

// spec A 创建的项目
await createProject({ name: `${TEST_PREFIX}-m1-crud-01`, ... });

// spec B 创建的项目（不会与 spec A 冲突）
await createProject({ name: `${TEST_PREFIX}-m2-entity-01`, ... });
```

### 5.2 测试生命周期

```typescript
test.describe('M1 项目管理', () => {
  test.beforeAll(async () => {
    // 1. 确保测试环境干净（可选：清理旧测试数据）
    // 2. 准备公共前置数据（如：一个已存在的项目用于列表查询测试）
  });

  test.afterAll(async () => {
    // 清理本次测试创建的所有数据
    // 按名称前缀删除 e2e-* 开头的项目
  });

  test('创建项目', async ({ page }) => { ... });
  test('更新项目', async ({ page }) => { ... });
  test('删除项目（软删除）', async ({ page }) => { ... });
});
```

### 5.3 不 mock 的理由

| 层 | 是否 mock | 理由 |
|-----|:--------:|------|
| 网络请求 | 否 | E2E 就是测真实 HTTP 链路 |
| 数据库 | 否 | Drizzle SQL 是被测对象之一，mock 会放过 SQL bug |
| 时间 | 否 | 用真实时间戳，避免 fakeTimer 导致的时序 bug 遗漏 |
| 外部服务 | N/A | Phase 1 无外部服务依赖 |

---

## 6. Smoke Test（冒烟测试）— 第一个要写的测试

在 M1 代码还没开始写的时候就能跑的测试。纯粹验证基础设施三层是否就绪：

```typescript
// tests/smoke.spec.ts
import { test, expect } from '@playwright/test';

test.describe('基础设施冒烟', () => {
  test('前端能加载', async ({ page }) => {
    await page.goto('/projects');
    // Layout 渲染完成 + Sidebar 显示
    await expect(page.locator('text=APM')).toBeVisible();
    // 默认菜单「项目管理」可见
    await expect(page.locator('text=项目管理')).toBeVisible();
  });

  test('后端 health check', async ({ request }) => {
    const resp = await request.get('/api/v1/health');
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.data.status).toBe('ok');
  });

  test('数据库连通', async ({ request }) => {
    // health check 内部执行 SELECT 1，如果返回 ok 说明 DB 层正常
    const resp = await request.get('/api/v1/health');
    const body = await resp.json();
    // 如果 DB 不可达，health 返回 degraded 而非 ok
    expect(body.data.db).toBeUndefined();
  });
});
```

这三个 case 的通过意味着：Vite 能编译 → React 能渲染 → Fastify 能响应 → PG 能连接。后续每完成一个模块就补对应的 E2E spec。

---

## 7. 各模块 E2E 覆盖范围规划

| 模块 | Spec 文件 | 覆盖的用户旅程 | 对应 API 端点 |
|------|----------|---------------|-------------|
| **Smoke** | `smoke.spec.ts` | 前端加载 + 后端健康 + DB 连通 | GET /health |
| **M1 项目** | `m1-project.spec.ts` | 创建→列表搜索→查看详情→更新→软删→摘要统计 | 6 个端点全覆盖 |
| **M2 领域模型** | `m2-domain.spec.ts` | 创建实体→添加字段→建立关系→ER 图视图 | 18 个端点的核心路径 |
| **M3 业务流程** | `m3-process.spec.ts` | 创建流程→添加节点→连线→设置入口→子流程 | 27 个端点的核心路径 |
| **M4 组织架构** | `m4-organization.spec.ts` | 创建公司→建部门树→建角色→建外部实体 | 21 个端点的核心路径 |
| **M5 业务架构** | `m5-architecture.spec.ts` | 创建架构节点→关联流程→排序→树形查询 | 11 个端点的核心路径 |
| **M6 菜单** | `m6-menu.spec.ts` | 创建菜单→建目录→排序→可见性切换→Sidebar 刷新 | 6 个端点全覆盖 |

> 注：E2E 不追求 100% 端点覆盖率（那是集成测试的事）。每个模块覆盖**主路径 + 边界场景**即可。

---

## 8. 与其他测试层的关系

```
测试金字塔（本项目）:

        /\
       /  \     E2E 测试 (Playwright)
      /────\     ← 本文档范围：用户旅程、跨层链路
     /  ⬛ \
    /────────\   集成测试 (Vitest + supertest)
   /    ◯    \  ← API 级别：CRUD 正常+异常、404/409/422
  /────────────\
 /              \ 单元测试 (Vitest)
/    □□□□     \  ← 函数级：Service 纯函数、校验 Schema 编译、工具函数
/________________\
```

| 测试层 | 工具 | 谁度 | 何时写 |
|--------|------|------|--------|
| 单元测试 | Vitest | 函数/类 | 与代码同步（TDD） |
| 集成测试 | Vitest + supertest | API 端点 | Step 4 测试用例设计后 |
| E2E 测试 | Playwright | 用户旅程 | 模块完成后（本方案） |

Phase 1 的测试策略（来自 spec §10）：单元 + 集成先行，E2E 跟进。

---

## 9. 待定事项（M1 开始前确认）

- [ ] Playwright 安装方式：全局安装 vs 项目内 devDependency
- [ ] `pnpm test:e2e` 脚本接入 turbo.json
- [ ] 是否需要在 CI/CD 中运行（当前仅本地）
- [ ] 截图基线对比需求（视觉回归暂不需要）
- [ ] 是否需要视频录制（trace 已包含足够信息）
