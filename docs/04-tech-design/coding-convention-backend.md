# 后端编码细则

> **文档编号**：docs/04-tech-design/coding-convention-backend.md
> **状态**：v1.0 draft
> **日期**：2026-05-07
> **定位**：后端代码实施的详细编码约定（`coding-convention.md` §7 的展开）
> **适用范围**：Phase 1~5 所有模块的 `packages/api/` 代码
> **关联文档**：
> - 编码规范总纲 → `coding-convention.md`
> - 技术方案 → `phase1-design-tech.md`（API 端点 / 错误码 / 响应格式）
> - 数据库 Schema → `../05-data-design/phase1-database-schema.md`（19 张表定义）
> - 注释规范 → `.claude/skills/coding-with-comments`（R1-R5 强制注释规则）

---

## 1. 分层架构与目录结构

### 1.1 完整目录树

```
packages/api/src/
├── app.ts                          # Fastify 入口（插件注册 / 全局错误处理 / 路由挂载）
├── db.ts                           # Drizzle 数据库连接实例（db + migrationSql）
├── models/
│   ├── schema.ts                   # Drizzle Table 定义（全部 19 张表）
│   └── relations.ts                # Drizzle Relation 定义（表间关系）
├── services/
│   ├── project.service.ts          # 项目管理业务逻辑
│   ├── domain.service.ts           # 领域模型业务逻辑（实体/字段/关系）
│   ├── process.service.ts          # 业务流程业务逻辑（流程/节点/边）
│   ├── organization.service.ts     # 组织架构业务逻辑（公司/部门/角色/外部实体）
│   ├── architecture.service.ts     # 业务架构业务逻辑
│   ├── menu.service.ts             # 系统菜单业务逻辑
│   └── common/
│       ├── pagination.ts           # 分页辅助函数
│       ├── errors.ts               # 自定义错误类（AppError 等）
│       └── index.ts                # 公共工具统一导出
├── routes/
│   ├── projects.ts                 # 项目管理路由（6 个端点）
│   ├── domain.ts                   # 领域模型路由（18 个端点）
│   ├── process.ts                  # 业务流程路由（22+ 个端点）
│   ├── organization.ts             # 组织架构路由（21 个端点）
│   ├── architecture.ts             # 业务架构路由（11 个端点）
│   ├── menu.ts                     # 系统菜单路由（6 个端点）
│   └── common/
│       └── validate.ts             # TypeBox 校验中间件工厂
└── __tests__/
    ├── project.test.ts             # 项目管理 API 集成测试
    ├── domain.test.ts              # 领域模型 API 集成测试
    └── ...                         # 其他模块测试文件
```

### 1.2 层级职责与调用规则

| 层 | 职责 | 可调用的层 | 禁止事项 |
|---|------|-----------|---------|
| **Route** | HTTP 协议适配：参数提取、校验触发、响应组装 | Service | 含业务逻辑、直接操作 DB、抛出非 HTTP 错误 |
| **Service** | 业务规则实现、数据转换（snake_case→camelCase）、事务编排 | Model (Drizzle) | 操作 request/reply、拼接 SQL 字符串、HTTP 相关逻辑 |
| **Model** | Drizzle Table/Relation 定义、数据访问原语 | 无（叶子节点） | 含业务规则、数据转换 |

**调用方向严格单向**：Route → Service → Model（Drizzle），禁止反向或跨层调用。

---

## 2. 命名规范

### 2.1 文件命名

| 类型 | 规则 | 示例 |
|------|------|------|
| Service 文件 | kebab-case + `.service.ts` | `project.service.ts` |
| Route 文件 | kebab-case + `.ts`（按资源分组） | `projects.ts`、`organization.ts` |
| 测试文件 | 与源文件同名 + `.test.ts` | `project.test.ts` |
| 公共工具 | kebab-case + `.ts` | `pagination.ts`、`errors.ts` |

### 2.2 函数命名

| 场景 | 规则 | 示例 |
|------|------|------|
| Service 导出函数 | camelCase，按实体分组前缀 | `listProjects()`、`createCompany()`、`getRoleById()` |
| Route Handler | camelCase + `Handler` 后缀 | `listProjectsHandler`、`createEntityHandler` |
| 内部辅助函数 | camelCase，以下划线开头表示私有 | `_buildProjectResponse()`、`_validateUniqueName()` |
| 回调/高阶函数 | camelCase，描述行为 | `withTransaction()`、`notFoundGuard()` |

**Service 函数命名模式矩阵**：

