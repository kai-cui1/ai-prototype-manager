/**
 * @module SwimlaneBackground
 * @description 泳道背景层 — DOM div 实现，位于 ReactFlow 画布下层（z-index 更低）。
 *
 * 交互设计 §3.5.1:
 * - 根据 layout.participantLanes / customLanes 渲染泳道行/列
 * - 固定横向布局：Participant 为行，Custom 为列
 */

import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import type { ParticipantLane, CustomLane } from '@apm/shared';
import { cn } from '@/lib/utils';
import { getLaneColor } from './lane-palette';

/** 默认泳道尺寸 */
const DEFAULT_LANE_SIZE = 200;
const LANE_HEADER_SIZE = 32;
/** 泳道绝对最小尺寸（无节点时的底线） */
const MIN_LANE_SIZE = 100;

interface SwimlaneBackgroundProps {
  /** 画布容器尺寸 */
  width: number;
  height: number;
}

export default function SwimlaneBackground({ width, height }: SwimlaneBackgroundProps) {
  const { layout } = useProcessEditorContext();

  if (!layout) return null;

  const { participantLanes, customLanes } = layout;

  // 计算每个泳道的实际尺寸（统一用 getEffectiveSize 逻辑）
  const laneOverrides = layout.laneOverrides ?? {};
  const pLanes = participantLanes.map((l) => ({
    ...l,
    size: Math.max(MIN_LANE_SIZE, laneOverrides[l.participantId]?.size ?? l.size ?? DEFAULT_LANE_SIZE),
  }));
  const cLanes = customLanes.map((l) => ({
    ...l,
    size: Math.max(MIN_LANE_SIZE, laneOverrides[l.id]?.size ?? l.size ?? DEFAULT_LANE_SIZE),
  }));

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <HorizontalLanes
        pLanes={pLanes}
        cLanes={cLanes}
        width={width}
        height={height}
      />
    </div>
  );
}

// ============================================================
// Participant 横向排列（默认）
// ============================================================

function HorizontalLanes({
  pLanes,
  cLanes,
  width,
  height,
}: {
  pLanes: ParticipantLane[];
  cLanes: CustomLane[];
  width: number;
  height: number;
}) {
  const totalCustomWidth = cLanes.reduce((sum, l) => sum + l.size, 0);
  const totalParticipantHeight = pLanes.reduce((sum, l) => sum + l.size, 0);
  const canvasWidth = Math.max(width, totalCustomWidth + LANE_HEADER_SIZE);
  const canvasHeight = Math.max(height, totalParticipantHeight + LANE_HEADER_SIZE);

  return (
    <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
      {/* 左上角空白区 */}
      <div
        className="absolute bg-gray-50 border-b border-r border-gray-200"
        style={{ left: 0, top: 0, width: LANE_HEADER_SIZE, height: LANE_HEADER_SIZE }}
      />

      {/* 自定义泳道列标题 — 按列索引着色 */}
      {cLanes.reduce<{ acc: React.ReactNode[]; offset: number }>(
        ({ acc, offset }, lane, idx) => {
          const color = getLaneColor(idx);
          acc.push(
            <div
              key={`ch-${lane.id}`}
              className={cn(
                'absolute flex items-center justify-center text-xs font-bold border-b border-r border-gray-200',
                color.headerBg,
                color.headerText,
              )}
              style={{
                left: LANE_HEADER_SIZE + offset,
                top: 0,
                width: lane.size,
                height: LANE_HEADER_SIZE,
              }}
            >
              {lane.label}
            </div>
          );
          return { acc, offset: offset + lane.size };
        },
        { acc: [], offset: 0 },
      ).acc}

      {/* 泳道格子 — 按 Participant 行着色 */}
      {pLanes.reduce<{ acc: React.ReactNode[]; yOff: number }>(
        ({ acc, yOff }, pLane, pIdx) => {
          const pColor = getLaneColor(pIdx);
          cLanes.reduce<{ inner: React.ReactNode[]; xOff: number }>(
            ({ inner, xOff }, cLane) => {
              inner.push(
                <div
                  key={`cell-${pLane.participantId}-${cLane.id}`}
                  className="absolute border-b border-r border-gray-200"
                  style={{
                    left: LANE_HEADER_SIZE + xOff,
                    top: LANE_HEADER_SIZE + yOff,
                    width: cLane.size,
                    height: pLane.size,
                    backgroundColor: pColor.cellBg,
                  }}
                />
              );
              return { inner, xOff: xOff + cLane.size };
            },
            { inner: [], xOff: 0 },
          ).inner.forEach((el) => acc.push(el));
          return { acc, yOff: yOff + pLane.size };
        },
        { acc: [], yOff: 0 },
      ).acc}
    </div>
  );
}

