# F-M1-12 角色行为管理 — 技术方案设计

> **文档编号**：docs/04-tech-design/role-behavior-design.md
> **状态**：v1.0 draft
> **日期**：2026-06-04
> **定位**：F-M1-12（角色行为管理）的详细技术实施方案，补充 `phase1-design-tech.md`
> **关联文档**：
> - PRD → `docs/03-prd-ux/modules/project-management/project-management-prd-2.md` §4.12
> - 交互设计 → `docs/03-prd-ux/modules/project-management/project-management-interaction.md` §11
> - 领域模型 → `docs/02-domain-model/business-process.md` §2
> - 数据库 Schema → `docs/05-data-design/phase1-database-schema.md` roles 表
> - 编码规范总纲 → `docs/04-tech-design/coding-convention.md`
> - 后端编码细则 → `docs/04-tech-design/coding-convention-backend.md`
> - Phase 1 技术方案 → `docs/04-tech-design/phase1-design-tech.md`

---

## 1. 概述

### 1.1 功能范围

F-M1-12 管理 `roles.actions[]` 和 `roles.decisions[]` 两个 JSONB 内嵌数组，提供 8 个 API 端点（Action CRUD 4 个 + Decision CRUD 4 个）。核心特征：

- **JSONB 子资源模式**：actions/decisions 非独立表，CRUD 采用「读取→校验→变更数组→整体写回」模式
- **角色级乐观锁**：每次 action/decision 变更递增 `roles.version`，防止并发覆盖
- **引用完整性**：删除时检查 `process_nodes` 引用（Phase 1 预留 TODO）
- **F-M1-13 代码复用**：NodeIO / ToolRef / DecisionBranch 校验逻辑抽取为共享 helper

### 1.2 不在本方案范围

| 项目 | 归属 |
|------|------|
| `external_entities.actions[]` / `decisions[]` | F-M1-13（结构相同，API 路径不同） |
| `process_nodes` 的 `action_ref` / `decision_ref` 字段 | M3 业务流程模块 |
| 角色详情页前端实现 | S6 代码实现阶段 |

---

## 2. 架构设计

### 2.1 JSONB 子资源 CRUD 模式

```
┌─────────────────────────────────────────────────────────────┐
│                      Route Layer                             │
│  POST /roles/:roleId/actions        → createActionHandler   │
│  PUT  /roles/:roleId/actions/:id    → updateActionHandler   │
│  ...                                                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Service Layer                              │
│  role-behavior.service.ts                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 1. SELECT roles WHERE id = :roleId (FOR UPDATE 语义) │    │
│  │ 2. 校验项目活跃 + 乐观锁                              │    │
│  │ 3. 解析 JSONB 数组 → TypeScript 对象                  │    │
│  │ 4. 业务规则校验（name 唯一性/NodeIO/Branch 等）        │    │
│  │ 5. 变更数组（增/改/删元素）                            │    │
│  │ 6. UPDATE roles SET actions/decisions = :newArray,    │    │
│  │    version = version + 1 WHERE id = :roleId            │    │
│  │    AND version = :currentVersion                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  behavior-common.ts (共享校验 helper)                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ - validateNodeIOArray()                              │    │
│  │ - validateToolRef()                                  │    │
│  │ - validateBranches()                                 │    │
│  │ - validateNameUniquenessInArray()                    │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     Model Layer                              │
│  roles.actions: jsonb('actions').default('[]')               │
│  roles.decisions: jsonb('decisions').default('[]')           │
│  (无 DDL 变更，列已存在)                                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 文件组织

新增/修改文件清单：

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/api/src/services/role-behavior.service.ts` | **新增** | 8 个 CRUD 函数 + 内部 helper |
| `packages/api/src/services/behavior-common.ts` | **新增** | 共享校验 helper（F-M1-13 复用） |
| `packages/api/src/routes/role-behavior.ts` | **新增** | 8 个端点注册 + handler |
| `packages/validation-schemas/src/role-behavior.schema.ts` | **新增** | TypeBox 校验 Schema |
| `packages/validation-schemas/src/index.ts` | 修改 | 追加 re-export |
| `packages/shared/src/types/organization.ts` | 修改 | Role.actions/decisions 类型精细化 |
| `packages/shared/src/types/role-behavior.ts` | **新增** | RoleAction / DecisionDef / NodeIO / ToolRef 类型定义 |
| `packages/shared/src/types/index.ts` | 修改 | 追加 re-export |
| `packages/api/src/services/common/errors.ts` | 修改 | 追加 F-M1-12 专用错误码 |
| `packages/api/src/app.ts` | 修改 | 注册 role-behavior 路由 |

---

## 3. 共享类型设计

### 3.1 新增 `packages/shared/src/types/role-behavior.ts`

```typescript
// ============================================
// Role Behavior Types — 角色行为管理（F-M1-12 / F-M1-13 共享）
// 对应 PRD: project-management-prd-2.md §4.12
// 对应领域模型: business-process.md §2
// ============================================

/**
 * 参数定义 — Action 的 inputs/outputs 和 DecisionBranch 的 outputs 共用。
 *
 * PRD Reference: B-M1-98 (name 同数组内唯一 + type 必填)
 */
export interface NodeIO {
  name: string;                         // 参数名（同数组内唯一）
  type: string;                         // 数据类型（如 string/number/boolean/datetime）
  description?: string;                 // 参数描述
  required?: boolean;                   // 是否必填（默认 false）
  defaultValue?: unknown;               // 默认值
  constraints?: Record<string, unknown>; // 类型约束
}

/**
 * 执行工具 — 仅 Role/ExternalEntity 的 Action 使用。
 *
 * PRD Reference: B-M1-100
 */
export type ToolRef =
  | null                                                          // 无工具
  | 'email' | 'sms' | 'phone' | 'wechat'                         // 内置通知工具
  | { type: 'page'; applicationType: 'web' | 'android' | 'ios' | 'pc'; pageId: string }  // UI 页面
  | { type: 'custom'; name: string; [key: string]: unknown };     // 自定义工具

/**
 * 行为逻辑。
 *
 * PRD Reference: B-M1-99 (userDesc 必填, data 可选 — 以 PRD 为准)
 */
export interface ActionLogic {
  userDesc: string;   // 自然语言描述（1~2000 字符）
  data?: string;      // JS 代码（0~10000 字符，可选）
}

/**
 * 角色行为（RoleAction）。
 *
 * PRD Reference: B-M1-93~100
 */
export interface RoleAction {
  id: string;                  // 系统生成 UUID v4
  name: string;                // 编程标识符（同 role 的 actions 内唯一）
  displayName: string;         // 显示名称
  description?: string;        // 描述
  inputs: NodeIO[];            // 入参定义
  outputs: NodeIO[];           // 出参定义
  logic: ActionLogic;          // 行为逻辑
  tool: ToolRef;               // 执行工具
}

/**
 * 决策分支定义。
 *
 * PRD Reference: B-M1-116~119
 */
export interface DecisionBranchDef {
  name: string;                // 分支标识（同 Decision 内唯一）
  condition?: string;          // 条件表达式（Phase 1 原始字符串）
  outputs: NodeIO[];           // 分支输出参数
  edgeIds: string[];           // 出口边 ID（Phase 1 必须 = []）
}

/**
 * 决策定义（DecisionDef）。
 *
 * PRD Reference: B-M1-110~119
 */
export interface DecisionDef {
  id: string;                          // 系统生成 UUID v4
  name: string;                        // 编程标识符（同 role 的 decisions 内唯一）
  displayName: string;                 // 显示名称
  description?: string;                // 描述
  branches: DecisionBranchDef[];       // 分支定义（≥2 个）
}
```

