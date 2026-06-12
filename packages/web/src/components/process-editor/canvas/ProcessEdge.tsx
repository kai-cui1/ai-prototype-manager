/**
 * @module ProcessEdge
 * @description 流程连线 — ReactFlow 自定义边。
 *
 * 交互设计 §3.5.4:
 * - 带箭头连线 + 条件标签 + 映射参数标签
 * - 选中：蓝色高亮 + 中点删除按钮
 * - 参数标签受 Canvas 设置「展示行为参数」控制
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
import type { EdgeMapping } from '@apm/shared';
import type { CrossingInfo } from './edgeCrossing';

interface BridgeArc {
  /** 弧形起点 x（crossX - r） */
  x1: number;
  /** 弧形终点 x（crossX + r） */
  x2: number;
  /** 水平线 y 坐标 */
  y: number;
  /** 弧顶控制点 x */
  cx: number;
  /** 弧顶控制点 y（向上 = y - 10） */
  cy: number;
}

/**
 * 将 SVG path 字符串中经过 (crossX, crossY) 的水平直线片段「挖空」：
 * 主路径在 crossX-r 处停下，用 M 跳到 crossX+r 继续，留出 gap；
 * 同时返回需要独立渲染的弧形信息，供外层 JSX 画弧形 <path>。
 *
 * 这样弧形和断口分离，弧形叠在 gap 上，视觉上没有残留直线。
 */
function cutBridgeInPath(
  path: string,
  crossX: number,
  crossY: number,
  r: number,
): { path: string; arc: BridgeArc | null } {
  const TOKEN_RE = /([MLHVQmlhvq])|(-?[\d.]+(?:e[+-]?[\d]+)?)/gi;
  type Token = { type: 'cmd'; val: string } | { type: 'num'; val: number };
  const tokens: Token[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(path)) !== null) {
    if (m[1]) tokens.push({ type: 'cmd', val: m[1].toUpperCase() });
    else tokens.push({ type: 'num', val: parseFloat(m[2]) });
  }

  let cx = 0, cy = 0;
  const out: string[] = [];
  let i = 0;
  let foundArc: BridgeArc | null = null;
  const EPS = 1.5;

  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.type !== 'cmd') { i++; continue; }
    const cmd = tok.val;
    i++;

    if (cmd === 'M') {
      const nx = (tokens[i] as { type: 'num'; val: number }).val;
      const ny = (tokens[i + 1] as { type: 'num'; val: number }).val;
      i += 2;
      out.push(`M ${nx} ${ny}`);
      cx = nx; cy = ny;
    } else if (cmd === 'L') {
      const nx = (tokens[i] as { type: 'num'; val: number }).val;
      const ny = (tokens[i + 1] as { type: 'num'; val: number }).val;
      i += 2;
      // 水平段且经过 crossY
      if (Math.abs(ny - crossY) < EPS && Math.abs(cy - crossY) < EPS) {
        const segMinX = Math.min(cx, nx);
        const segMaxX = Math.max(cx, nx);
        if (crossX - r > segMinX && crossX + r < segMaxX) {
          // 主路径：到 crossX-r 停，M 跳到 crossX+r 继续，留 gap
          out.push(`L ${crossX - r} ${ny}`);
          out.push(`M ${crossX + r} ${ny}`);
          out.push(`L ${nx} ${ny}`);
          if (!foundArc) {
            foundArc = { x1: crossX - r, x2: crossX + r, y: ny, cx: crossX, cy: ny - 10 };
          }
        } else {
          out.push(`L ${nx} ${ny}`);
        }
      } else {
        out.push(`L ${nx} ${ny}`);
      }
      cx = nx; cy = ny;
    } else if (cmd === 'H') {
      const nx = (tokens[i] as { type: 'num'; val: number }).val;
      i++;
      if (Math.abs(cy - crossY) < EPS) {
        const segMinX = Math.min(cx, nx);
        const segMaxX = Math.max(cx, nx);
        if (crossX - r > segMinX && crossX + r < segMaxX) {
          out.push(`L ${crossX - r} ${cy}`);
          out.push(`M ${crossX + r} ${cy}`);
          out.push(`L ${nx} ${cy}`);
          if (!foundArc) {
            foundArc = { x1: crossX - r, x2: crossX + r, y: cy, cx: crossX, cy: cy - 10 };
          }
        } else {
          out.push(`H ${nx}`);
        }
      } else {
        out.push(`H ${nx}`);
      }
      cx = nx;
    } else if (cmd === 'V') {
      const ny = (tokens[i] as { type: 'num'; val: number }).val;
      i++;
      out.push(`V ${ny}`);
      cy = ny;
    } else if (cmd === 'Q') {
      const qcx = (tokens[i] as { type: 'num'; val: number }).val;
      const qcy = (tokens[i + 1] as { type: 'num'; val: number }).val;
      const ex = (tokens[i + 2] as { type: 'num'; val: number }).val;
      const ey = (tokens[i + 3] as { type: 'num'; val: number }).val;
      i += 4;
      out.push(`Q ${qcx} ${qcy} ${ex} ${ey}`);
      cx = ex; cy = ey;
    } else {
      out.push(cmd);
    }
  }

  return { path: out.join(' '), arc: foundArc };
}

