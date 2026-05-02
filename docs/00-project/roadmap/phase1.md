# Phase 1：数据模型中心 + MVP 骨架

> 目标：按模块走完 SDLC 全流程，实现核心数据模块的可运行 CRUD + 基础 UI
>
> **重要约束**：MVP 阶段不考虑 MCP/AI 相关功能。所有 AI/MCP 功能延后至 Phase 4/5。
>
> **范围聚焦**：Phase 1 只做**数据管理**（项目管理 / 领域模型 / 业务流程 / 业务架构），不做组件库 / HTML 渲染引擎 / 交互原型预览。

← [返回主路线图](./README.md)

---

## 1-A：基础设施（已完成 ✅）

> 公共基础层，不隶属于任何具体模块。一次性搭建，所有模块共用。

| # | 任务 | 状态 | 产出物 |
|---|------|------|--------|
| 1.A.1 | Monorepo 工程初始化（pnpm workspaces + Turborepo + 5 子包） | ✅ 完成 | packages/{api,web,shared,validation-schemas,e2e}/ |
| 1.A.2 | 后端骨架（Fastify 4.x + Drizzle ORM + 数据库连接） | ✅ 完成 | packages/api/src/{app.ts,db.ts,models/} (~240 行) |
| 1.A.3 | 前端骨架（React + Vite + React Router v6 + shadcn/ui + Layout） | ✅ 完成 | packages/web/src/{App.tsx,components/Layout.tsx} (~280 行) |
| 1.A.4 | 共享 TypeScript 类型定义（7 个领域类型文件） | ✅ 完成 | packages/shared/src/types/ (~242 行) |
| 1.A.5 | TypeBox 校验 Schema 雏形（project.schema.ts） | ✅ 初版 | packages/validation-schemas/src/ (25 行) |
| 1.A.6 | E2E 测试框架（Playwright + 3 个冒烟用例） | ✅ 就绪 | packages/e2e/ (config + smoke.spec.ts) |
| 1.A.7 | 数据库 Schema 设计文档（19 张表 DDL） | ✅ 已审核 | docs/05-data-design/phase1-database-schema.md (568 行) |
| 1.A.8 | 技术方案设计文档（API 规范 / 校验 / 错误处理 / 测试策略） | ✅ 已审核 | docs/04-tech-design/phase1-design-tech.md (636 行) |
| 1.A.9 | PRD 编写规范（v1.0, 6 章模板 + 逐节确认流程） | ✅ 定稿 | docs/03-prd/prd-convention.md (544 行) |

---

## 1-B：M1 项目管理模块 🔄 进行中

> 模块定位：系统的顶级容器和基础组织架构管理（项目 CRUD + 公司/部门/角色/外部实体）
>
> **API 端点组**：`projects.ts`（6 端点）+ `organization.ts`（21 端点）= **27 个**

### SDLC 进度矩阵

| SDLC 步骤 | 名称 | 状态 | 产出物 | 行数 |
|-----------|------|:----:|--------|:----:|
| Step 0 | 产品思路 & 想法 | ✅ 完成 | docs/01-design-idea/ | — |
| Step 1 | 领域模型设计 | ✅ 完成 | docs/02-domain-model/ (5 文件) | — |
| Step 2 | PRD 设计 | 🔄 **进行中** | project-management-prd.md + prd-2.md | 2220 |
| Step 3 | 技术方案 | ✅ 提前完成 | phase1-design-tech.md + database-schema.md | 1204 |
| Step 4 | 测试用例设计 | ⏳ 待开始 | docs/06-test-design/ | — |
| Step 5 | 代码实现 | ⏳ 待开始 | packages/api/routes/ + packages/web/pages/ | — |
| Step 6 | 测试代码 | ⏳ 待开始 | packages/**/*.test.ts | — |
| Step 7 | 部署方案 | ⏳ 待开始 | docs/07-deploy-design/ | — |

### PRD 详细进度

| 章节 | 内容 | 状态 |
|------|------|:----:|
| §1 概述（定位/角色/前置依赖/参考输入） | ~60 行 | ✅ 审核 |
| §2 业务流程（Happy Path / 异常分支 / 页面交互, 8 张 Mermaid 图） | ~180 行 | ✅ 审核 |
| §3 功能范围总览（10 功能点 / 8 项 Out of Scope / 5 术语） | ~80 行 | ✅ 审核 |
| §4.1 F-M1-01 项目列表（样例, CRUD 全维度规则） | ~130 行 | ✅ 审核 |
| §4.2 F-M1-02 创建项目 | ~80 行 | ✅ 审核 |
| §4.3 F-M1-03 查看项目详情 | ~130 行 | ✅ 审核 |
| §4.4 F-M1-04 编辑项目基本信息 | ~130 行 | ✅ 审核 |
| §4.5 F-M1-05 归档/恢复项目 | ~120 行 | ⏳ 待审核 |
| §4.6 F-M1-06 公司管理 | ~200 行 | ⏳ 待审核 |
| §4.7 F-M1-07 部门管理 | ~170 行 | ⏳ 待审核 |
| §4.8 F-M1-08 角色管理 | ~180 行 | ⏳ 待审核 |
| §4.9 F-M1-09 外部实体管理（P1） | ~130 行 | ⏳ 待审核 |
| §4.10 F-M1-10 项目摘要统计（P1） | ~80 行 | ⏳ 待审核 |
| §5 跨功能规则（状态机/校验/交互/权限） | ~120 行 | ⏳ 待审核 |
| §6 验收标准（功能 24 项 + 异常 6 项 + UI/UX 8 项） | ~100 行 | ⏳ 待审核 |

