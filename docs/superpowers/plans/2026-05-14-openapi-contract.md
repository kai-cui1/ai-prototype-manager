# OpenAPI 完整契约体系 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 APM 后端 API 建立 OpenAPI 3.0.3 完整契约文档（@fastify/swagger 生成 spec + Scalar UI 渲染），迁移路由从自定义 validate() 中间件到 Fastify 原生 schema，全量定义 28 个端点的 request/response。

**Architecture:** 在 `@apm/validation-schemas` 中新增通用响应信封 Schema（response.ts）+ 各模块响应 Schema；在 `app.ts` 注册 `@fastify/swagger` + `@scalar/fastify-api-reference` 插件；将 `routes/projects.ts` 和 `routes/organization.ts` 的全部 27 个端点从 `preValidation: validate()` 迁移为原生 `schema` 属性；删除 `routes/common/validate.ts`。

**Tech Stack:** Fastify 5.2, @sinclair/typebox 0.34, @fastify/swagger ^9.x, @scalar/fastify-api-reference ^1.55, Vitest

**Design Doc:** `docs/04-tech-design/openapi-contract-design.md`

---

## 文件结构总览

```
packages/validation-schemas/src/
├── base.ts                  # 现有，不变
├── project.schema.ts        # 修改：追加响应 Schema (~60 行)
├── organization.schema.ts   # 修改：追加响应 Schema (~100 行)
├── response.ts              # 新增：通用信封 + 错误 Schema (~80 行)
└── index.ts                 # 修改：+1 行 export

packages/api/src/
├── app.ts                   # 修改：注册 swagger + scalar 插件 (~30 行)
├── routes/
│   ├── projects.ts          # 重写：schema 替换 preValidation (6 端点)
│   ├── organization.ts      # 重写：同上 (21 端点)
│   └── common/
│       └── validate.ts      # 删除

packages/api/tests/
└── openapi/
    └── openapi-schema.test.ts  # 新增：OpenAPI 合法性测试 (~60 行)

packages/api/package.json     # 修改：+2 dependencies
```

---

### Task 1: 安装依赖

**Files:**
- Modify: `packages/api/package.json`

- [ ] **Step 1: 安装 @fastify/swagger 和 @scalar/fastify-api-reference**

```bash
cd packages/api && pnpm add @fastify/swagger @scalar/fastify-api-reference
```

- [ ] **Step 2: 验证安装成功**

Run: `cd packages/api && cat package.json | grep -E "swagger|scalar"`
Expected: 输出中包含 `"@fastify/swagger"` 和 `"@scalar/fastify-api-reference"` 及其版本号

- [ ] **Step 3: Commit**

```bash
git add packages/api/package.json pnpm-lock.yaml
git commit -m "chore: add @fastify/swagger and @scalar/fastify-api-reference for OpenAPI docs"
```

---

### Task 2: 创建通用响应 Schema（response.ts）

**Files:**
- Create: `packages/validation-schemas/src/response.ts`
- Test: 通过后续 Task 10 验证

> **重要**: 此文件定义的 TypeBox Schema 必须与 `packages/shared/src/types/` 中的 TypeScript 接口字段一一对应。以下是精确的 Schema 定义。

- [ ] **Step 1: 创建 response.ts**

写入以下内容到 `packages/validation-schemas/src/response.ts`：

```typescript
/**
 * @module response
 * @description OpenAPI 响应 Schema 定义：通用成功信封、分页元数据、错误信封。
 *              被 project.schema.ts 和 organization.schema.ts 引用，
 *              同时作为 Fastify route schema.response 的类型来源。
 *
 * 设计原则：
 * - SuccessEnvelope<T>: 单资源 CRUD 成功响应 { data: T }
 * - PaginatedEnvelope<T>: 列表接口分页响应 { data: T[], meta }
 * - DeleteResponse: 删除操作 { success: true }
 * - ErrorResponse: 统一错误信封 { error: { code, message, requestId, details? } }
 *
 * 与 shared types 对齐：
 * - ErrorResponse.error 结构匹配 app.ts 全局 setErrorHandler 的实际输出格式
 * - PaginationMeta 匹配 services/common/pagination.ts 的 buildMeta() 返回值
 */
import type { TSchema } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

// ============================================================
// 分页元数据
// ============================================================

/**
 * 分页元数据。
 *
 * 字段来源: services/common/pagination.ts → buildMeta()
 */
export const PaginationMeta = Type.Object(
  {
    page: Type.Number({ minimum: 1, description: '当前页码' }),
    pageSize: Type.Union([
      Type.Literal(10),
      Type.Literal(20),
      Type.Literal(50),
      Type.Literal(100),
    ], { description: '每页条数' }),
    total: Type.Number({ minimum: 0, description: '总记录数' }),
    totalPages: Type.Number({ minimum: 0, description: '总页数' }),
  },
  { $id: 'PaginationMeta', description: '分页元数据' },
);

// ============================================================
// 成功响应信封
// ============================================================

/**
 * 单资源成功响应信封: { data: T }
 *
 * 用于: GET /:id (detail), POST / (create), PUT /:id (update), PATCH (archive)
 */
export function SuccessEnvelope<T extends TSchema>(data: T) {
  return Type.Object(
    { data },
    {
      $id: `SuccessEnvelope<${data.$id ?? 'Unknown'}>`,
      description: '单资源成功响应',
    },
  );
}

/**
 * 分页列表成功响应信封: { data: T[], meta: PaginationMeta }
 *
 * 用于: GET / (list) 所有列表端点
 */
export function PaginatedEnvelope<T extends TSchema>(items: T) {
  return Type.Object(
    {
      data: Type.Array(items),
      meta: PaginationMeta,
    },
    {
      $id: `PaginatedEnvelope<${items.$id ?? 'Unknown'}>`,
      description: '分页列表成功响应',
    },
  );
}

/**
 * 删除操作响应: { success: true }
 *
 * 用于: DELETE /:id 所有删除端点
 */
export const DeleteResponse = Type.Object(
  {
    success: Type.Literal(true, { description: '操作是否成功' }),
  },
  { $id: 'DeleteResponse', description: '删除操作响应' },
);

// ============================================================
// 错误响应 Schema
// ============================================================

/** 单条校验错误明细（仅 400 VALIDATION_FAILED 时出现） */
export const ErrorDetail = Type.Object(
  {
    field: Type.String({ description: '校验失败的字段路径' }),
    message: Type.String({ description: '该字段的错误信息' }),
  },
  { $id: 'ErrorDetail', description: '校验错误明细' },
);

/**
 * 统一错误信封。
 *
 * 匹配 app.ts setErrorHandler 的三种输出:
 * 1. 已知业务错误 (4xx): { error: { code, message, requestId } }
 * 2. 校验错误 (400):     { error: { code, message, details: [{field, message}], requestId } }
 * 3. 未预期异常 (500):    { error: { code: "INTERNAL_ERROR", message, requestId } }
 *
 * 注意: requestId 在 Fastify 中可能是 string | number，此处用 Union 兼容。
 */
export const ErrorResponse = Type.Object(
  {
    error: Type.Object(
      {
        code: Type.String({ description: '业务错误码 (如 NOT_FOUND, CONFLICT)' }),
        message: Type.String({ description: '人类可读的错误描述' }),
        requestId: Type.Union([Type.String(), Type.Number(), Type.Null()], {
          description: '请求追踪 ID',
        }),
        details: Type.Optional(
          Type.Array(ErrorDetail, { description: '校验错误明细列表（仅 400）' }),
        ),
      },
      { $id: 'ErrorBody', description: '错误体' },
    ),
  },
  { $id: 'ErrorResponse', description: '统一错误响应' },
);
```

