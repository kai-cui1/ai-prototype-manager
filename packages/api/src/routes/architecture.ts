/**
 * @module routes/architecture
 * @description 业务架构路由：M4 的 Architecture CRUD + 流程映射端点。
 *              Fastify 插件形式注册，前缀 /api/v1/projects/:projectId/architectures。
 *
 * 端点列表（10个）：
 *   F-M4-01: GET    /                                       查询架构树（扁平列表）
 *   F-M4-08: GET    /search-processes?q=xxx                 流程模糊搜索（供关联选择）
 *   F-M4-02: POST   /                                       创建架构节点
 *   F-M4-03: PATCH  /:archId                                编辑架构节点
 *   F-M4-04: DELETE /:archId                                删除架构节点
 *   F-M4-05: POST   /:archId/processes                      关联流程到节点
 *   F-M4-06: DELETE /:archId/processes/:processId           解除流程关联
 *   F-M4-07: PATCH  /:archId/processes/order                重排关联流程顺序
 *            注意：PATCH /processes/order 必须在 DELETE /processes/:processId 之前注册
 *
 * PRD Reference: docs/03-prd-ux/modules/business-architecture/business-architecture-prd.md
 * Tech Design: docs/04-tech-design/modules/business-architecture/business-architecture-tech-design.md
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db.js';
import * as archService from '../services/architecture.service.js';
import * as processService from '../services/process.service.js';
import {
  CreateArchitectureInput,
  UpdateArchitectureInput,
  AddProcessMappingInput,
  ReorderProcessesInput,
  ProcessSearchQuery,
  ArchParamSchema,
  ArchNodeParamSchema,
  ArchProcessParamSchema,
  ArchTreeResponse,
  ArchNodeResponse,
  ProcessSearchResponse,
  DeleteResponse,
  ErrorResponse,
  IdSchema,
} from '@apm/validation-schemas';
import { Type } from '@sinclair/typebox';

export default async function architectureRoutes(app: FastifyInstance) {
  // ================================================================
  // F-M4-01: 查询架构树（扁平列表，前端组装树形）
  // ================================================================
  app.get('/', {
    schema: {
      params: ArchParamSchema,
      response: {
        200: ArchTreeResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Architecture'],
      summary: '查询业务架构树',
      description: '返回项目下所有架构节点（扁平列表），每个节点含关联流程列表。前端按 parentId 递归组装树形。',
    },
  }, listArchitecturesHandler);

  // ================================================================
  // F-M4-08: 流程模糊搜索（供架构节点关联选择使用）
  // 注意：必须在 GET /:archId 之前注册，避免 'search-processes' 被当成 archId
  // ================================================================
  app.get('/search-processes', {
    schema: {
      params: ArchParamSchema,
      querystring: ProcessSearchQuery,
      response: {
        200: ProcessSearchResponse,
        400: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Architecture'],
      summary: '流程模糊搜索',
      description: '按 name/displayName ILIKE 搜索，最多返回 20 条，供架构节点关联选择',
    },
  }, searchProcessesHandler);

  // ================================================================
  // F-M4-02: 创建架构节点
  // ================================================================
  app.post('/', {
    schema: {
      params: ArchParamSchema,
      body: CreateArchitectureInput,
      response: {
        201: ArchNodeResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Architecture'],
      summary: '创建架构节点',
      description: 'name 在项目内唯一，parentId 可选（根节点时为空）',
    },
  }, createArchitectureHandler);

  // ================================================================
  // F-M4-03: 编辑架构节点
  // ================================================================
  app.patch('/:archId', {
    schema: {
      params: ArchNodeParamSchema,
      body: UpdateArchitectureInput,
      response: {
        200: ArchNodeResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Architecture'],
      summary: '编辑架构节点',
      description: '部分更新 name/displayName/description/level，未传字段保持不变',
    },
  }, updateArchitectureHandler);

  // ================================================================
  // F-M4-04: 删除架构节点
  // ================================================================
  app.delete('/:archId', {
    schema: {
      params: ArchNodeParamSchema,
      response: {
        200: DeleteResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Architecture'],
      summary: '删除架构节点',
      description: '有子节点时拒绝删除（409），流程映射随节点一并级联删除',
    },
  }, deleteArchitectureHandler);

  // ================================================================
  // F-M4-05: 关联流程到架构节点
  // ================================================================
  app.post('/:archId/processes', {
    schema: {
      params: ArchNodeParamSchema,
      body: AddProcessMappingInput,
      response: {
        201: ArchNodeResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Architecture'],
      summary: '关联流程到架构节点',
      description: '重复关联返回 409，跨项目流程返回 400',
    },
  }, addProcessMappingHandler);

  // ================================================================
  // F-M4-07: 重排关联流程顺序（必须在 DELETE /:archId/processes/:processId 之前注册）
  // ================================================================
  app.patch('/:archId/processes/order', {
    schema: {
      params: ArchNodeParamSchema,
      body: ReorderProcessesInput,
      response: {
        200: ArchNodeResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Architecture'],
      summary: '重排架构节点关联流程顺序',
      description: 'processIds 必须包含该节点所有当前关联流程，缺少或有多余 ID 均返回 400',
    },
  }, reorderProcessesHandler);

  // ================================================================
  // F-M4-06: 解除流程关联
  // ================================================================
  app.delete('/:archId/processes/:processId', {
    schema: {
      params: ArchProcessParamSchema,
      response: {
        200: DeleteResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Architecture'],
      summary: '解除架构节点与流程的关联',
      description: '映射不存在时返回 404，不影响流程本身',
    },
  }, removeProcessMappingHandler);
}

// ================================================================
// Handler Functions
// ================================================================

async function listArchitecturesHandler(
  request: FastifyRequest<{ Params: { projectId: string } }>,
  reply: FastifyReply,
) {
  const nodes = await archService.listArchitectures(db, request.params.projectId);
  return reply.send({ data: nodes });
}

async function searchProcessesHandler(
  request: FastifyRequest<{
    Params: { projectId: string };
    Querystring: { q: string };
  }>,
  reply: FastifyReply,
) {
  const results = await processService.searchProcesses(db, request.params.projectId, request.query.q);
  return reply.send({ data: results });
}

async function createArchitectureHandler(
  request: FastifyRequest<{
    Params: { projectId: string };
    Body: {
      name: string;
      displayName: string;
      description?: string;
      parentId?: string | null;
      level?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const node = await archService.createArchitecture(db, request.params.projectId, {
    name: request.body.name,
    displayName: request.body.displayName,
    description: request.body.description,
    parentId: request.body.parentId,
    level: request.body.level,
  });
  return reply.code(201).send({ data: node });
}

async function updateArchitectureHandler(
  request: FastifyRequest<{
    Params: { projectId: string; archId: string };
    Body: {
      name?: string;
      displayName?: string;
      description?: string | null;
      level?: string | null;
    };
  }>,
  reply: FastifyReply,
) {
  const node = await archService.updateArchitecture(db, request.params.archId, {
    name: request.body.name,
    displayName: request.body.displayName,
    description: request.body.description,
    level: request.body.level,
  });
  return reply.send({ data: node });
}

async function deleteArchitectureHandler(
  request: FastifyRequest<{ Params: { projectId: string; archId: string } }>,
  reply: FastifyReply,
) {
  await archService.deleteArchitecture(db, request.params.archId);
  return reply.send({ success: true });
}

async function addProcessMappingHandler(
  request: FastifyRequest<{
    Params: { projectId: string; archId: string };
    Body: { processId: string };
  }>,
  reply: FastifyReply,
) {
  const node = await archService.addProcessMapping(
    db,
    request.params.projectId,
    request.params.archId,
    request.body.processId,
  );
  return reply.code(201).send({ data: node });
}

async function removeProcessMappingHandler(
  request: FastifyRequest<{ Params: { projectId: string; archId: string; processId: string } }>,
  reply: FastifyReply,
) {
  await archService.removeProcessMapping(
    db,
    request.params.projectId,
    request.params.archId,
    request.params.processId,
  );
  return reply.send({ success: true });
}

async function reorderProcessesHandler(
  request: FastifyRequest<{
    Params: { projectId: string; archId: string };
    Body: { processIds: string[] };
  }>,
  reply: FastifyReply,
) {
  const node = await archService.reorderProcesses(
    db,
    request.params.projectId,
    request.params.archId,
    request.body.processIds,
  );
  return reply.send({ data: node });
}
