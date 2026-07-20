# M3 业务流程管理 — 技术方案设计

> **文档编号**：docs/04-tech-design/modules/business-process/m3-business-process-tech-design.md
> **模块**：M3-业务流程管理
> **步骤**：S4 技术方案设计
> **状态**：draft
> **版本**：v1.0
> **日期**：2026-06-04
> **关联文档**：
> - PRD → `docs/03-prd-ux/modules/project-management/project-management-prd-2.md` §4.12~4.14（行为管理规则）
> - 领域模型 → `docs/02-domain-model/business-process.md`
> - 编码规范 → `docs/04-tech-design/coding-convention.md`
> - 后端编码细则 → `docs/04-tech-design/coding-convention-backend.md`

---

## 1. 概述

### 1.1 功能范围

M3 Phase 1 实现业务流程系统的「核心三层 + 循环约束 + 泳道编辑器」：

| 功能 ID | 名称 | 说明 |
|---------|------|------|
| F-M3-01 | Process CRUD | 流程的创建、查询、更新、删除 |
| F-M3-02 | ProcessNode CRUD | 全局节点池的节点管理（Activity/Decision） |
| F-M3-03 | ProcessEdge CRUD | 全局边池的边管理（连接+数据映射） |
| F-M3-04 | 循环约束校验 | DAG 检测，前后端双重校验 |
| F-M3-05 | 泳道编辑器 | ReactFlow 双轴泳道流程图编辑器 |

> **子流程嵌套**：延后到下一阶段实现。

### 1.2 核心设计决策总览

| # | 决策 | 说明 |
|---|------|------|
| 1 | **全局池即真相** | Project 根级的 `process_nodes` + `process_edges` 是唯一数据源，Process 通过 `nodeIds`/`edgeIds` JSONB 数组直接引用 |
| 2 | **节点 I/O 引用获取** | 节点不冗余存储 I/O，通过 `actionRef`/`decisionRef` 从参与者（Role/App/ExternalEntity）获取 |
| 3 | **边结构化 source/target** | `sourceNodeId`/`targetNodeId` 保留，同时在 `config` 中记录 `branch`/`action` 标识 |
| 4 | **双轴泳道系统** | Participant 固定轴 × 自定义字符串轴，每个节点必须双绑定 |
| 5 | **相对坐标存储** | 节点位置存储为 `{ participantLaneIndex, customLaneIndex, offsetX, offsetY }` |
| 6 | **前后端双重循环校验** | 前端点击"保存/验证"时检测，后端保存时再次校验 |

### 1.3 不在本方案范围

| 项目 | 归属 |
|------|------|
| 流程架构树（树形分类导航） | M4 |
| 子流程嵌套 | 延后 |
| 流程版本管理（versioning） | 延后 |
| 并发约束校验 | 延后 |
| 运行时执行引擎 | 延后 |

---

## 2. 数据库 Schema

### 2.1 Schema 变更总览

| 表 | 操作 | 说明 |
|----|------|------|
| `process_nodes` | **修改** | 删除 `inputs`/`outputs`，新增 `action_ref`/`decision_ref` |
| `process_edges` | **修改** | 保留现有字段，`config` 中补充 source branch / target action 标识 |
| `process_layouts` | **新增** | 泳道配置 + 节点位置（相对坐标） |
| `business_processes` | **修改** | 新增 `node_ids` + `edge_ids` JSONB 数组（替代 `process_node_map`） |
| `process_node_map` | **删除** | 不再使用关联表，改为 JSONB 数组引用 |

### 2.2 process_nodes 表变更

**当前字段（需删除）：**
```typescript
inputs: jsonb('inputs').default('[]'),
outputs: jsonb('outputs').default('[]'),
```

**新增字段：**
```typescript
// 引用参与者的 Action/DecisionDef（二选一，根据 node_type）
actionRef: text('action_ref'),      // node_type='action' 时必填
// decisionRef 复用现有 branches JSONB（node_type='decision' 时必填）
// 但当前 branches 存储在 branches JSONB 中，需确认字段归属
```

> **设计说明**：
> - `actionRef`：指向 `Role.actions[]` / `Application.actions[]` / `ExternalEntity.actions[]` 中的某个 Action ID
> - `decisionRef`：由于 DecisionDef 包含 `branches` 数组，而当前 `process_nodes` 已有 `branches` JSONB 字段，**需要确认** `decisionRef` 是新增字段还是复用 `branches` 中的信息

**⚠️ 关键问题确认：**

当前 `process_nodes` 已有 `branches: jsonb('branches').default('[]')` 字段，用于存储 DecisionNode 的分支定义。根据领域模型设计：
- DecisionNode 的 `decisionRef` 引用参与者身上的 `DecisionDef`
- 分支定义（branches）应该存储在参与者身上（Role/ExternalEntity/App 的 `decisions[]` JSONB 中）
- 流程节点上的 `branches` 字段是冗余的