### 3.2 修改 `packages/shared/src/types/organization.ts`

将 `Role.actions` 和 `Role.decisions` 从 `unknown[]` 精细化为具体类型：

```typescript
// 修改前
actions: unknown[];
decisions: unknown[];

// 修改后
actions: RoleAction[];
decisions: DecisionDef[];
```

同时更新 `ExternalEntity.actions` 和 `ExternalEntity.decisions` 为相同类型（为 F-M1-13 预留）。

---

## 4. TypeBox 校验 Schema 设计

### 4.1 新增 `packages/validation-schemas/src/role-behavior.schema.ts`

```typescript
/**
 * @module role-behavior.schema
 * @description TypeBox validation schemas for F-M1-12 (Role Behavior Management).
 *              Covers Action CRUD + Decision CRUD for roles.actions/decisions JSONB arrays.
 *
 * PRD Reference: docs/03-prd-ux/modules/project-management/project-management-prd-2.md §4.12
 */
import { Type } from '@sinclair/typebox';
import {
  NameSchema,
  DisplayNameSchema,
  DescriptionSchema,
  VersionSchema,
  IdSchema,
} from './base.js';
import { SuccessEnvelope } from './response.js';

// ============================================================
// Shared Sub-Schemas (F-M1-13 will reuse these)
// ============================================================

/**
 * NodeIO 参数定义。
 *
 * B-M1-98: name 同数组内唯一 + type 必填
 */
export const NodeIOSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 50 }),
  type: Type.String({ minLength: 2, maxLength: 50 }),
  description: Type.Optional(Type.String({ maxLength: 200 })),
  required: Type.Optional(Type.Boolean({ default: false })),
  defaultValue: Type.Optional(Type.Unknown()),
  constraints: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

/**
 * ToolRef 执行工具。
 *
 * B-M1-100: null / 内置枚举 / page / custom
 */
export const ToolRefSchema = Type.Union([
  Type.Null(),
  Type.Literal('email'),
  Type.Literal('sms'),
  Type.Literal('phone'),
  Type.Literal('wechat'),
  Type.Object({
    type: Type.Literal('page'),
    applicationType: Type.Union([
      Type.Literal('web'),
      Type.Literal('android'),
      Type.Literal('ios'),
      Type.Literal('pc'),
    ]),
    pageId: Type.String({ minLength: 1 }),
  }),
  Type.Object({
    type: Type.Literal('custom'),
    name: Type.String({ minLength: 1, maxLength: 100 }),
  }, { additionalProperties: true }),
]);

/**
 * ActionLogic 行为逻辑。
 *
 * B-M1-99: userDesc 必填, data 可选
 */
export const ActionLogicSchema = Type.Object({
  userDesc: Type.String({ minLength: 1, maxLength: 2000 }),
  data: Type.Optional(Type.String({ maxLength: 10000, default: '' })),
});

/**
 * DecisionBranchInput 分支输入（创建/更新 Decision 时使用）。
 *
 * B-M1-116~119: name 必填 + 唯一, condition 可选, edgeIds Phase 1 = []
 */
export const DecisionBranchInputSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 50 }),
  condition: Type.Optional(Type.String({ maxLength: 500 })),
  outputs: Type.Optional(Type.Array(NodeIOSchema, { default: [] })),
  edgeIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }), { default: [] })),
});

// ============================================================
// Action CRUD Schemas
// ============================================================

/** POST /roles/:roleId/actions — Create Action */
export const CreateRoleActionInput = Type.Object({
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String({ maxLength: 500 })),
  inputs: Type.Optional(Type.Array(NodeIOSchema, { default: [] })),
  outputs: Type.Optional(Type.Array(NodeIOSchema, { default: [] })),
  logic: ActionLogicSchema,
  tool: Type.Optional(Type.Union([ToolRefSchema, Type.Null()])),
});

/** PUT /roles/:roleId/actions/:actionId — Update Action */
export const UpdateRoleActionInput = Type.Object({
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String({ maxLength: 500 })),
  inputs: Type.Optional(Type.Array(NodeIOSchema, { default: [] })),
  outputs: Type.Optional(Type.Array(NodeIOSchema, { default: [] })),
  logic: ActionLogicSchema,
  tool: Type.Optional(Type.Union([ToolRefSchema, Type.Null()])),
  version: VersionSchema,
});

// ============================================================
// Decision CRUD Schemas
// ============================================================

/** POST /roles/:roleId/decisions — Create Decision */
export const CreateDecisionInput = Type.Object({
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String({ maxLength: 500 })),
  branches: Type.Array(DecisionBranchInputSchema, { minItems: 2 }),
});

/** PUT /roles/:roleId/decisions/:decisionId — Update Decision */
export const UpdateDecisionInput = Type.Object({
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String({ maxLength: 500 })),
  branches: Type.Array(DecisionBranchInputSchema, { minItems: 2 }),
  version: VersionSchema,
});

// ============================================================
// Response Schemas
// ============================================================

/** Action 响应体（含系统生成的 id） */
export const RoleActionResponse = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String()),
  inputs: Type.Array(NodeIOSchema),
  outputs: Type.Array(NodeIOSchema),
  logic: ActionLogicSchema,
  tool: Type.Optional(Type.Union([ToolRefSchema, Type.Null()])),
});

/** Decision 响应体（含系统生成的 id + branches） */
export const DecisionDefResponse = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String()),
  branches: Type.Array(Type.Object({
    name: Type.String(),
    condition: Type.Optional(Type.String()),
    outputs: Type.Array(NodeIOSchema),
    edgeIds: Type.Array(Type.String()),
  })),
});

/** Action/Decision 创建/更新响应（data + version） */
export const ActionCreateResponse = SuccessEnvelope(Type.Object({
  action: RoleActionResponse,
  version: Type.Number(),
}));

export const ActionUpdateResponse = SuccessEnvelope(Type.Object({
  action: RoleActionResponse,
  version: Type.Number(),
}));

export const ActionListResponse = SuccessEnvelope(Type.Array(RoleActionResponse));

export const DecisionCreateResponse = SuccessEnvelope(Type.Object({
  decision: DecisionDefResponse,
  version: Type.Number(),
}));

export const DecisionUpdateResponse = SuccessEnvelope(Type.Object({
  decision: DecisionDefResponse,
  version: Type.Number(),
}));

export const DecisionListResponse = SuccessEnvelope(Type.Array(DecisionDefResponse));
```

