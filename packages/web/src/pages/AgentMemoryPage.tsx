/**
 * @module pages/AgentMemoryPage
 * @description AI 记忆管理页：分类 Tab + 记忆卡片列表 + 新增/编辑/删除。
 *
 * 路由：/settings/memory
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  listMemories,
  createMemory,
  updateMemory,
  deleteMemory,
} from '@/lib/agent-api';
import {
  MEMORY_CATEGORY_LABELS,
  MEMORY_SOURCE_LABELS,
  type MemoryCategory,
  type UserMemory,
} from '@/types/agent';

const CATEGORIES: (MemoryCategory | 'all')[] = [
  'all',
  'user_preference',
  'naming_convention',
  'design_rule',
  'domain_knowledge',
  'workflow_habit',
  'tool_usage',
];

export default function AgentMemoryPage() {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [filter, setFilter] = useState<MemoryCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [dialogState, setDialogState] = useState<{ open: boolean; editing: UserMemory | null }>({
    open: false,
    editing: null,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listMemories();
      setMemories(list);
    } catch (err) {
      toast.error(`记忆加载失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(
    () => (filter === 'all' ? memories : memories.filter((m) => m.category === filter)),
    [memories, filter],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: memories.length };
    for (const c of CATEGORIES) {
      if (c === 'all') continue;
      counts[c] = memories.filter((m) => m.category === c).length;
    }
    return counts;
  }, [memories]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该记忆？此操作不可恢复。')) return;
    try {
      await deleteMemory(id);
      toast.success('已删除');
      refresh();
    } catch (err) {
      toast.error(`删除失败: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">AI 记忆管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理 AI 助手对你的长期记忆，这些记忆会影响 AI 的回复质量。
        </p>
      </div>

      {/* 分类 Tab */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs transition-colors',
              filter === c
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent',
            )}
          >
            {c === 'all' ? '全部' : MEMORY_CATEGORY_LABELS[c]} ({categoryCounts[c] ?? 0})
          </button>
        ))}
      </div>

      <div className="flex justify-between">
        <div className="text-sm text-muted-foreground">
          共 {filtered.length} 条记忆
        </div>
        <Button
          size="sm"
          onClick={() => setDialogState({ open: true, editing: null })}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          手动新增
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {filter === 'all' ? '暂无记忆。与 AI 对话或手动新增以生成记忆。' : '该分类下暂无记忆。'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              className={cn(
                'group rounded-lg border border-border bg-background p-4',
                !m.isActive && 'opacity-50',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">
                    {!m.isActive && <span className="mr-1 text-destructive">[已停用]</span>}
                    {m.title}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    分类：{MEMORY_CATEGORY_LABELS[m.category]} · 来源：
                    {MEMORY_SOURCE_LABELS[m.source]} ·{' '}
                    {new Date(m.updatedAt).toLocaleDateString()}
                  </div>
                  <div className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => setDialogState({ open: true, editing: m })}
                    title="编辑"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(m.id)}
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <MemoryEditDialog
        open={dialogState.open}
        editing={dialogState.editing}
        onClose={() => setDialogState({ open: false, editing: null })}
        onSaved={refresh}
      />
    </div>
  );
}

interface DialogProps {
  open: boolean;
  editing: UserMemory | null;
  onClose: () => void;
  onSaved: () => void;
}

function MemoryEditDialog({ open, editing, onClose, onSaved }: DialogProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<MemoryCategory>('user_preference');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setContent(editing.content);
      setCategory(editing.category);
    } else {
      setTitle('');
      setContent('');
      setCategory('user_preference');
    }
  }, [editing, open]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('标题和内容不能为空');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateMemory(editing.id, { title, content, category });
        toast.success('已保存');
      } else {
        await createMemory({ title, content, category });
        toast.success('已新增');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(`保存失败: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑记忆' : '手动新增记忆'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="mem-title">标题</Label>
            <Input
              id="mem-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="简短描述这条记忆"
            />
          </div>
          <div>
            <Label>分类</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as MemoryCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MEMORY_CATEGORY_LABELS) as MemoryCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {MEMORY_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="mem-content">内容</Label>
            <Textarea
              id="mem-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="详细描述记忆内容"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
