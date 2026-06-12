/**
 * @module organization.schema
 * @description TypeBox validation schemas for M1 Organization entities.
 *              Covers F-M1-06 (companies), F-M1-07 (departments),
 *              F-M1-08 (roles), F-M1-09 (external entities).
 *
 * PRD Reference: docs/03-prd/modules/project-management/project-management-prd-2.md
 *                 sections 4.6.5, 4.7.5, 4.8.5, 4.9.5
 */
import { Type } from '@sinclair/typebox';
import {
  NameSchema,
  DisplayNameSchema,
  DescriptionSchema,
  VersionSchema,
  PaginationQuery,
  SearchQuery,
  IdSchema,
} from './base.js';
import {
  SuccessEnvelope,
  PaginatedEnvelope,
} from './response.js';

// ============================================================
// F-M1-06: Company Management
// ============================================================

/** POST /api/v1/projects/:projectId/companies — Create company */
export const CreateCompanyInput = Type.Object({
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: DescriptionSchema,
});

/** PUT /api/v1/companies/:id — Update company */
export const UpdateCompanyInput = Type.Partial(
  Type.Object({
    name: Type.Optional(NameSchema),
    displayName: Type.Optional(DisplayNameSchema),
    description: DescriptionSchema,
    version: VersionSchema,
  })
);

/** GET /api/v1/projects/:projectId/companies — List companies */
export const CompanyListQuery = Type.Object({
  ...PaginationQuery.properties,
  search: SearchQuery,
});

// ============================================================
// F-M1-07: Department Management
// ============================================================

/**
 * POST /api/v1/companies/:companyId/departments — Create department
 *
 * R5 Why: parentId is string | null — null means top-level department.
 *         The Type.Union([String(uuid), Null()]) pattern explicitly
 *         allows JSON null (not just "absent").
 */
export const CreateDepartmentInput = Type.Object({
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: DescriptionSchema,
  parentId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
});

/** PUT /api/v1/departments/:id — Update department */
export const UpdateDepartmentInput = Type.Partial(
  Type.Object({
    name: Type.Optional(NameSchema),
    displayName: Type.Optional(DisplayNameSchema),
    description: DescriptionSchema,
    parentId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
    version: VersionSchema,
  })
);

/**
 * GET /api/v1/companies/:companyId/departments — List departments
 *
 * R5 Why: tree parameter controls whether response is flat or nested tree.
 *         companyId is a required path param (not in query), so it does
 *         not appear in this query schema.
 */
export const DepartmentListQuery = Type.Object({
  ...PaginationQuery.properties,
  search: SearchQuery,
  tree: Type.Optional(Type.Boolean()),
});

// ============================================================
// F-M1-08: Role Management
// ============================================================

/**
 * POST /api/v1/projects/:projectId/roles — Create role
 *
 * R5 Why: departmentId is optional UUID or null.
 *         null / absent = independent role (not attached to any department).
 *         This aligns with domain model v1.1 Role independence design (B-M1-63).
 */
export const CreateRoleInput = Type.Object({
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: DescriptionSchema,
  departmentId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
});

/** PUT /api/v1/roles/:id — Update role */
export const UpdateRoleInput = Type.Partial(
  Type.Object({
    name: Type.Optional(NameSchema),
    displayName: Type.Optional(DisplayNameSchema),
    description: DescriptionSchema,
    departmentId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
    version: VersionSchema,
  })
);

/**
 * GET /api/v1/projects/:projectId/roles — List roles
 *
 * R5 Why: departmentId filter accepts a UUID OR the sentinel string '__none__'
 *         to filter for independent roles (department_id IS NULL, per B-M1-58).
 *         Using Type.Union with Type.Literal('__none__') makes the sentinel
 *         value explicit in the schema rather than a magic string in code.
 */
export const RoleListQuery = Type.Object({
  ...PaginationQuery.properties,
  search: SearchQuery,
  departmentId: Type.Optional(Type.Union([
    Type.String({ format: 'uuid' }),
    Type.Literal('__none__'),
  ])),
});

// ============================================================
// F-M1-09: External Entity Management
// ============================================================

/**
 * External entity type enum values.
 * Matches Drizzle schema comment and domain model definition:
 *   system | organization | person | api
 *
 * R5 Why: PRD section 4.9.5 lists these four values as the allowed set.
 *         The domain model uses 'interface' in some places but Drizzle schema
 *         settled on 'api' — we follow the authoritative DDL/Drizzle definition.
 */
const EntityTypeSchema = Type.Union([
  Type.Literal('system'),
  Type.Literal('organization'),
  Type.Literal('person'),
  Type.Literal('api'),
]);

/** POST /api/v1/projects/:projectId/external-entities — Create external entity */
export const CreateExternalEntityInput = Type.Object({
  name: NameSchema,
  displayName: DisplayNameSchema,
  type: EntityTypeSchema,
  description: DescriptionSchema,
});

/** PUT /api/v1/external-entities/:id — Update external entity */
export const UpdateExternalEntityInput = Type.Partial(
  Type.Object({
    name: Type.Optional(NameSchema),
    displayName: Type.Optional(DisplayNameSchema),
    type: Type.Optional(EntityTypeSchema),
    description: DescriptionSchema,
    version: VersionSchema,
  })
);

/** GET /api/v1/projects/:projectId/external-entities — List external entities */
export const ExternalEntityListQuery = Type.Object({
  ...PaginationQuery.properties,
  search: SearchQuery,
});

