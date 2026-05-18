# 编码实施规范

> **文档编号**：docs/04-tech-design/coding-convention.md
> **状态**：v1.1 approved
> **日期**：2026-05-06
> **定位**：本项目中所有模块 Step 5~6（代码实现 + 测试）的编码工作流与质量规范（总纲）
> **适用范围**：Phase 1~5 所有模块的代码实施阶段（M1/M2/M3/M4/M5/M6 及后续模块）
> **前置依赖**：本模块的 Step 0~4 必须全部完成（PRD ✅ + 技术方案 ✅ + 测试用例 ✅）
> **关联文档**：
> - PRD 编写规范 → `docs/03-prd-ux/prd-convention.md`（Step 2 产出物格式）
> - 注释规范 → `.claude/skills/coding-with-comments`（R1-R5 强制注释规则，**写代码时强制加载**）
> - 后端编码细则 → `docs/04-tech-design/coding-convention-backend.md`（v1.1 — 后端分层/命名/模式等详细约定）
> - 前端编码细则 → `docs/04-tech-design/coding-convention-frontend.md`（v1.1 — 前端组件/Hook/状态管理等详细约定）

---

## 0. 核心原则

1. **输入驱动**：代码必须源自已审核的设计文档（PRD / 技术方案 / 测试用例），禁止凭空编写
2. **功能点原子化**：以功能点（F-Mx-NN）为最小交付单元，每个功能点可独立运行、独立验证
3. **TDD 先行**：功能点代码完成后立即写测试，测试全通过才算该功能点完成
4. **分层解耦**：Route 层（参数透传+响应组装）→ Service 层（业务逻辑）→ Model 层（数据访问），严禁跨层调用
5. **契约一致**：API 契约（TypeBox Schema）= PRD Data Specs = shared/types = 测试断言，四方对齐
6. **注释即代码**：注释不是事后装饰，是代码的可读性保障。遵循 R1-R5 强制规则，**无注释的提交不予通过 Review**

---

## 1. 编码前准备阶段

### 1.1 前置条件检查

开始任何模块的编码前，**必须确认以下文件存在且状态为已完成**：

| 检查项 | 对应 SDLC 步骤 | 验证方式 |
|--------|:-------------:|---------|
| 领域模型设计 | Step 1 ✅ | `docs/02-domain-model/` 下有对应模块的实体定义 |
| 产品 PRD | Step 2 ✅ | `docs/03-prd-ux/modules/[模块名]/` 下有完整 PRD（含 Data Specs + Business Rules） |
| 技术方案设计 | Step 3 ✅ | `docs/04-tech-design/` 下有对应技术方案（含 API 端点清单 + 分层架构 + 错误处理） |
| 数据库 Schema 设计 | Step 3 子产出 | `docs/05-data-design/` 下有 DDL 定义 |
| 测试用例设计 | Step 4 ✅ | `docs/06-test-design/modules/[模块名]/` 下有完整的 api.md + e2e.md |

> **违反后果**：若上述任一步骤未完成就进入编码，产生的代码将缺乏设计依据，后续返工概率极高。

### 1.2 硬前置准备工作

以下工作必须在第一个功能点编码**之前**完成，否则无法推进：

| # | 准备工作 | 说明 | 通用做法 |
|---|---------|------|---------|
| **P1** | 补齐 Drizzle ORM Schema | 将本模块涉及的数据库表定义为 Drizzle table 对象，写入 `packages/api/src/models/schema.ts` | 按 DDL 文档逐表翻译；补充 `relations.ts` |
| **P2** | 补齐 TypeBox 校验 Schema | 为本模块所有 CRUD 操作的输入/查询参数创建 TypeBox schema | 新建 `[模块名].schema.ts`；公共类型抽到 `base.ts` |
| **P3** | 确定分层架构约定 | routes / services / 的目录结构、文件命名、导出方式 | 以第一个功能点的实际代码建立模板，后续统一遵循 |
| **P4** | 安装所需 UI 组件库 | 前端页面需要的 shadcn/ui 组件 | 按需安装（用到才 `npx shadcn add`），不预装 |