### 功能点清单（10 项）

| # | 功能点 | 优先级 | SDLC 进度 |
|---|--------|:------:|:---------:|
| F-M1-01 | 项目列表（搜索/分页/排序/摘要内嵌） | P0 | Step 2 ✅ → Step 5~7 ⏳ |
| F-M1-02 | 创建项目（对话框表单 / name 校验 / 唯一性） | P0 | Step 2 ✅ → Step 5~7 ⏳ |
| F-M1-03 | 查看项目详情（并行请求 / 模块卡片 / 归档 UI 差异） | P0 | Step 2 ✅ → Step 5~7 ⏳ |
| F-M1-04 | 编辑项目基本信息（行内编辑 / 乐观锁 / 快照还原） | P0 | Step 2 ✅ → Step 5~7 ⏳ |
| F-M1-05 | 归档 / 恢复项目（标记操作 / AlertDialog / 列表联动） | P0 | Step 2 🔄 → Step 5~7 ⏳ |
| F-M1-06 | 公司管理（CRUD / 三级导航第一级 / 级联删除） | P0 | Step 2 🔄 → Step 5~7 ⏳ |
| F-M1-07 | 部门管理（CRUD / 第二级 / company_id 范围唯一性） | P0 | Step 2 🔄 → Step 5~7 ⏳ |
| F-M1-08 | 角色管理（CRUD / 第三级叶子节点 / dept_id 范围唯一性） | P0 | Step 2 🔄 → Step 5~7 ⏳ |
| F-M1-09 | 外部实体管理（CRUD / type 枚举 / 直接隶属项目） | P1 | Step 2 🔄 → Step 5~7 ⏳ |
| F-M1-10 | 项目摘要统计（列表内嵌 / 详情 API / 缓存策略） | P1 | Step 2 🔄 → Step 5~7 ⏳ |

---

## 1-C：M2 领域模型模块 ⏳ 待开始

> 模块定位：被建模产品的核心业务实体管理（领域实体定义 / 字段 / 关系 / 数据流 / ER 图）
>
> **API 端点组**：`domain.ts`（实体 7 + 字段 6 + 关系 5 = **18 个**）

| SDLC 步骤 | 状态 | 说明 |
|-----------|:----:|------|
| Step 0~1 | ✅ 完成 | Phase 0 已覆盖（domain-model.md + 语义层 Schema） |
| Step 2 (PRD) | ⏳ 待开始 | 依赖 M1 Step 2 完成（Project 是领域实体的容器） |
| Step 3 (技术方案) | ⏳ 待开始 | 可复用 1.A.7/1.A.8 的通用部分 |
| Step 4~7 | ⏳ 待开始 | — |

---

## 1-D：M3 业务流程模块 ⏳ 待开始

> 模块定位：业务流程建模（流程定义 / 全局节点池 / 边 / 决策 / 子流程嵌套）
>
> **API 端点组**：`process.ts`（流程 7 + 节点 6 + 边 5 + 流程-节点关联 4 = **22 个**）

| SDLC 步骤 | 状态 | 说明 |
|-----------|:----:|------|
| Step 0~1 | ✅ 完成 | Phase 0 已覆盖（business-process.md 1476 行, 48 项决策） |
| Step 2 (PRD) | ⏳ 待开始 | 依赖 M2 Step 2（流程引用领域实体） |
| Step 3 (技术方案) | ⏳ 待开始 | — |
| Step 4~7 | ⏳ 待开始 | — |

---

## 1-E：M4 业务架构模块 ⏳ 待开始

> 模块定位：业务架构树管理（L1-L4 层级架构节点 + 架构→流程映射关系）
>
> 业务架构是项目的**功能分解结构**（如「交易系统 → 订单子系统 → 支付模块 → 退款流程」），将业务流程挂载到架构节点下。
>
> **API 端点组**：`architecture.ts`（架构节点 6 + 流程映射 5 = **11 个**）

