# 业务架构 技术方案设计

> **模块**：M4-业务架构
> **状态**：draft
> **版本**：v1.0
> **日期**：2026-06-12
> **作者**：AI/PM
> **关联文档**：
>   - PRD（业务层） → `docs/03-prd-ux/modules/business-architecture/business-architecture-prd.md`
>   - 交互设计 → `docs/03-prd-ux/modules/business-architecture/business-architecture-interaction.md`
>   - 全局技术方案 → `docs/04-tech-design/phase1-design-tech.md`
>   - DB Schema 定义 → `docs/05-data-design/phase1-database-schema.md`（表17、表18）

---

## 1. 技术方案概述

### 1.1 功能定位

M4 业务架构是一个**纯树形分类管理模块**，实现两张表（`business_architectures` + `biz_arch_process_map`）的 CRUD 和关联关系维护，以及一个挂载在 M3 路由下的流程搜索接口（F-M4-08）。

技术复杂度低于 M3（无 Canvas 渲染），主要难点：
1. **DB Schema 变更**：移除 `level` 字段的 CHECK 约束（L1-L4 限制）
2. **路由冲突处理**：F-M4-08 `/processes/search` 必须在 `/:processId` 之前注册
3. **前端树形渲染**：纯 HTML+CSS 树，无 ReactFlow，需要自递归组装

### 1.2 受影响的文件列表

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/api/src/models/schema.ts` | **修改** | 移除 `level` 字段的 `notNull()` + 更新注释 |
| `packages/api/drizzle/migrations/` | **新建** | 迁移文件：ALTER TABLE 移除 level NOT NULL + CHECK 约束 |
| `packages/api/src/routes/process.ts` | **修改** | 新增 `GET /search` 端点（F-M4-08），必须在 `/:processId` 之前注册 |
| `packages/api/src/services/process.service.ts` | **修改** | 新增 `searchProcesses` 服务函数 |
| `packages/api/src/routes/architecture.ts` | **新建** | M4 主路由（10 个端点） |
| `packages/api/src/services/architecture.service.ts` | **新建** | M4 业务逻辑层 |
| `packages/api/src/app.ts` | **修改** | 注册 `architectureRoutes` |
| `packages/validation-schemas/src/architecture.schema.ts` | **新建** | TypeBox Schema 定义 |
| `packages/validation-schemas/src/index.ts` | **修改** | 导出架构 Schema |
| `packages/web/src/pages/BusinessArchitecturePage.tsx` | **新建** | 业务架构主页 |
| `packages/web/src/components/architecture/` | **新建** | 架构树组件目录 |
| `packages/web/src/hooks/useArchitecture.ts` | **新建** | 架构数据管理 Hook |
| `packages/web/src/App.tsx` | **修改** | 新增路由 `/p/:projectId/business-architecture` |
| `packages/web/src/components/layout/Sidebar.tsx` | **修改** | 新增「业务架构」菜单项 |

---

## 2. DB Schema 变更方案

### 2.1 变更内容

**背景**：`business_architectures` 表的 `level` 字段当前在 DB 文档中定义了 `CHECK (level IN ('L1', 'L2', 'L3', 'L4'))` 约束，而 Drizzle Schema 中仅为 `text('level').notNull()`（注释中提到 L1-L4）。

**PRD 决策**：M4 不限制层级深度，`level` 字段失去业务意义，需调整。

**方案**：将 `level` 字段改为**可选字段**（去掉 `notNull()`），保留字段用于 PM 的描述性标注（如"domain" / "subdomain"等自由文本）。不删除字段，保持向后兼容。

### 2.2 Drizzle Schema 修改

```typescript
// 修改前（packages/api/src/models/schema.ts）
level: text('level').notNull(), // L1 | L2 | L3 | L4

