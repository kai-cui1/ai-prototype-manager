# AI 驱动的开发-测试闭环工作流设计

> **版本**: v1.0 | **日期**: 2026-05-12 | **状态**: 已批准
> **适用范围**: Phase 1 M1 模块（项目管理），验证后推广至 M2~M6
> **运行环境**: 纯本地 Claude Code 会话（无 CI/CD 依赖）

---

## 1. 背景与目标

### 1.1 问题

当前开发流程中，代码完成后缺少**自动化的测试验证→问题分析→修复→重跑**闭环。依赖人工逐个检查 UI 差异、手动跑测试、人工分析失败原因，效率低且信息传递不精确。

### 1.2 目标

构建一个以 **Claude Code 为编排引擎**的 6 步自动化工作流，实现：

```
AI 开发 → 编写测试 → 跑测试 → AI 分析报告 → AI 修复 → 重跑验证
```

**核心指标**：
- 单功能点（F-Mx-NN）从编码到全绿：目标 < 30 分钟
- 问题分析准确率：根因定位到 file:line 级别
- 失败修复自动率：> 80% 的常见 bug 无需人工介入

---

## 2. 整体架构

```
                    ┌─────────────────────────────────────────────┐
                    │           Claude Code 会话（编排引擎）         │
                    │                                             │
  PRD + Tech Design │  ┌──────┐   ┌──────┐   ┌──────┐            │
  + 测试设计文档 ──→│  │Step 1│ → │Step 2│ → │Step 3│            │
                    │  │ 开发  │   │ 编写 │   │ 执行  │            │
                    │  │ 代码  │   │ 测试 │   │ 测试  │            │
                    │  └──────┘   └──────┘   └──────┘            │
                    │                            ↓               │
                    │                      ┌──────────┐          │
                    │                      │ Step 4    │          │
                    │                      │ AI 分析    │          │
                    │                      └────┬─────┘          │
                    │                           ↓                │
                    │              ┌────────────┴────────┐       │
              全绿? │              ↓                     ↓       │
            ←──────┤      ┌──────────────┐     ┌────────────┐   │
                    │      │ Step 5       │     │ 输出报告    │   │
                    │      │ AI 修复代码   │     │ 完成收尾    │   │
                    │      └──────┬───────┘     └────────────┘   │
                    │             ↓                               │
                    │        ┌──────────┐                        │
                    │        │Step 6 重跑│                        │
                    │        └─────┬────┘                        │
                    └──────────────┼─────────────────────────────┘
                                   ↓
                             回到 Step 4（或全绿退出）
```

### 2.1 输入产物（已就绪）

| 产物 | 路径 | 状态 |
|------|------|------|
| PRD + 高保真原型 | `docs/03-prd-ux/modules/project-management/` | ✅ 完成 |
| 技术方案 | `docs/04-tech-design/phase1-design-tech.md` | ✅ 完成 |
| API 测试用例（10 个功能点 × 共 ~130 TCs） | `docs/06-test-design/modules/project-management/*-api.md` | ✅ 完成 |
| E2E 测试用例（含 §10 视觉还原规范） | `docs/06-test-design/modules/project-management/*-e2e.md` | ✅ 完成 |
| 编码规范 | `docs/04-tech-design/coding-convention.md` | ✅ 完成 |
| 测试规范 v1.1（含视觉回归三层验证法） | `docs/06-test-design/test-convention.md` | ✅ 完成 |

### 2.2 核心原则

- **输入驱动**：所有代码和测试必须源自已审核文档，禁止凭空编写
- **单功能点交付**：每个 F-Mx-NN 独立完成开发→测试→修复全流程
- **TDD 顺序**：先 API 测试，后 E2E 测试（coding-convention C4 定义）
- **安全护栏**：限制自动修改范围，防止连锁误改

---

## 3. 基础设施层

闭环运行前需补齐 3 个基础设施组件。

### 3.1 组件 1：API 测试运行器

**位置**: `packages/api/`
**技术选型**: vitest（与 Vite 生态一致，内置 TypeScript 支持）

```
packages/api/
├── vitest.config.ts                  ← 新增：vitest 配置
├── test-results/                     ← 新增：API 原始测试输出（包内自包含）
│   └── api-results.json              ← vitest JSON reporter 原始输出
├── tests/
│   ├── setup.ts                      ← 全局 setup：test DB 连接 + seed
│   ├── helpers/
│   │   ├── test-factory.ts           ← 测试数据工厂（createTestProject 等）
│   │   └── api-test-client.ts        ← HTTP 断言封装
│   └── project-management/
│       ├── f-m1-01-list.test.ts
│       ├── f-m1-02-create.test.ts
│       ├── f-m1-03-detail.test.ts
│       ├── f-m1-04-edit.test.ts
│       ├── f-m1-05-archive.test.ts
│       ├── f-m1-06-company.test.ts
│       ├── f-m1-07-department.test.ts
│       ├── f-m1-08-role.test.ts
│       ├── f-m1-09-external-entity.test.ts
│       └── f-m1-10-statistics.test.ts
```

**关键设计决策**：

| 决策项 | 选择 | 理由 |
|--------|------|------|
| API 调用方式 | `app.inject()` 直接调用 Fastify app | 无需启动 HTTP server，速度提升 10x+ |
| 数据隔离 | `TEST_PREFIX = 'e2e-'` 前缀标识测试数据 | 与开发数据物理隔离，cleanup 按 prefix 删除 |
| Cleanup 策略 | 每个测试文件 `afterAll` 自行清理 | 不依赖执行顺序，支持单独运行单个文件 |
| Test DB | 使用同一 PostgreSQL 库（前缀隔离） | 避免维护两套数据库 schema |

