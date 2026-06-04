/**
 * @module role-behavior.schema
 * @description TypeBox validation schemas for F-M1-12 (Role Behavior Management).
 *              Covers Action CRUD + Decision CRUD for roles.actions/decisions JSONB arrays.
 *              Shared sub-schemas (NodeIO, ToolRef, ActionLogic, DecisionBranchInput)
 *              will be reused by F-M1-13 (External Entity Behavior Management).
 *
 * PRD Reference: docs/03-prd-ux/modules/project-management/project-management-prd-2.md §4.12
 */
import { Type } from '@sinclair/typebox';
import {
  NameSchema,
  DisplayNameSchema,
  VersionSchema,
  IdSchema,
} from './base.js';
import { SuccessEnvelope, DeleteResponse, ErrorResponse } from './response.js';

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

/** Decision branch 响应体 */
const DecisionBranchResponse = Type.Object({
  name: Type.String(),
  condition: Type.Optional(Type.String()),
  outputs: Type.Array(NodeIOSchema),
  edgeIds: Type.Array(Type.String()),
});

/** Decision 响应体（含系统生成的 id + branches） */
export const DecisionDefResponse = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String()),
  branches: Type.Array(DecisionBranchResponse),
});

/** Action 列表响应（含 version 用于乐观锁） */
export const ActionListResponse = Type.Object({
  data: Type.Object({
    items: Type.Array(RoleActionResponse),
    version: Type.Number(),
  }),
});

/** Action 创建响应 */
export const ActionCreateResponse = SuccessEnvelope(Type.Object({
  action: RoleActionResponse,
  version: Type.Number(),
}));

/** Action 更新响应 */
export const ActionUpdateResponse = SuccessEnvelope(Type.Object({
  action: RoleActionResponse,
  version: Type.Number(),
}));

/** Decision 列表响应（含 version 用于乐观锁） */
export const DecisionListResponse = Type.Object({
  data: Type.Object({
    items: Type.Array(DecisionDefResponse),
    version: Type.Number(),
  }),
});

/** Decision 创建响应 */
export const DecisionCreateResponse = SuccessEnvelope(Type.Object({
  decision: DecisionDefResponse,
  version: Type.Number(),
}));

/** Decision 更新响应 */
export const DecisionUpdateResponse = SuccessEnvelope(Type.Object({
  decision: DecisionDefResponse,
  version: Type.Number(),
}));

/** 行为删除响应（复用 DeleteResponse） */
export { DeleteResponse, ErrorResponse };
