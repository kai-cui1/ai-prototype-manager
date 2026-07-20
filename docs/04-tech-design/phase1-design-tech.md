# Phase 1 技术方案设计

> **来源**：拆分自 `99-archived/2026-04-28-phase1-design.md`（原件归档保留）
> **对应原文件章节**：§1 目标与约束 / §2 技术栈 / §3 Monorepo 项目结构 / §5 RESTful API 设计 / §6 校验机制 / §7 错误处理 / §8 开发环境 / §9 Seed 数据 / §10 测试策略 / §11 交付物与验收 / §12 设计决策汇总
> **关联文档**：
> - 数据库表定义 → `../05-data-design/phase1-database-schema.md`
> - 扩展想法 → `../01-design-idea/phase1-extension-ideas.md`
> **日期**：2026-04-28（审核通过）
> **状态**：✅ 已审核

---

## 1. 目标与约束

### 1.1 目标

搭建项目基础架构，实现**数据模型层**的端到端可用 MVP。完成 Phase 1 后，PM 可以：

- 创建和管理项目
- 在项目中定义领域模型（实体、字段、关系）
- 在项目中设计业务流程（流程定义、节点池、边、子流程嵌套）
- 通过基础 UI 完成以上所有操作

### 1.2 核心约束

| 约束 | 说明 | 来源 |
|------|------|------|
| **不含 MCP/AI** | 所有 AI/MCP 相关功能延后至 Phase 4/5 | PM 原话 |
| **聚焦三大模块** | 项目管理 → 领域模型管理 → 业务流程管理，优先做这 3 个 | PM 原话 |
| **不做认证** | 纯本地单用户模式，零身份验证 | PM 决策 |
| **不做交互原型** | 应用/页面/组件/HTML 渲染全部移至 Phase 2 | 范围界定 |

### 1.3 不在范围内（移至后续 Phase）

| 功能 | 归属 Phase |
|------|-----------|
| 标准组件库实现 | Phase 2.7 |
| HTML 视觉层生成引擎 | Phase 2.10 |
| 页面 CRUD 与组件树操作 | Phase 2.8, 2.9 |
| 原型预览界面 | Phase 2.11 |
| 用户认证与授权 | Phase 3.12 |
| 完整性框架引擎 | Phase 2.1 |
| 对象生命周期系统 | Phase 2.2 |
| design_artifacts 设计稿导入 | 后续 Phase 再设计（PM 4/29 确认不急） |
| 工作台/Dashboard 页面 | Phase 1 去掉工作台菜单，后续再设计 |
| ER 图 ReactFlow 映射规格 | 属于系统模块详细设计方案（Spec 下一步） |
| field_type UI 子集枚举 | 同上，Phase 1 前端下拉框取值留实施时确定 |

---

## 2. 技术栈

### 2.1 已确定的技术选型

| 层 | 选择 | 版本要求 | 理由 |
|----|------|---------|------|
| 后端框架 | **Fastify** | 4.x+ | 高性能、插件生态好、TypeScript 深度集成 |
| 数据库 | **PostgreSQL** | 15+ | 关系型、JSONB 支持、复杂查询能力强 |
| ORM | **Drizzle ORM** | 0.30+ | 类型安全、SQL-like API、轻量、与 TypeBox 配合 |
| 校验 | **TypeBox + Ajv** | TypeBox 0.31+, Ajv 8.x | 一套定义三处复用：TS 类型 + 运行校验 + JSON Schema 输出 |
| 包管理 | **pnpm workspaces** | 8.x+ | Monorepo 原生支持、磁盘效率高 |
| 构建工具 | **Turborepo** | 2.x+ | 增量构建、任务编排、缓存 |
| 前端框架 | **React 18 + TypeScript** | React 18+, TS 5.x | 生态成熟、开发体验好 |
| 前端构建 | **Vite** | 5.x+ | 快速 HMR、原生 ESM |
| 路由 | **React Router v6** | latest | 前端路由硬编码，菜单数据驱动 Sidebar 渲染（不做动态路由注册） |
| UI 组件库 | **shadcn/ui** | latest | 基于 Radix UI + Tailwind CSS，代码完全可控，适合编辑器类产品的高度定制需求 |
| CSS 方案 | **Tailwind CSS** | 3.x+ | shadcn/ui 必需，原子化 CSS 快速迭代 |
| 图形/画布库 | **ReactFlow** | 12.x+ | 流程编辑器画布 + ER 图视图，与 React 深度集成、API 简洁 |