**vitest.config.ts 配置要点**：

```ts
export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // JSON reporter 用于 AI 解析（输出到包内 test-results/）
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results/api-results.json',
    },
  },
});
```

### 3.2 组件 2：E2E 测试扩展

**位置**: `packages/e2e/`（已有 Playwright 基础设施）

```
packages/e2e/
├── playwright.config.ts             ← 已有 ✅
├── test-results/                    ← 已有 ✅（Playwright 原始输出）
│   └── e2e-results.json             ← Playwright JSON reporter 原始输出
├── tests/
│   ├── smoke.spec.ts                ← 已有 ✅
│   ├── project-management/          ← 新增目录
│   │   ├── f-m1-01-list.spec.ts     ← 13 个 E2E 用例
│   │   ├── f-m1-02-create.spec.ts
│   │   ├── f-m1-03-detail.spec.ts
│   │   ├── f-m1-04-edit.spec.ts
│   │   ├── f-m1-05-archive.spec.ts
│   │   ├── f-m1-06-company.spec.ts
│   │   ├── f-m1-07-department.spec.ts
│   │   ├── f-m1-08-role.spec.ts
│   │   ├── f-m1-09-external-entity.spec.ts
│   │   └── f-m1-10-statistics.spec.ts
│   └── helpers/
│       ├── api-client.ts            ← 已有 ✅
│       ├── db-setup.ts              ← 已有骨架，需补全 cleanup 实现
│       ├── page-objects.ts          ← 新增：页面操作封装
│       └── visual-helpers.ts        ← 新增：截图对比 + CSS 属性断言
└── reports/                         ← 新增：报告输出目录
    ├── run-*.json                   ← 结构化 JSON（AI 解析用）
    ├── run-*.html                   ← 人类可读 HTML 报告
    └── issues/
        └── run-*-issues.json        ← 分类后的问题清单
```

**新增 helpers 说明**：

| Helper | 职责 | 关键方法 |
|--------|------|---------|
| `page-objects.ts` | 封装页面元素定位和交互 | `ProjectListPage.goto()`, `.search('keyword')`, `.clickRow(n)`, `.assertBadgeColor(row, expected)` |
| `visual-helpers.ts` | 视觉还原断言（§10 三层验证） | `assertCssProperty(el, prop, value)`, `captureAndCompare(page, baselineName)`, `assertPixelDiff(screenshot, threshold)` |

### 3.3 组件 3：报告模板（两层结构）

**设计原则**：各包的测试原始输出保留在包内（自包含），Step 4 将两层合并后生成统一报告。

#### 第一层：各包原始输出（独立可查看）

```
# API 测试原始输出
packages/api/test-results/
└── api-results.json              ← vitest JSON reporter 原始输出

# E2E 测试原始输出（已有）
packages/e2e/test-results/
├── e2e-results.json              ← Playwright JSON reporter 原始输出
└── screenshots/                  ← 失败截图（Playwright 自动生成）
```

**特点**：
- 各包可**独立运行、独立查看**原始结果
- `pnpm api:test` 单独跑时结果在 `api/test-results/` 内，不跨包依赖
- 原始 JSON 格式由各自框架决定（vitest / Playwright），不做统一约束

#### 第二层：合并后的统一报告（Step 4 生成）

**位置**: `packages/e2e/reports/`

```
packages/e2e/reports/
├── run-YYYYMMDD-HHMMSS.json      ← 合并后结构化数据（含 API + E2E 全部结果 + AI 诊断）
├── run-YYYYMMDD-HHMMSS.html      ← 人类可读 HTML 可视化报告
└── issues/
    └── run-*-issues.json         ← 分类后的问题清单（供 Step 5 修复使用）
```

**生成流程**：

```
Step 3 执行:
  vitest   → packages/api/test-results/api-results.json     （API 原始）
  playwright → packages/e2e/test-results/e2e-results.json    （E2E 原始）

Step 4 分析（AI 执行）:
  读取 api-results.json + e2e-results.json
       ↓
  合并 → 错误分类 → 根因诊断 → 写入 reports/run-*.json + .html + issues/*.json
```

##### 3.3.1 合并报告 JSON 结构（AI 解析用）

```jsonc
{
  "runId": "20260512-143022",
  "timestamp": "2026-05-12T14:30:22+08:00",
  "module": "M1-项目管理",
  "featurePoint": "F-M1-01 项目列表",
  "loopRound": 1,
  "mode": "auto",               // "auto" | "semi-auto"
  "summary": {
    "total": 36,                 // API(23) + E2E(13)
    "passed": 30,
    "failed": 6,
    "skipped": 0,
    "duration_ms": 45200
  },
  "results": [
    {
      "tcId": "TC-API-M1-01-001",
      "name": "正常查询项目列表",
      "layer": "api",            // "api" | "e2e"
      "status": "passed",
      "duration_ms": 120
    },
    {
      "tcId": "TC-API-M1-01-007",
      "name": "分页参数校验-page为负数",
      "layer": "api",
      "status": "failed",
      "errorType": "ASSERTION_ERROR",   // ASSERTION_ERROR | TIMEOUT | NETWORK_ERROR | SETUP_FAILURE
      "errorDetail": "Expected status 400 but received 200",
      "stackSummary": "at f-m1-01-list.test.ts:42:21",
      "sourceFile": "packages/api/tests/project-management/f-m1-01-list.test.ts",
      "sourceLine": 42,
      "sutFile": "packages/api/src/routes/projects/list.ts",  // System Under Test
      "sutLine": 28,
      "diagnosis": {                 // Step 4 AI 分析产出
        "rootCause": "Route 层缺少 page<1 参数校验逻辑",
        "category": "missing_validation",   // missing_validation | wrong_logic | data_issue | test_bug | env_issue
        "fixConfidence": "high",           // high | medium | low
        "suggestedFix": "在 list route handler 中增加 if (page < 1) return 400"
      }
    }
  ],
  "categories": {
    "ASSERTION_ERROR": 3,
    "TIMEOUT": 1,
    "NETWORK_ERROR": 0,
    "SETUP_FAILURE": 2
  },
  "regressions": []               // 本轮新出现的失败（之前通过的）
}
```

