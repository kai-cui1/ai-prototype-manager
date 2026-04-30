# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
本系统要实现完整支持软件开发的工作流，参见文档：`docs/03-prd/workflow/workflow.md`

## 本项目工作规范 **必须遵守**

对话过程中，涉及软件功能的讨论和实现，**切记一定** 检查是否经过了以下步骤  

每个功能模块按以下 7 步推进，**框定范围 → 走完 7 步 → 再进入下一模块**：

| 步骤 | 名称 | 产出物 | 对应 `docs/` 目录 |
|------|------|--------|:-----------------:|
| **0** | 产品思路 & 想法 | 模糊方向、未被详细讨论的 idea | `01-design-idea/` |
| **1** | 领域模型 & 业务流程设计 | 实体关系、数据流、业务对象属性 | `02-domain-model/` |
| **2** | 产品 PRD 设计 | 功能结构、页面交互逻辑、业务规则；HTML 高保真原型 | `03-prd/` |
| **3** | 前后端详细技术方案 | 技术选型、架构图、DB 设计规范、API 规范、组件交互序列图、重点技术方案 | `04-tech-design/` |
| **4** | 测试用例设计 | 测试方案 + 用例集（编码前先写） | `06-test-design/` |
| **5** | 前后端代码实现 | 具体编程任务（接口/页面级颗粒度） | `packages/` (代码) |
| **6** | 单元测试 & 集成测试 | 测试代码 | `packages/` (代码) |
| **7** | 部署方案设计 | 部署架构图、环境配置 | `07-deploy-design/` |

另有 `05-data-design/` 存放后端 DDL 和前端数据方案细节（归入 Step 1 或 Step 3 的子产出）。


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



## 远程仓库

- **GitHub**: https://github.com/kai-cui1/ai-prototype-manager

## 项目目录规范

```
ai-prototype-manager/
├── CLAUDE.md                  # Claude Code 项目指引（本文件）
├── docs/                      # 文档（持久化存储）
│   ├── 00-project/             # 项目元数据（Roadmap 等）
│   │   └── roadmap.md         # 建设路线图与进度追踪
│   ├── 01-design-idea/        # 产品设计构想与讨论记录、未详细讨论的 idea
│   │   └── 01-design-idea.md  # 所有产品设计决策的单一来源
│   ├── 02-domain-model/       # 领域模型设计产物（实体、属性、关系、业务流程）
│   ├── 03-prd/                # 产品需求规格 + 交互原型
│   │   ├── workflow/          # 业务流程 / 工作流文档
│   │   │   └── workflow.md    # PM-AI 协作 A→F 六阶段工作流
│   │   └── prototypes/        # HTML 高保真交互原型（Phase 1 填充）
│   ├── 04-tech-design/        # 技术方案设计
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
│   │   └── 2026-04-28-phase1-design.md  # Phase 1 Design Spec 原件
│   └── 20-analyze-report/     # 分析报告（过程性产出，不纳入 07 步流程）
├── logs-important/            # 重要对话记录（按日期分文件）
│   └── YYYY-MM-DD-conversation.md
└── (Phase 1 起的代码目录，待初始化)
```

### 文档规范

**所有重要设计讨论必须实时记录到 `docs/` 目录下。**

规则：
- **产品设计决策** → `docs/01-design-idea/` 或对应编号文档
- **领域模型/业务流程设计** → `docs/02-domain-model/`
- **产品 PRD / 交互原型** → `docs/03-prd/`（workflow/ 放工作流，prototypes/ 放 HTML 原型）
- **技术方案设计** → `docs/04-tech-design/`
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
| 领域模型/业务流程设计 | 实体关系、数据流、对象属性 | `02-domain-model/` | 
| 产品 PRD / 交互原型 | 功能规格、页面交互逻辑、HTML 原型 | `03-prd/`（含 `workflow/` 和 `prototypes/` 子目录） | 
| 技术方案设计 | 选型、架构图、DB 规范、API 设计、组件交互序列图 | `04-tech-design/` | 
| 数据设计（细粒度） | 后端 DDL、前端数据方案 | `05-data-design/` | 
| 测试设计 | 测试方案、测试用例 | `06-test-design/` | 
| 部署设计 | 部署架构图、环境配置 | `07-deploy-design/` | 
| 项目元数据 | Roadmap、整体规划 | `00-project/` | 
| 归档 | 已被拆分/替代的历史版本 | `99-archived/` | 

**违规示例（已发生并修正）**：
- Phase 1 Design Spec 曾放在 `docs/superpowers/specs/` 下 → 已拆分归位到 `04-tech-design/` + `05-data-design/` + `01-design-idea/` + 原件归档到 `99-archived/`
- Phase 0 设计文档曾散落在 `docs/` 根目录 → 已迁移到 `02-domain-model/` 和 `04-tech-design/`

### 对话归档规范

**判断对话重要的依据1**：判断用户提示词里是否包含【重要】标记
**判断对话重要的依据2**：判断用户提示词长度是否>30字，大于30字直接认为属于重要对话
**每次重要对话会话结束时，将完整对话内容保存到 `logs-important/` 目录。**

规则：
- 按日期分文件：`YYYY-MM-DD-conversation.md`
- 原封不动保存 PM 与 AI 的所有实质性对话内容（**含 AskUserQuestion 的选择性回复内容和用户 notes**）
- 从 Claude Code 会话 JSONL 日志中自动提取生成

## 当前阶段

**Phase 1：架构冻结 + MVP（规划中）** — Phase 0 设计规格 100% 完成，进入技术方案设计与实现规划。
详细路线图见 `docs/00-project/roadmap.md`。
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
| 路由 | React Router v6（硬编码路由，菜单驱动 Sidebar） |
| UI 组件库 | shadcn/ui (Radix UI + Tailwind CSS) |
| 图形/画布库 | ReactFlow |
