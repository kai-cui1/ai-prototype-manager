/**
 * Card Parser — 从 LLM 输出中解析推荐卡片 JSON
 * F-M7-04：解析 ```json card 代码块并持久化为 recommendation_cards + recommendation_items
 */
import { db } from '../db/index.js';
import { recommendationCards, recommendationItems } from '../db/schema.js';
import type { RecommendationCard } from '../db/schema.js';

export interface ParsedCardItem {
  kind: string;
  label: string;
  preview?: string;
  tool: string;
  args: Record<string, unknown>;
  dependencies?: string[];
}

export interface ParsedCard {
  title: string;
  description?: string;
  items: ParsedCardItem[];
}

/**
 * 从 assistant 消息中提取 ```json card 代码块并解析
 * 返回 null 表示未检测到卡片（普通问答回复）
 */
export function parseCardFromOutput(text: string): ParsedCard | null {
  const match = text.match(/```json\s+card\s*\n([\s\S]*?)\n```/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]) as ParsedCard;
    // 基础结构校验
    if (!parsed.title || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      return null;
    }
    for (const item of parsed.items) {
      if (!item.tool || !item.kind || !item.label || typeof item.args !== 'object') {
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 将解析出的卡片持久化到 DB
 * @returns 卡片记录（含 id）
 */
export async function persistCard(
  messageId: string,
  parsed: ParsedCard,
): Promise<RecommendationCard> {
  const [card] = await db.insert(recommendationCards).values({
    messageId,
    title: parsed.title.slice(0, 200),
    description: parsed.description ?? null,
  }).returning();

  // 批量插入 items，保留原顺序
  const itemsToInsert = parsed.items.map((item, idx) => ({
    cardId: card.id,
    kind: item.kind.slice(0, 50),
    label: item.label.slice(0, 300),
    preview: item.preview ?? null,
    tool: item.tool.slice(0, 100),
    args: item.args as unknown,
    dependencies: (item.dependencies ?? []) as unknown,
    sortOrder: idx,
  }));

  if (itemsToInsert.length > 0) {
    await db.insert(recommendationItems).values(itemsToInsert);
  }

  return card;
}