#### 3.3.2 HTML 可视化报告（人类阅读）

HTML 报告通过浏览器打开，包含以下区块：

| 区块 | 内容 |
|------|------|
| **Header** | 运行 ID、时间戳、模块名、循环轮次、模式标签 |
| **概览卡片** | 通过率环形图、总耗时、按优先级分布（P0/P1/P2）、按层级分布（API/E2E） |
| **失败详情表** | 表格形式：TC 编号 | 名称 | 错误类型 | 堆栈摘要 | AI 诊断结论 | 建议修复位置 | 修复置信度 |
| **分类统计** | 4 类错误的饼图 + 数量 |
| **视觉回归区** | 如有截图 diff，显示实际 vs 基准的并排对比图 |
| **历史趋势** | 最近 N 次运行的通过率折线图（localStorage 存储） |
| **操作栏** | 「重跑全部」「仅重跑失败」「导出 JSON」按钮 |

#### 3.3.3 问题清单 JSON（供 Step 5 修复使用）

```jsonc
{
  "runId": "20260512-143022",
  "totalIssues": 6,
  "issues": [
    {
      "id": "ISSUE-001",
      "tcId": "TC-API-M1-01-007",
      "rootCause": "Route 层缺少 page<1 参数校验逻辑",
      "category": "missing_validation",
      "confidence": "high",
      "filesToModify": [
        { "path": "packages/api/src/routes/projects/list.ts", "line": 28, "changeType": "add_validation" }
      ],
      "suggestedFix": "在 list route handler 中增加 if (page < 1) return 400"
    }
  ]
}
```

### 3.4 组件依赖关系

```
组件1 (API vitest)  ──→  独立可运行，不依赖其他组件
组件2 (E2E 扩展)   ──→  依赖组件1的 test-factory 共享数据定义
组件3 (报告模板)   ──→  依赖组件1+2 的输出格式
```

**实施顺序**：组件 1 → 组件 2 → 组件 3

---

## 4. 六步工作流详细定义

### Step 1 — 开发代码

| 字段 | 内容 |
|------|------|
| **输入** | PRD + 技术方案 + 测试用例文档 |
| **执行者** | Claude Code（Agent 模式） |
| **产出** | `packages/api/src/` + `packages/web/src/` 功能代码 |
| **规则** | 严格遵循 coding-convention.md C1-C3 步骤；每个 F-Mx-NN 独立交付；代码源自已审核文档 |

**C1-C3 回顾**：
- C1：Backend Service 层 — 实现业务逻辑
- C2：Backend Route 层 — 注册路由 + 校验
- C3：Frontend 页面/组件 — 实现 UI

### Step 2 — 编写测试代码

| 字段 | 内容 |
|------|------|
| **输入** | Step 1 产出的代码 + `06-test-design` 对应的 `*-api.md` / `*-e2e.md` |
| **执行者** | Claude Code |
| **产出** | API 测试文件 + E2E 测试文件 |
| **规则** | 先 API 后 E2E；每个 TC-ID 对应一个 `test()` 块；命名包含 TC-ID；视觉断言按 §10 三层验证法 |

**测试命名规范**：
```ts
// API 测试
test('TC-API-M1-01-001: 正常查询项目列表', async () => { ... })

// E2E 测试
test('TC-E2E-M1-01-001: 列表页渲染 + Sidebar + 分页', async ({ page }) => { ... })
```

### Step 3 — 执行测试

| 字段 | 内容 |
|------|------|
| **命令** | 见下方 |
| **执行者** | Bash 工具 |
| **产出** | 原始测试结果 JSON 文件 |

```bash
# 3a. API 测试（vitest，通常秒级完成，输出到包内 test-results/）
cd packages/api && npx vitest run --reporter=json --outputFile=test-results/api-results.json

# 3b. E2E 测试（Playwright，需要浏览器，输出到包内 test-results/）
cd packages/e2e && npx playwright test --reporter=json --outputFile=test-results/e2e-results.json
```

**注意**：E2E 测试要求 Vite dev server 和 Fastify 已在运行（playwright.config.ts 的 webServer 配置会处理）。

### Step 4 — AI 分析问题（核心环节）

| 字段 | 内容 |
|------|------|
| **输入** | Step 3 的 JSON 结果 + 失败用例源码 + 被测代码 |
| **执行者** | Claude Code（分析 Agent） |
| **产出** | 结构化问题清单 (`issues.json`) + HTML 报告 + 根因定位 |

**分析流程**：

