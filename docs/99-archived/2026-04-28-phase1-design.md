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

> **设计决策记录**：此表经过 PM 与 AI 深度讨论后重新设计，详见下方「设计思路」。

```sql
CREATE TABLE entity_relations (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_entity_id    TEXT NOT NULL REFERENCES domain_entities(id) ON DELETE CASCADE,
  target_entity_id    TEXT NOT NULL REFERENCES domain_entities(id) ON DELETE CASCADE,

  -- 关系性质（3 种单向关系类型）
  relation_kind       TEXT NOT NULL CHECK (relation_kind IN (
    'dependency',      -- 依赖：A 知道 B / A 使用 B 的能力 / A 在某些行为中需要 B
    'aggregation',     -- 聚合（弱拥有）：A 包含 B，B 可独立于 A 存在
    'composition'      -- 组合（强拥有）：A 包含 B，B 随 A 消亡而消亡
  )),

  -- 目标基数（数学区间表示法；Source 端隐含 = 1，即从单个实体视角描述关系）
  -- 取值示例：'*' = 不限 / 多个 | '1' = 恰好一个 | '0' = 可选(零个) |
  --           '[0,1]' = 零或一 | '[3,9]' = 3 到 9 个 | '[1,*]' = 至少一个
  target_cardinality  TEXT NOT NULL DEFAULT '*',

  -- 此方向的显示名称（UML Role Name 概念）
  display_name        TEXT,

  -- 关系描述（为什么存在这个关系——每个方向的原因可能不同）
  description         TEXT,

  config              JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, source_entity_id, target_entity_id, relation_kind)
);
CREATE INDEX idx_entity_relations_project ON entity_relations(project_id);
```

**设计思路（PM 决策记录）**：

**问题背景**：原设计 `type=has/belongsTo` + `cardinality` 单值存在四个结构性问题：
1. has 和 belongsTo 是同一关系的两面，用 type 区分是把"方向"和"性质"混在一起
2. 单值 cardinality 无法表达双向数量关系
3. 一对实体之间的关系到底存 1 条还是 2 条记录不明确
4. 缺乏方法论支撑

**PM 的核心判断**：
- **拒绝 UML 的"双向关联（Association）"概念**。PM 认为"双向关联"只是对事物关系的概括性描述，会导致 cardinality 解读模糊——因为每个方向的存在原因和数量约束往往是不同的。
- **采用单向关系模型**：每条记录表达一个方向的关系语义。如果 A 和 B 互相需要对方的能力，则由两条独立的 `dependency` 记录分别描述，各自有独立的 cardinality、display_name、description。
- **借鉴 UML 的关系性质分类**（聚合/组合），但明确为单向语义。
- **Source 端隐含 = 1**：一条关系永远从单个 Source 实体的视角出发去描述 Target 端的数量，因此不需要 sourceCardinality 字段。
- **targetCardinality 采用数学区间表示法**：`*` 表示不限（多），数字表示精确值，`[min,max]` 表示范围。

**最终模型对比原设计**：

| 维度 | 原设计 | 新设计 |
|------|--------|--------|
| 关系类型 | `has` / `belongsTo` | `dependency` / `aggregation` / `composition` |
| 方向性 | 隐含在 type 中（混乱） | 明确单向，双向 = 2 条记录 |
| 基数 | `cardinality` 单值（语义不清） | `target_cardinality` 单值（Source 隐含=1） |
| 显示名 | `inverse_name`（仅反向） | `display_name`（每条自带） |
| 记录数 | 不明确 | **1 条 = 1 个单向关系** |

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
  -- 子流程相关
  parent_process_id   TEXT REFERENCES business_processes(id) ON DELETE SET NULL,
  entry_node_id       TEXT,                        -- 入口节点 ID（引用 process_nodes.id）
  exit_node_ids       JSONB DEFAULT '[]',          -- 出口节点 ID 列表
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

> **设计决策记录**：
> - node_type 仅保留 `action` 和 `decision` 两种。Start/End 由 business_processes 的 entry_node_id / exit_node_ids 隐含定义，渲染时虚拟绘制。Fork（多出边隐含并行）、Join/Merge（多入边节点的出边由其 decision 的 branches 驱动）均不需要独立节点类型。
> - holder 通过 holder_type 区分引用目标，使用外键关联到实际表。

