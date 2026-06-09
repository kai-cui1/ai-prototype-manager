/**
 * @module routes/application-behavior
 * @description 应用行为管理路由：Action CRUD + Decision CRUD (F-M1-14)。
 *              Fastify 插件形式注册，前缀 /api/v1/projects/:projectId/applications/:appId。
 *              使用 Fastify 原生 schema 进行请求校验 + OpenAPI 文档生成。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '../db.js';
import * as appBehaviorService from '../services/application-behavior.service.js';
import {
  CreateAppActionInput,
  UpdateAppActionInput,
  CreateDecisionInput,
  UpdateDecisionInput,
  IdSchema,
  ErrorResponse,
  DeleteResponse,
  ActionListResponse,
  ActionCreateResponse,
  ActionUpdateResponse,
  DecisionListResponse,
  DecisionCreateResponse,
  DecisionUpdateResponse,
} from '@apm/validation-schemas';

/** 复用的 path param schema */
const AppIdParam = Type.Object({ appId: IdSchema });
const ActionIdParam = Type.Object({ appId: IdSchema, actionId: IdSchema });
const DecisionIdParam = Type.Object({ appId: IdSchema, decisionId: IdSchema });

export default async function applicationBehaviorRoutes(app: FastifyInstance) {
  // ================================================================
  // Action CRUD (F-M1-14)
  // ================================================================

  // GET /applications/:appId/actions — 查询 Action 列表
  app.get('/actions', {
    schema: {
      params: AppIdParam,
      response: { 200: ActionListResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Application Behavior'],
      summary: '查询应用的 Action 列表',
      description: 'B-M1-167(原序返回) / B-M1-168(归档可查)',
    },
  }, listActionsHandler);

  // POST /applications/:appId/actions — 创建 Action
  app.post('/actions', {
    schema: {
      params: AppIdParam,
      body: CreateAppActionInput,
      response: {
        201: ActionCreateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Application Behavior'],
      summary: '创建 Action',
      description: 'B-M1-169~174',
    },
  }, createActionHandler);

  // PUT /applications/:appId/actions/:actionId — 更新 Action
  app.put('/actions/:actionId', {
    schema: {
      params: ActionIdParam,
      body: UpdateAppActionInput,
      response: {
        200: ActionUpdateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Application Behavior'],
      summary: '更新 Action',
      description: 'B-M1-175~179',
    },
  }, updateActionHandler);

  // DELETE /applications/:appId/actions/:actionId — 删除 Action
  app.delete('/actions/:actionId', {
    schema: {
      params: ActionIdParam,
      response: {
        200: DeleteResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Application Behavior'],
      summary: '删除 Action',
      description: 'B-M1-180~182',
    },
  }, deleteActionHandler);

  // ================================================================
  // Decision CRUD (F-M1-14)
  // ================================================================

  // GET /applications/:appId/decisions — 查询 Decision 列表
  app.get('/decisions', {
    schema: {
      params: AppIdParam,
      response: { 200: DecisionListResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Application Behavior'],
      summary: '查询应用的 Decision 列表',
      description: 'B-M1-167(原序返回) / B-M1-168(归档可查)',
    },
  }, listDecisionsHandler);

  // POST /applications/:appId/decisions — 创建 Decision
  app.post('/decisions', {
    schema: {
      params: AppIdParam,
      body: CreateDecisionInput,
      response: {
        201: DecisionCreateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Application Behavior'],
      summary: '创建 Decision',
      description: 'B-M1-183~190',
    },
  }, createDecisionHandler);

  // PUT /applications/:appId/decisions/:decisionId — 更新 Decision
  app.put('/decisions/:decisionId', {
    schema: {
      params: DecisionIdParam,
      body: UpdateDecisionInput,
      response: {
        200: DecisionUpdateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Application Behavior'],
      summary: '更新 Decision',
      description: 'B-M1-191~195',
    },
  }, updateDecisionHandler);

  // DELETE /applications/:appId/decisions/:decisionId — 删除 Decision
  app.delete('/decisions/:decisionId', {
    schema: {
      params: DecisionIdParam,
      response: {
        200: DeleteResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Application Behavior'],
      summary: '删除 Decision',
      description: 'B-M1-196~198',
    },
  }, deleteDecisionHandler);
}

// ============================================================
// Handlers
// ============================================================

// ---- Action handlers ----

async function listActionsHandler(
  req: FastifyRequest<{ Params: { appId: string } }>,
  reply: FastifyReply,
) {
  const result = await appBehaviorService.listActions(db, req.params.appId);
  return reply.send({ data: { items: result.data, version: result.version } });
}

async function createActionHandler(
  req: FastifyRequest<{ Params: { appId: string }; Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const result = await appBehaviorService.createAction(db, req.params.appId, req.body);
  return reply.status(201).send({ data: result });
}

async function updateActionHandler(
  req: FastifyRequest<{ Params: { appId: string; actionId: string }; Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const result = await appBehaviorService.updateAction(db, req.params.appId, req.params.actionId, req.body);
  return reply.send({ data: result });
}

async function deleteActionHandler(
  req: FastifyRequest<{ Params: { appId: string; actionId: string } }>,
  _reply: FastifyReply,
) {
  await appBehaviorService.deleteAction(db, req.params.appId, req.params.actionId);
  return { success: true };
}

// ---- Decision handlers ----

async function listDecisionsHandler(
  req: FastifyRequest<{ Params: { appId: string } }>,
  reply: FastifyReply,
) {
  const result = await appBehaviorService.listDecisions(db, req.params.appId);
  return reply.send({ data: { items: result.data, version: result.version } });
}

async function createDecisionHandler(
  req: FastifyRequest<{ Params: { appId: string }; Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const result = await appBehaviorService.createDecision(db, req.params.appId, req.body);
  return reply.status(201).send({ data: result });
}

async function updateDecisionHandler(
  req: FastifyRequest<{ Params: { appId: string; decisionId: string }; Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const result = await appBehaviorService.updateDecision(db, req.params.appId, req.params.decisionId, req.body);
  return reply.send({ data: result });
}

async function deleteDecisionHandler(
  req: FastifyRequest<{ Params: { appId: string; decisionId: string } }>,
  _reply: FastifyReply,
) {
  await appBehaviorService.deleteDecision(db, req.params.appId, req.params.decisionId);
  return { success: true };
}