- [ ] **Step 2: 更新 barrel export**

在 `packages/validation-schemas/src/index.ts` 末尾添加：

```typescript
export * from './response.js';
```

- [ ] **Step 3: 验证 TypeScript 编译通过**

Run: `cd packages/validation-schemas && npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 4: Commit**

```bash
git add packages/validation-schemas/src/response.ts packages/validation-schemas/src/index.ts
git commit -m "feat(validation-schemas): add OpenAPI response envelope and error schemas"
```

---

### Task 3: 扩展项目模块响应 Schema

**Files:**
- Modify: `packages/validation-schemas/src/project.schema.ts`

> **关键对齐**: 以下 Schema 字段必须与 `packages/shared/src/types/project.ts` 中的 TypeScript 接口完全一致。

- [ ] **Step 1: 追加项目响应 Schema 到 project.schema.ts**

在文件末尾（`ProjectIdParam` 定义之后）追加：

```typescript
// ============================================================
// Response Schemas for Project Endpoints
// ============================================================

import {
  SuccessEnvelope,
  PaginatedEnvelope,
  DeleteResponse,
} from './response.js';

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
  { $id: 'ProjectListItem', description: '项目列表项' },
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
    description: Type.Optional(Type.String({ maxLength: 2000 })),
    status: StatusSchema,
    version: VersionSchema,
    config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    createdAt: Type.String({ format: 'date-time', description: '创建时间 (ISO 8601)' }),
    updatedAt: Type.String({ format: 'date-time', description: '更新时间 (ISO 8601)' }),
  },
  { $id: 'ProjectDetail', description: '项目详情完整字段' },
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
  { $id: 'ProjectSummary', description: '项目子模块统计摘要' },
);

/** GET /api/v1/projects/:id/summary 响应 */
export const ProjectSummaryResponse = SuccessEnvelope(ProjectSummary);

/** POST /api/v1/projects 创建成功响应 (201) */
export const CreateProjectResponse = SuccessEnvelope(ProjectDetail);
```

- [ ] **Step 2: 验证编译**

Run: `cd packages/validation-schemas && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add packages/validation-schemas/src/project.schema.ts
git commit -m "feat(validation-schemas): add project response schemas for OpenAPI"
```

---

### Task 4: 扩展组织模块响应 Schema

**Files:**
- Modify: `packages/validation-schemas/src/organization.schema.ts`

> **关键对齐**: 以下 Schema 字段必须与 `packages/shared/src/types/organization.ts` 中的 TypeScript 接口完全一致。

- [ ] **Step 1: 追加组织实体响应 Schema 到 organization.schema.ts**

在文件末尾追加：

```typescript
// ============================================================
// Response Schemas for Organization Endpoints
// ============================================================

import {
  SuccessEnvelope,
  PaginatedEnvelope,
  DeleteResponse,
} from './response.js';
import { IdSchema } from './base.js';

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
  },
  { $id: 'CompanyDetail', description: '公司详情' },
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
  { $id: 'DepartmentDetail', description: '部门详情' },
);

/** 部门树节点（用于 tree 接口响应） */
export const DepartmentTreeNode = Type.Object(
  {
    ...DepartmentDetail.properties,
    children: Type.Optional(Type.Array(Type.Ref(DepartmentTreeNode)), {
      description: '子部门递归树',
    }),
  },
  { $id: 'DepartmentTreeNode', description: '部门树节点' },
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
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { $id: 'RoleDetail', description: '角色详情' },
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
    entityType: Type.Optional(Type.String()),
    contactInfo: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    actions: Type.Optional(Type.Array(Type.Unknown())),
    decisions: Type.Optional(Type.Array(Type.Unknown())),
    sortOrder: Type.Number({ minimum: 0 }),
    config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { $id: 'ExternalEntityDetail', description: '外部实体详情' },
);

