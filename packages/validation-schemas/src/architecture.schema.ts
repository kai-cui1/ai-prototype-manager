/**
 * @module architecture.schema
 * @description TypeBox validation schemas for M4 Business Architecture entities.
 *
 * PRD Reference: docs/03-prd-ux/modules/business-architecture/business-architecture-prd.md
 * Tech Design: docs/04-tech-design/modules/business-architecture/business-architecture-tech-design.md
 */
import { Type } from '@sinclair/typebox';
import { IdSchema, DisplayNameSchema } from './base.js';
import {
  SuccessEnvelope,
  DeleteResponse,
  ErrorResponse,
} from './response.js';

// ============================================================
// Input Schemas
// ============================================================

/**
 * POST /projects/:projectId/architectures — 创建架构节点
 * B-M4-04: name 必须符合 slug 格式（lowercase + 数字 + 连字符）
 * B-M4-05: 同一项目内 name 唯一
 */
export const CreateArchitectureInput = Type.Object({
  name: Type.String({
    minLength: 1,
    maxLength: 100,
    pattern: '^[a-z0-9-]+$',
    description: 'slug 格式，lowercase + 数字 + 连字符',
  }),
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String({ maxLength: 500 })),
  parentId: Type.Optional(Type.Union([IdSchema, Type.Null()])),
  /** 可选的描述性层级标注，不限制格式（如 'domain'/'module'），或不填写 */
  level: Type.Optional(Type.String({ maxLength: 50 })),
});

/**
 * PATCH /projects/:projectId/architectures/:archId — 编辑架构节点
 * 所有字段均可选，只更新传入字段
 */
export const UpdateArchitectureInput = Type.Object({
  name: Type.Optional(Type.String({
    minLength: 1,
    maxLength: 100,
    pattern: '^[a-z0-9-]+$',
  })),
  displayName: Type.Optional(DisplayNameSchema),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  level: Type.Optional(Type.Union([Type.String({ maxLength: 50 }), Type.Null()])),
});

/** POST /projects/:projectId/architectures/:archId/processes — 关联流程 */
export const AddProcessMappingInput = Type.Object({
  processId: IdSchema,
});

/** PATCH /projects/:projectId/architectures/:archId/processes/order — 重排流程 */
export const ReorderProcessesInput = Type.Object({
  processIds: Type.Array(IdSchema, { minItems: 1 }),
});

// ============================================================
// Query Schemas
// ============================================================

/**
 * GET /projects/:projectId/architectures/search-processes?q=xxx — 流程模糊搜索
 * B-M4-17: q 为空字符串时返回空数组（由 service 层处理），schema 层允许空字符串
 */
export const ProcessSearchQuery = Type.Object({
  q: Type.String({ minLength: 0 }),
});

// ============================================================
// Path Param Schemas
// ============================================================

/** 项目级路径参数 */
export const ArchParamSchema = Type.Object({ projectId: IdSchema });

/** 节点级路径参数 */
export const ArchNodeParamSchema = Type.Object({
  projectId: IdSchema,
  archId: IdSchema,
});

/** 节点-流程映射路径参数 */
export const ArchProcessParamSchema = Type.Object({
  projectId: IdSchema,
  archId: IdSchema,
  processId: IdSchema,
});

// ============================================================
// Response Detail Schemas
// ============================================================

/** 关联到架构节点的流程引用（简化信息） */
export const ArchProcessRefSchema = Type.Object({
  id: IdSchema,
  name: Type.String(),
  displayName: Type.String(),
  status: Type.Union([
    Type.Literal('draft'),
    Type.Literal('active'),
    Type.Literal('deprecated'),
  ]),
  sortOrder: Type.Number(),
});

/**
 * 架构节点完整信息（含关联流程列表）
 * GET /architectures 和 POST/PATCH/DELETE 的响应体
 */
export const ArchitectureNodeSchema = Type.Object({
  id: IdSchema,
  projectId: IdSchema,
  parentId: Type.Union([Type.Null(), IdSchema]),
  name: Type.String(),
  displayName: Type.String(),
  description: Type.Union([Type.Null(), Type.String()]),
  level: Type.Union([Type.Null(), Type.String()]),
  sortOrder: Type.Number(),
  processes: Type.Array(ArchProcessRefSchema),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

/** 流程搜索结果项（用于下拉关联选择） */
export const ProcessSearchItemSchema = Type.Object({
  id: IdSchema,
  name: Type.String(),
  displayName: Type.String(),
  status: Type.Union([
    Type.Literal('draft'),
    Type.Literal('active'),
    Type.Literal('deprecated'),
  ]),
});

// ============================================================
// Response Envelope Schemas
// ============================================================

/** GET /architectures — 架构树（扁平列表，前端组装树形） */
export const ArchTreeResponse = SuccessEnvelope(Type.Array(ArchitectureNodeSchema));

/** POST/PATCH /architectures/:archId — 单节点响应 */
export const ArchNodeResponse = SuccessEnvelope(ArchitectureNodeSchema);

/** GET /architectures/search-processes — 流程搜索结果 */
export const ProcessSearchResponse = SuccessEnvelope(Type.Array(ProcessSearchItemSchema));

// Re-export for convenience
export { DeleteResponse, ErrorResponse };