> **P1 和 P2 是硬阻塞**——没有表定义无法写 Service，没有校验 Schema 无法写 Route。P3 在写完第一个功能点后自然确立。P4 可随功能点逐步添加。

### 1.3 准备就绪确认

P1-P2 完成后，**必须经人工确认**才能进入功能点编码循环：

- 展示新增的 Drizzle 表定义（字段、约束、关系）
- 展示新增的 TypeBox 校验 Schema（与 PRD Data Specs 逐字段对照）
- 确认无误后 → 进入 §2 功能点编码循环

---

## 2. 输入物阅读顺序

每个功能点（F-Mx-NN）开始编码前，按以下顺序阅读并提取关键信息：

```
① PRD 对应章节（§4.x Data Specs + Business Rules + AI Coding Hints）
   ↓ 提取：API 契约（请求/响应字段）、业务规则编号清单、实现陷阱

② 技术方案对应章节（端点定义 + 分层约定 + 响应格式 + 错误码体系）
   ↓ 提取：路由注册方式、Service 函数签名模式、错误码映射

③ 数据库 Schema DDL（本功能点涉及的表）
   ↓ 提取：字段类型、NOT NULL 约束、UNIQUE 约束、级联删除策略、默认值

④ 共享类型定义（packages/shared/src/types/）
   ↓ 确认：复用已有类型，避免重复定义；发现缺失则先补类型

⑤ 测试用例（api.md + e2e.md）
   ↓ 提取：每条 TC 的断言预期 → 反推实现逻辑，作为编码时的逐项 checklist
```

### 各输入物的角色定位

| 输入物 | 角色 | 编码时的使用方式 |
|--------|------|----------------|
| **PRD** | **需求权威** | 每个字段的约束、每条规则的逻辑都从这里来。遇到歧义以 PRD 为准 |
| **技术方案** | **实现指南** | 怎么注册路由、怎么组装响应、错误码用什么值——照着做 |
| **DB DDL** | **持久化契约** | 字段名、类型、约束必须与之一致。Drizzle schema 是 DDL 的 TypeScript 翻译 |
| **shared/types** | **类型复用层** | API 返回值的 TypeScript 类型。优先复用，不重复定义 |
| **测试用例** | **验证清单** | 编码时逐条对照 TC 断言，确保实现覆盖了所有场景。是"有没有做对"的最终裁判 |

---

## 3. 单功能点编码循环

### 3.1 循环总览

每个功能点 **F-Mx-NN** 按以下 5 步推进，**顺序不可跳跃**：

```
┌──────────────────────────────────────────────┐
│  C1: 后端 Service 层                          │
│     实现 CRUD 业务逻辑（按 PRD Business Rules） │
│     遵循后端编码细则（§7 + coding-convention-backend.md）│
│     产出：services/[模块].service.ts           │
├──────────────────────────────────────────────┤
│  C2: 后端 Route 层                            │
│     注册 Fastify 路由 + preValidation 校验     │
│     遵循后端编码细则                           │
│     产出：routes/[模块].ts                     │
├──────────────────────────────────────────────┤
│  C3: 前端页面 / 组件                           │
│     实现 UI 交互（按 E2E 用例的行为预期）        │
│     遵循前端编码细则（§8 + coding-convention-frontend.md）│
│     产出：pages/*.tsx + components/*.tsx       │
├──────────────────────────────────────────────┤
│  C4: TDD — 测试编写与执行                      │
│     API 测试：按 api.md 用例逐条实现            │
│     E2E 测试：按 e2e.md 用例逐条实现            │
│     全部通过 → 该功能点完成                     │
├──────────────────────────────────────────────┤
│  C5: Code Review（质量检查点）                  │
│     触发 code-reviewer agent 自动审查           │
│     按 §6 审查标准逐项检查                      │
│     Critical/Important 问题修复后才可继续       │
└──────────────────────────────────────────────┘
            ↓ C5 通过
      进入下一个 F-Mx-NN
```

