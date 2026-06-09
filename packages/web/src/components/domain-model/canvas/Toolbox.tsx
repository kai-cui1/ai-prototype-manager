/**
 * @module Toolbox
 * @description 画布工具箱：可折叠，包含可添加到画布的元素图标（实体、领域）。
 * 支持两种创建方式：
 *   1. 单击图标 → 弹出创建 Dialog（复用现有 lastCanvasClickRef 定位逻辑）
 *   2. 拖放图标到画布 → 在放置位置弹出创建 Dialog（HTML5 Drag & Drop）
 *
 * 拖放过程中的视觉反馈：
 *   - Canvas 容器蓝色虚线高亮（border-2 border-dashed border-primary/30 bg-primary/5）
 *   - 全尺寸幽灵预览跟随光标（实体 180×78 / 领域 400×300）
 *
 * 折叠状态持久化到 localStorage（key: toolbox-collapsed）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Database, BoxSelect, ChevronDown, ChevronRight } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDomainModelContext } from '@/contexts/DomainModelContext';
import { cn } from '@/lib/utils';
import CreateEntityDialog from '../dialogs/CreateEntityDialog';
import CreateBoundaryDialog from '../dialogs/CreateBoundaryDialog';

type ItemType = 'entity' | 'domain';

/** 幽灵预览尺寸（与画布中实际渲染尺寸一致） */
const GHOST_SIZES: Record<ItemType, { width: number; height: number }> = {
  entity: { width: 180, height: 78 },
  domain: { width: 400, height: 300 },
};

const TOOLBOX_ITEMS: {
  type: ItemType;
  icon: typeof Database;
  label: string;
  ghostBorder: string;
  ghostBg: string;
}[] = [
  {
    type: 'entity',
    icon: Database,
    label: '新建实体',
    ghostBorder: 'border-primary/50',
    ghostBg: 'bg-primary/10',
  },
  {
    type: 'domain',
    icon: BoxSelect,
    label: '新建领域',
    ghostBorder: 'border-[#91caff]/60',
    ghostBg: 'bg-[#e6f4ff]/20',
  },
];

const STORAGE_KEY = 'toolbox-collapsed';

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveCollapsed(val: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(val));
  } catch {
    // ignore
  }
}

export default function Toolbox() {
  const { rfInstanceRef, lastCanvasClickRef } = useDomainModelContext();

  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [dragType, setDragType] = useState<ItemType | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createBoundaryOpen, setCreateBoundaryOpen] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number } | null>(null);

  // 拖拽类型锁定（防止拖拽过程中鼠标进入图标时意外切换）
  const draggingRef = useRef(false);

  // 获取 Canvas 容器 DOM（.react-flow）
  const getCanvasEl = useCallback(
    () => document.querySelector('.react-flow') as HTMLElement | null,
    []
  );

  // 折叠/展开
  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      saveCollapsed(next);
      return next;
    });
  }, []);

  // 单击图标
  const handleClick = useCallback((type: ItemType) => {
    if (type === 'entity') setCreateOpen(true);
    else setCreateBoundaryOpen(true);
  }, []);

  // 拖拽开始
  const handleDragStart = useCallback(
    (type: ItemType) => (e: React.DragEvent) => {
      e.dataTransfer.setData('toolbox/type', type);
      e.dataTransfer.effectAllowed = 'copy';
      draggingRef.current = true;
      setDragType(type);
    },
    []
  );

  // 拖拽结束（含取消）
  const handleDragEnd = useCallback(() => {
    draggingRef.current = false;
    setDragType(null);
    setGhostPos(null);


    // 清理 canvas 容器的高亮 class（兜底）
    const el = getCanvasEl();
    if (el) {
      el.classList.remove(
        'toolbox-drop-highlight'
      );
    }
  }, [getCanvasEl]);

  // 注册 Canvas 容器上的拖放事件
  useEffect(() => {
    if (!draggingRef.current) return;

    const el = getCanvasEl();
    if (!el) return;

    let enterCount = 0;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
      setGhostPos({ x: e.clientX, y: e.clientY });
    };

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      enterCount++;
      if (enterCount === 1) {
        el.classList.add('toolbox-drop-highlight');
      }
    };

    const onDragLeave = (e: DragEvent) => {
      if (e.target === el || !el.contains(e.relatedTarget as Node)) {
        enterCount = 0;
    
        setGhostPos(null);
        el.classList.remove('toolbox-drop-highlight');
      }
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      enterCount = 0;
  
      setGhostPos(null);
      el.classList.remove('toolbox-drop-highlight');

      const type = e.dataTransfer!.getData('toolbox/type') as ItemType | null;
      if (!type) return;

      const rf = rfInstanceRef.current;
      if (rf) {
        const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        lastCanvasClickRef.current = pos;
        if (type === 'entity') setPendingPosition(pos);
      }

      if (type === 'entity') setCreateOpen(true);
      else setCreateBoundaryOpen(true);

      draggingRef.current = false;
      setDragType(null);
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragenter', onDragEnter);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);

    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragenter', onDragEnter);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
      el.classList.remove('toolbox-drop-highlight');
    };
  }, [dragType, rfInstanceRef, lastCanvasClickRef, getCanvasEl]);

  // 当前拖拽类型的幽灵配置
  const ghostItem = dragType
    ? TOOLBOX_ITEMS.find((i) => i.type === dragType)
    : null;
  const ghostSize = dragType ? GHOST_SIZES[dragType] : null;

  return (
    <>
      {/* Toolbox 栏 */}
      <div
        className={cn(
          'flex items-center border-b border-border bg-muted/50 px-3 transition-[height] duration-150 ease-in-out overflow-hidden shrink-0',
          collapsed ? 'h-6' : 'h-9'
        )}
      >
        {/* 折叠/展开按钮 */}
        <button
          onClick={toggleCollapse}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {collapsed ? (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-xs text-muted-foreground">工具箱</span>
            </>
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {/* 图标组（展开态） */}
        {!collapsed && (
          <div className="flex items-center gap-1 ml-2">
            {TOOLBOX_ITEMS.map((item) => (
              <Tooltip key={item.type}>
                <TooltipTrigger render={(props) => (
                  <div
                    {...props}
                    draggable
                    onDragStart={handleDragStart(item.type)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleClick(item.type)}
                    className={cn(
                      'flex items-center justify-center h-7 w-7 rounded-md cursor-grab transition-all select-none',
                      'hover:bg-accent hover:text-accent-foreground',
                      'active:bg-accent/80 active:scale-95',
                      dragType === item.type && 'opacity-50'
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                )} />
                <TooltipContent side="bottom" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>

      {/* 全尺寸幽灵预览（fixed 定位，跟随光标） */}
      {ghostPos && ghostItem && ghostSize && (
        <div
          className="fixed pointer-events-none z-[9999]"
          style={{
            left: ghostPos.x - ghostSize.width / 2,
            top: ghostPos.y - ghostSize.height / 2,
          }}
        >
          <div
            className={cn(
              'border-2 border-dashed rounded-lg',
              ghostItem.ghostBorder,
              ghostItem.ghostBg
            )}
            style={{ width: ghostSize.width, height: ghostSize.height }}
          />
        </div>
      )}

      {/* 创建 Dialog */}
      <CreateEntityDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setPendingPosition(null);
        }}
        initialPosition={pendingPosition}
      />
      <CreateBoundaryDialog
        open={createBoundaryOpen}
        onOpenChange={setCreateBoundaryOpen}
      />
    </>
  );
}