```sql
CREATE TABLE process_nodes (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- 节点类型（仅 2 种）
  node_type       TEXT NOT NULL CHECK (node_type IN (
    'action',                           -- 行动节点：执行者执行具体行为
    'decision'                          -- 判断分支节点：含 branches[] 条件分支；
                                         --   同时承担 Join 汇聚逻辑（多入边时由 decision 判断触发条件）
  )),
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT,
  -- 节点持有者（用于泳道渲染和权限归属）
  -- holder_type 决定 holder_id 引用哪张表
  holder_type     TEXT NOT NULL CHECK (holder_type IN (
    'role',             -- → holder_id 引用 roles.id
    'external_entity',  -- → holder_id 引用 external_entities.id
    'service'           -- → holder_id 引用 applications(type='service').id（系统自动执行，无人）
  )),
  holder_id       TEXT NOT NULL,          -- 根据 holder_type 引用对应表的 ID
  -- Decision 特有：分支定义
  branches        JSONB DEFAULT '[]',  -- [{name, condition?, outputs?}]
  -- 节点参数（输入输出定义）
  inputs          JSONB DEFAULT '[]',
  outputs         JSONB DEFAULT '[]',
  -- 扩展配置
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_process_nodes_project ON process_nodes(project_id);
-- holder 查询索引（按类型查某参与者的所有节点）
CREATE INDEX idx_process_nodes_holder ON process_nodes(project_id, holder_type, holder_id);
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

> **循环检测策略（两端都做 + 阻断）**：
> - **后端**：创建边时用 DFS 检测从 target 出发是否能回到 source，若能则返回 422 `UNPROCESSABLE_ENTITY`（错误码复用）
> - **前端**：画布连线时即时 DFS 检测，阻断连线操作并弹提示
> - 算法：从 target_node_id 开始 DFS 遍历出边，若能回到 source_node_id 则存在环路
> - 自环已由 CHECK (source != target) 拦截，此处检测的是间接环路（A→B→C→A）

#### 表 9：process_node_map — 流程-节点关联映射表

```sql
CREATE TABLE process_node_map (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  process_id      TEXT NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
  node_id         TEXT NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,
  -- 排序顺序（仅用于画布上的节点排列顺序，不用于标识入口节点）
  -- 入口节点由 business_processes.entry_node_id 唯一确定
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
  -- 应用平台类型（7 种）
  type            TEXT NOT NULL DEFAULT 'web' CHECK (type IN (
    'web', 'wxapp', 'android', 'ios', 'pc', 'api', 'service'
  )),
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

#### 表 13：companies — 公司/组织表

> 组织架构顶层。一个 Project 可涉及多个公司（如集团+子公司、甲方+乙方）。

```sql
CREATE TABLE companies (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT,
  -- 公司类型（可选分类）
  company_type    TEXT,                        -- 'internal' / 'external' / 'partner' / 'client' 等
  contact_info    JSONB DEFAULT '{}',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, name)
);
CREATE INDEX idx_companies_project ON companies(project_id);
```

#### 表 14：departments — 部门表

> 组织架构中间层。部门归属于公司，角色归属于部门。支持多级部门（parent_id 自引用）。

```sql
CREATE TABLE departments (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id      TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id       TEXT REFERENCES departments(id) ON DELETE SET NULL,  -- 支持多级部门
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT,
  contact_info    JSONB DEFAULT '{}',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, name)
);
CREATE INDEX idx_departments_project ON departments(project_id);
CREATE INDEX idx_departments_company ON departments(company_id);
CREATE INDEX idx_departments_parent ON departments(parent_id);
```

#### 表 15：roles — 角色定义表

> 流程节点的 holder（执行者）引用角色概念，此表为其数据源。角色归属于部门和公司。Phase 1 基础版：仅存储角色定义，actions/decisions 子结构留后续 Phase 扩展。

```sql
CREATE TABLE roles (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  department_id   TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT,
  -- 角色分类标签（可选）：如 'internal' / 'external' / 'system'
  category        TEXT,
  -- 联系方式（用于通知类 tool）
  contact_info    JSONB DEFAULT '{}',       -- { email?, phone?, page? }
  -- Phase 1 占位：该角色可执行的行为和决策（完整结构待 Phase 2+ 设计）
  actions         JSONB DEFAULT '[]',
  decisions       JSONB DEFAULT '[]',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, name)
);
CREATE INDEX idx_roles_project ON roles(project_id);
CREATE INDEX idx_roles_department ON roles(department_id);
```

#### 表 16：external_entities — 外部实体表

> 与 Role 对称的第四类流程参与者（Role / Service / ExternalEntity）。外部系统/组织/人员，可被流程节点引用为 holder。同样归属到公司和部门。

```sql
CREATE TABLE external_entities (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id      TEXT REFERENCES companies(id) ON DELETE SET NULL,
  department_id    TEXT REFERENCES departments(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT,
  -- 外部实体类型（可选分类）
  entity_type     TEXT,                        -- 'system' / 'organization' / 'person' / 'api' 等
  -- 联系/调用方式
  contact_info    JSONB DEFAULT '{}',           -- { endpointUrl?, protocol?, authMethod? }
  -- Phase 1 占位：该外部实体可提供的行为和决策
  actions         JSONB DEFAULT '[]',
  decisions       JSONB DEFAULT '[]',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, name)
);
CREATE INDEX idx_external_entities_project ON external_entities(project_id);
```

#### 表 17：business_architectures — 业务架构表

> 原名 `process_architecture`，PM 决策更名为「业务架构」。树形分类结构，用于对项目内的业务流程进行组织和导航。与底层流程拓扑无关，纯手动维护的分类体系。

```sql
CREATE TABLE business_architectures (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id       TEXT REFERENCES business_architectures(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT,
  -- 业务架构层级（L1=顶层域 / L2=子域 / L3=模块组 / L4=具体分组）
  level           TEXT NOT NULL CHECK (level IN ('L1', 'L2', 'L3', 'L4')),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, name)
);
CREATE INDEX idx_business_architectures_project ON business_architectures(project_id);
CREATE INDEX idx_business_architectures_parent ON business_architectures(parent_id);
-- 自引用索引支持树形查询
```

#### 表 18：biz_arch_process_map — 业务架构-流程关联映射表

> 业务架构节点与业务流程的多对多关系。一个架构节点可包含多个流程，一个流程也可归属多个架构节点。

```sql
CREATE TABLE biz_arch_process_map (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  architecture_id         TEXT NOT NULL REFERENCES business_architectures(id) ON DELETE CASCADE,
  process_id              TEXT NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
  sort_order              INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(architecture_id, process_id)
);
CREATE INDEX idx_bizarch_process_map_arch ON biz_arch_process_map(architecture_id);
CREATE INDEX idx_bizarch_process_map_process ON biz_arch_process_map(process_id);
```

#### 表 19：menus — 系统菜单表

> 轻量版菜单管理。菜单数据存数据库，后端 API 下发菜单树驱动前端 Sidebar 渲染。路由本身由前端 React Router 硬编码（Phase 1 不做动态路由注册）。roles/permissions 字段预留，Phase 3 接入系统角色和权限控制。

```sql
CREATE TABLE menus (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  parent_id       TEXT REFERENCES menus(id) ON DELETE CASCADE,   -- 支持多级菜单
  name            TEXT NOT NULL,           -- 标识名（如 "project-list"）
  display_name    TEXT NOT NULL,           -- 显示名称（如 "项目列表"）
  icon            TEXT,                    -- 图标（lucide-react 图标名）
  path            TEXT,                    -- 对应的路由路径（如 "/projects"）；directory 类型可为 null
  menu_type       TEXT NOT NULL DEFAULT 'menu' CHECK (menu_type IN (
    'menu',        -- 页面菜单（可点击跳转）
    'directory',   -- 目录分组（仅展开，不跳转）
    'separator'    -- 分隔线
  )),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  visible         BOOLEAN NOT NULL DEFAULT true,
  -- Phase 3 启用：权限预留字段
  roles           JSONB DEFAULT '[]',     -- 允许查看此菜单的系统角色列表
  permissions     JSONB DEFAULT '[]',     -- 所需权限标识
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_menus_parent ON menus(parent_id);
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
  ├── (N) process_nodes  [全局原子节点池，holder 引用 role/extEntity/service]
  ├── (N) process_edges  [全局边池]
  │
  ├── 组织架构（3 层）：
  │   ├── (N) companies                              [公司]
  │   │   └── (N) departments ──→ (N) roles           [部门 → 角色]
  │   │       └── self-referential: parent_id → id    [多级部门]
  │   └── (N) external_entities                      [外部实体，可选归属 company+department]
  │
  └── (N) business_architectures                     [业务架构树]
        ├── self-referential: parent_id → id         [树形层级]
        └── (N) biz_arch_process_map ──→ business_processes  [架构↔流程多对多]

applications (N per project)
  └── (N) pages
        └── (N) page_layout_regions

系统级（不归属 Project）：
  └── menus [菜单树]
        └── self-referential: parent_id → id  [多级菜单]
```

**总计：19 张核心表**

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
| GET | `/api/v1/projects/:projectId/business-architectures` | 业务架构树（扁平列表，含 parent_id 可前端组装） |
| POST | `/api/v1/projects/:projectId/business-architectures` | 创建架构节点 |
| GET | `/api/v1/projects/:projectId/business-architectures/:archId` | 架构节点详情（含子节点列表 + 关联流程） |
| PUT | `/api/v1/projects/:projectId/business-architectures/:archId` | 更新架构节点 |
| DELETE | `/api/v1/projects/:projectId/business-architectures/:archId` | 删除架构节点（级联删除子节点+映射关系） |
| GET | `/api/v1/projects/:projectId/business-architectures/tree` | 完整树形结构（服务端递归查询返回嵌套 JSON） |

#### 业务架构·流程映射（5 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:projectId/business-architectures/:archId/processes` | 某架构节点关联的流程列表 |
| POST | `/api/v1/projects/:projectId/business-architectures/:archId/processes` | 将流程添加到架构节点下 |
| DELETE | `/api/v1/projects/:projectId/business-architectures/:archId/processes/:processId` | 从架构节点下移除流程 |
| PUT | `/api/v1/projects/:projectId/business-architectures/:archId/processes/reorder` | 调整架构节点内流程的排序 |
| GET | `/api/v1/projects/:projectId/processes/:processId/architectures` | 查询某流程归属的所有架构节点 |

#### 系统菜单（6 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/menus` | 菜单树（服务端返回嵌套 JSON，前端直接渲染 Sidebar） |
| POST | `/api/v1/menus` | 创建菜单项 |
| GET | `/api/v1/menus/:menuId` | 菜单项详情 |
| PUT | `/api/v1/menus/:menuId` | 更新菜单项 |
| DELETE | `/api/v1/menus/:menuId` | 删除菜单项（级联删除子菜单） |
| GET | `/api/v1/menus/tree` | 完整菜单树（扁平列表 + parent_id，或嵌套 JSON） |

**总计：~91 个端点**

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
├── organization.schema.ts# 组织架构 Schema（公司 + 部门 + 角色 + 外部实体）
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
PM 打开浏览器 → http://localhost:5173
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
| PH1-8 | **entity_relations 单向关系模型** | relation_kind=dependency/aggregation/composition（3 种单向关系），targetCardinality 用区间表示法，Source 隐含=1，双向=2 条记录。详见表 4 设计思路 |
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

---

## 13. Phase 1+ 扩展预留（已识别的功能想法）

> 以下功能已在 Phase 1 设计过程中被识别，但因 MVP 范围控制不纳入 Phase 1 实现。记录在此供后续 Phase 规划时参考。

### 13.1 Holder 组织架构扩展（部门维度）

**背景**：`process_nodes.holder_type` 当前仅支持 `role` | `service` 两种值，用于泳道渲染和行为执行者标识。

**问题**：实际流程规划时常从**部门/组织架构**视角审视行为执行者——例如"运维部负责故障处理"比"运维工程师角色负责"更符合组织管理视角。Role 是部门下的子概念。

**扩展方向**：
- 新增 `department` 作为 `holder_type` 的第三种取值
- 建立 **Role ↔ Department** 的归属关系（一个 Department 包含多个 Role）
- 泳道渲染支持按部门分组显示
- 数据模型层面可考虑新增 `departments` 表或用 JSONB 配置表达

**影响范围**：process_nodes 表（holder_type 枚举扩展）、泳道渲染逻辑、可能的 departments 表

**建议归属 Phase**：Phase 3（团队协作/权限相关）或 Phase 1.5（MVP 迭代优化）