**推荐方案**：
1. 删除 `process_nodes` 的 `branches` 字段（冗余，I/O 来自引用的 DecisionDef）
2. 新增 `decisionRef: text('decision_ref')` 字段（node_type='decision' 时必填）
3. 新增 `actionRef: text('action_ref')` 字段（node_type='action' 时必填）

**变更后 process_nodes 完整定义：**

```typescript
export const processNodes = pgTable('process_nodes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  nodeType: text('node_type').notNull(), // action | decision
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  holderType: text('holder_type').notNull(), // role | external_entity | service
  holderId: text('holder_id').notNull(),
  // ★ M3 新增：引用参与者的 Action/DecisionDef
  actionRef: text('action_ref'),      // node_type='action' 时必填
  decisionRef: text('decision_ref'),  // node_type='decision' 时必填
  // ★ M3 保留：条件表达式（进入此节点的守卫条件）
  condition: text('condition'),
  // ★ M3 保留：配置扩展字段
  config: jsonb('config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_process_nodes_project').on(table.projectId),
  index('idx_process_nodes_holder').on(table.projectId, table.holderType, table.holderId),
]);
```

### 2.3 process_edges 表变更

**不变更 DDL**，在 `config` JSONB 中补充结构化信息：

```typescript
// config 结构扩展：
interface ProcessEdgeConfig {
  // source 结构化信息
  sourceAction?: string;     // 源节点是 activity 时：actionRef
  sourceBranch?: string;     // 源节点是 decision 时：分支名（如 "approved"）
  // target 结构化信息
  targetAction?: string;     // 目标节点是 activity 时：actionRef
  // 其他扩展...
}
```

**理由**：
- `sourceNodeId`/`targetNodeId` 保留作为基础连接（ReactFlow 需要）
- `sourceAction`/`sourceBranch`/`targetAction` 作为业务语义补充存入 `config`
- 避免 DDL 变更，保持 schema 稳定性

### 2.4 process_layouts 表（新增）

存储流程图的泳道配置和节点位置（相对坐标）。

```typescript
export const processLayouts = pgTable('process_layouts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  processId: text('process_id').notNull().references(() => businessProcesses.id, { onDelete: 'cascade' }),
  // 泳道方向配置
  orientation: text('orientation').notNull().default('participant-horizontal'), // participant-horizontal | participant-vertical
  // Participant 泳道配置（固定轴）
  participantLanes: jsonb('participant_lanes').default('[]'), // Array<{ participantId: string; participantType: string; label: string; order: number; size: number }>
  // 自定义泳道配置（自定义轴）
  customLanes: jsonb('custom_lanes').default('[]'), // Array<{ id: string; name: string; label: string; order: number; size: number }>
  // 节点位置（相对坐标）
  nodePositions: jsonb('node_positions').default('{}'), // Record<nodeId, { participantLaneIndex: number; customLaneIndex: number; offsetX: number; offsetY: number }>
  // 泳道尺寸人工调整记录
  laneOverrides: jsonb('lane_overrides').default('{}'), // Record<laneId, { size: number }>
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_process_layouts_process').on(table.processId),
  uniqueIndex('process_layouts_process_unique').on(table.processId),
]);
```

**字段详细说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `orientation` | text | `participant-horizontal` = Participant 为横向泳道（上下排列），自定义为纵向（左右排列）；`participant-vertical` = 反之 |
| `participantLanes` | jsonb | 按 order 排序的 participant 泳道数组，每个元素包含 participantId、类型、标签、尺寸 |
| `customLanes` | jsonb | 按 order 排序的自定义泳道数组，由设计者在编辑器内创建/删除 |
| `nodePositions` | jsonb | 每个节点的相对坐标：`{ participantLaneIndex, customLaneIndex, offsetX, offsetY }` |
| `laneOverrides` | jsonb | 人工调整的泳道尺寸，覆盖自动计算值 |

### 2.5 Schema 变更汇总（DDL）

```sql
-- 1. business_processes：新增 node_ids / edge_ids JSONB 数组
ALTER TABLE business_processes ADD COLUMN IF NOT EXISTS node_ids JSONB DEFAULT '[]';
ALTER TABLE business_processes ADD COLUMN IF NOT EXISTS edge_ids JSONB DEFAULT '[]';

-- 2. process_nodes：删除冗余字段，新增引用字段
ALTER TABLE process_nodes DROP COLUMN IF EXISTS inputs;
ALTER TABLE process_nodes DROP COLUMN IF EXISTS outputs;
ALTER TABLE process_nodes DROP COLUMN IF EXISTS branches;
ALTER TABLE process_nodes ADD COLUMN IF NOT EXISTS action_ref TEXT;
ALTER TABLE process_nodes ADD COLUMN IF NOT EXISTS decision_ref TEXT;
ALTER TABLE process_nodes ADD COLUMN IF NOT EXISTS condition TEXT;

-- 3. process_layouts：新建表
CREATE TABLE IF NOT EXISTS process_layouts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  process_id TEXT NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
  orientation TEXT NOT NULL DEFAULT 'participant-horizontal',
  participant_lanes JSONB DEFAULT '[]',
  custom_lanes JSONB DEFAULT '[]',
  node_positions JSONB DEFAULT '{}',
  lane_overrides JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(process_id)
);
CREATE INDEX idx_process_layouts_process ON process_layouts(process_id);

-- 4. process_node_map：删除关联表（数据已迁移到 business_processes.node_ids）
DROP TABLE IF EXISTS process_node_map;
```