| 操作 | 命名模式 | 返回值 |
|------|---------|--------|
| 列表查询 | `list[Entity]s(params)` | `{ data: T[], meta: PaginationMeta }` |
| 单条查询 | `get[Entity]ById(id)` 或 `get[Entity]Detail(id)` | `T`（完整字段） |
| 创建 | `create[Entity](input)` | `T`（创建后的完整记录） |
| 更新 | `update[Entity](id, input)` | `T`（更新后的完整记录） |
| 删除（软删除） | `archive[Entity](id)` | `T`（删除后的记录） |
| 删除（物理删除） | `delete[Entity](id)` | `void` |
| 存在性检查 | `[entity]Exists(id)` | `boolean` |
| 唯一性检查 | `is[Field]Unique(value, excludeId?)` | `boolean` |

### 2.3 变量与常量命名

| 类型 | 规则 | 示例 |
|------|------|------|
| 局部变量 | camelCase | `projectId`、`sortOrder`、`totalCount` |
| DB 查询结果 | 描述性名称 | `projectsRow`、`rawEntities` |
| 解构参数 | camelCase | `{ id, name, displayName }` |
| 错误码常量 | UPPER_SNAKE_CASE | `ERROR_CODES.NOT_FOUND` |
| 枚举值/状态常量 | UPPER_SNAKE_CASE | `PROJECT_STATUS.ACTIVE`、`NODE_TYPE.ACTION` |
| SQL 排序字段映射 | 对象字面量 | `SORT_FIELDS_PROJECT` |

### 2.4 类型命名

| 类型 | 规则 | 示例 |
|------|------|------|
| 接口/类型别名 | PascalCase + 描述性后缀 | `CreateProjectInput`、`ProjectListItem`、`PaginationParams` |
| 泛型类型参数 | 单个大写字母 | `<T>`、`<T extends { id: string }>` |
| Drizzle Insert 类型 | 从 schema 自动推导 | `typeof projects.$inferInsert` |
| Drizzle Select 类型 | 从 schema 自动推导 | `typeof projects.$inferSelect` |

---

## 3. Service 层编码规范

### 3.1 文件结构与导出模式

每个 Service 文件遵循统一的结构模板：

```typescript
/**
 * @module project.service
 * @description 项目管理模块的业务逻辑层
 *              实现 F-M1-01~10 的全部 CRUD 操作和业务规则
 */

// R5 Why: Service 函数接收 db 作为首参数（§3.2 纯函数风格约束），
//        不导入全局 db 实例，确保测试时可注入 mock。
import type { Db } from '../db.js';
import { projects } from '../models/schema.js';
import { AppError, ERROR_CODES } from './common/errors.js';
import { buildMeta } from './common/pagination.js';
// R1-R5 注释规范强制加载
import type { Project, ProjectListItem, CreateProjectInput /* ... */ } from '@apm/shared';

// ============================================================
// 类型定义（Service 内部使用的输入/输出类型）
// ============================================================

/** 列表查询参数 */
interface ListProjectsParams {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// ============================================================
// 公共导出函数（按 CRUD 操作组织）
// ============================================================

/**
 * 获取项目列表（分页 + 搜索 + 筛选 + 排序）
 *
 * @param db - Drizzle 数据库实例
 * @param params - 查询参数（搜索关键词、状态筛选、分页、排序）
 * @returns 分页结果 { data: ProjectListItem[], meta: PaginationMeta }
 *
 * @example
 * const result = await listProjects(db, { search: 'station', status: 'active', page: 1 });
 */
export async function listProjects(
  db: Db,
  params: ListProjectsParams = {},
): Promise<{ data: ProjectListItem[]; meta: ReturnType<typeof buildMeta> }> {
  // R4: 段落注释 — 构建基础查询
  const { search, status, page = 1, pageSize = 20, sort = 'updatedAt', order = 'desc' } = params;

  // R3: 分支注释 — 动态条件组装
  const conditions = [];
  if (search) {
    // B-M1-03: 搜索仅匹配 name 字段，使用 ILIKE 模糊匹配
    conditions.push(like(projects.name, `%${search}%`));
  }
  if (status) {
    conditions.push(eq(projects.status, status));
  }

  // ... 查询构建与执行 ...
}

/** 其余导出函数按同样模式编写 */
```

### 3.2 核心编码约束

