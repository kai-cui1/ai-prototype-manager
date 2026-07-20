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
import { cn } from '@/lib/utils';
import { useDomainModelContext } from '@/contexts/DomainModelContext';
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
          visibleFields.map((field) => (
            <div key={field.id} className="flex items-center gap-1.5 px-2 py-1">
              <span
                className={cn('text-[9px] font-mono w-12 truncate shrink-0', FIELD_TYPE_COLOR[field.fieldType])}
                title={field.fieldType}
              >
                {field.fieldType}
              </span>
              <span className="text-[11px] text-foreground truncate flex-1" title={field.displayName}>
                {field.displayName}
              </span>
              {field.isRequired && (
                <span className="text-[9px] text-danger shrink-0">*</span>
              )}
            </div>
          ))
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