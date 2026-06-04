/**
 * @module Toolbar
 * @description 领域模型顶部工具栏：视图切换（ER图/列表）+ 搜索框（防抖300ms）+ 新建实体 + 画布设置
 */

import { useState, useEffect } from 'react';
import { LayoutGrid, List, Plus, Search, Settings2, BoxSelect } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useDomainModelContext } from '@/contexts/DomainModelContext';
import CreateEntityDialog from './dialogs/CreateEntityDialog';
import CreateBoundaryDialog from './dialogs/CreateBoundaryDialog';
import CanvasSettingsSheet from './CanvasSettingsSheet';

export default function Toolbar() {
  const { viewMode, setViewMode, setSearchQuery } = useDomainModelContext();
  const [inputValue, setInputValue] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createBoundaryOpen, setCreateBoundaryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 防抖 300ms 后更新 Context 的 searchQuery
  const debouncedSetSearch = useDebouncedCallback((val: string) => {
    setSearchQuery(val);
  }, 300);

  useEffect(() => {
    debouncedSetSearch(inputValue);
  }, [inputValue, debouncedSetSearch]);

  return (
    <>
      <div className="flex h-12 items-center gap-2 border-b border-border bg-background px-4">
        {/* 视图切换 */}
        <div className="flex items-center rounded-md border border-border bg-muted p-0.5">
          <button
            onClick={() => setViewMode('graph')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
              viewMode === 'graph'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            ER 图
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
              viewMode === 'list'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="h-3.5 w-3.5" />
            列表
          </button>
        </div>

        {/* 搜索框 */}
        <div className="relative ml-2 flex-1 max-w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={inputValue}
            onChange={(e) => setInputValue((e.target as HTMLInputElement).value)}
            placeholder="搜索实体名称..."
            className="h-8 pl-8 text-sm"
          />
        </div>

        <div className="flex-1" />

        {/* 新建领域 */}
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={() => setCreateBoundaryOpen(true)}
        >
          <BoxSelect className="h-3.5 w-3.5" />
          新建领域
        </Button>

        {/* 新建实体 */}
        <Button size="sm" className="h-8 gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          新建实体
        </Button>

        {/* 画布设置 */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="画布设置"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      <CreateEntityDialog open={createOpen} onOpenChange={setCreateOpen} />
      <CreateBoundaryDialog open={createBoundaryOpen} onOpenChange={setCreateBoundaryOpen} />
      <CanvasSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
