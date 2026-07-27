/**
 * @module routes/teams
 * @description 团队管理路由（F-M6-08~14）：创建/列表/详情/更新/解散/成员管理。
 *              前缀 /api/v1/teams。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  CreateTeamInput,
  UpdateTeamInput,
  InviteMemberInput,
  ChangeMemberRoleInput,
  ErrorResponse,
} from '@apm/validation-schemas';
import { PERMISSIONS } from '@apm/shared';
import * as teamService from '../services/team.service.js';
import type { AuthUser } from '@apm/shared';

export default async function teamRoutes(app: FastifyInstance) {
  // 获取我的团队列表 (GET /api/v1/teams)
  app.get('/', {
    schema: { tags: ['Teams'], summary: '获取我的团队列表' },
    config: { requires: [] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const data = await teamService.listMyTeams(user.id);
    return reply.send({ data });
  });

  // 创建团队 (POST /api/v1/teams)
  app.post('/', {
    schema: {
      body: CreateTeamInput,
      response: { 201: { type: 'object', properties: { data: { type: 'object', additionalProperties: true } } }, 409: ErrorResponse },
      tags: ['Teams'],
      summary: '创建团队',
    },
    config: { requires: [PERMISSIONS.TEAM_CREATE] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const data = await teamService.createTeam(user, request.body as { name: string; displayName: string; description?: string });
    return reply.code(201).send({ data });
  });

  // 团队详情 (GET /api/v1/teams/:id)
  app.get('/:id', {
    schema: { tags: ['Teams'], summary: '获取团队详情' },
    config: { requires: [PERMISSIONS.PROJECT_READ], resourceScope: (req: FastifyRequest) => ({ teamId: (req.params as { id: string }).id }) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const { id } = request.params as { id: string };
    const data = await teamService.getTeamDetail(user.id, id);
    return reply.send({ data });
  });

  // 更新团队 (PUT /api/v1/teams/:id)
  app.put('/:id', {
    schema: {
      body: UpdateTeamInput,
      tags: ['Teams'],
      summary: '更新团队信息',
    },
    config: { requires: [PERMISSIONS.TEAM_MANAGE], resourceScope: (req: FastifyRequest) => ({ teamId: (req.params as { id: string }).id }) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const { id } = request.params as { id: string };
    const data = await teamService.updateTeam(user, id, request.body as { displayName?: string; description?: string });
    return reply.send({ data });
  });

  // 解散团队 (DELETE /api/v1/teams/:id)
  app.delete('/:id', {
    schema: { tags: ['Teams'], summary: '解散团队' },
    config: { requires: [PERMISSIONS.TEAM_MANAGE], resourceScope: (req: FastifyRequest) => ({ teamId: (req.params as { id: string }).id }) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const { id } = request.params as { id: string };
    await teamService.dissolveTeam(user, id);
    return reply.code(204).send();
  });

  // 成员列表 (GET /api/v1/teams/:id/members)
  app.get('/:id/members', {
    schema: { tags: ['Teams'], summary: '获取团队成员列表' },
    config: { requires: [PERMISSIONS.PROJECT_READ], resourceScope: (req: FastifyRequest) => ({ teamId: (req.params as { id: string }).id }) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const { id } = request.params as { id: string };
    const data = await teamService.listMembers(user.id, id);
    return reply.send({ data });
  });

  // 邀请成员 (POST /api/v1/teams/:id/members)
  app.post('/:id/members', {
    schema: {
      body: InviteMemberInput,
      response: { 201: { type: 'object', properties: { data: { type: 'object', additionalProperties: true } } }, 403: ErrorResponse, 409: ErrorResponse },
      tags: ['Teams'],
      summary: '邀请成员加入团队',
    },
    config: { requires: [PERMISSIONS.TEAM_INVITE], resourceScope: (req: FastifyRequest) => ({ teamId: (req.params as { id: string }).id }) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const { id } = request.params as { id: string };
    const data = await teamService.inviteMember(user, id, request.body as { userId: string; teamRole: string });
    return reply.code(201).send({ data });
  });

  // 移除成员 (DELETE /api/v1/teams/:id/members/:userId)
  app.delete('/:id/members/:userId', {
    schema: { tags: ['Teams'], summary: '移除团队成员' },
    config: { requires: [PERMISSIONS.TEAM_REMOVE], resourceScope: (req: FastifyRequest) => ({ teamId: (req.params as { id: string }).id }) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const { id, userId } = request.params as { id: string; userId: string };
    await teamService.removeMember(user, id, userId);
    return reply.code(204).send();
  });

  // 退出团队 (DELETE /api/v1/teams/:id/members/me)
  app.delete('/:id/members/me', {
    schema: { tags: ['Teams'], summary: '退出团队' },
    config: { requires: [], resourceScope: (req: FastifyRequest) => ({ teamId: (req.params as { id: string }).id }) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const { id } = request.params as { id: string };
    await teamService.leaveTeam(user, id);
    return reply.code(204).send();
  });

  // 变更成员角色 (PATCH /api/v1/teams/:id/members/:userId/role)
  app.patch('/:id/members/:userId/role', {
    schema: {
      body: ChangeMemberRoleInput,
      tags: ['Teams'],
      summary: '变更成员角色',
    },
    config: { requires: [PERMISSIONS.TEAM_MANAGE], resourceScope: (req: FastifyRequest) => ({ teamId: (req.params as { id: string }).id }) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as { user: AuthUser }).user;
    const { id, userId } = request.params as { id: string; userId: string };
    const { teamRole } = request.body as { teamRole: string };
    const data = await teamService.changeMemberRole(user, id, userId, teamRole);
    return reply.send({ data });
  });
}
