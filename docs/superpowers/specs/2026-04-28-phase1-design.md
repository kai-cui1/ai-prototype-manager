# Phase 1 设计规格：架构冻结 + MVP

> **文档编号**：docs/superpowers/specs/2026-04-28-phase1-design
> **状态**：待审核
> **日期**：2026-04-28
> **关联**：Roadmap V3 Phase 1（8 个任务）
> **前置**：Phase 0 设计规格 100% 完成

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

### 2.2 不在选型范围内的（后续决策）

- UI 组件库（Ant Design / shadcn/ui / 自研）— Phase 1 前端只需基础表格和画布
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
│   │   │   │   └── process.ts      #   业务流程路由（流程/节点/边）
│   │   │   ├── services/           # 业务逻辑层
│   │   │   │   ├── project.service.ts
│   │   │   │   ├── domain.service.ts
│   │   │   │   └── process.service.ts
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
│   │   │   │   └── ProcessEditor.tsx    # 流程编辑器
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
│   │   │   │   └── index.ts        #   统一导出
│   │   │   └── utils/              # 共享工具函数
│   │   │       └── index.ts
│   │   └── package.json
│   │
│   └── validation-schemas/          # TypeBox Schema 定义包
│       ├── src/
│       │   ├── project.schema.ts   #   项目相关 Schema
│       │   ├── domain.schema.ts    #   领域模型相关 Schema
│       │   ├── process.schema.ts   #   业务流程相关 Schema
│       │   └── index.ts            #   统一导出 + Ajv 实例配置
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

## 4. 数据库 Schema 设计

### 4.1 设计规范

- **统一标准字段**：每张表必须包含 `created_at timestampz` 和 `updated_at timestampz`
- **主键**：统一使用 `id text PRIMARY KEY DEFAULT gen_random_uuid()::text`（UUID 字符串格式）
- **软删除**：核心实体表使用 `status` 字段标记（`active` / `archived`），不物理删除
- **JSONB 灵活字段**：config/metadata 类扩展信息使用 JSONB，避免频繁 DDL

### 4.2 核心表定义（12 张）

#### 表 1：projects — 项目主表