/** 外部实体列表项 */
export const ExternalEntityListItem = ExternalEntityDetail;
/** GET /external-entities 列表响应 */
export const ExternalEntityListResponse = PaginatedEnvelope(ExternalEntityListItem);
/** GET/POST/PUT /external-entities 单资源响应 */
export const ExternalEntityDetailResponse = SuccessEnvelope(ExternalEntityDetail);
```

- [ ] **Step 2: 验证编译**

Run: `cd packages/validation-schemas && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add packages/validation-schemas/src/organization.schema.ts
git commit -m "feat(validation-schemas): add organization entity response schemas for OpenAPI"
```

---

### Task 5: 注册 Swagger 插件到 app.ts

**Files:**
- Modify: `packages/api/src/app.ts`

- [ ] **Step 1: 添加 import 和插件注册**

在 `app.ts` 中，CORS 注册块之后、全局 errorHandler 之前插入：

```typescript
// ============================================
// OpenAPI 文档（Swagger Spec + Scalar UI）
// ============================================

import swagger from '@fastify/swagger';
import scalarApiReference from '@scalar/fastify-api-reference';

await app.register(swagger, {
  openapi: {
    openapi: '3.0.3',
    info: {
      title: 'APM API',
      version: '1.0.0',
      description: 'AI Prototype Manager 后端 REST API 完整契约文档',
      contact: { name: 'APM Team' },
    },
    servers: [
      { url: 'http://localhost:13180', description: 'dev1 本地开发' },
    ],
    tags: [
      { name: 'Health', description: '健康检查' },
      { name: 'Projects', description: '项目管理 (M1)' },
      { name: 'Organization', description: '组织管理 (M1 子模块)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer Token 认证（Phase 2+ 启用）',
        },
      },
    },
  },
});

await app.register(scalarApiReference, {
  routePrefix: '/docs',
  configuration: {
    theme: 'alternate',
    isShown: true,
  },
});
```

同时在文件顶部 import 区域添加两个新导入（在 `import cors from '@fastify/cors';` 之后）：

```typescript
import swagger from '@fastify/swagger';
import scalarApiReference from '@scalar/fastify-api-reference';
```

- [ ] **Step 2: 验证编译**

Run: `cd packages/api && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 手动验证服务启动（用户操作）**

提示用户重启 API 服务后访问：
- `http://localhost:13180/docs` — 应显示 Scalar UI（目前无路由 schema，仅显示 health）
- `http://localhost:13180/openapi/json` — 应返回合法的 OpenAPI JSON

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/app.ts
git commit -m "feat(api): register @fastify/swagger + Scalar UI for OpenAPI documentation"
```

---

### Task 6: 迁移 projects.ts 路由到原生 schema

**Files:**
- Modify: `packages/api/src/routes/projects.ts`

> **迁移规则**: 每个 `preValidation: validate(...)` 替换为 `schema: { params/body/querystring/response/tags/summary }`。
> Handler 中的 `as Record<string, unknown>` 类型断言暂时保留（确保现有测试不受影响），后续统一清理。

- [ ] **Step 1: 重写 projects.ts 路由注册和 Handlers**

将整个文件替换为以下内容（注意 import 变更 + schema 替换 preValidation）：

```typescript
/**
 * @module routes/projects
 * @description 项目管理路由：列表(F-M1-01) + 创建(F-M1-02) + 详情(F-M1-03) +
 *              编辑(F-M1-04) + 归档(F-M1-05)。Fastify 插件形式，前缀 /api/v1/projects。
 *              使用 Fastify 原生 schema 进行请求校验 + OpenAPI 文档生成。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db.js';
import * as projectService from '../services/project.service.js';
import {
  // 请求 Schema（输入）
  ProjectListQuery,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectIdParam,
  ArchiveProjectInput,
  // 响应 Schema（输出 + 信封）
  ProjectListResponse,
  ProjectDetailResponse,
  ProjectSummaryResponse,
  CreateProjectResponse,
  // 错误 Schema
  ErrorResponse,
} from '@apm/validation-schemas';

/**
 * 注册项目管理路由（F-M1-01 ~ F-M1-05）。
 *
 * 端点列表：
 * - GET    /              → 项目列表 (F-M1-01)
 * - POST   /              → 创建项目 (F-M1-02)
 * - GET    /:id           → 项目详情 (F-M1-03)
 * - GET    /:id/summary   → 项目摘要统计 (F-M1-03)
 * - PUT    /:id           → 编辑项目 (F-M1-04)
 * - PATCH  /:id/status    → 归档/恢复 (F-M1-05)
 */