### 2.2 不在选型范围内的（后续决策）

- 状态管理方案 — Phase 1 数据量小，React state / useState 足够
- 测试框架细节 — Vitest 确定，E2E 工具 Phase 3 再选
- CI/CD 方案 — Phase 1 只需本地开发

---

## 3. Monorepo 项目结构

```
ai-prototype-manager/
├── packages/
│   ├── api/                        # 后端服务 (Fastify)
│   │   ├── src/
│   │   │   ├── routes/             # 路由层（按模块分文件）
│   │   │   │   ├── projects.ts     #   项目管理路由
│   │   │   │   ├── domain.ts       #   领域模型路由（实体/字段/关系）
│   │   │   │   ├── process.ts      #   业务流程路由（流程/节点/边）
│   │   │   │   ├── organization.ts #   组织架构路由（公司 + 部门 + 角色 + 外部实体）
│   │   │   │   ├── architecture.ts #   业务架构路由
│   │   │   │   └── menu.ts         #   系统菜单路由
│   │   │   ├── services/           # 业务逻辑层
│   │   │   │   ├── project.service.ts
│   │   │   │   ├── domain.service.ts
│   │   │   │   ├── process.service.ts
│   │   │   │   ├── organization.service.ts
│   │   │   │   ├── architecture.service.ts
│   │   │   │   └── menu.service.ts
│   │   │   ├── models/             # Drizzle ORM Schema 定义
│   │   │   │   ├── schema.ts       #   全部表定义
│   │   │   │   └── relations.ts    #   表关系定义
│   │   │   ├── db.ts               #   数据库连接实例
│   │   │   └── app.ts              #   Fastify 应用入口（注册插件/中间件/路由）
│   │   ├── drizzle/                # Drizzle 配置与迁移
│   │   │   ├── config.ts
│   │   │   └── migrations/         #   SQL 迁移文件（git 管理）
│   │   └── package.json
│   │
│   ├── web/                        # 前端应用 (React + Vite)
│   │   ├── src/
│   │   │   ├── pages/              # 页面级组件
│   │   │   │   ├── ProjectList.tsx     #   项目列表页
│   │   │   │   ├── ProjectDetail.tsx   #   项目详情页（含 Tab 切换）
│   │   │   │   ├── DomainModelEditor.tsx # 领域模型编辑器
│   │   │   │   ├── ProcessEditor.tsx    # 流程编辑器
│   │   │   │   ├── OrganizationPanel.tsx# 组织架构管理（公司 + 部门树 + 角色 + 外部实体）
│   │   │   │   ├── ArchitectureView.tsx # 业务架构树视图
│   │   │   │   └── MenuManagement.tsx   # 系统菜单管理页
│   │   │   ├── components/         # 通用 UI 组件
│   │   │   ├── hooks/              # 自定义 Hooks
│   │   │   ├── api/                # API 调用封装
│   │   │   │   └── client.ts        #   fetch 封装（统一错误处理）
│   │   │   ├── types/              # 前端专用类型
│   │   │   └── App.tsx
│   │   ├── index.html
│   │   └── package.json
│   │
│   ├── shared/                     # 共享类型和工具
│   │   ├── src/
│   │   │   ├── types/              # 共享 TypeScript 类型
│   │   │   │   ├── project.ts
│   │   │   │   ├── domain.ts
│   │   │   │   ├── process.ts
│   │   │   │   ├── organization.ts
│   │   │   │   ├── architecture.ts
│   │   │   │   ├── menu.ts
│   │   │   │   └── index.ts        #   统一导出
│   │   │   └── utils/              # 共享工具函数
│   │   │       └── index.ts
│   │   └── package.json
│   │
│   └── validation-schemas/          # TypeBox Schema 定义包
│       ├── src/
│       │   ├── index.ts            #   统一导出 + Ajv 实例配置
│       │   ├── base.ts             #   通用基础类型（ID、时间戳、分页等）
│       │   ├── project.schema.ts   #   项目相关 Schema
│       │   ├── domain.schema.ts    #   领域模型相关 Schema（实体/字段/关系）
│       │   ├── process.schema.ts   #   业务流程相关 Schema（流程/节点/边）
│       │   ├── organization.schema.ts#  组织架构 Schema（公司/部门/角色/外部实体）
│       │   ├── architecture.schema.ts# 业务架构 Schema
│       │   └── menu.schema.ts      #   系统菜单 Schema
│       └── package.json
│
├── workspace/
│   └── dev/                        # 开发环境（.gitignore，不推送远端）
│       ├── docker-compose.yml      # PostgreSQL 本地开发
│       └── .gitignore
│
├── turbo.json                      # Turborepo 配置
├── pnpm-workspace.yaml
├── package.json                    # Root package.json（workspace 协调）
├── .gitignore                      # 含 workspace/ 和 dist/
├── CLAUDE.md
├── README.md
└── docs/                           # 文档（已有内容不变）
```

