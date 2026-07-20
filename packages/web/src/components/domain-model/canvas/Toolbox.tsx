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
import type { FC, SVGProps } from 'react';
import {
  Database,
  BoxSelect,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  MoveRight,
  X,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useDomainModelContext, type RelationKind } from '@/contexts/DomainModelContext';
import { cn } from '@/lib/utils';
import CreateEntityDialog from '../dialogs/CreateEntityDialog';
import CreateBoundaryDialog from '../dialogs/CreateBoundaryDialog';

/**
 * 关系图标风格统一：短直线（左→右）+ 末端标记，与 Canvas 上实际边的
 * 视觉对齐（RelationEdge 中 aggregation 空心菱形、composition 实心菱形、
 * generalization 空心三角形）。视口 24×24，线宽 2，与 lucide-react 对齐。
 *
 * 布局：直线 x=3→13，y=12；末端标记中心 x≈17，y=12。
 */
const DIAMOND_D = 'M13 12 L17 7 L21 12 L17 17 Z';
const TRIANGLE_D = 'M13 7 L21 12 L13 17 Z';

const AggregationIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="3" y1="12" x2="13" y2="12" />
    <path d={DIAMOND_D} fill="none" />
  </svg>
);

const CompositionIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="3" y1="12" x2="13" y2="12" />
    <path d={DIAMOND_D} fill="currentColor" />
  </svg>
);

const GeneralizationIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="3" y1="12" x2="13" y2="12" />
    <path d={TRIANGLE_D} fill="none" />
  </svg>
);

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

/** 5 种关系图标（§3.1A.6）
 *
 * 图标风格与 Canvas 边视觉对齐：
 * - association: 无箭头短线（ArrowRight 占位；后续可换为 Minus，与 markerEnd=none 呼应）
 * - dependency: 短线 + 箭头末端（MoveRight）
 * - aggregation: 短线 + 空心菱形末端（自定义 SVG）
 * - composition: 短线 + 实心菱形末端（自定义 SVG）
 * - generalization: 短线 + 空心三角形末端，尖端朝右（自定义 SVG）
 */
const RELATION_ITEMS: {
  kind: RelationKind;
  icon: FC<SVGProps<SVGSVGElement>>;
  label: string;
}[] = [
  { kind: 'association', icon: ArrowRight, label: '新建关联' },
  { kind: 'dependency', icon: MoveRight, label: '新建依赖' },
  { kind: 'aggregation', icon: AggregationIcon, label: '新建聚合' },
  { kind: 'composition', icon: CompositionIcon, label: '新建组合' },
  { kind: 'generalization', icon: GeneralizationIcon, label: '新建泛化' },
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
  const {
    rfInstanceRef,
    lastCanvasClickRef,
    entities,
    drawRelation,
    startDrawRelation,
    cancelDrawRelation,
  } = useDomainModelContext();

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

  // 单击关系图标（§3.1A.6）
  const handleRelationIconClick = useCallback(
    (kind: RelationKind) => {
      // 再次点击同图标 → 退出绘制模式
      if (drawRelation.phase !== 'idle' && drawRelation.kind === kind) {
        cancelDrawRelation();
        return;
      }
      // 实体 < 2 不允许进入绘制模式
      if (entities.length < 2) {
        toast.warning('需至少两个实体才能创建关系');
        return;
      }
      startDrawRelation(kind);
    },
    [drawRelation, entities.length, startDrawRelation, cancelDrawRelation]
  );

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

            {/* 分隔线：元素创建区 vs 关系创建区 */}
            <div className="w-px h-4 bg-border mx-1" />

            {/* 5 种关系图标（§3.1A.6） */}
            {RELATION_ITEMS.map((item) => {
              const active =
                drawRelation.phase !== 'idle' && drawRelation.kind === item.kind;
              return (
                <Tooltip key={item.kind}>
                  <TooltipTrigger
                    render={(props) => (
                      <button
                        {...props}
                        type="button"
                        onClick={() => handleRelationIconClick(item.kind)}
                        className={cn(
                          'relative flex items-center justify-center h-7 w-7 rounded-md cursor-pointer transition-all select-none',
                          active
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'hover:bg-accent hover:text-accent-foreground',
                          'active:scale-95'
                        )}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                        {active && (
                          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-3 w-3 rounded-full bg-background text-primary border border-primary">
                            <X className="h-2 w-2" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    )}
                  />
                  <TooltipContent side="bottom" className="text-xs">
                    {active ? `退出绘制 • ${item.label}` : item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
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
