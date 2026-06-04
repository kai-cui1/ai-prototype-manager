/**
 * @module DomainNode
 * @description ReactFlow 自定义节点：渲染领域边界（半透明矩形框 + 标题栏）。
 *
 * 视觉规格（S3 交互设计 §3.2.4）：
 * - 标题栏 36px，背景 #e6f4ff，文字 #0958d9
 * - 框体背景 rgba(230, 244, 255, 0.3)，1.5px dashed #91caff 边框
 * - 选中态：2px solid #1677ff，标题栏加深
 * - 最小尺寸 240×160，默认 400×300
 * - z-index 低于 EntityNode
 * - 编辑/删除操作通过点击框体打开 Inspector 面板完成（无标题栏按钮）
 * - NodeResizer：8 方向把手，minWidth=240 minHeight=160，松手后由 ERCanvas 保存尺寸
 */

import { memo } from 'react';
import { type NodeProps, NodeResizer } from '@xyflow/react';
import { BoxSelect } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DomainNodeData {
  name: string;
  description?: string;
  entityCount?: number;
  dragHover?: boolean;   // 有实体正在拖拽悬停到此框内
  overlapping?: boolean; // 此框与其他框有重叠
  [key: string]: unknown;
}

function DomainNode({ data, selected }: NodeProps) {
  const nodeData = data as DomainNodeData;

  const entityCount = nodeData.entityCount ?? 0;
  const isDragHover = nodeData.dragHover ?? false;
  const isOverlapping = nodeData.overlapping ?? false;

  // 边框样式优先级：selected > overlapping > dragHover > default
  function getBorder() {
    if (selected) return '2px solid #1677ff';
    if (isOverlapping) return '2px solid #ff4d4f';
    if (isDragHover) return '2px solid #1677ff';
    return '1.5px dashed #91caff';
  }

  function getBackground() {
    if (isDragHover) return 'rgba(230, 244, 255, 0.5)';
    return 'rgba(230, 244, 255, 0.3)';
  }

  return (
    <>
      {/* NodeResizer：仅在选中时显示把手，最小尺寸 240×160 */}
      <NodeResizer
        isVisible={selected}
        minWidth={240}
        minHeight={160}
        lineStyle={{
          borderColor: '#1677ff',
          borderWidth: 1,
        }}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 2,
          backgroundColor: '#ffffff',
          border: '1.5px solid #1677ff',
        }}
      />

      <div
        className={cn(
          'rounded-lg overflow-hidden',
          isDragHover ? 'shadow-md animate-pulse' : selected ? 'shadow-md' : 'shadow-sm',
        )}
        style={{
          width: '100%',
          height: '100%',
          minWidth: 240,
          minHeight: 160,
          border: getBorder(),
          background: getBackground(),
          transition: 'border 150ms ease, background 150ms ease, box-shadow 150ms ease',
        }}
      >
        {/* 标题栏 */}
        <div
          className="flex items-center gap-1.5 px-2.5 shrink-0"
          style={{
            height: 36,
            backgroundColor: selected ? '#bae0ff' : '#e6f4ff',
          }}
        >
          <BoxSelect size={14} className="shrink-0" style={{ color: '#0958d9' }} />
          <span className="text-sm font-medium truncate flex-1" style={{ color: '#0958d9' }}>
            {nodeData.name}
          </span>

          {entityCount > 0 && (
            <span className="text-[10px] bg-white/60 px-1.5 rounded shrink-0" style={{ color: '#0958d9' }}>
              {entityCount} 个实体
            </span>
          )}
        </div>

        {/* 框体（空白容器，实体节点由 ReactFlow 在同一画布渲染） */}
        <div className="flex-1" />
      </div>
    </>
  );
}

export default memo(DomainNode);
