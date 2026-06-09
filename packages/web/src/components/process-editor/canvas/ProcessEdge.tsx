/**
 * @module ProcessEdge
 * @description 流程连线 — ReactFlow 自定义边。
 *
 * 交互设计 §3.5.4:
 * - 带箭头连线 + 条件标签 + 映射标签
 * - 选中：蓝色高亮 + 中点删除按钮
 */

import { memo, useCallback, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import { cn } from '@/lib/utils';

export interface ProcessEdgeData {
  label: string | null;
  condition: string | null;
  isSelected: boolean;
  hasError: boolean;
  crowdingIndex?: number;
}

function ProcessEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps & { data: ProcessEdgeData }) {
  const { selectEdge, deleteEdge } = useProcessEditorContext();
  const [hovered, setHovered] = useState(false);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
  });

  const isHighlighted = selected || data?.isSelected || hovered;
  const hasError = data?.hasError;
  const crowdingIndex = data?.crowdingIndex ?? 0;
  const strokeColor = isHighlighted ? '#3b82f6' : hasError ? '#f87171' : '#94a3b8';

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteEdge(id);
  }, [deleteEdge, id]);

  const displayLabel = data?.label || data?.condition;

  // 跳线：在边中点绘制半圆弧形（crowdingIndex > 0 时显示）
  const showBridge = crowdingIndex > 0;
  const bridgePath = showBridge
    ? `M ${labelX - 6} ${labelY} Q ${labelX} ${labelY - 10} ${labelX + 6} ${labelY}`
    : '';

  return (
    <>
      {/* SVG Marker 定义：箭头 */}
      <defs>
        <marker
          id={`arrow-${id}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={strokeColor} />
        </marker>
      </defs>

      {/* 不可见的宽边用于 hover 检测 */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="react-flow__edge-interaction"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => { e.stopPropagation(); selectEdge(id); }}
      />

      <BaseEdge
        path={edgePath}
        markerEnd={`url(#arrow-${id})`}
        className={cn(
          hasError && 'stroke-red-400 stroke-dashed',
        )}
        style={{
          stroke: strokeColor,
          strokeWidth: isHighlighted ? 2.5 : 1.5,
        }}
      />

      {/* 跳线（重合时显示） */}
      {showBridge && (
        <path
          d={bridgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={isHighlighted ? 2.5 : 1.5}
        />
      )}

      {/* 标签 */}
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute pointer-events-auto"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
            }}
          >
            <span
              className={cn(
                'inline-block rounded bg-white px-1.5 py-0.5 shadow-sm border text-[10px] font-medium',
                isHighlighted ? 'border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600',
              )}
            >
              {displayLabel}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* 中点删除按钮（hover 时显示） */}
      {isHighlighted && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute pointer-events-auto"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - (displayLabel ? 16 : 0)}px)`,
            }}
          >
            {!displayLabel && (
              <button
                className="h-5 w-5 rounded-full bg-white shadow border border-red-200 flex items-center justify-center hover:bg-red-50"
                onClick={handleDelete}
                title="删除连线"
              >
                <Trash2 className="h-2.5 w-2.5 text-red-500" />
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(ProcessEdgeComponent);
