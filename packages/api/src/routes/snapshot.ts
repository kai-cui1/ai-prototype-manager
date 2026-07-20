/**
 * @module routes/snapshot
 * @description 项目快照路由：为 Design AI 提供项目全局上下文快照。
 *              Fastify 插件形式，前缀 /api/v1/projects/:projectId。
 *              使用 Fastify 原生 schema 进行请求校验 + OpenAPI 文档生成。
 *
 * Design Decisions (D-14 / D-15):
 * - Level 0 返回引用级关键属性，不是纯数字计数
 * - AI 需要三层信息：概念元信息(System Prompt) + 操作依赖规则(System Prompt) + 引用级属性(本API)
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db.js';
import * as snapshotService from '../services/snapshot.service.js';
import {
  SnapshotQuery,
  SnapshotProjectIdParam,
  SnapshotLevel1Response,
  ErrorResponse,
} from '@apm/validation-schemas';

/**
 * GET /api/v1/projects/:projectId/snapshot
 * 获取项目全局上下文快照（Design AI 入口仪式）。
 */
async function getSnapshotHandler(
  request: FastifyRequest<{ Params: { projectId: string }; Querystring: { level?: number; modules?: string } }>,
  reply: FastifyReply,
) {
  const { projectId } = request.params;
  const level = (request.query.level ?? 0) as 0 | 1;
  const modulesStr = request.query.modules;
  const modules = modulesStr
    ? modulesStr.split(',').map(m => m.trim()).filter(Boolean)
    : [];

  const result = await snapshotService.getProjectSnapshot(db, projectId, { level, modules });

  return reply.send({ data: result });
}

/**
 * 注册项目快照路由。
 */
export default async function snapshotRoutes(app: FastifyInstance) {
  app.get('/snapshot', {
    schema: {
      querystring: SnapshotQuery,
      params: SnapshotProjectIdParam,
      response: {
        200: SnapshotLevel1Response,
        400: ErrorResponse,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      tags: ['Snapshot'],
      summary: '获取项目快照',
      description:
        '获取项目全局上下文快照，为 Design AI 提供"入口仪式"。' +
        'Level 0 返回概要+引用级属性（id/name/参数概要），Level 1 返回指定模块的完整详情。' +
        'D-14/D-15 决策：快照必须包含可操作的引用信息，不返回纯数字计数。',
    },
  }, getSnapshotHandler);
}
