/**
 * @module SwimlaneResizeHandles
 * @description 泳道 resize 手柄层 — 位于 ReactFlow 画布上层（z-index 更高）。
 *
 * 交互设计:
 * - 渲染泳道分隔线上的 resize 手柄
 * - 拖拽手柄调整泳道宽/高
 * - 最小尺寸约束：必须包含泳道内所有节点
 *
 * 渲染在 ProcessCanvas 中 zIndex: 10 的层，容器 pointer-events: none，
 * 手柄本身 pointer-events: auto，确保不阻挡画布/节点交互。
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import type { ParticipantLane, CustomLane } from '@apm/shared';

/** 默认泳道尺寸 */
const DEFAULT_LANE_SIZE = 200;
const LANE_HEADER_SIZE = 32;
/** 泳道绝对最小尺寸（无节点时的底线） */
const MIN_LANE_SIZE = 100;

/** 节点类型对应的默认尺寸（与 ProcessCanvas 中 ReactFlow 节点尺寸一致） */
const NODE_DIMS_BY_TYPE: Record<string, { width: number; height: number }> = {
  action: { width: 160, height: 80 },
  decision: { width: 120, height: 120 },
};
const DEFAULT_NODE_DIM = { width: 160, height: 80 };
/** 节点边距（与 ProcessCanvas 中 clamp 偏移量一致） */
const NODE_MARGIN = 8;

/**
 * 计算泳道缩小后的最小尺寸（必须包含该泳道内所有节点 + NODE_MARGIN 边距）
 *
 * - participant 泳道（横向行）：计算最小高度
 * - custom 泳道（纵向列）：计算最小宽度
 */
function computeMinLaneSize(
  layout: {
    participantLanes: { participantId?: string; size?: number }[];
    customLanes: { id?: string; size?: number }[];
    laneOverrides?: Record<string, { size?: number }>;
    nodePositions?: Record<string, { participantLaneIndex: number; customLaneIndex: number; offsetX: number; offsetY: number }>;
  },
  laneId: string,
  laneType: 'participant' | 'custom',
  nodePositions: Record<string, { participantLaneIndex: number; customLaneIndex: number; offsetX: number; offsetY: number }>,
  nodeDims: Record<string, { width: number; height: number }>,
): number {
  let laneIndex = -1;
  if (laneType === 'participant') {
    laneIndex = layout.participantLanes.findIndex((l) => l.participantId === laneId);
  } else {
    laneIndex = layout.customLanes.findIndex((l) => l.id === laneId);
  }
  if (laneIndex < 0) return MIN_LANE_SIZE;

  let minSize = MIN_LANE_SIZE;
  for (const [nodeId, pos] of Object.entries(nodePositions)) {
    const isInLane = laneType === 'participant'
      ? pos.participantLaneIndex === laneIndex
      : pos.customLaneIndex === laneIndex;
    if (!isInLane) continue;

    const dim = nodeDims[nodeId] ?? DEFAULT_NODE_DIM;
    if (laneType === 'participant') {
      minSize = Math.max(minSize, pos.offsetY + dim.height + NODE_MARGIN);
    } else {
      minSize = Math.max(minSize, pos.offsetX + dim.width + NODE_MARGIN);
    }
  }
  return minSize;
}

interface SwimlaneResizeHandlesProps {
  /** 画布容器尺寸 */
  width: number;
  height: number;
  /** ReactFlow viewport zoom */
  zoom?: number;
}

/** resize 状态 */
interface ResizeState {
  active: boolean;
  laneId: string;
  laneType: 'participant' | 'custom';
  startPos: number;
  startSize: number;
  isHorizontal: boolean; // true = 调整高度（横向分隔线），false = 调整宽度（纵向分隔线）
  zoom: number;
}

