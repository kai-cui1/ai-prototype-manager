/**
 * @module ActionNode
 * @description Action 类型流程节点 — ReactFlow 自定义节点（极简设计）。
 *
 * 交互设计 §3.5.2:
 * - 显示：仅 displayName（单行居中）
 * - 无顶部栏、无参与者标签、无 actionRef 摘要
 * - 左上角：输入满足状态圆点（绿/黄/红）
 * - Hover：显示连接点 + 编辑按钮
 * - 选中：蓝色边框 + 删除按钮
 */

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import { cn } from '@/lib/utils';

/** 输入满足状态 */
export type InputSatisfactionStatus = 'satisfied' | 'partial' | 'unsatisfied' | 'none';

export interface ActionNodeData {
  nodeId: string;
  displayName: string;
  isSelected: boolean;
  hasError: boolean;
  /** 输入满足状态（纯视觉提示） */
  inputSatisfaction?: InputSatisfactionStatus;
}

const STATUS_DOT_COLORS: Record<InputSatisfactionStatus, string> = {
  satisfied: 'bg-green-500',
  partial: 'bg-amber-500',
  unsatisfied: 'bg-red-500',
  none: 'bg-green-500',  // 无 required 输入 = 满足
};

const STATUS_TITLES: Record<InputSatisfactionStatus, string> = {
  satisfied: '所有必填输入已被映射覆盖',
  partial: '部分必填输入已被覆盖',
  unsatisfied: '必填输入均未被覆盖',
  none: '无需外部输入',
};

function ActionNodeComponent({ data, id }: NodeProps & { data: ActionNodeData }) {
  const { selectNode } = useProcessEditorContext();

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(id);
  }, [selectNode, id]);

  const status = data.inputSatisfaction ?? 'none';

  return (
    <div
      className={cn(
        'group relative rounded-lg border-2 bg-white shadow-sm w-[160px]',
        'transition-all duration-150',
        data.isSelected ? 'border-blue-500 shadow-md' : 'border-gray-300 hover:border-blue-300',
        data.hasError && 'border-red-400 border-dashed',
      )}
      onClick={handleClick}
    >
      {/* 输入满足状态圆点 */}
      {status !== 'none' && (
        <div
          className={cn(
            'absolute -top-1 -left-1 w-[6px] h-[6px] rounded-full z-10',
            STATUS_DOT_COLORS[status],
          )}
          title={STATUS_TITLES[status]}
        />
      )}

      {/* 连接点 — 四方向均带 id，支持 sourceHandle/targetHandle 引用 */}
      <Handle type="target" position={Position.Top} id="top" className="!w-3 !h-3 !bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-3 !h-3 !bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      <Handle type="target" position={Position.Left} id="left" className="!w-3 !h-3 !bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Right} id="right" className="!w-3 !h-3 !bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* 主体：仅 displayName 居中 */}
      <div className="flex items-center justify-center px-3 h-full">
        <h4 className="text-sm font-semibold text-gray-900 text-center truncate">{data.displayName}</h4>
      </div>

    </div>
  );
}

export default memo(ActionNodeComponent);