// 修改后
// R5 Why: level 字段改为可选，不再限制为 L1-L4 枚举。
//         PM 可自由使用任意描述性文本（如"domain"/"module"），或不填写。
//         Phase 1 决策：架构树层级不限，由 PM 自行决定深度。
level: text('level'),  // 可选描述性标注，不限制格式
```

### 2.3 DB 迁移 SQL

```sql
-- 迁移：移除 business_architectures.level 字段的 NOT NULL 约束
-- 如果 DB 中存在 CHECK 约束需一并移除
ALTER TABLE business_architectures 
  ALTER COLUMN level DROP NOT NULL;

-- 若存在 CHECK 约束（视实际 DB 状态决定是否执行）
-- ALTER TABLE business_architectures 
--   DROP CONSTRAINT IF EXISTS business_architectures_level_check;
```

> **注意**：执行迁移前，使用 `source environments/set-env.sh dev1` 激活环境。

---

## 3. 后端 API 设计

### 3.1 路由前缀与注册

| 路由文件 | 注册前缀 | 说明 |
|---------|---------|------|
| `routes/architecture.ts` | `/api/v1/projects/:projectId/architectures` | M4 主路由 |
| `routes/process.ts`（扩展） | `/api/v1/projects/:projectId/processes` | 新增 `/search` 端点（F-M4-08） |

**app.ts 注册顺序**：

```typescript
// F-M4-08: search 必须在 /:processId 动态路由之前注册，
// 通过在 process.ts 内部路由注册顺序保证（search 路由在文件顶部注册）
await app.register(architectureRoutes, { 
  prefix: '/api/v1/projects/:projectId/architectures' 
});
```

### 3.2 端点清单（M4 完整 11 个）

#### 业务架构·节点（6 个）

| 方法 | 路径 | 说明 | 功能点 |
|------|------|------|--------|
| GET | `/api/v1/projects/:projectId/architectures` | 获取项目下所有架构节点（扁平列表 + 每个节点的关联流程） | F-M4-01 |
| POST | `/api/v1/projects/:projectId/architectures` | 创建架构节点 | F-M4-02 |
| GET | `/api/v1/projects/:projectId/architectures/:archId` | 单个架构节点详情（含关联流程） | F-M4-01 |
| PATCH | `/api/v1/projects/:projectId/architectures/:archId` | 更新架构节点（部分更新） | F-M4-03 |
| DELETE | `/api/v1/projects/:projectId/architectures/:archId` | 删除架构节点（有子节点时返回 409） | F-M4-04 |

#### 业务架构·流程映射（4 个）

| 方法 | 路径 | 说明 | 功能点 |
|------|------|------|--------|
| POST | `/api/v1/projects/:projectId/architectures/:archId/processes` | 关联流程到架构节点 | F-M4-05 |
| DELETE | `/api/v1/projects/:projectId/architectures/:archId/processes/:processId` | 解除流程关联 | F-M4-06 |
| PATCH | `/api/v1/projects/:projectId/architectures/:archId/processes/order` | 调整节点内流程排序 | F-M4-07 |

#### 流程搜索（1 个，挂 M3 路由）

| 方法 | 路径 | 说明 | 功能点 |
|------|------|------|--------|
| GET | `/api/v1/projects/:projectId/processes/search?q=xxx` | 模糊搜索流程（供关联操作使用） | F-M4-08 |

> **注意**：`PATCH /architectures/:archId/processes/order` 路径中 `order` 是静态字符串，
> 必须在 `DELETE /:archId/processes/:processId` **之前**注册，防止 "order" 被当作 processId 解析。

### 3.3 请求/响应 Schema（TypeBox）

#### 架构节点 Schema

```typescript
// packages/validation-schemas/src/architecture.schema.ts

import { Type, Static } from '@sinclair/typebox';
import { IdSchema, TimestampSchema } from './base.js';

// ---- 输入 Schema ----

/** 创建架构节点 */
export const CreateArchitectureInput = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100, pattern: '^[a-z0-9-]+$' }),
  displayName: Type.String({ minLength: 1, maxLength: 100 }),
  description: Type.Optional(Type.String({ maxLength: 500 })),
  parentId: Type.Optional(Type.Union([IdSchema, Type.Null()])),
  level: Type.Optional(Type.String({ maxLength: 50 })), // 可选的描述性标注
});

