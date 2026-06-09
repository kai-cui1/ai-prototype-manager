/**
 * @module routes/external-entity-behavior
 * @description 外部实体行为管理路由：Action CRUD + Decision CRUD (F-M1-13)。
 *              Fastify 插件形式注册，前缀 /api/v1/projects/:projectId/external-entities/:eeId。
 *              使用 Fastify 原生 schema 进行请求校验 + OpenAPI 文档生成。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '../db.js';
import * as eeBehaviorService from '../services/external-entity-behavior.service.js';
import {
  CreateEeActionInput,
  UpdateEeActionInput,
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
const EeIdParam = Type.Object({ eeId: IdSchema });
const ActionIdParam = Type.Object({ eeId: IdSchema, actionId: IdSchema });
const DecisionIdParam = Type.Object({ eeId: IdSchema, decisionId: IdSchema });

export default async function externalEntityBehaviorRoutes(app: FastifyInstance) {
  // ================================================================
  // Action CRUD (F-M1-13)
  // ================================================================

  // GET /external-entities/:eeId/actions — 查询 Action 列表
  app.get('/actions', {
    schema: {
      params: EeIdParam,
      response: { 200: ActionListResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['External Entity Behavior'],
      summary: '查询外部实体的 Action 列表',
      description: 'B-M1-129(原序返回) / B-M1-130(归档可查)',
    },
  }, listActionsHandler);

  // POST /external-entities/:eeId/actions — 创建 Action
  app.post('/actions', {
    schema: {
      params: EeIdParam,
      body: CreateEeActionInput,
      response: {
        201: ActionCreateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['External Entity Behavior'],
      summary: '创建 Action',
      description: 'B-M1-131~139',
    },
  }, createActionHandler);

  // PUT /external-entities/:eeId/actions/:actionId — 更新 Action
  app.put('/actions/:actionId', {
    schema: {
      params: ActionIdParam,
      body: UpdateEeActionInput,
      response: {
        200: ActionUpdateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['External Entity Behavior'],
      summary: '更新 Action',
      description: 'B-M1-140~144',
    },
  }, updateActionHandler);

  // DELETE /external-entities/:eeId/actions/:actionId — 删除 Action
  app.delete('/actions/:actionId', {
    schema: {
      params: ActionIdParam,
      response: {
        200: DeleteResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['External Entity Behavior'],
      summary: '删除 Action',
      description: 'B-M1-145~147',
    },
  }, deleteActionHandler);

  // ================================================================
  // Decision CRUD (F-M1-13)
  // ================================================================

  // GET /external-entities/:eeId/decisions — 查询 Decision 列表
  app.get('/decisions', {
    schema: {
      params: EeIdParam,
      response: { 200: DecisionListResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['External Entity Behavior'],
      summary: '查询外部实体的 Decision 列表',
      description: 'B-M1-129(原序返回) / B-M1-130(归档可查)',
    },
  }, listDecisionsHandler);

  // POST /external-entities/:eeId/decisions — 创建 Decision
  app.post('/decisions', {
    schema: {
      params: EeIdParam,
      body: CreateDecisionInput,
      response: {
        201: DecisionCreateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['External Entity Behavior'],
      summary: '创建 Decision',
      description: 'B-M1-148~158',
    },
  }, createDecisionHandler);

  // PUT /external-entities/:eeId/decisions/:decisionId — 更新 Decision
  app.put('/decisions/:decisionId', {
    schema: {
      params: DecisionIdParam,
      body: UpdateDecisionInput,
      response: {
        200: DecisionUpdateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['External Entity Behavior'],
      summary: '更新 Decision',
      description: 'B-M1-159~163',
    },
  }, updateDecisionHandler);

  // DELETE /external-entities/:eeId/decisions/:decisionId — 删除 Decision
  app.delete('/decisions/:decisionId', {
    schema: {
      params: DecisionIdParam,
      response: {
        200: DeleteResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['External Entity Behavior'],
      summary: '删除 Decision',
      description: 'B-M1-164~166',
    },
  }, deleteDecisionHandler);
}

// ============================================================
// Route Handlers
// ============================================================

async function listActionsHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { eeId } = request.params as { eeId: string };
  const result = await eeBehaviorService.listActions(db, eeId);
  return { data: { items: result.data, version: result.version } };
}

async function createActionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { eeId } = request.params as { eeId: string };
  const body = request.body as Record<string, unknown>;
  const result = await eeBehaviorService.createAction(db, eeId, body);
  reply.status(201);
  return { data: result };
}

async function updateActionHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { eeId, actionId } = request.params as { eeId: string; actionId: string };
  const body = request.body as Record<string, unknown>;
  const result = await eeBehaviorService.updateAction(db, eeId, actionId, body);
  return { data: result };
}

async function deleteActionHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { eeId, actionId } = request.params as { eeId: string; actionId: string };
  await eeBehaviorService.deleteAction(db, eeId, actionId);
  return { success: true };
}

async function listDecisionsHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { eeId } = request.params as { eeId: string };
  const result = await eeBehaviorService.listDecisions(db, eeId);
  return { data: { items: result.data, version: result.version } };
}

async function createDecisionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { eeId } = request.params as { eeId: string };
  const body = request.body as Record<string, unknown>;
  const result = await eeBehaviorService.createDecision(db, eeId, body);
  reply.status(201);
  return { data: result };
}

async function updateDecisionHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { eeId, decisionId } = request.params as { eeId: string; decisionId: string };
  const body = request.body as Record<string, unknown>;
  const result = await eeBehaviorService.updateDecision(db, eeId, decisionId, body);
  return { data: result };
}

async function deleteDecisionHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { eeId, decisionId } = request.params as { eeId: string; decisionId: string };
  await eeBehaviorService.deleteDecision(db, eeId, decisionId);
  return { success: true };
}
