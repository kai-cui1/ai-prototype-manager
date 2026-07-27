/**
 * @module routes/applications
 * @description 应用管理路由：F-M1-11 的 CRUD 端点。
 *              Fastify 插件形式注册，前缀 /api/v1/projects/:projectId。
 *              使用 Fastify 原生 schema 进行请求校验 + OpenAPI 文档生成。
 *
 * PRD Reference: docs/03-prd-ux/modules/application-management/application-management-prd.md
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '../db.js';
import * as appService from '../services/application.service.js';
import {
  // 请求 Schema（输入）
  CreateApplicationInput,
  UpdateApplicationInput,
  ApplicationListQuery,
  // 基础 Schema
  IdSchema,
  // 响应 Schema（输出 + 信封）
  ApplicationListResponse,
  ApplicationDetailResponse,
  DeleteResponse,
  // 错误 Schema
  ErrorResponse,
} from '@apm/validation-schemas';
import { applyDefaultEntityPermissions } from '../plugins/route-permissions.js';

/** 复用的 UUID path param schema */
const UuidParam = Type.Object({ id: IdSchema });

export default async function applicationRoutes(app: FastifyInstance) {
  // M6-Hardening：GET → entity.read / 写 → entity.write，scope 从 :projectId 提取
  applyDefaultEntityPermissions(app);

  // ================================================================
  // F-M1-11: Application Routes (前缀: /applications)
  // ================================================================

  // GET /applications — 查询应用列表
  app.get('/applications', {
    schema: {
      querystring: ApplicationListQuery,
      response: {
        200: ApplicationListResponse,
        400: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Applications'],
      summary: '查询应用列表',
      description: 'B-M1-50~53: 分页/排序/搜索/type 筛选，不返回 config',
    },
  }, listApplicationsHandler);

  // POST /applications — 创建应用
  app.post('/applications', {
    schema: {
      body: CreateApplicationInput,
      response: {
        201: ApplicationDetailResponse,
        400: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Applications'],
      summary: '创建应用',
      description: 'B-M1-54~58: name 唯一/icon 自动分配/type 不可改',
    },
  }, createApplicationHandler);

  // GET /applications/:id — 获取应用详情
  app.get('/applications/:id', {
    schema: {
      params: UuidParam,
      response: {
        200: ApplicationDetailResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Applications'],
      summary: '获取应用详情',
      description: '返回完整字段（含 config）',
    },
  }, getApplicationHandler);

  // PUT /applications/:id — 编辑应用
  app.put('/applications/:id', {
    schema: {
      params: UuidParam,
      body: UpdateApplicationInput,
      response: {
        200: ApplicationDetailResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Applications'],
      summary: '编辑应用信息',
      description: 'B-M1-59~61: 可编辑 name/displayName/description，type 不可改',
    },
  }, updateApplicationHandler);

  // DELETE /applications/:id — 删除应用
  app.delete('/applications/:id', {
    schema: {
      params: UuidParam,
      response: {
        200: DeleteResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Applications'],
      summary: '删除应用',
      description: 'B-M1-62~65: service 类型检查引用约束，其他类型直接删除',
    },
  }, deleteApplicationHandler);
}

// ================================================================
// Handler Functions
// ================================================================

/** GET /applications — 列表查询 */
async function listApplicationsHandler(
  request: FastifyRequest<{
    Params: { projectId: string };
    Querystring: {
      type?: string;
      search?: string;
      page?: number;
      pageSize?: number;
      sort?: string;
      order?: 'asc' | 'desc';
    };
  }>,
  reply: FastifyReply,
) {
  const { projectId } = request.params;
  const result = await appService.listApplications(db, projectId, {
    type: request.query.type as 'web' | 'wxapp' | 'android' | 'ios' | 'pc' | 'api' | 'service' | undefined,
    search: request.query.search,
    page: request.query.page,
    pageSize: request.query.pageSize,
    sort: request.query.sort as 'name' | 'createdAt' | 'updatedAt' | 'sortOrder' | undefined,
    order: request.query.order,
  });

  return reply.send(result);
}

/** POST /applications — 创建应用 */
async function createApplicationHandler(
  request: FastifyRequest<{
    Params: { projectId: string };
    Body: {
      type: 'web' | 'wxapp' | 'android' | 'ios' | 'pc' | 'api' | 'service';
      name: string;
      displayName: string;
      description?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const { projectId } = request.params;
  const application = await appService.createApplication(db, projectId, {
    type: request.body.type,
    name: request.body.name,
    displayName: request.body.displayName,
    description: request.body.description,
  });

  return reply.code(201).send({ data: application });
}

/** GET /applications/:id — 获取详情 */
async function getApplicationHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const application = await appService.getApplicationById(db, request.params.id);
  return reply.send({ data: application });
}

/** PUT /applications/:id — 编辑应用 */
async function updateApplicationHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      name?: string;
      displayName?: string;
      description?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const application = await appService.updateApplication(db, request.params.id, {
    name: request.body.name,
    displayName: request.body.displayName,
    description: request.body.description,
  });

  return reply.send({ data: application });
}

/** DELETE /applications/:id — 删除应用 */
async function deleteApplicationHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await appService.deleteApplication(db, request.params.id);
  return reply.send({ success: true });
}
