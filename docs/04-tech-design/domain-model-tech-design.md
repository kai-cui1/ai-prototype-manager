# M2 领域模型管理 技术方案设计

> **模块**：M2-领域模型管理
> **步骤**：S4 技术方案设计
> **状态**：draft
> **版本**：v1.1
> **日期**：2026-06-XX
> **v1.1 变更**：关系方向性分类（association 双向，其余四类单向）、唯一性校验分档、平行边视觉分离算法
> **关联文档**：
>   - PRD → `docs/03-prd-ux/modules/domain-model/domain-model-prd.md`
>   - 交互设计 → `docs/03-prd-ux/modules/domain-model/domain-model-interaction.md`
>   - 通用技术方案 → `docs/04-tech-design/phase1-design-tech.md`
>   - 数据库 Schema → `docs/05-data-design/phase1-database-schema.md`
>   - 编码规范总纲 → `docs/04-tech-design/coding-convention.md`

---

## 1. 功能范围

M2 领域模型管理包含 4 个功能点：

| 功能 ID | 名称 | Priority |
|---------|------|:--------:|
| F-M2-01 | 领域实体 CRUD | P0 |
| F-M2-02 | 实体字段管理（含拖拽排序） | P0 |
| F-M2-03 | 实体关系管理 | P0 |
| F-M2-04 | ER 图可视化（ReactFlow 画布 + Inspector）| P0 |

---

## 2. 数据库 Schema

> 复用 `phase1-database-schema.md` 中已定义的 4 张表，此处补充 **变更项**。

### 2.1 表结构（已存在，无需迁移）

| 表名 | 说明 |
|------|------|
| `domain_entities` | 实体主表（含 `category`, `sort_order`）|
| `entity_fields` | 字段表（含 `field_type`, `constraints JSONB`, `sort_order`）|
| `entity_relations` | 关系表。`association` 为双向对称（一条记录代表两端等价）；其余四类为单向（source → target）。唯一索引 `entity_relations_project_source_target_kind_unique` 保持有序三元组，**双向去重由 service 层完成**。|
| `data_flow_metadata` | 数据流向元数据（Phase 1 预留，M2 不实现写入）|

### 2.2 新增变更：节点位置持久化

S3 交互设计决策：用户手动拖拽节点后，位置持久化到数据库。

**变更方案**：在 `domain_entities` 表的 `config JSONB` 字段中嵌套存储画布位置，**不新增列**：

```sql
-- config JSONB 中新增 canvas_position 子键（无需 DDL 变更）
-- 示例值：
{
  "canvas_position": {
    "x": 120,
    "y": 340
  }
}
```

**理由**：
- `domain_entities` 当前无 `config` 列，需补充（原 schema 仅有 `sort_order`）。
- 画布位置属于 UI 元数据而非业务数据，放入 JSONB 扩展字段符合架构规范。
- 避免频繁 DDL 变更。

**DDL 补充**（需在 Drizzle migration 中执行）：

```sql
ALTER TABLE domain_entities ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';
```

---

## 3. API 端点详细规格

> 端点清单已在 `phase1-design-tech.md §5.4` 中定义（18 个端点）。
> 本节补充每个端点的 **Request / Response Schema**。

### 3.1 公共约定

- 所有响应遵循 `{ data: ... }` / `{ data: [...], meta: {...} }` / `{ error: {...} }` 格式
- 路径前缀：`/api/v1/projects/:projectId/domain`
- TypeBox Schema 文件：`packages/validation-schemas/src/domain.schema.ts`
- Drizzle 模型文件：`packages/api/src/models/domain.ts`
- 路由文件：`packages/api/src/routes/domain/`（分 3 个子文件）
- Service 文件：`packages/api/src/services/domain.service.ts`

---

### 3.2 F-M2-01 实体管理（6 个端点）

#### `GET /domain/entities` — 实体列表

**Query 参数**：

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|:----:|------|------|
| `page` | integer | N | 1 | 页码（≥1）|
| `pageSize` | integer | N | 20 | 每页条数（1~100）|
| `search` | string | N | — | 模糊搜索 `name` + `display_name`（ilike）|
| `category` | string | N | — | 按分类筛选（精确匹配）|

**Response 200**：

```typescript
{
  data: EntitySummary[];
  meta: { total: number; page: number; pageSize: number; };
}

interface EntitySummary {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string | null;
  sortOrder: number;
  fieldCount: number;       // 字段数量（聚合统计）
  relationCount: number;    // 关系数量（作为 source 的单向关系数）
  createdAt: string;
  updatedAt: string;
}
```