| SDLC 步骤 | 状态 | 说明 |
|-----------|:----:|------|
| Step 0~1 | ✅ 完成 | Phase 0 已覆盖（domain-model.md 含架构相关实体定义） |
| Step 2 (PRD) | ⏳ 待开始 | 依赖 M3 Step 2（架构节点映射到业务流程） |
| Step 3 (技术方案) | ⏳ 待开始 | 可复用 1.A.7/1.A.8 的通用部分 |
| Step 4~7 | ⏳ 待开始 | — |

### API 端点清单

**架构节点 CRUD（6 个）：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/business-architectures` | 架构节点列表（扁平，含 parent_id） |
| POST | `/api/v1/projects/:projectId/business-architectures` | 创建架构节点 |
| GET | `/api/v1/projects/:projectId/business-architectures/:archId` | 节点详情（含子节点 + 关联流程） |
| PUT | `/api/v1/projects/:projectId/business-architectures/:archId` | 更新架构节点 |
| DELETE | `/api/v1/projects/:projectId/business-architectures/:archId` | 删除（级联子节点+映射关系） |
| GET | `/api/v1/projects/:projectId/business-architectures/tree` | 完整树形结构（递归嵌套 JSON） |

**架构→流程映射（5 个）：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `.../:archId/processes` | 某架构节点关联的流程列表 |
| POST | `.../:archId/processes` | 将流程挂载到架构节点下 |
| DELETE | `.../:archId/processes/:processId` | 从架构节点下移除流程 |
| PUT | `.../:archId/processes/reorder` | 调整流程排序 |
| GET | `/api/v1/projects/:projectId/processes/:processId/architectures` | 反查某流程归属的架构节点 |

---

## 1-F：菜单管理（轻量级系统配置）⏳ 待开始

> 模块定位：系统导航菜单的 CRUD 管理（驱动 Sidebar 渲染）
>
> **特殊定位**：菜单不属于业务数据建模范畴，而是**系统级配置**，全局唯一。Phase 1 采用硬编码路由 + 数据库菜单数据驱动渲染的混合模式。
>
> **API 端点组**：`menu.ts`（~6 个）

| SDLC 步骤 | 状态 | 说明 |
|-----------|:----:|------|
| Step 0~1 | ✅ 完成 | menus 表已在 DB Schema 中定义（phase1-database-schema.md 表 #16） |
| Step 2 (PRD) | ⏳ 待开始 | 范围较小，可与 M1 PRD 合并或独立为轻量 PRD |
| Step 3 (技术方案) | ✅ 提前完成 | phase1-design-tech.md 已含 menu 路由/服务/页面定义 |
| Step 4~7 | ⏳ 待开始 | — |

> **实施建议**：菜单管理的复杂度远低于 M1~M4。可考虑在 M1 编码阶段（Step 5）顺手实现，或作为 M1 的子任务处理，无需单独走完 7 步全流程。

---

## 模块依赖顺序

```
M1 项目管理（容器, 无前置模块依赖）
  └─→ M2 领域模型（实体隶属于项目）
       └─→ M3 业务流程（流程引用领域实体）
            └─→ M4 业务架构（架构节点映射到流程）

菜单管理（独立于业务数据，可并入 M1 实施）
```

---

## Phase 1 文档产出总览（截至 2026-05-02）

| 文件 | 行数 | 状态 | 内容摘要 |
|------|------|:----:|---------|
| `docs/04-tech-design/phase1-design-tech.md` | 636 | ✅ 已审核 | API 规范 / 校验 / 错误处理 / 测试策略 / 91 端点 |
| `docs/05-data-design/phase1-database-schema.md` | 568 | ✅ 已审核 | 19 张表完整 DDL + 设计规范 |
| `docs/03-prd/prd-convention.md` | 544 | ✅ v1.0 | PRD 编写规范（6 章模板 + 逐节确认流程） |
| `docs/03-prd/modules/project-management/project-management-prd.md` | 962 | 🔄 部分审核 | M1 PRD §1~§4.4（F-M1-01~04） |
| `docs/03-prd/modules/project-management/project-management-prd-2.md` | 1258 | ⏳ 待审核 | M1 PRD §4.5~§6（F-M1-05~10 + 跨功能规则 + 验收标准） |
| `packages/api/src/` | ~240 | ✅ 骨架 | Fastify app / db / models (4 表 schema + relations) |
| `packages/web/src/` | ~280 | ✅ 骨架 | App routing / Layout (193行) / pages (stubs) / api client |
| `packages/shared/src/types/` | ~242 | ✅ 初版 | 7 个领域类型文件 (project/domain/process/org/architecture/menu) |
| `packages/validation-schemas/src/` | 25 | ✅ 初版 | TypeBox project schema |
| `packages/e2e/` | ~31 | ✅ 就绪 | Playwright config + 3 smoke tests |

← [返回主路线图](./README.md)
