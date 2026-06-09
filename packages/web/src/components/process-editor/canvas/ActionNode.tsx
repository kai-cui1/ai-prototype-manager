/**
 * @module ActionNode
 * @description Action 类型流程节点 — ReactFlow 自定义节点。
 *
 * 交互设计 §3.5.2:
 * - 显示：holder 图标 + 名称 + actionRef 摘要
 * - Hover：显示连接点 + 编辑按钮
 * - 选中：蓝色边框 + 删除按钮
 */

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import { cn } from '@/lib/utils';

export interface ActionNodeData {
  nodeId: string;
  name: string;
  displayName: string;
  holderType: string;
  holderLabel: string;
  actionRef: string | null;
  isSelected: boolean;
  hasError: boolean;
}

function ActionNodeComponent({ data, id }: NodeProps & { data: ActionNodeData }) {
  const { selectNode } = useProcessEditorContext();

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(id);
  }, [selectNode, id]);

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
      {/* 连接点 */}
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      <Handle type="target" position={Position.Left} id="left" className="!w-3 !h-3 !bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Right} id="right" className="!w-3 !h-3 !bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* 顶部：Holder 类型标签 */}
      <div className="flex items-center gap-1.5 rounded-t-md bg-blue-50 px-3 py-1.5">
        <Zap className="h-3.5 w-3.5 text-blue-600" />
        <span className="text-[10px] font-medium text-blue-700 uppercase tracking-wide">
          {data.holderType}
        </span>
        {data.actionRef && (
          <span className="ml-auto text-[9px] font-mono text-blue-500 truncate max-w-[80px]">
            {data.actionRef}
          </span>
        )}
      </div>

      {/* 主体 */}
      <div className="px-3 py-2">
        <h4 className="text-sm font-semibold text-gray-900 truncate">{data.displayName}</h4>
        <p className="text-[10px] text-gray-500 font-mono truncate">{data.name}</p>
      </div>

    </div>
  );
}

export default memo(ActionNodeComponent);