/** 更新架构节点（PATCH，全部可选） */
export const UpdateArchitectureInput = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 100, pattern: '^[a-z0-9-]+$' })),
  displayName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  level: Type.Optional(Type.Union([Type.String({ maxLength: 50 }), Type.Null()])),
});

/** 关联流程 */
export const AddProcessMappingInput = Type.Object({
  processId: IdSchema,
});

/** 流程排序 */
export const ReorderProcessesInput = Type.Object({
  processIds: Type.Array(IdSchema, { minItems: 1 }),
});

// ---- 路径参数 Schema ----

export const ArchParamSchema = Type.Object({
  projectId: IdSchema,
});

export const ArchNodeParamSchema = Type.Object({
  projectId: IdSchema,
  archId: IdSchema,
});

export const ArchProcessParamSchema = Type.Object({
  projectId: IdSchema,
  archId: IdSchema,
  processId: IdSchema,
});

// ---- 响应体 Schema ----

/** 关联流程的简要信息 */
const ProcessRefSchema = Type.Object({
  processId: IdSchema,
  name: Type.String(),
  displayName: Type.String(),
  status: Type.String(),
  sortOrder: Type.Number(),
});

/** 架构节点详情（含关联流程） */
export const ArchitectureNodeSchema = Type.Object({
  id: IdSchema,
  projectId: IdSchema,
  parentId: Type.Union([IdSchema, Type.Null()]),
  name: Type.String(),
  displayName: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  level: Type.Union([Type.String(), Type.Null()]),
  sortOrder: Type.Number(),
  processes: Type.Array(ProcessRefSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

/** 架构树列表响应 */
export const ArchitectureListResponse = Type.Object({
  data: Type.Array(ArchitectureNodeSchema),
});

/** 架构节点详情响应 */
export const ArchitectureDetailResponse = Type.Object({
  data: ArchitectureNodeSchema,
});

/** 流程映射记录 */
export const ProcessMappingSchema = Type.Object({
  id: IdSchema,
  architectureId: IdSchema,
  processId: IdSchema,
  sortOrder: Type.Number(),
  createdAt: TimestampSchema,
});

export const ProcessMappingResponse = Type.Object({
  data: ProcessMappingSchema,
});

// ---- 流程搜索 Schema（F-M4-08，挂在 process.schema.ts 下）----

export const ProcessSearchQuery = Type.Object({
  q: Type.String({ minLength: 1 }),
});

export const ProcessSearchItem = Type.Object({
  id: IdSchema,
  name: Type.String(),
  displayName: Type.String(),
  status: Type.String(),
});

export const ProcessSearchResponse = Type.Object({
  data: Type.Array(ProcessSearchItem),
});

// ---- 类型推导 ----
export type CreateArchitectureInputType = Static<typeof CreateArchitectureInput>;
export type UpdateArchitectureInputType = Static<typeof UpdateArchitectureInput>;
export type ArchitectureNodeType = Static<typeof ArchitectureNodeSchema>;
export type ProcessSearchItemType = Static<typeof ProcessSearchItem>;
```

---

## 4. 服务层设计

### 4.1 architecture.service.ts 核心函数

```typescript
// 函数签名概要（实现时参考）

/** 获取项目下所有架构节点（扁平列表，每个节点含关联流程） */
async function listArchitectures(projectId: string): Promise<ArchitectureNodeType[]>

/** 获取单个架构节点详情 */
async function getArchitectureById(archId: string, projectId: string): Promise<ArchitectureNodeType>

/** 创建架构节点 */
async function createArchitecture(projectId: string, input: CreateArchitectureInputType): Promise<ArchitectureNodeType>
// 校验：name 唯一性（projectId + name）
// 校验：parentId 有效性（存在且 projectId 一致）

/** 更新架构节点（PATCH 语义） */
async function updateArchitecture(archId: string, projectId: string, input: UpdateArchitectureInputType): Promise<ArchitectureNodeType>
// 校验：name 修改时排除自身做唯一性校验

/** 删除架构节点 */
async function deleteArchitecture(archId: string, projectId: string): Promise<void>
// 校验：有子节点时抛出 AppError(409, 'HAS_CHILDREN', '请先删除子节点')
// DB CASCADE 处理：biz_arch_process_map 级联删除

/** 关联流程到节点 */
async function addProcessMapping(archId: string, processId: string, projectId: string): Promise<ProcessMappingType>
// 校验：流程归属当前 projectId
// 校验：映射是否已存在（UNIQUE 约束保底，业务层提前检查返回友好提示）

/** 解除流程关联 */
async function removeProcessMapping(archId: string, processId: string, projectId: string): Promise<void>

/** 调整节点内流程排序 */
async function reorderProcesses(archId: string, processIds: string[], projectId: string): Promise<void>
// 校验：所有 processId 都在该节点下有映射
// 批量更新 sort_order（index 0→0, index 1→1, ...）
```

### 4.2 process.service.ts 新增函数（F-M4-08）

```typescript
/** 模糊搜索流程（供 M4 关联操作使用） */
async function searchProcesses(
  projectId: string, 
  q: string
): Promise<ProcessSearchItemType[]>
// 实现：ILIKE '%q%' 同时匹配 name 和 displayName（OR）
// 限制：最多返回 20 条，按 displayName ASC 排序
// q 为空时返回空数组（由路由层 Schema 校验 minLength: 1 保证）
```

---

## 5. 路由层关键实现提示

### 5.1 F-M4-08 路由注册顺序（重要！）

```typescript
// packages/api/src/routes/process.ts
// 必须在 GET /:processId 之前注册 GET /search

export default async function processRoutes(app: FastifyInstance) {
  // ✅ 正确：/search 静态路由先注册
  app.get('/search', { schema: { querystring: ProcessSearchQuery, ... } }, searchProcessesHandler);

  // ✅ /:processId 动态路由后注册
  app.get('/:processId', { schema: { params: ProcessParam, ... } }, getProcessHandler);
  // ...
}
```

### 5.2 PATCH /processes/order 路由注册顺序（重要！）

```typescript
// packages/api/src/routes/architecture.ts
// 同理：/processes/order 静态路由必须在 /processes/:processId 动态路由之前

export default async function architectureRoutes(app: FastifyInstance) {
  // ...
  // ✅ 正确：静态路径先注册
  app.patch('/:archId/processes/order', reorderProcessesHandler);
  
  // ✅ 动态路径后注册
  app.delete('/:archId/processes/:processId', removeProcessMappingHandler);
}
```

### 5.3 GET /architectures 返回格式

列表接口一次性返回项目下所有架构节点（无分页），每个节点包含其关联流程：

```typescript
// SQL 查询思路：
// 1. 查 business_architectures WHERE project_id = :projectId ORDER BY sort_order
// 2. 联合查 biz_arch_process_map + business_processes WHERE architectures.id IN (...)
// 3. 在服务层将流程数组聚合到对应节点上
// 注：不在 SQL 层做树形组装，返回扁平列表，前端按 parentId 递归构建树
```

---

## 6. 前端实现方案

### 6.1 目录结构

```
packages/web/src/
├── pages/
│   └── BusinessArchitecturePage.tsx       # 业务架构主页
├── components/
│   └── architecture/
│       ├── ArchitectureTree.tsx            # 树形容器（递归渲染）
│       ├── ArchitectureNode.tsx            # 单个节点行组件
│       ├── NodeInlineForm.tsx              # 内联创建/新增子节点表单
│       ├── NodeEditPopover.tsx             # 编辑节点 Popover
│       ├── NodeDeleteAlert.tsx             # 删除确认 AlertDialog
│       ├── ProcessMappingSection.tsx       # 节点内流程列表 + 关联操作
│       └── ProcessSearchCombobox.tsx       # 流程搜索下拉组件（F-M4-08）
└── hooks/
    └── useArchitecture.ts                  # 架构数据管理 Hook
```

### 6.2 前端树形组装逻辑

后端返回扁平节点列表（含 `parentId`），前端递归组装：

```typescript
// 工具函数（可放在 useArchitecture.ts 或 utils）
type ArchNode = ArchitectureNodeType & { children: ArchNode[] };

function buildTree(nodes: ArchitectureNodeType[], parentId: string | null = null): ArchNode[] {
  return nodes
    .filter(n => n.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(n => ({ ...n, children: buildTree(nodes, n.id) }));
}
```

### 6.3 useArchitecture Hook 职责

```typescript
// 状态
const nodes: ArchitectureNodeType[];   // 扁平列表（来自 API）
const tree: ArchNode[];                // 组装后的树形（useMemo）
const expandedIds: Set<string>;        // 展开节点集合

// 操作
function loadArchitectures(): Promise<void>
function createNode(input: CreateArchitectureInputType): Promise<void>
function updateNode(archId: string, input: UpdateArchitectureInputType): Promise<void>
function deleteNode(archId: string): Promise<void>
function addProcess(archId: string, processId: string): Promise<void>
function removeProcess(archId: string, processId: string): Promise<void>
function reorderProcesses(archId: string, processIds: string[]): Promise<void>
function searchProcesses(q: string): Promise<ProcessSearchItemType[]>
function toggleExpand(archId: string): void
```

### 6.4 ProcessSearchCombobox 实现要点

- 使用 `useState` + `useCallback` 管理搜索状态
- 300ms 防抖（`useDebounce` 或 `setTimeout` 手动实现）
- 调用 `GET /processes/search?q=xxx` 接口
- 结果列表中标记已关联流程（`processes` 数组的 `processId` 集合）为不可点击
- Esc 键关闭（绑定 `onKeyDown`）
- 点击外部关闭（`useClickOutside` 或 `Popover` 原生支持）

---

## 7. 错误处理规范

| 场景 | HTTP 状态码 | 错误码 | 前端处理 |
|------|:----------:|--------|---------|
| 节点不存在 | 404 | `NOT_FOUND` | Toast 错误提示 |
| name 重复 | 409 | `NAME_CONFLICT` | input 下方内联提示 "标识名已被使用" |
| 有子节点禁止删除 | 409 | `HAS_CHILDREN` | Toast "请先删除子节点" |
| 映射已存在 | 409 | `DUPLICATE_MAPPING` | Toast "该流程已关联到此节点" |
| 无效 parentId | 404 | `NOT_FOUND` | Toast 错误提示 |
| 跨项目流程 | 400 | `CROSS_PROJECT` | Toast 错误提示 |
| 排序含无效 processId | 400 | `INVALID_PROCESS_IDS` | Toast 错误提示 |

---

## 8. 验收标准（技术层面）

| # | 验收项 |
|---|--------|
| T-M4-01 | `level` 字段迁移执行后，可成功创建 `level` 为 null 的架构节点 |
| T-M4-02 | `GET /processes/search?q=设备` 返回 name 或 displayName 包含"设备"的流程，不超过 20 条 |
| T-M4-03 | `GET /processes/search?q=` 请求（空 q）返回 400 校验错误（Schema minLength=1 保证） |
| T-M4-04 | 创建 5 层嵌套架构节点（不限层数验证），均成功返回 201 |
| T-M4-05 | 删除有子节点的架构节点返回 409 `HAS_CHILDREN` |
| T-M4-06 | 同一流程关联到两个不同架构节点均成功（多对多验证） |
| T-M4-07 | GET `/architectures` 返回的节点中包含正确的 `processes` 数组（join 查询验证） |
| T-M4-08 | `PATCH /architectures/:archId/processes/order` 不被误解析为流程 ID "order" |

---

## 9. 版本历史

| 版本 | 日期 | 变更要点 |
|------|------|---------|
| v1.0 | 2026-06-12 | 初版；确认 level 字段改为可选；F-M4-08 路由注册顺序警告；11 个端点完整规范；前端目录结构与树形组装方案 |