| 约束项 | 规则 | 违规示例 |
|--------|------|---------|
| **纯函数风格** | 导出函数接收 `db` 作为首参数，不使用全局单例 | 直接 import 并使用全局 `db`（测试时无法注入 mock） |
| **DB 行 → API 响应转换** | 在 Service 层完成 snake_case → camelCase 转换 | 将原始 DB 行直接返回给 Route 层 |
| **业务异常抛出** | 使用 `AppError` 类，携带 statusCode + code + message | `throw new Error('项目不存在')`（丢失 HTTP 语义） |
| **SQL 安全** | 所有查询通过 Drizzle Query Builder，禁止字符串拼接 | `` `WHERE name = '${name}'` `` |
| **B-rule 标注** | 每条 PRD 业务规则对应代码中的注释标注 `// B-Mx-NN:` | 实现了规则但无标注，Review 时无法追溯 |

### 3.3 AppError 错误类体系

```typescript
/**
 * @module common/errors
 * @description 自定义应用错误类，统一错误码和 HTTP 状态码映射
 */

/** 应用错误码枚举（与 tech design §7.2 对齐） */
export const ERROR_CODES = {
  // 400 级别
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_NAME_FORMAT: 'INVALID_NAME_FORMAT',
  INVALID_NAME_LENGTH: 'INVALID_NAME_LENGTH',
  DISPLAY_NAME_REQUIRED: 'DISPLAY_NAME_REQUIRED',
  PROJECT_ARCHIVED: 'PROJECT_ARCHIVED',

  // 404 级别
  NOT_FOUND: 'NOT_FOUND',

  // 409 级别
  CONFLICT: 'CONFLICT',
  NAME_CONFLICT: 'NAME_CONFLICT',
  VERSION_CONFLICT: 'VERSION_CONFLICT',

  // 422 级别
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',

  // 500 级别
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * 自定义应用错误 — 统一携带 HTTP 状态码和业务错误码
 * 被 Fastify 全局 setErrorHandler 捕获并格式化为标准错误响应
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ============================================================
// 便捷工厂方法（按 HTTP 状态码分类）
// ============================================================

/** 400 Bad Request */
export const badRequest = (code: ErrorCode, message: string) =>
  new AppError(400, code, message);

/** 404 Not Found */
export const notFound = (resource: string, id?: string) =>
  new AppError(404, ERROR_CODES.NOT_FOUND, id ? `${resource}(id=${id})不存在` : `${resource}不存在`);

/** 409 Conflict */
export const conflict = (code: ErrorCode, message: string) =>
  new AppError(409, code, message);

/** 422 Unprocessable Entity */
export const unprocessableEntity = (message: string) =>
  new AppError(422, ERROR_CODES.UNPROCESSABLE_ENTITY, message);
```

**使用示例**：

```typescript
// B-M1-22: 归档项目不允许编辑
if (existingProject.status === 'archived') {
  throw badRequest(ERROR_CODES.PROJECT_ARCHIVED, '归档项目不可编辑');
}

// B-M1-20: name 全局唯一性检查
const duplicate = await db.select().from(projects)
  .where(and(eq(projects.name, name), ne(projects.id, id)))
  .get();
if (duplicate) {
  throw conflict(ERROR_CODES.NAME_CONFLICT, `项目标识符 "${name}" 已存在`);
}
```

### 3.4 snake_case ↔ camelCase 数据转换

**原则**：数据库列名为 snake_case，API 响应为 camelCase。转换在 Service 层完成。

```typescript
/**
 * 将 DB 行（snake_case）转换为 API 响应（camelCase）
 *
 * R5 Why: Drizzle schema 使用 snake_case 映射 PG 列名，
 *        但前端 API 契约使用 camelCase（与 shared/types 一致）。
 *        统一在此层转换，避免 Route 和前端重复处理。
 */
function toProjectListItem(row: typeof projects.$inferSelect): ProjectListItem {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 详情版本（包含 config 字段） */
function toProjectDetail(row: typeof projects.$inferSelect): Project {
  return {
    ...toProjectListItem(row),
    config: row.config,
  };
}
```

**批量转换**：

```typescript
// 列表查询：批量映射
const rows = await db.select().from(projects).where(...).limit(pageSize).offset(offset).all();
return { data: rows.map(toProjectListItem), meta: buildMeta(total, page, pageSize) };
```

### 3.5 分页实现规范

