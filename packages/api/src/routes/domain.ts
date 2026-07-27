/**
 * @module routes/domain
 * @description M2 领域模型管理路由。
 *              覆盖 F-M2-01（实体 CRUD）+ F-M2-02（字段管理）+
 *              F-M2-03（关系管理）+ F-M2-04（ER 图端点）+
 *              F-M2-06（领域边界管理）。
 *
 *  路由前缀：/api/v1/projects/:projectId/domain（在 app.ts 中注册）
 *
 * PRD Reference: docs/03-prd-ux/modules/domain-model/domain-model-prd.md
 * Tech Design:   docs/04-tech-design/domain-model-tech-design.md §3
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db.js';
import * as domainService from '../services/domain.service.js';
import {
  CreateEntityInput,
  UpdateEntityInput,
  EntityListQuery,
  CreateFieldInput,
  UpdateFieldInput,
  ReorderFieldsInput,
  CreateRelationInput,
  UpdateRelationInput,
  RelationListQuery,
  ERGraphResponse,
  CreateBoundaryInput,
  UpdateBoundaryInput,
  UpdateEntityDomainInput,
  BoundaryListQuery,
  ErrorResponse,
} from '@apm/validation-schemas';
import { applyDefaultEntityPermissions } from '../plugins/route-permissions.js';

/**
 * 注册领域模型路由（F-M2-01 ~ F-M2-04）。
 * 注意：此插件注册在 /api/v1/projects/:projectId/domain 前缀下。
 */