### 4.2 修改 `packages/validation-schemas/src/index.ts`

追加一行 re-export：

```typescript
export * from './role-behavior.schema.js';
```

---

## 5. Service 层设计

### 5.1 新增 `packages/api/src/services/behavior-common.ts`

共享校验 helper，F-M1-13 将复用：

```typescript
/**
 * @module behavior-common
 * @description 角色行为管理（F-M1-12）和外部实体行为管理（F-M1-13）共享的校验 helper。
 *              纯函数风格，不含 DB 访问。
 *
 * PRD Reference: project-management-prd-2.md §4.12.3
 */

import type { NodeIO, ToolRef, DecisionBranchDef } from '@apm/shared';
import { AppError, ERROR_CODES, badRequest, conflict } from './common/errors.js';

// ============================================================
// NodeIO 校验
// ============================================================

/**
 * 校验 NodeIO 数组：每项 name 必填 + type 必填 + 同数组内 name 唯一。
 *
 * B-M1-98: name 同数组内唯一 + type 必填
 */
export function validateNodeIOArray(
  items: NodeIO[],
  fieldPath: string,
): void {
  const seenNames = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.name || item.name.trim() === '') {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
        `${fieldPath}[${i}].name 不能为空`);
    }
    if (!item.type || item.type.trim() === '') {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
        `${fieldPath}[${i}].type 不能为空`);
    }
    if (seenNames.has(item.name)) {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
        `${fieldPath}[${i}].name="${item.name}" 在同数组内重复`);
    }
    seenNames.add(item.name);
  }
}

// ============================================================
// ToolRef 校验
// ============================================================

/** 内置通知工具枚举 */
const BUILTIN_TOOLS = new Set(['email', 'sms', 'phone', 'wechat']);

/**
 * 校验 ToolRef 格式。
 *
 * B-M1-100: null / 内置枚举 / page（需 applicationType + pageId）/ custom（需 name）
 */
export function validateToolRef(tool: unknown): void {
  if (tool === null || tool === undefined) return;

  if (typeof tool === 'string') {
    if (!BUILTIN_TOOLS.has(tool)) {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
        `tool 枚举值 "${tool}" 不合法，允许值: null, email, sms, phone, wechat`);
    }
    return;
  }

  if (typeof tool === 'object' && tool !== null) {
    const t = tool as Record<string, unknown>;
    if (t.type === 'page') {
      if (!t.applicationType || !['web', 'android', 'ios', 'pc'].includes(t.applicationType as string)) {
        throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
          'page 类型 tool 必须包含合法的 applicationType (web/android/ios/pc)');
      }
      if (!t.pageId || typeof t.pageId !== 'string') {
        throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
          'page 类型 tool 必须包含 pageId');
      }
      return;
    }
    if (t.type === 'custom') {
      if (!t.name || typeof t.name !== 'string' || (t.name as string).trim() === '') {
        throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
          'custom 类型 tool 必须包含 name');
      }
      return;
    }
  }

  throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
    'tool 格式不合法，允许: null | email | sms | phone | wechat | {type:"page",...} | {type:"custom",...}');
}

// ============================================================
// DecisionBranch 校验
// ============================================================

/**
 * 校验 Decision branches：≥2 分支 + 分支名唯一 + edgeIds=[]。
 *
 * B-M1-115: ≥2 分支
 * B-M1-116: 分支名唯一
 * B-M1-119: edgeIds Phase 1 = []
 */
export function validateBranches(
  branches: DecisionBranchDef[],
): void {
  if (!branches || branches.length < 2) {
    throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
      `Decision 至少需要 2 个分支，当前 ${branches?.length ?? 0} 个`);
  }

  const seenNames = new Set<string>();
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    if (!branch.name || branch.name.trim() === '') {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
        `branches[${i}].name 不能为空`);
    }
    if (seenNames.has(branch.name)) {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
        `branches[${i}].name="${branch.name}" 在同一 Decision 内重复`);
    }
    seenNames.add(branch.name);

    // B-M1-119: Phase 1 edgeIds 必须为空数组
    if (branch.edgeIds && branch.edgeIds.length > 0) {
      throw badRequest(ERROR_CODES.UNPROCESSABLE_ENTITY,
        `branches[${i}].edgeIds 在 Phase 1 必须为空数组`);
    }

    // 校验分支 outputs
    if (branch.outputs && branch.outputs.length > 0) {
      validateNodeIOArray(branch.outputs, `branches[${i}].outputs`);
    }
  }
}

// ============================================================
// 数组内 name 唯一性校验
// ============================================================

/**
 * 校验 name 在数组内唯一（排除指定 id 的元素，用于更新场景）。
 *
 * B-M1-95: Action name 在同一 role 的 actions 内唯一
 * B-M1-112: Decision name 在同一 role 的 decisions 内唯一
 */
export function validateNameUniquenessInArray(
  items: { id: string; name: string }[],
  newName: string,
  excludeId?: string,
): void {
  const conflict = items.find(
    (item) => item.name === newName && item.id !== excludeId,
  );
  if (conflict) {
    throw conflict(ERROR_CODES.NAME_CONFLICT,
      `name="${newName}" 在同一角色的行为列表中已存在`);
  }
}
```

### 5.2 新增 `packages/api/src/services/role-behavior.service.ts`

