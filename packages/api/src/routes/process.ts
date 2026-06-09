/**
 * @module routes/process
 * @description 业务流程路由：M3 的 Process/Node/Edge/Layout/Validate 端点。
 *              Fastify 插件形式注册，前缀 /api/v1/projects/:projectId/processes。
 *
 * PRD Reference: docs/03-prd-ux/modules/business-process/business-process-prd.md
 * Interaction: docs/03-prd-ux/modules/business-process/business-process-interaction.md
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db.js';
import * as processService from '../services/process.service.js';
import * as nodeService from '../services/process-node.service.js';
import * as edgeService from '../services/process-edge.service.js';
import * as layoutService from '../services/process-layout.service.js';
import * as validateService from '../services/process-validate.service.js';
import {
  // Process schemas
  CreateProcessInput,
  UpdateProcessInput,
  ProcessListQuery,
  ProcessParamSchema,
  ProcessResourceParamSchema,
  // Node schemas
  CreateNodeInput,
  UpdateNodeInput,
  // Edge schemas
  CreateEdgeInput,
  UpdateEdgeInput,
  // Layout schemas
  UpdateLayoutInput,
  // Response schemas
  ProcessListResponse,
  ProcessDetailResponse,
  NodeDetailResponse,
  EdgeDetailResponse,
  LayoutDetailResponse,
  ValidateResponseSchema,
  DeleteResponse,
  ErrorResponse,
  // Base
  IdSchema,
} from '@apm/validation-schemas';
import { Type } from '@sinclair/typebox';

/** 复用的 process path param schema */
const ProcessParam = Type.Object({
  projectId: IdSchema,
  processId: IdSchema,
});

/** 复用的 resource path param schema */
const ResourceParam = Type.Object({
  projectId: IdSchema,
  processId: IdSchema,
  id: IdSchema,
});

