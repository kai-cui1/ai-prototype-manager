# AGENTS.md

This file provides guidance to AI coding agents (Qoder, Codex, etc.) when working with code in this repository.

## Project Overview

**ai-prototype-manager** — AI 时代的软件原型设计工具，核心定位：**面向 AI 的原型系统**。

与传统原型工具（Figma/Sketch 等）聚焦"给人看的高保真视觉"不同，本项目聚焦于 **"给 AI 用的结构化语义"** —— 确保原型中包含的业务逻辑、交互逻辑、数据关系等关键信息能够完整传递给下游 Coding Agent，而非在视觉还原过程中丢失。

## 三大核心支柱

### 1. Agentic 原型构建
产品经理与 AI 对话协作完成原型设计：PM 输出决策和思考，AI 动笔执行。支持从粗粒度（"我要一个电商后台"→生成完整原型）到细粒度（组件级对话迭代）的全流程。人类可实时观察 AI 的产出进程和结果。

### 2. Agentic 原型数据输出
面向 Coding AI 提供易于提取、理解的原型设计结构化信息输出，确保原型产物 100% 可被 Coding Agent 消费以指导编码工作。

### 3. 结构化交互原型数据
超越布局和展示层面的"高保真"，最大化抽象和提取原型中的：
1. **交互逻辑**（最高优先级）— 点击、跳转、状态变化、条件分支流程
2. **数据模型关系** — UI 元素绑定字段、数据流向
3. **业务规则** — 校验逻辑、权限控制、计算公式
4. **组件语义** — 元素的业务意图（是"提交"还是"取消"）

## 产品目标
本系统要实现完整支持软件开发的工作流，参见文档：`docs/01-design-idea/workflow.md`

## 本项目工作规范 **必须遵守**

对话过程中，涉及软件功能的讨论和实现，**切记一定** 检查是否经过了以下步骤

每个功能模块按以下 8 步（S0~S7）推进，**框定范围 → 走完 8 步 → 再进入下一模块**：

| 步骤 | 名称 | 产出物 | 对应 `docs/` 目录 |
|------|------|--------|:-----------------:|
| **S0** | 产品思路 & 想法 | 模糊方向、未被详细讨论的 idea | `01-design-idea/` |
| **S1** | 领域模型设计 | 领域对象、对象属性、对象关系（ER 图）、关键对象状态图 | `02-domain-model/` |
| **S2** | 产品 PRD 设计（纯业务层） | 业务流程（跨对象操作序列）、业务规则、功能结构、数据规格（不涉及交互界面细节） | `03-prd-ux/modules/` |
| **S3** | 交互设计 | 人-系统交互规格 + AI-系统交互规格（页面布局、操作流程、语义层设计） | `03-prd-ux/modules/`（与 PRD 并列） |
| **S4** | 技术方案设计 | 技术选型、架构图、DB 设计规范、API 规范 | `04-tech-design/` + `05-data-design/` |
| **S5** | 测试用例设计 | 测试方案 + 用例集（编码前先写） | `06-test-design/` |
| **S6** | 代码实现 | 具体编程任务（接口/页面级颗粒度） | `packages/` (代码) |
| **S7** | 测试编写与验证 | API 测试编写与验证 + 全绿闭环（E2E 由人工执行） | `packages/api/tests/` |

> **S2 与 S3 的分离原则**（2026-05-25 决策）：
> - **S2（PRD）只定义业务层**：业务流程（跨对象操作序列，只描述动作先后顺序和输入输出，不涉及交互界面）、业务规则、功能结构、数据规格
> - **S3（交互设计）定义交互层**：人-系统交互（页面布局、UI 元素、操作流程）+ AI-系统交互（语义层设计、数据绑定、交互逻辑结构化表达）
> - 分离的理由：面向 AI 的原型系统需要同时设计"人-系统交互"和"AI-系统交互"两个层面，这与传统软件只关注人机交互不同。将交互设计从 PRD 中剥离为独立步骤，可以让 PRD 聚焦业务本质，交互设计则可以在业务基础上独立演进。

