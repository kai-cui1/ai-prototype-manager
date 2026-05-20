# OpenAPI 完整契约体系 — 技术设计

> **日期**: 2026-05-14
> **状态**: 已批准，待实施
> **关联**: Phase 1 M1 模块（项目管理 + 组织管理）
> **前置**: F-M1-01 ~ F-M1-09 全部 API 测试通过 ✅

## 1. 目标与范围

### 1.1 目标

为 APM 后端 API 建立完整的 OpenAPI 3.0.3 契约文档，满足以下需求：

1. **完整契约**：每个端点的 request/response 全量定义，可作为前后端之间的正式 API 规范
2. **交互式文档**：通过 Scalar UI 提供在线浏览和 Try it out 调试能力
3. **机器可读**：输出标准 openapi.json，可用于 CI 校验、代码生成、第三方工具集成
4. **类型安全**：迁移到 Fastify 原生 schema 后，Handler 层获得自动类型推断

### 1.2 范围

| 包含 | 不包含 |
|------|--------|
| Phase 1 全部 27 个 API 端点 + health | Phase 2~6 端点（后续追加） |
| 成功响应 + 错误响应全量 Schema | 认证/授权（securitySchemes 预留但不启用） |
| Swagger Spec 生成 + Scalar UI 渲染 | SDK 代码生成（后续按需） |
| 迁移 validate() → 原生 schema | Service 层 / 前端 api-client 改动 |

## 2. 技术选型

### 2.1 组件清单

| 层 | 选择 | 理由 |
|---|------|------|
| **OpenAPI 版本** | 3.0.3 | 最稳定、工具链支持最广泛（vs 3.1 较新但兼容性不足） |
| **Spec 生成器** | `@fastify/swagger` ^9.x | Fastify 官方插件，从路由 schema 自动生成 openapi.json，无替代品 |
| **UI 渲染器** | `@scalar/fastify-api-reference` ^1.55 | 现代 UI、暗色模式、内联交互；社区趋势选择（Hono/Nuxt/Laravel 已切换） |
| **Schema 语言** | TypeBox (`@sinclair/typebox` ^0.34) | 已有基础设施，Fastify 5 原生支持 |

### 2.2 为什么不选 Swagger UI

| 维度 | Swagger UI | Scalar |
|------|-----------|--------|
| 视觉风格 | 2018 经典灰蓝 | 2025 现代简洁白 |
| 暗色模式 | 无 | 原生支持 |
| Try it out | 底部折叠面板 | 内联请求/响应 |
| 社区趋势 | 维护中不再活跃开发 | 快速增长，多框架默认选择 |
| Fastify 插件 | `@fastify/swagger-ui` | `@scalar/fastify-api-reference` |

## 3. 架构设计

### 3.1 整体架构图

```
┌──────────────────────────────────────────────────────────┐
│                     app.ts                                │
│                                                            │
│  ┌──────────────────┐   ┌──────────────────────────────┐  │
│  │ @fastify/swagger  │──▶│ openapi.json (自动生成)       │  │
│  │ (Spec 生成器)     │   │ /openapi/json 端点            │  │
│  └──────────────────┘   └──────────┬───────────────────┘  │
│                                     │                      │
│  ┌──────────────────────────────────▼──────────────────┐  │
│  │         @scalar/fastify-api-reference                │  │
│  │         (UI 渲染器) → /docs                          │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              路由层 (改用原生 schema)                  │  │
│  │                                                      │  │
│  │  projects.ts    schema: { querystring, body, params,  │  │
│  │                         response, tags, summary }     │  │
│  │  organization.ts (同上)                               │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │                                  │
│  ┌──────────────────────▼──────────────────────────────┐  │
│  │           @apm/validation-schemas (扩展)              │  │
│  │                                                      │  │
│  │  base.ts             ← 现有输入 Schema，不变          │  │
│  │  project.schema.ts   ← + ProjectDetail/Summary/List  │  │
│  │  organization.schema.ts ← + 各实体 Detail Schema      │  │
│  │  response.ts         ← 【新增】通用信封 + 错误 Schema  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ❌ routes/common/validate.ts  ← 删除（被原生 schema 替代） │
└──────────────────────────────────────────────────────────┘
```