---

## 3. API 端点详细规格

### 3.1 端点清单

| # | 方法 | 路径 | 说明 |
|---|------|------|------|
| 1 | GET | `/api/v1/projects/:projectId/processes` | 列出项目下的所有流程 |
| 2 | POST | `/api/v1/projects/:projectId/processes` | 创建流程 |
| 3 | GET | `/api/v1/projects/:projectId/processes/:processId` | 获取流程详情（含节点、边、布局） |
| 4 | PUT | `/api/v1/projects/:projectId/processes/:processId` | 更新流程基础信息 |
| 5 | DELETE | `/api/v1/projects/:projectId/processes/:processId` | 删除流程 |
| 6 | GET | `/api/v1/projects/:projectId/processes/:processId/nodes` | 获取流程的节点列表 |
| 7 | POST | `/api/v1/projects/:projectId/processes/:processId/nodes` | 向流程添加节点（同时创建全局节点） |
| 8 | PUT | `/api/v1/projects/:projectId/processes/:processId/nodes/:nodeId` | 更新节点 |
| 9 | DELETE | `/api/v1/projects/:projectId/processes/:processId/nodes/:nodeId` | 从流程移除节点（同时删除全局节点） |
| 10 | GET | `/api/v1/projects/:projectId/processes/:processId/edges` | 获取流程的边列表 |
| 11 | POST | `/api/v1/projects/:projectId/processes/:processId/edges` | 创建边 |
| 12 | PUT | `/api/v1/projects/:projectId/processes/:processId/edges/:edgeId` | 更新边 |
| 13 | DELETE | `/api/v1/projects/:projectId/processes/:processId/edges/:edgeId` | 删除边 |
| 14 | GET | `/api/v1/projects/:projectId/processes/:processId/layout` | 获取流程布局 |
| 15 | PUT | `/api/v1/projects/:projectId/processes/:processId/layout` | 更新流程布局（泳道 + 节点位置） |
| 16 | POST | `/api/v1/projects/:projectId/processes/:processId/validate` | 验证流程（DAG 检测 + 规则校验） |


### 3.2 公共约定

- 所有响应遵循 `{ data: ... }` / `{ error: {...} }` 格式
- 路径中的 `:projectId` 用于项目级权限校验
- Process 级操作需校验 Process 是否存在且属于该 Project

### 3.3 Process CRUD

#### 3.3.1 List Processes

**GET** `/api/v1/projects/:projectId/processes`

**Query Params：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| parentProcessId | string | 否 | 筛选指定父流程下的子流程 |
| status | string | 否 | 按状态筛选（draft/active/deprecated） |

**Response：**

```json
{
  "data": [
    {
      "id": "proc_001",
      "name": "order_flow",
      "displayName": "订单处理流程",
      "description": "用户下单到完成的完整流程",
      "status": "draft",
      "version": 1,
      "parentProcessId": null,
      "entryNodeIds": ["node_001"],
      "exitNodeIds": ["node_010"],
      "sortOrder": 0,
      "createdAt": "2026-06-04T10:00:00Z",
      "updatedAt": "2026-06-04T10:00:00Z"
    }
  ]
}
```

#### 3.3.2 Create Process

**POST** `/api/v1/projects/:projectId/processes`

**Request Body：**

```json
{
  "name": "order_flow",
  "displayName": "订单处理流程",
  "description": "用户下单到完成的完整流程",
  "entryNodeIds": [],
  "exitNodeIds": []
}
```

**校验规则：**

| 规则 | 错误码 | 说明 |
|------|--------|------|
| name 格式 `/^[a-zA-Z0-9_-]+$/`，2~50 字符 | INVALID_NAME_FORMAT | 流程标识名 |
| name 在 project 内唯一 | NAME_CONFLICT | 同项目不可重复 |
| displayName 必填，1~100 字符 | DISPLAY_NAME_REQUIRED | 显示名称 |


**Response（201）：**

```json
{
  "data": {
    "id": "proc_001",
    "name": "order_flow",
    "displayName": "订单处理流程",
    "description": "用户下单到完成的完整流程",
    "status": "draft",
    "version": 1,
    "entryNodeIds": [],
    "exitNodeIds": [],
    "sortOrder": 0,
    "createdAt": "2026-06-04T10:00:00Z",
    "updatedAt": "2026-06-04T10:00:00Z"
  }
}
```