> 工程基础设施（技术选型/脚手架/编码规范/Design Token）为一次性投入，见 Phase 0 和 roadmap §1。部署方案在全部功能完成后统一实施。

### 关于 HTML 高保真原型的决策（2026-05-20，2026-05-25 归档）

**原流程中的 HTML 高保真原型步骤已取消并归档。** 原因：
1. AI 生成的 HTML 原型与 PM 预期存在偏差，原型本身成为额外的失真层
2. 代码实现对原型的还原度不高，原型→代码又是一次失真
3. 实践证明，AI 直接按 PRD + 交互设计文档写代码 + PM 通过截图确认 UI 的模式更高效

**归档处理**（2026-05-25）：原 `docs/03-prd-ux/prototypes/` 目录已归档至 `docs/99-archived/prototypes/`，所有规范文档中引用原型的地方已清理。

**UI 确认方式**：S6 代码实现完成后，**AI 先通过 browser-agent 截图自检布局和交互是否符合预期**，确认无明显问题后再截图给 PM 确认，PM 反馈修改点，AI 迭代调整。

**视觉参考来源**：取消原型后，编码时的视觉参考来自以下三层：
1. **设计语言规范** → `docs/04-tech-design/design-language.md`（全局视觉约束唯一权威来源：品牌色、字体、间距、组件、图标、动效等）
2. **S3 交互设计文档** → 各模块的页面布局和元素规格
3. **browser-agent 截图自检** → 实际渲染效果的验证

### S6~S7 编码规范 **（必须遵守）**

**S6（代码实现）和 S7（测试编写与验证）开始前，必须先阅读并遵循** `docs/04-tech-design/coding-convention.md`（总纲）+ 对应的**后端/前端编码细则子文件**。

核心要求：
- 以**功能点（F-Mx-NN）**为最小交付单元，每个功能点独立完成 Service → Route → 前端 → 测试 → Review 全流程
- **TDD 模式**：功能点代码写完后立即编写测试，测试全通过才算完成
- 代码必须源自已审核的 PRD + 交互设计 + 技术方案 + 测试用例，禁止凭空编写
- 每个 F-Mx-NN 完成后触发 AI Code Review，Critical/Important 问题必须修复后才可继续

### 测试数据安全铁律 **（必须遵守 — 违反即导致用户数据丢失）**

**事故记录（2026-05-14）**：`f-m1-01-list.test.ts` 的 TC-015 用例使用 `db.delete(projects)` 无条件全表删除，每次全量跑测试时清空用户人工创建的所有项目 + CASCADE 级联删除子表数据。修复后改为 `where(ilike(projects.name, 'e2e-%'))`。

> **核心原则：测试代码的任何 DML 操作（INSERT/UPDATE/DELETE）必须限定在测试数据范围内，绝对不能触碰用户/开发数据。**

| # | 规则 | 正确做法 | 错误做法（已发生事故） |
|---|------|---------|---------------------|
| 1 | **DELETE 必须带 WHERE 条件** | `db.delete(projects).where(ilike(projects.name, 'e2e-%'))` | `db.delete(projects)` ← **杀人代码** |
| 2 | **测试数据必须带前缀隔离** | name = `'e2e-' + testName` | name = `'test-proj'` / `'edited-full'` |
| 3 | **PUT body 的字段值也需带前缀** | `{ name: 'e2e-edited' }` | `{ name: 'edited-full-project' }` → 孤儿数据无法被 cleanup 清理 |
| 4 | **破坏性操作后做安全检查** | finally 块中验证非测试数据数量不变 | 删完就结束，不验证副作用 |
| 5 | **禁止 TRUNCATE / DROP / 全表扫描式操作** | 使用 WHERE + LIKE/LIMIT | `TRUNCATE TABLE` / 无 WHERE DELETE |
| 6 | **cleanupTestData 只删 TEST_PREFIX 数据** | API 测试用 `ilike(name, 'e2e-%')`；E2E 测试用 search prefix 查询后逐条归档 | 任何无前缀条件的批量删除 |

