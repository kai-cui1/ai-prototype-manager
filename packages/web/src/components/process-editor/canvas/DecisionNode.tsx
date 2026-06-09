/**
 * @module DecisionNode
 * @description Decision 类型流程节点 — ReactFlow 自定义节点（菱形）。
 *
 * 设计要点：
 * - 外层 clip-path 实现菱形外形
 * - 内层文字水平展示，不被 clip-path 裁剪
 * - 4 个固定 Handle（上下左右端点），不随分支数量变化
 * - 分支描述标注在 edge 上，不在节点上
 */

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import { cn } from '@/lib/utils';

export interface DecisionNodeData {
  nodeId: string;
  name: string;
  displayName: string;
  holderType: string;
  holderLabel: string;
  decisionRef: string | null;
  branchCount: number;
  isSelected: boolean;
  hasError: boolean;
}

/** 菱形尺寸 */
const DIAMOND_SIZE = 120;

function DecisionNodeComponent({ data, id }: NodeProps & { data: DecisionNodeData }) {
  const { selectNode } = useProcessEditorContext();

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(id);
  }, [selectNode, id]);

  return (
    <div
      className="group relative"
      style={{ width: DIAMOND_SIZE, height: DIAMOND_SIZE }}
      onClick={handleClick}
    >
      {/* 菱形外形层 */}
      <div
        className={cn(
          'absolute inset-0 border-2 bg-white shadow-sm transition-all duration-150',
          data.isSelected ? 'border-amber-500 shadow-md' : 'border-amber-300 group-hover:border-amber-400',
          data.hasError && 'border-red-400 border-dashed',
        )}
        style={{
          clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        }}
      />

      {/* 选中态高亮层（与外形层叠加） */}
      {data.isSelected && (
        <div
          className="absolute inset-0 border-2 border-amber-500 shadow-md pointer-events-none"
          style={{
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          }}
        />
      )}

      {/* 4 个固定 Handle（菱形端点） */}
      {/* 上 — target */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-3 !h-3 !bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ top: 0, left: '50%', transform: 'translate(-50%, -50%)' }}
      />
      {/* 右 — source */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-3 !h-3 !bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ top: '50%', right: 0, transform: 'translate(50%, -50%)' }}
      />
      {/* 下 — source */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-3 !h-3 !bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }}
      />
      {/* 左 — target */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-3 !h-3 !bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ top: '50%', left: 0, transform: 'translate(-50%, -50%)' }}
      />

      {/* 文字内容层（水平展示，不被 clip-path 裁剪） */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        style={{ padding: '20%' }}
      >
        {/* Decision 标签 */}
        <span className="text-[9px] font-medium text-amber-600 uppercase tracking-wide">
          Decision
        </span>
        {/* 显示名 */}
        <h4
          className="text-xs font-semibold text-gray-900 text-center leading-tight mt-0.5"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-all',
          }}
        >
          {data.displayName}
        </h4>
        {/* 标识名 */}
        <p className="text-[9px] text-gray-500 font-mono mt-0.5 truncate max-w-full">
          {data.name}
        </p>
        {/* decisionRef */}
        {data.decisionRef && (
          <p className="text-[8px] text-amber-500 font-mono mt-0.5 truncate max-w-full">
            {data.decisionRef}
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(DecisionNodeComponent);