#### 3.3.3 Get Process Detail

**GET** `/api/v1/projects/:projectId/processes/:processId`

**Query Params：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| includeNodes | boolean | 否 | 是否包含节点详情（默认 false） |
| includeEdges | boolean | 否 | 是否包含边详情（默认 false） |
| includeLayout | boolean | 否 | 是否包含布局数据（默认 false） |

**Response（含完整数据）：**

```json
{
  "data": {
    "id": "proc_001",
    "name": "order_flow",
    "displayName": "订单处理流程",
    "status": "draft",
    "version": 1,
    "parentProcessId": null,
    "entryNodeIds": ["node_001"],
    "exitNodeIds": ["node_010"],
    // 节点列表（includeNodes=true 时）
    "nodes": [
      {
        "id": "node_001",
        "nodeType": "action",
        "name": "submit_order",
        "displayName": "提交订单",
        "holderType": "role",
        "holderId": "role_customer",
        "actionRef": "act_submit_order",
        "condition": null,
        "config": {}
      }
    ],
    // 边列表（includeEdges=true 时）
    "edges": [
      {
        "id": "edge_001",
        "sourceNodeId": "node_001",
        "targetNodeId": "node_002",
        "mappings": [{"source":"orderId","target":"orderId"}],
        "label": null,
        "condition": null,
        "config": {
          "sourceAction": "act_submit_order",
          "targetAction": "act_validate_order"
        }
      }
    ],
    // 布局数据（includeLayout=true 时）
    "layout": {
      "id": "layout_001",
      "orientation": "participant-horizontal",
      "participantLanes": [
        { "participantId": "role_customer", "participantType": "role", "label": "客户", "order": 0, "size": 200 }
      ],
      "customLanes": [
        { "id": "lane_1", "name": "initial", "label": "初始阶段", "order": 0, "size": 300 }
      ],
      "nodePositions": {
        "node_001": { "participantLaneIndex": 0, "customLaneIndex": 0, "offsetX": 50, "offsetY": 30 }
      },
      "laneOverrides": {}
    }
  }
}
```

#### 3.3.4 Update Process

**PUT** `/api/v1/projects/:projectId/processes/:processId`

**Request Body（部分更新）：**

```json
{
  "displayName": "订单处理流程（修订版）",
  "description": "更新后的描述",
  "entryNodeIds": ["node_001"],
  "exitNodeIds": ["node_010"]
}
```

> **注意**：`name` 字段不可变更（标识名），`parentProcessId` 变更需单独接口处理

#### 3.3.5 Delete Process

**DELETE** `/api/v1/projects/:projectId/processes/:processId`

**行为：**
- 级联删除 `process_layouts` 记录
- **不删除**全局节点（`process_nodes`）和边（`process_edges`）—— 由全局池管理，可能被他流程引用
- 从 `business_processes` 中移除该流程记录（node_ids / edge_ids 随记录删除）

### 3.4 ProcessNode CRUD

#### 3.4.1 List Nodes

**GET** `/api/v1/projects/:projectId/processes/:processId/nodes`

返回该流程关联的所有节点（通过 `business_processes.node_ids` 查询 `process_nodes`）。

**Response：**

```json
{
  "data": [
    {
      "id": "node_001",
      "nodeType": "action",
      "name": "submit_order",
      "displayName": "提交订单",
      "description": "用户提交订单",
      "holderType": "role",
      "holderId": "role_customer",
      "actionRef": "act_submit_order",
      "condition": null,
      "config": {},
      "sortOrder": 0
    }
  ]
}
```

#### 3.4.2 Create Node

**POST** `/api/v1/projects/:projectId/processes/:processId/nodes`

**Request Body：**

```json
{
  "nodeType": "action",
  "name": "submit_order",
  "displayName": "提交订单",
  "description": "用户提交订单",
  "holderType": "role",
  "holderId": "role_customer",
  "actionRef": "act_submit_order",
  "condition": null,
  "config": {}
}
```

**业务逻辑：**
1. 校验项目状态（active 才允许创建）
2. 校验 holder 存在（`holderId` 对应的 Role/App/ExternalEntity 存在）
3. 校验 actionRef/decisionRef 存在（对应的 Action/DecisionDef 存在于 holder 的 actions/decisions 数组中）
4. 创建全局节点（`process_nodes` 表）
5. 将节点 ID 添加到 `business_processes.node_ids` 数组中

#### 3.4.3 Update Node

**PUT** `/api/v1/projects/:projectId/processes/:processId/nodes/:nodeId`

**Request Body（部分更新）：**

```json
{
  "displayName": "提交订单（修订）",
  "description": "更新后的描述",
  "actionRef": "act_submit_order_v2",
  "condition": "user.balance > 0"
}
```