```
1. 读取两层原始报告:
   ├─ packages/api/test-results/api-results.json    （API 原始）
   └─ packages/e2e/test-results/e2e-results.json     （E2E 原始）
      ↓
2. 合并 + 提取所有 failed + error 用例
      ↓
2. 错误分类（4 类）:
   ├── ASSERTION_ERROR  → 断言不匹配（预期值 ≠ 实际值）
   ├── TIMEOUT           → 超时（API 响应慢 / UI 元素未出现）
   ├── NETWORK_ERROR     → 网络异常（连接拒绝 / DNS 失败 / 502）
   └── SETUP_FAILURE     → 前置条件未满足（DB seed 失败 / 页面加载超时）
      ↓
3. 逐个失败用例深度分析:
   a. 读取测试源码（test file 定位到具体行号）
   b. 读取被测源码（SUT — System Under Test）
   c. 三选一判定:
      ├─ 测试写错了（断言条件/前置数据不对）→ category: test_bug
      ├─ 实现代码有 bug（业务逻辑/校验/边界处理）→ category: wrong_logic 或 missing_validation
      └─ 环境/数据问题（DB 状态/端口占用/时序）→ category: env_issue
   d. 输出诊断:
      ├─ rootCause: 自然语言描述根因
      ├─ fixConfidence: high / medium / low
      └─ suggestedFix: 具体修复建议（含 file:line）
      ↓
4. 生成 issues.json + HTML 报告
```

**错误分类标准**：

| 错误类型 | 识别特征 | 常见场景 |
|----------|---------|---------|
| `ASSERTION_ERROR` | `expect(x).toBe(y)` 失败 | 返回值不符合预期、状态码错误、字段缺失 |
| `TIMEOUT` | `waitFor` / `await` 超时 | API 响应慢、DOM 元素未渲染、动画阻塞 |
| `NETWORK_ERROR` | `ECONNREFUSED` / `ENOTFOUND` / 502 | 服务未启动、端口冲突、proxy 配置错误 |
| `SETUP_FAILURE` | `beforeAll` / `describe` 级别失败 | DB 连接失败、seed 数据插入失败、页面导航失败 |

**根因置信度标准**：

| 置信度 | 判定条件 |
|--------|---------|
| `high` | 错误信息直接指向某行代码，且修复方向明确 |
| `medium` | 可能的原因有 2~3 个，需进一步排查 |
| `low` | 错误信息模糊或涉及复杂交互链路，建议人工介入 |

### Step 5 — 修复代码

| 字段 | 内容 |
|------|------|
| **输入** | Step 4 的 `issues.json` |
| **执行者** | Claude Code |
| **产出** | 修改后的源码文件 |
| **两种模式** | 见下方 |

**模式切换**：

| 模式 | 行为 | 触发方式 |
|------|------|---------|
| **全自动（默认）** | AI 直接读源码 → 定位位置 → 修改代码 → 进入 Step 6 | 默认启用 |
| **半自动** | AI 输出修复建议（diff 片段 + 理由）→ 等你确认后才执行修改 | 用户说「等我确认」或「半自动模式」时切换 |

**安全护栏**：

| 护航规则 | 值 | 说明 |
|----------|-----|------|
| 单轮最大修复数 | 5 个独立问题 | 避免一次改动过大导致连锁问题 |
| 最大连续修复轮次 | 3 轮 | 超过后暂停循环，输出完整上下文等你介入 |
| 修改范围限制 | 仅 issues.json 中列出的文件 | 不做"顺手重构"或无关改动 |
| 回归检测 | 每次修复后检查是否有之前通过的用例失败 | 有则标记为 regression，降低本轮修复数上限 |

### Step 6 — 重跑验证

回到 Step 3 执行全量测试（非增量），然后进入 Step 4 分析。

**退出条件矩阵**：

| 条件 | 动作 |
|------|------|
| 全部通过（passed == total） | ✅ 生成最终 HTML 报告，本轮闭环结束 |
| 有新失败（regressions.length > 0） | ⚠️ 标记 regression，降低修复置信度，继续 Step 5 |
| 同样失败持续 ≥ 3 轮 | ❌ 暂停循环，输出完整诊断上下文，等待人工介入 |
| SETUP_FAILURE 或 NETWORK_ERROR | ❌ 立即暂停（环境问题无法自动修复），提示用户检查环境 |

---

## 5. 循环控制流

```
开始
  ↓
[Step 1] 开发代码
  ↓
[Step 2] 编写测试（API + E2E）
  ↓
[Step 3] 执行测试
  ↓
[Step 4] AI 分析 ──── 全部通过? ──→ ✅ [生成最终报告] → 结束
  ↓ 否
[Step 5] 修复代码（自动/半自动）
  ↓
[Step 6] 重跑测试
  ↓
连续失败 ≥ 3轮? ──是─→ ❌ [暂停, 等待人工]
  ↓ 否
回归检测有新增? ──是─→ ⚠️ [标记 regression, 降低置信度]
  ↓
回到 Step 4
```

---

## 6. 实施计划（M1 验证阶段）

### Phase A：基础设施建设（先决条件）

| 步骤 | 任务 | 产出物 |
|------|------|--------|
| A1 | 在 `packages/api/` 安装配置 vitest | `vitest.config.ts`, `package.json` 更新 |
| A2 | 实现 `test-factory.ts`（M1 全部实体的工厂方法） | createTestProject, createTestCompany 等 |
| A3 | 实现 `api-test-client.ts`（基于 fastify inject） | 封装好的 HTTP 断言工具 |
| A4 | 补全 `db-setup.ts`（M1 10 张表的 cleanup 逻辑） | 可靠的数据隔离 |
| A5 | 实现 `page-objects.ts`（M1 页面操作封装） | ProjectListPage, ProjectDetailPage 等 |
| A6 | 实现 `visual-helpers.ts`（CSS 属性断言 + 截图工具） | assertCssProperty, captureAndCompare |
| A7 | 实现报告生成脚本（JSON → HTML 转换） | `generate-report.mjs` |

