/**
 * @module BranchSelectDialog
 * @description 从 Decision 节点拉线时，选择对应分支的 Dialog。
 *
 * 交互设计：
 * - 用户从 Decision 节点的 source Handle 拖拽连线到目标节点
 * - 释放时弹出此 Dialog，要求选择该连线对应的分支
 * - 选择后，分支名写入 edge 的 config.sourceBranch
 */

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, GitBranch, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BranchItem {
  name: string;
  condition?: string;
}

interface BranchSelectDialogProps {
  open: boolean;
  branches: BranchItem[];
  decisionDisplayName: string;
  onSelect: (branchName: string) => void;
  onCancel: () => void;
}

export default function BranchSelectDialog({
  open,
  branches,
  decisionDisplayName,
  onSelect,
  onCancel,
}: BranchSelectDialogProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return branches;
    const q = search.toLowerCase();
    return branches.filter(
      (b) => b.name.toLowerCase().includes(q) || (b.condition?.toLowerCase() ?? '').includes(q),
    );
  }, [branches, search]);

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
      setSearch('');
      setSelected(null);
    }
  };

  const handleCancel = () => {
    setSearch('');
    setSelected(null);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>选择分支</DialogTitle>
          <DialogDescription>
            为「{decisionDisplayName}」的出边选择对应的分支
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder="搜索分支..."
              className="pl-8"
            />
          </div>

          {/* 分支列表 */}
          {filtered.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {search ? '没有匹配的分支' : '该 Decision 暂无分支定义'}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filtered.map((branch) => (
                <button
                  key={branch.name}
                  className={cn(
                    'w-full flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors cursor-pointer text-left',
                    selected === branch.name
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:bg-muted/50',
                  )}
                  onClick={() => setSelected(branch.name)}
                >
                  <div
                    className={cn(
                      'mt-0.5 h-4 w-4 rounded border flex items-center justify-center flex-shrink-0',
                      selected === branch.name ? 'bg-primary border-primary' : 'border-gray-300',
                    )}
                  >
                    {selected === branch.name && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <GitBranch className="h-3 w-3 text-amber-500 flex-shrink-0" />
                      <span className="font-medium truncate">{branch.name}</span>
                    </div>
                    {branch.condition && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
                        {branch.condition}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>取消</Button>
          <Button onClick={handleConfirm} disabled={!selected}>
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
