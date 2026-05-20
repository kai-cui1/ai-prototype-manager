# Phase 1：数据模型中心 + MVP

> 目标：按模块走完 SDLC 全流程，实现核心数据模块的可运行 CRUD + 基础 UI
>
> **重要约束**：MVP 阶段不考虑 MCP/AI 相关功能。所有 AI/MCP 功能延后至 Phase 4/5。
>
> **范围聚焦**：Phase 1 只做**数据管理**（项目管理 / 领域模型 / 业务流程 / 业务架构），不做组件库 / HTML 渲染引擎 / 交互原型预览。

← [返回主路线图](./README.md)

---

## SDLC 步骤定义

| 步骤 | 名称 | 产出物 |
|:----:|------|--------|
| S0 | 产品思路 & 想法 | `01-design-idea/` |
| S1 | 领域模型 & 业务流程设计 | `02-domain-model/` |
| S2 | PRD 设计 | `03-prd-ux/modules/` |
| **S3** | **高保真原型设计** | **`03-prd-ux/prototypes/`** |
| S4 | 技术方案设计 | `04-tech-design/` + `05-data-design/` |
| S5 | 测试用例设计 | `06-test-design/` |
| S6 | 代码实现 | `packages/` |
| S7 | 测试代码编写 | `packages/api/tests/` + `packages/e2e/tests/` |
| **S8** | **测试验证执行** | **Dev-Test Loop 全绿闭环** |

> **状态图例**：✅ 完成 | 🔶 进行中 | ⏳ 待开始 | ⏸ 暂挂

---

## §1 工程基础设施（一次性，不随功能重复）

> 项目级一次性投入，Phase 0 已全部完成。后续新模块直接复用。

| # | 任务 | 状态 | 产出物 |
|---|------|:----:|--------|
| 1.A.1 | Monorepo 工程初始化（pnpm workspaces + Turborepo） | ✅ | `packages/{api,web,shared,validation-schemas,e2e}/` |
| 1.A.2 | 后端骨架（Fastify + Drizzle ORM + DB 连接） | ✅ | `packages/api/src/{app.ts,db.ts,models/}` (~240 行) |
| 1.A.3 | 前端骨架（React + Vite + Router v6 + shadcn/ui） | ✅ | `packages/web/src/{App.tsx,Layout.tsx}` (~280 行) |
| 1.A.4 | 共享 TypeScript 类型定义（7 个领域类型） | ✅ | `packages/shared/src/types/` (~242 行) |
| 1.A.5 | TypeBox 校验 Schema（project + organization） | ✅ | `packages/validation-schemas/src/` (~25+ 行) |
| 1.A.6 | E2E 测试框架（Playwright + prototype-helpers） | ✅ | `packages/e2e/` (config + helpers) |
| 1.A.7 | 数据库 Schema 设计文档（19 张表 DDL） | ✅ | `docs/05-data-design/phase1-database-schema.md` (568 行) |
| 1.A.8 | 技术方案设计文档（API 91 端点 / 校验 / 错误处理） | ✅ | `docs/04-tech-design/phase1-design-tech.md` (636 行) |
| 1.A.9 | PRD 编写规范（v1.0 + Step 2.5 一致性审查） | ✅ | `docs/03-prd-ux/prd-convention.md` (544 行) |
| 1.A.10 | 编码实施规范 v1.1（总纲 + 五维 Review） | ✅ | `docs/04-tech-design/coding-convention.md` (~420 行) |
| 1.A.11 | 后端编码细则 v1.1 | ✅ | `coding-convention-backend.md` (~1127 行) |
| 1.A.12 | 前端编码细则 v1.1 | ✅ | `coding-convention-frontend.md` (~1200 行) |
| 1.A.13 | Design Token 体系（10 大类 token + 5 组件对齐） | ✅ | `design-token-system.md` + `design-tokens.ts` |
| 1.A.14 | 多环境部署架构设计（Docker Compose, 仅文档） | ✅ | `docs/07-deploy-design/multi-env-deploy.md` (~500 行) |
| 1.A.15 | OpenAPI 完整契约体系（Swagger + Scalar UI） | ✅ | `@fastify/swagger` + `@scalar/fastify-api-reference` + 29 端点 schema + 7 测试 (2026-05-14) |

---

## §2 M1 项目管理 — 功能进展总览

> **API 端点组**：`projects.ts`（6 端点）+ `organization.ts`（21 端点）= **27 个**

### 进度主表（功能 × SDLC 阶段）