```typescript
/**
 * @module common/pagination
 * @description 分页辅助函数，统一列表接口的分页逻辑
 */

/** 分页查询参数 */
export interface PaginationParams {
  page?: number;      // 当前页码，默认 1
  pageSize?: number;  // 每页条数，默认 20，可选 10/20/50/100
}

/** 分页元信息 */
export interface PaginationMeta {
  total: number;      // 符合条件的总记录数
  page: number;       // 当前页码
  pageSize: number;   // 每页条数
  // 注意：不包含 totalPages 字段。totalPages 由前端自行计算（Math.ceil(total / pageSize)），
  //       后端不返回以减少冗余字段，且避免 total=0 时 totalPages=0 的边界歧义。
}

/** 合法的 pageSize 取值集合 */
const VALID_PAGE_SIZES = [10, 20, 50, 100] as const;

/**
 * 构建分页元信息
 *
 * @param total - 总记录数
 * @param page - 当前页码（已做边界保护）
 * @param pageSize - 每页条数（已做合法性校验）
 */
export function buildMeta(total: number, page: number, pageSize: number): PaginationMeta {
  return { total, page, pageSize };
}

/**
 * 解析并校验分页参数
 *
 * R5 Why: 前端可能传入非法值（负数、超大数、非枚举值），
 *        必须在 Service 层做防御性校验而非依赖前端。
 *
 * @param raw - 原始查询参数
 * @returns 校验后的分页参数 { offset, limit, page, pageSize }
 */
export function parsePagination(raw: PaginationParams & { pageSize?: string | number }) {
  let page = Number(raw.page) || 1;
  let pageSize = Number(raw.pageSize) || 20;

  // 边界保护：page 最小为 1
  if (page < 1) page = 1;

  // pageSize 枚举校验：不在合法集合中则回退到默认值 20
  if (!VALID_PAGE_SIZES.includes(pageSize as (typeof VALID_PAGE_SIZES)[number])) {
    pageSize = 20;
  }

  return {
    offset: (page - 1) * pageSize,
    limit: pageSize,
    page,
    pageSize,
  };
}
```

### 3.6 事务处理规范

**触发场景**：多表写操作必须使用事务（如创建公司时同时初始化默认部门）。

```typescript
/**
 * 在事务中执行多表写操作
 *
 * R5 Why: Drizzle 的 db.transaction() 保证原子性——
 *        要么全部成功提交，要么全部回滚。
 *        非事务操作可能导致部分写入的数据不一致。
 */
export async function createCompanyWithDefaults(
  db: Db,
  projectId: string,
  input: CreateCompanyInput,
): Promise<Company> {
  return await db.transaction(async (tx) => {
    // 步骤 1：创建公司
    const [company] = await tx.insert(companies)
      .values({
        projectId,
        name: input.name,
        displayName: input.displayName,
        description: input.description,
        companyType: input.companyType,
        contactInfo: input.contact_info ?? {},
        sortOrder: 0,
        config: {},
      })
      .returning()
      .all();

    // 步骤 2：（可选）在同一事务中创建关联的初始部门
    // ...

    return toCompanyDetail(company);
  });
}
```

**事务使用规则**：

| 规则 | 说明 |
|------|------|
| 只读查询 | 不需要事务，普通 `db.select()` 即可 |
| 单表写操作 | 不强制事务（但建议保持一致） |
| 多表写操作 | **必须**使用 `db.transaction()` |
| 嵌套事务 | Drizzle 自动处理 savepoint，无需手动管理 |
| 事务内异常 | throw 任何 Error 都会触发自动 rollback |

### 3.7 排序实现规范

```typescript
/** 排序字段白名单（防止 SQL 注入式的排序注入） */
const SORT_FIELDS_PROJECT = {
  name: projects.name,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
} as const;

type SortField = keyof typeof SORT_FIELDS_PROJECT;

/**
 * 构建排序子句
 *
 * R5 Why: 排序字段来自用户输入，不能直接拼接到 SQL 中。
 *        通过白名单映射确保只有合法列名可用于排序。
 */
function buildSortClause(sort: string, order: 'asc' | 'desc') {
  const column = SORT_FIELDS_PROJECT[sort as SortField] ?? SORT_FIELDS_PROJECT.updatedAt;
  return order === 'asc' ? asc(column) : desc(column);
}
```

---

## 4. Route 层编码规范

### 4.1 路由文件结构模板

```typescript
/**
 * @module routes/projects
 * @description 项目管理路由处理器（6 个端点）
 *              对应 tech design §5.4 项目管理 API
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db.js';
import { projectService } from '../services/project.service.js';
import { validate } from './common/validate.js';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
} from '@apm/validation-schemas';

/**
 * 注册项目管理路由
 *
 * @param app - Fastify 应用实例
 */
export default async function projectRoutes(app: FastifyInstance) {
  // ==========================================
  // 查询操作
  // ==========================================

  // GET /api/v1/projects — 项目列表（F-M1-01）
  app.get('/', {
    preValidation: validate(listProjectsQuerySchema, 'query'),
  }, listProjectsHandler);

  // GET /api/v1/projects/:id — 项目详情（F-M1-03）
  app.get('/:id', getProjectHandler);

  // GET /api/v1/projects/:id/summary — 项目摘要统计（F-M1-10）
  app.get('/:id/summary', getProjectSummaryHandler);

  // ==========================================
  // 写操作
  // ==========================================

  // POST /api/v1/projects — 创建项目（F-M1-02）
  app.post('/', {
    preValidation: validate(createProjectSchema, 'body'),
  }, createProjectHandler);

  // PUT /api/v1/projects/:id — 更新项目（F-M1-04）
  app.put('/:id', {
    preValidation: validate(updateProjectSchema, 'body'),
  }, updateProjectHandler);

  // DELETE /api/v1/projects/:id — 归档项目（F-M1-05）
  app.delete('/:id', archiveProjectHandler);
}
```