> **注意**：`nodeType`/`holderType`/`holderId` 不可变更（创建后固定）

#### 3.4.4 Delete Node

**DELETE** `/api/v1/projects/:projectId/processes/:processId/nodes/:nodeId`

**业务逻辑：**
1. 校验项目状态
2. 从 `business_processes.node_ids` 中移除该节点 ID
3. 检查该节点是否被其他流程引用（其他 Process 的 `node_ids` 包含此节点）
4. 如果未被其他流程引用：
   - 删除 `process_nodes` 全局记录
   - 级联删除关联的 `process_edges`（source 或 target 为本节点的边）
   - 从 `business_processes.edge_ids` 中移除已删除的边 ID
5. 如果被其他流程引用：
   - 保留全局节点（供其他流程继续使用）

### 3.5 ProcessEdge CRUD

#### 3.5.1 List Edges

**GET** `/api/v1/projects/:projectId/processes/:processId/edges`

返回该流程包含的边（通过 `business_processes.edge_ids` 查询 `process_edges`）。

**Response：**

```json
{
  "data": [
    {
      "id": "edge_001",
      "sourceNodeId": "node_001",
      "targetNodeId": "node_002",
      "mappings": [{"source":"orderId","target":"orderId"}],
      "label": null,
      "condition": null,
      "config": {
        "sourceAction": "act_submit_order",
        "targetAction": "act_validate_order"
      }
    }
  ]
}
```

#### 3.5.2 Create Edge

**POST** `/api/v1/projects/:projectId/processes/:processId/edges`

**Request Body：**

```json
{
  "sourceNodeId": "node_001",
  "targetNodeId": "node_002",
  "mappings": [{"source":"orderId","target":"orderId"}],
  "label": null,
  "condition": null,
  "config": {
    "sourceAction": "act_submit_order",
    "targetAction": "act_validate_order"
  }
}
```

**校验规则：**

| 规则 | 错误码 | 说明 |
|------|--------|------|
| sourceNodeId 和 targetNodeId 必须属于该流程 | NODE_NOT_IN_PROCESS | 边两端节点必须在流程内 |
| 同一方向（source→target）只能有一条边 | EDGE_ALREADY_EXISTS | 全局边唯一性 |
| source 和 target 不能相同（暂不允许自环） | SELF_LOOP_NOT_ALLOWED | Phase 1 不允许自环 |

#### 3.5.3 Update Edge

**PUT** `/api/v1/projects/:projectId/processes/:processId/edges/:edgeId`

支持更新 `mappings`/`label`/`condition`/`config`。

#### 3.5.4 Delete Edge

**DELETE** `/api/v1/projects/:projectId/processes/:processId/edges/:edgeId`

直接删除 `process_edges` 记录。

### 3.6 Process Layout API

#### 3.6.1 Get Layout

**GET** `/api/v1/projects/:projectId/processes/:processId/layout`

返回 `process_layouts` 记录。如果不存在，返回默认值：

```json
{
  "data": {
    "processId": "proc_001",
    "orientation": "participant-horizontal",
    "participantLanes": [],
    "customLanes": [],
    "nodePositions": {},
    "laneOverrides": {}
  }
}
```

#### 3.6.2 Update Layout

**PUT** `/api/v1/projects/:projectId/processes/:processId/layout`

**Request Body：**

```json
{
  "orientation": "participant-horizontal",
  "participantLanes": [
    { "participantId": "role_customer", "participantType": "role", "label": "客户", "order": 0, "size": 200 },
    { "participantId": "role_system", "participantType": "role", "label": "系统", "order": 1, "size": 200 }
  ],
  "customLanes": [
    { "id": "lane_init", "name": "initial", "label": "初始阶段", "order": 0, "size": 300 },
    { "id": "lane_trade", "name": "trading", "label": "交易阶段", "order": 1, "size": 300 }
  ],
  "nodePositions": {
    "node_001": { "participantLaneIndex": 0, "customLaneIndex": 0, "offsetX": 50, "offsetY": 30 },
    "node_002": { "participantLaneIndex": 1, "customLaneIndex": 0, "offsetX": 50, "offsetY": 30 }
  },
  "laneOverrides": {}
}
```

**业务逻辑：**
- Upsert 语义：如果不存在则创建，存在则更新
- 校验所有 `nodePositions` 中的 nodeId 必须属于该流程

### 3.7 Validate API

#### 3.7.1 Validate Process

**POST** `/api/v1/projects/:projectId/processes/:processId/validate`

**校验内容：**

