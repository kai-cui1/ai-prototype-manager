/**
 * @module components/agent/SessionList
 * @description Agent 会话列表：新建 / 切换 / 归档。
 */
import { useMemo } from 'react';
import { Plus, Archive, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AgentSession } from '@/types/agent';

interface Props {
  sessions: AgentSession[];
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onArchive: (sessionId: string) => void;
}

export default function SessionList({ sessions, currentSessionId, onSelect, onCreate, onArchive }: Props) {
  // 仅显示 active，按 lastMessageAt 降序
  const activeSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'active')
        .sort((a, b) => {
          const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.createdAt).getTime();
          const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.createdAt).getTime();
          return tb - ta;
        }),
    [sessions],
  );

  return (
    <div className="flex h-full w-72 flex-col border-r border-border bg-muted/30">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold">会话历史</span>
        <Button size="sm" onClick={onCreate} className="h-7 gap-1 px-2 text-xs">
          <Plus className="h-3.5 w-3.5" />
          新建
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {activeSessions.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-30" />
            暂无会话，点击"新建"开始对话
          </div>
        )}
        {activeSessions.map((s) => {
          const active = s.id === currentSessionId;
          return (
            <div
              key={s.id}
              className={cn(
                'group mb-1 flex items-start gap-2 rounded-md px-2 py-2 cursor-pointer transition-colors',
                active ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent',
              )}
              onClick={() => onSelect(s.id)}
            >
              {active && <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-primary" />}
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">
                  {s.title || '未命名会话'}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatRelative(s.lastMessageAt || s.createdAt)} · {s.messageCount} 条 · {s.mode === 'copilot' ? '副驾' : '执行者'}
                </div>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 shrink-0 rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(s.id);
                }}
                title="归档"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(iso).toLocaleDateString();
}