### 3.1 包依赖关系

```
shared ◄──── api          (api 引用 shared 的类型)
shared ◄──── web           (web 引用 shared 的类型)
validation-schemas ◄─ api  (api 引用 Schema 进行校验)
validation-schemas ◄─ shared (可选: shared 可引用 Schema 推导类型)
api 和 web 无直接依赖       (通过 API 通信，不共享代码运行时)
```

---

## 5. RESTful API 设计

### 5.1 URL 规范

- 基础路径：`/api/v1`
- 资源嵌套于项目下：`/api/v1/projects/:projectId/...`
- 复数名词：`entities`, `fields`, `relations`, `processes`, `nodes`, `edges`
- 使用 kebab-case 路径参数名

### 5.2 统一响应格式

```typescript
// 成功（单个资源）
{ "data": { ... } }

// 成功（列表）
{ "data": [...], "meta": { "total": 100, "page": 1, "pageSize": 20 } }

// 错误
{ "error": { code: "NOT_FOUND", message: "...", "details"?: ..., "requestId": "..." } }
```

### 5.3 分页规范

查询参数：`?page=1&pageSize=20&sort=name&order=asc`

### 5.4 端点清单

#### 项目管理（6 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects` | 项目列表（分页 + name 模糊搜索 + status 筛选） |
| POST | `/api/v1/projects` | 创建项目 |
| GET | `/api/v1/projects/:id` | 项目详情 |
| PUT | `/api/v1/projects/:id` | 更新项目基本信息 |
| DELETE | `/api/v1/projects/:id` | 软删除项目（status→archived） |
| GET | `/api/v1/projects/:id/summary` | 项目摘要（各模块统计数） |

#### 领域模型·实体（7 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/domain/entities` | 实体列表 |
| POST | `/api/v1/projects/:projectId/domain/entities` | 创建实体 |
| GET | `/api/v1/projects/:projectId/domain/entities/:entityId` | 实体详情（含字段+关系） |
| PUT | `/api/v1/projects/:projectId/domain/entities/:entityId` | 更新实体 |
| DELETE | `/api/v1/projects/:projectId/domain/entities/:entityId` | 删除实体（级联删除字段和关系） |
| GET | `/api/v1/projects/:projectId/domain/entities/:entityId/er-graph` | 以此实体为中心的 ER 图数据 |

#### 领域模型·字段（6 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/domain/entities/:entityId/fields` | 字段列表 |
| POST | `/api/v1/projects/:projectId/domain/entities/:entityId/fields` | 创建字段 |
| GET | `/api/v1/projects/:projectId/domain/entities/:entityId/fields/:fieldId` | 字段详情 |
| PUT | `/api/v1/projects/:projectId/domain/entities/:entityId/fields/:fieldId` | 更新字段 |
| DELETE | `/api/v1/projects/:projectId/domain/entities/:entityId/fields/:fieldId` | 删除字段 |
| PATCH | `/api/v1/projects/:projectId/domain/entities/:entityId/fields/reorder` | 批量调整字段排序 |