| # | 校验项 | 规则 | 错误码 |
|---|--------|------|--------|
| 1 | 多入口 | 1 个或多个 entryNodeIds | MISSING_ENTRY_NODE |
| 2 | 入口有效性 | entryNodeIds 中的每个 ID 必须属于该流程 | INVALID_ENTRY_NODE |
| 3 | DAG 检测 | 流程图不能有环（DFS 检测） | CYCLE_DETECTED |
| 4 | 孤立节点 | 所有节点必须至少有一条入边或出边（entryNode 除外） | ORPHAN_NODE |
| 5 | 边有效性 | 所有边的 source/target 必须属于该流程 | INVALID_EDGE |


**Response：**

```json
// 验证通过
{ "data": { "valid": true, "errors": [] } }

// 验证失败
{
  "data": {
    "valid": false,
    "errors": [
      { "code": "CYCLE_DETECTED", "message": "流程图中存在循环", "details": { "cycle": ["node_001", "node_002", "node_003"] } }
    ]
  }
}
```

---

## 4. 前端组件架构

### 4.1 页面结构

```
/p/:projectId/processes              → 流程列表页
/p/:projectId/processes/:processId   → 流程编辑器（ReactFlow 泳道编辑器）
```

### 4.2 编辑器组件层次

```
ProcessEditorPage
├── ProcessBreadcrumb          // 面包屑：项目 > 流程 > [流程名]
├── ProcessToolbar             // 工具栏：保存、验证、撤销、重做、泳道对调
│   ├── SaveButton
│   ├── ValidateButton
│   ├── SwimlaneSwapButton     // 泳道横向/纵向对调
│   └── ZoomControls
├── SwimlaneFlowEditor         // ReactFlow 画布容器
│   ├── LaneBackground         // 泳道背景层（DOM div）
│   │   ├── ParticipantLanes   // Participant 泳道（固定轴）
│   │   └── CustomLanes        // 自定义泳道（可编辑轴）
│   ├── ReactFlow              // @xyflow/react 画布
│   │   ├── NodeComponents
│   │   │   ├── ActionNode     // 活动节点
│   │   │   └── DecisionNode   // 决策节点
│   │   ├── EdgeComponents
│   │   │   └── FlowEdge       // 流程边（支持标签、条件显示）
│   │   └── ConnectionLine     // 拖拽连线时的预览线
│   └── NodePropertyPanel      // 右侧属性面板（选中节点时显示）
│       ├── ActionNodePanel
│       ├── DecisionNodePanel
│       └── EdgePanel

```

### 4.3 泳道背景层设计

**LaneBackground 组件**：

```typescript
interface LaneBackgroundProps {
  orientation: 'participant-horizontal' | 'participant-vertical';
  participantLanes: ParticipantLane[];
  customLanes: CustomLane[];
  laneOverrides: Record<string, { size: number }>;
  onLaneResize: (laneId: string, newSize: number) => void;
  onLaneReorder: (laneType: 'participant' | 'custom', newOrder: number[]) => void;
}
```

**渲染逻辑：**
1. 计算每个泳道的尺寸（自动计算或 `laneOverrides` 覆盖）
2. 用绝对定位的 div 绘制泳道背景（带边框和标签）
3. ReactFlow 节点位置使用绝对像素坐标（由 `nodePositions` 的相对坐标 + 泳道基准位置计算得出）

### 4.4 节点组件

**ActionNode：**

```
┌─────────────────────────────────┐
│ [Role] 提交订单                 │  ← holderType Badge + displayName
│ submit_order                    │  ← name
│ 输入: userId, productId, qty    │  ← inputs 摘要（来自 actionRef 引用的 Action）
│ 输出: orderId, status           │  ← outputs 摘要
└─────────────────────────────────┘
```

**DecisionNode：**

```
┌─────────────────────────────────┐
│ [Role] 支付结果判断             │
│ pay_result_check                │
│ ┌─────────┐ ┌─────────┐        │
│ │ success │ │ failed  │        │  ← 分支名 Badge
│ └─────────┘ └─────────┘        │
└─────────────────────────────────┘
```

**SubProcessNode：**

```
┌─────────────────────────────────┐
│ ⧉ 支付子流程                    │  ← 子流程图标 + 名称
│ （双击进入子画布）              │
└─────────────────────────────────┘
```

### 4.5 属性面板

**ActionNodePanel：**

| 字段 | 组件 | 说明 |
|------|------|------|
| displayName | Input | 节点显示名称 |
| description | Textarea | 节点描述 |
| holder | Select | 选择参与者（Role/App/ExternalEntity） |
| actionRef | Select | 选择 holder 的 actions[] 中的 Action |
| condition | Input | 守卫条件表达式 |

**DecisionNodePanel：**

| 字段 | 组件 | 说明 |
|------|------|------|
| displayName | Input | 节点显示名称 |
| description | Textarea | 节点描述 |
| holder | Select | 选择参与者 |
| decisionRef | Select | 选择 holder 的 decisions[] 中的 DecisionDef |

**EdgePanel：**

| 字段 | 组件 | 说明 |
|------|------|------|
| label | Input | 边标签 |
| condition | Input | 条件表达式 |
| mappings | MappingEditor | 数据映射编辑器（source output → target input） |