### Phase B：M1 测试代码编写（按功能点逐一推进）

对每个 F-Mx-NN（共 10 个）：

| 子步骤 | 任务 |
|--------|------|
| B1 | 根据 `*-api.md` 编写 API 测试（vitest） |
| B2 | 根据 `*-e2e.md` 编写 E2E 测试（Playwright） |
| B3 | 运行该功能点的全部测试 |
| B4 | 进入 Step 4-6 闭环直到全绿 |
| B5 | 记录结果，进入下一个功能点 |

### Phase C：验证与推广准备

| 步骤 | 任务 |
|------|------|
| C1 | 跑通 M1 全部 130+ 测试用例，记录完整耗时和通过率 |
| C2 | 收集 Step 4 分析准确率和 Step 5 自动修复成功率 |
| C3 | 总结经验，更新本文档中的经验参数（如最大修复轮次等） |
| C4 | 将工作流模式固化到 CLAUDE.md 或 memory 中，供后续模块复用 |

---

## 7. 与现有规范的衔接

本工作流是对现有 `coding-convention.md` C1-C5 循环的**增强和自动化**，不是替代：

| coding-convention 概念 | 本工作流对应 |
|-----------------------|-------------|
| C1-C3 编码实施 | Step 1 |
| C4 TDD 测试介入 | Step 2 + Step 3 |
| （原 C4 手动分析） | **Step 4（AI 自动分析）** ← 新增能力 |
| （原 C4 手动修复） | **Step 5（AI 自动/半自动修复）** ← 新增能力 |
| （原 C4 重跑验证） | **Step 6（自动重跑）** ← 新增能力 |
| C5 Code Review | 闭环结束后触发（可选，用于 Critical 维度审查） |

---

## 8. 执行 Skill 定义

> **文件**: `docs/00-project/workflow/dev-test-loop-skill.md`（从本文档 §8 提取为独立可执行技能）
> **定位**: 将 §2~§7 的描述性规则转化为 AI 可直接执行的 prompt 指令
> **关系**: Skill 引用本文档（Spec）作为权威来源，不重复定义，仅补充"怎么做"

---

### §A 元信息 & 触发条件

**触发词**（任一匹配即激活）：
- `开始测试循环`
- `跑 M1 测试`
- `执行 dev-test-loop`
- `F-M1-XX 测试闭环`

**前置检查清单**（3 项全部通过才启动，否则报错并提示修复）：

```
☐ 1. Dev server 运行中
   验证: curl -s http://localhost:13181 → 200 或能访问（端口见 CLAUDE.md「全局端口约定」）
   失败提示: "请先启动开发服务器: pnpm dev"

☐ 2. 测试基础设施就绪
   验证:
     a. packages/api/vitest.config.ts 存在
     b. packages/e2e/helpers/page-objects.ts 存在
     c. packages/e2e/helpers/visual-helpers.ts 存在
   失败提示: "测试基础设施未就绪，请先完成 Phase A（§6.A1-A7）"

☐ 3. 功能点代码已实现
   验证: 对应 F-Mx-NN 的 route 文件和前端页面文件存在
   失败提示: "功能点代码尚未实现，请先完成 Step 1"
```

**参数解析**：

| 用户输入示例 | 解析结果 |
|-------------|---------|
| `开始测试循环` | 默认：M1 全部功能点，auto 模式 |
| `跑 F-M1-01 测试` | 仅 F-M1-01 项目列表，auto 模式 |
| `F-M1-02 测试闭环 半自动` | 仅 F-M1-02 创建项目，semi-auto 模式 |

---

### §B 全局状态机

**状态变量**（用 TaskCreate/TaskUpdate 持久化）：

```typescript
// 循环级状态（整个 skill 生命周期内不变）
interface LoopState {
  featurePoint: string;        // 如 "F-M1-01"
  mode: 'auto' | 'semi-auto'; // 修复模式
  startTime: string;           // ISO 时间戳

  // 安全护栏常量
  MAX_FIX_PER_ROUND = 5;       // 单轮最大修复数
  MAX_ROUNDS = 3;              // 最大连续修复轮次

  // 轮次级状态（每轮重置）
  round: number;               // 当前轮次（从 1 开始）
  prevPassed: Set<string>;     // 上一轮通过的 TC-ID 集合
  currentFixCount: number;     // 本轮已修复数
  consecutiveFails: number;    // 连续未全通过的轮次数
}
```

**循环控制伪代码**：

```
FUNCTION main():
  // §A 前置检查
  IF NOT preflight_check() THEN abort()

  // 初始化状态
  state = init_state(feature_point, mode)

  // Step 1: 开发（如代码已存在则跳过）
  step1_develop(state)

  // Step 2: 编写测试
  step2_write_tests(state)

  // ===== 主循环 =====
  WHILE true:
    // Step 3: 执行
    step3_run_tests(state)

    // Step 4: 分析
    analysis = step4_analyze(state)

    // 退出判定
    IF analysis.all_passed THEN
      generate_final_report(analysis)
      RETURN success()
    END IF

    IF analysis.has_setup_or_network_error THEN
      PAUSE("环境问题，请人工检查")
      RETURN paused()
    END IF

    IF state.consecutive_fails >= MAX_ROUNDS THEN
      PAUSE(f"连续 {MAX_ROUNDS} 轮未全绿，等待人工介入")
      RETURN paused()
    END IF

    // Step 5: 修复
    step5_fix(analysis, state)

    // Step 6: 重跑（回到 WHILE 顶部）
    state.round++
    state.consecutive_fails++
    state.prevPassed = analysis.passed_tc_ids
  END WHILE
END FUNCTION
```

