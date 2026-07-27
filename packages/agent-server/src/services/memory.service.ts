/**
 * Memory Service — 长记忆持久化 + 检索 + 提取
 * F-M7-06/07/08/10
 *
 * 设计：抽象接口，MVP 采用直接 pgvector 表 + ILIKE 关键词检索
 * 后续可无缝切换到 Mem0 SDK（同一接口签名）
 */
import { eq, and, ilike, or, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userMemories, chatMessages } from '../db/schema.js';
import type { UserMemory } from '../db/schema.js';
import { config } from '../config.js';
import { generateChat } from './llm.service.js';

/** 私有化单用户：固定 userId */
export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export const VALID_CATEGORIES = [
  'user_preference',
  'naming_convention',
  'design_rule',
  'domain_knowledge',
  'workflow_habit',
  'tool_usage',
] as const;

export type MemoryCategory = (typeof VALID_CATEGORIES)[number];

export interface AddMemoryInput {
  category: MemoryCategory;
  title: string;
  content: string;
  source: 'auto_extract' | 'user_manual';
  sourceSessionId?: string | null;
}

export class MemoryService {
  /** 列出记忆（active 且可选按 category 筛选） */
  async list(category?: MemoryCategory): Promise<UserMemory[]> {
    const conditions = [
      eq(userMemories.userId, DEFAULT_USER_ID),
      eq(userMemories.isActive, true),
    ];
    if (category) conditions.push(eq(userMemories.category, category));

    return db.query.userMemories.findMany({
      where: and(...conditions),
      orderBy: [desc(userMemories.createdAt)],
    });
  }

  async getById(id: string): Promise<UserMemory | undefined> {
    return db.query.userMemories.findFirst({
      where: and(eq(userMemories.id, id), eq(userMemories.userId, DEFAULT_USER_ID)),
    });
  }

  /** 手动或自动新增记忆 */
  async add(input: AddMemoryInput): Promise<UserMemory> {
    const [entry] = await db.insert(userMemories).values({
      userId: DEFAULT_USER_ID,
      category: input.category,
      title: input.title.trim(),
      content: input.content.trim(),
      source: input.source,
      sourceSessionId: input.sourceSessionId ?? null,
    }).returning();
    // TODO: 接入 Mem0/Ollama 后生成 embedding 并写入
    return entry;
  }

  async update(id: string, patch: {
    title?: string;
    content?: string;
    category?: MemoryCategory;
    isActive?: boolean;
  }): Promise<UserMemory> {
    const existing = await this.getById(id);
    if (!existing) throw { statusCode: 404, message: `记忆 ${id} 不存在` };

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.title !== undefined) update.title = patch.title.trim();
    if (patch.content !== undefined) update.content = patch.content.trim();
    if (patch.category !== undefined) update.category = patch.category;
    if (patch.isActive !== undefined) update.isActive = patch.isActive;