```sql
CREATE TABLE projects (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'active',  -- active | archived
  version         INTEGER NOT NULL DEFAULT 1,
  config          JSONB DEFAULT '{}',             -- 扩展配置
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 表 2：domain_entities — 实体表

```sql
CREATE TABLE domain_entities (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT,
  -- 分类标签（可选）：core / supporting / event / etc.
  category        TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, name)
);
CREATE INDEX idx_domain_entities_project ON domain_entities(project_id);
```

#### 表 3：entity_fields — 字段表

```sql
CREATE TABLE entity_fields (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entity_id       TEXT NOT NULL REFERENCES domain_entities(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT,
  -- 字段类型（26 种之一）：string / number / boolean / datetime /
  -- text / enum / email / url / phone / currency / percentage /
  -- coordinate / file / image / rich_text / json / array /
  -- reference / formula / computed / color / rating / icon / duration / status
  field_type      TEXT NOT NULL,
  -- 是否必填
  is_required     BOOLEAN NOT NULL DEFAULT false,
  -- 默认值（JSON 存储以支持多种类型）
  default_value   JSONB,
  -- 类型约束配置（如 string 的 maxLength/pattern、enum 的 options 等）
  constraints     JSONB DEFAULT '{}',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(entity_id, name)
);
CREATE INDEX idx_entity_fields_entity ON entity_fields(entity_id);
```

#### 表 4：entity_relations — 实体关系表

```sql
CREATE TABLE entity_relations (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_entity_id TEXT NOT NULL REFERENCES domain_entities(id) ON DELETE CASCADE,
  target_entity_id TEXT NOT NULL REFERENCES domain_entities(id) ON DELETE CASCADE,
  -- 关系方向类型（仅 2 种值）
  type            TEXT NOT NULL CHECK (type IN ('has', 'belongsTo')),
  -- 数量关系：'1', 'N', '0..1', '0..N', '1..N', 具体数字等
  cardinality     TEXT NOT NULL DEFAULT 'N',
  -- 反向关系的显示名称（可选）
  inverse_name    TEXT,
  -- 扩展配置（如 cascade_delete 标记等）
  source_config   JSONB DEFAULT '{}',
  target_config   JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, source_entity_id, target_entity_id, type)
);
CREATE INDEX idx_entity_relations_project ON entity_relations(project_id);
```

#### 表 5：data_flow_metadata — 数据流向元数据表

```sql
CREATE TABLE data_flow_metadata (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  field_id        TEXT NOT NULL REFERENCES entity_fields(id) ON DELETE CASCADE,
  -- 自动推导的数据流向信息
  sources         JSONB DEFAULT '[]',    -- 来源列表 [{entity, field, action}]
  destinations    JSONB DEFAULT '[]',    -- 目的地列表 [{entity, field, action}]
  -- PM 手动备注
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, field_id)
);
```

#### 表 6：business_processes — 流程定义表

```sql
CREATE TABLE business_processes (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  display_name        TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'draft',  -- draft | active | deprecated
  version             INTEGER NOT NULL DEFAULT 1,
  -- 流程触发器配置
  trigger_type        TEXT,                        -- manual | event | timer | message
  trigger_config      JSONB,
  -- 子流程相关
  parent_process_id   TEXT REFERENCES business_processes(id) ON DELETE SET NULL,
  entry_node_id       TEXT,                        -- 入口节点 ID（引用 process_nodes.id）
  exit_node_ids       JSONB DEFAULT '[]',          -- 出口节点 ID 列表
  -- 关联的领域实体（此流程涉及的实体）
  related_entities    JSONB DEFAULT '[]',
  config              JSONB DEFAULT '{}',
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, name)
);
CREATE INDEX idx_business_processes_project ON business_processes(project_id);
-- 子流程索引
CREATE INDEX idx_business_processes_parent ON business_processes(parent_process_id);
```

#### 表 7：process_nodes — 全局原子节点池

```sql
CREATE TABLE process_nodes (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- 节点类型
  node_type       TEXT NOT NULL CHECK (node_type IN (
    'start', 'end',                    -- 开始/结束
    'action',                           -- 行动节点
    'decision',                         -- 判断分支节点
    'parallel', 'fork', 'join', 'merge' -- 并行/分叉/汇聚/合并
  )),
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT,
  -- 节点持有者（用于泳道渲染）
  holder          TEXT,                 -- Role 名或 Service 名
  -- Action 节点特有：执行者类型
  holder_type     TEXT CHECK (holder_type IN ('role', 'service')),
  -- Decision 特有：分支定义
  branches        JSONB DEFAULT '[]',  -- [{name, condition?, outputs?}]
  -- 并行/分叉特有
  parallel_type   TEXT CHECK (parallel_type IN ('and', 'xor')),
  -- 节点参数（输入输出定义）
  inputs          JSONB DEFAULT '[]',
  outputs         JSONB DEFAULT '[]',
  -- 扩展配置
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_process_nodes_project ON process_nodes(project_id);
```

#### 表 8：process_edges — 全局边池

```sql
CREATE TABLE process_edges (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_node_id  TEXT NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,
  target_node_id  TEXT NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,
  -- 边上的数据映射
  mappings        JSONB DEFAULT '[]',  -- [{sourceParam, targetParam, transform?}]
  -- 边标签（可选显示名称）
  label           TEXT,
  -- 条件边（Decision 出边的条件表达式）
  condition       TEXT,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 防止自环
  CHECK (source_node_id != target_node_id)
);
CREATE INDEX idx_process_edges_project ON process_edges(project_id);
CREATE INDEX idx_process_edges_source ON process_edges(source_node_id);
CREATE INDEX idx_process_edges_target ON process_edges(target_node_id);
```

#### 表 9：process_node_map — 流程-节点关联映射表

```sql
CREATE TABLE process_node_map (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  process_id      TEXT NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
  node_id         TEXT NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,
  -- 排序顺序；sort_order=0 表示该节点的 entryNode（入口节点）
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(process_id, node_id)
);
CREATE INDEX idx_process_node_map_process ON process_node_map(process_id);
CREATE INDEX idx_process_node_map_node ON process_node_map(node_id);
```

> **注意**：不需要 process_edge_map 表。边的归属可通过推导判断——如果一条边的 source 和 target 都在某流程的 node_ids 中，则该边属于此流程内部；如果 target 在外部，则为出口边。

#### 表 10：applications — 应用定义表

```sql
CREATE TABLE applications (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT,
  icon            TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, name)
);
```

#### 表 11：pages — 页面表

```sql
CREATE TABLE pages (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  application_id  TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT,
  page_type       TEXT NOT NULL DEFAULT 'page',  -- page | modal | drawer | overlay
  route_path      TEXT,                          -- 路由路径
  associated_process_id TEXT REFERENCES business_processes(id) ON DELETE SET NULL,
  layout_config   JSONB DEFAULT '{}',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(application_id, name)
);
CREATE INDEX idx_pages_application ON pages(application_id);
```

#### 表 12：page_layout_regions — 页面布局区域表

```sql
CREATE TABLE page_layout_regions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  page_id         TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  region_type     TEXT NOT NULL,                 -- header / sidebar / main / footer / custom
  region_name     TEXT NOT NULL,
  layout_config   JSONB DEFAULT '{}',           -- CSS grid/flex 配置
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(page_id, region_name)
);
```

### 4.3 ER 关系图

```
projects (1)
  ├── (N) domain_entities (1)──(N) entity_fields
  ├── (N) entity_relations ←── self-referential via source/target_entity_id
  ├── (N) data_flow_metadata
  ├── (N) business_processes
  │     ├── (N) process_node_map ──→ (N) process_nodes  [全局池]
  │     └── self-referential: parent_process_id → id  [subProcess]
  ├── (N) process_nodes  [全局原子节点池]
  └── (N) process_edges  [全局边池]