export default async function projectRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------------
  // F-M1-01: 项目列表 (GET /api/v1/projects)
  // ---------------------------------------------------------------
  app.get('/', {
    schema: {
      querystring: ProjectListQuery,
      response: {
        200: ProjectListResponse,
        400: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Projects'],
      summary: '查询项目列表',
      description: '支持搜索、状态筛选、分页、排序。B-M1-01~B-M1-05, B-M1-88 内嵌摘要。',
    },
  }, listProjectsHandler);

  // ---------------------------------------------------------------
  // F-M1-02: 创建项目 (POST /api/v1/projects)
  // ---------------------------------------------------------------
  app.post('/', {
    schema: {
      body: CreateProjectInput,
      response: {
        201: CreateProjectResponse,
        400: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Projects'],
      summary: '创建项目',
      description: 'B-M1-10(name唯一) / B-M1-11(默认值) / B-M1-13(并发安全)',
    },
  }, createProjectHandler);

  // ---------------------------------------------------------------
  // F-M1-03: 项目详情 (GET /api/v1/projects/:id)
  // ---------------------------------------------------------------
  app.get('/:id', {
    schema: {
      params: ProjectIdParam,
      response: {
        200: ProjectDetailResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Projects'],
      summary: '查询项目详情',
      description: '返回完整字段含 description/config。B-M1-14',
    },
  }, getProjectDetailHandler);

  // ---------------------------------------------------------------
  // F-M1-03: 项目摘要统计 (GET /api/v1/projects/:id/summary)
  // ---------------------------------------------------------------
  app.get('/:id/summary', {
    schema: {
      params: ProjectIdParam,
      response: {
        200: ProjectSummaryResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Projects'],
      summary: '查询项目摘要统计',
      description: '6 个子模块计数聚合。B-M1-15(零计数) / B-M1-16(并行查询)',
    },
  }, getProjectSummaryHandler);

  // ---------------------------------------------------------------
  // F-M1-04: 编辑项目 (PUT /api/v1/projects/:id?version=N)
  // ---------------------------------------------------------------
  app.put('/:id', {
    schema: {
      params: ProjectIdParam,
      body: UpdateProjectInput,
      querystring: Type.Object({
        version: Type.Optional(Type.Number({ minimum: 1 })),
      }),
      response: {
        200: ProjectDetailResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Projects'],
      summary: '编辑项目',
      description: 'PUT 全量语义。version 通过 ?version=N 传入（乐观锁 G-M1-07）。B-M1-18~B-M1-22',
    },
  }, updateProjectHandler);

  // ---------------------------------------------------------------
  // F-M1-05: 归档/恢复 (PATCH /api/v1/projects/:id/status)
  // ---------------------------------------------------------------
  app.patch('/:id/status', {
    schema: {
      params: ProjectIdParam,
      body: ArchiveProjectInput,
      response: {
        200: ProjectDetailResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Projects'],
      summary: '归档或恢复项目',
      description: 'B-M1-23(乐观锁) / B-M1-24(状态转换) / B-M1-25(不级联)',
    },
  }, archiveProjectHandler);
}

// ============================================================
// Route Handlers
// ============================================================

/**
 * F-M1-01: 项目列表处理器。
 *
 * B-rule coverage: B-M1-01~B-M1-05（查询规则全部在 Service 层实现）
 */
async function listProjectsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { search, status, page, pageSize, sort, order } = request.query as Record<string, unknown>;
  const result = await projectService.listProjects(db, {
    search: search as string,
    status: status as string,
    page: page as number,
    pageSize: pageSize as number,
    sort: sort as string,
    order: order as 'asc' | 'desc',
  });

  return { data: result.data, meta: result.meta };
}

/**
 * F-M1-02: 创建项目处理器。
 *
 * B-rule coverage: B-M1-10(name唯一) / B-M1-11(默认值) / B-M1-13(并发安全)
 */
async function createProjectHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as typeof CreateProjectInput.static;

  const project = await projectService.createProject(db, body);

  reply.code(201);
  return { data: project };
}

/**
 * F-M1-03: 项目详情处理器。
 *
 * B-rule coverage: B-M1-14(完整字段返回)
 */
async function getProjectDetailHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const project = await projectService.getProjectById(db, id);

  return { data: project };
}

/**
 * F-M1-03: 项目摘要统计处理器。
 *
 * B-rule coverage: B-M1-15(零计数显示) / B-M1-16(并行查询)
 */
async function getProjectSummaryHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const summary = await projectService.getProjectSummary(db, id);

  return { data: summary };
}

/**
 * F-M1-04: 编辑项目处理器。
 *
 * B-rule coverage: B-M1-18(name格式) / B-M1-19(name长度) / B-M1-20(name唯一) /
 *                  B-M1-21(displayName必填) / B-M1-22(归档保护) / G-M1-07(乐观锁)
 */
async function updateProjectHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as typeof UpdateProjectInput.static;
  const version = Number((request.query as Record<string, unknown>).version);

  const project = await projectService.updateProject(db, id, body, version);

  return { data: project };
}

/**
 * F-M1-05: 归档/恢复项目处理器。
 *
 * B-rule coverage: B-M1-06(前端确认对话框) / B-M1-07(幂等) /
 *              B-M1-08(不级联) / B-M1-23(乐观锁) / B-M1-24(状态转换)
 */
async function archiveProjectHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as typeof ArchiveProjectInput.static;

  const project = await projectService.archiveProject(db, id, body);

  return { data: project };
}
```

注意：需要在文件顶部补充 `Type` 的导入（因为 PUT 端点的 querystring 使用了内联 `Type.Object`）：

```typescript
import { Type } from '@sinclair/typebox';
```

将其添加到现有的 `import { ... } from '@apm/validation-schemas';` 之前或之后均可。

- [ ] **Step 2: 验证编译**

Run: `cd packages/api && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 运行现有 API 测试确认零回归**