export default async function processRoutes(app: FastifyInstance) {
  // ================================================================
  // Process CRUD (前缀: /processes)
  // ================================================================

  // GET / — 查询流程列表
  app.get('/', {
    schema: {
      querystring: ProcessListQuery,
      response: {
        200: ProcessListResponse,
        400: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Processes'],
      summary: '查询流程列表',
      description: '分页/排序/搜索/status 筛选',
    },
  }, listProcessesHandler);

  // POST / — 创建流程
  app.post('/', {
    schema: {
      body: CreateProcessInput,
      response: {
        201: ProcessDetailResponse,
        400: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Processes'],
      summary: '创建流程',
      description: 'name 在项目范围内唯一',
    },
  }, createProcessHandler);

  // GET /:processId — 获取流程详情
  app.get('/:processId', {
    schema: {
      params: ProcessParam,
      response: {
        200: ProcessDetailResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Processes'],
      summary: '获取流程详情',
      description: '完整字段，含 nodeIds/edgeIds',
    },
  }, getProcessHandler);

  // PUT /:processId — 编辑流程
  app.put('/:processId', {
    schema: {
      params: ProcessParam,
      body: UpdateProcessInput,
      response: {
        200: ProcessDetailResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Processes'],
      summary: '编辑流程信息',
      description: '可编辑 name/displayName/description/status/entryNodeId/exitNodeIds/nodeIds/edgeIds',
    },
  }, updateProcessHandler);

  // DELETE /:processId — 删除流程
  app.delete('/:processId', {
    schema: {
      params: ProcessParam,
      response: {
        200: DeleteResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Processes'],
      summary: '删除流程',
      description: '物理删除',
    },
  }, deleteProcessHandler);

  // ================================================================
  // Node CRUD (前缀: /processes/:processId/nodes)
  // ================================================================

  // GET /:processId/nodes — 获取流程内的节点列表
  app.get('/:processId/nodes', {
    schema: {
      params: ProcessParam,
      response: {
        200: Type.Object({ data: Type.Array(NodeDetailResponse.properties.data) }),
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Process Nodes'],
      summary: '获取流程节点列表',
      description: '根据 process.nodeIds 返回节点',
    },
  }, listNodesHandler);

  // POST /:processId/nodes — 创建节点
  app.post('/:processId/nodes', {
    schema: {
      params: ProcessParam,
      body: CreateNodeInput,
      response: {
        201: NodeDetailResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Process Nodes'],
      summary: '创建节点',
      description: '创建节点并追加到流程的 nodeIds',
    },
  }, createNodeHandler);

  // GET /:processId/nodes/:id — 获取节点详情
  app.get('/:processId/nodes/:id', {
    schema: {
      params: ResourceParam,
      response: {
        200: NodeDetailResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Process Nodes'],
      summary: '获取节点详情',
    },
  }, getNodeHandler);

  // PUT /:processId/nodes/:id — 编辑节点
  app.put('/:processId/nodes/:id', {
    schema: {
      params: ResourceParam,
      body: UpdateNodeInput,
      response: {
        200: NodeDetailResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Process Nodes'],
      summary: '编辑节点信息',
    },
  }, updateNodeHandler);

  // DELETE /:processId/nodes/:id — 删除节点
  app.delete('/:processId/nodes/:id', {
    schema: {
      params: ResourceParam,
      response: {
        200: DeleteResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Process Nodes'],
      summary: '删除节点',
      description: '删除节点并从流程 nodeIds 中移除，节点仍被边引用时拒绝删除',
    },
  }, deleteNodeHandler);

  // ================================================================
  // Edge CRUD (前缀: /processes/:processId/edges)
  // ================================================================

  // GET /:processId/edges — 获取流程内的边列表
  app.get('/:processId/edges', {
    schema: {
      params: ProcessParam,
      response: {
        200: Type.Object({ data: Type.Array(EdgeDetailResponse.properties.data) }),
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Process Edges'],
      summary: '获取流程边列表',
    },
  }, listEdgesHandler);

  // POST /:processId/edges — 创建边
  app.post('/:processId/edges', {
    schema: {
      params: ProcessParam,
      body: CreateEdgeInput,
      response: {
        201: EdgeDetailResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Process Edges'],
      summary: '创建边',
      description: '创建边并追加到流程的 edgeIds，不允许自环',
    },
  }, createEdgeHandler);

  // GET /:processId/edges/:id — 获取边详情
  app.get('/:processId/edges/:id', {
    schema: {
      params: ResourceParam,
      response: {
        200: EdgeDetailResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Process Edges'],
      summary: '获取边详情',
    },
  }, getEdgeHandler);

  // PUT /:processId/edges/:id — 编辑边
  app.put('/:processId/edges/:id', {
    schema: {
      params: ResourceParam,
      body: UpdateEdgeInput,
      response: {
        200: EdgeDetailResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Process Edges'],
      summary: '编辑边信息',
    },
  }, updateEdgeHandler);

  // DELETE /:processId/edges/:id — 删除边
  app.delete('/:processId/edges/:id', {
    schema: {
      params: ResourceParam,
      response: {
        200: DeleteResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Process Edges'],
      summary: '删除边',
      description: '删除边并从流程 edgeIds 中移除',
    },
  }, deleteEdgeHandler);

  // ================================================================
  // Layout (前缀: /processes/:processId/layout)
  // ================================================================

  // GET /:processId/layout — 获取布局
  app.get('/:processId/layout', {
    schema: {
      params: ProcessParam,
      response: {
        200: LayoutDetailResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Process Layout'],
      summary: '获取流程布局',
      description: '首次访问自动创建默认布局',
    },
  }, getLayoutHandler);

  // PUT /:processId/layout — 更新布局
  app.put('/:processId/layout', {
    schema: {
      params: ProcessParam,
      body: UpdateLayoutInput,
      response: {
        200: LayoutDetailResponse,
        400: ErrorResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Process Layout'],
      summary: '更新流程布局',
      description: '部分更新，未传字段保持不变',
    },
  }, updateLayoutHandler);

  // ================================================================
  // Validate (前缀: /processes/:processId/validate)
  // ================================================================

  // POST /:processId/validate — 验证流程
  app.post('/:processId/validate', {
    schema: {
      params: ProcessParam,
      response: {
        200: ValidateResponseSchema,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Process Validate'],
      summary: '验证流程结构',
      description: 'DAG 循环检测 + 孤立节点检测 + 引用完整性检查',
    },
  }, validateProcessHandler);
}

// ================================================================
// Handler Functions — Process
// ================================================================

async function listProcessesHandler(
  request: FastifyRequest<{
    Params: { projectId: string };
    Querystring: {
      status?: string;
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
  const result = await processService.listProcesses(db, projectId, {
    status: request.query.status as 'draft' | 'active' | 'deprecated' | undefined,
    search: request.query.search,
    page: request.query.page,
    pageSize: request.query.pageSize,
    sort: request.query.sort as 'name' | 'createdAt' | 'updatedAt' | 'sortOrder' | undefined,
    order: request.query.order,
  });
  return reply.send(result);
}

async function createProcessHandler(
  request: FastifyRequest<{
    Params: { projectId: string };
    Body: { name: string; displayName: string; description?: string; parentProcessId?: string };
  }>,
  reply: FastifyReply,
) {
  const { projectId } = request.params;
  const process = await processService.createProcess(db, projectId, {
    name: request.body.name,
    displayName: request.body.displayName,
    description: request.body.description,
    parentProcessId: request.body.parentProcessId,
  });
  return reply.code(201).send({ data: process });
}

async function getProcessHandler(
  request: FastifyRequest<{ Params: { processId: string } }>,
  reply: FastifyReply,
) {
  const process = await processService.getProcessById(db, request.params.processId);
  return reply.send({ data: process });
}

async function updateProcessHandler(
  request: FastifyRequest<{
    Params: { processId: string };
    Body: {
      name?: string; displayName?: string; description?: string;
      status?: string; entryNodeId?: string | null; exitNodeIds?: string[];
      nodeIds?: string[]; edgeIds?: string[];
    };
  }>,
  reply: FastifyReply,
) {
  const process = await processService.updateProcess(db, request.params.processId, {
    name: request.body.name,
    displayName: request.body.displayName,
    description: request.body.description,
    status: request.body.status as 'draft' | 'active' | 'deprecated' | undefined,
    entryNodeId: request.body.entryNodeId,
    exitNodeIds: request.body.exitNodeIds,
    nodeIds: request.body.nodeIds,
    edgeIds: request.body.edgeIds,
  });
  return reply.send({ data: process });
}

async function deleteProcessHandler(
  request: FastifyRequest<{ Params: { processId: string } }>,
  reply: FastifyReply,
) {
  await processService.deleteProcess(db, request.params.processId);
  return reply.send({ success: true });
}

// ================================================================
// Handler Functions — Nodes
// ================================================================

async function listNodesHandler(
  request: FastifyRequest<{ Params: { processId: string } }>,
  reply: FastifyReply,
) {
  const nodes = await nodeService.listNodesByProcess(db, request.params.processId);
  return reply.send({ data: nodes });
}

async function createNodeHandler(
  request: FastifyRequest<{
    Params: { projectId: string; processId: string };
    Body: {
      nodeType: string; name: string; displayName: string; description?: string;
      holderType: string; holderId: string;
      actionRef?: string; decisionRef?: string; condition?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const { projectId, processId } = request.params;
  const node = await nodeService.createNode(db, projectId, processId, {
    nodeType: request.body.nodeType as 'action' | 'decision',
    name: request.body.name,
    displayName: request.body.displayName,
    description: request.body.description,
    holderType: request.body.holderType as 'role' | 'external_entity' | 'service',
    holderId: request.body.holderId,
    actionRef: request.body.actionRef,
    decisionRef: request.body.decisionRef,
    condition: request.body.condition,
  });
  return reply.code(201).send({ data: node });
}

async function getNodeHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const node = await nodeService.getNodeById(db, request.params.id);
  return reply.send({ data: node });
}

async function updateNodeHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      name?: string; displayName?: string; description?: string;
      holderType?: string; holderId?: string;
      actionRef?: string | null; decisionRef?: string | null; condition?: string | null;
    };
  }>,
  reply: FastifyReply,
) {
  const node = await nodeService.updateNode(db, request.params.id, {
    name: request.body.name,
    displayName: request.body.displayName,
    description: request.body.description,
    holderType: request.body.holderType as 'role' | 'external_entity' | 'service' | undefined,
    holderId: request.body.holderId,
    actionRef: request.body.actionRef,
    decisionRef: request.body.decisionRef,
    condition: request.body.condition,
  });
  return reply.send({ data: node });
}

async function deleteNodeHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await nodeService.deleteNode(db, request.params.id);
  return reply.send({ success: true });
}

// ================================================================
// Handler Functions — Edges
// ================================================================

async function listEdgesHandler(
  request: FastifyRequest<{ Params: { processId: string } }>,
  reply: FastifyReply,
) {
  const edges = await edgeService.listEdgesByProcess(db, request.params.processId);
  return reply.send({ data: edges });
}

async function createEdgeHandler(
  request: FastifyRequest<{
    Params: { projectId: string; processId: string };
    Body: {
      sourceNodeId: string; targetNodeId: string;
      label?: string; condition?: string;
      sourceAction?: string; sourceBranch?: string; targetAction?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const { projectId, processId } = request.params;
  const edge = await edgeService.createEdge(db, projectId, processId, {
    sourceNodeId: request.body.sourceNodeId,
    targetNodeId: request.body.targetNodeId,
    label: request.body.label,
    condition: request.body.condition,
    sourceAction: request.body.sourceAction,
    sourceBranch: request.body.sourceBranch,
    targetAction: request.body.targetAction,
  });
  return reply.code(201).send({ data: edge });
}

async function getEdgeHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const edge = await edgeService.getEdgeById(db, request.params.id);
  return reply.send({ data: edge });
}

async function updateEdgeHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      label?: string | null; condition?: string | null;
      sourceAction?: string | null; sourceBranch?: string | null; targetAction?: string | null;
    };
  }>,
  reply: FastifyReply,
) {
  const edge = await edgeService.updateEdge(db, request.params.id, {
    label: request.body.label,
    condition: request.body.condition,
    sourceAction: request.body.sourceAction,
    sourceBranch: request.body.sourceBranch,
    targetAction: request.body.targetAction,
  });
  return reply.send({ data: edge });
}

async function deleteEdgeHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await edgeService.deleteEdge(db, request.params.id);
  return reply.send({ success: true });
}

// ================================================================
// Handler Functions — Layout
// ================================================================

async function getLayoutHandler(
  request: FastifyRequest<{ Params: { processId: string } }>,
  reply: FastifyReply,
) {
  const layout = await layoutService.getOrCreateLayout(db, request.params.processId);
  return reply.send({ data: layout });
}

async function updateLayoutHandler(
  request: FastifyRequest<{
    Params: { processId: string };
    Body: {
      orientation?: string;
      participantLanes?: unknown[];
      customLanes?: unknown[];
      nodePositions?: Record<string, unknown>;
      laneOverrides?: Record<string, unknown>;
    };
  }>,
  reply: FastifyReply,
) {
  const layout = await layoutService.updateLayout(db, request.params.processId, {
    orientation: request.body.orientation as 'participant-horizontal' | 'participant-vertical' | undefined,
    participantLanes: request.body.participantLanes as any,
    customLanes: request.body.customLanes as any,
    nodePositions: request.body.nodePositions as any,
    laneOverrides: request.body.laneOverrides as any,
  });
  return reply.send({ data: layout });
}

// ================================================================
// Handler Functions — Validate
// ================================================================

async function validateProcessHandler(
  request: FastifyRequest<{ Params: { processId: string } }>,
  reply: FastifyReply,
) {
  const result = await validateService.validateProcess(db, request.params.processId);
  return reply.send(result);
}