applications (N per project)
  └── (N) pages
        └── (N) page_layout_regions
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
{ "error": { "code": "NOT_FOUND", "message": "...", "details"?: ..., "requestId": "..." } }
```

### 5.3 分页规范

查询参数：`?page=1&pageSize=20&sort=name&order=asc`

### 5.4 端点清单

#### 项目管理（7 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects` | 项目列表（分页+搜索+筛选） |
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

**总计：~48 个端点**

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
| L2 | 类型约束校验 | ⚠️ 部分 | 领域模型的 field_type 枚举校验（26 种）、node_type 校验（8 种）；完整 PropsSchema 校验留 Phase 2 |
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
└── process.schema.ts     # 业务流程 Schema（流程/节点/边）
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
| `UNPROCESSABLE_ENTITY` | 422 | 业务规则违反（删除有字段的实体、删除被流程引用的节点） |
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
      - pgdata:/var/lib/postgresql/data
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
- **3 个流程**：电池更换流程、充电管理流程、故障处理流程
- **15~25 个节点**：Start/End/Action/Decision/Fork/Join 各类型均有样例
- **20~30 条边**：含条件边、数据映射边

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
PM 打开浏览器 → http://localhost:5173
  → 看到「换电站管理系统」等项目列表
  → 点击进入项目详情
  → Tab 1「领域模型」：
      → 实体表格（可新增/编辑/删除实体）
      → 点击实体 → 字段表格（可新增/编辑/删除字段，field_type 下拉选择）
      → 关系图视图（ER 图基础展示）
  → Tab 2「业务流程」：
      → 流程列表（可新建流程）
      → 进入流程 → 节点画布
      → 可添加节点（从左侧面板拖拽或点击添加）
      → 可连线（点击源节点 → 点击目标节点）
      → 可配置 subProcess（将一组节点折叠为子流程卡片）
      → 循环检测警告（画回边时提示）
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
| PH1-8 | **entity_relations.type = 2 值** | has / belongsTo，数量由独立 cardinality 字段表达 |
| PH1-9 | **全局节点池模型** | process_nodes[] + process_edges[] 在 Project 根级别 |
| PH1-10 | **process_node_map 关联表** | 流程→节点多对多映射，sort_order=0 为入口节点 |
| PH1-11 | **不建 process_edge_map** | 边归属通过两端节点是否在同一流程的节点集中推导 |
| PH1-12 | **UUID 文本主键** | 分布式友好、无需自增序列 |
| PH1-13 | **软删除用 status 字段** | 不物理删除，保留历史可追溯 |
| PH1-14 | **Docker Compose 本地 PG** | workspace/dev 目录，.gitignore |
| PH1-15 | **Vitest 做单元+集成测试** | E2E 留到 Phase 3 |
