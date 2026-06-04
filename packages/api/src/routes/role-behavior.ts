/**
 * @module routes/role-behavior
 * @description 角色行为管理路由：Action CRUD + Decision CRUD (F-M1-12)。
 *              Fastify 插件形式注册，前缀 /api/v1/projects/:projectId/roles/:roleId。
 *              使用 Fastify 原生 schema 进行请求校验 + OpenAPI 文档生成。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '../db.js';
import * as behaviorService from '../services/role-behavior.service.js';
import {
  CreateRoleActionInput,
  UpdateRoleActionInput,
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
const RoleIdParam = Type.Object({ roleId: IdSchema });
const ActionIdParam = Type.Object({ roleId: IdSchema, actionId: IdSchema });
const DecisionIdParam = Type.Object({ roleId: IdSchema, decisionId: IdSchema });

export default async function roleBehaviorRoutes(app: FastifyInstance) {
  // ================================================================
  // Action CRUD (F-M1-12)
  // ================================================================

  // GET /roles/:roleId/actions — 查询 Action 列表
  app.get('/actions', {
    schema: {
      params: RoleIdParam,
      response: { 200: ActionListResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Role Behavior'],
      summary: '查询角色的 Action 列表',
      description: 'B-M1-91(原序返回) / B-M1-92(归档可查)',
    },
  }, listActionsHandler);

  // POST /roles/:roleId/actions — 创建 Action
  app.post('/actions', {
    schema: {
      params: RoleIdParam,
      body: CreateRoleActionInput,
      response: {
        201: ActionCreateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Role Behavior'],
      summary: '创建 Action',
      description: 'B-M1-93~101',
    },
  }, createActionHandler);

  // PUT /roles/:roleId/actions/:actionId — 更新 Action
  app.put('/actions/:actionId', {
    schema: {
      params: ActionIdParam,
      body: UpdateRoleActionInput,
      response: {
        200: ActionUpdateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Role Behavior'],
      summary: '更新 Action',
      description: 'B-M1-102~106',
    },
  }, updateActionHandler);

  // DELETE /roles/:roleId/actions/:actionId — 删除 Action
  app.delete('/actions/:actionId', {
    schema: {
      params: ActionIdParam,
      response: {
        200: DeleteResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Role Behavior'],
      summary: '删除 Action',
      description: 'B-M1-107~109',
    },
  }, deleteActionHandler);

  // ================================================================
  // Decision CRUD (F-M1-12)
  // ================================================================

  // GET /roles/:roleId/decisions — 查询 Decision 列表
  app.get('/decisions', {
    schema: {
      params: RoleIdParam,
      response: { 200: DecisionListResponse, 404: ErrorResponse, 500: ErrorResponse },
      tags: ['Role Behavior'],
      summary: '查询角色的 Decision 列表',
      description: 'B-M1-91(原序返回) / B-M1-92(归档可查)',
    },
  }, listDecisionsHandler);

  // POST /roles/:roleId/decisions — 创建 Decision
  app.post('/decisions', {
    schema: {
      params: RoleIdParam,
      body: CreateDecisionInput,
      response: {
        201: DecisionCreateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Role Behavior'],
      summary: '创建 Decision',
      description: 'B-M1-110~120',
    },
  }, createDecisionHandler);

  // PUT /roles/:roleId/decisions/:decisionId — 更新 Decision
  app.put('/decisions/:decisionId', {
    schema: {
      params: DecisionIdParam,
      body: UpdateDecisionInput,
      response: {
        200: DecisionUpdateResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Role Behavior'],
      summary: '更新 Decision',
      description: 'B-M1-121~125',
    },
  }, updateDecisionHandler);

  // DELETE /roles/:roleId/decisions/:decisionId — 删除 Decision
  app.delete('/decisions/:decisionId', {
    schema: {
      params: DecisionIdParam,
      response: {
        200: DeleteResponse,
        400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse, 500: ErrorResponse,
      },
      tags: ['Role Behavior'],
      summary: '删除 Decision',
      description: 'B-M1-126~128',
    },
  }, deleteDecisionHandler);
}

// ============================================================
// Route Handlers
// ============================================================

async function listActionsHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { roleId } = request.params as { roleId: string };
  const result = await behaviorService.listActions(db, roleId);
  return { data: { items: result.data, version: result.version } };
}

async function createActionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { roleId } = request.params as { roleId: string };
  const body = request.body as Record<string, unknown>;
  const result = await behaviorService.createAction(db, roleId, body);
  reply.status(201);
  return { data: result };
}

async function updateActionHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { roleId, actionId } = request.params as { roleId: string; actionId: string };
  const body = request.body as Record<string, unknown>;
  const result = await behaviorService.updateAction(db, roleId, actionId, body);
  return { data: result };
}

async function deleteActionHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { roleId, actionId } = request.params as { roleId: string; actionId: string };
  await behaviorService.deleteAction(db, roleId, actionId);
  return { success: true };
}

async function listDecisionsHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { roleId } = request.params as { roleId: string };
  const result = await behaviorService.listDecisions(db, roleId);
  return { data: { items: result.data, version: result.version } };
}

async function createDecisionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { roleId } = request.params as { roleId: string };
  const body = request.body as Record<string, unknown>;
  const result = await behaviorService.createDecision(db, roleId, body);
  reply.status(201);
  return { data: result };
}

async function updateDecisionHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { roleId, decisionId } = request.params as { roleId: string; decisionId: string };
  const body = request.body as Record<string, unknown>;
  const result = await behaviorService.updateDecision(db, roleId, decisionId, body);
  return { data: result };
}

async function deleteDecisionHandler(request: FastifyRequest, _reply: FastifyReply) {
  const { roleId, decisionId } = request.params as { roleId: string; decisionId: string };
  await behaviorService.deleteDecision(db, roleId, decisionId);
  return { success: true };
}