---

### §C Step 1 — 开发代码

**指令模板**：

```
你正在执行 dev-test-loop 的 Step 1：开发 {featurePoint} 的功能代码。

【输入读取顺序】
1. 读 PRD: docs/03-prd-ux/modules/project-management/{module}-prd.md
2. 读技术方案: docs/04-tech-design/phase1-design-tech.md（相关章节）
3. 读编码规范: docs/04-tech-design/coding-convention.md（§3 C1-C3）

【编码约束 Checklist】
□ 严格按 C1(Service) → C2(Route) → C3(Frontend) 顺序实施
□ 每个 AC 至少有对应的实现代码
□ 不编写任何测试代码（测试在 Step 2 完成）
□ 代码文件放入正确位置：
   - 后端: packages/api/src/routes/{module}/ 或 services/
   - 前端: packages/web/src/components/{module}/ 或 pages/

【产出验证】
完成后确认以下文件非空且无 TS 编译错误：
- {backend_file_list}
- {frontend_file_list}

如果代码已经存在且完整，跳过此步并记录"Step 1 跳过（代码已存在）"。
```

---

### §D Step 2 — 编写测试

**指令模板**：

```
你正在执行 dev-test-loop 的 Step 2：为 {featurePoint} 编写测试代码。

【输入读取顺序】
1. 读 API 测试用例: docs/06-test-design/modules/project-management/f-{featurePoint}-api.md
2. 读 E2E 测试用例: docs/06-test-design/modules/project-management/f-{featurePoint}-e2e.md
3. 读测试规范: docs/06-test-design/test-convention.md（含 §10 视觉还原规则）
4. 读已有 helpers: packages/e2e/helpers/*.ts, packages/api/tests/helpers/*.ts

【2a. API 测试编写规则】
□ 文件位置: packages/api/tests/project-management/f-{featurePoint}-test.ts
□ 使用 vitest test() 块，每个 TC-ID 对应一个 test
□ 命名格式: test('TC-API-{id}: {用例名称}', async () => { ... })
□ 使用 test-factory 创建前置数据（禁止硬编码 ID）
□ 断言覆盖: status code + body 结构 + 业务字段值 + 边界条件
□ cleanup: afterAll 中删除 TEST_PREFIX 开头的测试数据

【2b. E2E 测试编写规则】
□ 文件位置: packages/e2e/tests/project-management/f-{featurePoint}.spec.ts
□ 使用 Playwright test() 块，每个 TC-ID 对应一个 test
□ 命名格式: test('TC-E2E-{id}: {用例名称}', async ({ page }) => { ... })
□ 优先使用 page-objects 封装（禁止硬编码 selector）
□ 视觉还原断言（§10 强制要求）:
   - Layer 1: assertCssProperty(element, cssProp, expectedValue)
   - Layer 2: expect(page).toHaveScreenshot(baselineName) （如有基准截图）
□ 公共上下文中的前置条件必须在 beforeAll/beforeEach 中准备

【产出验证】
□ API 测试文件包含 N 个 test 块（N = api.md 中 TC 数量）
□ E2E 测试文件包含 M 个 test 块（M = e2e.md 中 TC 数量）
□ 无 TODO / FIXME 占位符
```

---

### §E Step 3 — 执行测试

**精确命令**：

```bash
# E3a: API 测试（vitest，秒级）
cd /Users/kaicui/Documents/work/project/ai-prototype-manager/packages/api && \
npx vitest run --reporter=json --outputFile=test-results/api-results.json

# 记录: exit code, 耗时, api-results.json 路径

# E3b: E2E 测试（Playwright，分钟级）
cd /Users/kaicui/Documents/work/project/ai-prototype-manager/packages/e2e && \
npx playwright test --reporter=json --outputFile=test-results/e2e-results.json

# 记录: exit code, 耗时, e2e-results.json 路径
```

**超时处理**：
- API 测试超时阈值：60s（单个文件）
- E2E 测试超时阈值：300s（整个 suite）
- 超时后标记为 TIMEOUT 类错误，不重试（retries=0 已配置）

**输出确认**：
```
☐ packages/api/test-results/api-results.json 存在且非空
☐ packages/e2e/test-results/e2e-results.json 存在且非空
若任一缺失: 标记为 SETUP_FAILURE，进入暂停流程
```

---

### §F Step 4 — AI 分析问题（核心步骤）

**F1. 读取原始数据**

```
1. Read: packages/api/test-results/api-results.json
2. Read: packages/e2e/test-results/e2e-results.json
3. 解析两个 JSON，提取:
   - summary: { total, passed, failed, skipped, duration_ms }
   - results[]: 每个 test 的 status, duration, error 信息
```

**F2. 错误分类决策树**

对每个 failed/error 用例，按以下逻辑分类：

```
FUNCTION classify(error):
  // 第一层：按错误信息特征快速分类
  IF error.message 包含 'ECONNREFUSED' OR 'ENOTFOUND' OR '502' OR '503' THEN
    RETURN 'NETWORK_ERROR'
  END IF

  IF error.message 包含 'Exceeded timeout' OR 'waitFor' OR 'Timeout' THEN
    // 区分是真正的超时还是断言超时
    IF error.stack 包含 'beforeAll' OR 'describe' THEN
      RETURN 'SETUP_FAILURE'
    ELSE
      RETURN 'TIMEOUT'
    END IF
  END IF

  IF error.stack 包含 'beforeAll' OR 'describe' AND
     error.message 包含 'connect' OR 'seed' OR 'navigate' THEN
    RETURN 'SETUP_FAILURE'
  END IF

  // 默认：断言错误
  RETURN 'ASSERTION_ERROR'
END FUNCTION
```

