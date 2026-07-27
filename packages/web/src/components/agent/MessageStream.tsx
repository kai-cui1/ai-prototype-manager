/**
 * @module components/agent/MessageStream
 * @description 消息流容器：加载历史 + 渲染消息气泡 + 自动滚动到底部
 */
import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import type { AgentMessage } from '@/types/agent';

interface Props {
  messages: AgentMessage[];
  /** 流式过程中的临时 assistant 消息（未持久化） */
  streamingMessage: AgentMessage | null;
  /** 消息 id → 卡片元数据的映射（来自 SSE card_ready） */
  cardMap: Record<string, { cardId: string; title: string; itemCount: number }>;
  loading: boolean;
}

export default function MessageStream({ messages, streamingMessage, cardMap, loading }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);

  // 自动滚动到底部（用户手动上滚时暂停）
  useEffect(() => {
    if (!autoScroll.current || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingMessage?.content]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScroll.current = nearBottom;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        加载中…
      </div>
    );
  }

  if (messages.length === 0 && !streamingMessage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
        <div className="text-4xl">🤖</div>
        <div className="text-lg font-semibold">你好！我是你的设计助手</div>
        <div className="text-sm text-muted-foreground max-w-md">
          我可以帮你设计领域模型、定义角色和业务流程、回答产品设计问题。
          <br />
          直接告诉我你的需求即可开始。
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-6 py-4"
    >
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} card={cardMap[m.id]} />
      ))}
      {streamingMessage && (
        <MessageBubble
          key={streamingMessage.id}
          message={streamingMessage}
          card={cardMap[streamingMessage.id]}
          isStreaming
        />
      )}
    </div>
  );
}