**实现说明**：
- `fieldCount` / `relationCount` 通过 SQL 子查询或 `count` 聚合获取，**不做 N+1 查询**。
- 排序：默认按 `sort_order ASC, created_at ASC`。

---

#### `POST /domain/entities` — 创建实体

**Request Body**：

```typescript
{
  name: string;           // 必填，编程名称，project 范围内唯一，pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/
  displayName: string;    // 必填，展示名称
  description?: string;   // 可选
  category?: string;      // 可选，自由文本标签
}
```

**Response 201**：`{ data: Entity }`（含新创建实体完整信息，字段列表为空数组）

**错误**：
- `CONFLICT` (409)：`name` 在项目内已存在

---

#### `GET /domain/entities/:entityId` — 实体详情

**Response 200**：

```typescript
{
  data: EntityDetail;
}

interface EntityDetail {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string | null;
  sortOrder: number;
  canvasPosition: { x: number; y: number } | null;  // 来自 config.canvas_position
  fields: Field[];            // 按 sort_order ASC 排序
  outboundRelations: Relation[];  // 以此实体为 source 的关系
  inboundRelations: Relation[];   // 以此实体为 target 的关系
  createdAt: string;
  updatedAt: string;
}
```

**实现说明**：一次查询返回实体 + 字段 + 关系，无需多次请求。

---

#### `PUT /domain/entities/:entityId` — 更新实体

**Request Body**（部分更新，所有字段可选）：

```typescript
{
  displayName?: string;
  description?: string;
  category?: string;
  canvasPosition?: { x: number; y: number } | null;  // null 表示清除位置
}
```

> **注**：`name` 不允许修改（唯一标识，修改会破坏引用）。

**Response 200**：`{ data: EntityDetail }`

---

#### `DELETE /domain/entities/:entityId` — 删除实体

- 级联删除：`entity_fields`、`entity_relations`（source 或 target）、`data_flow_metadata`
- 由 DB 外键 `ON DELETE CASCADE` 保证
- **Response 204**：无 body

---

#### `GET /domain/entities/:entityId/er-graph` — 以实体为中心的局部 ER 图

**Response 200**：

```typescript
{
  data: ERGraphData;
}

interface ERGraphData {
  nodes: ERNode[];
  edges: EREdge[];
}

interface ERNode {
  id: string;
  type: 'entity';
  position?: { x: number; y: number };  // 来自 config.canvas_position
  data: {
    name: string;
    displayName: string;
    category?: string;
    fields: ERNodeField[];
  };
}

interface ERNodeField {
  id: string;
  name: string;
  displayName: string;
  fieldType: string;
  isRequired: boolean;
}

interface EREdge {
  id: string;
  source: string;
  target: string;
  type: 'relation';
  data: {
    relationKind: string;
    targetCardinality: string;
    displayName?: string;
    description?: string;
  };
}
```

**实现说明**：
- `nodes[0]` 为中心实体
- 包含所有与中心实体有直接关系的实体（无论方向）
- `edges` 仅包含 `nodes` 中实体之间的关系
- 此端点主要用于 Inspector 的关系视图，不做全量 ER 图

---

### 3.3 F-M2-01 补充：全量 ER 图（属于关系模块）

#### `GET /domain/relations/graph` — 项目全量 ER 图

路径：`/api/v1/projects/:projectId/domain/relations/graph`

**Response 200**：`{ data: ERGraphData }`（结构同上）

**实现说明**：
- 查询项目下所有实体 + 所有关系
- `nodes` 中 position 来自各实体的 `config.canvas_position`
- 全量返回，Phase 1 不做分页/懒加载（实体数量预期 < 50）

---

### 3.4 F-M2-02 字段管理（6 个端点）

#### `GET /domain/entities/:entityId/fields` — 字段列表

**Response 200**：`{ data: Field[] }`（按 `sort_order ASC`）

```typescript
interface Field {
  id: string;
  entityId: string;
  name: string;
  displayName: string;
  description: string | null;
  fieldType: FieldType;
  isRequired: boolean;
  defaultValue: unknown | null;
  constraints: FieldConstraints;  // 动态结构，见下方
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

type FieldType =
  | 'string' | 'number' | 'boolean' | 'datetime'
  | 'text' | 'enum' | 'email' | 'url' | 'phone';
```

---