### 3.2 数据流

```
开发者编写 TypeBox Schema
        │
        ▼
  路由 schema: { body: CreateProjectInput, response: { 201: CreateProjectResponse } }
        │
        ├──▶ Fastify 运行时：自动校验请求 + 序列化响应（替代 validate.ts）
        │
        └──▶ @fastify/swagger：扫描所有路由 schema → 生成 openapi.json
                │
                └──▶ Scalar UI：渲染 openapi.json 为交互式文档页面
```

## 4. 详细设计

### 4.1 app.ts — 插件注册

在 CORS 注册之后、全局 setErrorHandler 之前插入：

```typescript
import swagger from '@fastify/swagger';
import scalarApiReference from '@scalar/fastify-api-reference';

// ============================================
// OpenAPI 文档（Swagger Spec + Scalar UI）
// ============================================

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

**暴露端点**：

| 路径 | 用途 |
|------|------|
| `/docs` | Scalar 交互式 API 文档 UI |
| `/openapi/json` | 原始 OpenAPI 3.0.3 JSON（可用于代码生成 / CI 校验） |

### 4.2 通用响应 Schema（response.ts）

新增文件 `packages/validation-schemas/src/response.ts`：

```typescript
import { Type } from '@sinclair/typebox';

// ============================================================
// 分页元数据
// ============================================================

export const PaginationMeta = Type.Object({
  page: Type.Number({ minimum: 1 }),
  pageSize: Type.Union([Type.Literal(10), Type.Literal(20), Type.Literal(50), Type.Literal(100)]),
  total: Type.Number({ minimum: 0 }),
  totalPages: Type.Number({ minimum: 0 }),
});

// ============================================================
// 成功响应信封
// ============================================================

/** 单资源成功响应: { data: T } */
export const SuccessEnvelope = <T extends TSchema>(data: T) =>
  Type.Object({ data }, { $id: 'SuccessEnvelope' });

/** 分页列表成功响应: { data: T[], meta } */
export const PaginatedEnvelope = <T extends TSchema>(items: T) =>
  Type.Object({
    data: Type.Array(items),
    meta: PaginationMeta,
  }, { $id: 'PaginatedEnvelope' });

/** 删除操作响应: { success: true } */
export const DeleteResponse = Type.Object({
  success: Type.Literal(true),
});

// ============================================================
// 错误响应 Schema
// ============================================================

/** 单条校验错误明细 */
export const ErrorDetail = Type.Object({
  field: Type.String(),
  message: Type.String(),
});

/** 统一错误信封 */
export const ErrorResponse = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    requestId: [Type.String(), Type.Null()],
    details: Type.Optional(Type.Array(ErrorDetail)),
  }),
});
```

### 4.3 错误响应映射表

| HTTP Status | error.code | 触发场景 | Handler 来源 |
|-------------|-----------|---------|-------------|
| **400** | `VALIDATION_FAILED` | 请求参数校验失败 | Fastify 原生 schema 校验（替代 validate.ts） |
| **404** | `NOT_FOUND` | 资源不存在 | Service 层 `notFound()` 抛出 |
| **409** | `CONFLICT` | 唯一约束冲突 / 状态转换非法 | Service 层业务校验 |
| **500** | `INTERNAL_ERROR` | 未预期异常 | 全局 setErrorHandler |

每个路由的 `schema.response` 必须声明该端点可能返回的所有状态码：

```typescript
schema: {
  response: {
    200: ProjectListResponse,   // GET 成功
    400: ErrorResponse,         // 参数错误
    500: ErrorResponse,         // 服务端异常
  },
}
```

### 4.4 项目模块响应 Schema 扩展

在 `packages/validation-schemas/src/project.schema.ts` 中追加：

```typescript
import { SuccessEnvelope, PaginatedEnvelope, DeleteResponse } from './response.js';

// ---------------------------------------------------------------
// Response Schemas for Project Endpoints
// ---------------------------------------------------------------