### 4.2 Route Handler 标准模板

**Handler 的职责只有三件事**：提取参数 → 调用 Service → 组装响应。

```typescript
/**
 * GET /api/v1/projects — 项目列表
 *
 * 对应功能点：F-M1-01
 * B-rule 覆盖：B-M1-01~05
 */
export async function listProjectsHandler(request: FastifyRequest, reply: FastifyReply) {
  // 1. 提取查询参数（经过 preValidation 校验后可直接使用）
  const { search, status, page, pageSize, sort, order } = request.query as ListProjectsQuery;

  // 2. 委托 Service 层执行业务逻辑
  const result = await projectService.listProjects(db, { search, status, page, pageSize, sort, order });

  // 3. 组装标准响应格式
  return { data: result.data, meta: result.meta };
}

/**
 * POST /api/v1/projects — 创建项目
 *
 * 对应功能点：F-M1-02
 * B-rule 覆盖：B-M1-10~13
 */
export async function createProjectHandler(request: FastifyRequest, reply: FastifyReply) {
  // 1. 提取请求体（经过 preValidation 校验后可直接使用）
  const body = request.body as CreateProjectInput;

  // 2. 委托 Service 层
  const project = await projectService.createProject(db, body);

  // 3. 组装响应（201 状态码在成功路径设置）
  reply.code(201);
  return { data: project };
}
```

### 4.3 参数提取规范

| 参数来源 | 提取方式 | 示例 |
|---------|---------|------|
| 路径参数 | `request.params.id` | `const { id } = request.params;` |
| 查询参数 | `request.query`（经 TypeBox 校验后） | `const { page, pageSize } = request.query;` |
| 请求体 | `request.body`（经 TypeBox 校验后） | `const { name, displayName } = request.body;` |

**UUID 格式校验**：路径参数中的 ID 应在 handler 开头做基本格式校验（Fastify 的 schema validation 已覆盖，此处为双重保险）：

```typescript
// UUID v4 格式快速校验（正则匹配）
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!UUID_REGEX.test(id)) {
  throw badRequest('INVALID_ID', '无效的项目 ID 格式');
}
```

### 4.4 preValidation 校验中间件

```typescript
/**
 * @module routes/common/validate
 * @description TypeBox + Ajv 校验中间件工厂
 *              在 preValidation hook 中执行 Schema 校验，
 *              校验失败时立即返回 400 响应并终止请求链
 */

import type { FastifyRequest, FastifyReply, PreValidationHookHandler } from 'fastify';
import { ajv } from '@apm/validation-schemas';
import type { Static, TSchema } from '@sinclair/typebox';

/**
 * 创建 preValidation 校验中间件
 *
 * @param schema - TypeBox Schema 定义
 * @param source - 校验目标：'body' | 'query' | 'params'
 * @returns Fastify preValidation hook handler
 */
export function validate<T extends TSchema>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body',
): PreValidationHookHandler {
  const compile = ajv.compile(schema);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const data = source === 'body' ? request.body : source === 'query' ? request.query : request.params;
    const valid = compile(data);
    if (!valid) {
      // R5 Why: Ajv allErrors 模式可一次返回所有字段级错误，
      //        前端可逐字段展示错误提示，提升用户体验。
      reply.code(400).send({
        error: {
          code: 'VALIDATION_FAILED',
          message: '请求参数校验失败',
          details: compile.errors?.map((e) => ({
            field: e.instancePath.slice(1) || e.schemaPath,
            message: e.message,
          })),
          requestId: request.id,
        },
      });
      throw new Error('Validation failed'); // 终止后续 handler 执行
    }
    // 校验通过后将校验后的数据写回 request（Ajv useDefaults/coerceTypes 可能修改了值）
    if (source === 'body') request.body = data;
    if (source === 'query') request.query = data;
    if (source === 'params') request.params = data;
  };
}
```