export default function SwimlaneResizeHandles({ width, height, zoom = 1 }: SwimlaneResizeHandlesProps) {
  const { layout, updateLayout, nodes } = useProcessEditorContext();

  // 构建 nodeId → 节点尺寸 映射（基于 nodeType）
  const nodeDims = useMemo(() => {
    const map: Record<string, { width: number; height: number }> = {};
    for (const n of nodes) {
      map[n.id] = NODE_DIMS_BY_TYPE[n.nodeType] ?? DEFAULT_NODE_DIM;
    }
    return map;
  }, [nodes]);

  const [resizeState, setResizeState] = useState<ResizeState>({
    active: false,
    laneId: '',
    laneType: 'participant',
    startPos: 0,
    startSize: 0,
    isHorizontal: true,
    zoom: 1,
  });

  // 全局 mousemove / mouseup：拖拽调整泳道尺寸
  useEffect(() => {
    if (!resizeState.active) return;

    const handleMouseMove = (e: MouseEvent) => {
      const screenDelta = resizeState.isHorizontal ? e.clientY - resizeState.startPos : e.clientX - resizeState.startPos;
      const delta = screenDelta / Math.max(resizeState.zoom, 0.01);
      let newSize = Math.max(MIN_LANE_SIZE, resizeState.startSize + delta);

      if (!layout) return;

      // 最小尺寸约束：必须能包含该泳道内所有节点（节点 8px 边距）
      const nodePositions = layout.nodePositions ?? {};
      const minSize = computeMinLaneSize(layout, resizeState.laneId, resizeState.laneType, nodePositions, nodeDims);
      newSize = Math.max(newSize, minSize);

      const laneOverrides = { ...(layout.laneOverrides ?? {}) };
      laneOverrides[resizeState.laneId] = { size: newSize };

      // 实时更新布局（视觉反馈）
      updateLayout({ laneOverrides }).catch(() => {});
    };

    const handleMouseUp = () => {
      setResizeState((prev) => ({ ...prev, active: false }));
      document.body.style.cursor = '';
    };

    // 拖拽期间设置 body 光标（确保在整个窗口范围内都能显示 resize 光标）
    document.body.style.cursor = resizeState.isHorizontal ? 'ns-resize' : 'ew-resize';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [resizeState, layout, updateLayout, nodeDims]);

  const startResize = useCallback(
    (laneId: string, laneType: 'participant' | 'custom', startPos: number, startSize: number, isHorizontalResize: boolean) => {
      setResizeState({
        active: true,
        laneId,
        laneType,
        startPos,
        startSize,
        isHorizontal: isHorizontalResize,
        zoom,
      });
    },
    [zoom],
  );

  if (!layout) return null;

  const { participantLanes, customLanes } = layout;
  const laneOverrides = layout.laneOverrides ?? {};

  const pLanes = participantLanes.map((l) => ({
    ...l,
    size: Math.max(MIN_LANE_SIZE, laneOverrides[l.participantId]?.size ?? l.size ?? DEFAULT_LANE_SIZE),
  }));
  const cLanes = customLanes.map((l) => ({
    ...l,
    size: Math.max(MIN_LANE_SIZE, laneOverrides[l.id]?.size ?? l.size ?? DEFAULT_LANE_SIZE),
  }));

  const totalCustomWidth = cLanes.reduce((sum, l) => sum + l.size, 0);
  const totalParticipantHeight = pLanes.reduce((sum, l) => sum + l.size, 0);
  const canvasWidth = Math.max(width, totalCustomWidth + LANE_HEADER_SIZE);
  const canvasHeight = Math.max(height, totalParticipantHeight + LANE_HEADER_SIZE);

  return (
    <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
      {/* Custom 泳道垂直分隔线（调整宽度）— 包括最后一个泳道的右边缘 */}
      {cLanes.reduce<{ acc: React.ReactNode[]; offset: number }>(
        ({ acc, offset }, lane) => {
          acc.push(
            <div
              key={`cresize-${lane.id}`}
              className="absolute hover:bg-blue-400/30"
              style={{
                left: LANE_HEADER_SIZE + offset + lane.size - 2,
                top: 0,
                width: 4,
                height: canvasHeight,
                cursor: 'ew-resize',
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                startResize(lane.id, 'custom', e.clientX, lane.size, false);
              }}
            />
          );
          return { acc, offset: offset + lane.size };
        },
        { acc: [], offset: 0 },
      ).acc}

      {/* Participant 泳道水平分隔线（调整行高）— 包括最后一个泳道的下边缘 */}
      {pLanes.reduce<{ acc: React.ReactNode[]; yOff: number }>(
        ({ acc, yOff }, lane) => {
          acc.push(
            <div
              key={`presize-${lane.participantId}`}
              className="absolute hover:bg-blue-400/30"
              style={{
                left: 0,
                top: LANE_HEADER_SIZE + yOff + lane.size - 2,
                width: canvasWidth,
                height: 4,
                cursor: 'ns-resize',
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                startResize(lane.participantId, 'participant', e.clientY, lane.size, true);
              }}
            />
          );
          return { acc, yOff: yOff + lane.size };
        },
        { acc: [], yOff: 0 },
      ).acc}
    </div>
  );
}
