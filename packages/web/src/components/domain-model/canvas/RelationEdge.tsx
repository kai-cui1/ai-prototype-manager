/**
 * @module RelationEdge
 * @description ReactFlow 自定义边：渲染实体关系线。
 *
 * 五种关系类型：
 * - association:    实线蓝色 + 普通箭头 ▶
 * - dependency:     实线灰色 + 普通箭头 ▶
 * - aggregation:    虚线蓝色 + 空心菱形 ◇（自定义 SVG marker）
 * - composition:    实线青色 + 实心菱形 ◆（自定义 SVG marker）
 * - generalization: 实线紫色 + 空心三角 △（自定义 SVG marker，source=子类，target=父类）
 *
 * generalization 特殊规则：
 * - 不显示基数标注（固定 1:1，无意义）
 * - 常驻标签格式：「泛化(维度：xxx)」，紫色主题
 * - Hover Tooltip 显示维度而非基数
 *
 * 箭头对齐：association/dependency 使用 SVG marker + orient="auto"，
 * 确保箭头沿贝塞尔路径末端切线方向对齐，不出现半边箭头与线条重合的问题。
 */

import { memo, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

type RelationKind = 'association' | 'dependency' | 'aggregation' | 'composition' | 'generalization';

interface RelationEdgeData {
  relationKind: RelationKind;
  sourceCardinality: string;
  targetCardinality: string;
  displayName?: string;
  description?: string;
  dimension?: string;
  showLabel?: boolean;
  isSelected?: boolean;
  [key: string]: unknown;
}

const KIND_LABEL: Record<RelationKind, string> = {
  association: '关联',
  dependency: '依赖',
  aggregation: '聚合',
  composition: '组合',
  generalization: '泛化',
};

const KIND_STROKE: Record<RelationKind, { stroke: string; strokeDasharray?: string }> = {
  association: { stroke: '#4096ff' },
  dependency: { stroke: '#8c8c8c' },
  aggregation: { stroke: '#1677ff', strokeDasharray: '5 3' },
  composition: { stroke: '#08979c' },
  generalization: { stroke: '#722ed1' },
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
  const isGeneralization = kind === 'generalization';

  // 选中态：线宽 2.5px + 主色；Hover 态：线宽 2.5px + 主色；默认态：1.5px + 类型色
  const activeColor = isGeneralization ? '#722ed1' : '#08979c';
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

  // 菱形 marker：aggregation / composition
  const useDiamondMarker = kind === 'aggregation' || kind === 'composition';
  const isFilled = kind === 'composition';
  const diamondFill = isFilled ? (selected || hovered ? activeColor : strokeStyle.stroke) : 'white';
  const diamondStroke = (selected || hovered) ? activeColor : strokeStyle.stroke;

  // 空心三角 marker：generalization（指向父类）
  const useTriangleMarker = kind === 'generalization';
  const triangleStroke = (selected || hovered) ? activeColor : strokeStyle.stroke;

  // 普通箭头：association / dependency
  const arrowMarkerId = `arrow-${id}`;
  const useArrowMarker = !useDiamondMarker && !useTriangleMarker;

  const markerEndRef = useDiamondMarker
    ? `url(#${markerId})`
    : useTriangleMarker
      ? `url(#${markerId})`
      : `url(#${arrowMarkerId})`;

  const displayText = edgeData.displayName || KIND_LABEL[kind];

  // 基数标注位置：沿路径约 22% 处，靠近对应实体端
  const cardinalityOffset = 0.22;
  const srcCardX = sourceX + cardinalityOffset * (labelX - sourceX);
  const srcCardY = sourceY + cardinalityOffset * (labelY - sourceY);
  const tgtCardX = targetX + cardinalityOffset * (labelX - targetX);
  const tgtCardY = targetY + cardinalityOffset * (labelY - targetY);

  // dimension 标签位置：路径中点偏上
  const dimensionY = labelY - 14;

  return (
    <>
      {/* SVG defs */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          {useDiamondMarker && (
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
          )}
          {useTriangleMarker && (
            <marker
              id={markerId}
              markerWidth="14"
              markerHeight="14"
              refX="12"
              refY="7"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              {/* 空心三角：指向父类（target），朝右方向 */}
              <polygon
                points="2,2 12,7 2,12"
                fill="white"
                stroke={triangleStroke}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </marker>
          )}
          {useArrowMarker && (
            <marker
              id={arrowMarkerId}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              {/* 开口箭头：orient="auto" 自动沿路径末端切线方向旋转，确保与线条对齐 */}
              <path
                d="M 1 1 L 9 5 L 1 9"
                fill="none"
                stroke={currentStroke}
                strokeWidth={currentWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
          )}
        </defs>
      </svg>

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
            {isGeneralization ? (
              <div className="text-muted-foreground">
                {edgeData.dimension ? `维度：${edgeData.dimension}` : '泛化（is-a）'}
              </div>
            ) : (
              <div className="text-muted-foreground">
                {`基数：${edgeData.sourceCardinality ?? '1'} : ${edgeData.targetCardinality}`}
              </div>
            )}
            {edgeData.description && (
              <div className="text-muted-foreground">
                {edgeData.description}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* generalization：常驻标签，格式「泛化(维度：xxx)」 */}
      {isGeneralization && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${dimensionY}px)`,
              pointerEvents: 'none',
              color: '#722ed1',
              backgroundColor: '#f9f0ff',
              border: '1px solid #d3adf7',
            }}
            className="text-[10px] px-1.5 py-0.5 rounded leading-tight"
          >
            {edgeData.dimension
              ? `${displayText}(维度：${edgeData.dimension})`
              : displayText}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* 非 generalization：常驻关系名称标签（由 showLabel 控制） */}
      {!isGeneralization && showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${dimensionY}px)`,
              pointerEvents: 'none',
            }}
            className="text-[10px] text-foreground bg-background/80 px-1.5 py-0.5 rounded border border-border leading-tight"
          >
            {displayText}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* 基数标注（仅非 generalization 显示） */}
      {!isGeneralization && (
        <>
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
      )}
    </>
  );
}

export default memo(RelationEdge);