### 4.5 路由注册到 app.ts

```typescript
// app.ts 中的注册方式（按模块逐步添加）

import projectRoutes from './routes/projects.js';
// ... 其他模块路由

// M1: 项目管理
await app.register(projectRoutes, { prefix: '/api/v1/projects' });

// M4: 组织架构（嵌套在项目下）
await app.register(organizationRoutes, { prefix: '/api/v1/projects/:projectId' });

// M6: 系统菜单（不嵌套在项目下）
await app.register(menuRoutes, { prefix: '/api/v1/menus' });
```

---

## 5. Model 层（Drizzle ORM）使用规范

### 5.1 Schema 定义规范

**与 DDL 文档一一对应**：每张表在 `schema.ts` 中有一个 `pgTable()` 定义。

```typescript
// 以 companies 表为例（对应 phase1-database-schema.md 表 13）

export const companies = pgTable('companies', {
  // 主键：UUID 文本格式
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // 外键：引用 projects 表，级联删除
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  // 业务字段
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),

  // 可选枚举字段
  companyType: text('company_type'), // 'internal' | 'external' | 'partner' | 'client'

  // JSONB 灵活字段
  contactInfo: jsonb('contact_info').default('{}'),
  config: jsonb('config').default('{}'),

  // 标准字段
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**Schema 定义规则**：

| 规则 | 说明 |
|------|------|
| 列名映射 | Drizzle 列名使用 snake_case（`.text('project_id')`），与 PG 列名一致 |
| TypeScript 属性名 | 使用 camelCase（`projectId`），Drizzle 自动映射 |
| 主键 | 统一 `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())` |
| 时间戳 | 统一 `timestamp('xxx', { withTimezone: true }).notNull().defaultNow()` |
| JSONB 字段 | 统一 `.default('{}')`，类型为 `JsonValue` |
| 外键 | 统一 `.references(() => targetTable.id, { onDelete: 'cascade' })` |

### 5.2 Relation 定义规范

```typescript
// relations.ts — 表关系定义

import { relations } from 'drizzle-orm';
import { projects, domainEntities, companies, departments, roles /* ... */ } from './schema.js';

export const projectsRelations = relations(projects, ({ many }) => ({
  // 一个项目有多个实体
  domainEntities: many(domainEntities),
  // 一个项目有多家公司
  companies: many(companies),
  // 一个项目有多个流程
  businessProcesses: many(businessProcesses),
  // ... 其他一对多关系
}));

export const companiesRelations = relations(companies, ({ one, many }) => {
  return {
    // 一家公司归属一个项目
    project: one(projects, {
      fields: [companies.projectId],
      references: [projects.id],
    }),
    // 一家公司有多个部门
    departments: many(departments),
  };
});

