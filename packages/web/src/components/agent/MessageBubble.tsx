/**
 * @module components/agent/MessageBubble
 * @description 单条消息气泡：user 右对齐、assistant 左对齐、system 居中；简易 Markdown 渲染。
 *
 * MVP 说明：不引入 react-markdown 依赖，采用极简策略：
 * - 保留白空间和换行
 * - 三反引号代码块 → <pre><code>
 * - 其余按纯文本渲染（后续可升级）
 */
import { useMemo } from 'react';
import { Bot, User, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AgentMessage } from '@/types/agent';
import RecommendationCardView from './RecommendationCard';

interface Props {
  message: AgentMessage;
  /** 该消息若关联卡片，则传入卡片元数据，由本组件渲染卡片视图 */
  card?: {
    cardId: string;
    title: string;
    itemCount: number;
  } | null;
  /** 流式过程中的临时增量内容（仅当 isStreaming 时使用） */
  isStreaming?: boolean;
}

/** 渲染 Markdown 极简版：识别 ```json card 代码块和普通代码块 */
function renderMarkdownLite(text: string): React.ReactNode {
  // 隐藏 ```json card ... ``` 代码块（已由卡片视图承载）
  const strippedCard = text.replace(/```json\s+card\s*\n[\s\S]*?\n```/g, '').trim();

  // 按 ``` 代码块分段
  const parts = strippedCard.split(/(```[\s\S]*?```)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3).replace(/^[a-zA-Z]*\n/, '').trim();
      return (
        <pre
          key={idx}
          className="my-2 overflow-x-auto rounded-md bg-slate-900 text-slate-100 p-3 text-xs font-mono"
        >
          <code>{inner}</code>
        </pre>
      );
    }
    return (
      <span key={idx} className="whitespace-pre-wrap break-words">
        {part}
      </span>
    );
  });
}

export default function MessageBubble({ message, card, isStreaming }: Props) {
  const rendered = useMemo(() => renderMarkdownLite(message.content), [message.content]);

  if (message.role === 'system') {
    return (
      <div className="my-2 text-center text-xs text-muted-foreground">
        {message.content}
      </div>
    );
  }

  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(
      () => toast.success('已复制'),
      () => toast.error('复制失败'),
    );
  };

  return (
    <div className={cn('group my-3 flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div className={cn('flex max-w-[80%] flex-col gap-2', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-lg px-4 py-2.5 text-sm leading-relaxed',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
          )}
        >
          {rendered}
          {isStreaming && (
            <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-current align-middle" />
          )}
          {!message.content && isStreaming && (
            <span className="text-muted-foreground italic">正在思考…</span>
          )}
        </div>

        {/* 卡片视图（仅 assistant 且带 card 时） */}
        {!isUser && card && (
          <RecommendationCardView messageId={message.id} card={card} rawContent={message.content} />
        )}

        {/* 操作按钮（hover 显示，仅 assistant） */}
        {!isUser && message.content && !isStreaming && (
          <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              title="复制内容"
            >
              <Copy className="h-3 w-3" />
              复制
            </button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
