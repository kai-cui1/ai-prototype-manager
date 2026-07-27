/**
 * 会话管理 Service
 * F-M7-01: 创建/归档/列表/切换模式/重命名
 * F-M7-05: 模式切换时插入 system 消息
 */
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { chatSessions, chatMessages } from '../db/schema.js';
import type { ChatSession } from '../db/schema.js';

/** 私有化单用户：固定 userId（MVP 无认证） */
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export class SessionService {
  /**
   * 创建会话（默认 mode=copilot, status=active, title=null）
   */
  async create(): Promise<ChatSession> {
    const [session] = await db.insert(chatSessions).values({
      userId: DEFAULT_USER_ID,
    }).returning();
    return session;
  }

  /**
   * 列出 active 会话，按 lastMessageAt 降序
   */
  async list(): Promise<ChatSession[]> {
    return db.query.chatSessions.findMany({
      where: eq(chatSessions.status, 'active'),
      orderBy: [desc(chatSessions.lastMessageAt), desc(chatSessions.createdAt)],
    });
  }

  /**
   * 获取单个会话
   */
  async getById(id: string): Promise<ChatSession | undefined> {
    return db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, id),
    });
  }

  /**
   * 更新会话（title / mode / status）
   * 业务规则：
   * - R03: archived 不可逆
   * - R04: 模式切换即时生效，不影响历史
   * - 模式切换时插入 system 消息（F-M7-05 R02）
   */
  async update(id: string, data: {
    title?: string;
    mode?: 'copilot' | 'executor';
    status?: 'active' | 'archived';
  }): Promise<ChatSession> {
    const session = await this.getById(id);
    if (!session) {
      throw { statusCode: 404, message: `会话 ${id} 不存在` };
    }

    // R03: 归档不可逆
    if (session.status === 'archived' && data.status === 'active') {
      throw { statusCode: 400, message: '已归档会话不可恢复为 active（归档不可逆）' };
    }

    // 已归档会话不可切换模式
    if (session.status === 'archived' && data.mode) {
      throw { statusCode: 400, message: '已归档会话不可切换模式' };
    }

    // 模式切换：插入 system 通知消息（F-M7-05 R02）
    if (data.mode && data.mode !== session.mode) {
      const modeLabel = data.mode === 'executor' ? '执行者' : '副驾';
      await db.insert(chatMessages).values({
        sessionId: id,
        role: 'system',
        content: `已切换为${modeLabel}模式`,
      });
      // 更新 messageCount
      await db.update(chatSessions)
        .set({ messageCount: sql`${chatSessions.messageCount} + 1` })
        .where(eq(chatSessions.id, id));
    }

    // 执行更新
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.mode !== undefined) updateData.mode = data.mode;
    if (data.status !== undefined) updateData.status = data.status;

    const [updated] = await db.update(chatSessions)
      .set(updateData)
      .where(eq(chatSessions.id, id))
      .returning();

    return updated;
  }
}

export const sessionService = new SessionService();
