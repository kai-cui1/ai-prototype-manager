/**
 * @module routes/shares
 * @description 项目共享路由（F-M6-15~17）：共享列表/创建/变更角色/撤销。
 *              挂载在 /api/v1/projects/:id/shares 前缀下。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateShareInput, UpdateShareInput, ErrorResponse } from '@apm/validation-schemas';
import { PERMISSIONS } from '@apm/shared';
import * as shareService from '../services/share.service.js';
import type { AuthUser } from '@apm/shared';

export default async function shareRoutes(app: FastifyInstance) {
  // 共享列表 (GET /api/v1/projects/:id/shares)
  app.get('/', {
    schema: { tags: ['Shares'], summary: '获取项目共享列表' },
    config: {
      requires: [PERMISSIONS.PROJECT_SHARE],
      resourceScope: (req: FastifyRequest) => ({ projectId: (req.params as { id: string }).id }),
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = await shareService.listShares(id);
    return reply.send({ data });
  });

  // 创建共享 (POST /api/v1/projects/:id/shares)
  app.post('/', {
    schema: {
      body: CreateShareInput,
      response: { 201: { type: 'object', properties: { data: { type: 'object', additionalProperties: true } } }, 400: ErrorResponse, 409: ErrorResponse },
      tags: ['Shares'],
      summary: '共享项目给团队或用户',
    },
    config: {
      requires: [PERMISSIONS.PROJECT_SHARE],
      resourceScope: (req: FastifyRequest) => ({ projectId: (req.params as { id: string }).id }),
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const { id } = request.params as { id: string };
    const body = request.body as { granteeType: string; granteeId: string; projectRole: string };
    const data = await shareService.createShare(user, id, body);
    return reply.code(201).send({ data });
  });

  // 变更共享角色 (PATCH /api/v1/projects/:id/shares/:shareId)
  app.patch('/:shareId', {
    schema: {
      body: UpdateShareInput,
      tags: ['Shares'],
      summary: '变更共享角色',
    },
    config: {
      requires: [PERMISSIONS.PROJECT_SHARE],
      resourceScope: (req: FastifyRequest) => ({ projectId: (req.params as { id: string }).id }),
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const { id, shareId } = request.params as { id: string; shareId: string };
    const { projectRole } = request.body as { projectRole: string };
    const data = await shareService.updateShareRole(user, id, shareId, projectRole);
    return reply.send({ data });
  });

  // 撤销共享 (DELETE /api/v1/projects/:id/shares/:shareId)
  app.delete('/:shareId', {
    schema: { tags: ['Shares'], summary: '撤销项目共享' },
    config: {
      requires: [PERMISSIONS.PROJECT_SHARE],
      resourceScope: (req: FastifyRequest) => ({ projectId: (req.params as { id: string }).id }),
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const { id, shareId } = request.params as { id: string; shareId: string };
    await shareService.revokeShare(user, id, shareId);
    return reply.code(204).send();
  });
}