#### 领域模型·关系（5 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/domain/relations` | 关系列表 |
| POST | `/api/v1/projects/:projectId/domain/relations` | 创建关系 |
| PUT | `/api/v1/projects/:projectId/domain/relations/:relationId` | 更新关系 |
| DELETE | `/api/v1/projects/:projectId/domain/relations/:relationId` | 删除关系 |
| GET | `/api/v1/projects/:projectId/domain/relations/graph` | 完整 ER 图数据（全量节点+边） |

#### 业务流程·流程（7 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/processes` | 流程列表 |
| POST | `/api/v1/projects/:projectId/processes` | 创建流程 |
| GET | `/api/v1/projects/:projectId/processes/:processId` | 流程详情（含节点+边） |
| PUT | `/api/v1/projects/:projectId/processes/:processId` | 更新流程 |
| DELETE | `/api/v1/projects/:projectId/processes/:processId` | 删除流程（清理关联） |
| POST | `/api/v1/projects/:projectId/processes/:processId/nodes/batch` | 批量添加节点到流程 |
| POST | `/api/v1/projects/:projectId/processes/:processId/sub-processes` | 添加子流程引用 |

#### 业务流程·节点（6 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/process-nodes` | 节点列表（全局池） |
| POST | `/api/v1/projects/:projectId/process-nodes` | 创建节点 |
| GET | `/api/v1/projects/:projectId/process-nodes/:nodeId` | 节点详情 |
| PUT | `/api/v1/projects/:projectId/process-nodes/:nodeId` | 更新节点 |
| DELETE | `/api/v1/projects/:projectId/process-nodes/:nodeId` | 删除节点（清理关联的边和流程映射） |
| GET | `/api/v1/projects/:projectId/process-nodes/:nodeId/usages` | 节点使用情况（哪些流程引用了它） |

#### 业务流程·边（5 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/process-edges` | 边列表（全局池） |
| POST | `/api/v1/projects/:projectId/process-edges` | 创建边 |
| PUT | `/api/v1/projects/:projectId/process-edges/:edgeId` | 更新边 |
| DELETE | `/api/v1/projects/:projectId/process-edges/:edgeId` | 删除边 |
| GET | `/api/v1/projects/:projectId/process-edges/by-node/:nodeId` | 查询某节点的入边+出边 |

#### 流程-节点关联（4 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/processes/:processId/nodes` | 流程包含的节点列表（含 sort_order） |
| PUT | `/api/v1/projects/:projectId/processes/:processId/nodes` | 更新流程-节点关联（重设整个节点集+排序） |
| DELETE | `/api/v1/projects/:projectId/processes/:processId/nodes/:nodeId` | 从流程中移除某节点 |
| PUT | `/api/v1/projects/:projectId/processes/:processId/entry-node` | 设置流程入口节点 |

#### 组织架构·公司（5 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/companies` | 公司列表 |
| POST | `/api/v1/projects/:projectId/companies` | 创建公司 |
| GET | `/api/v1/projects/:projectId/companies/:companyId` | 公司详情（含部门列表） |
| PUT | `/api/v1/projects/:projectId/companies/:companyId` | 更新公司 |
| DELETE | `/api/v1/projects/:projectId/companies/:companyId` | 删除公司（级联删除部门→角色） |

#### 组织架构·部门（6 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/departments` | 部门列表（扁平，含 parent_id 可前端组装树） |
| POST | `/api/v1/projects/:projectId/departments` | 创建部门 |
| GET | `/api/v1/projects/:projectId/departments/:deptId` | 部门详情（含子部门 + 角色列表） |
| PUT | `/api/v1/projects/:projectId/departments/:deptId` | 更新部门 |
| DELETE | `/api/v1/projects/:projectId/departments/:deptId` | 删除部门（级联删除角色） |
| GET | `/api/v1/projects/:projectId/departments/tree` | 完整部门树形结构（服务端递归返回嵌套 JSON） |

