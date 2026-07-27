/**
 * @module types/agent
 * @description M7 内置 Agent 前端类型定义（与 agent-server schema 对齐）
 */

export type SessionMode = 'copilot' | 'executor';
export type SessionStatus = 'active' | 'archived';
export type MessageRole = 'user' | 'assistant' | 'system';
export type CardStatus = 'pending' | 'partial' | 'applied' | 'discarded';
export type ItemExecutionStatus = 'pending' | 'success' | 'failed';
export type MemoryCategory =
  | 'user_preference'
  | 'naming_convention'
  | 'design_rule'
  | 'domain_knowledge'
  | 'workflow_habit'
  | 'tool_usage';
export type MemorySource = 'auto_extract' | 'user_manual';

export interface AgentSession {
  id: string;
  userId: string;
  title: string | null;
  mode: SessionMode;
  status: SessionStatus;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  contextRefs: unknown;
  tokenCount: number;
  isCompressed: boolean;
  compressedContent: string | null;
  createdAt: string;
}

export interface RecommendationItem {
  id: string;
  cardId: string;
  kind: string;
  label: string;
  preview: string | null;
  tool: string;
  args: Record<string, unknown>;
  selected: boolean;
  dependencies: string[] | null;
  executionStatus: ItemExecutionStatus;
  executionResult: unknown;
  executionError: string | null;
  sortOrder: number;
}

export interface RecommendationCard {
  id: string;
  messageId: string;
  title: string;
  description: string | null;
  status: CardStatus;
  appliedAt: string | null;
  createdAt: string;
  items?: RecommendationItem[];
}

export interface UserMemory {
  id: string;
  userId: string;
  category: MemoryCategory;
  title: string;
  content: string;
  source: MemorySource;
  sourceSessionId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** SSE 事件负载 */
export type SseEvent =
  | { event: 'message_start'; data: { messageId: string; role: 'assistant' } }
  | { event: 'content_delta'; data: { delta: string } }
  | { event: 'card_ready'; data: { cardId: string; title: string; itemCount: number } }
  | { event: 'message_end'; data: { messageId: string; tokenCount: number; card: unknown } }
  | { event: 'error'; data: { message: string } }
  | { event: 'item_progress'; data: { itemId: string; status: 'success' | 'failed'; result?: unknown; error?: string } }
  | { event: 'card_complete'; data: { cardId: string; status: CardStatus; applied: number; failed: number } };

/** 分类中文标签映射 */
export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  user_preference: '偏好',
  naming_convention: '命名约定',
  design_rule: '设计规则',
  domain_knowledge: '领域知识',
  workflow_habit: '工作习惯',
  tool_usage: '工具使用',
};

export const MEMORY_SOURCE_LABELS: Record<MemorySource, string> = {
  auto_extract: '自动提取',
  user_manual: '手动创建',
};