```typescript
/**
 * @module role-behavior.service
 * @description 角色行为管理 Service 层（F-M1-12）。
 *              管理 roles.actions[] 和 roles.decisions[] JSONB 数组的 CRUD。
 *
 * 纯函数风格（db 作为首参数），无全局状态依赖。
 * 所有 write 操作需校验项目未归档（B-M1-101/105/108/120/124/127）。
 * JSONB 原子写回 + 角色级乐观锁。
 *
 * PRD Reference: F-M1-12 (§4.12)
 */

import type { Db } from '../db.js';
import { eq, and, sql } from 'drizzle-orm';
import { projects, roles, processNodes } from '../models/schema.js';
import {
  AppError, ERROR_CODES,
  notFound, badRequest, conflict,
} from './common/errors.js';
import {
  validateNodeIOArray,
  validateToolRef,
  validateBranches,
  validateNameUniquenessInArray,
} from './behavior-common.js';
import type {
  RoleAction, DecisionDef, DecisionBranchDef,
} from '@apm/shared';

// ============================================================
// Internal Helpers
// ============================================================

/**
 * 校验项目是否为 active 状态。
 * 复用 organization.service.ts 中的同名函数逻辑。
 */
async function assertProjectActive(db: Db, projectId: string): Promise<void> {
  const [project] = await db
    .select({ status: projects.status })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project || project.status === 'archived') {
    throw badRequest(ERROR_CODES.PROJECT_ARCHIVED, '归档项目不允许修改角色行为');
  }
}

/**
 * 读取角色行并校验存在性。返回角色行（含 actions/decisions JSONB）。
 */
async function getRoleRow(db: Db, roleId: string) {
  const [row] = await db.select().from(roles).where(eq(roles.id, roleId));
  if (!row) {
    throw notFound('Role', roleId);
  }
  return row;
}

/**
 * 校验乐观锁并执行 JSONB 写回。
 * 返回更新后的角色行（包含新 version）。
 */
async function writeBackWithOptimisticLock(
  db: Db,
  roleId: string,
  currentVersion: number,
  updates: { actions?: unknown; decisions?: unknown },
) {
  const setClause: Record<string, unknown> = {
    version: sql`${roles.version} + 1`,
    updatedAt: new Date(),
  };
  if (updates.actions !== undefined) {
    setClause.actions = JSON.stringify(updates.actions);
  }
  if (updates.decisions !== undefined) {
    setClause.decisions = JSON.stringify(updates.decisions);
  }

  const [updated] = await db
    .update(roles)
    .set(setClause)
    .where(and(
      eq(roles.id, roleId),
      eq(roles.version, currentVersion),
    ))
    .returning();

  if (!updated) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  return updated;
}

/**
 * 检查 action/decision 是否被 process_nodes 引用。
 *
 * B-M1-107 / B-M1-126: 删除前检查 process_nodes 表中
 * holder_type='role' AND holder_id=roleId 的行是否引用了该 action/decision。
 *
 * Phase 1 预留：process_nodes 表尚无 action_ref/decision_ref 字段，
 * 此检查暂时跳过，M3 实现后启用。
 */
async function assertNotReferencedByProcessNodes(
  _db: Db,
  _roleId: string,
  _behaviorId: string,
  _behaviorType: 'action' | 'decision',
): Promise<void> {
  // TODO: M3 实现后启用 process_nodes 引用检查
  // 当 process_nodes 表新增 action_ref / decision_ref 字段后，
  // 查询是否存在 holder_type='role' AND holder_id=roleId
  // AND (action_ref=behaviorId OR decision_ref=behaviorId) 的行
  // 若存在，throw conflict(ERROR_CODES.ENTITY_IN_USE, '该行为正被流程节点引用')
}

// ============================================================
// F-M1-12: Action CRUD
// ============================================================

/**
 * 查询角色的 actions 数组。
 *
 * B-M1-91: 按 JSONB 数组原始顺序返回
 * B-M1-92: 归档项目仍可查询
 */
export async function listActions(
  db: Db,
  roleId: string,
): Promise<{ data: RoleAction[] }> {
  const row = await getRoleRow(db, roleId);
  return { data: (row.actions as RoleAction[] | null) ?? [] };
}

/**
 * 创建新 Action。
 *
 * B-M1-93: id 由系统生成（UUID v4）
 * B-M1-95: name 在同一 role 的 actions 内唯一
 * B-M1-98: NodeIO 校验
 * B-M1-99: logic 校验
 * B-M1-100: ToolRef 校验
 * B-M1-101: 项目必须活跃
 * B-M1-106: 乐观锁
 */
export async function createAction(
  db: Db,
  roleId: string,
  input: Record<string, unknown>,
): Promise<{ action: RoleAction; version: number }> {
  const row = await getRoleRow(db, roleId);
  await assertProjectActive(db, row.projectId);

  // B-M1-106: 乐观锁校验
  if (input.version !== undefined && input.version !== row.version) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  const actions = (row.actions as RoleAction[] | null) ?? [];
  const newName = input.name as string;

  // B-M1-95: name 唯一性
  validateNameUniquenessInArray(actions, newName);

  // B-M1-98: NodeIO 校验
  const inputs = (input.inputs as RoleAction['inputs'] | undefined) ?? [];
  const outputs = (input.outputs as RoleAction['outputs'] | undefined) ?? [];
  validateNodeIOArray(inputs, 'inputs');
  validateNodeIOArray(outputs, 'outputs');

  // B-M1-100: ToolRef 校验
  validateToolRef(input.tool ?? null);

  // 构造新 Action 对象
  const newAction: RoleAction = {
    id: crypto.randomUUID(),
    name: newName,
    displayName: input.displayName as string,
    description: (input.description as string | undefined) ?? undefined,
    inputs,
    outputs,
    logic: input.logic as RoleAction['logic'],
    tool: (input.tool as ToolRef | undefined) ?? null,
  };

  // 追加到数组并写回
  const updatedRow = await writeBackWithOptimisticLock(db, roleId, row.version, {
    actions: [...actions, newAction],
  });

  return { action: newAction, version: updatedRow.version };
}

/**
 * 更新已有 Action。
 *
 * B-M1-102: id 不可变更
 * B-M1-103: name 格式/唯一性排除自身
 * B-M1-106: 乐观锁
 * B-M1-105: 项目必须活跃
 */
export async function updateAction(
  db: Db,
  roleId: string,
  actionId: string,
  input: Record<string, unknown>,
): Promise<{ action: RoleAction; version: number }> {
  const row = await getRoleRow(db, roleId);
  await assertProjectActive(db, row.projectId);

  // B-M1-106: 乐观锁
  const version = input.version as number;
  if (version !== row.version) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  const actions = (row.actions as RoleAction[] | null) ?? [];
  const idx = actions.findIndex((a) => a.id === actionId);

  // B-M1-109: Action 不存在
  if (idx === -1) {
    throw notFound('Action', actionId);
  }

  const newName = input.name as string;

  // B-M1-103: name 唯一性排除自身
  validateNameUniquenessInArray(actions, newName, actionId);

  // B-M1-98: NodeIO 校验
  const updatedInputs = (input.inputs as RoleAction['inputs'] | undefined) ?? actions[idx].inputs;
  const updatedOutputs = (input.outputs as RoleAction['outputs'] | undefined) ?? actions[idx].outputs;
  validateNodeIOArray(updatedInputs, 'inputs');
  validateNodeIOArray(updatedOutputs, 'outputs');

  // B-M1-100: ToolRef 校验
  validateToolRef(input.tool ?? null);

  // 构造更新后的 Action
  const updatedAction: RoleAction = {
    ...actions[idx],
    name: newName,
    displayName: input.displayName as string,
    description: (input.description as string | undefined) ?? undefined,
    inputs: updatedInputs,
    outputs: updatedOutputs,
    logic: input.logic as RoleAction['logic'],
    tool: (input.tool as ToolRef | undefined) ?? null,
  };

  // 替换数组中对应元素并写回
  const newActions = [...actions];
  newActions[idx] = updatedAction;
  const updatedRow = await writeBackWithOptimisticLock(db, roleId, row.version, {
    actions: newActions,
  });

  return { action: updatedAction, version: updatedRow.version };
}

/**
 * 删除已有 Action。
 *
 * B-M1-107: process_nodes 引用检查（Phase 1 TODO）
 * B-M1-108: 项目必须活跃
 * B-M1-109: Action 不存在 → 404
 */
export async function deleteAction(
  db: Db,
  roleId: string,
  actionId: string,
): Promise<void> {
  const row = await getRoleRow(db, roleId);
  await assertProjectActive(db, row.projectId);

  const actions = (row.actions as RoleAction[] | null) ?? [];
  const idx = actions.findIndex((a) => a.id === actionId);

  if (idx === -1) {
    throw notFound('Action', actionId);
  }

  // B-M1-107: 引用完整性检查
  await assertNotReferencedByProcessNodes(db, roleId, actionId, 'action');

  // 移除元素并写回（无需乐观锁 — 删除操作无 body version）
  const newActions = actions.filter((a) => a.id !== actionId);
  await db
    .update(roles)
    .set({
      actions: JSON.stringify(newActions),
      version: sql`${roles.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(roles.id, roleId));
}