Run: `cd packages/api && npx vitest run tests/project-management/ --reporter=verbose`
Expected: 10/10 passed (f-m1-01 ~ f-m1-03 全部测试)

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes/projects.ts
git commit -m "feat(api): migrate projects routes to native Fastify schema for OpenAPI"
```

---

### Task 7: 迁移 organization.ts 路由到原生 schema

**Files:**
- Modify: `packages/api/src/routes/organization.ts`

> 这是最大的改动文件（21 个端点）。每个端点的 `preValidation: validate(...)` → `schema: {...}`。
> organization.ts 中有大量内联 `Type.Object({ id: Type.String({ format: 'uuid' }) })` 作为 params schema，
> 迁移时统一引用 base.ts 中的 `IdSchema` 或定义局部常量复用。

- [ ] **Step 1: 重写 organization.ts**

将整个文件替换为：

```typescript
/**
 * @module routes/organization
 * @description 组织管理路由：公司(F-M1-06) + 部门(F-M1-07) + 角色(F-M1-08) + 外部实体(F-M1-09)。
 *              Fastify 插件形式注册，前缀 /api/v1/projects/:projectId。
 *              使用 Fastify 原生 schema 进行请求校验 + OpenAPI 文档生成。
 *
 * 端点清单（共 21 个）：
 *
 * **Company (F-M1-06)** — 5 个端点
 * - GET    /companies              → 公司列表
 * - POST   /companies              → 创建公司
 * - GET    /companies/:id          → 公司详情
 * - PUT    /companies/:id          → 更新公司
 * - DELETE /companies/:id          → 删除公司
 *
 * **Department (F-M1-07)** — 6 个端点
 * - GET    /companies/:companyId/departments       → 部门列表
 * - POST   /companies/:companyId/departments       → 创建部门
 * - GET    /departments/:id                        → 部门详情
 * - PUT    /departments/:id                        → 更新部门
 * - DELETE /departments/:id                        → 删除部门
 * - GET    /companies/:companyId/departments/tree  → 部门树
 *
 * **Role (F-M1-08)** — 5 个端点
 * - GET    /roles                  → 角色列表
 * - POST   /roles                  → 创建角色
 * - GET    /roles/:id              → 角色详情
 * - PUT    /roles/:id              → 更新角色
 * - DELETE /roles/:id              → 删除角色
 *
 * **External Entity (F-M1-09)** — 5 个端点
 * - GET    /external-entities      → 外部实体列表
 * - POST   /external-entities      → 创建外部实体
 * - GET    /external-entities/:id  → 外部实体详情
 * - PUT    /external-entities/:id  → 更新外部实体
 * - DELETE /external-entities/:id  → 删除外部实体
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '../db.js';
import * as orgService from '../services/organization.service.js';
import {
  // 请求 Schema（输入）
  CreateCompanyInput,
  UpdateCompanyInput,
  CompanyListQuery,
  CreateDepartmentInput,
  UpdateDepartmentInput,
  DepartmentListQuery,
  CreateRoleInput,
  UpdateRoleInput,
  RoleListQuery,
  CreateExternalEntityInput,
  UpdateExternalEntityInput,
  ExternalEntityListQuery,
  // 基础 Schema
  IdSchema,
  // 响应 Schema（输出 + 信封）
  CompanyListResponse,
  CompanyDetailResponse,
  DepartmentListResponse,
  DepartmentTreeResponse,
  DepartmentDetailResponse,
  RoleListResponse,
  RoleDetailResponse,
  ExternalEntityListResponse,
  ExternalEntityDetailResponse,
  DeleteResponse,
  // 错误 Schema
  ErrorResponse,
} from '@apm/validation-schemas';

/** 复用的 UUID path param schema */
const UuidParam = Type.Object({ id: IdSchema });
const CompanyIdParam = Type.Object({ companyId: IdSchema });

