# Phase 1 数据库 Schema 设计

> **来源**：拆分自 `99-archived/2026-04-28-phase1-design.md`（原件归档保留）
> **对应原文件章节**：§4 数据库 Schema 设计（完整）
> **关联文档**：
> - 技术方案部分 → `../04-tech-design/phase1-design-tech.md`
> - 扩展想法部分 → `../01-design-idea/phase1-extension-ideas.md`
> **日期**：2026-04-28（审核通过）
> **状态**：✅ 已审核

---

## 4. 数据库 Schema 设计

### 4.1 设计规范

- **统一标准字段**：每张表必须包含 `created_at timestampz` 和 `updated_at timestampz`
- **主键**：统一使用 `id text PRIMARY KEY DEFAULT gen_random_uuid()::text`（UUID 字符串格式）
- **软删除**：核心实体表使用 `status` 字段标记（`active` / `archived`），不物理删除
- **JSONB 灵活字段**：config/metadata 类扩展信息使用 JSONB，避免频繁 DDL

### 4.2 核心表定义（19 张）

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
  -- 字段类型（完整 26 种定义见 docs/02-domain-model/domain-model.md §5.3）：
  -- Phase 1 仅支持 9 种基础类型：string / number / boolean / datetime /
  -- text / enum / email / url / phone
  -- Phase 2+ 扩展：currency / percentage / coordinate / file / image /
  -- rich_text / json / array / reference / formula / computed /
  -- color / rating / icon / duration / status
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
  department_id   TEXT REFERENCES departments(id) ON DELETE SET NULL,  -- 可选：角色可独立于部门存在（domain model v1.1 Role 独立性设计）
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
  -- 层级描述性标注（可选，PM 自由填写，如 "domain"/"module" 等）
  -- 2026-06-12 变更：移除 L1-L4 枚举约束，改为可选自由文本，不限制层级深度
  level           TEXT,
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

> 轻量版菜单管理。菜单数据存数据库，后端 API 下发菜单树驱动前端 Sidebar 渲染。路由本身由前端 React Router 硬编码（Phase 1 不做动态路由注册）。roles/permissions 字段预留 Phase 3 启用。

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