**审查清单（每次写测试 DML 时逐条检查）**：
- [ ] INSERT 的每条数据是否包含 `TEST_PREFIX` / `e2e-` 前缀？
- [ ] DELETE / UPDATE 是否有 `.where()` 且条件包含前缀匹配？
- [ ] PUT / PATCH 请求体中的 name 等唯一字段是否带前缀？
- [ ] 是否有 try-finally 包裹破坏性操作并做安全校验？
- [ ] 全量跑测试（`vitest run` 无文件过滤）时不会删除非 `e2e-` 开头的数据？

**违规后果**：用户人工创建的开发数据、演示数据在每次测试运行后被静默删除，且无法恢复。

### 步骤完成状态核查规则 **（必须遵守）**

**判断"某步骤是否已完成"时，必须用 Glob/ls 检查对应 `docs/` 子目录的实际文件，禁止仅凭记忆或推断下结论。**

不同步骤的产出物本质不同，不可混同：
- S2 PRD ≠ S3 交互设计 ≠ S4 技术方案 ≠ S1 领域模型
- "有技术文档"不代表"产品设计文档齐全"
- memory 中记录的是历史快照，不是实时状态——**永远以磁盘上的实际文件为准**


## 全局端口约定

**所有代码、配置、测试、文档中的端口引用必须使用以下约定值，禁止硬编码框架默认端口。**

| 服务 | 端口 | 配置来源 | 环境变量 |
|------|------|---------|---------|
| **API 后端** (Fastify) | **13180** | `packages/api/src/app.ts` | `API_PORT` |
| **Web 前端** (Vite) | **13181** | `packages/web/vite.config.ts` | — |
| **数据库** (PostgreSQL) | **5432** | `packages/api/src/db.ts` / `packages/api/drizzle/config.ts` | `DATABASE_URL` |

**规则**：
- 新增配置文件或测试脚本引用端口时，必须查阅本表，不得使用默认值（如 Vite 默认 5173、Fastify 默认 3000）
- E2E 测试的 `playwright.config.ts`（baseURL / webServer.port）和 `db-setup.ts` 等辅助文件中的端口必须与上表一致
- 如需修改端口，同步更新本表 + 对应配置源文件

### 多环境端口管理

> **详见 `environments/README.md`** — AI 工作流中的环境定义、切换和约束规则。

本表的端口值为 **dev1（日常开发）环境的默认值**。其他环境的端口定义见 `environments/*.json`：

| 环境 | Web | API | DB | 数据库 |
|------|-----|-----|-----|--------|
| `dev1`（默认） | **13181** | **13180** | **5432** | `apm_dev1` |
| `dev2`（隔离） | 13281 | 13280 | 5433 | `apm_dev2` |

### 环境优先铁律 **（必须遵守 — 违反将导致连接错误数据库）**

**核心原则：先指定环境，再启动服务。不允许任何隐式默认值绕过环境系统。**

**事故记录（2026-06-01）**：`db.ts` 和 `drizzle/config.ts` 中硬编码 fallback `apm_prototype` 数据库，`.env` 中也写死了 `DATABASE_URL=...apm_prototype`。当 AI 直接执行命令（不走 `restart-env.sh`）时，连接到不在环境定义中的 `apm_prototype` 数据库，导致数据混乱。现已移除所有隐式默认值。

| # | 规则 | 正确做法 | 错误做法（已修复） |
|---|------|---------|-------------------|
| 1 | **启动服务前必须激活环境** | `source environments/set-env.sh dev1` 或 `./environments/restart-env.sh dev1` | 直接 `pnpm dev`（DATABASE_URL 未设置 → 启动报错） |
| 2 | **DATABASE_URL 禁止硬编码或写死在 .env 中** | 由环境系统动态生成 | `.env` 中 `DATABASE_URL=...apm_prototype` |
| 3 | **代码中禁止 fallback 数据库连接串** | `DATABASE_URL` 未设置时抛错 | `process.env.DATABASE_URL ?? 'postgresql://...apm_prototype'` |
| 4 | **AI 执行任何需要数据库的命令前，必须先激活环境** | `source environments/set-env.sh` | 直接 `drizzle-kit push` / `vitest run` |

