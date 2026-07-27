/**
 * @module EntityNode
 * @description ReactFlow 自定义节点：渲染领域实体（标题栏 + 字段列表）。
 *
 * 设计规格（来自 S3 交互设计）：
 * - 宽度 240px，节点标题栏按 category 显示背景色
 * - 字段列表最多显示 6 行，超出显示 "+N 个字段"
 * - 点击节点调用 selectEntity
 * - Handle 位置：上下左右四侧（source+target 双向，id 标识方向）
 * - Handle 可见性：默认隐藏，当节点被选中或鼠标 hover 到节点上时显示，
 *   150ms 淡入淡出；始终保持 pointer-events 以支持连线交互（Reduces
 *   visual noise on canvas — see user feedback 2024-Q）
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDomainModelContext } from '@/contexts/DomainModelContext';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { FieldType } from '@/hooks/useDomainModel';

// category → 标题栏背景色（CSS 变量在 index.css 中定义）
const CATEGORY_COLORS: Record<string, string> = {
  core: 'var(--entity-color-core)',
  supporting: 'var(--entity-color-supporting)',
  event: 'var(--entity-color-event)',
};

function getCategoryColor(category?: string): string {
  if (!category) return 'var(--entity-color-default)';
  return CATEGORY_COLORS[category] ?? 'var(--entity-color-default)';
}

// 字段类型标签颜色
const FIELD_TYPE_COLOR: Record<FieldType, string> = {
  string: 'text-blue-500',
  number: 'text-green-500',
  boolean: 'text-purple-500',
  datetime: 'text-orange-500',
  text: 'text-blue-400',
  enum: 'text-yellow-500',
  email: 'text-cyan-500',
  url: 'text-cyan-600',
  phone: 'text-teal-500',
};

interface EntityNodeData {
  name: string;
  displayName: string;
  category?: string;
  domainId?: string;
  fields: Array<{
    id: string;
    name: string;
    displayName: string;
    fieldType: FieldType;
    isRequired: boolean;
    description?: string | null;
    enumOptions?: Array<{ value: string; label: string }> | null;
  }>;
  [key: string]: unknown;
}

const MAX_VISIBLE_FIELDS = 6;

// 四方向 Handle 定义（不覆盖 inline style，由 ReactFlow 默认样式自动将圆点居中到边框上）
const HANDLES = [
  { id: 'top', position: Position.Top },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
  { id: 'right', position: Position.Right },
] as const;

function EntityNode({ id, data, selected }: NodeProps) {
  const nodeData = data as EntityNodeData;
  const { selectEntity, selectedEntityId } = useDomainModelContext();
  const isSelected = selected || selectedEntityId === id;
  const visibleFields = nodeData.fields.slice(0, MAX_VISIBLE_FIELDS);
  const hiddenCount = nodeData.fields.length - MAX_VISIBLE_FIELDS;

  // Handle 可见性：选中时常驻显示；未选中时默认隐藏，仅当鼠标 hover 到节点
  // 上（group-hover）时才显示。始终保留 pointer-events，避免连线交互失效。
  const handleVisibilityClass = isSelected
    ? 'opacity-100'
    : 'opacity-0 group-hover:opacity-100';

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-card shadow-sm',
        'transition-shadow duration-200',
        isSelected ? 'border-primary shadow-md ring-2 ring-primary/30' : 'border-border hover:shadow-md'
      )}
      style={{ width: 180 }}
      onClick={() => selectEntity(id)}
    >
      {/* 领域归属圆点（右上角，有 domainId 时显示）*/}
      {nodeData.domainId && (
        <div
          className="absolute top-1 right-1 z-10 rounded-full"
          style={{ width: 8, height: 8, backgroundColor: '#0958d9' }}
          title="已归属领域"
        />
      )}

      {/* 内容区：单独加 overflow-hidden + rounded-lg，避免裁剪 Handle */}
      <div className="overflow-hidden rounded-lg">

      {/* 标题栏 */}
      <div
        className="px-2 py-1.5"
        style={{ backgroundColor: getCategoryColor(nodeData.category) }}
      >
        <div className="text-xs font-semibold text-white truncate" title={nodeData.displayName}>
          {nodeData.displayName}
        </div>
        <div className="text-[9px] text-white/70 truncate">{nodeData.name}</div>
      </div>

      {/* 字段列表 */}
      <div className="divide-y divide-border">
        {visibleFields.length === 0 ? (
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground">（暂无字段）</div>
        ) : (
          visibleFields.map((field) => {
            // R5 Why: enum 字段展示前 4 个选项 chip，超过以 +N 汇总，hover 用 Tooltip 展示完整列表。
            const enumOpts = field.fieldType === 'enum' ? (field.enumOptions ?? []) : [];
            const visibleEnumOpts = enumOpts.slice(0, 4);
            const hiddenEnumCount = enumOpts.length - visibleEnumOpts.length;
            return (
              <div key={field.id} className="px-2 py-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn('text-[9px] font-mono w-12 truncate shrink-0', FIELD_TYPE_COLOR[field.fieldType])}
                    title={field.fieldType}
                  >
                    {field.fieldType}
                  </span>
                  <span className="text-[11px] text-foreground truncate flex-1" title={field.displayName}>
                    {field.displayName}
                  </span>
                  {/* 描述存在时显示 Info 图标，hover 弹出 Tooltip，最多 5 行截断 */}
                  {field.description && field.description.trim() && (
                    <Tooltip>
                      <TooltipTrigger
                        render={(props) => (
                          <span
                            {...props}
                            className="shrink-0 text-muted-foreground hover:text-foreground cursor-help"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <Info className="h-2.5 w-2.5" />
                          </span>
                        )}
                      />
                      <TooltipContent
                        side="right"
                        className="max-w-[240px] whitespace-pre-wrap break-words text-xs [display:-webkit-box] [-webkit-line-clamp:5] [-webkit-box-orient:vertical] overflow-hidden"
                      >
                        {field.description}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {field.isRequired && (
                    <span className="text-[9px] text-danger shrink-0">*</span>
                  )}
                </div>

                {/* enum 字段选项 chip 行：对齐 displayName（避开 12px 类型标签 + 6px gap） */}
                {enumOpts.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5" style={{ marginLeft: 'calc(3rem + 0.375rem)' }}>
                    {visibleEnumOpts.map((opt, idx) => (
                      <span
                        key={idx}
                        className="rounded-sm border border-yellow-500/20 bg-yellow-500/10 px-1 py-0 text-[9px] text-yellow-700 leading-tight"
                        title={opt.label || opt.value}
                      >
                        {opt.label || opt.value}
                      </span>
                    ))}
                    {hiddenEnumCount > 0 && (
                      <Tooltip>
                        <TooltipTrigger
                          render={(props) => (
                            <span
                              {...props}
                              className="rounded-sm border border-yellow-500/20 bg-yellow-500/10 px-1 py-0 text-[9px] text-yellow-700 leading-tight cursor-help"
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              +{hiddenEnumCount}
                            </span>
                          )}
                        />
                        <TooltipContent side="right" className="max-w-[240px] text-xs">
                          <div className="flex flex-wrap gap-1">
                            {enumOpts.map((opt, idx) => (
                              <span key={idx} className="rounded-sm bg-white/10 px-1">
                                {opt.label || opt.value}
                              </span>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {hiddenCount > 0 && (
          <div className="px-2 py-1 text-[10px] text-muted-foreground text-center">
            +{hiddenCount} 个字段
          </div>
        )}
      </div>
      </div>{/* 内容区结束 */}

      {/* ReactFlow Handles — 四方向，source+target 双向，位于外层避免被 overflow-hidden 裁剪 */}
      {/* 可见性：默认隐藏，选中或 hover 时淡入（transition-opacity 150ms） */}
      {HANDLES.map((h) => (
        <Handle
          key={`source-${h.id}`}
          type="source"
          position={h.position}
          id={h.id}
          className={cn(
            '!bg-primary/60 !w-3 !h-3 transition-opacity duration-150',
            handleVisibilityClass,
          )}
        />
      ))}
      {HANDLES.map((h) => (
        <Handle
          key={`target-${h.id}`}
          type="target"
          position={h.position}
          id={h.id}
          className={cn(
            '!bg-primary/60 !w-3 !h-3 transition-opacity duration-150',
            handleVisibilityClass,
          )}
        />
      ))}
    </div>
  );
}

export default memo(EntityNode);