#### `POST /domain/entities/:entityId/fields` — 创建字段

**Request Body**：

```typescript
{
  name: string;              // 必填，entity 范围内唯一，pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/
  displayName: string;       // 必填
  description?: string;
  fieldType: FieldType;      // 必填
  isRequired?: boolean;      // 默认 false
  defaultValue?: unknown;    // 可选，JSON 任意类型
  constraints?: FieldConstraints;  // 可选，按 fieldType 校验
}
```

**FieldConstraints 结构（按 fieldType）**：

| fieldType | constraints 字段 |
|-----------|-----------------|
| `string` | `{ maxLength?: number; minLength?: number; pattern?: string }` |
| `number` | `{ min?: number; max?: number; precision?: number }` |
| `boolean` | `{}` |
| `datetime` | `{ format?: 'date' \| 'datetime' \| 'time' }` |
| `text` | `{ maxLength?: number }` |
| `enum` | `{ options: Array<{ value: string; label: string }> }` |
| `email` | `{}` |
| `url` | `{}` |
| `phone` | `{}` |

**Response 201**：`{ data: Field }`

**错误**：
- `CONFLICT` (409)：`name` 在实体内已存在
- `UNPROCESSABLE_ENTITY` (422)：`constraints` 结构与 `fieldType` 不匹配

---

#### `GET /domain/entities/:entityId/fields/:fieldId` — 字段详情

**Response 200**：`{ data: Field }`

---

#### `PUT /domain/entities/:entityId/fields/:fieldId` — 更新字段

**Request Body**（部分更新）：

```typescript
{
  displayName?: string;
  description?: string;
  fieldType?: FieldType;     // 修改类型时，constraints 也需同步传入
  isRequired?: boolean;
  defaultValue?: unknown;
  constraints?: FieldConstraints;
}
```

> **注**：`name` 不允许修改。

**Response 200**：`{ data: Field }`

---

#### `DELETE /domain/entities/:entityId/fields/:fieldId` — 删除字段

- 级联删除 `data_flow_metadata` 中对应 field_id 的记录
- **Response 204**

---

#### `PATCH /domain/entities/:entityId/fields/reorder` — 批量调整字段排序

**Request Body**：

```typescript
{
  orderedIds: string[];  // 该实体下所有字段 ID 的完整排序列表
}
```

**实现说明**：
- 用事务执行：`UPDATE entity_fields SET sort_order = $idx WHERE id = $id AND entity_id = $entityId`
- `orderedIds` 必须包含该实体的全部字段 ID，否则返回 422
- **Response 200**：`{ data: Field[] }`（按新排序返回）

---

### 3.5 F-M2-03 关系管理（4 个端点，不含 graph）

#### `GET /domain/relations` — 关系列表

路径：`/api/v1/projects/:projectId/domain/relations`

**Query 参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `entityId` | string | N | 筛选：source 或 target 为此实体 |
| `page` | integer | N | 分页 |
| `pageSize` | integer | N | 默认 50 |

**Response 200**：`{ data: Relation[]; meta: {...} }`