**环境激活方式**（二选一）：

| 方式 | 命令 | 适用场景 |
|------|------|---------|
| 轻量激活（仅 export 变量） | `source environments/set-env.sh [env]` | AI 执行单次命令、手动切换环境 |
| 完整重启（清理进程+启动服务） | `./environments/restart-env.sh <env>` | 人工日常开发 |

**AI 环境操作约束**：AI 只能读取 `environments/` 目录，不能修改环境 JSON 文件，不能启停任何服务。用户通过命令声明当前环境（如 "当前在 dev1"），AI 从环境文件获取连接参数后执行只读检查。AI 执行需要数据库的命令前，必须先 `source environments/set-env.sh` 激活环境。

## 技术架构决策

### 技术栈
- **B/S 架构**，Node.js 技术栈
- 原型产物格式：**HTML + CSS + JS**
- 数据库存储生成的 HTML 及关联的语义元数据

### 原型产物数据模型
采用 **视觉层与语义层分离** 的双轨制：

| 层 | 格式 | 职责 |
|---|---|---|
| 视觉层 | HTML + CSS | 页面布局、样式呈现 |
| 语义层 | JS（内聚引用） | 交互逻辑、数据绑定、业务规则、组件语义 |

- HTML 通过 `<script>` 标签引用语义层 JS 文件
- 两者在数据库中关联存储，导出时保持引用关系

### 项目导航架构（ProjectContext）

前端采用 **项目上下文驱动的导航架构**：

- 路由结构：`/p/:projectId/*` — 所有项目内页面以 `/p/:projectId` 为前缀
- `ProjectContext`（React Context）管理当前项目 ID 和项目名称，跨页面共享
- Sidebar 根据是否处于项目上下文动态切换菜单项（项目内菜单 vs 全局菜单）
- 项目上下文指示器：Sidebar 顶部显示当前项目名称 + 退出按钮
- 激活项目方式：Dashboard 卡片点击激活 → 自动跳转 `/p/:projectId`

## 远程仓库

- **GitHub**: https://github.com/kai-cui1/ai-prototype-manager

## 项目目录规范

