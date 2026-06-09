/**
 * @module NodePool
 * @description 左侧节点池 — 可折叠面板，提供 Action/Decision 节点模板拖拽到画布。
 *
 * 交互设计 §3.6:
 * - Action / Decision 两种模板卡片
 * - 支持拖拽到画布创建节点（DnD）
 * - 拖拽释放时计算落点泳道位置
 * - 可折叠
 */

import { useState, useCallback, useRef, type DragEvent } from 'react';
import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import { Zap, GitBranch, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const NODE_TEMPLATES = [
  {
    type: 'action' as const,
    label: 'Action',
    description: '活动节点',
    icon: Zap,
    color: 'blue',
    bgClass: 'bg-blue-50 border-blue-200 hover:border-blue-400',
    iconClass: 'text-blue-600',
  },
  {
    type: 'decision' as const,
    label: 'Decision',
    description: '决策节点',
    icon: GitBranch,
    color: 'amber',
    bgClass: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    iconClass: 'text-amber-600',
  },
];

export default function NodePool() {
  const { createNode, layout, selectNode } = useProcessEditorContext();
  const [collapsed, setCollapsed] = useState(false);
  const dragTypeRef = useRef<string | null>(null);

  const handleDragStart = useCallback((e: DragEvent, nodeType: string) => {
    e.dataTransfer.setData('application/reactflow-type', nodeType);
    e.dataTransfer.effectAllowed = 'move';
    dragTypeRef.current = nodeType;
  }, []);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center border-r bg-gray-50 py-2 px-1">
        <button
          className="h-6 w-6 rounded hover:bg-gray-200 flex items-center justify-center"
          onClick={() => setCollapsed(false)}
          title="展开节点池"
        >
          <ChevronRight className="h-4 w-4 text-gray-500" />
        </button>
        {NODE_TEMPLATES.map((t) => (
          <div
            key={t.type}
            className="mt-2 cursor-grab"
            draggable
            onDragStart={(e) => handleDragStart(e, t.type)}
            title={t.label}
          >
            <t.icon className={`h-4 w-4 ${t.iconClass}`} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex w-60 flex-col border-r bg-gray-50">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          节点池
        </h3>
        <button
          className="h-5 w-5 rounded hover:bg-gray-200 flex items-center justify-center"
          onClick={() => setCollapsed(true)}
          title="折叠节点池"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-gray-500" />
        </button>
      </div>

      {/* 模板卡片 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {NODE_TEMPLATES.map((template) => {
          const Icon = template.icon;
          return (
            <div
              key={template.type}
              className={`cursor-grab rounded-lg border p-3 transition-colors ${template.bgClass}`}
              draggable
              onDragStart={(e) => handleDragStart(e, template.type)}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${template.iconClass}`} />
                <span className="text-sm font-medium">{template.label}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
            </div>
          );
        })}

        {/* 使用提示 */}
        <div className="mt-4 rounded-md bg-muted/50 p-3 text-[10px] text-muted-foreground leading-relaxed">
          拖拽节点模板到右侧画布创建流程节点。节点将自动落入对应泳道位置。
        </div>
      </div>
    </div>
  );
}