### 3.2 C1: Service 层

**职责**：封装业务逻辑，是规则实现的主体。

**输入**：PRD Business Rules（B-Mx-NN）、DB Schema
**输出**：纯函数或类方法，接收参数返回领域对象

**编码要点**：

| 要点 | 规范 |
|------|------|
| 函数签名 | 导出函数必须有 JSDoc（含 @param / @returns / @example），**无例外** |
| 业务规则 | 每条 B-rule 对应一段明确的逻辑分支（if/throw/return） |
| 注释规范 | 遵循 R1-R5（见 `.claude/skills/coding-with-comments`），**Service 层为最高优先级** |
| 错误抛出 | 业务异常抛出带 statusCode 的 Error 对象，供全局 error handler 捕获 |
| 数据转换 | DB 行（snake_case）→ API 响应（camelCase）在此层完成 |

**禁止事项**：
- 禁止在 Service 中直接操作 request/reply（Fastify 框架对象）
- 禁止跳过校验直接操作数据库
- 禁止在 Service 中拼接 SQL 字符串（必须通过 Drizzle Query Builder）

> **详细编码约定**（命名风格、函数组织、错误码使用、事务处理等）→ 见 `coding-convention-backend.md`（待编写）

### 3.3 C2: Route 层

**职责**：HTTP 协议适配——参数提取、校验触发、响应组装。

**输入**：Tech Design §5.4（端点定义）、TypeBox 校验 Schema
**输出**：Fastify 路由处理器

**编码要点**：

| 要点 | 规范 |
|------|------|
| 路由注册 | 通过 `app.register(routeModule, { prefix: '/api/v1/...' })` 注册 |
| 参数提取 | 从 `request.params` / `request.query` / `request.body` 提取 |
| 校验触发 | 在 `preValidation` hook 中调用 TypeBox + Ajv 校验 |
| 响应格式 | 成功：`{ data: T }` 或 `{ data: T[], meta: { total, page, pageSize } }` |
| 错误处理 | 不自行 catch——交给全局 `setErrorHandler` 统一处理 |

**标准 Route 处理器模板**：

```typescript
// 路由处理器只做三件事：提取参数 → 调用 service → 组装响应
export async function getProjectHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params;                              // 1. 提取
  const project = await projectService.getById(db, id);        // 2. 委托
  return { data: project };                                   // 3. 组装
}
```

> **详细编码约定**（路由分组方式、中间件链、错误包装格式等）→ 见 `coding-convention-backend.md`（待编写）

### 3.4 C3: 前端页面 / 组件

**职责**：用户交互界面实现。

**输入**：PRD 页面交互描述、E2E 测试用例的行为预期
**输出**：React 页面组件 + 自定义 Hooks

**编码要点**：

| 要点 | 规范 |
|------|------|
| 状态管理 | 使用 React `useState` / `useCallback`（不引入 Redux/Zustand） |
| 数据获取 | 封装自定义 Hook（如 `useProjectList`），内部调用 ApiClient |
| Loading 态 | 异步操作期间显示 loading spinner + 禁用按钮（UI-Mx-02） |
| 错误态 | API 错误通过 Toast / 内联提示展示，不白屏 |
| 空状态 | 列表无数据时显示空状态 UI + 创建入口（UI-Mx-04） |
| UI 约定 | 遵循 E2E 用例中定义的交互细节（debounce 时间、对话框类型等） |
| 注释规范 | 遵循 R1-R5（见 `.claude/skills/coding-with-comments`），**组件和 Hook 为最高优先级** |

> **详细编码约定**（组件目录结构、Hook 设计模式、状态管理策略、样式组织、shadcn/ui 使用规范等）→ 见 `coding-convention-frontend.md`（待编写）

### 3.5 C4: TDD 测试介入

**时机**：C1-C3 代码完成后**立即执行**，不等其他功能点。

**执行顺序**：