// 部门自引用（多级部门 tree）
export const departmentsRelations = relations(departments, ({ one, many }) => ({
  company: one(companies, {
    fields: [departments.companyId],
    references: [companies.id],
  }),
  parent: one(departments, {
    fields: [departments.parentId],
    references: [departments.id],
    relationName: 'department_parent', // 自引用必须指定 relationName
  }),
  children: many(departments, { relationName: 'department_parent' }),
  roles: many(roles),
}));
```

### 5.3 常用查询模式

#### 5.3.1 带条件的分页列表查询

```typescript
export async function listCompanies(
  db: Db,
  projectId: string,
  params: ListParams = {},
) {
  const { offset, limit, page, pageSize } = parsePagination(params);

  // R4: 段落注释 — 构建 WHERE 条件
  const conditions = [eq(companies.projectId, projectId)];
  if (params.search) {
    conditions.push(like(companies.name, `%${params.search}%`));
  }

  // 并行执行 COUNT 和数据查询（减少 RTT）
  const [total, rows] = await Promise.all([
    db.select({ count: count() }).from(companies)
      .where(and(...conditions))
      .get()
      .then((r) => r?.count ?? 0),

    db.select().from(companies)
      .where(and(...conditions))
      .orderBy(desc(companies.sortOrder), desc(companies.createdAt))
      .limit(limit)
      .offset(offset)
      .all(),
  ]);

  return {
    data: rows.map(toCompanyListItem),
    meta: buildMeta(total, page, pageSize),
  };
}
```

#### 5.3.2 单条查询 + 404 处理

```typescript
export async function getCompanyById(db: Db, companyId: string): Promise<Company> {
  const row = await db.select().from(companies)
    .where(eq(companies.id, companyId))
    .get();

  if (!row) {
    throw notFound('公司', companyId);
  }

  return toCompanyDetail(row);
}
```

#### 5.3.3 创建操作

```typescript
export async function createCompany(
  db: Db,
  projectId: string,
  input: CreateCompanyInput,
): Promise<Company> {
  // B-rule: 唯一性预检（name 在同一 project 下唯一）
  const existing = await db.select({ id: companies.id }).from(companies)
    .where(and(
      eq(companies.projectId, projectId),
      eq(companies.name, input.name),
    ))
    .get();

  if (existing) {
    throw conflict(ERROR_CODES.CONFLICT, `公司名称 "${input.name}" 在当前项目中已存在`);
  }

  const [company] = await db.insert(companies)
    .values({
      projectId,
      name: input.name,
      displayName: input.displayName,
      description: input.description ?? null,
      companyType: input.company_type ?? null,
      contactInfo: input.contact_info ?? {},
      sortOrder: 0,
      config: {},
    })
    .returning()
    .all();

  return toCompanyDetail(company);
}
```

#### 5.3.4 更新操作（含乐观锁）

```typescript
export async function updateProject(
  db: Db,
  id: string,
  input: UpdateProjectInput,
): Promise<Project> {
  // 读取当前记录（用于乐观锁校验）
  const current = await db.select().from(projects)
    .where(eq(projects.id, id))
    .get();

  if (!current) {
    throw notFound('项目', id);
  }

  // B-M1-22: 归档项目不允许编辑
  if (current.status === 'archived') {
    throw badRequest(ERROR_CODES.PROJECT_ARCHIVED, '归档项目不可编辑');
  }

  // B-M1-18~20: name 格式/长度/唯一性校验
  if (input.name !== undefined && input.name !== current.name) {
    // R5 Why: 更新操作的 name 正则比创建操作更宽松。
    //        创建要求 `^[a-z][a-z0-9-]*$`（小写字母开头，严格编程标识符），
    //        更新允许 `^[a-zA-Z0-9_-]+$`（大小写+下划线+连字符，兼容已有数据）。
    //        这是有意的设计决策：创建时从严，更新时从宽（避免已有合法数据无法编辑）。
    if (!/^[a-zA-Z0-9_-]{2,50}$/.test(input.name)) {
      throw badRequest(ERROR_CODES.INVALID_NAME_FORMAT, '编程标识符格式不正确');
    }
    const duplicate = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.name, input.name), ne(projects.id, id)))
      .get();
    if (duplicate) {
      throw conflict(ERROR_CODES.NAME_CONFLICT, `项目标识符 "${input.name}" 已存在`);
    }
  }

  // 执行更新（乐观锁：version 匹配才更新）
  const [updated] = await db.update(projects)
    .set({
      name: input.name ?? current.name,
      displayName: input.displayName ?? current.displayName,
      description: input.description ?? current.description,
      version: sql`${projects.version} + 1`, // 乐观锁递增
      updatedAt: new Date(),
    })
    .where(and(
      eq(projects.id, id),
      eq(projects.version, current.version), // 乐观锁条件
    ))
    .returning()
    .all();

  // 乐观锁冲突检测
  if (!updated) {
    throw conflict(ERROR_CODES.VERSION_CONFLICT, '数据已被其他人修改，请刷新页面重试');
  }

  return toProjectDetail(updated);
}
```

#### 5.3.5 软删除操作

```typescript
export async function archiveProject(db: Db, id: string): Promise<Project> {
  const current = await db.select().from(projects)
    .where(eq(projects.id, id))
    .get();

  if (!current) {
    // B-M1-07: 幂等性 — 已归档的项目重复删除返回成功
    // 注意：这里用 404 而非幂等成功，因为 ID 本身不存在
    throw notFound('项目', id);
  }

  // B-M1-07: 幂等性 — 对已归档项目重复调用返回当前状态
  if (current.status === 'archived') {
    return toProjectDetail(current);
  }

  // B-M1-08: 仅更新 status，不级联修改子数据
  const [archived] = await db.update(projects)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning()
    .all();

  return toProjectDetail(archived);
}
```

---

## 6. 公共工具函数库

### 6.1 已确定公共工具清单

| 工具 | 文件位置 | 用途 |
|------|---------|------|
| `AppError` / `ERROR_CODES` / 工厂方法 | `services/common/errors.ts` | 统一错误抛出 |
| `parsePagination()` / `buildMeta()` | `services/common/pagination.ts` | 分页参数解析与元信息构建 |
| `validate()` | `routes/common/validate.ts` | TypeBox preValidation 校验中间件 |
| `toXxx()` 转换函数 | 各 service 文件内 | snake_case → camelCase 数据转换 |

### 6.2 新增工具的原则

- **先确认是否已有**：新增工具前检查 `services/common/` 是否已有类似实现
- **通用性门槛**：被 ≥ 2 个 service 文件使用才抽取到 `common/`；仅单个使用的保留在 service 文件内部
- **纯函数优先**：工具函数应为无副作用的纯函数，便于测试
- **不引入重型依赖**：优先使用原生 JS/TS 能力，不引入 lodash 等工具库（除非确实必要且有团队共识）

---

## 7. 测试编码规范

### 7.1 测试文件组织

```
packages/api/src/__tests__/
├── project.test.ts         # M1 项目管理（84 个 TC）
├── domain.test.ts          # M2 领域模型
├── process.test.ts         # M3 业务流程
├── organization.test.ts    # M4 组织架构
├── architecture.test.ts    # M5 业务架构
├── menu.test.ts            # M6 系统菜单
└── common/
    └── helpers.ts          # 测试公共工具（测试 DB 连接、种子数据、认证 helper 等）