// ============================================================
// F-M1-12: Decision CRUD
// ============================================================

/**
 * 查询角色的 decisions 数组。
 *
 * B-M1-91: 按 JSONB 数组原始顺序返回
 * B-M1-92: 归档项目仍可查询
 */
export async function listDecisions(
  db: Db,
  roleId: string,
): Promise<{ data: DecisionDef[] }> {
  const row = await getRoleRow(db, roleId);
  return { data: (row.decisions as DecisionDef[] | null) ?? [] };
}

/**
 * 创建新 Decision。
 *
 * B-M1-110: id 由系统生成
 * B-M1-112: name 在同一 role 的 decisions 内唯一
 * B-M1-115: branches ≥ 2
 * B-M1-116~119: branch 校验
 * B-M1-120: 项目必须活跃
 * B-M1-125: 乐观锁
 */
export async function createDecision(
  db: Db,
  roleId: string,
  input: Record<string, unknown>,
): Promise<{ decision: DecisionDef; version: number }> {
  const row = await getRoleRow(db, roleId);
  await assertProjectActive(db, row.projectId);

  // B-M1-125: 乐观锁
  if (input.version !== undefined && input.version !== row.version) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  const decisions = (row.decisions as DecisionDef[] | null) ?? [];
  const newName = input.name as string;

  // B-M1-112: name 唯一性
  validateNameUniquenessInArray(decisions, newName);

  // B-M1-115~119: branches 校验
  const branches = (input.branches as DecisionBranchDef[] | undefined) ?? [];
  validateBranches(branches);

  // 构造新 Decision 对象
  const newDecision: DecisionDef = {
    id: crypto.randomUUID(),
    name: newName,
    displayName: input.displayName as string,
    description: (input.description as string | undefined) ?? undefined,
    branches,
  };

  // 追加到数组并写回
  const updatedRow = await writeBackWithOptimisticLock(db, roleId, row.version, {
    decisions: [...decisions, newDecision],
  });

  return { decision: newDecision, version: updatedRow.version };
}

/**
 * 更新已有 Decision。
 *
 * B-M1-121: id 不可变更
 * B-M1-122: name 格式/唯一性排除自身
 * B-M1-123: 其余规则同创建
 * B-M1-124: 项目必须活跃
 * B-M1-125: 乐观锁
 */
export async function updateDecision(
  db: Db,
  roleId: string,
  decisionId: string,
  input: Record<string, unknown>,
): Promise<{ decision: DecisionDef; version: number }> {
  const row = await getRoleRow(db, roleId);
  await assertProjectActive(db, row.projectId);

  // B-M1-125: 乐观锁
  const version = input.version as number;
  if (version !== row.version) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被他人修改，请刷新后重试');
  }

  const decisions = (row.decisions as DecisionDef[] | null) ?? [];
  const idx = decisions.findIndex((d) => d.id === decisionId);

  // B-M1-128: Decision 不存在
  if (idx === -1) {
    throw notFound('Decision', decisionId);
  }

  const newName = input.name as string;

  // B-M1-122: name 唯一性排除自身
  validateNameUniquenessInArray(decisions, newName, decisionId);

  // B-M1-115~119: branches 校验
  const branches = (input.branches as DecisionBranchDef[] | undefined) ?? decisions[idx].branches;
  validateBranches(branches);

  // 构造更新后的 Decision
  const updatedDecision: DecisionDef = {
    ...decisions[idx],
    name: newName,
    displayName: input.displayName as string,
    description: (input.description as string | undefined) ?? undefined,
    branches,
  };

  // 替换数组中对应元素并写回
  const newDecisions = [...decisions];
  newDecisions[idx] = updatedDecision;
  const updatedRow = await writeBackWithOptimisticLock(db, roleId, row.version, {
    decisions: newDecisions,
  });

  return { decision: updatedDecision, version: updatedRow.version };
}