```typescript
interface Relation {
  id: string;
  projectId: string;
  sourceEntityId: string;
  sourceEntityName: string;
  sourceEntityDisplayName: string;
  targetEntityId: string;
  targetEntityName: string;
  targetEntityDisplayName: string;
  relationKind: 'dependency' | 'aggregation' | 'composition';
  targetCardinality: string;
  displayName: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

#### `POST /domain/relations` — 创建关系

路径：`/api/v1/projects/:projectId/domain/relations`

**Request Body**：

```typescript
{
  sourceEntityId: string;            // 必填
  targetEntityId: string;            // 必填，不能等于 sourceEntityId
  relationKind: 'dependency' | 'aggregation' | 'composition';  // 必填
  targetCardinality?: string;        // 默认 '*'
  displayName?: string;
  description?: string;
}
```

**校验规则**：
- `sourceEntityId` 可以等于 `targetEntityId`（允许自引用）
- **唯一性分档校验**（service 层 SELECT 校验，不依赖 DB 唯一约束抛错）：
  - **对称关系**（`association`）：按无序对 `{source, target} + kind` 判重，查询条件：`(source=A AND target=B) OR (source=B AND target=A)`
  - **非对称关系**（`dependency` / `aggregation` / `composition` / `generalization`）：按有序三元组 `(project_id, source_entity_id, target_entity_id, relation_kind)` 判重
- 建议在 service 层维护常量 `SYMMETRIC_RELATION_KINDS = new Set(['association'])` 统一分档处理
- `sourceEntityId` 和 `targetEntityId` 必须属于当前 `projectId`
- **DB 唯一索引保持不变**（有序三元组），双向去重由 service 层实现；依赖 DB 唯一约束仅作为兜底报错保护

**Response 201**：`{ data: Relation }`

**错误**：
- `CONFLICT` (409)：已存在相同关系（根据 kind 方向性判重：association 无序对，其余有序三元组）
- `UNPROCESSABLE_ENTITY` (422)：实体不属于当前项目 / generalization 缺少 dimension

---

#### `PUT /domain/relations/:relationId` — 更新关系

路径：`/api/v1/projects/:projectId/domain/relations/:relationId`

**Request Body**（部分更新）：

```typescript
{
  targetCardinality?: string;
  displayName?: string;
  description?: string;
}
```

> **注**：`sourceEntityId`、`targetEntityId`、`relationKind` 不允许修改（修改即应删除重建）。

**Response 200**：`{ data: Relation }`

---

#### `DELETE /domain/relations/:relationId` — 删除关系

路径：`/api/v1/projects/:projectId/domain/relations/:relationId`

**Response 204**

---

## 4. 前端架构设计

### 4.1 目录结构

```
packages/web/src/
├── pages/
│   └── DomainModelPage.tsx        # 路由入口，加载 DomainModelEditor
│
└── components/
    └── domain-model/
        ├── DomainModelEditor.tsx       # 编辑器根组件（布局容器）
        ├── Toolbar.tsx                  # 顶部工具栏（视图切换 + 搜索 + 新建）
        ├── canvas/
        │   ├── ERCanvas.tsx             # ReactFlow 画布容器
        │   ├── EntityNode.tsx           # ReactFlow 自定义节点
        │   └── RelationEdge.tsx         # ReactFlow 自定义边
        ├── list/
        │   └── EntityListView.tsx       # 实体列表视图（Table）
        ├── inspector/
        │   ├── Inspector.tsx            # Inspector 容器（右滑面板）
        │   ├── EntityBasicTab.tsx       # Tab-1: 基本信息
        │   ├── FieldsTab.tsx            # Tab-2: 字段管理
        │   ├── RelationsTab.tsx         # Tab-3: 关系管理
        │   └── DraggableFieldList.tsx   # dnd-kit 拖拽排序字段列表
        ├── dialogs/
        │   ├── CreateEntityDialog.tsx   # 新建实体 Dialog
        │   ├── DeleteEntityDialog.tsx   # 删除实体确认 Dialog
        │   ├── FieldDialog.tsx          # 新建/编辑字段 Dialog
        │   ├── RelationDialog.tsx       # 新建/编辑关系 Dialog
        │   └── DeleteRelationDialog.tsx # 删除关系确认 Dialog
        └── forms/
            └── FieldConstraintsForm.tsx # 动态字段约束表单（9 种类型）
```

### 4.2 路由注册

```typescript
// App.tsx 中新增
<Route path="/p/:projectId/domain-model" element={<DomainModelPage />} />
```

### 4.3 状态管理设计

Phase 1 不引入全局状态管理库，使用组合的 `useState` + `useCallback` + Context。

#### 领域模型 Context

```typescript
interface DomainModelContextValue {
  // 数据
  entities: EntitySummary[];
  erGraph: ERGraphData | null;

  // 视图状态
  viewMode: 'graph' | 'list';
  setViewMode: (mode: 'graph' | 'list') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // 选中状态
  selectedEntityId: string | null;
  selectEntity: (id: string | null) => void;

  // 关系绘制模式（§3.1A.6）
  drawRelation: DrawRelationState;
  startDrawRelation: (kind: RelationKind) => void;
  pickDrawRelationEntity: (entityId: string) => void;
  cancelDrawRelation: () => void;

  // 数据操作
  refetchEntities: () => void;
  refetchGraph: () => void;

  // Canvas viewport（ReactFlow 状态上浮，用于 fit 操作）
  fitView: () => void;
}

/**
 * 绘制关系状态机
 * - idle: 未激活绘制模式
 * - awaiting-source: 已选关系 kind，等待选择源实体
 * - awaiting-target: 已锁定源实体，等待选择目标实体
 */
type DrawRelationState =
  | { phase: 'idle' }
  | { phase: 'awaiting-source'; kind: RelationKind }
  | { phase: 'awaiting-target'; kind: RelationKind; sourceEntityId: string };

