/**
 * 推荐卡片路由
 * F-M7-04: POST /cards/:id/apply, POST /cards/:id/discard
 */
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { recommendationCards, recommendationItems } from '../db/schema.js';
import { callMcpTool } from '../services/mcp-client.js';

export async function cardRoutes(app: FastifyInstance) {
  /**
   * POST /cards/:id/apply — 采纳选中子项（SSE 流式返回执行进度）
   * 请求体: { selectedItemIds: string[] }
   */
  app.post<{ Params: { id: string }; Body: { selectedItemIds: string[] } }>(
    '/cards/:id/apply',
    async (req, reply) => {
      const { id: cardId } = req.params;
      const { selectedItemIds } = req.body || {};

      // ─── 校验卡片存在 ─────────────────────────────────────
      const card = await db.query.recommendationCards.findFirst({
        where: eq(recommendationCards.id, cardId),
      });
      if (!card) {
        return reply.status(404).send({ error: { message: `卡片 ${cardId} 不存在` } });
      }

      // ─── 校验卡片状态为 pending（R06: 终态不可逆） ────────
      if (card.status !== 'pending') {
        return reply.status(400).send({
          error: { message: `卡片已处于终态 ${card.status}，不可重新采纳` },
        });
      }

      // ─── 校验 selectedItemIds 非空 ────────────────────────
      if (!selectedItemIds || selectedItemIds.length === 0) {
        return reply.status(400).send({
          error: { message: 'selectedItemIds 不能为空' },
        });
      }

      // ─── 加载选中 items ───────────────────────────────────
      const allItems = await db.query.recommendationItems.findMany({
        where: eq(recommendationItems.cardId, cardId),
      });
      const selectedItems = allItems.filter((item) => selectedItemIds.includes(item.id));

      // ─── SSE 流式执行 ─────────────────────────────────────
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const sendEvent = (event: string, data: any) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // 构建 DAG 拓扑层级
      const layers = buildTopologicalLayers(selectedItems);

      let appliedCount = 0;
      let failedCount = 0;

      // 按层级执行
      for (const layer of layers) {
        const results = await Promise.allSettled(
          layer.map(async (item) => {
            // 检查依赖是否全部成功
            const deps = (item.dependencies as string[]) || [];
            const depsFailed = deps.some((depId) => {
              const depItem = allItems.find((i) => i.id === depId);
              return depItem?.executionStatus === 'failed';
            });

            if (depsFailed) {
              await db.update(recommendationItems).set({
                executionStatus: 'failed',
                executionError: '上游依赖执行失败，跳过',
              }).where(eq(recommendationItems.id, item.id));
              throw { itemId: item.id, message: '上游依赖执行失败，跳过' };
            }

            try {
              // 通过 MCP 协议调用工具
              const result = await callMcpTool(item.tool, item.args as Record<string, unknown>);
              await db.update(recommendationItems).set({
                executionStatus: 'success',
                executionResult: result as unknown,
              }).where(eq(recommendationItems.id, item.id));
              return { itemId: item.id, status: 'success' as const, result };
            } catch (err: any) {
              const msg = err?.message || 'MCP 工具调用失败';
              await db.update(recommendationItems).set({
                executionStatus: 'failed',
                executionError: msg,
              }).where(eq(recommendationItems.id, item.id));
              throw { itemId: item.id, message: msg };
            }
          })
        );

        // 发送进度事件
        for (const r of results) {
          if (r.status === 'fulfilled') {
            appliedCount++;
            sendEvent('item_progress', { itemId: r.value.itemId, status: 'success', result: r.value.result });
          } else {
            failedCount++;
            const reason = r.reason || {};
            sendEvent('item_progress', {
              itemId: reason.itemId || 'unknown',
              status: 'failed',
              error: reason.message || 'unknown error',
            });
          }
        }
      }

      // ─── 更新卡片终态（R06: 终态不可逆） ─────────────────
      const finalStatus: 'applied' | 'partial' = failedCount === 0 ? 'applied' : 'partial';
      await db.update(recommendationCards).set({
        status: finalStatus,
        appliedAt: new Date(),
      }).where(eq(recommendationCards.id, cardId));

      sendEvent('card_complete', {
        cardId,
        status: finalStatus,
        applied: appliedCount,
        failed: failedCount,
      });

      reply.raw.end();
    },
  );

  /**
   * POST /cards/:id/discard — 丢弃卡片
   */
  app.post<{ Params: { id: string } }>('/cards/:id/discard', async (req, reply) => {
    const { id: cardId } = req.params;

    const card = await db.query.recommendationCards.findFirst({
      where: eq(recommendationCards.id, cardId),
    });
    if (!card) {
      return reply.status(404).send({ error: { message: `卡片 ${cardId} 不存在` } });
    }
    if (card.status !== 'pending') {
      return reply.status(400).send({
        error: { message: `卡片已处于终态 ${card.status}，不可丢弃` },
      });
    }

    const [updated] = await db.update(recommendationCards)
      .set({ status: 'discarded' })
      .where(eq(recommendationCards.id, cardId))
      .returning();

    return reply.send({ data: updated });
  });
}

/**
 * 构建拓扑层级（DAG 分层）
 * 同层无依赖项可并行执行
 */
function buildTopologicalLayers<T extends { id: string; dependencies: any }>(items: T[]): T[][] {
  const layers: T[][] = [];
  const executed = new Set<string>();
  let remaining = [...items];

  while (remaining.length > 0) {
    // 找出当前层：依赖已全部执行的 item
    const currentLayer = remaining.filter((item) => {
      const deps = (item.dependencies as string[]) || [];
      return deps.every((dep) => executed.has(dep));
    });

    // 防止死循环（循环依赖）
    if (currentLayer.length === 0) {
      layers.push(remaining);
      break;
    }

    layers.push(currentLayer);
    currentLayer.forEach((item) => executed.add(item.id));
    remaining = remaining.filter((item) => !executed.has(item.id));
  }

  return layers;
}