export interface ProcessEdgeData {
  label: string | null;
  condition: string | null;
  isSelected: boolean;
  hasError: boolean;
  crowdingIndex?: number;
  mappings?: EdgeMapping[];
  /** 连线参数标签文本（已解析为参数描述，描述为空时回退参数名称） */
  paramLabel?: string | null;
  /** 路径交叉点列表（由 ProcessCanvas 计算注入） */
  crossingPoints?: CrossingInfo[];
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
  const { selectEdge, deleteEdge, showBehaviorParams } = useProcessEditorContext();
  const [hovered, setHovered] = useState(false);

  const [rawEdgePath, labelX, labelY] = getSmoothStepPath({
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

  // 参数标签：从 paramLabel 获取已解析的参数描述文本
  const paramNames = showBehaviorParams ? (data?.paramLabel ?? null) : null;

  /**
   * 将交叉点注入路径：在交叉 x 处把直线挖空（留 gap），同时收集弧形信息。
   */
  function injectBridges(path: string, crossings: CrossingInfo[]): { path: string; arcs: BridgeArc[] } {
    if (!crossings || crossings.length === 0) return { path, arcs: [] };

    const sorted = [...crossings].sort((a, b) => b.point.x - a.point.x);
    const arcs: BridgeArc[] = [];
    let result = path;
    for (const cp of sorted) {
      const { x, y } = cp.point;
      const r = 6;
      const { path: newPath, arc } = cutBridgeInPath(result, x, y, r);
      result = newPath;
      if (arc) arcs.push(arc);
    }
    return { path: result, arcs };
  }

  const { path: edgePath, arcs: bridgeArcs } = injectBridges(rawEdgePath, data?.crossingPoints ?? []);

  // 旧的 crowdingIndex 跳线（端点汇合时）：保持不变，仍在中点显示
  const showBridge = crowdingIndex > 0;
  const bridgePath = showBridge
    ? `M ${labelX - 6} ${labelY} Q ${labelX} ${labelY - 10} ${labelX + 6} ${labelY}`
    : '';

  // 标签偏移：有参数标签时，上方标签上移更多
  const labelOffsetY = paramNames ? -8 : 0;
  const paramOffsetY = displayLabel ? 10 : 0;

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
      {/* 注意：必须用 rawEdgePath（原始路径），不能用 edgePath（含 gap）*/}
      {/* ProcessCanvas 读取此层做交叉检测，若用带 gap 的路径会导致交叉点漏检 */}
      <path
        d={rawEdgePath}
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

      {/* 跳线（端点汇合重合时显示） */}
      {showBridge && (
        <path
          d={bridgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={isHighlighted ? 2.5 : 1.5}
        />
      )}
      
      {/* 路径交叉跳线：先画白色背景防透，再画弧形本色 */}
      {bridgeArcs.map((arc, i) => (
        <g key={`bridge-${i}`}>
          {/* 白色背景：遮住 gap 内可能穿越的其他边线 */}
          <path
            d={`M ${arc.x1} ${arc.y} Q ${arc.cx} ${arc.cy} ${arc.x2} ${arc.y}`}
            fill="none"
            stroke="white"
            strokeWidth={(isHighlighted ? 2.5 : 1.5) + 3}
          />
          {/* 弧形本色 */}
          <path
            d={`M ${arc.x1} ${arc.y} Q ${arc.cx} ${arc.cy} ${arc.x2} ${arc.y}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={isHighlighted ? 2.5 : 1.5}
          />
        </g>
      ))}

      {/* 上方标签（label / condition） */}
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute pointer-events-auto"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + labelOffsetY}px)`,
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

      {/* 下方参数标签（映射的 source 参数名） */}
      {paramNames && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + paramOffsetY}px)`,
              fontSize: 9,
            }}
          >
            <span
              className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-mono text-gray-500"
            >
              {paramNames}
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