```
① API 集成测试（验证后端契约正确性）
   └─ 按 api.md 用例逐条编写，每条 TC 对应一个 test() 块
   └─ 断言：HTTP status code + response body 结构 + 业务逻辑正确性
   │
② E2E 测试（验证前端行为正确性）
   └─ 按 e2e.md 用例逐条编写，每条 TC 对应一个 test() 块
   └─ 断言：DOM 元素存在性 + 用户交互行为 + 视觉状态变化
   │
③ 全量运行
   └─ 该功能点的所有 TC 必须全部通过
   └─ 任一失败 → 修复代码 → 重新运行 → 直至全绿
```

**通过标准**：

| 标准 | 要求 |
|------|------|
| TC 覆盖率 | api.md 中列出的所有 TC 必须有对应的 test 实现（100%） |
| 通过率 | 100% 通过，0 失败 |
| skip 禁止 | 不允许 `test.skip()` —— 要么实现要么不写此功能点 |
| 回退机制 | 测试发现的缺陷 → 返回 C1-C3 修改代码 → 重新跑 C4 |

> **【铁律】所有测试必须串行执行，禁止并行**
>
> | 框架 | 配置项 | 必填值 | 原因 |
> |------|--------|:------:|------|
> | Vitest (API 测试) | `fileParallelism` | `false` | 共享 DB，`afterAll` cleanup 会误删并行文件的数据 |
> | Playwright (E2E 测试) | `fullyParallel` | `false` | 共享 DB，多 spec 并发读写导致乐观锁冲突 / 归档竞争 |
>
> **Code Review 审查点**：新增或修改测试配置文件时，必须确认包含上述串行设置。遗漏此配置 = **Important 级别问题**。

---

## 4. Code Review 标准（C5 详细规范）

### 4.1 触发条件与执行方式

| 项 | 说明 |
|----|------|
| **触发时机** | C1-C4 全部完成且测试全通过后 |
| **执行方式** | AI Agent 自动审查（code-reviewer） |
| **输入材料** | 功能点涉及的所有新增/修改文件 + PRD 对应章节 + 测试用例文件 |
| **输出产物** | Review 报告（含 Critical / Important / Minor / Suggestion 分级问题列表） |

### 4.2 五维审查模型

Review 从以下 5 个维度逐一检查，每个维度有明确的通过/不通过标准：

#### 维度一：需求一致性（Requirement Conformance）

**问题**：代码是否完整实现了 PRD 定义的功能？

| 检查项 | 通过标准 | 不通过示例 |
|--------|---------|-----------|
| 功能完整性 | PRD §4.x 定义的所有字段/操作/状态均有对应实现 | 缺少某个 CRUD 操作或某字段的展示 |
| Data Specs 对齐 | API 请求/响应字段与 PRD Data Specs 逐一匹配 | 多余字段、缺少字段、字段类型不一致 |
| 业务规则覆盖 | PRD 中每条 B-rule 都有对应的代码路径 | 某 B-rule 无 if/throw/return 分支 |
| AC 验收达标 | 所有验收标准（AC-Mx-NN）都有对应的功能或测试支撑 | 某 AC 无任何代码或测试覆盖 |

#### 维度二：规则覆盖完整性（Rule Coverage）

**问题**：所有业务规则是否都有可追溯的实现？

| 检查项 | 通过标准 |
|--------|---------|
| B-rule 映射 | 每个 B-rule 编号可在代码中定位到对应逻辑（通过注释标注 `// B-Mx-NN: ...`） |
| G-rule 应用 | 全局规则（乐观锁、归档保护、引用完整性）在每个相关端点中一致应用 |
| 边界条件 | 规则的边界值（空值、最大长度、0、负数、边界 ID）均有处理 |

#### 维度三：测试质量（Test Quality）

**问题**：测试是否充分验证了实现的正确性？

| 检查项 | 通过标准 |
|--------|---------|
| TC 实现率 | api.md + e2e.md 中列出的每个 TC 都有对应的 test() 块（100%） |
| 断言充分性 | 每个测试不仅有 status code 断言，还验证了 response body 结构和关键业务值 |
| 异常覆盖 | 每个异常场景（400/404/409/422/500）至少有一个正向 + 一个反向测试 |
| 双层一致性 | API 层测试验证后端契约，E2E 层测试验证前端行为，两者不重复但互补 |