#### 参与者·角色（5 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/roles` | 角色列表 |
| POST | `/api/v1/projects/:projectId/roles` | 创建角色（需指定 department_id） |
| GET | `/api/v1/projects/:projectId/roles/:roleId` | 角色详情 |
| PUT | `/api/v1/projects/:projectId/roles/:roleId` | 更新角色 |
| DELETE | `/api/v1/projects/:projectId/roles/:roleId` | 删除角色（清理节点 holder 引用） |

#### 参与者·外部实体（5 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/external-entities` | 外部实体列表 |
| POST | `/api/v1/projects/:projectId/external-entities` | 创建外部实体 |
| GET | `/api/v1/projects/:projectId/external-entities/:entityId` | 外部实体详情 |
| PUT | `/api/v1/projects/:projectId/external-entities/:entityId` | 更新外部实体 |
| DELETE | `/api/v1/projects/:projectId/external-entities/:entityId` | 删除外部实体（清理节点 holder 引用） |

#### 业务架构·节点（6 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/architectures` | 获取项目下所有架构节点（扁平列表 + 每节点关联流程） |
| POST | `/api/v1/projects/:projectId/architectures` | 创建架构节点 |
| GET | `/api/v1/projects/:projectId/architectures/:archId` | 单个架构节点详情（含关联流程） |
| PATCH | `/api/v1/projects/:projectId/architectures/:archId` | 更新架构节点（部分更新） |
| DELETE | `/api/v1/projects/:projectId/architectures/:archId` | 删除架构节点（有子节点时返回 409） |

#### 业务架构·流程映射（3 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/projects/:projectId/architectures/:archId/processes` | 关联流程到架构节点 |
| DELETE | `/api/v1/projects/:projectId/architectures/:archId/processes/:processId` | 解除流程关联 |
| PATCH | `/api/v1/projects/:projectId/architectures/:archId/processes/order` | 调整节点内流程排序 |

#### 流程搜索（1 个，挂 M3 路由）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/processes/search?q=xxx` | 模糊搜索流程（供 M4 关联操作使用） |

#### 系统菜单（6 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/menus` | 菜单树（服务端返回嵌套 JSON，前端直接渲染 Sidebar） |
| POST | `/api/v1/menus` | 创建菜单项 |
| GET | `/api/v1/menus/:menuId` | 菜单项详情 |
| PUT | `/api/v1/menus/:menuId` | 更新菜单项 |
| DELETE | `/api/v1/menus/:menuId` | 删除菜单项（级联删除子菜单） |
| GET | `/api/v1/menus/tree` | 完整菜单树（扁平列表 + parent_id，或嵌套 JSON） |

**总计：~87 个端点（M4 实际实现 11 个）**

---

## 6. 校验机制（Task 1.4 / Task 1.5 合并）

### 6.1 技术选型确认

**TypeBox + Ajv**，理由：
1. 一套定义三处复用：TS 类型推导 + Ajv 运行校验 + Sprint() 输出 JSON Schema 给下游
2. 动态 Schema 天然适配 ~52 种组件类型的 PropsSchema 分发（Phase 2 需要）
3. 与 Drizzle/TypeScript 生态配合良好

### 6.2 Phase 1 实现范围

| 层级 | 名称 | Phase 1 实现？ | 说明 |
|------|------|---------------|------|
| L1 | 结构校验 | ✅ | 必填字段存在、类型匹配、枚举值合法 |
| L2 | 类型约束校验 | ⚠️ 部分 | 领域模型的 field_type 枚举校验（26 种）、node_type 校验（2 种：action / decision）；完整 PropsSchema 校验留 Phase 2 |
| L3 | 引用完整性校验 | ❌ | Phase 2 实现（hooks/events 引用检查） |
| L4 | 跨对象一致性校验 | ❌ | Phase 2+ 实现 |