export default async function domainRoutes(app: FastifyInstance) {
  // M6-Hardening：GET → entity.read / 写 → entity.write，scope 从 :projectId 提取
  applyDefaultEntityPermissions(app);
  // ====================================================
  // F-M2-01: 实体管理
  // ====================================================

  /** GET /entities — 实体列表（含 fieldCount + relationCount） */
  app.get('/entities', {
    schema: {
      querystring: EntityListQuery,
      response: { 400: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '查询实体列表',
      description: 'F-M2-01: 支持 search 模糊搜索、category 筛选、分页。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const query = request.query as {
      search?: string;
      category?: string;
      page?: number;
      pageSize?: number;
    };
    const result = await domainService.listEntities(db, projectId, query);
    return reply.code(200).send(result);
  });

  /** POST /entities — 创建实体 */
  app.post('/entities', {
    schema: {
      body: CreateEntityInput,
      response: { 400: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '创建领域实体',
      description: 'F-M2-01: name 在项目内唯一，pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const body = request.body as {
      name: string;
      displayName: string;
      description?: string;
      category?: string;
    };
    const entity = await domainService.createEntity(db, projectId, body);
    return reply.code(201).send({ data: entity });
  });

  /** GET /entities/:entityId — 实体详情（含字段+关系） */
  app.get('/entities/:entityId', {
    schema: {
      response: { 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '获取实体详情',
      description: 'F-M2-01: 返回 fields、outboundRelations、inboundRelations。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, entityId } = request.params as { projectId: string; entityId: string };
    const entity = await domainService.getEntityById(db, projectId, entityId);
    return reply.code(200).send({ data: entity });
  });

  /** PUT /entities/:entityId — 更新实体 */
  app.put('/entities/:entityId', {
    schema: {
      body: UpdateEntityInput,
      response: { 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '更新实体',
      description: 'F-M2-01: 支持更新 displayName/description/category/canvasPosition，name 不可修改。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, entityId } = request.params as { projectId: string; entityId: string };
    const body = request.body as {
      displayName?: string;
      description?: string;
      category?: string | null;
      canvasPosition?: { x: number; y: number } | null;
    };
    const entity = await domainService.updateEntity(db, projectId, entityId, body);
    return reply.code(200).send({ data: entity });
  });

  /** DELETE /entities/:entityId — 删除实体（级联删除字段和关系） */
  app.delete('/entities/:entityId', {
    schema: {
      response: { 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '删除实体',
      description: 'F-M2-01: 级联删除字段、关系（DB ON DELETE CASCADE）。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, entityId } = request.params as { projectId: string; entityId: string };
    await domainService.deleteEntity(db, projectId, entityId);
    return reply.code(204).send();
  });

  /** GET /entities/:entityId/er-graph — 实体级局部 ER 图 */
  app.get('/entities/:entityId/er-graph', {
    schema: {
      response: { 200: ERGraphResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '实体级局部 ER 图',
      description: 'F-M2-04: 以指定实体为中心，返回直接关联的实体和关系（一层深度）。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, entityId } = request.params as { projectId: string; entityId: string };
    const graph = await domainService.getEntityERGraph(db, projectId, entityId);
    return reply.code(200).send({ data: graph });
  });

  // ====================================================
  // F-M2-02: 字段管理
  // ====================================================

  /** GET /entities/:entityId/fields — 字段列表 */
  app.get('/entities/:entityId/fields', {
    schema: {
      response: { 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '查询字段列表',
      description: 'F-M2-02: 按 sort_order ASC 返回。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, entityId } = request.params as { projectId: string; entityId: string };
    const fields = await domainService.listFields(db, projectId, entityId);
    return reply.code(200).send({ data: fields });
  });

  /** POST /entities/:entityId/fields — 创建字段 */
  app.post('/entities/:entityId/fields', {
    schema: {
      body: CreateFieldInput,
      response: { 400: ErrorResponse, 409: ErrorResponse, 422: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '创建字段',
      description: 'F-M2-02: 支持 9 种字段类型，enum 类型需传 constraints.options。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, entityId } = request.params as { projectId: string; entityId: string };
    const body = request.body as {
      name: string;
      displayName: string;
      description?: string;
      fieldType: string;
      isRequired?: boolean;
      defaultValue?: unknown;
      constraints?: unknown;
    };
    const field = await domainService.createField(db, projectId, entityId, body);
    return reply.code(201).send({ data: field });
  });

  /** GET /entities/:entityId/fields/:fieldId — 字段详情 */
  app.get('/entities/:entityId/fields/:fieldId', {
    schema: {
      response: { 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '获取字段详情',
      description: 'F-M2-02',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, entityId, fieldId } = request.params as {
      projectId: string;
      entityId: string;
      fieldId: string;
    };
    const field = await domainService.getFieldById(db, projectId, entityId, fieldId);
    return reply.code(200).send({ data: field });
  });

  /** PUT /entities/:entityId/fields/:fieldId — 更新字段 */
  app.put('/entities/:entityId/fields/:fieldId', {
    schema: {
      body: UpdateFieldInput,
      response: { 400: ErrorResponse, 404: ErrorResponse, 422: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '更新字段',
      description: 'F-M2-02: name 不可修改，修改 fieldType 时需同步更新 constraints。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, entityId, fieldId } = request.params as {
      projectId: string;
      entityId: string;
      fieldId: string;
    };
    const body = request.body as {
      displayName?: string;
      description?: string;
      fieldType?: string;
      isRequired?: boolean;
      defaultValue?: unknown;
      constraints?: unknown;
    };
    const field = await domainService.updateField(db, projectId, entityId, fieldId, body);
    return reply.code(200).send({ data: field });
  });

  /** DELETE /entities/:entityId/fields/:fieldId — 删除字段 */
  app.delete('/entities/:entityId/fields/:fieldId', {
    schema: {
      response: { 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '删除字段',
      description: 'F-M2-02',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, entityId, fieldId } = request.params as {
      projectId: string;
      entityId: string;
      fieldId: string;
    };
    await domainService.deleteField(db, projectId, entityId, fieldId);
    return reply.code(204).send();
  });

  /** PATCH /entities/:entityId/fields/reorder — 批量重排序字段 */
  app.patch('/entities/:entityId/fields/reorder', {
    schema: {
      body: ReorderFieldsInput,
      response: { 404: ErrorResponse, 422: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '批量重排序字段',
      description: 'F-M2-02: orderedIds 必须包含该实体的全部字段 ID。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, entityId } = request.params as { projectId: string; entityId: string };
    const { orderedIds } = request.body as { orderedIds: string[] };
    const fields = await domainService.reorderFields(db, projectId, entityId, orderedIds);
    return reply.code(200).send({ data: fields });
  });

  // ====================================================
  // F-M2-03: 关系管理
  // ====================================================

  /** GET /relations — 关系列表（含实体名称） */
  app.get('/relations', {
    schema: {
      querystring: RelationListQuery,
      response: { 400: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '查询关系列表',
      description: 'F-M2-03: 支持按 entityId 筛选（source 或 target 为该实体的关系）。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const query = request.query as { entityId?: string; page?: number; pageSize?: number };
    const result = await domainService.listRelations(db, projectId, query);
    return reply.code(200).send(result);
  });

  /** POST /relations — 创建关系 */
  app.post('/relations', {
    schema: {
      body: CreateRelationInput,
      response: {
        400: ErrorResponse,
        409: ErrorResponse,
        422: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Domain'],
      summary: '创建关系',
      description: 'F-M2-03: 单向关系，不允许自关联，(project,source,target,kind) 唯一。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const body = request.body as {
      sourceEntityId: string;
      targetEntityId: string;
      relationKind: string;
      sourceCardinality?: string;
      targetCardinality?: string;
      displayName?: string;
      description?: string;
      dimension?: string;
    };
    const relation = await domainService.createRelation(db, projectId, body);
    return reply.code(201).send({ data: relation });
  });

  /** PUT /relations/:relationId — 更新关系 */
  app.put('/relations/:relationId', {
    schema: {
      body: UpdateRelationInput,
      response: { 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '更新关系',
      description: 'F-M2-03: 允许更新 relationKind/sourceCardinality/targetCardinality/displayName/description。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, relationId } = request.params as { projectId: string; relationId: string };
    const body = request.body as {
      relationKind?: 'association' | 'dependency' | 'aggregation' | 'composition' | 'generalization';
      sourceCardinality?: string;
      targetCardinality?: string;
      displayName?: string | null;
      description?: string | null;
      dimension?: string | null;
    };
    const relation = await domainService.updateRelation(db, projectId, relationId, body);
    return reply.code(200).send({ data: relation });
  });

  /** DELETE /relations/:relationId — 删除关系 */
  app.delete('/relations/:relationId', {
    schema: {
      response: { 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '删除关系',
      description: 'F-M2-03',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, relationId } = request.params as { projectId: string; relationId: string };
    await domainService.deleteRelation(db, projectId, relationId);
    return reply.code(204).send();
  });

  /** GET /relations/graph — 项目全量 ER 图 */
  app.get('/relations/graph', {
    schema: {
      response: { 200: ERGraphResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '项目全量 ER 图',
      description: 'F-M2-04: 返回项目下所有实体节点和关系边，通用格式，含 canvasPosition。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const graph = await domainService.getFullERGraph(db, projectId);
    return reply.code(200).send({ data: graph });
  });

  /** GET /er-graph — 项目全量 ER 图（别名，前端主调用入口） */
  app.get('/er-graph', {
    schema: {
      response: { 200: ERGraphResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '项目全量 ER 图',
      description: 'F-M2-04: 返回项目下所有实体节点、关系边和领域框，通用格式，含 canvasPosition。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const graph = await domainService.getFullERGraph(db, projectId);
    return reply.code(200).send({ data: graph });
  });

  // ====================================================
  // F-M2-06: 领域边界管理
  // ====================================================

  /** GET /boundaries — 领域列表（含 entityCount） */
  app.get('/boundaries', {
    schema: {
      querystring: BoundaryListQuery,
      response: { 400: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '查询领域列表',
      description: 'F-M2-06: 返回项目下所有领域边界，含 entityCount 统计。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const query = request.query as { page?: number; pageSize?: number; search?: string };
    const result = await domainService.listBoundaries(db, projectId, query);
    return reply.code(200).send(result);
  });

  /** POST /boundaries — 创建领域 */
  app.post('/boundaries', {
    schema: {
      body: CreateBoundaryInput,
      response: { 400: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '创建领域边界',
      description: 'F-M2-06: name 在项目内唯一，领域框不可与其他领域框重叠。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const body = request.body as {
      name: string;
      description?: string;
      canvasPosition?: { x: number; y: number; width: number; height: number };
    };
    const boundary = await domainService.createBoundary(db, projectId, body);
    return reply.code(201).send({ data: boundary });
  });

  /** GET /boundaries/:boundaryId — 领域详情 */
  app.get('/boundaries/:boundaryId', {
    schema: {
      response: { 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '获取领域详情',
      description: 'F-M2-06: 返回领域基本信息、canvasPosition、entityCount。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, boundaryId } = request.params as { projectId: string; boundaryId: string };
    const boundary = await domainService.getBoundaryById(db, projectId, boundaryId);
    return reply.code(200).send({ data: boundary });
  });

  /** PUT /boundaries/:boundaryId — 更新领域 */
  app.put('/boundaries/:boundaryId', {
    schema: {
      body: UpdateBoundaryInput,
      response: { 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '更新领域边界',
      description: 'F-M2-06: 支持更新 name/description/canvasPosition，领域框不可重叠。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, boundaryId } = request.params as { projectId: string; boundaryId: string };
    const body = request.body as {
      name?: string;
      description?: string | null;
      canvasPosition?: { x: number; y: number; width: number; height: number } | null;
    };
    // R5 Why: Fastify Ajv coerceTypes 将 JSON null 强制转为空字符串，
    //         需还原为 null 语义（description 清除、canvasPosition 清除）
    const input = {
      ...body,
      description: (!body.description || body.description === 'null') ? null : body.description,
      canvasPosition: (!body.canvasPosition || body.canvasPosition === 'null') ? null : body.canvasPosition,
    };
    const boundary = await domainService.updateBoundary(db, projectId, boundaryId, input);
    return reply.code(200).send({ data: boundary });
  });

  /** DELETE /boundaries/:boundaryId — 删除领域 */
  app.delete('/boundaries/:boundaryId', {
    schema: {
      response: { 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '删除领域边界',
      description: 'F-M2-06: 删除领域后，归属实体的 domainId 自动置 null（DB ON DELETE SET NULL）。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, boundaryId } = request.params as { projectId: string; boundaryId: string };
    await domainService.deleteBoundary(db, projectId, boundaryId);
    return reply.code(204).send();
  });

  /** PUT /entities/:entityId/domain — 更新实体领域归属 */
  app.put('/entities/:entityId/domain', {
    schema: {
      body: UpdateEntityDomainInput,
      response: { 400: ErrorResponse, 404: ErrorResponse, 422: ErrorResponse, 500: ErrorResponse },
      tags: ['Domain'],
      summary: '更新实体领域归属',
      description: 'F-M2-06: domainId 设为目标领域 ID 则归属，设为 null 则脱离。松手即归属，无需确认。',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, entityId } = request.params as { projectId: string; entityId: string };
    const body = request.body as { domainId?: string | null };
    // R5 Why: Fastify Ajv coerceTypes 将 JSON null 强制转为空字符串 "" 或 "null"，
    //         需还原为 null 语义。领域 ID 为 UUID 格式，空字符串/""/"null" 均非合法 ID。
    const rawDomainId = body.domainId;
    const domainId = (!rawDomainId || rawDomainId === 'null') ? null : rawDomainId;
    await domainService.updateEntityDomain(db, projectId, entityId, domainId);
    return reply.code(200).send({ data: { entityId, domainId } });
  });
}