#### 维度四：代码质量（Code Quality）

**问题**：代码是否达到可维护的标准？

| 检查项 | 通过标准 | 对照来源 |
|--------|---------|---------|
| **注释完备性（R1-R5）** | **每个导出函数有 JSDoc、每个分支有注释、每段长代码有段落注释、非显而易见逻辑有 why 注释** | `.claude/skills/coding-with-comments` |
| 命名清晰度 | 函数/变量/类名称准确表达意图，不使用缩写（除公认缩写如 id/url/db） | 后端/前端编码细则 |
| 分层纯净度 | Route 不含业务逻辑，Service 不含 HTTP 细节，Model 不含业务规则 | 本规范 §3.2-3.3 |
| 无硬编码 | 魔法数字提取为常量，枚举值使用 enum 或 const 对象，字符串 key 集中定义 | 后端/前端编码细则 |
| 类型安全 | 使用 TypeScript 严格模式，避免 `any`，API 边界有明确类型定义 | shared/types |
| 函数粒度 | 单个函数不超过 50 行（不含注释和 JSDoc）；超过则拆分 | 通用 |

**注释审查专项（R1-R5 强制检查清单）**：

| 规则 | 检查内容 | 典型违规 |
|------|---------|---------|
| **R1 文件头** | 每个 .ts/.tsx 有 `@module` + `@description` | 文件顶部无任何注释 |
| **R2 函数 docstring** | 每个导出函数/类有 JSDoc（@param/@returns） | 导出函数无注释（"太简单不需要"是违规借口） |
| **R3 分支注释** | 每个 if/else if/else 前有一行意图注释 | 大段 if/else 无任何分支说明 |
| **R4 段落注释** | 连续 >10 行代码段开头有目的概括 | 长查询/长构建逻辑无段落说明 |
| **R5 Why 注释** | 正则/魔法数字/业务规则/workaround 有原因解释 | 关键逻辑只有"是什么"没有"为什么" |

> **R1-R5 违规判定**：发现任一 R 规则违规 → 记为 **Important** 级别问题（影响代码可读性和后续维护）。批量违规（>3 处）升级为 **Critical**。

#### 维度五：安全性（Security）

**问题**：是否存在安全漏洞？

| 检查项 | 通过标准 |
|--------|---------|
| SQL 注入防护 | 所有 DB 操作通过 Drizzle Query Builder，无字符串拼接 |
| XSS 防护 | 用户输入在渲染前转义，不使用 `dangerouslySetInnerHTML` |
| 权限控制 | 写操作有归属校验（project_id 匹配），跨项目数据不可越权访问 |
| 敏感信息 | 错误响应不泄露内部堆栈、DB 字段名、内部路径 |

### 4.3 问题分级与处理

| 级别 | 定义 | 示例 | 处理方式 | 能否继续？ |
|------|------|------|---------|:----------:|
| **Critical** | 功能缺陷或安全问题 | B-rule 未实现、SQL 注入风险、核心流程缺失 | 立即修复 | **否** |
| **Important** | 质量缺陷影响维护 | R1-R5 批量违规、类型滥用 any、分层污染 | 修复后再继续 | **否** |
| **Minor** | 风格或优化建议 | 变量命名不够理想、可提取公共工具函数 | 记录，本轮不阻塞 | 是 |
| **Suggestion** | 改进建议 | 可考虑的架构优化方向 | 记录参考 | 是 |

### 4.9 Review 通过标准

一个功能点的 Review **必须满足**以下全部条件才算通过：

- [ ] Critical 问题数 = **0**
- [ ] Important 问题数 = **0**（或已全部修复并重新验证）
- [ ] 维度一（需求一致性）：所有检查项通过
- [ ] 维度二（规则覆盖）：B-rule 映射率 ≥ 95%（允许 ≤5% 的"设计预留"规则暂缓）
- [ ] 维度四（代码质量）：R1-R5 违规数 ≤ **1**（单处疏忽可接受，批量违规必返工）

