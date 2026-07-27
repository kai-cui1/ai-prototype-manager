/**
 * Agent Server Drizzle ORM Schema
 * 定义 M7 内置 Agent 模块的 4 张业务表
 * 注意：user_memories 表由 Mem0 SDK 自动管理，不在此定义
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ─── 枚举类型 ───────────────────────────────────────────────

export const sessionModeEnum = pgEnum('session_mode', ['copilot', 'executor']);
export const sessionStatusEnum = pgEnum('session_status', ['active', 'archived']);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);
export const cardStatusEnum = pgEnum('card_status', ['pending', 'partial', 'applied', 'discarded']);
export const itemExecutionStatusEnum = pgEnum('item_execution_status', ['pending', 'success', 'failed']);
export const memoryCategoryEnum = pgEnum('memory_category', [
  'user_preference',
  'naming_convention',
  'design_rule',
  'domain_knowledge',
  'workflow_habit',
  'tool_usage',
]);
export const memorySourceEnum = pgEnum('memory_source', ['auto_extract', 'user_manual']);

// ─── chat_sessions 表 ───────────────────────────────────────

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  title: varchar('title', { length: 200 }),
  mode: sessionModeEnum('mode').notNull().default('copilot'),
  status: sessionStatusEnum('status').notNull().default('active'),
  messageCount: integer('message_count').notNull().default(0),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── chat_messages 表 ───────────────────────────────────────

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  contextRefs: jsonb('context_refs'),
  tokenCount: integer('token_count').notNull().default(0),
  isCompressed: boolean('is_compressed').notNull().default(false),
  compressedContent: text('compressed_content'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── recommendation_cards 表 ────────────────────────────────

export const recommendationCards = pgTable('recommendation_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().unique().references(() => chatMessages.id),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  status: cardStatusEnum('status').notNull().default('pending'),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── recommendation_items 表 ────────────────────────────────

export const recommendationItems = pgTable('recommendation_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id').notNull().references(() => recommendationCards.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 50 }).notNull(),
  label: varchar('label', { length: 300 }).notNull(),
  preview: text('preview'),
  tool: varchar('tool', { length: 100 }).notNull(),
  args: jsonb('args').notNull(),
  selected: boolean('selected').notNull().default(true),
  dependencies: jsonb('dependencies'),
  executionStatus: itemExecutionStatusEnum('execution_status').notNull().default('pending'),
  executionResult: jsonb('execution_result'),
  executionError: text('execution_error'),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ─── user_memories 表 ────────────────────────────────────────
// F-M7-06/07/08/10：长期记忆存储
// 注意：embedding 字段类型为 pgvector 的 vector(1024)，Drizzle 暂用 text 存储序列化
// 后续接入 Mem0 SDK 时由其接管此表；MVP 阶段采用 ILIKE 关键词检索

export const userMemories = pgTable('user_memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  category: memoryCategoryEnum('category').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  source: memorySourceEnum('source').notNull(),
  sourceSessionId: uuid('source_session_id'),
  embedding: text('embedding'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── 类型导出 ───────────────────────────────────────────────

export type UserMemory = typeof userMemories.$inferSelect;
export type NewUserMemory = typeof userMemories.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type RecommendationCard = typeof recommendationCards.$inferSelect;
export type NewRecommendationCard = typeof recommendationCards.$inferInsert;
export type RecommendationItem = typeof recommendationItems.$inferSelect;
export type NewRecommendationItem = typeof recommendationItems.$inferInsert;