export default async function organizationRoutes(app: FastifyInstance) {
  // ================================================================
  // F-M1-06: Company Routes (前缀: /companies)
  // ================================================================

  /** GET /companies — 公司列表 */
  app.get('/companies', {
    schema: {
      querystring: CompanyListQuery,
      response: { 200: CompanyListResponse, 400: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询公司列表',
      description: 'B-M1-26(排序) / B-M1-27(双字段搜索)',
    },
  }, listCompaniesHandler);

  /** POST /companies — 创建公司 */
  app.post('/companies', {
    schema: {
      body: CreateCompanyInput,
      response: { 201: CompanyDetailResponse, 400: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '创建公司',
      description: 'B-M1-28~B-M1-31',
    },
  }, createCompanyHandler);

  /** GET /companies/:id — 公司详情 */
  app.get('/companies/:id', {
    schema: {
      params: UuidParam,
      response: { 200: CompanyDetailResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询公司详情',
    },
  }, getCompanyHandler);

  /** PUT /companies/:id — 更新公司 */
  app.put('/companies/:id', {
    schema: {
      params: UuidParam,
      body: UpdateCompanyInput,
      response: { 200: CompanyDetailResponse, 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '更新公司',
      description: 'B-M1-37(乐观锁)',
    },
  }, updateCompanyHandler);

  /** DELETE /companies/:id — 删除公司 */
  app.delete('/companies/:id', {
    schema: {
      params: UuidParam,
      response: { 200: DeleteResponse, 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '删除公司',
      description: 'B-M1-39(级联删除部门)',
    },
  }, deleteCompanyHandler);

  // ================================================================
  // F-M1-07: Department Routes (前缀: /companies/:companyId/departments)
  // ================================================================

  /** GET /companies/:companyId/departments — 部门列表 */
  app.get('/companies/:companyId/departments', {
    schema: {
      params: CompanyIdParam,
      querystring: DepartmentListQuery,
      response: { 200: DepartmentListResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询部门列表',
      description: 'B-M1-41(排序) / B-M1-42(搜索)',
    },
  }, listDepartmentsHandler);

  /** GET /companies/:companyId/departments/tree — 部门树 */
  app.get('/companies/:companyId/departments/tree', {
    schema: {
      params: CompanyIdParam,
      response: { 200: DepartmentTreeResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询部门树形结构',
    },
  }, getDepartmentTreeHandler);

  /** POST /companies/:companyId/departments — 创建部门 */
  app.post('/companies/:companyId/departments', {
    schema: {
      params: CompanyIdParam,
      body: CreateDepartmentInput,
      response: { 201: DepartmentDetailResponse, 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '创建部门',
      description: 'B-M1-50(name唯一) / B-M1-51(parentId校验)',
    },
  }, createDepartmentHandler);

  /** GET /departments/:id — 部门详情 */
  app.get('/departments/:id', {
    schema: {
      params: UuidParam,
      response: { 200: DepartmentDetailResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询部门详情',
    },
  }, getDepartmentHandler);

  /** PUT /departments/:id — 更新部门 */
  app.put('/departments/:id', {
    schema: {
      params: UuidParam,
      body: UpdateDepartmentInput,
      response: { 200: DepartmentDetailResponse, 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '更新部门',
      description: 'B-M1-52b(环检测) / B-M1-37(乐观锁)',
    },
  }, updateDepartmentHandler);

  /** DELETE /departments/:id — 删除部门 */
  app.delete('/departments/:id', {
    schema: {
      params: UuidParam,
      response: { 200: DeleteResponse, 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '删除部门',
      description: 'B-M1-39(级联删除子部门)',
    },
  }, deleteDepartmentHandler);

  // ================================================================
  // F-M1-08: Role Routes (前缀: /roles)
  // ================================================================

  /** GET /roles — 角色列表 */
  app.get('/roles', {
    schema: {
      querystring: RoleListQuery,
      response: { 200: RoleListResponse, 400: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询角色列表',
      description: 'B-M1-43(排序) / B-M1-44(搜索) / B-M1-45(部门筛选)',
    },
  }, listRolesHandler);

  /** POST /roles — 创建角色 */
  app.post('/roles', {
    schema: {
      body: CreateRoleInput,
      response: { 201: RoleDetailResponse, 400: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '创建角色',
      description: 'B-M1-47(name唯一) / B-M1-48(departmentId校验)',
    },
  }, createRoleHandler);

  /** GET /roles/:id — 角色详情 */
  app.get('/roles/:id', {
    schema: {
      params: UuidParam,
      response: { 200: RoleDetailResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询角色详情',
    },
  }, getRoleHandler);

  /** PUT /roles/:id — 更新角色 */
  app.put('/roles/:id', {
    schema: {
      params: UuidParam,
      body: UpdateRoleInput,
      response: { 200: RoleDetailResponse, 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '更新角色',
      description: 'B-M1-37(乐观锁)',
    },
  }, updateRoleHandler);

  /** DELETE /roles/:id — 删除角色 */
  app.delete('/roles/:id', {
    schema: {
      params: UuidParam,
      response: { 200: DeleteResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '删除角色',
    },
  }, deleteRoleHandler);

  // ================================================================
  // F-M1-09: External Entity Routes (前缀: /external-entities)
  // ================================================================

  /** GET /external-entities — 外部实体列表 */
  app.get('/external-entities', {
    schema: {
      querystring: ExternalEntityListQuery,
      response: { 200: ExternalEntityListResponse, 400: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询外部实体列表',
      description: 'B-M1-54(排序) / B-M1-55(搜索)',
    },
  }, listExternalEntitiesHandler);

  /** POST /external-entities — 创建外部实体 */
  app.post('/external-entities', {
    schema: {
      body: CreateExternalEntityInput,
      response: { 201: ExternalEntityDetailResponse, 400: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '创建外部实体',
      description: 'B-M1-57(name唯一) / B-M1-58(entityType校验)',
    },
  }, createExternalEntityHandler);

  /** GET /external-entities/:id — 外部实体详情 */
  app.get('/external-entities/:id', {
    schema: {
      params: UuidParam,
      response: { 200: ExternalEntityDetailResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询外部实体详情',
    },
  }, getExternalEntityHandler);

  /** PUT /external-entities/:id — 更新外部实体 */
  app.put('/external-entities/:id', {
    schema: {
      params: UuidParam,
      body: UpdateExternalEntityInput,
      response: { 200: ExternalEntityDetailResponse, 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '更新外部实体',
      description: 'B-M1-37(乐观锁)',
    },
  }, updateExternalEntityHandler);

  /** DELETE /external-entities/:id — 删除外部实体 */
  app.delete('/external-entities/:id', {
    schema: {
      params: UuidParam,
      response: { 200: DeleteResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '删除外部实体',
    },
  }, deleteExternalEntityHandler);
}

// ============================================================
// Route Handlers — Company (F-M1-06)
// ============================================================

async function listCompaniesHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { projectId } = request.params as { projectId: string };
  const { search, page, pageSize } = request.query as Record<string, unknown>;
  return orgService.listCompanies(db, projectId, {
    search: search as string | undefined,
    page: page as number | undefined,
    pageSize: pageSize as number | undefined,
  });
}

async function createCompanyHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { projectId } = request.params as { projectId: string };
  const body = request.body as Record<string, unknown>;
  const company = await orgService.createCompany(db, projectId, body);
  return { data: company };
}

async function getCompanyHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const company = await orgService.getCompanyById(db, id);
  return { data: company };
}

async function updateCompanyHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  const company = await orgService.updateCompany(db, id, body);
  return { data: company };
}

async function deleteCompanyHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await orgService.deleteCompany(db, id);
  return { success: true };
}

// ============================================================
// Route Handlers — Department (F-M1-07)
// ============================================================

async function listDepartmentsHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { companyId } = request.params as { companyId: string };
  const { search, page, pageSize } = request.query as Record<string, unknown>;
  return orgService.listDepartments(db, companyId, {
    search: search as string | undefined,
    page: page as number | undefined,
    pageSize: pageSize as number | undefined,
  });
}

async function getDepartmentTreeHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { companyId } = request.params as { companyId: string };
  const tree = await orgService.getDepartmentTree(db, companyId);
  return { data: tree };
}

async function createDepartmentHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { companyId } = request.params as { companyId: string };
  const body = request.body as Record<string, unknown>;
  const dept = await orgService.createDepartment(db, companyId, body);
  return { data: dept };
}

async function getDepartmentHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const dept = await orgService.getDepartmentById(db, id);
  return { data: dept };
}

async function updateDepartmentHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  const dept = await orgService.updateDepartment(db, id, body);
  return { data: dept };
}

async function deleteDepartmentHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await orgService.deleteDepartment(db, id);
  return { success: true };
}

// ============================================================
// Route Handlers — Role (F-M1-08)
// ============================================================

async function listRolesHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { projectId } = request.params as { projectId: string };
  const { search, departmentId, page, pageSize } = request.query as Record<string, unknown>;
  return orgService.listRoles(db, projectId, {
    search: search as string | undefined,
    departmentId: departmentId as string | undefined,
    page: page as number | undefined,
    pageSize: pageSize as number | undefined,
  });
}

async function createRoleHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { projectId } = request.params as { projectId: string };
  const body = request.body as Record<string, unknown>;
  const role = await orgService.createRole(db, projectId, body);
  return { data: role };
}

async function getRoleHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const role = await orgService.getRoleById(db, id);
  return { data: role };
}

async function updateRoleHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  const role = await orgService.updateRole(db, id, body);
  return { data: role };
}

async function deleteRoleHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await orgService.deleteRole(db, id);
  return { success: true };
}

// ============================================================
// Route Handlers — External Entity (F-M1-09)
// ============================================================

async function listExternalEntitiesHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { projectId } = request.params as { projectId: string };
  const { search, page, pageSize } = request.query as Record<string, unknown>;
  return orgService.listExternalEntities(db, projectId, {
    search: search as string | undefined,
    page: page as number | undefined,
    pageSize: pageSize as number | undefined,
  });
}

async function createExternalEntityHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { projectId } = request.params as { projectId: string };
  const body = request.body as Record<string, unknown>;
  const entity = await orgService.createExternalEntity(db, projectId, body);
  return { data: entity };
}

async function getExternalEntityHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const entity = await orgService.getExternalEntityById(db, id);
  return { data: entity };
}

async function updateExternalEntityHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  const entity = await orgService.updateExternalEntity(db, id, body);
  return { data: entity };
}

async function deleteExternalEntityHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await orgService.deleteExternalEntity(db, id);
  return { success: true };
}
```

- [ ] **Step 2: 验证编译**

Run: `cd packages/api && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 运行全量 API 测试确认零回归**