type RelationKind = 'association' | 'dependency' | 'aggregation' | 'composition' | 'generalization';
```

### 4.4 ReactFlow 集成

#### EntityNode 组件设计

```typescript
interface EntityNodeData {
  name: string;
  displayName: string;
  category?: string;
  fields: ERNodeField[];
  isSelected: boolean;
}

// EntityNode 渲染逻辑：
// 1. 标题栏：按 category 显示背景色（CSS variable）
// 2. 字段列表：最多显示 6 行，超出显示 "+N 个字段"
// 3. 点击节点：调用 selectEntity(node.id)
// 4. 宽度：240px（固定）
```

**Category 颜色 CSS Variables**：

```css
/* 在 index.css 中注册 */
--entity-color-core: #1677ff;
--entity-color-supporting: #8c8c8c;
--entity-color-event: #fa8c16;
--entity-color-default: #08979c;
```

#### RelationEdge 组件设计

```typescript
interface RelationEdgeData {
  relationKind: 'association' | 'dependency' | 'aggregation' | 'composition' | 'generalization';
  sourceCardinality: string;
  targetCardinality: string;
  displayName?: string;
  description?: string;
  dimension?: string | null;
  /** 同一对实体之间的平行边分离用 */
  parallelIndex: number;   // 当前边在分组内的索引 [0, N-1]
  parallelCount: number;   // 分组内总边数 N
}

