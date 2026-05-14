/**
 * @module routes/organization
 * @description 组织管理路由：公司(F-M1-06) + 部门(F-M1-07) + 角色(F-M1-08) + 外部实体(F-M1-09)。
 *              Fastify 插件形式注册，前缀 /api/v1/projects/:projectId。
 *              使用 Fastify 原生 schema 进行请求校验 + OpenAPI 文档生成。
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

  app.get('/companies', {
    schema: {
      querystring: CompanyListQuery,
      response: { 200: CompanyListResponse, 400: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询公司列表',
      description: 'B-M1-26(排序) / B-M1-27(双字段搜索)',
    },
  }, listCompaniesHandler);

  app.post('/companies', {
    schema: {
      body: CreateCompanyInput,
      response: { 201: CompanyDetailResponse, 400: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '创建公司',
      description: 'B-M1-28~B-M1-31',
    },
  }, createCompanyHandler);

  app.get('/companies/:id', {
    schema: {
      params: UuidParam,
      response: { 200: CompanyDetailResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询公司详情',
    },
  }, getCompanyHandler);

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
  // F-M1-07: Department Routes
  // ================================================================

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

  app.get('/companies/:companyId/departments/tree', {
    schema: {
      params: CompanyIdParam,
      response: { 200: DepartmentTreeResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询部门树形结构',
    },
  }, getDepartmentTreeHandler);

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

  app.get('/departments/:id', {
    schema: {
      params: UuidParam,
      response: { 200: DepartmentDetailResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询部门详情',
    },
  }, getDepartmentHandler);

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
  // F-M1-08: Role Routes
  // ================================================================

  app.get('/roles', {
    schema: {
      querystring: RoleListQuery,
      response: { 200: RoleListResponse, 400: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询角色列表',
      description: 'B-M1-43(排序) / B-M1-44(搜索) / B-M1-45(部门筛选)',
    },
  }, listRolesHandler);

  app.post('/roles', {
    schema: {
      body: CreateRoleInput,
      response: { 201: RoleDetailResponse, 400: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '创建角色',
      description: 'B-M1-47(name唯一) / B-M1-48(departmentId校验)',
    },
  }, createRoleHandler);

  app.get('/roles/:id', {
    schema: {
      params: UuidParam,
      response: { 200: RoleDetailResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询角色详情',
    },
  }, getRoleHandler);

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

  app.delete('/roles/:id', {
    schema: {
      params: UuidParam,
      response: { 200: DeleteResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '删除角色',
    },
  }, deleteRoleHandler);

  // ================================================================
  // F-M1-09: External Entity Routes
  // ================================================================

  app.get('/external-entities', {
    schema: {
      querystring: ExternalEntityListQuery,
      response: { 200: ExternalEntityListResponse, 400: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询外部实体列表',
      description: 'B-M1-54(排序) / B-M1-55(搜索)',
    },
  }, listExternalEntitiesHandler);

  app.post('/external-entities', {
    schema: {
      body: CreateExternalEntityInput,
      response: { 201: ExternalEntityDetailResponse, 400: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '创建外部实体',
      description: 'B-M1-57(name唯一) / B-M1-58(entityType校验)',
    },
  }, createExternalEntityHandler);

  app.get('/external-entities/:id', {
    schema: {
      params: UuidParam,
      response: { 200: ExternalEntityDetailResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Organization'],
      summary: '查询外部实体详情',
    },
  }, getExternalEntityHandler);

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
// Route Handlers — 保持不变
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