**F3. 根因诊断 Prompt 模板**

对每个 failed 用例，执行以下分析流程（可用 Agent 并行加速）：

```
分析以下测试失败，确定根因和修复方向：

【失败信息】
- TC-ID: {tcId}
- 用例名: {name}
- 错误类型: {errorType}
- 错误详情: {errorDetail}
- 堆栈摘要: {stackSummary}

【测试源码】（{testFile}:{line} 行附近）
{testCodeSnippet}

【被测源码（SUT）】（{sutFile} 如果可推断）
{sutCodeSnippet}

【分析任务】
1. 判定根因类别（三选一）:
   A. test_bug — 测试本身写错了（断言条件不对、前置数据不匹配、selector 错误）
   B. implementation_bug — 实现代码有 bug（wrong_logic / missing_validation / wrong_data_transform）
   C. env_issue — 环境/数据问题（DB 状态脏、端口冲突、时序依赖）

2. 如果选 B，进一步确定:
   - rootCause: 一句话描述根因
   - fixConfidence: high / medium / low
   - suggestedFix: 具体修复建议（含 file:line）
   - filesToModify: 需要修改的文件列表 [{path, line, changeType}]

3. 如果选 A，指出测试哪里写错了以及如何修正。
4. 如果选 C，说明需要用户做什么来修复环境。

【输出格式】JSON:
{
  "tcId": "{tcId}",
  "category": "A|B|C",
  "rootCause": "...",
  "fixConfidence": "high|medium|low",
  "suggestedFix": "...",
  "filesToModify": [...]
}
```

**F4. 生成报告**

合并所有诊断结果，写入：

```
1. packages/e2e/reports/run-{timestamp}.json
   ← 合并报告（API + E2E 全部结果 + diagnosis），格式见 §3.3.1

2. packages/e2e/reports/run-{timestamp}.html
   ← HTML 可视化报告，包含:
   a. Header: runId, timestamp, module, round, mode badge
   b. 概览卡片: 通过率、总耗时、P0/P1/P2 分布、API/E2E 分布
   c. 失败详情表: TC-ID | 名称 | 类型 | 堆栈 | 诊断 | 建议 | 置信度
   d. 分类饼图: 4 类错误数量
   e. 操作栏: 内联 CSS/JS 实现（无需外部依赖）

3. packages/e2e/reports/issues/run-{timestamp}-issues.json
   ← 问题清单（仅含 failed 项），格式见 §3.3.3
```

**HTML 报告生成要求**：
- 单文件 HTML（内联 CSS + JS），无需构建步骤
- 用 `<table>` 展示失败详情，支持排序
- 通过率用环形 CSS 绘制（无需图表库）
- 配色: 通过=green, 失败=red, 警告=orange, 跳过=gray

---

### §G Step 5 — 修复代码

**模式路由**：

```
IF state.mode == 'auto' THEN
  执行 auto_fix(issues, state)
ELSE IF state.mode == 'semi-auto' THEN
  执行 semi_auto_fix(issues, state)
END IF
```

**G1. Auto 模式流程**：

```
FUNCTION auto_fix(issues, state):
  FOR EACH issue IN issues[0..MAX_FIX_PER_ROUND]:
    IF state.currentFixCount >= MAX_FIX_PER_ROUND THEN
      log("本轮已达修复上限 {MAX_FIX_PER_ROUND}，剩余问题下轮处理")
      BREAK
    END IF

    IF issue.fixConfidence == 'low' THEN
      log("跳过低置信度问题 {issue.tcId}，建议人工介入")
      CONTINUE
    END IF

    // 读取需要修改的源码
    FOR EACH file IN issue.filesToModify:
      source_code = READ(file.path)
      // 基于 suggestedFix 定位修改点
      EDIT(file.path, old_string, new_string)
      state.currentFixCount++
    END FOR
  END FOR
END FUNCTION
```

**G2. Semi-Auto 模式流程**：

```
FUNCTION semi_auto_fix(issues, state):
  FOR EACH issue IN issues[0..MAX_FIX_PER_ROUND]:
    // 向用户展示修复建议，等待确认
    AskUserQuestion({
      question: "发现 issue {issue.tcId}: {issue.rootCause}\n\n建议修复:\n{issue.suggestedFix}",
      options: [
        { label: "同意修复", description: "AI 自动执行上述修改" },
        { label: "跳过", description: "跳过此问题，继续下一个" },
        { label: "暂停循环", description: "停止自动修复，转人工处理" }
      ]
    })

    // 根据用户选择执行或跳过
  END FOR
END FUNCTION
```

**G3. 回归检测**（每次修复后隐式执行）：

```
// 在 Step 6 重跑结果返回后对比
new_failures = 当前失败集合 - state.prevPassed
IF new_failures.size > 0 THEN
  标记 regression = new_failures
  降低下一轮 MAX_FIX_PER_ROUND 为 floor(原值 / 2)（最低 1）
  log("⚠️ 检测到 {new_failures.size} 个回归，降低修复上限")
END IF
```

---

### §H Step 6 — 重跑 & 循环判决

**重跑命令**（与 Step 3 相同，强制全量不增量）：