/** 项目列表项（不含 description/config，B-M1-14 规定列表裁剪） */
export const ProjectListItem = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  status: StatusSchema,
  version: VersionSchema,
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

/** GET /projects 响应 */
export const ProjectListResponse = PaginatedEnvelope(ProjectListItem);

/** 项目详情完整字段（含 description + config，B-M1-14） */
export const ProjectDetail = Type.Object({
  id: IdSchema,
  name: NameSchema,
  displayName: DisplayNameSchema,
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  status: StatusSchema,
  version: VersionSchema,
  config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

/** GET /projects/:id 响应 */
export const ProjectDetailResponse = SuccessEnvelope(ProjectDetail);

/** 项目摘要统计（6 个子模块计数，B-M1-15 零计数显示 0） */
export const ProjectSummary = Type.Object({
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
});

/** GET /projects/:id/summary 响应 */
export const ProjectSummaryResponse = SuccessEnvelope(ProjectSummary);

/** POST /projects 创建成功响应 (201) */
export const CreateProjectResponse = SuccessEnvelope(ProjectDetail);
```

### 4.5 组织模块响应 Schema 扩展

在 `packages/validation-schemas/src/organization.schema.ts` 中追加类似结构：

| Schema 名 | 对应端点 | 核心字段 |
|-----------|---------|---------|
| `CompanyListItem` / `CompanyDetail` | Company CRUD | id, name, projectId, createdAt, updatedAt |
| `CompanyListResponse` | GET /companies | PaginatedEnvelope<CompanyListItem> |
| `DepartmentListItem` / `DepartmentDetail` | Department CRUD | id, name, companyId, parentId, sortOrder, ... |
| `DepartmentListResponse` | GET /.../departments | PaginatedEnvelope<DepartmentListItem> |
| `DepartmentTreeResponse` | GET /.../departments/tree | SuccessEnvelope<DepartmentTreeNode[]> |
| `RoleListItem` / `RoleDetail` | Role CRUD | id, name, departmentId, projectId, ... |
| `RoleListResponse` | GET /roles | PaginatedEnvelope<RoleListItem> |
| `ExternalEntityListItem` / `ExternalEntityDetail` | External Entity CRUD | id, name, entityType, projectId, ... |
| `ExternalEntityListResponse` | GET /external-entities | PaginatedEnvelope<ExternalEntityListItem> |

各实体的 Detail Schema 包含该表的全部可返回字段（参考 `docs/05-data-design/phase1-database-schema.md` 表定义）。

### 4.6 路由迁移规范

#### 4.6.1 迁移规则

每条路由的迁移遵循以下模板：

```typescript
// Before
app.get('/path', {
  preValidation: validate(SomeInputSchema, 'source'),
}, handler);

// After
app.get('/path', {
  schema: {
    // 请求 Schema（对应原 validate 的 source 参数）
    querystring: SomeQuerySchema,   // 原 source='query'
    body: SomeBodySchema,           // 原 source='body'
    params: SomeParamsSchema,       // 原 source='params'

    // 响应 Schema（新增）
    response: {
      200: SomeResponseSchema,      // 或 201 for POST
      400: ErrorResponse,
      404: ErrorResponse,
      409: ErrorResponse,
      500: ErrorResponse,
    },

    // 文档元数据（新增）
    tags: ['ModuleName'],
    summary: '一句话描述',
    description: '详细说明（含 B-rule 引用）',
  },
}, handler);
```

#### 4.6.2 Handler 类型安全提升

迁移后 Handler 中不再需要 `as Record<string, unknown>` 断言：

```typescript
// Before（unsafe）
async function handler(req: FastifyRequest) {
  const { name, displayName } = req.body as Record<string, unknown>;
}

// After（type-safe）
async function handler(req: FastifyRequest<{
  Body: typeof CreateProjectInput.static;
  Querystring: typeof ProjectListQuery.static;
}>) {
  const { name, displayName } = req.body;  // 自动类型推断 ✅
}
```

注意：Fastify 原生 schema 会自动将 `req.body`/`req.query`/`req.params` 推断为 Schema 定义的类型。建议逐步迁移时先保留原有断言确保测试通过，再清理类型。

#### 4.6.3 多验证参数合并

当前部分路由使用数组形式的 preValidation：

```typescript
// Before
app.put('/:id', {
  preValidation: [
    validate(ProjectIdParam, 'params'),
    validate(UpdateProjectInput, 'body'),
  ],
}, handler);

// After — schema 对象天然支持多源
app.put('/:id', {
  schema: {
    params: ProjectIdParam,
    body: UpdateProjectInput,
    response: { /* ... */ },
    tags: ['Projects'],
    summary: '编辑项目',
  },
}, handler);
```

### 4.7 端点覆盖清单

共 **28 个端点**（含 health），全部需添加 schema：

| # | Method | Path | Tags | 关键 Schema |
|---|--------|------|------|------------|
| 1 | GET | `/api/v1/health` | Health | 无参数 |
| 2 | GET | `/api/v1/projects` | Projects | ProjectListQuery → ProjectListResponse |
| 3 | POST | `/api/v1/projects` | Projects | CreateProjectInput → 201 CreateProjectResponse |
| 4 | GET | `/api/v1/projects/:id` | Projects | ProjectIdParam → ProjectDetailResponse |
| 5 | GET | `/api/v1/projects/:id/summary` | Projects | ProjectIdParam → ProjectSummaryResponse |
| 6 | PUT | `/api/v1/projects/:id` | Projects | ProjectIdParam + UpdateProjectInput → ProjectDetailResponse |
| 7 | PATCH | `/api/v1/projects/:id/status` | Projects | ArchiveProjectInput → ProjectDetailResponse |
| 8 | GET | `/companies` | Organization | CompanyListQuery → CompanyListResponse |
| 9 | POST | `/companies` | Organization | CreateCompanyInput → 201 CompanyDetailResponse |
| 10 | GET | `/companies/:id` | Organization | IdParam → CompanyDetailResponse |
| 11 | PUT | `/companies/:id` | Organization | IdParam + UpdateCompanyInput → CompanyDetailResponse |
| 12 | DELETE | `/companies/:id` | Organization | IdParam → DeleteResponse |
| 13 | GET | `/companies/:companyId/departments` | Organization | DeptListQuery → DeptListResponse |
| 14 | GET | `/companies/:companyId/departments/tree` | Organization | CompanyIdParam → DeptTreeResponse |
| 15 | POST | `/companies/:companyId/departments` | Organization | CreateDeptInput → 201 DeptDetailResponse |
| 16 | GET | `/departments/:id` | Organization | IdParam → DeptDetailResponse |
| 17 | PUT | `/departments/:id` | Organization | IdParam + UpdateDeptInput → DeptDetailResponse |
| 18 | DELETE | `/departments/:id` | Organization | IdParam → DeleteResponse |
| 19 | GET | `/roles` | Organization | RoleListQuery → RoleListResponse |
| 20 | POST | `/roles` | Organization | CreateRoleInput → 201 RoleDetailResponse |
| 21 | GET | `/roles/:id` | Organization | IdParam → RoleDetailResponse |
| 22 | PUT | `/roles/:id` | Organization | IdParam + UpdateRoleInput → RoleDetailResponse |
| 23 | DELETE | `/roles/:id` | Organization | IdParam → DeleteResponse |
| 24 | GET | `/external-entities` | Organization | ExtEntityListQuery → ExtEntityListResponse |
| 25 | POST | `/external-entities` | Organization | CreateExtEntityInput → 201 ExtEntityDetailResponse |
| 26 | GET | `/external-entities/:id` | Organization | IdParam → ExtEntityDetailResponse |
| 27 | PUT | `/external-entities/:id` | Organization | IdParam + UpdateExtEntityInput → ExtEntityDetailResponse |
| 28 | DELETE | `/external-entities/:id` | Organization | IdParam → DeleteResponse |

## 5. 测试策略

### 5.1 新增 OpenAPI 合法性测试

文件：`packages/api/tests/openapi/openapi-schema.test.ts`

```typescript
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

    // 覆盖端点数量
    const pathCount = Object.keys(spec.paths).length;
    expect(pathCount).toBeGreaterThanOrEqual(28); // 含 health
  });

  test('每个端点都声明了 response schema', async () => {
    const resp = await app.inject().get('/openapi/json');
    const spec = resp.json();

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        expect(
          operation.response,
          `${method.toUpperCase()} ${path} 缺少 response 定义`
        ).toBeDefined();
        // 至少包含一个成功状态码
        const statusCodes = Object.keys(operation.response);
        expect(
          statusCodes.some((s) => Number(s) >= 200 && Number(s) < 300),
          `${method.toUpperCase()} ${path} 缺少 2xx 成功响应`
        ).toBe(true);
      }
    }
  });

  test('Scalar UI 可访问', async () => {
    const resp = await app.inject().get('/docs');
    expect(resp.statusCode).toBe(200);
  });
});
```

### 5.2 现有测试影响评估

| 测试文件 | 影响程度 | 说明 |
|----------|---------|------|
| `f-m1-01-list.test.ts` | 低 | 使用 `app.inject()` 发真实请求，schema 变更不影响请求行为 |
| `f-m1-02-create.test.ts` | 低 | 同上 |
| `f-m1-03-detail.test.ts` | 低 | 同上 |
| 所有 E2E 测试 | **无影响** | E2E 通过 Playwright 访问 Web 前端，不直接依赖后端 schema 格式 |

**关键保证**：Fastify 原生 schema 的运行时校验行为与现有 `validate()` 中间件一致（都是 Ajv + TypeBox），因此现有 API 测试用例应无需修改。

### 5.3 回归风险缓解

1. **先加新依赖 + 注册插件** → 跑一遍现有测试确认零破坏
2. **逐模块迁移**：先迁 projects.ts（6 端点），测试通过后再迁 organization.ts（21 端点）
3. **最后删除 validate.ts**

## 6. 文件变更清单

| 操作 | 文件路径 | 改动量估计 |
|------|---------|-----------|
| **新增** | `packages/validation-schemas/src/response.ts` | ~80 行 |
| **修改** | `packages/validation-schemas/src/project.schema.ts` | +60 行（响应 Schema） |
| **修改** | `packages/validation-schemas/src/organization.schema.ts` | +100 行（响应 Schema） |
| **修改** | `packages/validation-schemas/src/index.ts` | +1 行 export |
| **修改** | `packages/api/src/app.ts` | +30 行（插件注册） |
| **重写** | `packages/api/src/routes/projects.ts` | schema 替换 preValidation（6 端点） |
| **重写** | `packages/api/src/routes/organization.ts` | 同上（21 端点） |
| **删除** | `packages/api/src/routes/common/validate.ts` | 整个文件 (~53 行) |
| **可能删除** | `packages/api/src/routes/common/` 目录 | 如无其他文件则删除 |
| **新增** | `packages/api/tests/openapi/openapi-schema.test.ts` | ~60 行 |
| **修改** | `packages/api/package.json` | +2 dependencies |

## 7. 后续扩展（不在本次范围）

- [ ] Phase 2+ 新增端点时自动继承 schema 规范（新路由必须带 schema 才能注册）
- [ ] 启用 JWT Bearer 认证（securitySchemes 已预留）
- [ ] 基于 openapi.json 生成前端 TypeScript 类型（openapi-typescript）
- [ ] CI 中集成 spectral/lint 开放 API 规范 lint 校验
- [ ] 导出 Postman Collection 或 Insomnia 导入格式

## 8. 参考资料

- [Fastify Swagger 文档](https://github.com/fastify/fastify-swagger)
- [Scalar for Fastify](https://scalar.com/products/api-references/integrations/fastify)
- [OpenAPI 3.0.3 Specification](https://spec.openapis.org/oas/v3.0.3)
- [@sinclair/typebox Fastify 集成](https://github.com/sinclair/typebox/tree/master/example/fastify)
