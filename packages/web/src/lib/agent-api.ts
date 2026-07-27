/**
 * @module lib/agent-api
 * @description Agent Server (M7) API 客户端 + SSE 消费封装
 *
 * - REST：会话/消息/卡片/记忆 CRUD
 * - SSE：POST /api/agent/chat 和 /cards/:id/apply 的事件流，走 fetch + ReadableStream 手写解析
 */
import axios from 'axios';
import type {
  AgentSession,
  AgentMessage,
  RecommendationCard,
  RecommendationItem,
  UserMemory,
  SessionMode,
  SessionStatus,
  MemoryCategory,
  SseEvent,
} from '@/types/agent';

const BASE = '/api/agent';

// 复用 axios 实例（Agent Server 不做 JWT 校验，但预留 header 一致性）
const client = axios.create({
  baseURL: BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── 会话 ─────────────────────────────────────────────────
export async function createSession(): Promise<AgentSession> {
  const { data } = await client.post<{ data: AgentSession }>('/sessions');
  return data.data;
}

export async function listSessions(): Promise<AgentSession[]> {
  const { data } = await client.get<{ data: AgentSession[] }>('/sessions');
  return data.data;
}

export async function updateSession(
  id: string,
  patch: { title?: string; mode?: SessionMode; status?: SessionStatus },
): Promise<AgentSession> {
  const { data } = await client.patch<{ data: AgentSession }>(`/sessions/${id}`, patch);
  return data.data;
}

export async function listMessages(sessionId: string): Promise<AgentMessage[]> {
  const { data } = await client.get<{ data: AgentMessage[] }>(`/sessions/${sessionId}/messages`);
  return data.data;
}

// ─── 推荐卡片 ─────────────────────────────────────────────
export async function getCardWithItems(cardId: string): Promise<{ card: RecommendationCard; items: RecommendationItem[] } | null> {
  // agent-server 目前无 GET /cards/:id 端点；MVP 用消息内 card_ready 事件返回的元数据即可
  // 若后续新增，此函数可扩展；当前保留占位以便消费方统一
  void cardId;
  return null;
}

export async function discardCard(cardId: string): Promise<RecommendationCard> {
  const { data } = await client.post<{ data: RecommendationCard }>(`/cards/${cardId}/discard`);
  return data.data;
}

// ─── 记忆 ─────────────────────────────────────────────────
export async function listMemories(category?: MemoryCategory): Promise<UserMemory[]> {
  const { data } = await client.get<{ data: UserMemory[] }>('/memory', {
    params: category ? { category } : undefined,
  });
  return data.data;
}

export async function createMemory(input: {
  category: MemoryCategory;
  title: string;
  content: string;
}): Promise<UserMemory> {
  const { data } = await client.post<{ data: UserMemory }>('/memory', input);
  return data.data;
}

export async function updateMemory(
  id: string,
  patch: { title?: string; content?: string; category?: MemoryCategory; isActive?: boolean },
): Promise<UserMemory> {
  const { data } = await client.put<{ data: UserMemory }>(`/memory/${id}`, patch);
  return data.data;
}

export async function deleteMemory(id: string): Promise<void> {
  await client.delete(`/memory/${id}`);
}

// ─── SSE 消费 ─────────────────────────────────────────────

/**
 * 通用 SSE POST fetch 消费。逐块解析 `event: xxx\ndata: {...}\n\n` 帧。
 * @param path 相对路径（不含 baseURL）
 * @param body POST 请求体
 * @param onEvent 事件回调（含事件名和已解析的 data 对象）
 * @param signal AbortSignal 支持取消
 */
export async function streamSseRequest(
  path: string,
  body: unknown,
  onEvent: (evt: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    // 4xx/5xx：一次性 JSON error 响应
    const errBody = await res.text();
    let message = `Agent Server 返回 ${res.status}`;
    try {
      const parsed = JSON.parse(errBody);
      message = parsed?.error?.message || message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('SSE 响应体不可读');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 逐帧解析（帧以 \n\n 分隔）
    let sepIdx = buffer.indexOf('\n\n');
    while (sepIdx !== -1) {
      const frame = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);
      parseFrame(frame, onEvent);
      sepIdx = buffer.indexOf('\n\n');
    }
  }

  // 尾部残留帧
  if (buffer.trim()) parseFrame(buffer, onEvent);
}

function parseFrame(frame: string, onEvent: (evt: SseEvent) => void): void {
  const lines = frame.split('\n');
  let eventName = '';
  let dataStr = '';
  for (const line of lines) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
  }
  if (!eventName || !dataStr) return;
  try {
    const data = JSON.parse(dataStr);
    onEvent({ event: eventName, data } as SseEvent);
  } catch {
    // 忽略非 JSON 帧
  }
}

/** 发送 chat 消息并订阅 SSE 流 */
export function sendChatMessage(
  input: { sessionId: string; content: string; contextRefs?: unknown[] },
  onEvent: (evt: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamSseRequest('/chat', input, onEvent, signal);
}

/** 采纳卡片（SSE 流式执行进度） */
export function applyCard(
  cardId: string,
  selectedItemIds: string[],
  onEvent: (evt: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamSseRequest(`/cards/${cardId}/apply`, { selectedItemIds }, onEvent, signal);
}