```
ai-prototype-manager/
├── AGENTS.md                  # AI 编码助手项目指引（本文件）
├── docs/                      # 文档（持久化存储）
│   ├── 00-project/             # 项目元数据（Roadmap 等）
│   │   └── roadmap/           # 建设路线图（文件夹，主文件+各阶段明细）
│   │       ├── README.md      # 主路线图（整体视图、进度总览、版本历史）
│   │       ├── phase0.md      # Phase 0 设计规格冻结明细
│   │       ├── phase1.md      # Phase 1 数据模型中心 + MVP 明细
│   │       ├── phase2.md      # Phase 2 核心引擎 + 交互原型
│   │       ├── phase3.md      # Phase 3 成熟度提升
│   │       ├── phase4.md      # Phase 4 下游 Coding AI 集成
│   │       └── phase5.md      # Phase 5 AI 能力增强
│   ├── 01-design-idea/        # 产品设计构想与讨论记录、未详细讨论的 idea
│   │   ├── 01-design-idea.md  # 所有产品设计决策的单一来源
│   │   └── workflow.md        # 系统使用工作流（用户 A→F 六阶段构想）
│   ├── 02-domain-model/       # 领域模型设计产物（领域对象、对象属性、对象关系、关键状态图）
│   ├── 03-prd-ux/             # 产品需求规格
│   │   └── prd-convention.md  # **PRD 编写规范（模板 & 格式，写 PRD 前必读）**
│   │   └── modules/           # 各模块 PRD + 交互设计（按模块分文件夹）
│   │   │   ├── project-management/
│   │   │   │   ├── project-management-prd.md
│   │   │   │   └── project-management-interaction.md  # 交互设计文档（与 PRD 并列）
│   │   │   └── [模块名]/
│   │   │       ├── [模块名]-prd.md
│   │   │       └── [模块名]-interaction.md  # 交互设计文档
│   ├── 04-tech-design/        # 技术方案设计 + 编码规范 + 设计语言
│   │   ├── coding-convention.md    # **编码实施规范总纲（S6~S7 工作流，写代码前必读）**
│   │   ├── coding-convention-backend.md  # **后端编码细则**
│   │   ├── coding-convention-frontend.md # **前端编码细则**
│   │   ├── design-language.md       # **设计语言规范（全局视觉约束唯一权威来源，含品牌色/字体/间距/组件/图标/动效/Token架构）**
│   │   ├── validation-design.md
│   │   ├── object-lifecycle.md
│   │   ├── external-design-integration.md
│   │   ├── mcp-interface.md
│   │   └── phase1-design-tech.md  # Phase 1 技术方案（从 Spec 拆分）
│   ├── 05-data-design/        # 后端 DDL + 前端数据方案
│   │   └── phase1-database-schema.md  # Phase 1 数据库 19 张表定义（从 Spec 拆分）
│   ├── 06-test-design/        # 测试方案 + 测试用例（Phase 1 填充）
│   ├── 07-deploy-design/       # 部署方案 + 部署架构图（Phase 1 填充）
│   ├── 99-archived/           # 已归档的历史文件（原样保留）
│   │   ├── 2026-04-28-phase1-design.md  # Phase 1 Design Spec 原件
│   │   ├── design-token-system.md       # Design Token 体系（原 03-prd-ux/，2026-05-25 归档，内容已整合至 design-language.md）
│   │   ├── ui-design-spec.md            # 全局 UI 设计规范（原 03-prd-ux/，2026-05-25 归档，内容已整合至 design-language.md）
│   │   └── prototypes/        # HTML 高保真原型（原 03-prd-ux/prototypes/，2026-05-25 归档）
│   └── 20-analyze-report/     # 分析报告（过程性产出，不纳入 S0~S7 流程）
├── logs-important/            # 重要对话记录（按日期分文件）
│   └── YYYY-MM-DD-conversation.md
└── (Phase 1 起的代码目录，待初始化)
```

### 文档规范

**所有重要设计讨论必须实时记录到 `docs/` 目录下。**

规则：
- **产品设计决策** → `docs/01-design-idea/` 或对应编号文档
- **领域模型设计** → `docs/02-domain-model/`
- **产品 PRD（纯业务层）** → `docs/03-prd-ux/modules/[模块名]/`（按模块分文件夹，命名规则见下方）
- **交互设计** → `docs/03-prd-ux/modules/[模块名]/`（与 PRD 并列存放，命名 `[模块名]-interaction.md`）
- **技术方案设计** → `docs/04-tech-design/`
- **设计语言规范** → `docs/04-tech-design/design-language.md`（全局视觉约束唯一权威来源）
- **数据设计（DDL / 前端数据）** → `docs/05-data-design/`
- **测试设计** → `docs/06-test-design/`
- **部署设计** → `docs/07-deploy-design/`
- 不要只在对话中讨论而不落盘 —— 对话是临时的，文档是持久的
- 技术方案文档命名格式：`<topic>-design.md`（如 `validation-design.md`）

### 文档目录强制规范（必须遵守）

**所有设计产出必须放入 `docs/` 对应编号子目录，禁止在根目录或随意位置创建文档文件。**

**❌ 不要创建 `superpowers/`、`specs/` 等非标准目录 **