### 6.3 Ajv 实例配置

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export const ajv = new Ajv({
  allErrors: true,           // 收集所有错误
  useDefaults: true,         // 自动填充默认值
  coerceTypes: true,         // 自动类型转换
  removeAdditional: true,    // 移除多余属性
  strict: false,             // 允许 additionalProperties（灵活字段需要）
  verbose: true,             // 详细错误信息
});
addFormats(ajv);
```

### 6.4 Fastify preValidation 集成

校验作为路由层的 preValidation hook 注入，业务 Service 层无需关心校验逻辑：

```typescript
app.post('/api/v1/projects/:projectId/domain/entities', {
  preValidation: async (request, reply) => {
    const result = validateCreateEntity(request.body);
    if (!result.valid) {
      reply.code(400).send({
        error: { code: 'VALIDATION_FAILED', message: '校验失败', details: result.errors, requestId: request.id }
      });
      throw new Error('Validation failed');
    }
  },
}, createEntityHandler);
```

### 6.5 校验 Schema 文件结构

```
packages/validation-schemas/src/
├── index.ts              # 导出 + Ajv 实例
├── base.ts               # 通用基础类型（ID、时间戳、分页等）
├── project.schema.ts     # 项目 CRUD Schema
├── domain.schema.ts      # 领域模型 Schema（实体/字段/关系）
├── process.schema.ts     # 业务流程 Schema（流程/节点/边）
├── organization.schema.ts# 组织架构 Schema（公司/部门/角色/外部实体）
├── architecture.schema.ts# 业务架构 Schema
└── menu.schema.ts        # 系统菜单 Schema
```

---

## 7. 错误处理

### 7.1 统一响应格式

见 5.2 节。Fastify 全局 setErrorHandler 捕获所有未处理异常。

### 7.2 错误码体系（Phase 1 范围）

| 错误码 | HTTP 状态 | 场景 |
|--------|----------|------|
| `VALIDATION_FAILED` | 400 | TypeBox+Ajv 校验不通过 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `CONFLICT` | 409 | 唯一约束冲突（项目名/实体名重复） |
| `UNPROCESSABLE_ENTITY` | 422 | 业务规则违反（删除有字段的实体、删除被流程引用的节点、**边形成循环环路**、**删除被节点引用的角色/外部实体**） |
| `INTERNAL_ERROR` | 500 | 未预期异常（不泄露堆栈） |

### 7.3 核心原则

- **永远不泄露内部堆栈**给客户端
- **requestId 贯穿全链路**（Fastify 内置 request.id）
- **Ajv allErrors 模式**一次返回全部字段级错误

---

## 8. 开发环境

### 8.1 目录约定

```
workspace/dev/           # .gitignore，不推送远端
├── docker-compose.yml   # PostgreSQL 服务
├── .env                 # 本地环境变量（DATABASE_URL 等）
└── .gitignore
```

### 8.2 Docker Compose（PostgreSQL）

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: apm_dev
      POSTGRES_PASSWORD: apm_dev_secret
      POSTGRES_DB: apm_prototype
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/postgresql/data
volumes:
  pgdata:
```

### 8.3 启动命令

```bash
# 1. 启动 PostgreSQL
cd workspace/dev && docker-compose up -d

# 2. 安装依赖
pnpm install

# 3. 数据库迁移
pnpm --filter api db:migrate

# 4. 导入种子数据
pnpm --filter api db:seed

# 5. 启动开发服务器（后端 + 前端并行）
pnpm dev
```

---

## 9. Seed 数据

### 9.1 样例项目：「换电站管理系统」

MVP 包含一套完整的种子数据用于开发和演示，覆盖：