```bash
# 全量重跑（与 Step 3 完全相同的命令）
cd packages/api && npx vitest run --reporter=json --outputFile=test-results/api-results.json
cd packages/e2e && npx playwright test --reporter=json --outputFile=test-results/e2e-results.json
```

**判决逻辑**：

```
FUNCTION judge(analysis, state):
  // 条件 1: 全绿退出
  IF analysis.failed == 0 THEN
    generate_final_report(analysis)
    PRINT "✅ 闭环完成! 共 {state.round} 轮, 总耗时 {now - state.startTime}"
    RETURN 'EXIT_SUCCESS'
  END IF

  // 条件 2: 环境/网络问题立即暂停
  IF analysis.categories.SETUP_FAILURE > 0 OR analysis.categories.NETWORK_ERROR > 0 THEN
    PRINT "❌ 检测到环境问题（SETUP_FAILURE 或 NETWORK_ERROR）"
    PRINT "请检查: dev server 是否运行 / DB 是否可达 / 端口是否占用"
    RETURN 'PAUSE_ENV'
  END IF

  // 条件 3: 连续失败超限
  IF state.consecutive_fails >= MAX_ROUNDS THEN
    PRINT "❌ 连续 {MAX_ROUNDS} 轮未全绿，暂停等待人工介入"
    PRINT "\n=== 诊断摘要 ==="
    PRINT persisted_failures_summary  // 持续失败的 TC-ID 列表
    RETURN 'PAUSE_STUCK'
  END IF

  // 否则: 继续循环
  state.round++
  RETURN 'CONTINUE'
END FUNCTION
```

---

### §I 附录：快速参考卡片

**I.1 常用命令速查**

```bash
# 启动开发服务器
pnpm dev

# API 测试（单功能点）
cd packages/api && npx vitest run tests/project-management/f-m1-01-list.test.ts

# API 测试（全量）
cd packages/api && npx vitest run

# E2E 测试（单功能点）
cd packages/e2e && npx playwright test tests/project-management/f-m1-01-list.spec.ts

# E2E 测试（全量）
cd packages/e2e && npx playwright test

# 查看 HTML 报告
open packages/e2e/reports/run-*.html  # 最新报告
```

**I.2 文件路径索引**

| 用途 | 路径 |
|------|------|
| PRD | `docs/03-prd-ux/modules/project-management/{module}-prd.md` |
| 技术方案 | `docs/04-tech-design/phase1-design-tech.md` |
| API 测试用例 | `docs/06-test-design/modules/project-management/f-{fp}-api.md` |
| E2E 测试用例 | `docs/06-test-design/modules/project-management/f-{fp}-e2e.md` |
| 测试规范 | `docs/06-test-design/test-convention.md` |
| 编码规范 | `docs/04-tech-design/coding-convention.md` |
| 设计规范 | `docs/04-tech-design/design-language.md` |
| API 测试代码 | `packages/api/tests/project-management/f-{fp}.test.ts` |
| E2E 测试代码 | `packages/e2e/tests/project-management/f-{fp}.spec.ts` |
| API 原始结果 | `packages/api/test-results/api-results.json` |
| E2E 原始结果 | `packages/e2e/test-results/e2e-results.json` |
| 合并报告 JSON | `packages/e2e/reports/run-{ts}.json` |
| HTML 报告 | `packages/e2e/reports/run-{ts}.html` |
| 问题清单 | `packages/e2e/reports/issues/run-{ts}-issues.json` |
| API helpers | `packages/api/tests/helpers/` |
| E2E helpers | `packages/e2e/helpers/` |
| Page Objects | `packages/e2e/helpers/page-objects.ts` |
| Visual Helpers | `packages/e2e/helpers/visual-helpers.ts` |
| Test Factory | `packages/api/tests/helpers/test-factory.ts` |
| DB Setup | `packages/e2e/helpers/db-setup.ts` |

**I.3 错误分类速查表**

| 关键词 | 分类 | 典型原因 |
|--------|------|---------|
| `expect.*toBe`, `assertEqual`, `Expected.*Received` | ASSERTION_ERROR | 业务逻辑 bug / 测试断言写错 |
| `timeout`, `waitFor`, `Exceeded` | TIMEOUT | API 慢 / DOM 未渲染 / 动画阻塞 |
| `ECONNREFUSED`, `ENOTFOUND`, `502`, `fetch failed` | NETWORK_ERROR | 服务未启 / 端口冲突 / DNS |
| `beforeAll`, `describe`, `connect`, `seed`, `navigation` | SETUP_FAILURE | DB 连接 / 数据初始化 / 页面加载 |

**I.4 根因类别速查表**

| 类别 | 含义 | 处理方式 |
|------|------|---------|
| `test_bug` | 测试代码有误 | 修改测试文件 |
| `wrong_logic` | 实现业务逻辑错误 | 修改 service/route 代码 |
| `missing_validation` | 缺少校验逻辑 | 补充校验代码 |
| `wrong_data_transform` | 数据转换错误 | 修改数据映射层 |
| `env_issue` | 环境问题 | 暂停，等用户修复环境 |

---

## 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v1.0 | 2026-05-12 | 初始版本：6 步闭环架构 + 基础设施设计 + M1 实施计划 |
| v1.1 | 2026-05-12 | 报告模板改为两层结构：各包原始输出（包内自包含）+ 合并统一报告（Step 4 生成） |
| v1.2 | 2026-05-12 | 新增 §8 执行 Skill 定义：触发条件 + 状态机 + 6 步 prompt 模板 + 快速参考卡片 |