// ============================================================
// Participant 纵向排列（对调后）
// ============================================================

function VerticalLanes({
  pLanes,
  cLanes,
  width,
  height,
}: {
  pLanes: ParticipantLane[];
  cLanes: CustomLane[];
  width: number;
  height: number;
}) {
  const totalCustomHeight = cLanes.reduce((sum, l) => sum + l.size, 0);
  const totalParticipantWidth = pLanes.reduce((sum, l) => sum + l.size, 0);
  const canvasWidth = Math.max(width, totalParticipantWidth + LANE_HEADER_SIZE);
  const canvasHeight = Math.max(height, totalCustomHeight + LANE_HEADER_SIZE);

  return (
    <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
      {/* 左上角空白区 */}
      <div
        className="absolute bg-gray-50 border-b border-r border-gray-200"
        style={{ left: 0, top: 0, width: LANE_HEADER_SIZE, height: LANE_HEADER_SIZE }}
      />

      {/* Participant 泳道列标题（对调后是列） */}
      {pLanes.reduce<{ acc: React.ReactNode[]; offset: number }>(
        ({ acc, offset }, lane) => {
          acc.push(
            <div
              key={`pv-${lane.participantId}`}
              className="absolute flex items-center justify-center text-xs text-muted-foreground font-medium bg-gray-50 border-b border-r border-gray-200"
              style={{
                left: LANE_HEADER_SIZE + offset,
                top: 0,
                width: lane.size,
                height: LANE_HEADER_SIZE,
              }}
            >
              {lane.label}
            </div>
          );
          return { acc, offset: offset + lane.size };
        },
        { acc: [], offset: 0 },
      ).acc}

      {/* 自定义泳道行标题（对调后是行） */}
      {cLanes.reduce<{ acc: React.ReactNode[]; offset: number }>(
        ({ acc, offset }, lane) => {
          acc.push(
            <div
              key={`cv-${lane.id}`}
              className="absolute flex items-center justify-center text-xs text-muted-foreground font-medium bg-gray-50 border-b border-r border-gray-200"
              style={{
                left: 0,
                top: LANE_HEADER_SIZE + offset,
                width: LANE_HEADER_SIZE,
                height: lane.size,
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
              }}
            >
              {lane.label}
            </div>
          );
          return { acc, offset: offset + lane.size };
        },
        { acc: [], offset: 0 },
      ).acc}

      {/* 泳道格子 */}
      {cLanes.reduce<{ acc: React.ReactNode[]; yOff: number }>(
        ({ acc, yOff }, cLane) => {
          pLanes.reduce<{ inner: React.ReactNode[]; xOff: number }>(
            ({ inner, xOff }, pLane) => {
              const isEvenC = cLanes.indexOf(cLane) % 2 === 0;
              const isEvenP = pLanes.indexOf(pLane) % 2 === 0;
              const isAlt = isEvenC !== isEvenP;
              inner.push(
                <div
                  key={`cell-v-${pLane.participantId}-${cLane.id}`}
                  className={cn(
                    'absolute border-b border-r border-gray-200',
                    isAlt ? 'bg-white' : 'bg-gray-50/50',
                  )}
                  style={{
                    left: LANE_HEADER_SIZE + xOff,
                    top: LANE_HEADER_SIZE + yOff,
                    width: pLane.size,
                    height: cLane.size,
                  }}
                />
              );
              return { inner, xOff: xOff + pLane.size };
            },
            { inner: [], xOff: 0 },
          ).inner.forEach((el) => acc.push(el));
          return { acc, yOff: yOff + cLane.size };
        },
        { acc: [], yOff: 0 },
      ).acc}
    </div>
  );
}
