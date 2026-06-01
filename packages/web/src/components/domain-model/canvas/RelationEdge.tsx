/**
 * @module RelationEdge
 * @description ReactFlow 自定义边：渲染实体关系线。
 *
 * 四种关系类型：
 * - association: 实线蓝色 + 普通箭头 ▶
 * - dependency:  实线灰色 + 普通箭头 ▶
 * - aggregation: 虚线蓝色 + 空心菱形 ◇（自定义 SVG marker）
 * - composition: 实线青色 + 实心菱形 ◆（自定义 SVG marker）
 *
 * Hover 时显示 Tooltip（relationKind + cardinality + description）
 * showLabel prop 控制常驻标签的显示（由 F-M2-05 画布配置决定）
 */

import { memo, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

type RelationKind = 'association' | 'dependency' | 'aggregation' | 'composition';

interface RelationEdgeData {
  relationKind: RelationKind;
  sourceCardinality: string;
  targetCardinality: string;
  displayName?: string;
  description?: string;
  showLabel?: boolean;
  isSelected?: boolean;
  [key: string]: unknown;
}

const KIND_LABEL: Record<RelationKind, string> = {
  association: '关联',
  dependency: '依赖',
  aggregation: '聚合',
  composition: '组合',
};

const KIND_STROKE: Record<RelationKind, { stroke: string; strokeDasharray?: string }> = {
  association: { stroke: '#4096ff' },
  dependency: { stroke: '#8c8c8c' },
  aggregation: { stroke: '#1677ff', strokeDasharray: '5 3' },
  composition: { stroke: '#08979c' },
};

// 生成唯一 marker id，避免多条边之间互相覆盖
function getMarkerId(edgeId: string, kind: RelationKind): string {
  return `marker-${kind}-${edgeId}`;
}

function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const edgeData = (data ?? {}) as RelationEdgeData;
  const [hovered, setHovered] = useState(false);

  const kind: RelationKind = edgeData.relationKind ?? 'dependency';
  const strokeStyle = KIND_STROKE[kind];
  const markerId = getMarkerId(id, kind);
  const showLabel = edgeData.showLabel ?? false;
  const selected = edgeData.isSelected ?? false;

  // 选中态：线宽 2.5px + 主色；Hover 态：线宽 2.5px + 主色；默认态：1.5px + 类型色
  const activeColor = '#08979c'; // 主色（选中/Hover 时使用）
  const currentStroke = (selected || hovered) ? activeColor : strokeStyle.stroke;
  const currentWidth = (selected || hovered) ? 2.5 : 1.5;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // 菱形 marker 仅 aggregation / composition 使用自定义 SVG
  const useDiamondMarker = kind === 'aggregation' || kind === 'composition';
  const isFilled = kind === 'composition';
  const diamondFill = isFilled ? (selected || hovered ? activeColor : strokeStyle.stroke) : 'white';

  const markerEndRef = useDiamondMarker ? `url(#${markerId})` : undefined;

  // 菱形 marker 的描边色（选中/Hover 时使用主色）
  const diamondStroke = (selected || hovered) ? activeColor : strokeStyle.stroke;

  // 普通箭头（association / dependency）通过 inline path 实现，不依赖 ReactFlow markerEnd
  // 以避免 markerEnd prop 和 defs 混用时的渲染问题
  const arrowSize = 10;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const angle = Math.atan2(dy, dx);
  const arrowX1 = targetX - arrowSize * Math.cos(angle - Math.PI / 7);
  const arrowY1 = targetY - arrowSize * Math.sin(angle - Math.PI / 7);
  const arrowX2 = targetX - arrowSize * Math.cos(angle + Math.PI / 7);
  const arrowY2 = targetY - arrowSize * Math.sin(angle + Math.PI / 7);

  const displayText = edgeData.displayName || KIND_LABEL[kind];

  // 基数标注位置：沿路径约 22% 处，靠近对应实体端
  const cardinalityOffset = 0.22;
  const srcCardX = sourceX + cardinalityOffset * (labelX - sourceX);
  const srcCardY = sourceY + cardinalityOffset * (labelY - sourceY);
  const tgtCardX = targetX + cardinalityOffset * (labelX - targetX);
  const tgtCardY = targetY + cardinalityOffset * (labelY - targetY);

  return (
    <>
      {/* SVG defs：菱形 marker */}
      {useDiamondMarker && (
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            <marker
              id={markerId}
              markerWidth="20"
              markerHeight="16"
              refX="18"
              refY="8"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              {/* 菱形：refX=18 对齐右尖端，菱形整体朝源端延伸，不被目标节点遮挡 */}
              <polygon
                points="2,8 10,2 18,8 10,14"
                fill={diamondFill}
                stroke={diamondStroke}
                strokeWidth="1.5"
              />
            </marker>
          </defs>
        </svg>
      )}

      {/* 主路径 */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEndRef}
        style={{
          stroke: currentStroke,
          strokeDasharray: strokeStyle.strokeDasharray,
          strokeWidth: currentWidth,
          transition: 'stroke-width 150ms, stroke 150ms',
        }}
        interactionWidth={12}
      />

      {/* 普通箭头（association / dependency） */}
      {!useDiamondMarker && (
        <path
          d={`M ${arrowX1} ${arrowY1} L ${targetX} ${targetY} L ${arrowX2} ${arrowY2}`}
          fill="none"
          stroke={currentStroke}
          strokeWidth={currentWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: 'stroke-width 150ms, stroke 150ms', pointerEvents: 'none' }}
        />
      )}

      {/* 鼠标悬停感应区（透明宽边） */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      {/* Hover Tooltip */}
      {hovered && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="rounded-md border border-border bg-card px-2 py-1 text-[11px] shadow-md z-10"
          >
            <div className="font-medium text-foreground">
              {displayText}
            </div>
            <div className="text-muted-foreground">
              {`基数：${edgeData.sourceCardinality ?? '1'} : ${edgeData.targetCardinality}`}
            </div>
            {edgeData.description && (
              <div className="text-muted-foreground">
                {edgeData.description}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* 常驻关系名称标签（由 showLabel 控制，F-M2-05） */}
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 14}px)`,
              pointerEvents: 'none',
            }}
            className="text-[10px] text-foreground bg-background/80 px-1.5 py-0.5 rounded border border-border leading-tight"
          >
            {displayText}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* 源端基数标注（靠近源实体） */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${srcCardX}px, ${srcCardY}px)`,
            pointerEvents: 'none',
          }}
          className="text-[10px] text-muted-foreground bg-background/80 px-1 rounded"
        >
          {edgeData.sourceCardinality ?? '1'}
        </div>
      </EdgeLabelRenderer>

      {/* 目标端基数标注（靠近目标实体） */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${tgtCardX}px, ${tgtCardY}px)`,
            pointerEvents: 'none',
          }}
          className="text-[10px] text-muted-foreground bg-background/80 px-1 rounded"
        >
          {edgeData.targetCardinality}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(RelationEdge);
