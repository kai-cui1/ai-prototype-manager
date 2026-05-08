/**
 * @module routes/organization
 * @description 组织管理路由：公司(F-M1-06) + 部门(F-M1-07) + 角色(F-M1-08) + 外部实体(F-M1-09)。
 *              Fastify 插件形式注册，前缀 /api/v1/projects/:projectId。
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
import { db } from '../db.js';
import * as orgService from '../services/organization.service.js';
import { validate } from './common/validate.js';
import { Type } from '@sinclair/typebox';
import {
  // Company schemas
  CreateCompanyInput,
  UpdateCompanyInput,
  CompanyListQuery,
  // Department schemas
  CreateDepartmentInput,
  UpdateDepartmentInput,
  DepartmentListQuery,
  // Role schemas
  CreateRoleInput,
  UpdateRoleInput,
  RoleListQuery,
  // External Entity schemas
  CreateExternalEntityInput,
  UpdateExternalEntityInput,
  ExternalEntityListQuery,
} from '@apm/validation-schemas';

export default async function organizationRoutes(app: FastifyInstance) {
  // ================================================================
  // F-M1-06: Company Routes (前缀: /companies)
  // ================================================================

  /** GET /companies — 公司列表 */
  app.get('/companies', {
    preValidation: validate(CompanyListQuery, 'query'),
  }, listCompaniesHandler);

  /** POST /companies — 创建公司 */
  app.post('/companies', {
    preValidation: validate(CreateCompanyInput, 'body'),
  }, createCompanyHandler);

  /** GET /companies/:id — 公司详情 */
  app.get('/companies/:id', {
    preValidation: validate(Type.Object({ id: Type.String({ format: 'uuid' }) }), 'params'),
  }, getCompanyHandler);

  /** PUT /companies/:id — 更新公司 */
  app.put('/companies/:id', {
    preValidation: [validate(Type.Object({ id: Type.String({ format: 'uuid' }) }), 'params'), validate(UpdateCompanyInput, 'body')],
  }, updateCompanyHandler);

  /** DELETE /companies/:id — 删除公司 */
  app.delete('/companies/:id', {
    preValidation: validate(Type.Object({ id: Type.String({ format: 'uuid' }) }), 'params'),
  }, deleteCompanyHandler);

  // ================================================================
  // F-M1-07: Department Routes (前缀: /companies/:companyId/departments)
  // ================================================================

  /** GET /companies/:companyId/departments — 部门列表 */
  app.get('/companies/:companyId/departments', {
    preValidation: [
      validate(Type.Object({ companyId: Type.String({ format: 'uuid' }) }), 'params'),
      validate(DepartmentListQuery, 'query'),
    ],
  }, listDepartmentsHandler);

  /** GET /companies/:companyId/departments/tree — 部门树 */
  app.get('/companies/:companyId/departments/tree', {
    preValidation: validate(Type.Object({ companyId: Type.String({ format: 'uuid' }) }), 'params'),
  }, getDepartmentTreeHandler);

  /** POST /companies/:companyId/departments — 创建部门 */
  app.post('/companies/:companyId/departments', {
    preValidation: [
      validate(Type.Object({ companyId: Type.String({ format: 'uuid' }) }), 'params'),
      validate(CreateDepartmentInput, 'body'),
    ],
  }, createDepartmentHandler);

  /** GET /departments/:id — 部门详情 */
  app.get('/departments/:id', {
    preValidation: validate(Type.Object({ id: Type.String({ format: 'uuid' }) }), 'params'),
  }, getDepartmentHandler);

  /** PUT /departments/:id — 更新部门 */
  app.put('/departments/:id', {
    preValidation: [
      validate(Type.Object({ id: Type.String({ format: 'uuid' }) }), 'params'),
      validate(UpdateDepartmentInput, 'body'),
    ],
  }, updateDepartmentHandler);

  /** DELETE /departments/:id — 删除部门 */
  app.delete('/departments/:id', {
    preValidation: validate(Type.Object({ id: Type.String({ format: 'uuid' }) }), 'params'),
  }, deleteDepartmentHandler);

  // ================================================================
  // F-M1-08: Role Routes (前缀: /roles)
  // ================================================================

  /** GET /roles — 角色列表 */
  app.get('/roles', {
    preValidation: validate(RoleListQuery, 'query'),
  }, listRolesHandler);

  /** POST /roles — 创建角色 */
  app.post('/roles', {
    preValidation: validate(CreateRoleInput, 'body'),
  }, createRoleHandler);

  /** GET /roles/:id — 角色详情 */
  app.get('/roles/:id', {
    preValidation: validate(Type.Object({ id: Type.String({ format: 'uuid' }) }), 'params'),
  }, getRoleHandler);

  /** PUT /roles/:id — 更新角色 */
  app.put('/roles/:id', {
    preValidation: [
      validate(Type.Object({ id: Type.String({ format: 'uuid' }) }), 'params'),
      validate(UpdateRoleInput, 'body'),
    ],
  }, updateRoleHandler);

  /** DELETE /roles/:id — 删除角色 */
  app.delete('/roles/:id', {
    preValidation: validate(Type.Object({ id: Type.String({ format: 'uuid' }) }), 'params'),
  }, deleteRoleHandler);

  // ================================================================
  // F-M1-09: External Entity Routes (前缀: /external-entities)
  // ================================================================

  /** GET /external-entities — 外部实体列表 */
  app.get('/external-entities', {
    preValidation: validate(ExternalEntityListQuery, 'query'),
  }, listExternalEntitiesHandler);

  /** POST /external-entities — 创建外部实体 */
  app.post('/external-entities', {
    preValidation: validate(CreateExternalEntityInput, 'body'),
  }, createExternalEntityHandler);

  /** GET /external-entities/:id — 外部实体详情 */
  app.get('/external-entities/:id', {
    preValidation: validate(Type.Object({ id: Type.String({ format: 'uuid' }) }), 'params'),
  }, getExternalEntityHandler);

  /** PUT /external-entities/:id — 更新外部实体 */
  app.put('/external-entities/:id', {
    preValidation: [
      validate(Type.Object({ id: Type.String({ format: 'uuid' }) }), 'params'),
      validate(UpdateExternalEntityInput, 'body'),
    ],
  }, updateExternalEntityHandler);

  /** DELETE /external-entities/:id — 删除外部实体 */
  app.delete('/external-entities/:id', {
    preValidation: validate(Type.Object({ id: Type.String({ format: 'uuid' }) }), 'params'),
  }, deleteExternalEntityHandler);
}

