/**
 * @module project.schema
 * @description TypeBox validation schemas for M1 Project management endpoints.
 *              Covers F-M1-01 (list), F-M1-02 (create), F-M1-03 (detail + summary),
 *              F-M1-04 (update), F-M1-05 (archive/restore).
 *
 * PRD Reference: docs/03-prd/modules/project-management/project-management-prd.md
 *                 sections 4.1.5, 4.2.5, 4.3.5, 4.4.5, 4.5.5
 */
import { Type } from '@sinclair/typebox';
import {
  ProjectNameCreateSchema,
  NameSchema,
  DisplayNameSchema,
  DescriptionShortSchema,
  DescriptionSchema,
  VersionSchema,
  StatusSchema,
  IdSchema,
  PaginationQuery,
  SortFieldSchema,
  OrderSchema,
  SearchQuery,
  StatusQuery,
} from './base.js';
import {
  SuccessEnvelope,
  PaginatedEnvelope,
} from './response.js';

// ============================================================
// F-M1-02: Create Project (POST /api/v1/projects)
// ============================================================

/**
 * Request body schema for creating a new project.
 *
 * B-rule coverage: B-M1-10 (name format + uniqueness -- DB level),
 *                  B-M1-11~B-M1-13 (defaults assigned by backend).
 */
export const CreateProjectInput = Type.Object({
  name: ProjectNameCreateSchema,
  displayName: DisplayNameSchema,
  description: DescriptionShortSchema,
});

// ============================================================
// F-M1-04: Update Project (PUT /api/v1/projects/:id)
// ============================================================

/**
 * Request body schema for updating an existing project (PUT 全量语义).
 *
 * name + displayName 必填，description 可选。
 * version 通过 query parameter `?version=N` 传递（乐观锁）。
 *
 * B-rule coverage: B-M1-18 (name regex) / B-M1-19 (name length) /
 *                  B-M1-20 (name uniqueness -- DB level) /
 *                  B-M1-21 (displayName required) /
 *                  B-M1-22 (archived check -- Service layer).
 */
export const UpdateProjectInput = Type.Object({
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: DescriptionSchema,
});

// ============================================================
// F-M1-01: List Projects (GET /api/v1/projects)
// ============================================================

/**
 * Query parameter schema for listing projects.
 * Supports pagination, search filtering, status filtering, and sorting.
 *
 * B-rule coverage: B-M1-01~B-M1-05 (list behavior rules).
 */
export const ProjectListQuery = Type.Object({
  ...PaginationQuery.properties,
  search: SearchQuery,
  status: StatusQuery,
  sort: Type.Optional(SortFieldSchema),
  order: Type.Optional(OrderSchema),
});

// ============================================================
// F-M1-05: Archive / Restore Project (PATCH /api/v1/projects/:id/status)
// ============================================================

/**
 * Request body schema for archiving or restoring a project.
 * Requires target status and current version (optimistic lock per G-M1-07).
 *
 * B-rule coverage: B-M1-23 (version required for optimistic lock),
 *                  B-M1-24 (disallow same-status transition -- Service layer),
 *                  B-M1-25 (no cascade to child tables).
 */
export const ArchiveProjectInput = Type.Object({
  status: StatusSchema,
  version: VersionSchema,
});

// ============================================================
// F-M1-03: Get Project Detail (GET /api/v1/projects/:id)
// ============================================================

/**
 * Path parameter schema for project detail/summary endpoints.
 * Validates that :id is a valid UUID.
 */
export const ProjectIdParam = Type.Object({
  id: IdSchema,
});

// ============================================================
// Response Schemas for Project Endpoints
// ============================================================

/**
 * 项目列表项（精简字段）。
 *
 * B-M1-05: 列表不返回 description/config/createdAt，减少传输体积。
 * B-M1-88: 列表内嵌摘要统计（6 个模块计数），避免前端 N+1 请求。
 *
 * 对应 shared types: ProjectListItem (packages/shared/src/types/project.ts:46)
 */
export const ProjectListItem = Type.Object(
  {
    id: IdSchema,
    name: NameSchema,
    displayName: DisplayNameSchema,
    status: StatusSchema,
    version: VersionSchema,
    updatedAt: Type.String({ format: 'date-time', description: '最后更新时间 (ISO 8601)' }),
    summary: Type.Object({
      domainEntityCount: Type.Number({ minimum: 0 }),
      processCount: Type.Number({ minimum: 0 }),
      companyCount: Type.Number({ minimum: 0 }),
      departmentCount: Type.Number({ minimum: 0 }),
      roleCount: Type.Number({ minimum: 0 }),
      externalEntityCount: Type.Number({ minimum: 0 }),
    }, { description: 'B-M1-88 内嵌摘要统计' }),
  },
  { description: '项目列表项' },
);

/** GET /api/v1/projects 响应 */
export const ProjectListResponse = PaginatedEnvelope(ProjectListItem);

/**
 * 项目详情完整字段（含 description + config）。
 *
 * B-M1-14: 详情 API 返回完整字段，与列表 API 不同。
 *
 * 对应 shared types: Project (packages/shared/src/types/project.ts:9)
 */
export const ProjectDetail = Type.Object(
  {
    id: IdSchema,
    name: NameSchema,
    displayName: DisplayNameSchema,
    description: Type.Union([Type.String({ maxLength: 2000 }), Type.Null()], { description: '项目描述' }),
    status: StatusSchema,
    version: VersionSchema,
    config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    createdAt: Type.String({ format: 'date-time', description: '创建时间 (ISO 8601)' }),
    updatedAt: Type.String({ format: 'date-time', description: '更新时间 (ISO 8601)' }),
  },
  { description: '项目详情完整字段' },
);

/** GET /api/v1/projects/:id 响应 */
export const ProjectDetailResponse = SuccessEnvelope(ProjectDetail);

/**
 * 项目摘要统计（6 个子模块计数）。
 *
 * B-M1-15: 零计数必须返回 0，不得省略字段。
 *
 * 对应 shared types: ProjectSummary (packages/shared/src/types/project.ts:64)
 */
export const ProjectSummary = Type.Object(
  {
    id: IdSchema,
    name: NameSchema,
    displayName: DisplayNameSchema,
    status: StatusSchema,
    domainEntityCount: Type.Number({ minimum: 0 }),
    processCount: Type.Number({ minimum: 0 }),
    companyCount: Type.Number({ minimum: 0 }),
    departmentCount: Type.Number({ minimum: 0 }),
    roleCount: Type.Number({ minimum: 0 }),
    externalEntityCount: Type.Number({ minimum: 0 }),
  },
  { description: '项目子模块统计摘要' },
);

/** GET /api/v1/projects/:id/summary 响应 */
export const ProjectSummaryResponse = SuccessEnvelope(ProjectSummary);

/** POST /api/v1/projects 创建成功响应 (201) */
export const CreateProjectResponse = SuccessEnvelope(ProjectDetail);