- **1 个项目**：换电站管理系统
- **6~8 个实体**：换电站、站务、电池包、充电桩、运维工单、用户/角色
- **每个实体 5~15 个字段**：覆盖常用字段类型子集（string/number/datetime/enum/reference/status 等）
- **5~8 个关系**：换电站 1:N 站务、电池包 N:M 换电站、工单 N:1 用户等
- **1~2 个公司**：换电站运营公司（内部）、第三方合作公司（外部）
- **3~5 个部门**：运营部、技术部、客服部等（支持多级）
- **3~5 个角色**：站务管理员（运营部）、运维工程师（技术部）、客服人员（客服部）、系统管理员等
- **2~3 个外部实体**：支付网关、短信服务商、地图 API 等
- **3 个流程**：电池更换流程、充电管理流程、故障处理流程
- **15~25 个节点**：Action/Decision 各类型均有样例（Start/End 由流程 entry_node_id 隐含）
- **20~30 条边**：含条件边、数据映射边
- **1 套业务架构树**：按业务域分类（如 运营管理 / 设备监控 / 客户服务）
- **1 套系统菜单**：项目管理(项目列表) / 系统设置(菜单管理)

---

## 10. 测试策略（MVP 最小集）

| 层级 | 工具 | Phase 1 覆盖 |
|------|------|-------------|
| 单元测试 | Vitest | shared 类型工具、校验 Schema 编译、Service 层纯函数 |
| API 集成测试 | Vitest + supertest | 三大模块 CRUD 正常路径 + 异常路径（404/409/422） |
| 前端组件测试 | Vitest + Testing Library | 项目列表渲染、实体表格展示、流程画布挂载 |
| E2E 测试 | — | Phase 1 不做，Phase 3 再引入 Playwright |

---

## 11. Phase 1 交付物与验收标准

### 11.1 可用场景（Done Demo）

```
PM 打开浏览器 → http://localhost:13181
  → 左侧 Sidebar 显示系统菜单（从 menus 表读取）：
      ├── 项目管理
      │   └── 项目列表（支持 name 搜索 + status 筛选）
      └── 系统设置
          └── 菜单管理

  ── 「菜单管理」页面 ──
      → 菜单树形编辑器（可增删改菜单项、拖拽排序、调整层级）
      → 支持三种类型：目录分组 / 页面菜单 / 分隔线
      → 每个菜单项可配置：显示名称、图标、路由路径、可见性
      → 修改后实时刷新左侧 Sidebar

  ── 「项目列表」页 ──
      → 看到「换电站管理系统」等项目列表
      → 可按 name 搜索、按 status（active/archived）筛选
      → 点击进入项目详情

  ── Tab 0「组织架构」──
      → 公司面板：可创建/编辑公司（如"换电站运营公司"、"第三方合作公司"）
      → 部门树：可在公司下创建多级部门（如 运营部→站务组、技术部→运维组）
      → 角色管理：在部门下创建角色（如"站务管理员"归属运营部、"运维工程师"归属技术部）
      → 外部实体：创建外部参与者（如"支付网关"，可选关联公司和部门）
      → 流程节点的 holder 下拉框数据来源于此处的角色和外部实体

  ── Tab 1「领域模型」──
      → 实体表格（可新增/编辑/删除实体）
      → 点击实体 → 字段表格（可新增/编辑/删除字段，field_type 下拉选择）
      → 关系图视图（ER 图基础展示，含单向关系线 + targetCardinality 标注）

  ── Tab 2「业务流程」──
      → 左侧导航：业务架构树（L1 域 / L2 子域 / L3 模块组 / L4 分组）
        → 可增删改架构节点、拖拽调整层级
        → 可将流程拖入或指定到某个架构节点下（建立 biz_arch_process_map 关系）
        → 一个流程可归属多个架构节点
      → 主区域：流程列表（可新建流程）
      → 进入流程 → 节点画布
        → 可添加 action 节点和 decision 节点（仅两种）
        → 添加节点时选择 holder（从组织架构的角色/外部实体中选择，或选 service）
        → decision 节点可配置 branches（条件分支）
        → 可连线（点击源节点 → 点击目标节点；多出边隐含并行）
        → 设置入口节点（entry_node_id）和出口节点（exit_node_ids）
        → 渲染时在入口节点前自动绘制起始标记
        → 循环检测警告（画回边时提示）
        → 可配置 subProcess（将一组节点折叠为子流程卡片）
```

### 11.2 明确不可用（留给后续 Phase）

- 无法创建页面和组件
- 无法看到 HTML 视觉层渲染
- 无法进行对话式 AI 协作
- 无任何 MCP 接口
- 无用户认证