// ============================================================
// Route Handlers — Company (F-M1-06)
// ============================================================

/** F-M1-06: GET /companies — 公司列表（B-M1-26 排序 + B-M1-27 双字段搜索） */
async function listCompaniesHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { projectId } = request.params as { projectId: string };
  const { search, page, pageSize } = request.query as Record<string, unknown>;
  return orgService.listCompanies(db, projectId, {
    search: search as string | undefined,
    page: page as number | undefined,
    pageSize: pageSize as number | undefined,
  });
}

/** F-M1-06: POST /companies — 创建公司 */
async function createCompanyHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { projectId } = request.params as { projectId: string };
  const body = request.body as Record<string, unknown>;
  const company = await orgService.createCompany(db, projectId, body);
  return { data: company };
}

/** F-M1-06: GET /companies/:id — 公司详情 */
async function getCompanyHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const company = await orgService.getCompanyById(db, id);
  return { data: company };
}

/** F-M1-06: PUT /companies/:id — 更新公司（B-M1-37 乐观锁） */
async function updateCompanyHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  const company = await orgService.updateCompany(db, id, body);
  return { data: company };
}

/** F-M1-06: DELETE /companies/:id — 删除公司（B-M1-39 级联删除部门） */
async function deleteCompanyHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await orgService.deleteCompany(db, id);
  return { success: true };
}

// ============================================================
// Route Handlers — Department (F-M1-07)
// ============================================================