### 4.6 状态管理

使用 React Context + useReducer 管理编辑器状态：

```typescript
interface EditorState {
  // 流程数据
  process: Process;
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  layout: ProcessLayout;
  
  // 编辑器状态
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  viewport: { x: number; y: number; zoom: number };
  
  // 历史记录（用于撤销/重做）
  history: EditorSnapshot[];
  historyIndex: number;
  
  // 子流程栈
  subProcessStack: string[]; // 子流程 ID 栈，用于面包屑和返回
}
```

### 4.7 关键交互行为

| 交互 | 行为 |
|------|------|
| 拖拽节点 | 自由移动，释放时吸附到最近泳道交叉区域 |
| 跨 Participant 泳道拖拽 | 弹出确认对话框："是否将行为迁移到 [目标参与者]？" |
| 跨 Custom 泳道拖拽 | 仅更新 `customLaneIndex`，不触发行为嫁接 |
| 拖拽画边 | ReactFlow 原生 `onConnect`，创建新 Edge |
| 点击"验证"按钮 | 调用 validate API，高亮循环边/孤立节点 |
| 点击"保存"按钮 | 保存 process + nodes + edges + layout |
| 泳道对调按钮 | 切换 orientation，所有节点坐标 x↔y 转换 |

---

## 5. 关键算法

### 5.1 DAG 检测（循环约束）

**算法**：基于 DFS 的环检测

```typescript
function detectCycle(nodes: ProcessNode[], edges: ProcessEdge[]): string[] | null {
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    adj.get(edge.sourceNodeId)!.push(edge.targetNodeId);
  }
  
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];
  
  function dfs(nodeId: string): string[] | null {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);
    
    for (const neighbor of adj.get(nodeId) || []) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor);
        if (cycle) return cycle;
      } else if (recStack.has(neighbor)) {
        // 发现环
        const cycleStart = path.indexOf(neighbor);
        return path.slice(cycleStart);
      }
    }
    
    path.pop();
    recStack.delete(nodeId);
    return null;
  }
  
  for (const nodeId of adj.keys()) {
    if (!visited.has(nodeId)) {
      const cycle = dfs(nodeId);
      if (cycle) return cycle;
    }
  }
  
  return null;
}
```

**时间复杂度**：O(V + E)

### 5.2 泳道布局计算

**输入**：
- `orientation`
- `participantLanes`（已排序）
- `customLanes`（已排序）
- `nodePositions`（相对坐标）
- `laneOverrides`

**输出**：每个节点的绝对像素坐标 `{ x, y }`

```typescript
function calculateNodePosition(
  nodeId: string,
  layout: ProcessLayout,
  nodeSize: { width: number; height: number } = { width: 200, height: 100 }
): { x: number; y: number } {
  const pos = layout.nodePositions[nodeId];
  if (!pos) return { x: 0, y: 0 };
  
  const { participantLaneIndex, customLaneIndex, offsetX, offsetY } = pos;
  
  // 计算泳道基准位置
  let baseX = 0;
  let baseY = 0;
  
  if (layout.orientation === 'participant-horizontal') {
    // Participant 横向排列（上下），Custom 纵向排列（左右）
    baseY = sumLaneSizes(layout.participantLanes, participantLaneIndex, layout.laneOverrides);
    baseX = sumLaneSizes(layout.customLanes, customLaneIndex, layout.laneOverrides);
  } else {
    // Participant 纵向排列（左右），Custom 横向排列（上下）
    baseX = sumLaneSizes(layout.participantLanes, participantLaneIndex, layout.laneOverrides);
    baseY = sumLaneSizes(layout.customLanes, customLaneIndex, layout.laneOverrides);
  }
  
  return {
    x: baseX + offsetX,
    y: baseY + offsetY
  };
}
```

### 5.3 Dagre 初始布局

**使用 `dagre` 库进行初始自动布局：**

```typescript
import dagre from 'dagre';

function applyDagreLayout(
  nodes: ProcessNode[],
  edges: ProcessEdge[],
  nodeSize: { width: number; height: number }
): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  
  for (const node of nodes) {
    g.setNode(node.id, { width: nodeSize.width, height: nodeSize.height });
  }
  
  for (const edge of edges) {
    g.setEdge(edge.sourceNodeId, edge.targetNodeId);
  }
  
  dagre.layout(g);
  
  const positions: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    const dagreNode = g.node(node.id);
    positions[node.id] = { x: dagreNode.x, y: dagreNode.y };
  }
  
  return positions;
}
```

**注意**：Dagre 布局后需要将绝对坐标转换为相对坐标（映射到泳道交叉区域）。

---

## 6. 实现计划

### Phase A：Schema 迁移