---

## 5. 确认环节总览

### 5.1 检查点矩阵

| 检查点名称 | 触发时机 | 执行人 | 产出 |
|-----------|---------|--------|------|
| **准备就绪确认** | P1-P2 Schema 工作完成 | 你审阅 + AI 展示 | Drizzle schema + TypeBox schemas |
| **功能点 Review** | 每个 F-Mx-NN 的 C1-C5 完成 | AI agent 自动 review（按 §4 五维模型） | Review 报告（Critical/Important/Minor） |
| **里程碑确认** | 一组相关功能点全部完成 | 你决策 | 进度汇报 + 风险评估 |

### 5.2 里程碑划分示例

里程碑的划分因模块而异，以下是通用原则：

- **一组语义相关的功能点**构成一个里程碑（如「项目实体的完整 CRUD」= F-M1-01~05）
- 里程碑之间可以安全提交 Git commit
- 里程碑确认时整体审视：功能完整性 × 测试覆盖率 × 代码质量趋势

---

## 6. 异常处理与回滚策略

### 6.1 设计文档矛盾

**现象**：PRD 与技术方案对同一问题的描述不一致。

**处理**：
1. 停下当前功能点的编码
2. 列出矛盾点 + 两个版本的描述
3. 由你做出决策
4. 决策记录到 `docs/01-design-idea/`（作为 design decision log）
5. 按决策结果继续编码

### 6.2 测试用例本身有误

**现象**：编码时发现测试用例的断言预期与 PRD/Tech Design 矛盾。

**处理**：
1. 确认是以 PRD 为准还是测试用例有笔误
2. 若测试用例有误 → 修改测试用例文件，在文件头注明变更原因和日期
3. 同步更新 `_coverage-summary.md`（如有影响）

### 6.3 单功能点代码量过大

**阈值**：单个功能点的新增代码超过 **500 行**（不含测试和注释）。

**处理**：拆分为子任务，每个子任务独立走 C1-C5 流程。

### 6.4 技术选型阻塞

**现象**：某 UI 组件不支持需求行为，或某技术方案在实际编码中不可行。

**处理**：提出 2~3 个替代方案（含 trade-off 分析），由你选择。

---

## 7. 后端编码细则（概要）

> **详细内容** → `docs/04-tech-design/coding-convention-backend.md`（v1.0 ✅）
>
> 本节列出后端编码的核心约定要点。完整的命名规范、目录结构、模式库、错误码使用指南等内容详见子文件。

### 7.1 分层架构

```
packages/api/src/
├── app.ts                    # Fastify 入口（路由注册、插件配置、全局错误处理）
├── db.ts                     # Drizzle 数据库连接实例
├── models/
│   ├── schema.ts             # Drizzle Table 定义（所有表）
│   └── relations.ts          # Drizzle Relation 定义
├── services/
│   ├── [模块].service.ts      # 业务逻辑层（CRUD + 规则实现）
│   └── common/               # 公共工具（分页、排序、ID 生成等）
├── routes/
│   ├── [模块].ts             # 路由处理器（HTTP 适配层）
│   └── common/               # 公共中间件（认证、日志等）
└── __tests__/
    └── [模块].test.ts         # API 集成测试
```

### 7.2 核心约定（摘要）

| 约定项 | 规则 |
|--------|------|
| 文件命名 | kebab-case：`project.service.ts`、`organization.routes.ts` |
| 函数命名 | camelCase 导出：`listProjects()`、`createCompany()` |
| 命名空间前缀 | 按实体分组：`project*` / `company*` / `department*` / `role*` / `externalEntity*` |
| 错误抛出 | 使用自定义 AppError 类，携带 statusCode + code + message |
| 事务处理 | 多表写操作使用 `db.transaction()` 包裹 |
| 分页 | 统一分页辅助函数，返回 `{ data, meta: { total, page, pageSize } }` |
| snake_case ↔ camelCase | 在 Service 层统一转换，Route 层直接透传 camelCase |

---

