# Dev-Test Loop Skill

> **来源 Spec**: `docs/00-project/workflow/dev-test-loop-design.md`
> **版本**: v1.0 | 与 Spec v1.2 同步
> **触发词**: `开始测试循环` / `跑 M1 测试` / `F-M1-XX 测试闭环`

---

## 触发 & 前置检查

用户说触发词时，**先执行前置检查，全部通过才继续**：

```
☐ 1. Dev server 运行中 → curl -s http://localhost:13181（端口见 CLAUDE.md「全局端口约定」）
   失败: "请先启动 pnpm dev"
☐ 2. 测试基础设施就绪 → 检查 vitest.config.ts, page-objects.ts, visual-helpers.ts
   失败: "请先完成 Phase A（§6.A1-A7）"
☐ 3. 功能点代码已实现 → 检查对应 route + 页面文件
   失败: "请先完成 Step 1 开发代码"
```

**参数解析**: `F-M1-01 测试闭环 半自动` → featurePoint=F-M1-01, mode=semi-auto

---

## 全局常量

```
MAX_FIX_PER_ROUND = 5    # 单轮最大修复数
MAX_ROUNDS = 3           # 最大连续修复轮次
```

---

## Step 1 — 开发代码

读 PRD → 读技术方案 → 读编码规范 §3 C1-C3 → 按 C1→C2→C3 顺序写代码 → 验证文件存在

**跳过条件**: 功能代码已完整存在

---

## Step 2 — 编写测试

### 2a API 测试（vitest）

- 文件: `packages/api/tests/project-management/f-{fp}.test.ts`
- 每个 TC-ID → 一个 `test('TC-API-{id}: {名称}', ...)`
- 用 test-factory 创建数据，afterAll cleanup TEST_PREFIX 数据
- 断言: status + body 结构 + 业务值 + 边界

### 2b E2E 测试（Playwright）

- 文件: `packages/e2e/tests/project-management/f-{fp}.spec.ts`
- 每个 TC-ID → 一个 `test('TC-E2E-{id}: {名称}', async ({ page }) => ...)`
- 用 page-objects 封装，禁止硬编码 selector
- §10 视觉还原: Layer 1 CSS 属性断言 + Layer 2 截图对比

---

## Step 3 — 执行测试

```bash
cd packages/api && npx vitest run --reporter=json --outputFile=test-results/api-results.json
cd packages/e2e && npx playwright test --reporter=json --outputFile=test-results/e2e-results.json
```

确认两个 JSON 文件存在且非空。

---

## Step 4 — AI 分析

### 4.1 分类（4 类）

| 类型 | 识别关键词 |
|------|-----------|
| ASSERTION_ERROR | `expect.*toBe`, `Expected.*Received` |
| TIMEOUT | `timeout`, `waitFor`, `Exceeded` |
| NETWORK_ERROR | `ECONNREFUSED`, `ENOTFOUND`, `502` |
| SETUP_FAILURE | `beforeAll` + `connect`/`seed`/`navigate` |

### 4.2 根因诊断（每个 failed 用例）

读测试源码 + 被测源码 → 三选一判定:

| 类别 | 含义 | 处理 |
|------|------|------|
| test_bug | 测试写错 | 改测试 |
| implementation_bug | 实现有 bug (wrong_logic / missing_validation) | 改源码 |
| env_issue | 环境问题 | 暂停等人工 |

输出: rootCause + fixConfidence(high/medium/low) + suggestedFix(file:line)

### 4.3 生成报告

写入 3 个文件:
- `packages/e2e/reports/run-{ts}.json` — 合并报告
- `packages/e2e/reports/run-{ts}.html` — HTML 可视化（单文件内联 CSS+JS）
- `packages/e2e/reports/issues/run-{ts}-issues.json` — 问题清单

---

## Step 5 — 修复

### Auto 模式（默认）
逐个 issue → Edit 工具直接修改源码 → 跳过 low 置信度 → 上限 5 个/轮

### Semi-Auto 模式
逐个 issue → AskUserQuestion 展示建议 → 用户选"同意"/"跳过"/"暂停"

### 回归检测
新失败数 > 0 → 标记 regression → 下轮修复上限减半

---

## Step 6 — 重跑 & 判决

全量重跑（同 Step 3 命令）→ 四路判决:

| 条件 | 动作 |
|------|------|
| failed == 0 | ✅ 生成最终报告，退出 |
| 有 SETUP/NETWORK 错误 | ❌ 暂停，提示检查环境 |
| consecutiveFails >= 3 | ❌ 暂停，输出诊断摘要等人工 |
| 其他 | round++, 回到 Step 4 |

---

## 快速参考

| 命令 | 用途 |
|------|------|
| `pnpm dev` | 启动 dev server |
| `cd packages/api && npx vitest run tests/...f-m1-XX.test.ts` | 单功能点 API 测试 |
| `cd packages/api && npx vitest run` | 全量 API 测试 |
| `cd packages/e2e && npx playwright test tests/...f-m1-XX.spec.ts` | 单功能点 E2E 测试 |
| `cd packages/e2e && npx playwright test` | 全量 E2E 测试 |
| `open packages/e2e/reports/run-*.html` | 查看最新报告 |

详细设计（格式定义、JSON schema、架构图）见 **Spec 文档**: `dev-test-loop-design.md`
