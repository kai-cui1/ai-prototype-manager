/**
 * 记忆管理路由
 * F-M7-08: GET/POST/PUT/DELETE /memory
 * 底层通过 memoryService 直接读写 user_memories 表
 */
import type { FastifyInstance } from 'fastify';
import { memoryService, VALID_CATEGORIES, type MemoryCategory } from '../services/memory.service.js';

export async function memoryRoutes(app: FastifyInstance) {
  /** GET /memory — 列出记忆（可按 category 筛选） */
  app.get<{ Querystring: { category?: string } }>('/memory', async (req, reply) => {
    const { category } = req.query;
    if (category && !VALID_CATEGORIES.includes(category as MemoryCategory)) {
      return reply.status(400).send({
        error: { message: `category 必须为以下之一: ${VALID_CATEGORIES.join(', ')}` },
      });
    }
    const memories = await memoryService.list(category as MemoryCategory | undefined);
    return reply.send({ data: memories });
  });

  /** POST /memory — 手动新增记忆 */
  app.post<{ Body: { category: string; title: string; content: string } }>(
    '/memory',
    async (req, reply) => {
      const { category, title, content } = req.body || {};
      if (!title || title.trim() === '') {
        return reply.status(400).send({ error: { message: 'title 为必填字段' } });
      }
      if (!content || content.trim() === '') {
        return reply.status(400).send({ error: { message: 'content 为必填字段' } });
      }
      if (!category || !VALID_CATEGORIES.includes(category as MemoryCategory)) {
        return reply.status(400).send({
          error: { message: `category 必须为以下之一: ${VALID_CATEGORIES.join(', ')}` },
        });
      }
      const entry = await memoryService.add({
        category: category as MemoryCategory,
        title,
        content,
        source: 'user_manual',
      });
      return reply.status(201).send({ data: entry });
    },
  );

  /** PUT /memory/:id — 编辑记忆 */
  app.put<{ Params: { id: string }; Body: { title?: string; content?: string; category?: string; isActive?: boolean } }>(
    '/memory/:id',
    async (req, reply) => {
      const { id } = req.params;
      const body = req.body || {};
      if (body.category && !VALID_CATEGORIES.includes(body.category as MemoryCategory)) {
        return reply.status(400).send({
          error: { message: `category 必须为以下之一: ${VALID_CATEGORIES.join(', ')}` },
        });
      }
      try {
        const updated = await memoryService.update(id, {
          title: body.title,
          content: body.content,
          category: body.category as MemoryCategory | undefined,
          isActive: body.isActive,
        });
        return reply.send({ data: updated });
      } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return reply.status(statusCode).send({ error: { message: err.message } });
      }
    },
  );

  /** DELETE /memory/:id — 物理删除记忆 */
  app.delete<{ Params: { id: string } }>('/memory/:id', async (req, reply) => {
    const { id } = req.params;
    try {
      await memoryService.delete(id);
      return reply.status(204).send();
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      return reply.status(statusCode).send({ error: { message: err.message } });
    }
  });
}