/** F-M1-07: GET /companies/:companyId/departments — 部门列表（B-M1-41 排序 + B-M1-42 搜索） */
async function listDepartmentsHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { companyId } = request.params as { companyId: string };
  const { search, page, pageSize } = request.query as Record<string, unknown>;
  return orgService.listDepartments(db, companyId, {
    search: search as string | undefined,
    page: page as number | undefined,
    pageSize: pageSize as number | undefined,
  });
}

/** F-M1-07: GET /companies/:companyId/departments/tree — 部门树形结构 */
async function getDepartmentTreeHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { companyId } = request.params as { companyId: string };
  const tree = await orgService.getDepartmentTree(db, companyId);
  return { data: tree };
}

/** F-M1-07: POST /companies/:companyId/departments — 创建部门（B-M1-50 name唯一 + B-M1-51 parentId 校验） */
async function createDepartmentHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { companyId } = request.params as { companyId: string };
  const body = request.body as Record<string, unknown>;
  const dept = await orgService.createDepartment(db, companyId, body);
  return { data: dept };
}

/** F-M1-07: GET /departments/:id — 部门详情 */
async function getDepartmentHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const dept = await orgService.getDepartmentById(db, id);
  return { data: dept };
}

/** F-M1-07: PUT /departments/:id — 更新部门（B-M1-52b 环检测 + B-M1-37 乐观锁） */
async function updateDepartmentHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  const dept = await orgService.updateDepartment(db, id, body);
  return { data: dept };
}

/** F-M1-07: DELETE /departments/:id — 删除部门（B-M1-39 级联删除子部门） */
async function deleteDepartmentHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await orgService.deleteDepartment(db, id);
  return { success: true };
}

// ============================================================
// Route Handlers — Role (F-M1-08)
// ============================================================

/** F-M1-08: GET /roles — 角色列表（B-M1-43 排序 + B-M1-44 搜索 + B-M1-45 部门筛选） */
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

/** F-M1-08: POST /roles — 创建角色（B-M1-47 name唯一 + B-M1-48 departmentId 校验） */
async function createRoleHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { projectId } = request.params as { projectId: string };
  const body = request.body as Record<string, unknown>;
  const role = await orgService.createRole(db, projectId, body);
  return { data: role };
}

/** F-M1-08: GET /roles/:id — 角色详情 */
async function getRoleHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const role = await orgService.getRoleById(db, id);
  return { data: role };
}

/** F-M1-08: PUT /roles/:id — 更新角色（B-M1-37 乐观锁） */
async function updateRoleHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  const role = await orgService.updateRole(db, id, body);
  return { data: role };
}

/** F-M1-08: DELETE /roles/:id — 删除角色 */
async function deleteRoleHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await orgService.deleteRole(db, id);
  return { success: true };
}

// ============================================================
// Route Handlers — External Entity (F-M1-09)
// ============================================================

/** F-M1-09: GET /external-entities — 外部实体列表（B-M1-54 排序 + B-M1-55 搜索） */
async function listExternalEntitiesHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { projectId } = request.params as { projectId: string };
  const { search, page, pageSize } = request.query as Record<string, unknown>;
  return orgService.listExternalEntities(db, projectId, {
    search: search as string | undefined,
    page: page as number | undefined,
    pageSize: pageSize as number | undefined,
  });
}

/** F-M1-09: POST /external-entities — 创建外部实体（B-M1-57 name唯一 + B-M1-58 entityType 校验） */
async function createExternalEntityHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { projectId } = request.params as { projectId: string };
  const body = request.body as Record<string, unknown>;
  const entity = await orgService.createExternalEntity(db, projectId, body);
  return { data: entity };
}

/** F-M1-09: GET /external-entities/:id — 外部实体详情 */
async function getExternalEntityHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const entity = await orgService.getExternalEntityById(db, id);
  return { data: entity };
}

/** F-M1-09: PUT /external-entities/:id — 更新外部实体（B-M1-37 乐观锁） */
async function updateExternalEntityHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  const entity = await orgService.updateExternalEntity(db, id, body);
  return { data: entity };
}

/** F-M1-09: DELETE /external-entities/:id — 删除外部实体 */
async function deleteExternalEntityHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await orgService.deleteExternalEntity(db, id);
  return { success: true };
}