Run: `cd packages/api && npx vitest run tests/ --reporter=verbose`
Expected: 全部通过（project-management + organization 全部测试）

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes/organization.ts
git commit -m "feat(api): migrate organization routes to native Fastify schema for OpenAPI"
```

---

### Task 8: 删除 validate.ts 并清理

**Files:**
- Delete: `packages/api/src/routes/common/validate.ts`

- [ ] **Step 1: 确认无其他文件引用 validate.ts**

Run: `grep -r "from.*validate" packages/api/src/ --include="*.ts" | grep -v node_modules`
Expected: 仅 `projects.ts` 和 `organization.ts` 引用（已在 Task 6/7 中移除）

如果仍有引用，先处理完再继续。

- [ ] **Step 2: 删除 validate.ts**

```bash
rm packages/api/src/routes/common/validate.ts
```

如果 `common/` 目录下无其他文件则一并删除：

```bash
rmdir packages/api/src/routes/common/ 2>/dev/null || echo "目录非空或不存在，跳过"
```

- [ ] **Step 3: 验证编译 + 测试**

Run:
```bash
cd packages/api && npx tsc --noEmit && npx vitest run tests/ --reporter=verbose
```
Expected: 编译无错误 + 全部测试通过

- [ ] **Step 4: Commit**

```bash
git add -A packages/api/src/routes/common/
git commit -m "refactor(api): remove custom validate middleware (replaced by native Fastify schema)"
```

---

### Task 9: 编写 OpenAPI 合法性测试

**Files:**
- Create: `packages/api/tests/openapi/openapi-schema.test.ts`

- [ ] **Step 1: 创建测试目录和文件**

```bash
mkdir -p packages/api/tests/openapi
```

写入以下内容到 `packages/api/tests/openapi/openapi-schema.test.ts`：

```typescript
/**
 * @module openapi-schema.test
 * @description OpenAPI Spec 合法性验证：确保 /openapi/json 端点输出符合规范，
 *              覆盖所有已注册端点且每个端点都有 response schema 定义。
 */
import { describe, test, expect, beforeAll } from 'vitest';
import { app } from '../../src/app.js';