// ============================================================
// Response Schemas for Organization Endpoints
// ============================================================

// ---------------------------------------------------------------
// Company Response Schemas (F-M1-06)
// ---------------------------------------------------------------

/**
 * 公司完整字段。
 *
 * 对应 shared types: Company (packages/shared/src/types/organization.ts:7)
 */
export const CompanyDetail = Type.Object(
  {
    id: IdSchema,
    projectId: IdSchema,
    name: NameSchema,
    displayName: DisplayNameSchema,
    description: Type.Optional(Type.String({ maxLength: 2000 })),
    companyType: Type.Optional(Type.String()),
    contactInfo: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    sortOrder: Type.Number({ minimum: 0 }),
    config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
    status: Type.Literal('active'),
    version: Type.Number({ minimum: 1 }),
    departmentCount: Type.Number({ minimum: 0 }),
    roleCount: Type.Number({ minimum: 0 }),
  },
  { description: '公司详情' },
);

/** 公司列表项（与 Detail 相同，列表不过滤字段） */
export const CompanyListItem = CompanyDetail;

/** GET /companies 响应 */
export const CompanyListResponse = PaginatedEnvelope(CompanyListItem);
/** GET/POST/PUT /companies 单资源响应 */
export const CompanyDetailResponse = SuccessEnvelope(CompanyDetail);

// ---------------------------------------------------------------
// Department Response Schemas (F-M1-07)
// ---------------------------------------------------------------

/**
 * 部门完整字段。
 *
 * 对应 shared types: Department (packages/shared/src/types/organization.ts:21)
 */
export const DepartmentDetail = Type.Object(
  {
    id: IdSchema,
    projectId: IdSchema,
    companyId: IdSchema,
    parentId: Type.Optional(Type.Union([IdSchema, Type.Null()])),
    name: NameSchema,
    displayName: DisplayNameSchema,
    description: Type.Optional(Type.String({ maxLength: 2000 })),
    contactInfo: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    sortOrder: Type.Number({ minimum: 0 }),
    config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { description: '部门详情' },
);

/** 部门树节点（用于 tree 接口响应） */
export const DepartmentTreeNode = Type.Recursive(
  (This) =>
    Type.Object(
      {
        ...DepartmentDetail.properties,
        children: Type.Optional(Type.Array(This)),
      },
      {
        description: '部门树节点',
      },
    ),
);

/** 部门列表项 */
export const DepartmentListItem = DepartmentDetail;
/** GET /departments 列表响应 */
export const DepartmentListResponse = PaginatedEnvelope(DepartmentListItem);
/** GET /departments/tree 树形响应 */
export const DepartmentTreeResponse = SuccessEnvelope(Type.Array(DepartmentTreeNode));
/** GET/POST/PUT /departments 单资源响应 */
export const DepartmentDetailResponse = SuccessEnvelope(DepartmentDetail);

// ---------------------------------------------------------------
// Role Response Schemas (F-M1-08)
// ---------------------------------------------------------------

/**
 * 角色完整字段。
 *
 * 对应 shared types: Role (packages/shared/src/types/organization.ts:36)
 */
export const RoleDetail = Type.Object(
  {
    id: IdSchema,
    projectId: IdSchema,
    departmentId: Type.Optional(Type.Union([IdSchema, Type.Null()])),
    name: NameSchema,
    displayName: DisplayNameSchema,
    description: Type.Optional(Type.String({ maxLength: 2000 })),
    category: Type.Optional(Type.String()),
    contactInfo: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    actions: Type.Optional(Type.Array(Type.Unknown())),
    decisions: Type.Optional(Type.Array(Type.Unknown())),
    sortOrder: Type.Number({ minimum: 0 }),
    config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    version: VersionSchema,
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { description: '角色详情' },
);

/** 角色列表项 */
export const RoleListItem = RoleDetail;
/** GET /roles 列表响应 */
export const RoleListResponse = PaginatedEnvelope(RoleListItem);
/** GET/POST/PUT /roles 单资源响应 */
export const RoleDetailResponse = SuccessEnvelope(RoleDetail);

// ---------------------------------------------------------------
// External Entity Response Schemas (F-M1-09)
// ---------------------------------------------------------------

/**
 * 外部实体完整字段。
 *
 * 对应 shared types: ExternalEntity (packages/shared/src/types/organization.ts:53)
 */
export const ExternalEntityDetail = Type.Object(
  {
    id: IdSchema,
    projectId: IdSchema,
    companyId: Type.Optional(Type.Union([IdSchema, Type.Null()])),
    departmentId: Type.Optional(Type.Union([IdSchema, Type.Null()])),
    name: NameSchema,
    displayName: DisplayNameSchema,
    description: Type.Optional(Type.String({ maxLength: 2000 })),
    entityType: Type.Optional(EntityTypeSchema),
    contactInfo: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    actions: Type.Optional(Type.Array(Type.Unknown())),
    decisions: Type.Optional(Type.Array(Type.Unknown())),
    sortOrder: Type.Number({ minimum: 0 }),
    config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    version: VersionSchema,
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { description: '外部实体详情' },
);

/** 外部实体列表项 */
export const ExternalEntityListItem = ExternalEntityDetail;
/** GET /external-entities 列表响应 */
export const ExternalEntityListResponse = PaginatedEnvelope(ExternalEntityListItem);
/** GET/POST/PUT /external-entities 单资源响应 */
export const ExternalEntityDetailResponse = SuccessEnvelope(ExternalEntityDetail);
