/**
 * @module components/agent/RecommendationCard
 * @description 推荐卡片视图：展示卡片元信息 + 从消息 content 中解析出的子项 + 采纳/丢弃按钮
 *
 * MVP 简化：
 * - 卡片元数据（cardId/title/itemCount）从 SSE `card_ready` 事件或消息 metadata 传入
 * - 子项列表从消息 content 内嵌的 ```json card 代码块中解析
 * - 采纳时通过 applyCard(SSE) 订阅执行进度并原地刷新子项状态
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { applyCard, discardCard } from '@/lib/agent-api';
import type { ItemExecutionStatus, CardStatus } from '@/types/agent';

interface ParsedItem {
  id: string;
  kind: string;
  label: string;
  preview?: string;
  tool: string;
  args: Record<string, unknown>;
  dependencies?: string[];
  execStatus: ItemExecutionStatus;
  execError?: string;
}

interface Props {
  messageId: string;
  card: { cardId: string; title: string; itemCount: number };
  rawContent: string;
}

/** 从消息 content 中提取 ```json card 代码块并解析 items */
function parseCardItems(content: string): ParsedItem[] {
  const match = content.match(/```json\s+card\s*\n([\s\S]*?)\n```/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed?.items)) return [];
    return parsed.items.map((it: Record<string, unknown>, idx: number) => ({
      id: (it.id as string) || `item-${idx}`,
      kind: (it.kind as string) || 'unknown',
      label: (it.label as string) || `子项 ${idx + 1}`,
      preview: it.preview as string | undefined,
      tool: (it.tool as string) || '',
      args: (it.args as Record<string, unknown>) || {},
      dependencies: it.dependencies as string[] | undefined,
      execStatus: 'pending' as const,
    }));
  } catch {
    return [];
  }
}

export default function RecommendationCardView({ card, rawContent }: Props) {
  const initialItems = useMemo(() => parseCardItems(rawContent), [rawContent]);
  const [items, setItems] = useState<ParsedItem[]>(initialItems);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialItems.map((i) => i.id)),
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<CardStatus>('pending');
  const [applying, setApplying] = useState(false);

  const selectedCount = selectedIds.size;
  const isTerminal = status !== 'pending';

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = async () => {
    if (selectedCount === 0) return;
    setApplying(true);
    // 立即将选中项标记为 pending 显示 loading
    setItems((prev) =>
      prev.map((it) =>
        selectedIds.has(it.id) ? { ...it, execStatus: 'pending' } : it,
      ),
    );

    try {
      await applyCard(card.cardId, Array.from(selectedIds), (evt) => {
        if (evt.event === 'item_progress') {
          const { itemId, status: itemStatus, error } = evt.data;
          setItems((prev) =>
            prev.map((it) =>
              it.id === itemId
                ? { ...it, execStatus: itemStatus, execError: error }
                : it,
            ),
          );
        } else if (evt.event === 'card_complete') {
          setStatus(evt.data.status);
          if (evt.data.status === 'applied') {
            toast.success(`卡片已采纳（${evt.data.applied} 项）`);
          } else if (evt.data.status === 'partial') {
            toast.warning(`部分采纳成功（${evt.data.applied} 成功 / ${evt.data.failed} 失败）`);
          }
        }
      });
    } catch (err) {
      toast.error(`采纳失败: ${(err as Error).message}`);
    } finally {
      setApplying(false);
    }
  };

  const handleDiscard = async () => {
    try {
      await discardCard(card.cardId);
      setStatus('discarded');
      toast.info('卡片已丢弃');
    } catch (err) {
      toast.error(`丢弃失败: ${(err as Error).message}`);
    }
  };

  // 终态折叠视图
  if (isTerminal) {
    const applied = items.filter((i) => i.execStatus === 'success').length;
    const failed = items.filter((i) => i.execStatus === 'failed').length;
    return (
      <div className="rounded-lg border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
        {status === 'discarded' ? (
          <>❌ 已丢弃：{card.title}</>
        ) : (
          <>
            ✅ {card.title}：已采纳 {applied} 项
            {failed > 0 && <>，失败 {failed} 项</>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          📋 {card.title}
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {items.map((item) => {
          const checked = selectedIds.has(item.id);
          const expanded = expandedIds.has(item.id);
          return (
            <div key={item.id} className="rounded border border-border/50 bg-muted/20">
              <div className="flex items-center gap-2 px-3 py-2">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleSelect(item.id)}
                  disabled={applying}
                />
                <StatusIcon status={item.execStatus} />
                <span className="flex-1 text-sm">
                  <span className="text-muted-foreground mr-1">[{item.kind}]</span>
                  {item.label}
                </span>
                {item.preview && (
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
              {expanded && item.preview && (
                <div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
                  {item.preview}
                </div>
              )}
              {item.execError && (
                <div className="border-t border-border/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                  ❌ {item.execError}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
        <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={applying}>
          全部丢弃
        </Button>
        <Button size="sm" onClick={handleApply} disabled={selectedCount === 0 || applying}>
          {applying && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          采纳选中项 ({selectedCount})
        </Button>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ItemExecutionStatus }) {
  if (status === 'success') return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 shrink-0 text-destructive" />;
  return <span className="inline-block h-4 w-4" />;
}