```

### 7.2 测试结构模板

```typescript
/**
 * @module __tests__/project
 * @description 项目管理模块 API 集成测试
 *              对应 docs/06-test-design/modules/project-management/api.md
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { app } from '../app.js';
import { db } from '../db.js';

// ============================================================
// 测试前置：启动 Fastify app（仅一次）
// ============================================================

beforeAll(async () => {
  // 等待 app 就绪（如果使用了 ready hook）
});

afterAll(async () => {
  // 清理测试资源
});

// ============================================================
// 测试套件：按功能点组织
// ============================================================

describe('F-M1-01 项目列表', () => {

  // --- 正向测试 ---

  it('TC-001: 默认返回项目列表（按 updatedAt 降序，pageSize=20）', async () => {
    // B-M1-01: 默认按 updatedAt 降序排列
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.pageSize).toBe(20);
  });

  it('TC-002: 按 name 模糊搜索（B-M1-03: ILIKE 匹配）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects?search=station',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // 每个结果的 name 应包含搜索关键词
    body.data.forEach((p: { name: string }) => {
      expect(p.name.toLowerCase()).toContain('station');
    });
  });

  // --- 异常/边界测试 ---

  it('TC-030: 无效的 pageSize 值回退到默认 20', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects?pageSize=999',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().meta.pageSize).toBe(20);
  });
});
```

### 7.3 测试断言规范

| 维度 | 要求 |
|------|------|
| HTTP 状态码 | 每个测试必须断言 `statusCode` |
| 响应结构 | 成功响应断言 `data` 存在；列表接口额外断言 `meta` 存在 |
| 业务值 | 关键业务字段必须有值断言（不只是类型断言） |
| 异常场景 | 断言 `error.code` 和 `error.message` |
| B-rule 覆盖 | 每个 B-rule 至少有一个正向 + 一个反向测试 |

### 7.4 测试中使用 app.inject()

使用 Fastify 的 `app.inject()` 方法进行 HTTP 层测试（无需真实监听端口）：

```typescript
// 标准 inject 调用模式
const res = await app.inject({
  method: 'POST',
  url: '/api/v1/projects',
  payload: {
    name: 'test-project',
    display_name: '测试项目',
    description: '测试描述',
  },
});

// 断言
expect(res.statusCode).toBe(201);
expect(res.json().data.name).toBe('test-project');
expect(res.json().data.status).toBe('active');
```

---

## 8. Import 规范

### 8.1 路径别名与解析

本项目使用 ESM（`"type": "module"`），所有 import 必须带 `.js` 扩展名：

```typescript
// ✅ 正确（ESM 需要 .js 扩展名）
import { db } from '../db.js';
import { projects } from '../models/schema.js';
import { AppError } from './common/errors.js';

// ❌ 错误（省略扩展名会导致运行时错误）
import { db } from '../db';
```

### 8.2 包引用规范

| 引用目标 | 方式 | 示例 |
|---------|------|------|
| 同包内文件 | 相对路径 + `.js` | `from '../models/schema.js'` |
| shared 类型 | workspace 包 | `from '@apm/shared'` |
| validation-schemas | workspace 包 | `from '@apm/validation-schemas'` |
| Drizzle ORM | npm 包 | `from 'drizzle-orm'` |
| Fastify | npm 包 | `from 'fastify'` |

---

## 9. 版本历史

| 版本 | 日期 | 变更要点 |
|------|------|---------|
| v1.0 | 2026-05-07 | 初版，基于总纲 §7 展开，涵盖分层架构/命名规范/Service-Route-Model 模板库/错误体系/分页/事务/排序/测试规范 |