---

## 12. 设计决策汇总

| # | 决策 | 理由 |
|---|------|------|
| PH1-1 | **Fastify + PostgreSQL + Drizzle** | 生态/项目契合度/偏好三维分析结果 |
| PH1-2 | **Monorepo (pnpm + Turborepo)** | 多包共享类型、统一构建、前后端分离 |
| PH1-3 | **Phase 1 聚焦数据模型三大模块** | PM 明确优先级：项目/领域模型/业务流程 |
| PH1-4 | **交互原型能力移至 Phase 2** | 保持 MVP 聚焦，避免 scope 膨胀 |
| PH1-5 | **完全不做认证** | MVP 单用户模式，降低复杂度 |
| PH1-6 | **TypeBox + Ajv 校验** | 一套定义三处复用（TS类型+运行校验+JSON Schema输出） |
| PH1-7 | **统一 created_at / updated_at** | 所有表的标准化字段 |
| PH1-8 | **entity_relations 单向关系模型** | relation_kind=dependency/aggregation/composition（3 种单向关系），targetCardinality 用区间表示法，Source 隐含=1，双向=2 条记录。详见数据设计文档表 4 设计思路 |
| PH1-9 | **全局节点池模型** | process_nodes[] + process_edges[] 在 Project 根级别 |
| PH1-10 | **process_node_map 关联表** | 流程→节点多对多映射，sort_order=0 为入口节点 |
| PH1-11 | **不建 process_edge_map** | 边归属通过两端节点是否在同一流程的节点集中推导 |
| PH1-12 | **UUID 文本主键** | 分布式友好、无需自增序列 |
| PH1-13 | **软删除用 status 字段** | 不物理删除，保留历史可追溯 |
| PH1-14 | **Docker Compose 本地 PG** | workspace/dev 目录，.gitignore |
| PH1-15 | **Vitest 做单元+集成测试** | E2E 留到 Phase 3 |
| PH1-16 | **shadcn/ui + Tailwind CSS** | 代码完全可控，适合编辑器类产品的高度定制需求；Phase 1 需要完整表单/表格/选择器/弹窗等组件体系，不能延后 |
| PH1-17 | **ReactFlow 画布库** | 流程编辑器 + ER 图视图，与 React 深度集成、API 简洁 |
| PH1-18 | **组织架构 3 层模型（companies → departments → roles）** | 新增 companies + departments 两张表，roles 和 external_entities 归属到部门/公司；支持多级部门（parent_id 自引用） |
| PH1-19 | **process_nodes.holder 外键引用** | holder_type + holder_id 替代原来的 TEXT holder 字段，通过 holder_type 枚举区分引用 roles.id / external_entities.id / applications(type=service).id |
| PH1-20 | **node_type 仅 action + decision** | 去掉 start/end（由 entry_node_id/exit_node_ids 隐含）、parallel/fork/join/merge（Fork 由多出边隐含、Join/Merge 由 decision 的 branches 驱动） |
| PH1-21 | **business_architectures 业务架构树** | 原名 process_architecture，PM 决策更名为「业务架构」以和流程节点区分；树形分类结构（parent_id 自引用），level 用 L1-L4 表达层级；流程关联用独立映射表 biz_arch_process_map（多对多） |
| PH1-22 | **design_artifacts 延后** | PM 确认不急于 Phase 1 实现，后续再设计 |
| PH1-23 | **去掉 business_processes.trigger_type / trigger_config** | 流程的执行方式由入口节点（entry_node）的 holder 和行为自然定义，不需要额外声明触发机制 |
| PH1-24 | **去掉 business_processes.related_entities** | 流程涉及的实体可从 process_node_map → 节点 → holder/inputs/outputs 推导，或由 Service 层缓存；不需要冗余存储 |
| PH1-25 | **轻量版菜单系统（menus 表）** | 菜单存数据库驱动 Sidebar 渲染；路由前端 React Router 硬编码（不做动态路由注册）；roles/permissions 字段预留 Phase 3 启用；与业务流程 Role 完全无关 |