## 8. 前端编码细则（概要）

> **详细内容** → `docs/04-tech-design/coding-convention-frontend.md`（v1.0 ✅）
>
> 本节列出前端编码的核心约定要点。完整的组件设计模式、Hook 规范、状态管理、样式组织、shadcn/ui 使用指南等内容详见子文件。

### 8.1 目录结构

```
packages/web/src/
├── App.tsx                    # 路由配置
├── main.tsx                   # 入口
├── api/
│   └── client.ts              # ApiClient（HTTP 请求封装）
├── components/
│   ├── ui/                    # shadcn/ui 基础组件（CLI 生成，不手改）
│   ├── layout/                # 布局组件（Layout、Sidebar 等）
│   └── [业务域]/              # 业务组件（按模块组织）
├── hooks/                     # 自定义 Hooks
│   ├── use[Entity]List.ts     # 列表数据获取
│   ├── use[Entity]Detail.ts   # 详情数据获取
│   └── use[Entity]Mutation.ts # 写操作（创建/编辑/删除）
├── lib/
│   └── utils.ts               # 工具函数（cn() 等）
├── pages/                     # 页面组件（对应路由）
│   ├── ProjectList.tsx
│   └── ProjectDetail.tsx
└── types/                     # 前端专用类型（shared 未覆盖的部分）
```

### 8.2 核心约定（摘要）

| 约定项 | 规则 |
|--------|------|
| 文件命名 | PascalCase 组件：`ProjectTable.tsx`；camelCase hook：`useProjectList.ts` |
| 组件拆分 | 单文件 < 200 行则保持单体；> 200 行则拆分子组件 |
| Hook 封装 | 所有 API 调用封装为自定义 Hook，页面组件不直接调用 ApiClient |
| 状态管理 | useState + useCallback（Phase 1 不引入状态管理库） |
| Loading 态 | Hook 返回 `{ data, loading, error }` 三态，UI 根据 loading 显示 spinner |
| 样式方案 | Tailwind CSS utility classes + shadcn/ui 组件变体 |
| UI 组件安装 | 按需 `npx shadcn add <component>`，不预装 |

---

## 9. 产出物清单

每个功能点完成后的标准产出：

| # | 产出物 | 位置 | 说明 |
|---|--------|------|------|
| 1 | Service 层代码 | `packages/api/src/services/[模块].service.ts` | 业务逻辑实现 |
| 2 | Route 层代码 | `packages/api/src/routes/[模块].ts` | HTTP 路由处理器 |
| 3 | 前端页面 | `packages/web/src/pages/*.tsx` | 用户界面 |
| 4 | 前端组件 | `packages/web/src/components/**/*.tsx` | 可复用 UI 组件 |
| 5 | 自定义 Hooks | `packages/web/src/hooks/*.tsx` | 数据获取/状态管理 |
| 6 | API 测试 | `packages/api/src/__tests__/[模块].test.ts` 或类似路径 | API 集成测试 |
| 7 | E2E 测试 | `packages/e2e/tests/[模块].spec.ts` | 端到端测试 |
| 8 | shadcn/ui 组件 | `packages/web/src/components/ui/*` | 按需安装的 UI 基础组件 |

---

## 版本历史

| 版本 | 日期 | 变更要点 |
|------|------|---------|
| v1.0 | 2026-05-06 | 初版，基于 M1 编码前的讨论确定通用工作流 |
| v1.1 | 2026-05-06 | ① 移至 docs/04-tech-design/ ② 新增 §7/§8 前后端编码细则引用 ③ 扩展 §4 Code Review 为五维审查模型 ④ 强化 R1-R5 注释强制要求 ⑤ 新增 Review 通过标准 checklist |
| v1.2 | 2026-05-07 | ⑥ 后端编码细则 v1.0 完成（~500 行，含 Service/Route/Model 模板库 + 错误体系 + 分页/事务/排序）⑦ 前端编码细则 v1.0 完成（~550 行，含组件/Hook 模板库 + 状态管理 + Tailwind/shadcn/ui 规范） |