| 功能编号 | 名称 | P | S0 | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | 备注 |
|----------|------|:-:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|------|
| **F-M1-01** | 项目列表（搜索/分页/排序） | P0 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | API 21 TC + E2E 7/7 |
| **F-M1-02** | 创建项目（对话框/name 校验/唯一性） | P0 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | API 20 TC + E2E 2/2 全绿 |
| F-M1-02-01 | CreateProjectDialog 高保真还原 | | ✅ | ✅ | ✅ | 🔶 | ✅ | ✅ | ✅ | ✅ | 🔶 | 文案 9 + 样式 12 + hover |
| **F-M1-03** | 查看项目详情（并行请求/模块卡片） | P0 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | API 10 TC + E2E 11/11 全绿 (2026-05-14) |
| **F-M1-04** | 编辑项目基本信息（行内编辑/乐观锁） | P0 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | API 18 TC + E2E 11/11 全绿 (2026-05-15) |
| **F-M1-05** | 归档/恢复项目（AlertDialog/列表联动） | P0 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | API 16 TC + E2E 8/8 全绿 (2026-05-15) |
| **F-M1-06** | 公司管理（CRUD/级联删除/解绑角色） | P0 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔶 | ⏳ | ⏳ | 原型弹窗完成(新建/编辑/删除)，S6 进行中 |
| **F-M1-07** | 部门管理（多级树形/循环检测） | P0 | ✅ | ✅ | ✅ | 🔶 | ✅ | ✅ | ⏳ | ⏳ | ⏳ | 有扁平列表，缺树形+CRUD Dialog |
| **F-M1-08** | 角色管理（独立 Tab/全局唯一） | P0 | ✅ | ✅ | ✅ | 🔶 | ✅ | ✅ | ⏳ | ⏳ | ⏳ | Badge 展示，缺独立管理UI+CRUD Dialog |
| **F-M1-09** | 外部实体管理（CRUD/type 枚举） | P1 | ✅ | ✅ | ✅ | ⏳ | ✅ | ✅ | ⏳ | ⏳ | ⏳ | |
| **F-M1-10** | 项目摘要统计（列表内嵌/缓存策略） | P1 | ✅ | ✅ | ✅ | ⏸ | ✅ | ✅ | ⏸ | ⏸ | ⏸ | 暂挂 |

### 完成率汇总

| 维度 | 总数 | ✅ | 🔶 | ⏳ | ⏸ | 完成率 |
|------|:----:|:--:|:--:|:--:|:--:|:------:|
| 功能点（顶层） | 10 | 5 | 0 | 4 | 1 | **50%** |
| 含子功能展开 | 14 | 5 | 1 | 7 | 1 | **36%** |

### 模块依赖

```
M1 项目管理（当前实施）
  ├─ F-M1-01 ✅         ├─ F-M1-02 ✅         ├─ F-M1-03 ✅
  │                     ├─ F-M1-04 ✅         ├─ F-M1-05 ✅
  │                     ├─ F-M1-06 🔶(S6进行中)├─ F-M1-07~08 🔶(S3部分)
  └─ F-M1-09 ⏳         └─ F-M1-10 ⏸
M2 领域模型 ⏳ → M3 业务流程 ⏳ → M4 业务架构 ⏳
菜单管理 ⏳（可并入 M1）
```

---

## §3 后续模块预览

> M2~M5 的 S0~S1 在 Phase 0 已完成，S2 待 M1 收尾后启动。

| 模块 | 定位 | API | S0 | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | 备注 |
|------|------|:---:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:------|
| **M2** 领域模型 | 核心业务实体（字段/关系/ER） | 18 | ✅ | ✅ | ⏳ | ⏳ | ✅ | ✅ | ⏳ | ⏳ | ⏳ | 依赖 M1 |
| **M3** 业务流程 | 流程建模（节点池/边/决策/子流程） | 22 | ✅ | ✅ | ⏳ | ⏳ | ✅ | ✅ | ⏳ | ⏳ | ⏳ | 依赖 M2 |
| **M4** 业务架构 | L1-L4 架构树 + 架构→流程映射 | 11 | ✅ | ✅ | ⏳ | ⏳ | ✅ | ✅ | ⏳ | ⏳ | ⏳ | 依赖 M3 |
| **菜单** 导航菜单 | Sidebar 菜单 CRUD（轻量配置） | ~6 | ✅ | ✅ | ⏳ | ⏳ | ✅ | ✅ | ⏳ | ⏳ | ⏳ | 可并入 M1 |

---

## §4 资产附录（截至 2026-05-20）

### 代码资产

| 类别 | 文件数 | 行数 | 说明 |
|------|:-----:|:----:|------|
| API Routes / Services | 8 | 1,927 | routes(606) + services(1321) + OpenAPI schema(29 端点) |
| Web Pages / 组件 | 10 | 1,596 | pages(361) + project components(1235) |
| UI 组件（已 token 化） | 5 | — | button/input/dialog/label/textarea |
| Design Token 基础设施 | 3 | — | design-tokens.ts + index.css + tailwind.config.js |
| **合计** | **~26** | **~3,500+** | |

### 测试资产

| 类别 | 文件数 | 用例数 | 通过率 |
|------|:-----:|:-----:|:-----:|
| API 测试 | 6 | 92 | 100%（F-M1-01: 22 + F-M1-02: 20 + F-M1-03: 10 + F-M1-04: 18 + OpenAPI: 7） |
| E2E 测试 | 6 | 42 | 100%（smoke 3 + M1-01: 7 + M1-02: 2 + M1-03: 11 + M1-04: 11） |
| OpenAPI 测试 | 1 | 7 | 100%（spec 结构/端点覆盖/response 完整性/Scalar UI） |
| 测试设计文档 | 10 | 315 TC | 全部 10 功能点已设计 |

### 设计文档

| 文件 | 行数 | 内容 |
|------|:----:|------|
| `phase1-design-tech.md` | 636 | API 规范 / 校验 / 错误处理 / 91 端点 |
| `phase1-database-schema.md` | 568 | 19 张表 DDL + 设计规范 |
| `design-token-system.md` | 282 | Design Token 规格（D-SPEC-001） |
| `multi-env-deploy.md` | ~500 | Docker Compose 多环境部署架构 |
| `project-management-prd.md` (+ prd-2.md) | ~2,342 | M1 PRD 全部章节 |

← [返回主路线图](./README.md)