    const [updated] = await db.update(userMemories)
      .set(update)
      .where(eq(userMemories.id, id))
      .returning();
    // TODO: content 变更时重生成 embedding
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) throw { statusCode: 404, message: `记忆 ${id} 不存在` };
    await db.delete(userMemories).where(eq(userMemories.id, id));
  }

  /**
   * F-M7-07：检索与当前消息相关的记忆用于注入 Prompt
   * MVP 使用 ILIKE 关键词匹配（分词简单实现）
   * TODO: 接入 pgvector cosine similarity 检索
   */
  async searchRelevant(query: string, topK = config.memory.searchTopK): Promise<UserMemory[]> {
    const keywords = this.extractKeywords(query);
    if (keywords.length === 0) return [];

    const patterns = keywords.map((k) => ilike(userMemories.content, `%${k}%`));

    return db.query.userMemories.findMany({
      where: and(
        eq(userMemories.userId, DEFAULT_USER_ID),
        eq(userMemories.isActive, true),
        or(...patterns),
      ),
      orderBy: [desc(userMemories.updatedAt)],
      limit: topK,
    });
  }

  /** 简单分词：按空格 / 中文标点切分，保留长度 ≥2 的片段 */
  private extractKeywords(text: string): string[] {
    const tokens = text
      .split(/[\s，。、；：！？,.\n\r]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
    // 去重后取前 10 个
    return Array.from(new Set(tokens)).slice(0, 10);
  }

  /**
   * F-M7-06：从最近对话中异步提取记忆
   * 调用 LLM 判断是否包含用户偏好/规则/习惯，若有则写入
   */
  async extractFromSession(sessionId: string): Promise<void> {
    // 取最近 6 条非 system 消息作为提取窗口
    const recent = await db.query.chatMessages.findMany({
      where: eq(chatMessages.sessionId, sessionId),
      orderBy: [desc(chatMessages.createdAt)],
      limit: 6,
    });
    const dialog = recent
      .reverse()
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n');

    if (!dialog) return;

    const extractPrompt = `你是记忆提取助手。分析以下对话，判断用户是否表达了可长期沿用的偏好、规则或习惯。
若有，请以严格的 JSON 数组格式输出，每项包含：
- category: 必须为 [${VALID_CATEGORIES.join(', ')}] 之一
- title: 10 字以内摘要
- content: 一句话完整表述

若无值得记忆的内容，请输出空数组 []。只输出 JSON，不要任何解释。`;

    try {
      const raw = await generateChat({
        system: extractPrompt,
        messages: [{ role: 'user', content: dialog }],
      });
      const jsonText = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const items = JSON.parse(jsonText) as Array<{
        category: string;
        title: string;
        content: string;
      }>;

      for (const item of items) {
        if (!VALID_CATEGORIES.includes(item.category as MemoryCategory)) continue;
        if (!item.title || !item.content) continue;
        await this.add({
          category: item.category as MemoryCategory,
          title: item.title,
          content: item.content,
          source: 'auto_extract',
          sourceSessionId: sessionId,
        });
      }

      // 提取完成后检查是否需要精炼（F-M7-10）
      for (const cat of new Set(items.map((i) => i.category).filter(Boolean))) {
        await this.refineIfExceedsThreshold(cat as MemoryCategory);
      }
    } catch (err) {
      // 提取失败不影响主流程，仅记录
      console.warn('[memory.extract] failed:', (err as Error).message);
    }
  }

  /**
   * F-M7-10：长记忆精炼
   * 同分类记忆超过阈值时，调用 LLM 合并/去重/淘汰过时项
   */
  async refineIfExceedsThreshold(category: MemoryCategory): Promise<void> {
    const items = await this.list(category);
    if (items.length < config.memory.refineThreshold) return;

    const list = items.map((m, i) => `${i + 1}. [${m.id}] ${m.title}: ${m.content}`).join('\n');
    const refinePrompt = `你是记忆整理助手。以下是同分类（${category}）的 ${items.length} 条记忆条目，请合并重复项、剔除过时或冲突项。
输出严格 JSON：
{
  "keep": ["<id>", ...],
  "merge": [ { "ids": ["<id>", "<id>"], "newTitle": "...", "newContent": "..." }, ... ],
  "discard": ["<id>", ...]
}
只输出 JSON。`;

    try {
      const raw = await generateChat({
        system: refinePrompt,
        messages: [{ role: 'user', content: list }],
      });
      const jsonText = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const plan = JSON.parse(jsonText) as {
        keep: string[];
        merge: Array<{ ids: string[]; newTitle: string; newContent: string }>;
        discard: string[];
      };

      // 执行 discard：软删除（isActive=false）
      for (const id of plan.discard || []) {
        await db.update(userMemories)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(userMemories.id, id));
      }

      // 执行 merge：新建合并项 + 软删除源项
      for (const m of plan.merge || []) {
        if (!m.newTitle || !m.newContent) continue;
        await this.add({
          category,
          title: m.newTitle,
          content: m.newContent,
          source: 'auto_extract',
        });
        for (const id of m.ids) {
          await db.update(userMemories)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(userMemories.id, id));
        }
      }
    } catch (err) {
      console.warn('[memory.refine] failed:', (err as Error).message);
    }
  }
}

export const memoryService = new MemoryService();