// 边渲染逻辑：
// - association: 无 marker（无箭头，体现双向对称）
// - dependency: 普通箭头 markerEnd（→）
// - aggregation: 空心菱形 markerEnd（◇）
// - composition: 实心菱形 markerEnd（◆）
// - generalization: 空心三角 markerEnd（△）
// - Hover: 显示 Tooltip（displayName + sourceCardinality:targetCardinality）
// - Click: selectRelation(edge.id) → Inspector 关系详情模式
```

**平行边分离算法**（在 useMemo 中计算 `edges`，向 RelationEdge 传入 `parallelIndex` 与 `parallelCount`）：

```typescript
// 对同一对实体之间的全部关系分组（方向无关）
function groupRelationsByEntityPair(relations: Relation[]): Map<string, Relation[]> {
  const groups = new Map<string, Relation[]>();
  for (const rel of relations) {
    // 方向标准化：无论 source/target 的方向，同一对实体之间的边归为同一组
    const [a, b] = [rel.sourceEntityId, rel.targetEntityId].sort();
    const key = `${a}::${b}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(rel);
  }
  return groups;
}

// 在 RelationEdge 内部：基于贝塞尔中点法向量施加偏移
const PARALLEL_SPACING = 24; // px
const offset = (parallelIndex - (parallelCount - 1) / 2) * PARALLEL_SPACING;
// 若 offset === 0 且 parallelCount === 1，使用默认 getBezierPath；
// 否则基于贝塞尔默认中点 (mx, my) 与切线法向量 (nx, ny)：
//   newMidX = mx + nx * offset;
//   newMidY = my + ny * offset;
// 以起点、新中点、终点三点构造二阶 Bezier。
```

**自环（self-loop）**：source == target 时 `parallelCount` 仍可能 > 1（同一实体自环多种 kind），但自环自己就具备区分弧；本版本自环不应用偏移算法，保持现有默认渲染（Phase 2 再优化）。

#### 节点拖拽位置保存

```typescript
// onNodeDragStop handler（防抖 500ms）
const handleNodeDragStop = useDebouncedCallback(
  async (event: React.MouseEvent, node: Node) => {
    await api.put(`/domain/entities/${node.id}`, {
      canvasPosition: { x: node.position.x, y: node.position.y }
    });
  },
  500
);
```

### 4.5 dnd-kit 字段拖拽排序

```typescript
// DraggableFieldList.tsx 中使用：
import { DndContext, closestCenter, KeyboardSensor, PointerSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';

// onDragEnd handler：
// 1. 计算新 orderedIds
// 2. 乐观更新本地列表顺序
// 3. 调用 PATCH /fields/reorder
// 4. 失败时回滚本地状态 + Toast 错误提示
```

### 4.6 Inspector 交互规格

```typescript
// Inspector 展开条件：
// - selectedEntityId !== null → 展开，宽度 360px
// - selectedEntityId === null → 收起，宽度 0px
// - 动画：CSS transition width 250ms ease-out

// Inspector Tabs：
// Tab-1 "基本信息"：展示/编辑 displayName, description, category
//   - 字段失焦触发 auto-save（PUT /entities/:id）
// Tab-2 "字段(N)"：DraggableFieldList + 新建字段按钮
// Tab-3 "关系(M)"：关系列表 + 新建关系按钮
```

### 4.6A 关系绘制模式技术实现（Draft Relation）

#### 状态存放位置

`DrawRelationState` 存于 `DomainModelContext`（而非 ERCanvas 内部 state），因为需要同时被 **Toolbox**（发起绘制、高亮当前图标）、**ERCanvas**（拦截节点点击、展示提示条）、**EntityNode**（根据 phase 调整 hover 样式）三处读取。

#### 交互流水

```typescript
// 1. Toolbox 关系图标 onClick
const handleRelationIconClick = (kind: RelationKind) => {
  if (drawRelation.phase !== 'idle' && drawRelation.kind === kind) {
    // 再次点击同图标 → 退出
    cancelDrawRelation();
    return;
  }
  if (entities.length < 2) {
    toast.warning('需至少两个实体才能创建关系');
    return;
  }
  startDrawRelation(kind);  // → phase: 'awaiting-source'
};

// 2. ERCanvas onNodeClick 拦截
const handleNodeClick = (event, node) => {
  if (drawRelation.phase !== 'idle') {
    if (node.type !== 'entity') return;  // 领域框忽略
    event.stopPropagation();               // 阻止选中行为
    pickDrawRelationEntity(node.data.entityId);
    return;
  }
  selectEntity(node.data.entityId);  // 正常模式
};

// 3. pickDrawRelationEntity 内部逻辑
const pickDrawRelationEntity = (entityId: string) => {
  if (drawRelation.phase === 'awaiting-source') {
    setDrawRelation({ phase: 'awaiting-target', kind, sourceEntityId: entityId });
  } else if (drawRelation.phase === 'awaiting-target') {
    // 触发预填弹窗，同时保持状态（供 Dialog 读取 preset）
    setRelationDialogPreset({
      sourceEntityId: drawRelation.sourceEntityId,
      targetEntityId: entityId,
      kind: drawRelation.kind,
      targetLocked: true,
    });
    setRelationDialogOpen(true);
    // Dialog onOpenChange(false) 时回调 cancelDrawRelation()
  }
};

// 4. Esc 监听（ERCanvas 层级）
useEffect(() => {
  if (drawRelation.phase === 'idle') return;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cancelDrawRelation();
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [drawRelation.phase]);

// 5. viewMode 切换自动退出
useEffect(() => {
  if (viewMode === 'list' && drawRelation.phase !== 'idle') {
    cancelDrawRelation();
  }
}, [viewMode]);
```

#### RelationDialog preset 参数

```typescript
interface RelationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceEntityId: string;
  relation: Relation | null;                  // null = 新建
  /** 工具箱绘制模式传入的预填项，仅新建时生效 */
  preset?: {
    targetEntityId: string;
    kind: RelationKind;
    /** true = 目标实体不允许修改（表现为 Display，而非 Select） */
    targetLocked: boolean;
  };
}

// 内部：
// - relation 优先级高于 preset（relation 非空时 preset 忽略）
// - preset.targetLocked 控制目标实体渲染：Select vs Display
```

#### PropertyPanel/Toolbox 重渲染优化

因 `drawRelation` 变化会触发 Context 全量重渲染，将 `drawRelation` 拆分为独立的 Context 或使用 `useSyncExternalStore` 隔离；否则实体/领域数据每次切换 phase 都会派经过重渲染（Phase 1 实体数量不大，可先不优化）。

### 4.7 搜索防抖

```typescript
// Toolbar.tsx
const [inputValue, setInputValue] = useState('');
const debouncedSetSearch = useDebouncedCallback(setSearchQuery, 300);

// 图模式：高亮匹配节点，调低未匹配节点的 opacity（0.3）
// 列表模式：过滤表格行
```

---

## 5. TypeBox Schema 设计

文件：`packages/validation-schemas/src/domain.schema.ts`

### 5.1 实体相关 Schema

```typescript
import { Type, Static } from '@sinclair/typebox';

// 创建实体
export const CreateEntitySchema = Type.Object({
  name: Type.String({ pattern: '^[a-zA-Z][a-zA-Z0-9_]*$', minLength: 1, maxLength: 64 }),
  displayName: Type.String({ minLength: 1, maxLength: 128 }),
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  category: Type.Optional(Type.String({ maxLength: 64 })),
});

// 更新实体（部分更新）
export const UpdateEntitySchema = Type.Object({
  displayName: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  category: Type.Optional(Type.Union([Type.String({ maxLength: 64 }), Type.Null()])),
  canvasPosition: Type.Optional(
    Type.Union([
      Type.Object({ x: Type.Number(), y: Type.Number() }),
      Type.Null(),
    ])
  ),
});
```

### 5.2 字段相关 Schema

```typescript
const FieldTypeEnum = Type.Union([
  Type.Literal('string'), Type.Literal('number'), Type.Literal('boolean'),
  Type.Literal('datetime'), Type.Literal('text'), Type.Literal('enum'),
  Type.Literal('email'), Type.Literal('url'), Type.Literal('phone'),
]);

// 约束：使用 Type.Unknown() 存储 JSONB，运行时按 fieldType 二次校验
export const CreateFieldSchema = Type.Object({
  name: Type.String({ pattern: '^[a-zA-Z][a-zA-Z0-9_]*$', minLength: 1, maxLength: 64 }),
  displayName: Type.String({ minLength: 1, maxLength: 128 }),
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  fieldType: FieldTypeEnum,
  isRequired: Type.Optional(Type.Boolean({ default: false })),
  defaultValue: Type.Optional(Type.Unknown()),
  constraints: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

// 字段重排序
export const ReorderFieldsSchema = Type.Object({
  orderedIds: Type.Array(Type.String(), { minItems: 1 }),
});
```

### 5.3 关系相关 Schema

```typescript
const RelationKindEnum = Type.Union([
  Type.Literal('dependency'),
  Type.Literal('aggregation'),
  Type.Literal('composition'),
]);

export const CreateRelationSchema = Type.Object({
  sourceEntityId: Type.String(),
  targetEntityId: Type.String(),
  relationKind: RelationKindEnum,
  targetCardinality: Type.Optional(Type.String({ default: '*' })),
  displayName: Type.Optional(Type.String({ maxLength: 128 })),
  description: Type.Optional(Type.String({ maxLength: 2000 })),
});

export const UpdateRelationSchema = Type.Object({
  targetCardinality: Type.Optional(Type.String()),
  displayName: Type.Optional(Type.Union([Type.String({ maxLength: 128 }), Type.Null()])),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
});
```

---

## 6. Drizzle ORM Schema

文件：`packages/api/src/models/domain.ts`

```typescript
import { pgTable, text, boolean, integer, jsonb, timestamptz, uniqueIndex } from 'drizzle-orm/pg-core';
import { projects } from './project';

export const domainEntities = pgTable('domain_entities', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  category: text('category'),
  sortOrder: integer('sort_order').notNull().default(0),
  config: jsonb('config').default({}),          // 包含 canvas_position
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
}, (t) => ({
  projectNameUniq: uniqueIndex('uniq_entity_project_name').on(t.projectId, t.name),
}));

export const entityFields = pgTable('entity_fields', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  entityId: text('entity_id').notNull().references(() => domainEntities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  fieldType: text('field_type').notNull(),
  isRequired: boolean('is_required').notNull().default(false),
  defaultValue: jsonb('default_value'),
  constraints: jsonb('constraints').default({}),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
}, (t) => ({
  entityNameUniq: uniqueIndex('uniq_field_entity_name').on(t.entityId, t.name),
}));

export const entityRelations = pgTable('entity_relations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sourceEntityId: text('source_entity_id').notNull().references(() => domainEntities.id, { onDelete: 'cascade' }),
  targetEntityId: text('target_entity_id').notNull().references(() => domainEntities.id, { onDelete: 'cascade' }),
  relationKind: text('relation_kind').notNull(),
  targetCardinality: text('target_cardinality').notNull().default('*'),
  displayName: text('display_name'),
  description: text('description'),
  config: jsonb('config').default({}),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
}, (t) => ({
  projSrcTgtKindUniq: uniqueIndex('uniq_relation').on(
    t.projectId, t.sourceEntityId, t.targetEntityId, t.relationKind
  ),
}));
```

---

## 7. 关键技术决策

### 7.1 节点位置存储在 config JSONB

- **决策**：不新增 `canvas_x`, `canvas_y` 列，而是写入 `config.canvas_position`
- **理由**：画布位置属于 UI 元数据，使用扩展字段避免业务表 DDL 污染
- **影响**：查询时用 `config->>'canvas_position'` 提取，Drizzle 层在 Service 中手动映射

### 7.2 字段约束的二次校验

- **决策**：TypeBox Schema 中 `constraints` 用 `Type.Record(Type.String(), Type.Unknown())` 接收，Service 层按 `fieldType` 做二次程序校验
- **理由**：TypeBox 不支持 Discriminated Union 在运行时动态 switch schema
- **实现**：`validateFieldConstraints(fieldType, constraints)` 工具函数，在 Service 创建/更新字段时调用

### 7.3 全量 ER 图 vs 实体详情 ER 图

- **全量 ER 图**（`/domain/relations/graph`）：画布初始渲染，每次 refetch 触发
- **实体级 ER 图**（`/entities/:id/er-graph`）：Inspector 关系 Tab 展示直接关联关系
- **Phase 1 不做缓存**：实体数量预期 <50，全量查询可接受

### 7.4 ReactFlow 节点 ID 与实体 ID 直接对应

- `node.id === entity.id`，简化 Inspector 与 Canvas 的数据同步
- `edge.id === relation.id`

### 7.5 Inspector 与 Canvas 通过 Context 通信

- 选中实体 ID 存储在 `DomainModelContext.selectedEntityId`
- Canvas 的 `onNodeClick` → `selectEntity(id)`
- Inspector 监听 `selectedEntityId` 变化，触发详情 API 请求

### 7.6 前端 npm 包新增依赖

| 包 | 版本 | 用途 |
|----|------|------|
| `@xyflow/react` | 12.x | ReactFlow v12（画布） |
| `@dnd-kit/core` | 6.x | 拖拽排序核心 |
| `@dnd-kit/sortable` | 8.x | 列表拖拽排序 |
| `use-debounce` | 10.x | 防抖 Hook（搜索 + 位置保存）|

> **注**：`@xyflow/react` 是 ReactFlow v12 的新包名（原 `reactflow`）。

---

## 8. 功能点实施顺序

按 **功能依赖关系** 和 **价值优先级** 排序：

| 序 | 功能点 | 说明 |
|---|--------|------|
| 1 | F-M2-01 实体 CRUD（后端） | Service + Route + Schema |
| 2 | F-M2-02 字段管理（后端） | Service + Route + Schema |
| 3 | F-M2-03 关系管理（后端） | Service + Route + Schema |
| 4 | F-M2-04 ER 图数据端点 | `/relations/graph` + `/entities/:id/er-graph` |
| 5 | F-M2-04 前端基础画布 | ReactFlow + EntityNode + RelationEdge |
| 6 | F-M2-04 Inspector | 右滑面板 + 三个 Tab |
| 7 | F-M2-04 字段拖拽排序 | dnd-kit 集成 |
| 8 | F-M2-04 实体列表视图 | Table + 搜索 + 分页 |
| 9 | F-M2-04 节点位置持久化 | onNodeDragStop + PUT /entities |

---

## 9. 与现有架构的集成点

| 集成项 | 说明 |
|--------|------|
| **Sidebar 菜单** | 在 Sidebar 中为项目内路由添加「领域模型」菜单项，图标 `Database`（lucide-react）|
| **ProjectContext** | `DomainModelPage` 通过 `useProjectContext()` 获取 `projectId` |
| **全局错误处理** | 沿用 `api/client.ts` 中的统一 fetch 封装，非 2xx 自动 Toast |
| **Design Token** | 使用 `--entity-color-*` CSS 变量（需在 `index.css` 补充定义）|
| **shadcn/ui 组件** | Sheet（Inspector 面板）、Tabs、Dialog、Button、Input、Select、Badge、Tooltip |

---

## 10. 已知遗留问题与约束

| # | 问题 | 处理 |
|---|------|------|
| 1 | `config` 列需 DDL 迁移 | S6 实施时创建 Drizzle migration |
| 2 | `enum` 字段的 `options` 为必填，但 TypeBox 动态校验无法在 Schema 层表达 | Service 层程序校验 |
| 3 | Phase 1 不支持画布撤销/重做 | 页面刷新恢复，Phase 2+ 考虑 |
| 4 | Inspector 关系创建为 Inspector 选择式（Phase 1），画布拖拽连线延至 Phase 2 | 已在 S3 确认 |
| 5 | 全量 ER 图不分页，实体量大时可能有性能问题 | Phase 1 实体数 <50，可接受；Phase 2 按需优化 |