| 工作阶段 | 产出类型 | 必须放入 |
|---------|---------|---------|
| 产品思路/想法讨论 | 模糊方向、未详细讨论的 idea | `01-design-idea/` |
| 领域模型设计 | 领域对象、对象属性、对象关系（ER 图）、关键对象状态图 | `02-domain-model/` |
| 产品 PRD（纯业务层） | 业务流程（跨对象操作序列）、业务规则、功能结构、数据规格 | `03-prd-ux/`（`modules/` 放各模块 PRD） |
| 交互设计 | 人-系统交互规格 + AI-系统交互规格 | `03-prd-ux/modules/[模块名]/`（与 PRD 并列，命名 `[模块名]-interaction.md`） |
| 技术方案设计 | 选型、架构图、DB 规范、API 设计、组件交互序列图 | `04-tech-design/` |
| 数据设计（细粒度） | 后端 DDL、前端数据方案 | `05-data-design/` |
| 测试设计 | 测试方案、测试用例 | `06-test-design/` |
| 部署设计 | 部署架构图、环境配置 | `07-deploy-design/` |
| 项目元数据 | Roadmap、整体规划 | `00-project/roadmap/`（主 README + phase0~5 明细文件） |
| 归档 | 已被拆分/替代的历史版本 | `99-archived/` |

**违规示例（已发生并修正）**：
- Phase 1 Design Spec 曾放在 `docs/superpowers/specs/` 下 → 已拆分归位到 `04-tech-design/` + `05-data-design/` + `01-design-idea/` + 原件归档到 `99-archived/`
- Phase 0 设计文档曾散落在 `docs/` 根目录 → 已迁移到 `02-domain-model/` 和 `04-tech-design/`

### PRD & 交互设计文件组织规则

PRD 和交互设计文档按模块存放在 `docs/03-prd-ux/modules/` 下，每个模块一个独立文件夹：

| 层级 | 命名规则 | 示例 |
|------|---------|------|
| 模块文件夹 | kebab-case（英文小写+连字符） | `project-management/` |
| PRD 文件 | `[模块名]-prd.md` | `project-management-prd.md` |
| 交互设计文件 | `[模块名]-interaction.md` | `project-management-interaction.md` |

存放原则：
- **prd-convention.md**（格式规范）始终放在 `03-prd-ux/` 根目录
- **modules/** 放各模块的完整 PRD 文档 + 交互设计文档（并列存放）

### 对话归档规范

**判断对话重要的依据1**：判断用户提示词里是否包含【重要】标记
**判断对话重要的依据2**：判断用户提示词长度是否>30字，大于30字直接认为属于重要对话
**每次重要对话会话结束时，将完整对话内容保存到 `logs-important/` 目录。**

规则：
- 按日期分文件：`YYYY-MM-DD-conversation.md`
- 原封不动保存 PM 与 AI 的所有实质性对话内容（**含 AskUserQuestion 的选择性回复内容和用户 notes**）

## 当前阶段

**Phase 1：数据模型中心 + MVP（进行中）** — M1 模块 S0~S5 完成（PRD ✅ + 交互设计待补充 + 技术方案 ✅ + 测试用例 315 个 ✅），准备进入 S6 编码实施。
详细路线图见 `docs/00-project/roadmap/README.md`。
Phase 1 Design Spec 已拆分为：
- 数据库表定义 → `docs/05-data-design/phase1-database-schema.md`
- 技术方案设计 → `docs/04-tech-design/phase1-design-tech.md`
- 扩展想法 → `docs/01-design-idea/phase1-extension-ideas.md`
- 原件归档 → `docs/99-archived/2026-04-28-phase1-design.md`

### 已确定的技术栈

| 决策 | 选择 |
|------|------|
| 后端框架 | Fastify |
| 数据库 | PostgreSQL |
| ORM | Drizzle |
| 校验方案 | TypeBox + Ajv |
| 项目结构 | Monorepo (pnpm workspaces + Turborepo) |
| 前端 | React + Vite + TypeScript |
| 路由 | React Router v6（硬编码路由，菜单驱动 Sidebar + ProjectContext 导航） |
| UI 组件库 | shadcn/ui (Radix UI + Tailwind CSS) |
| 图形/画布库 | ReactFlow |