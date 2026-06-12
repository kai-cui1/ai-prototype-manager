/**
 * @module application.schema
 * @description TypeBox validation schemas for M1 Application entities (F-M1-11).
 *
 * PRD Reference: docs/03-prd-ux/modules/application-management/application-management-prd.md
 *                 section 4.1.3 (Business Rules) + 4.1.4 (Data Specs)
 */
import { Type } from '@sinclair/typebox';
import {
  DisplayNameSchema,
  PaginationQuery,
  SearchQuery,
  OrderSchema,
  VersionSchema,
} from './base.js';
import {
  SuccessEnvelope,
  PaginatedEnvelope,
} from './response.js';

// ============================================================
// Application Type Enum (7 values per PRD §4.1.4)
// ============================================================

/**
 * 7 种应用类型枚举。
 *
 * B-M1-56: type 创建后不可修改。
 */
export const ApplicationTypeSchema = Type.Union([
  Type.Literal('web'),
  Type.Literal('wxapp'),
  Type.Literal('android'),
  Type.Literal('ios'),
  Type.Literal('pc'),
  Type.Literal('api'),
  Type.Literal('service'),
]);

// ============================================================
// Application Name Schema (stricter than base NameSchema)
// ============================================================

/**
 * Application name: lowercase letter start, then lowercase letters/digits/hyphens only.
 *
 * G-M1-11: 与 Project/Role/Company/Department 的 name 格式一致。
 *           1-50 字符，正则 ^[a-z][a-z0-9-]*$
 */
export const ApplicationNameSchema = Type.String({
  minLength: 1,
  maxLength: 50,
  pattern: '^[a-z][a-z0-9-]*$',
  description: '编程标识符: 1-50 位, 仅允许小写字母、数字和连字符, 以字母开头',
});

// ============================================================
// F-M1-11: Application CRUD Input Schemas
// ============================================================

/**
 * POST /api/v1/projects/:projectId/applications — Create application
 *
 * B-M1-57: icon 按 type 自动分配，前端不传。
 * B-M1-58: sort_order/config 使用默认值。
 */
export const CreateApplicationInput = Type.Object({
  type: ApplicationTypeSchema,
  name: ApplicationNameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String({ maxLength: 500 })),
});

/**
 * PUT /api/v1/applications/:id — Update application
 *
 * B-M1-59: 可编辑字段：name, display_name, description。
 * B-M1-61: 不使用乐观锁（无 version 字段）。
 */
export const UpdateApplicationInput = Type.Object({
  name: Type.Optional(ApplicationNameSchema),
  displayName: Type.Optional(DisplayNameSchema),
  description: Type.Optional(Type.String({ maxLength: 500 })),
});

/**
 * GET /api/v1/projects/:projectId/applications — List applications query
 *
 * B-M1-50~53: 支持 type 筛选、name 搜索、排序分页。
 */
export const ApplicationListQuery = Type.Object({
  ...PaginationQuery.properties,
  search: SearchQuery,
  type: Type.Optional(ApplicationTypeSchema),
  sort: Type.Optional(Type.Union([
    Type.Literal('name'),
    Type.Literal('createdAt'),
    Type.Literal('updatedAt'),
    Type.Literal('sortOrder'),
  ], { default: 'sortOrder' })),
  order: Type.Optional(OrderSchema),
});

// ============================================================
// Response Schemas (for Fastify route schema + OpenAPI)
// ============================================================

/** Application 列表项（不返回 config，减少传输量） */
export const ApplicationItemSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  displayName: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  type: ApplicationTypeSchema,
  icon: Type.Union([Type.String(), Type.Null()]),
  sortOrder: Type.Number(),
  updatedAt: Type.String({ format: 'date-time' }),
});

/** Application 详情（完整字段，含 config） */
export const ApplicationDetailSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  projectId: Type.String({ format: 'uuid' }),
  name: Type.String(),
  displayName: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  type: ApplicationTypeSchema,
  icon: Type.Union([Type.String(), Type.Null()]),
  sortOrder: Type.Number(),
  config: Type.Object({}, { additionalProperties: true }),
  version: VersionSchema,
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

// ============================================================
// Response Envelope Schemas
// ============================================================

/** GET /applications — 分页列表响应 */
export const ApplicationListResponse = PaginatedEnvelope(ApplicationItemSchema);

/** GET /applications/:id | POST /applications | PUT /applications/:id — 单资源响应 */
export const ApplicationDetailResponse = SuccessEnvelope(ApplicationDetailSchema);
