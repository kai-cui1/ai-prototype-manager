/**
 * Chat 路由 — SSE 流式对话
 * F-M7-02: POST /chat（SSE）, GET /sessions/:id/messages
 */
import type { FastifyInstance } from 'fastify';
import { eq, asc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { chatSessions, chatMessages } from '../db/schema.js';
import { streamChat } from '../services/llm.service.js';
import { buildSystemPrompt } from '../services/prompt.builder.js';
import { memoryService } from '../services/memory.service.js';
import { parseCardFromOutput, persistCard } from '../services/card.parser.js';
import { compressSessionIfNeeded, normalizeHistoryForPrompt } from '../services/compression.service.js';
import type { CoreMessage } from 'ai';

export async function chatRoutes(app: FastifyInstance) {
  /**
   * POST /chat — 发送消息 + SSE 流式回复
   * 请求体: { sessionId, content, contextRefs? }
   * 响应: text/event-stream
   */
  app.post<{ Body: { sessionId: string; content: string; contextRefs?: any[] } }>(
    '/chat',
    async (req, reply) => {
      const { sessionId, content, contextRefs } = req.body || {};

      // ─── 参数校验 ─────────────────────────────────────────
      if (!sessionId) {
        return reply.status(400).send({ error: { message: 'sessionId 为必填字段' } });
      }
      if (!content || content.trim() === '') {
        return reply.status(400).send({ error: { message: 'content 不能为空' } });
      }

      // ─── 校验会话存在且 active（V01） ─────────────────────
      const session = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, sessionId),
      });
      if (!session) {
        return reply.status(404).send({ error: { message: `会话 ${sessionId} 不存在` } });
      }
      if (session.status === 'archived') {
        return reply.status(400).send({ error: { message: '已归档会话不可发送消息' } });
      }

      // ─── 持久化 user 消息（R01: 立即持久化） ──────────────
      const [userMsg] = await db.insert(chatMessages).values({
        sessionId,
        role: 'user',
        content: content.trim(),
        contextRefs: contextRefs || null,
      }).returning();

      // 更新会话计数 + lastMessageAt
      await db.update(chatSessions).set({
        messageCount: sql`${chatSessions.messageCount} + 1`,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(chatSessions.id, sessionId));

      // ─── 首条消息触发标题生成（R04） ──────────────────────
      const isFirstMessage = session.messageCount === 0;

      // ─── 加载历史消息构建上下文 ────────────────────────────
      const history = await db.query.chatMessages.findMany({
        where: eq(chatMessages.sessionId, sessionId),
        orderBy: [asc(chatMessages.createdAt)],
      });

      // 转换为 AI SDK CoreMessage 格式（含压缩历史规整）
      const normalized = normalizeHistoryForPrompt(history);
      const coreMessages: CoreMessage[] = normalized as CoreMessage[];

      // ─── F-M7-07: 检索相关记忆注入 Prompt ────────────────
      let memories: Array<{ content: string; category: string }> = [];
      try {
        const found = await memoryService.searchRelevant(content);
        memories = found.map((m) => ({ content: m.content, category: m.category }));
      } catch (memErr) {
        // 检索失败不影响主对话流程
        app.log.warn(`[chat] 记忆检索失败: ${(memErr as Error).message}`);
      }

      // ─── 组装 System Prompt ───────────────────────────────
      const systemPrompt = buildSystemPrompt({
        mode: session.mode,
        memories,
        contextRefs: contextRefs || [],
      });

      // ─── SSE 流式响应 ─────────────────────────────────────
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const sendEvent = (event: string, data: any) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        // 发送 message_start
        const assistantMsgId = crypto.randomUUID();
        sendEvent('message_start', { messageId: assistantMsgId, role: 'assistant' });

        // 调用 LLM 流式
        const result = streamChat({
          system: systemPrompt,
          messages: coreMessages,
        });

        let fullContent = '';
        let streamError: Error | null = null;

        for await (const chunk of result.fullStream) {
          if (chunk.type === 'text-delta') {
            fullContent += chunk.textDelta;
            sendEvent('content_delta', { delta: chunk.textDelta });
          } else if (chunk.type === 'error') {
            // AI SDK 的 fullStream 不抛异常，错误以 error chunk 形式出现，必须显式捕获，
            // 否则会静默落库一条空 assistant 消息（前端表现为无任何反馈）
            const raw = (chunk as { error?: unknown }).error;
            streamError = raw instanceof Error ? raw : new Error(String(raw ?? 'LLM 流式调用失败'));
            break;
          }
        }

        if (streamError) {
          throw streamError;
        }

        // ─── 持久化 assistant 消息 ──────────────────────────
        const tokenCount = Math.ceil(fullContent.length / 4); // 粗略估算
        await db.insert(chatMessages).values({
          id: assistantMsgId,
          sessionId,
          role: 'assistant',
          content: fullContent,
          tokenCount,
        });

        // 更新会话计数
        await db.update(chatSessions).set({
          messageCount: sql`${chatSessions.messageCount} + 1`,
          lastMessageAt: new Date(),
        }).where(eq(chatSessions.id, sessionId));

        // ─── F-M7-04: 解析并持久化推荐卡片 ─────────────────
        let cardPayload: unknown = null;
        const parsedCard = parseCardFromOutput(fullContent);
        if (parsedCard) {
          try {
            const card = await persistCard(assistantMsgId, parsedCard);
            cardPayload = { cardId: card.id, title: card.title, itemCount: parsedCard.items.length };
            sendEvent('card_ready', cardPayload);
          } catch (cardErr) {
            app.log.warn(`[chat] 卡片持久化失败: ${(cardErr as Error).message}`);
          }
        }

        // ─── 首条消息：异步生成标题（R04） ───────────────
        if (isFirstMessage && !session.title) {
          generateTitle(sessionId, content).catch(() => {
            // 标题生成失败不影响主流程
          });
        }

        // ─── F-M7-06: 异步记忆提取（不阻塞响应） ──────────
        memoryService.extractFromSession(sessionId).catch((e) => {
          app.log.warn(`[chat] 记忆提取失败: ${(e as Error).message}`);
        });

        // ─── F-M7-09: 异步上下文压缩（不阻塞响应） ────────
        compressSessionIfNeeded(sessionId).catch((e) => {
          app.log.warn(`[chat] 上下文压缩失败: ${(e as Error).message}`);
        });

        sendEvent('message_end', { messageId: assistantMsgId, tokenCount, card: cardPayload });
      } catch (err: any) {
        // G04: LLM 调用失败返回友好错误，不暴露原始信息
        app.log.error(`[chat] LLM 调用失败: ${err.message}`);
        sendEvent('error', { message: 'AI 服务暂时不可用，请稍后重试' });

        // user 消息已持久化，不因 LLM 失败而丢失
      } finally {
        reply.raw.end();
      }
    },
  );

  /**
   * GET /sessions/:id/messages — 加载历史消息（分页升序）
   */
  app.get<{ Params: { id: string }; Querystring: { page?: string; pageSize?: string } }>(
    '/sessions/:id/messages',
    async (req, reply) => {
      const { id } = req.params;
      const page = parseInt(req.query.page || '1', 10);
      const pageSize = parseInt(req.query.pageSize || '50', 10);
      const offset = (page - 1) * pageSize;

      // 校验会话存在
      const session = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, id),
      });
      if (!session) {
        return reply.status(404).send({ error: { message: `会话 ${id} 不存在` } });
      }

      const messages = await db.query.chatMessages.findMany({
        where: eq(chatMessages.sessionId, id),
        orderBy: [asc(chatMessages.createdAt)],
        limit: pageSize,
        offset,
      });

      return reply.send({ data: messages });
    },
  );
}

/**
 * 异步生成会话标题（首条消息后触发）
 */
async function generateTitle(sessionId: string, firstMessage: string): Promise<void> {
  const { generateChat } = await import('../services/llm.service.js');

  const title = await generateChat({
    system: '根据用户的第一条消息，生成一个简短的会话标题（10字以内），直接输出标题文本，不要加引号或前缀。',
    messages: [{ role: 'user', content: firstMessage }],
  });

  await db.update(chatSessions)
    .set({ title: title.trim().slice(0, 200), updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}
