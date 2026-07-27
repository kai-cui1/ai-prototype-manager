/**
 * @module routes/tokens
 * @description Token 管理路由（F-M6-18~20）：创建/撤销/列表。
 *              前缀 /api/v1/tokens。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateTokenInput, ErrorResponse } from '@apm/validation-schemas';
import { PERMISSIONS } from '@apm/shared';
import * as tokenService from '../services/token.service.js';
import type { AuthUser } from '@apm/shared';

export default async function tokenRoutes(app: FastifyInstance) {
  // Token 列表 (GET /api/v1/tokens)
  app.get('/', {
    schema: { tags: ['Tokens'], summary: '获取我的 Token 列表' },
    config: { requires: [] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const data = await tokenService.listTokens(user.id);
    return reply.send({ data });
  });

  // 创建 Token (POST /api/v1/tokens)
  app.post('/', {
    schema: {
      body: CreateTokenInput,
      response: { 201: { type: 'object', properties: { data: { type: 'object', additionalProperties: true } } }, 400: ErrorResponse },
      tags: ['Tokens'],
      summary: '创建个人访问令牌',
      description: '明文 token 仅此一次返回，请妥善保存。B-M6-12: 最多 10 个活跃 PAT。',
    },
    config: { requires: [PERMISSIONS.TOKEN_MANAGE] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const { name, expiresAt } = request.body as { name: string; expiresAt?: string | null };
    const data = await tokenService.createToken(user, { name, expiresAt });
    return reply.code(201).send({ data });
  });

  // 撤销 Token (DELETE /api/v1/tokens/:id)
  app.delete('/:id', {
    schema: { tags: ['Tokens'], summary: '撤销 Token' },
    config: { requires: [PERMISSIONS.TOKEN_MANAGE] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const { id } = request.params as { id: string };
    await tokenService.revokeToken(user, id);
    return reply.code(204).send();
  });
}
