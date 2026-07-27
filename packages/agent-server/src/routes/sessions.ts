/**
 * 会话管理路由
 * F-M7-01: POST /sessions, GET /sessions, PATCH /sessions/:id
 */
import type { FastifyInstance } from 'fastify';
import { sessionService } from '../services/session.service.js';

export async function sessionRoutes(app: FastifyInstance) {
  /**
   * POST /sessions — 创建会话
   */
  app.post('/sessions', async (_req, reply) => {
    const session = await sessionService.create();
    return reply.status(201).send({ data: session });
  });

  /**
   * GET /sessions — 列出 active 会话
   */
  app.get('/sessions', async (_req, reply) => {
    const sessions = await sessionService.list();
    return reply.send({ data: sessions });
  });

  /**
   * PATCH /sessions/:id — 更新会话（title / mode / status）
   */
  app.patch<{ Params: { id: string }; Body: { title?: string; mode?: string; status?: string } }>(
    '/sessions/:id',
    async (req, reply) => {
      const { id } = req.params;
      const body = req.body || {};

      // 校验 mode 枚举
      if (body.mode && !['copilot', 'executor'].includes(body.mode)) {
        return reply.status(400).send({
          error: { message: `mode 必须为 copilot 或 executor，收到: ${body.mode}` },
        });
      }

      // 校验 status 枚举
      if (body.status && !['active', 'archived'].includes(body.status)) {
        return reply.status(400).send({
          error: { message: `status 必须为 active 或 archived，收到: ${body.status}` },
        });
      }

      try {
        const updated = await sessionService.update(id, {
          title: body.title,
          mode: body.mode as 'copilot' | 'executor' | undefined,
          status: body.status as 'active' | 'archived' | undefined,
        });
        return reply.send({ data: updated });
      } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return reply.status(statusCode).send({ error: { message: err.message } });
      }
    },
  );
}