describe('OpenAPI Spec 合法性', () => {
  beforeAll(async () => {
    await app.ready();
  });

  test('openapi.json 可访问且符合 OpenAPI 3.0.3 规范', async () => {
    const resp = await app.inject().get('/openapi/json');
    expect(resp.statusCode).toBe(200);

    const spec = resp.json();

    // 基本 OpenAPI 结构
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toBe('APM API');
    expect(spec.info.version).toBe('1.0.0');
    expect(spec.paths).toBeDefined();
    expect(spec.components?.schemas).toBeDefined();
  });

  test('覆盖所有 28 个端点（1 health + 6 project + 21 organization）', async () => {
    const resp = await app.inject().get('/openapi/json');
    const spec = resp.json();

    const paths = Object.keys(spec.paths);
    // paths 包含路径键如 /api/v1/health, /api/v1/projects 等
    // 统计所有 method 数量
    let totalEndpoints = 0;
    for (const methods of Object.values(spec.paths)) {
      totalEndpoints += Object.keys(methods).filter(
        (m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m)
      ).length;
    }

    expect(totalEndpoints).toBeGreaterThanOrEqual(28);
  });

  test('每个端点都声明了 response schema', async () => {
    const resp = await app.inject().get('/openapi/json');
    const spec = resp.json();

    const missingResponse: string[] = [];
    const missingSuccessStatus: string[] = [];

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const label = `${method.toUpperCase()} ${path}`;

        if (!operation.response) {
          missingResponse.push(label);
          continue;
        }

        const statusCodes = Object.keys(operation.response);
        const hasSuccess = statusCodes.some((s) => {
          const code = Number(s);
          return code >= 200 && code < 300;
        });

        if (!hasSuccess) {
          missingSuccessStatus.push(label);
        }
      }
    }

    expect(missingResponse, '以下端点缺少 response 定义').toHaveLength(0);
    expect(missingSuccessStatus, '以下端点缺少 2xx 成功响应').toHaveLength(0);
  });

  test('Scalar UI (/docs) 可访问', async () => {
    const resp = await app.inject().get('/docs');
    expect(resp.statusCode).toBe(200);
    expect(resp.headers['content-type']).toContain('text/html');
  });

  test('错误响应 Schema 在 components.schemas 中注册', async () => {
    const resp = await app.inject().get('/openapi/json');
    const spec = resp.json();

    const schemas = spec.components?.schemas ?? {};
    // ErrorResponse 至少应在某处被引用（通过 $ref 或内联）
    // 验证 components 中存在 Error 相关 schema
    const hasErrorSchema = Object.keys(schemas).some((name) =>
      name.toLowerCase().includes('error')
    );
    expect(hasErrorSchema).toBe(true);
  });
});
```

- [ ] **Step 2: 运行 OpenAPI 测试**

Run: `cd packages/api && npx vitest run tests/openapi/openapi-schema.test.ts --reporter=verbose`
Expected: 5/5 passed

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/openapi/
git commit -m "test(api): add OpenAPI spec validity and coverage tests"
```

---

### Task 10: 全量回归测试 + 最终验证

**Files:** 无代码变更，纯验证步骤

- [ ] **Step 1: 运行全量 API 测试**

Run: `cd packages/api && npx vitest run --reporter=verbose`
Expected: 全部通过（原有测试 + 新增 OpenAPI 测试）

- [ ] **Step 2: 手动验证 Swagger UI（用户操作）**

请用户重启 API 服务后访问：
1. `http://localhost:13180/docs` — 确认 Scalar UI 正常渲染，左侧显示 Health / Projects / Organization 三个 tag
2. 点击任意端点（如 Projects > 查询项目列表）— 确认显示完整的 request/response schema
3. 在 Scalar UI 中点击 Try it out → Execute — 确认能正常发送请求并看到响应
4. 访问 `http://localhost:13180/openapi/json` — 确认 JSON 格式正确，可用作代码生成输入

- [ ] **Step 3: 最终 Commit（如有遗漏修复）**

```bash
git add -A
git commit -m "fix: final adjustments after OpenAPI migration review"
```

---

## Self-Review 检查清单

### Spec 覆盖度

| 设计文档要求 | 对应 Task | 状态 |
|-------------|---------|------|
| @fastify/swagger 注册 | Task 5 | ✅ |
| Scalar UI 注册 | Task 5 | ✅ |
| OpenAPI 3.0.3 版本 | Task 5 (app.ts) | ✅ |
| 通用响应信封 (SuccessEnvelope/PaginatedEnvelope/DeleteResponse) | Task 2 (response.ts) | ✅ |
| 统一错误 Schema (ErrorResponse) | Task 2 (response.ts) | ✅ |
| 400/404/409/500 错误映射 | Task 2 + Task 6/7 (每路由 response) | ✅ |
| Project 响应 Schema (ListItem/Detail/Summary) | Task 3 | ✅ |
| Organization 响应 Schema (4 种实体 × Detail/List) | Task 4 | ✅ |
| projects.ts 6 端点迁移 | Task 6 | ✅ |
| organization.ts 21 端点迁移 | Task 7 | ✅ |
| 删除 validate.ts | Task 8 | ✅ |
| OpenAPI 合法性测试 | Task 9 | ✅ |
| Scalar UI 可访问性测试 | Task 9 | ✅ |

### 占位符扫描

- [x] 无 TBD / TODO
- [x] 无 "add appropriate handling" 类模糊描述
- [x] 每个 Step 都有具体代码或命令
- [x] 无 "Similar to Task N" 引用（重复了实际代码）

### 类型一致性

- [x] `ProjectListItem` 含 `summary` 内嵌字段（对齐 shared types B-M1-88）
- [x] `ProjectListItem` 不含 `createdAt`（对齐 B-M1-05）
- [x] 所有实体 Detail Schema 含 `contactInfo`, `sortOrder`, `config`（对齐 shared types）
- [x] Company 含 `companyType`，Department 含 `companyId/parentId`，Role 含 `departmentId/category/actions/decisions`，ExternalEntity 含 `entityType`
- [x] `ErrorResponse.requestId` 用 `Union([String, Number, Null])` 兼容 Fastify 实际行为