| # | 任务 | 文件 |
|---|------|------|
| 1 | 修改 `business_processes` 表（新增 `node_ids`/`edge_ids`） | `packages/api/src/models/schema.ts` |
| 2 | 修改 `process_nodes` 表（删除/新增字段） | `packages/api/src/models/schema.ts` |
| 3 | 新建 `process_layouts` 表 | `packages/api/src/models/schema.ts` |
| 4 | 更新共享类型 | `packages/shared/src/types/process.ts` |
| 5 | 执行 Drizzle migration | `drizzle-kit push` |

### Phase B：后端 API

| # | 任务 | 文件 |
|---|------|------|
| 1 | Process Service | `packages/api/src/services/process.service.ts` |
| 2 | ProcessNode Service | `packages/api/src/services/process-node.service.ts` |
| 3 | ProcessEdge Service | `packages/api/src/services/process-edge.service.ts` |
| 4 | ProcessLayout Service | `packages/api/src/services/process-layout.service.ts` |
| 5 | Process Routes | `packages/api/src/routes/process.ts` |
| 6 | Validate 逻辑（DAG 检测） | `packages/api/src/services/process-validate.service.ts` |

### Phase C：前端实现

| # | 任务 | 文件 |
|---|------|------|
| 1 | Process 列表页 | `packages/web/src/pages/processes/` |
| 2 | SwimlaneFlowEditor 组件 | `packages/web/src/components/flow-editor/` |
| 3 | LaneBackground 组件 | `packages/web/src/components/flow-editor/LaneBackground.tsx` |
| 4 | Node 组件（Action/Decision） | `packages/web/src/components/flow-editor/nodes/` |
| 5 | NodePropertyPanel 组件 | `packages/web/src/components/flow-editor/panels/` |
| 6 | useProcessEditor Hook | `packages/web/src/hooks/use-process-editor.ts` |

### Phase D：API 测试

| # | 任务 | 文件 |
|---|------|------|
| 1 | Process CRUD 测试 | `packages/api/tests/business-process/process.test.ts` |
| 2 | ProcessNode CRUD 测试 | `packages/api/tests/business-process/process-node.test.ts` |
| 3 | ProcessEdge CRUD 测试 | `packages/api/tests/business-process/process-edge.test.ts` |
| 4 | ProcessLayout 测试 | `packages/api/tests/business-process/process-layout.test.ts` |
| 5 | Validate 测试 | `packages/api/tests/business-process/process-validate.test.ts` |

---

## 7. 风险与注意事项

| # | 风险 | 缓解措施 |
|---|------|---------|
| 1 | `process_nodes` 删除 `inputs`/`outputs`/`branches` 字段可能影响已有数据 | Phase 1 尚无生产数据，直接删除；如有测试数据需清理 |
| 2 | ReactFlow 泳道实现复杂度高 | 分阶段实现：先基础画布 → 再泳道背景 → 再交互优化 |
| 3 | 跨泳道拖拽的行为嫁接涉及多个 Service 协调 | 抽取为独立 `behavior-graft.service.ts`，统一处理 |
| 4 | Dagre 布局与手动调整的位置冲突 | 首次加载用 Dagre，之后只保存用户手动调整的位置 |

---

## 8. 附录

### 8.1 类型定义汇总

```typescript
// packages/shared/src/types/process.ts

export type ProcessStatus = 'draft' | 'active' | 'deprecated';
export type NodeType = 'action' | 'decision';
export type HolderType = 'role' | 'external_entity' | 'service';
export type Orientation = 'participant-horizontal' | 'participant-vertical';

export interface BusinessProcess {
  id: string;
  projectId: string;
  name: string;
  displayName: string;
  description: string | null;
  status: ProcessStatus;
  version: number;
  parentProcessId: string | null;
  entryNodeIds: string[];
  exitNodeIds: string[];
  config: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessNode {
  id: string;
  projectId: string;
  nodeType: NodeType;
  name: string;
  displayName: string;
  description: string | null;
  holderType: HolderType;
  holderId: string;
  actionRef: string | null;
  decisionRef: string | null;
  condition: string | null;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessEdge {
  id: string;
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  mappings: Array<{ source: string; target: string }>;
  label: string | null;
  condition: string | null;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessLayout {
  id: string;
  processId: string;
  orientation: Orientation;
  participantLanes: ParticipantLane[];
  customLanes: CustomLane[];
  nodePositions: Record<string, NodePosition>;
  laneOverrides: Record<string, { size: number }>;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantLane {
  participantId: string;
  participantType: HolderType;
  label: string;
  order: number;
  size: number;
}

export interface CustomLane {
  id: string;
  name: string;
  label: string;
  order: number;
  size: number;
}

export interface NodePosition {
  participantLaneIndex: number;
  customLaneIndex: number;
  offsetX: number;
  offsetY: number;
}
```

### 8.2 接口文档

详见 `docs/04-tech-design/openapi-contract-design.md`（本模块的 OpenAPI 规格将在实现后补充）。