/**
 * 删除已有 Decision。
 *
 * B-M1-126: process_nodes 引用检查（Phase 1 TODO）
 * B-M1-127: 项目必须活跃
 * B-M1-128: Decision 不存在 → 404
 */
export async function deleteDecision(
  db: Db,
  roleId: string,
  decisionId: string,
): Promise<void> {
  const row = await getRoleRow(db, roleId);
  await assertProjectActive(db, row.projectId);

  const decisions = (row.decisions as DecisionDef[] | null) ?? [];
  const idx = decisions.findIndex((d) => d.id === decisionId);

  if (idx === -1) {
    throw notFound('Decision', decisionId);
  }

  // B-M1-126: 引用完整性检查
  await assertNotReferencedByProcessNodes(db, roleId, decisionId, 'decision');

  // 移除元素并写回
  const newDecisions = decisions.filter((d) => d.id !== decisionId);
  await db
    .update(roles)
    .set({
      decisions: JSON.stringify(newDecisions),
      version: sql`${roles.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(roles.id, roleId));
}
```

---

## 6. Route 层设计

### 6.1 新增 `packages/api/src/routes/role-behavior.ts`

```typescript
/**
 * @module routes/role-behavior
 * @description 角色行为管理路由：Action CRUD + Decision CRUD (F-M1-12)。
 *              Fastify 插件形式注册，前缀 /api/v1/projects/:projectId/roles/:roleId。
 *              使用 Fastify 原生 schema 进行请求校验。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '../db.js';
import * as behaviorService from '../services/role-behavior.service.js';
import {
  CreateRoleActionInput,
  UpdateRoleActionInput,
  CreateDecisionInput,
  UpdateDecisionInput,
  IdSchema,
  ErrorResponse,
  DeleteResponse,
  ActionListResponse,
  ActionCreateResponse,
  ActionUpdateResponse,
  DecisionListResponse,
  DecisionCreateResponse,
  DecisionUpdateResponse,
} from '@apm/validation-schemas';

/** 复用的 path param schema */
const RoleIdParam = Type.Object({ roleId: IdSchema });
const ActionIdParam = Type.Object({ roleId: IdSchema, actionId: IdSchema });
const DecisionIdParam = Type.Object({ roleId: IdSchema, decisionId: IdSchema });

export default async function roleBehaviorRoutes(app: FastifyInstance) {
  // ================================================================
  // Action CRUD (F-M1-12)
  // ================================================================

  // GET /roles/:roleId/actions — 查询 Action 列表
  app.get('/actions', {
    schema: {
      params: RoleIdParam,
      response: { 200: ActionListResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Role Behavior'],
      summary: '查询角色的 Action 列表',
      description: 'B-M1-91(原序返回) / B-M1-92(归档可查)',
    },
  }, listActionsHandler);

  // POST /roles/:roleId/actions — 创建 Action
  app.post('/actions', {
    schema: {
      params: RoleIdParam,
      body: CreateRoleActionInput,
      response: {
        201: ActionCreateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Role Behavior'],
      summary: '创建 Action',
      description: 'B-M1-93~101',
    },
  }, createActionHandler);

  // PUT /roles/:roleId/actions/:actionId — 更新 Action
  app.put('/actions/:actionId', {
    schema: {
      params: ActionIdParam,
      body: UpdateRoleActionInput,
      response: {
        200: ActionUpdateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Role Behavior'],
      summary: '更新 Action',
      description: 'B-M1-102~106',
    },
  }, updateActionHandler);

  // DELETE /roles/:roleId/actions/:actionId — 删除 Action
  app.delete('/actions/:actionId', {
    schema: {
      params: ActionIdParam,
      response: {
        200: DeleteResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Role Behavior'],
      summary: '删除 Action',
      description: 'B-M1-107~109',
    },
  }, deleteActionHandler);

  // ================================================================
  // Decision CRUD (F-M1-12)
  // ================================================================

  // GET /roles/:roleId/decisions — 查询 Decision 列表
  app.get('/decisions', {
    schema: {
      params: RoleIdParam,
      response: { 200: DecisionListResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Role Behavior'],
      summary: '查询角色的 Decision 列表',
      description: 'B-M1-91(原序返回) / B-M1-92(归档可查)',
    },
  }, listDecisionsHandler);

  // POST /roles/:roleId/decisions — 创建 Decision
  app.post('/decisions', {
    schema: {
      params: RoleIdParam,
      body: CreateDecisionInput,
      response: {
        201: DecisionCreateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Role Behavior'],
      summary: '创建 Decision',
      description: 'B-M1-110~120',
    },
  }, createDecisionHandler);

  // PUT /roles/:roleId/decisions/:decisionId — 更新 Decision
  app.put('/decisions/:decisionId', {
    schema: {
      params: DecisionIdParam,
      body: UpdateDecisionInput,
      response: {
        200: DecisionUpdateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Role Behavior'],
      summary: '更新 Decision',
      description: 'B-M1-121~125',
    },
  }, updateDecisionHandler);

  // DELETE /roles/:roleId/decisions/:decisionId — 删除 Decision
  app.delete('/decisions/:decisionId', {
    schema: {
      params: DecisionIdParam,
      response: {
        200: DeleteResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Role Behavior'],
      summary: '删除 Decision',
      description: 'B-M1-126~128',
    },
  }, deleteDecisionHandler);
}

// ============================================================
// Route Handlers
// ============================================================

async function listActionsHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { roleId } = request.params as { roleId: string };
  return behaviorService.listActions(db, roleId);
}

async function createActionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { roleId } = request.params as { roleId: string };
  const body = request.body as Record<string, unknown>;
  const result = await behaviorService.createAction(db, roleId, body);
  reply.status(201);
  return { data: result };
}

async function updateActionHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { roleId, actionId } = request.params as { roleId: string; actionId: string };
  const body = request.body as Record<string, unknown>;
  const result = await behaviorService.updateAction(db, roleId, actionId, body);
  return { data: result };
}

async function deleteActionHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { roleId, actionId } = request.params as { roleId: string; actionId: string };
  await behaviorService.deleteAction(db, roleId, actionId);
  return { success: true };
}

async function listDecisionsHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { roleId } = request.params as { roleId: string };
  return behaviorService.listDecisions(db, roleId);
}

async function createDecisionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { roleId } = request.params as { roleId: string };
  const body = request.body as Record<string, unknown>;
  const result = await behaviorService.createDecision(db, roleId, body);
  reply.status(201);
  return { data: result };
}

async function updateDecisionHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { roleId, decisionId } = request.params as { roleId: string; decisionId: string };
  const body = request.body as Record<string, unknown>;
  const result = await behaviorService.updateDecision(db, roleId, decisionId, body);
  return { data: result };
}

async function deleteDecisionHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { roleId, decisionId } = request.params as { roleId: string; decisionId: string };
  await behaviorService.deleteDecision(db, roleId, decisionId);
  return { success: true };
}
```

### 6.2 修改 `packages/api/src/app.ts`

在路由注册点追加：

```typescript
// M1 补充: 角色行为管理（F-M1-12 Actions/Decisions CRUD）
import roleBehaviorRoutes from './routes/role-behavior.js';
await app.register(roleBehaviorRoutes, { prefix: '/api/v1/projects/:projectId/roles/:roleId' });
```

---

## 7. API 端点规范

### 7.1 完整端点清单

| # | 方法 | 路径 | 说明 | Handler |
|---|------|------|------|---------|
| 1 | GET | `/api/v1/projects/:projectId/roles/:roleId/actions` | 查询 Action 列表 | listActionsHandler |
| 2 | POST | `/api/v1/projects/:projectId/roles/:roleId/actions` | 创建 Action | createActionHandler |
| 3 | PUT | `/api/v1/projects/:projectId/roles/:roleId/actions/:actionId` | 更新 Action | updateActionHandler |
| 4 | DELETE | `/api/v1/projects/:projectId/roles/:roleId/actions/:actionId` | 删除 Action | deleteActionHandler |
| 5 | GET | `/api/v1/projects/:projectId/roles/:roleId/decisions` | 查询 Decision 列表 | listDecisionsHandler |
| 6 | POST | `/api/v1/projects/:projectId/roles/:roleId/decisions` | 创建 Decision | createDecisionHandler |
| 7 | PUT | `/api/v1/projects/:projectId/roles/:roleId/decisions/:decisionId` | 更新 Decision | updateDecisionHandler |
| 8 | DELETE | `/api/v1/projects/:projectId/roles/:roleId/decisions/:decisionId` | 删除 Decision | deleteDecisionHandler |

### 7.2 响应格式

**列表查询（GET）**：
```json
{ "data": [ ...RoleAction[] ] }
{ "data": [ ...DecisionDef[] ] }
```

**创建（POST → 201）**：
```json
{ "data": { "action": { ...RoleAction }, "version": 3 } }
{ "data": { "decision": { ...DecisionDef }, "version": 3 } }
```

**更新（PUT → 200）**：
```json
{ "data": { "action": { ...RoleAction }, "version": 4 } }
{ "data": { "decision": { ...DecisionDef }, "version": 4 } }
```

**删除（DELETE → 200）**：
```json
{ "success": true }
```

### 7.3 错误码映射

| 场景 | HTTP | 错误码 | 说明 |
|------|------|--------|------|
| Action/Decision 不存在 | 404 | `NOT_FOUND` | 数组中未找到指定 id |
| name 同角色内冲突 | 409 | `NAME_CONFLICT` | 同 role 的行为列表中已存在 |
| 项目已归档 | 400 | `PROJECT_ARCHIVED` | 归档项目禁止写操作 |
| 乐观锁冲突 | 409 | `VERSION_CONFLICT` | 并发修改冲突 |
| NodeIO 校验失败 | 400 | `UNPROCESSABLE_ENTITY` | name/type 缺失或 name 重复 |
| ToolRef 格式非法 | 400 | `UNPROCESSABLE_ENTITY` | 非法枚举值或对象结构不完整 |
| Branch < 2 | 400 | `UNPROCESSABLE_ENTITY` | Decision 至少需要 2 个分支 |
| Branch name 重复 | 400 | `UNPROCESSABLE_ENTITY` | 同 Decision 内分支名冲突 |
| edgeIds 非空 | 400 | `UNPROCESSABLE_ENTITY` | Phase 1 不允许非空 edgeIds |
| Action/Decision 被流程引用 | 409 | `ENTITY_IN_USE` | 需先解除引用（Phase 1 预留） |

---

## 8. 乐观锁实现细节

### 8.1 JSONB 写回的乐观锁策略

由于 actions/decisions 是 JSONB 内嵌数组而非独立表行，无法对单个数组元素加锁。采用 **角色行级乐观锁**：

1. **读取阶段**：`SELECT * FROM roles WHERE id = :roleId` 获取当前 `version` 和 `actions`/`decisions` JSONB
2. **校验阶段**：在内存中解析 JSONB → TypeScript 对象，执行业务规则校验
3. **写回阶段**：`UPDATE roles SET actions = :newActions, version = version + 1 WHERE id = :roleId AND version = :currentVersion`
4. **冲突检测**：若 `UPDATE` 影响 0 行，说明版本已被其他请求修改，抛出 `VERSION_CONFLICT`

### 8.2 删除操作的乐观锁

PRD 中 Delete Action/Decision 的请求不含 `version` 字段（仅 URL path 中的 actionId/decisionId）。但为保持一致性，删除操作仍递增 `roles.version`。

**设计决策**：删除不强制客户端传 version（删除是幂等操作，无 version 时执行 last-write-wins），但递增 version 以保证后续 Update 操作的乐观锁正确性。

---

## 9. process_nodes 引用检查（Phase 1 预留）

### 9.1 当前状态

`process_nodes` 表当前 Schema 不含 `action_ref` / `decision_ref` 字段。这些字段将在 M3 业务流程模块中新增，用于关联流程节点与角色的具体行为/决策。

### 9.2 Phase 1 实现

在 `role-behavior.service.ts` 中，`assertNotReferencedByProcessNodes()` 函数体为空，仅标注 `TODO`：

```typescript
async function assertNotReferencedByProcessNodes(
  _db: Db,
  _roleId: string,
  _behaviorId: string,
  _behaviorType: 'action' | 'decision',
): Promise<void> {
  // TODO: M3 实现后启用 process_nodes 引用检查
  // 当 process_nodes 表新增 action_ref / decision_ref 字段后，
  // 查询是否存在 holder_type='role' AND holder_id=roleId
  // AND (action_ref=behaviorId OR decision_ref=behaviorId) 的行
  // 若存在，throw conflict(ERROR_CODES.ENTITY_IN_USE, '该行为正被流程节点引用')
}
```

### 9.3 M3 启用后的预期实现

```typescript
async function assertNotReferencedByProcessNodes(
  db: Db,
  roleId: string,
  behaviorId: string,
  behaviorType: 'action' | 'decision',
): Promise<void> {
  const refColumn = behaviorType === 'action'
    ? processNodes.actionRef
    : processNodes.decisionRef;

  const [ref] = await db
    .select({ id: processNodes.id })
    .from(processNodes)
    .where(and(
      eq(processNodes.holderType, 'role'),
      eq(processNodes.holderId, roleId),
      eq(refColumn, behaviorId),
    ));

  if (ref) {
    throw conflict(
      ERROR_CODES.ENTITY_IN_USE,
      `该${behaviorType === 'action' ? '行为' : '决策'}正被流程节点引用，无法删除`,
    );
  }
}
```

---

## 10. 前端技术设计

### 10.1 路由设计

| 路由路径 | 组件 | 说明 |
|---------|------|------|
| `/p/:projectId/roles/:roleId` | `RoleDetailPage` | 角色详情页（Actions/Decisions 双 Tab） |

### 10.2 组件树

```
RoleDetailPage
├── RoleHeader                    # 角色名称 + 返回按钮
├── Tabs                          # Actions / Decisions 切换
│   ├── ActionsTab
│   │   ├── ActionCardList        # Action 卡片网格
│   │   │   └── ActionCard        # 单个 Action 卡片（点击编辑）
│   │   ├── AddActionButton       # "添加行为" 按钮
│   │   └── ActionDialog          # 创建/编辑 Action Dialog
│   │       ├── NodeIOEditor      # inputs/outputs 动态行编辑器
│   │       ├── LogicEditor       # userDesc + data (code)
│   │       └── ToolRefSelector   # 工具选择下拉 + 条件字段
│   └── DecisionsTab
│       ├── DecisionCardList      # Decision 卡片网格
│       │   └── DecisionCard      # 单个 Decision 卡片
│       ├── AddDecisionButton     # "添加决策" 按钮
│       └── DecisionDialog        # 创建/编辑 Decision Dialog
│           └── BranchEditor      # 可折叠分支列表编辑器
│               └── NodeIOEditor  # 分支 outputs（复用）
└── DeleteConfirmDialog           # 删除确认 AlertDialog
```

### 10.3 API 调用封装

新增 `packages/web/src/api/role-behavior.ts`：

```typescript
const BASE = '/api/v1/projects';

export const roleBehaviorApi = {
  listActions: (projectId: string, roleId: string) =>
    apiClient.get(`${BASE}/${projectId}/roles/${roleId}/actions`),

  createAction: (projectId: string, roleId: string, data: CreateActionInput) =>
    apiClient.post(`${BASE}/${projectId}/roles/${roleId}/actions`, data),

  updateAction: (projectId: string, roleId: string, actionId: string, data: UpdateActionInput) =>
    apiClient.put(`${BASE}/${projectId}/roles/${roleId}/actions/${actionId}`, data),

  deleteAction: (projectId: string, roleId: string, actionId: string) =>
    apiClient.delete(`${BASE}/${projectId}/roles/${roleId}/actions/${actionId}`),

  listDecisions: (projectId: string, roleId: string) =>
    apiClient.get(`${BASE}/${projectId}/roles/${roleId}/decisions`),

  createDecision: (projectId: string, roleId: string, data: CreateDecisionInput) =>
    apiClient.post(`${BASE}/${projectId}/roles/${roleId}/decisions`, data),

  updateDecision: (projectId: string, roleId: string, decisionId: string, data: UpdateDecisionInput) =>
    apiClient.put(`${BASE}/${projectId}/roles/${roleId}/decisions/${decisionId}`, data),

  deleteDecision: (projectId: string, roleId: string, decisionId: string) =>
    apiClient.delete(`${BASE}/${projectId}/roles/${roleId}/decisions/${decisionId}`),
};
```

### 10.4 角色列表页改动

`RolesPage.tsx` 需要以下改动：

1. **卡片点击导航**：`<Card onClick={() => navigate(/p/${projectId}/roles/${role.id})}>`
2. **行为计数显示**：卡片底部增加 `"${role.actions.length} Actions · ${role.decisions.length} Decisions"` 行

---

## 11. 设计决策汇总

| # | 决策 | 理由 | 关联规则 |
|---|------|------|---------|
| RB-1 | **JSONB 原子写回**（读→改→整体写回） | name 唯一性等校验需完整数组上下文，不可用 `jsonb_set` 单项更新 | B-M1-95/112 |
| RB-2 | **角色级乐观锁**（递增 roles.version） | JSONB 子资源无独立行，只能借用父行 version 防并发覆盖 | B-M1-106/125 |
| RB-3 | **删除不强制客户端传 version** | 删除是幂等操作，强制 version 增加前端复杂度且无实际收益 | — |
| RB-4 | **共享校验 helper 独立为 behavior-common.ts** | F-M1-13 的 ExternalEntity 行为管理复用相同 NodeIO/ToolRef/Branch 校验 | PRD §4.12.5 |
| RB-5 | **Action/Decision id 由后端 crypto.randomUUID() 生成** | 避免客户端伪造 id 导致的冲突；PRD B-M1-93/110 明确客户端不可指定 | B-M1-93/110 |
| RB-6 | **请求 body 中含 id 字段时忽略（不报错）** | 前端编辑场景可能回传完整对象含 id，忽略比拒绝更友好 | — |
| RB-7 | **process_nodes 引用检查 Phase 1 跳过 + TODO** | process_nodes 表尚无 action_ref/decision_ref 字段，属于 M3 范围 | B-M1-107/126 |
| RB-8 | **edgeIds Phase 1 硬约束 = []** | 防止 M3 写入的边 ID 在 Action/Decision 更新时被误删 | B-M1-119 |
| RB-9 | **路由注册为独立插件 role-behavior.ts** | 与 organization.ts 分离，职责清晰，prefix 包含 /roles/:roleId | — |
| RB-10 | **新增错误码复用现有体系** | `UNPROCESSABLE_ENTITY` 覆盖 NodeIO/Branch/ToolRef 校验失败，`NAME_CONFLICT` 覆盖 name 重复，不新增专用错误码 | — |

---

## 12. 版本历史

| 版本 | 日期 | 变更要点 |
|------|------|---------|
| v1.0 | 2026-06-04 | 初版，覆盖 F-M1-12 完整技术方案：JSONB CRUD 模式 + 共享类型 + TypeBox Schema + Service/Route 层设计 + 乐观锁 + 引用检查预留 + 前端组件树 |
