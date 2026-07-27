/**
 * Compression Service — 上下文压缩
 * F-M7-09：会话 token 累计超过阈值时，压缩较早的历史消息为摘要
 *
 * 策略：
 * 1. 保留最近 K 条消息不动
 * 2. 对更早的消息进行滑动窗口压缩，将若干条合并为一条摘要
 * 3. 压缩后将原消息标记 isCompressed=true，compressedContent=摘要
 */
import { eq, asc, and, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { chatMessages, chatSessions } from '../db/schema.js';
import type { ChatMessage } from '../db/schema.js';
import { generateChat } from './llm.service.js';
import { config } from '../config.js';

/** 估算 token 数（英文按 4 字符/token，中文按 2 字符/token 简化） */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/**
 * 计算会话当前累计 token 数（含已压缩的用压缩版）
 */
export async function calcSessionTokens(sessionId: string): Promise<number> {
  const messages = await db.query.chatMessages.findMany({
    where: eq(chatMessages.sessionId, sessionId),
  });
  return messages.reduce((sum, m) => {
    const content = m.isCompressed && m.compressedContent ? m.compressedContent : m.content;
    return sum + (m.tokenCount || estimateTokens(content));
  }, 0);
}

/**
 * 判断是否需要压缩：累计 token > contextWindow * ratioThreshold
 */
export function shouldCompress(totalTokens: number): boolean {
  return totalTokens > config.compression.contextWindow * config.compression.tokenRatioThreshold;
}

/**
 * 执行压缩：将最近 K 条之前的连续未压缩消息合并为摘要
 * 触发时机：assistant 消息持久化后异步调用
 */
export async function compressSessionIfNeeded(sessionId: string): Promise<void> {
  const total = await calcSessionTokens(sessionId);
  if (!shouldCompress(total)) return;

  const messages = await db.query.chatMessages.findMany({
    where: eq(chatMessages.sessionId, sessionId),
    orderBy: [asc(chatMessages.createdAt)],
  });

  const keepK = config.compression.keepRecentK;
  if (messages.length <= keepK) return;

  // 待压缩：除最后 K 条之外，且尚未被压缩的消息
  const targets = messages.slice(0, messages.length - keepK).filter((m) => !m.isCompressed);
  if (targets.length === 0) return;

  const dialogText = targets
    .map((m) => `${m.role === 'user' ? '用户' : m.role === 'assistant' ? 'AI' : '系统'}: ${m.content}`)
    .join('\n');

  const summaryPrompt = `你是对话摘要助手。将以下多轮对话压缩为一段简洁的中文摘要，保留：
1. 用户明确表达的偏好和决策
2. 已完成的建模操作（创建/修改的实体、角色、流程等）
3. 尚未解决的问题或待办事项
其余寒暄和过程性描述可省略。控制在 300 字以内。`;

  try {
    const summary = await generateChat({
      system: summaryPrompt,
      messages: [{ role: 'user', content: dialogText }],
    });

    // 将首条 target 标记为压缩且保存摘要，其余 target 标记压缩且置空 compressedContent
    const [first, ...rest] = targets;
    await db.update(chatMessages)
      .set({
        isCompressed: true,
        compressedContent: summary.trim(),
        tokenCount: estimateTokens(summary),
      })
      .where(eq(chatMessages.id, first.id));

    for (const m of rest) {
      await db.update(chatMessages)
        .set({ isCompressed: true, compressedContent: '', tokenCount: 0 })
        .where(eq(chatMessages.id, m.id));
    }
  } catch (err) {
    console.warn('[compression] failed:', (err as Error).message);
  }
}

/**
 * 加载会话历史时，过滤掉已被后续压缩项覆盖的空压缩消息
 * 返回可用于 Prompt 的消息序列
 */
export function normalizeHistoryForPrompt(messages: ChatMessage[]): Array<{
  role: 'user' | 'assistant' | 'system';
  content: string;
}> {
  return messages
    .filter((m) => {
      // 已压缩但内容为空 → 过滤（其内容已被之前的摘要包含）
      if (m.isCompressed && !m.compressedContent) return false;
      return true;
    })
    .map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.isCompressed && m.compressedContent ? m.compressedContent : m.content,
    }));
}
