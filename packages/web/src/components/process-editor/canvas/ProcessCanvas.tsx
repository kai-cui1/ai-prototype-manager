/**
 * @module ProcessCanvas
 * @description 流程编辑器主画布 — ReactFlow 容器 + 泳道背景层。
 *
 * 交互设计 §3.5:
 * - ReactFlow 容器，内嵌 SwimlaneBackground
 * - 自定义节点类型注册（ActionNode / DecisionNode）
 * - 自定义边类型注册（ProcessEdge）
 * - 连线交互：onConnect → 创建边
 * - 节点拖拽结束：更新布局 nodePositions
 * - 空画布状态引导
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  Position,
  getSmoothStepPath,
  type Node,
  type Edge,
  type OnConnect,
  type Connection,
} from '@xyflow/react';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import '@xyflow/react/dist/style.css';

import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import type { ActionNodeData, InputSatisfactionStatus } from './ActionNode';
import type { DecisionNodeData } from './DecisionNode';
import type { ProcessEdgeData } from './ProcessEdge';
import { computeEdgeCrossings, parseOrthogonalSegments } from './edgeCrossing';

/** handle id → ReactFlow Position 枚举 */
function handleIdToPosition(handleId: string | undefined, isSource: boolean): Position {
  switch (handleId) {
    case 'top':    return Position.Top;
    case 'bottom': return Position.Bottom;
    case 'left':   return Position.Left;
    case 'right':  return Position.Right;
    default:       return isSource ? Position.Bottom : Position.Top;
  }
}
import SwimlaneBackground from './SwimlaneBackground';
import SwimlaneResizeHandles from './SwimlaneResizeHandles';
import { getLaneColor } from './lane-palette';
import { cn } from '@/lib/utils';
import SelectBehaviorDialog from '../dialogs/SelectBehaviorDialog';
import BranchSelectDialog from '../dialogs/BranchSelectDialog';
import { apiClient } from '@/lib/api-client';
import type { ParticipantLane } from '@apm/shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// 注册自定义节点/边类型
import ActionNodeComponent from './ActionNode';
import DecisionNodeComponent from './DecisionNode';
import ProcessEdgeComponent from './ProcessEdge';

const nodeTypes = { action: ActionNodeComponent, decision: DecisionNodeComponent };
const edgeTypes = { process: ProcessEdgeComponent };

const HEADER = 32;
const MIN_LANE_SIZE = 100;
const DEFAULT_LANE_SIZE = 200;
/** 默认 Participant 泳道行高（创建时使用，后续可调整） */
const DEFAULT_PARTICIPANT_LANE_HEIGHT = 200;

/** 计算 Action/Decision 节点的输入满足状态 */
function computeInputSatisfaction(
  nodeId: string,
  nodeType: string,
  holderType: string,
  holderId: string,
  actionRef: string | null,
  decisionRef: string | null,
  edges: Array<{ sourceNodeId: string; targetNodeId: string; mappings: Array<{ sourceField: string; targetField: string }> }>,
  actionCache: Record<string, Array<{ name: string; inputs?: Array<{ name: string; type: string; required?: boolean; defaultValue?: unknown }> }>>,
  decisionCache: Record<string, Array<{ name: string; inputs?: Array<{ name: string; type: string; required?: boolean; defaultValue?: unknown }> }>>,
): InputSatisfactionStatus {
  const key = `${holderType}:${holderId}`;

  // 根据节点类型选择缓存和 ref
  const cache = nodeType === 'decision' ? decisionCache : actionCache;
  const ref = nodeType === 'decision' ? decisionRef : actionRef;
  if (!ref) return 'none';

  const items = cache[key];
  if (!items) return 'none'; // 缓存未加载

  const item = items.find((a) => a.name === ref);
  if (!item?.inputs || item.inputs.length === 0) return 'none'; // 无输入参数

  const requiredInputs = item.inputs.filter((i) => i.required);
  if (requiredInputs.length === 0) return 'satisfied'; // 无必填输入

  // 收集该节点所有入边的映射 target 字段
  const inEdges = edges.filter((e) => e.targetNodeId === nodeId);
  const mappedTargets = new Set<string>();
  for (const edge of inEdges) {
    for (const m of edge.mappings) {
      mappedTargets.add(m.targetField);
    }
  }

  // 检查每个 required 输入是否被映射或有 defaultValue
  let satisfiedCount = 0;
  for (const inp of requiredInputs) {
    if (mappedTargets.has(inp.name) || inp.defaultValue !== undefined) {
      satisfiedCount++;
    }
  }

  if (satisfiedCount === requiredInputs.length) return 'satisfied';
  if (satisfiedCount > 0) return 'partial';
  return 'unsatisfied';
}

/** 从 layout 读取有效的泳道尺寸（应用 laneOverrides + MIN_LANE_SIZE） */
function getEffectiveSize(
  lane: { size?: number; id?: string; participantId?: string },
  overrides: Record<string, { size?: number }>,
): number {
  const key = lane.participantId ?? lane.id ?? '';
  return Math.max(MIN_LANE_SIZE, overrides[key]?.size ?? lane.size ?? DEFAULT_LANE_SIZE);
}

/** 计算内容边界尺寸 */
function computeContentBounds(layout: {
  participantLanes: { size?: number; participantId?: string }[];
  customLanes: { size?: number; id?: string }[];
  laneOverrides?: Record<string, { size?: number }>;
} | null) {
  if (!layout) return { width: 0, height: 0 };
  const overrides = layout.laneOverrides ?? {};
  const totalCustomWidth = layout.customLanes.reduce(
    (sum, l) => sum + getEffectiveSize(l, overrides),
    0,
  );
  const totalParticipantHeight = layout.participantLanes.reduce(
    (sum, l) => sum + getEffectiveSize(l, overrides),
    0,
  );
  return {
    width: Math.max(totalCustomWidth + HEADER, 0),
    height: Math.max(totalParticipantHeight + HEADER, 0),
  };
}

/** 将 viewport clamp 到内容边界内 */
function clampViewport(
  v: { x: number; y: number; zoom: number },
  contentBounds: { width: number; height: number },
  containerSize: { width: number; height: number },
) {
  const zoom = v.zoom;
  const contentW = contentBounds.width * zoom;
  const contentH = contentBounds.height * zoom;
  const cw = containerSize.width;
  const ch = containerSize.height;

  let x = v.x;
  let y = v.y;

  // 左/上边界：不能看到画布左侧/上方的空白
  if (x > 0) x = 0;
  if (y > 0) y = 0;

  // 右边界
  if (contentW > cw) {
    const minX = cw - contentW;
    if (x < minX) x = minX;
  } else {
    x = 0;
  }

  // 下边界
  if (contentH > ch) {
    const minY = ch - contentH;
    if (y < minY) y = minY;
  } else {
    y = 0;
  }

  return { x, y, zoom };
}

/** 根据 layout.nodePositions 计算节点画布坐标 */
function getNodePosition(
  nodeId: string,
  nodePositions: Record<string, { participantLaneIndex: number; customLaneIndex: number; offsetX: number; offsetY: number }>,
  layout: {
    participantLanes: { size?: number; participantId?: string }[];
    customLanes: { size?: number; id?: string }[];
    laneOverrides?: Record<string, { size?: number }>;
  } | null,
): { x: number; y: number } {
  const pos = nodePositions[nodeId];
  if (!pos || !layout) return { x: 100, y: 100 };

  const bounds = getLaneBounds(pos.participantLaneIndex, pos.customLaneIndex, layout);
  return { x: bounds.x + pos.offsetX, y: bounds.y + pos.offsetY };
}

/** 获取泳道交叉格子的边界 {x, y, width, height} */
function getLaneBounds(
  participantLaneIndex: number,
  customLaneIndex: number,
  layout: {
    participantLanes: { size?: number; participantId?: string }[];
    customLanes: { size?: number; id?: string }[];
    laneOverrides?: Record<string, { size?: number }>;
  },
): { x: number; y: number; width: number; height: number } {
  const overrides = layout.laneOverrides ?? {};
  let x = HEADER;
  let y = HEADER;
  for (let i = 0; i < customLaneIndex && i < layout.customLanes.length; i++) {
    x += getEffectiveSize(layout.customLanes[i], overrides);
  }
  for (let i = 0; i < participantLaneIndex && i < layout.participantLanes.length; i++) {
    y += getEffectiveSize(layout.participantLanes[i], overrides);
  }
  const cLane = layout.customLanes[customLaneIndex];
  const pLane = layout.participantLanes[participantLaneIndex];
  const width = cLane ? getEffectiveSize(cLane, overrides) : DEFAULT_LANE_SIZE;
  const height = pLane ? getEffectiveSize(pLane, overrides) : DEFAULT_LANE_SIZE;
  return { x, y, width, height };
}

/** 根据 Y 坐标计算属于哪个 participantLaneIndex */
function getParticipantLaneIndexFromY(
  y: number,
  layout: {
    participantLanes: { size?: number; participantId?: string }[];
    laneOverrides?: Record<string, { size?: number }>;
  },
): number {
  const overrides = layout.laneOverrides ?? {};
  let cumY = HEADER;
  for (let i = 0; i < layout.participantLanes.length; i++) {
    const laneEnd = cumY + getEffectiveSize(layout.participantLanes[i], overrides);
    if (y < laneEnd) return i;
    cumY = laneEnd;
  }
  return Math.max(0, layout.participantLanes.length - 1);
}

/** 根据 X 坐标计算属于哪个 customLaneIndex */
function getCustomLaneIndexFromX(
  x: number,
  layout: {
    customLanes: { size?: number; id?: string }[];
    laneOverrides?: Record<string, { size?: number }>;
  },
): number {
  const overrides = layout.laneOverrides ?? {};
  let cumX = HEADER;
  for (let i = 0; i < layout.customLanes.length; i++) {
    const laneEnd = cumX + getEffectiveSize(layout.customLanes[i], overrides);
    if (x < laneEnd) return i;
    cumX = laneEnd;
  }
  return Math.max(0, layout.customLanes.length - 1);
}

// ---- 行为定义缓存类型（用于输入满足状态 + 连线参数描述） ----
type ActionCacheItem = {
  name: string;
  inputs?: Array<{ name: string; type: string; required?: boolean; defaultValue?: unknown }>;
  outputs?: Array<{ name: string; type: string; description?: string }>;
};
type DecisionCacheItem = {
  name: string;
  inputs?: Array<{ name: string; type: string; required?: boolean; defaultValue?: unknown }>;
  outputs?: Array<{ name: string; type: string; description?: string }>;
  branches?: Array<{ name: string; outputs?: Array<{ name: string; type: string; description?: string }> }>;
};

/** 根据缓存解析连线参数描述标签 */
function resolveParamLabel(
  sourceNodeId: string,
  processNodes: Array<{ id: string; nodeType: string; holderType: string; holderId: string; actionRef: string | null; decisionRef: string | null }>,
  edgeLabel: string | null,
  mappings: Array<{ sourceField: string; targetField: string }> | undefined,
  actionCache: Record<string, ActionCacheItem[]>,
  decisionCache: Record<string, DecisionCacheItem[]>,
): string | null {
  if (!mappings || mappings.length === 0) return null;
  const sourceNode = processNodes.find((n) => n.id === sourceNodeId);
  if (!sourceNode) return null;
  const holderKey = `${sourceNode.holderType}:${sourceNode.holderId}`;

  // 收集可查找的 outputs 定义
  let outputDefs: Array<{ name: string; description?: string }> = [];
  if (sourceNode.nodeType === 'action' && sourceNode.actionRef) {
    const items = actionCache[holderKey];
    const action = items?.find((a) => a.name === sourceNode.actionRef);
    outputDefs = action?.outputs ?? [];
  } else if (sourceNode.nodeType === 'decision' && sourceNode.decisionRef) {
    const items = decisionCache[holderKey];
    const decision = items?.find((d) => d.name === sourceNode.decisionRef);
    if (decision?.branches && edgeLabel) {
      // 根据 edge.label（分支名）定位 branch 的 outputs
      const branch = decision.branches.find((b) => b.name === edgeLabel);
      outputDefs = branch?.outputs ?? [];
    } else {
      // 无 label 时回退到 decision 顶层 outputs
      outputDefs = decision?.outputs ?? [];
    }
  }

  if (outputDefs.length === 0) return null;

  // 去重：按 sourceField 查找描述，描述为空回退名称
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const m of mappings) {
    if (seen.has(m.sourceField)) continue;
    seen.add(m.sourceField);
    const def = outputDefs.find((o) => o.name === m.sourceField);
    labels.push(def?.description?.trim() || m.sourceField);
  }
  return labels.length > 0 ? labels.join(', ') : null;
}

// ============================================================
// 动态 Handle 选择：根据节点相对位置自动计算最优连接方向
// ============================================================

/** Action/Decision 节点的可用 handle 集合 */
const SOURCE_HANDLES = ['bottom', 'right'] as const;
const TARGET_HANDLES = ['top', 'left'] as const;

/** 根据源/目标节点相对位置，选择最优 Handle 方向 */
function computeOptimalHandles(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number },
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { sourceHandle: string; targetHandle: string } {
  // 两节点中心坐标
  const sourceCenter = {
    x: sourcePos.x + sourceWidth / 2,
    y: sourcePos.y + sourceHeight / 2,
  };
  const targetCenter = {
    x: targetPos.x + targetWidth / 2,
    y: targetPos.y + targetHeight / 2,
  };

  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  // 水平方向优先：source 从 right 出，target 从 left 入
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { sourceHandle: 'right', targetHandle: 'left' };
  }

  // 垂直方向为主：source 从 bottom 出，target 从 top 入
  return { sourceHandle: 'bottom', targetHandle: 'top' };
}

export default function ProcessCanvas() {
  const {
    nodes: processNodes,
    edges: processEdges,
    layout,
    selectedNodeId,
    selectedEdgeId,
    validationErrors,
    rfInstanceRef,
    createEdge,
    updateEdge,
    updateNode,
    updateLayout,
    selectNode,
    selectEdge,
    markDirty,
    projectId,
  } = useProcessEditorContext();

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  /** 节点拖拽中标记 — 拖拽节点时跳过 viewport clamp，避免干扰 ReactFlow 内部坐标计算 */
  const isDraggingNodeRef = useRef(false);
  /** 上一次交叉检测结果缓存，用于去重避免循环 */
  const lastCrossingsRef = useRef<string>('');

  const behaviorCacheRef = useRef<Record<string, ActionCacheItem[]>>({});
  const decisionCacheRef = useRef<Record<string, DecisionCacheItem[]>>({});

  // 异步加载所有 holder 的行为定义（缓存）
  useEffect(() => {
    if (!projectId || processNodes.length === 0) return;
    const holders = new Set<string>();
    for (const n of processNodes) {
      if (n.actionRef || n.decisionRef) {
        holders.add(`${n.holderType}:${n.holderId}`);
      }
    }
    let cancelled = false;
    const actionCache = behaviorCacheRef.current;
    const decisionCache = decisionCacheRef.current;
    Promise.all(
      [...holders].map(async (key) => {
        const [holderType, holderId] = key.split(':');
        const basePath =
          holderType === 'role'
            ? `/projects/${projectId}/roles/${holderId}`
            : holderType === 'service'
              ? `/projects/${projectId}/applications/${holderId}`
              : `/projects/${projectId}/external-entities/${holderId}`;
        try {
          const [actionsRes, decisionsRes] = await Promise.all([
            actionCache[key]
              ? Promise.resolve(null)
              : apiClient.get<{ data: { items: ActionCacheItem[] } }>(`${basePath}/actions`),
            decisionCache[key]
              ? Promise.resolve(null)
              : apiClient.get<{ data: { items: DecisionCacheItem[] } }>(`${basePath}/decisions`),
          ]);
          if (!cancelled) {
            if (actionsRes) actionCache[key] = actionsRes.data.data?.items ?? [];
            if (decisionsRes) decisionCache[key] = decisionsRes.data.data?.items ?? [];
          }
        } catch {
          // 忽略失败
        }
      }),
    ).then(() => {
      if (!cancelled) {
        // 触发重新计算节点状态（Action + Decision）
        setRfNodes((prev) => {
          const updated = prev.map((n) => {
            const pn = processNodes.find((p) => p.id === n.id);
            if (!pn) return n;
            if (n.type === 'action' && pn.actionRef) {
              const status = computeInputSatisfaction(pn.id, pn.nodeType, pn.holderType, pn.holderId, pn.actionRef, null, processEdges, actionCache, decisionCache);
              return { ...n, data: { ...n.data, inputSatisfaction: status } };
            }
            if (n.type === 'decision' && pn.decisionRef) {
              const status = computeInputSatisfaction(pn.id, pn.nodeType, pn.holderType, pn.holderId, null, pn.decisionRef, processEdges, actionCache, decisionCache);
              return { ...n, data: { ...n.data, inputSatisfaction: status } };
            }
            return n;
          });
          return updated;
        });

        // 缓存就绪后同步更新 edge 的 paramLabel
        setRfEdges((prev) => prev.map((e) => {
          const pe = processEdges.find((p) => p.id === e.id);
          if (!pe) return e;
          const paramLabel = resolveParamLabel(
            pe.sourceNodeId, processNodes, pe.label, pe.mappings,
            actionCache, decisionCache,
          );
          return { ...e, data: { ...e.data, paramLabel } };
        }));
      }
    });
    return () => { cancelled = true; };
  }, [projectId, processNodes, processEdges, setRfNodes, setRfEdges]);

  // ---- DnD 状态 ----
  const [dndState, setDndState] = useState<{
    nodeType: 'action' | 'decision';
    participantLane: ParticipantLane;
    participantLaneIndex: number;
    customLaneIndex: number;
  } | null>(null);

  // ---- 跨泳道 holder 变更确认 Dialog ----
  const [holderChangeDialog, setHolderChangeDialog] = useState<{
    open: boolean;
    nodeId: string;
    currentLaneLabel: string;
    targetLane: ParticipantLane;
    targetParticipantLaneIndex: number;
    targetCustomLaneIndex: number;
    newOffsetX: number;
    newOffsetY: number;
  }>({
    open: false,
    nodeId: '',
    currentLaneLabel: '',
    targetLane: { participantId: '', participantType: 'role', label: '', order: 0, size: 200 },
    targetParticipantLaneIndex: 0,
    targetCustomLaneIndex: 0,
    newOffsetX: 0,
    newOffsetY: 0,
  });

  // ---- Decision 分支选择 Dialog ----
  const [branchDialog, setBranchDialog] = useState<{
    open: boolean;
    branches: Array<{ name: string; condition?: string }>;
    decisionDisplayName: string;
    pendingConnection: Connection | null;
  }>({
    open: false,
    branches: [],
    decisionDisplayName: '',
    pendingConnection: null,
  });

  // 观测容器尺寸
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 构建 errorNodeId / errorEdgeId 集合
  const errorNodeIds = useMemo(() => {
    const set = new Set<string>();
    for (const err of validationErrors) {
      if (err.nodeId) set.add(err.nodeId);
    }
    return set;
  }, [validationErrors]);

  const errorEdgeIds = useMemo(() => {
    const set = new Set<string>();
    for (const err of validationErrors) {
      if (err.edgeId) set.add(err.edgeId);
    }
    return set;
  }, [validationErrors]);

  // 同步 processNodes → ReactFlow nodes
  useEffect(() => {
    const newNodes: Node[] = processNodes.map((pn) => {
      const pos = layout?.nodePositions
        ? getNodePosition(pn.id, layout.nodePositions, layout as never)
        : { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 };

      if (pn.nodeType === 'action') {
        const inputSatisfaction = computeInputSatisfaction(pn.id, pn.nodeType, pn.holderType, pn.holderId, pn.actionRef, null, processEdges, behaviorCacheRef.current, decisionCacheRef.current);
        return {
          id: pn.id,
          type: 'action',
          position: pos,
          style: { width: 160, height: 56 },
          data: {
            nodeId: pn.id,
            displayName: pn.displayName,
            isSelected: selectedNodeId === pn.id,
            hasError: errorNodeIds.has(pn.id),
            inputSatisfaction,
          } satisfies ActionNodeData,
        };
      } else {
        const inputSatisfaction = computeInputSatisfaction(pn.id, pn.nodeType, pn.holderType, pn.holderId, null, pn.decisionRef, processEdges, behaviorCacheRef.current, decisionCacheRef.current);
        return {
          id: pn.id,
          type: 'decision',
          position: pos,
          style: { width: 120, height: 120 },
          data: {
            nodeId: pn.id,
            displayName: pn.displayName,
            isSelected: selectedNodeId === pn.id,
            hasError: errorNodeIds.has(pn.id),
            inputSatisfaction,
          } satisfies DecisionNodeData,
        };
      }
    });

    setRfNodes(newNodes);
  }, [processNodes, processEdges, layout, selectedNodeId, errorNodeIds, setRfNodes]);

  // 同步 processEdges → ReactFlow edges
  useEffect(() => {
    // 计算 crowdingIndex：共享相同 source 或 target 的边需要跳线区分
    const sourceIndexMap: Record<string, number> = {};
    const targetIndexMap: Record<string, number> = {};
    const edgeSourceIndex: Record<string, number> = {};
    const edgeTargetIndex: Record<string, number> = {};

    for (const pe of processEdges) {
      edgeSourceIndex[pe.id] = sourceIndexMap[pe.sourceNodeId] ?? 0;
      sourceIndexMap[pe.sourceNodeId] = (sourceIndexMap[pe.sourceNodeId] ?? 0) + 1;
      edgeTargetIndex[pe.id] = targetIndexMap[pe.targetNodeId] ?? 0;
      targetIndexMap[pe.targetNodeId] = (targetIndexMap[pe.targetNodeId] ?? 0) + 1;
    }

    setRfEdges((prevEdges) => {
      // 构建旧边 crossingPoints 的查找表，避免选中/取消选中时丢失已计算的跳线
      const prevCrossingMap = new Map<string, ProcessEdgeData['crossingPoints']>();
      for (const pe of prevEdges) {
        const d = pe.data as unknown as ProcessEdgeData;
        if (d?.crossingPoints?.length) {
          prevCrossingMap.set(pe.id, d.crossingPoints);
        }
      }

      return processEdges.map((pe) => ({
        id: pe.id,
        source: pe.sourceNodeId,
        target: pe.targetNodeId,
        sourceHandle: pe.sourceHandle ?? undefined,
        targetHandle: pe.targetHandle ?? undefined,
        type: 'process',
        data: {
          label: pe.label,
          condition: pe.condition,
          mappings: pe.mappings,
          paramLabel: resolveParamLabel(
            pe.sourceNodeId, processNodes, pe.label, pe.mappings,
            behaviorCacheRef.current, decisionCacheRef.current,
          ),
          isSelected: selectedEdgeId === pe.id,
          hasError: errorEdgeIds.has(pe.id),
          crowdingIndex: Math.max(edgeSourceIndex[pe.id] ?? 0, edgeTargetIndex[pe.id] ?? 0),
          // 保留已计算的跳线交叉点，避免选中/取消选中时重绘导致跳线丢失
          crossingPoints: prevCrossingMap.get(pe.id),
        } satisfies ProcessEdgeData,
      }));
    });
  }, [processEdges, selectedEdgeId, errorEdgeIds, setRfEdges]);

  /** 手动触发一次交叉检测（节点拖拽后路径变化但 processEdges 未变时使用） */
  const triggerCrossingDetection = useCallback(() => {
    const timer = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const edgeSegments: Array<{ id: string; segments: ReturnType<typeof parseOrthogonalSegments> }> = [];
      container.querySelectorAll<SVGGElement>('.react-flow__edge').forEach((edgeEl) => {
        const edgeId = edgeEl.getAttribute('data-id');
        if (!edgeId) return;
        // 读 interaction 层（原始路径，不含跳线 gap），避免上一轮注入的 M 断口干扰检测
        const pathEl = edgeEl.querySelector<SVGPathElement>('.react-flow__edge-interaction');
        if (!pathEl) return;
        const d = pathEl.getAttribute('d');
        if (!d) return;
        edgeSegments.push({ id: edgeId, segments: parseOrthogonalSegments(d) });
      });
      if (edgeSegments.length < 2) return;
      const crossings = computeEdgeCrossings(edgeSegments);
      const crossingsKey = JSON.stringify(crossings);
      if (crossingsKey === lastCrossingsRef.current) return;
      lastCrossingsRef.current = crossingsKey;
      setRfEdges((prev) =>
        prev.map((e) => {
          const points = crossings[e.id] ?? [];
          const edgeData = e.data as unknown as ProcessEdgeData;
          const existing = edgeData?.crossingPoints ?? [];
          if (JSON.stringify(existing) === JSON.stringify(points)) return e;
          return { ...e, data: { ...e.data, crossingPoints: points } };
        }),
      );
    }, 100);
    return timer;
  }, [containerRef, setRfEdges]);

  // 路径交叉检测：
  // - 依赖 processEdges（拓扑）触发，用 setTimeout 延迟一帧等 ReactFlow 渲染完成后读 DOM
  // - 用 lastCrossingsRef 缓存上次结果，只在结果真正变化时才 setRfEdges，彻底断开循环
  useEffect(() => {
    if (processEdges.length < 2) return;

    const timer = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;

      const edgeSegments: Array<{ id: string; segments: ReturnType<typeof parseOrthogonalSegments> }> = [];

      // 读 interaction 层（原始路径，不含跳线 gap），避免上一轮注入的 M 断口干扰检测
      const edgeEls = container.querySelectorAll<SVGGElement>('.react-flow__edge');
      edgeEls.forEach((edgeEl) => {
        const edgeId = edgeEl.getAttribute('data-id');
        if (!edgeId) return;
        const pathEl = edgeEl.querySelector<SVGPathElement>('.react-flow__edge-interaction');
        if (!pathEl) return;
        const d = pathEl.getAttribute('d');
        if (!d) return;
        edgeSegments.push({ id: edgeId, segments: parseOrthogonalSegments(d) });
      });

      if (edgeSegments.length < 2) return;

      const crossings = computeEdgeCrossings(edgeSegments);
      const crossingsKey = JSON.stringify(crossings);

      // 结果未变化则跳过，防止无意义的 setRfEdges
      if (crossingsKey === lastCrossingsRef.current) return;
      lastCrossingsRef.current = crossingsKey;

      setRfEdges((prev) =>
        prev.map((e) => {
          const points = crossings[e.id] ?? [];
          const edgeData = e.data as unknown as ProcessEdgeData;
          const existing = edgeData?.crossingPoints ?? [];
          if (JSON.stringify(existing) === JSON.stringify(points)) return e;
          return { ...e, data: { ...e.data, crossingPoints: points } };
        }),
      );
    }, 50); // 延迟 50ms，确保 ReactFlow 完成当前帧渲染

    return () => clearTimeout(timer);
  // 只依赖 processEdges 拓扑变化，节点拖拽后通过 handleNodeDragStop 手动触发
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processEdges]);

  // 节点拖拽结束后：动态适配所有相关边的 Handle（根据新的相对位置重新计算最优锚点）
  const handleEdgeHandleAdaptation = useDebouncedCallback(
    async (draggedNodeId: string) => {
      // 找到与拖拽节点相关的所有边
      const affectedEdges = processEdges.filter(
        (e) => e.sourceNodeId === draggedNodeId || e.targetNodeId === draggedNodeId,
      );
      if (affectedEdges.length === 0) return;

      // 构建 nodeId → position 映射（从 ReactFlow nodes）
      const nodeMap = new Map<string, { x: number; y: number; width: number; height: number }>();
      for (const n of rfNodes) {
        nodeMap.set(n.id, {
          x: n.position.x,
          y: n.position.y,
          width: n.width ?? (n.type === 'decision' ? 120 : 160),
          height: n.height ?? (n.type === 'decision' ? 120 : 56),
        });
      }

      for (const edge of affectedEdges) {
        const sourceNode = nodeMap.get(edge.sourceNodeId);
        const targetNode = nodeMap.get(edge.targetNodeId);
        if (!sourceNode || !targetNode) continue;

        const optimal = computeOptimalHandles(
          sourceNode, targetNode,
          sourceNode.width, sourceNode.height,
          targetNode.width, targetNode.height,
        );

        // 仅在 handle 实际变化时更新
        if (edge.sourceHandle !== optimal.sourceHandle || edge.targetHandle !== optimal.targetHandle) {
          try {
            await updateEdge(edge.id, {
              sourceHandle: optimal.sourceHandle,
              targetHandle: optimal.targetHandle,
            });
          } catch {
            // 更新失败不影响其他边
          }
        }
      }
    },
    600,
  );

  // 节点拖拽结束：坐标转换 + 越界检查 + 跨泳道检测
  const handleNodeDragStop = useDebouncedCallback(
    async (_event: React.MouseEvent, node: Node) => {
      if (!layout) return;

      const pos = layout.nodePositions[node.id];
      if (!pos) return;

      const nodeWidth = node.width ?? 160;
      const nodeHeight = node.height ?? 56;

      // 使用节点中心点判断所属泳道，避免边界误判
      const centerX = node.position.x + nodeWidth / 2;
      const centerY = node.position.y + nodeHeight / 2;

      // 获取当前泳道格子边界
      const bounds = getLaneBounds(pos.participantLaneIndex, pos.customLaneIndex, layout);

      // 检查节点中心点是否已离开原泳道格子
      const isCenterInOriginalLane =
        centerX >= bounds.x &&
        centerX <= bounds.x + bounds.width &&
        centerY >= bounds.y &&
        centerY <= bounds.y + bounds.height;

      // 只有当中心点离开原泳道，且进入了新的 Participant 泳道时，才触发 Dialog
      if (!isCenterInOriginalLane) {
        const newParticipantLaneIndex = getParticipantLaneIndexFromY(centerY, layout);
        const newCustomLaneIndex = getCustomLaneIndexFromX(centerX, layout);

        if (newParticipantLaneIndex !== pos.participantLaneIndex) {
          const targetLane = layout.participantLanes[newParticipantLaneIndex];
          if (!targetLane) return;

          // 计算相对于新泳道的偏移
          const newBounds = getLaneBounds(newParticipantLaneIndex, newCustomLaneIndex, layout);
          const newOffsetX = Math.round(node.position.x - newBounds.x);
          const newOffsetY = Math.round(node.position.y - newBounds.y);

          const currentLane = layout.participantLanes[pos.participantLaneIndex];
          setHolderChangeDialog({
            open: true,
            nodeId: node.id,
            currentLaneLabel: currentLane?.label ?? '',
            targetLane,
            targetParticipantLaneIndex: newParticipantLaneIndex,
            targetCustomLaneIndex: newCustomLaneIndex,
            newOffsetX,
            newOffsetY,
          });
          return;
        }

        // 跨自定义泳道但同角色泳道：仅更新 customLaneIndex，不弹 Dialog（交互设计 §4.2）
        if (newCustomLaneIndex !== pos.customLaneIndex) {
          const newBounds = getLaneBounds(pos.participantLaneIndex, newCustomLaneIndex, layout);
          let offsetX = Math.round(node.position.x - newBounds.x);
          let offsetY = Math.round(node.position.y - newBounds.y);

          // Clamp 最小偏移（不能超出左/上边界）
          offsetX = Math.max(8, offsetX);
          offsetY = Math.max(8, offsetY);

          // 自动拓展新泳道
          const laneOverrides = { ...(layout.laneOverrides ?? {}) };
          const neededWidth = offsetX + nodeWidth + 8;
          if (neededWidth > newBounds.width) {
            const customLaneId = layout.customLanes[newCustomLaneIndex]?.id;
            if (customLaneId) {
              const currentOverride = laneOverrides[customLaneId]?.size ?? newBounds.width;
              laneOverrides[customLaneId] = { size: Math.max(currentOverride, neededWidth) };
            }
          }
          const neededHeight = offsetY + nodeHeight + 8;
          if (neededHeight > newBounds.height) {
            const participantId = layout.participantLanes[pos.participantLaneIndex]?.participantId;
            if (participantId) {
              const currentOverride = laneOverrides[participantId]?.size ?? newBounds.height;
              laneOverrides[participantId] = { size: Math.max(currentOverride, neededHeight) };
            }
          }

          const nodePositions = { ...layout.nodePositions };
          nodePositions[node.id] = {
            ...pos,
            customLaneIndex: newCustomLaneIndex,
            offsetX,
            offsetY,
          };

          await updateLayout({ nodePositions, laneOverrides });
          markDirty();
          return;
        }
      }

      // 同泳道：将绝对坐标转为相对偏移
      let offsetX = Math.round(node.position.x - bounds.x);
      let offsetY = Math.round(node.position.y - bounds.y);

      // Clamp 最小偏移（不能超出左/上边界）
      offsetX = Math.max(8, offsetX);
      offsetY = Math.max(8, offsetY);

      // 自动拓展泳道：节点拖拽超出右/下边界时，自动增加泳道尺寸
      const laneOverrides = { ...(layout.laneOverrides ?? {}) };
      const neededWidth = offsetX + nodeWidth + 8;
      if (neededWidth > bounds.width) {
        const customLaneId = layout.customLanes[pos.customLaneIndex]?.id;
        if (customLaneId) {
          const currentOverride = laneOverrides[customLaneId]?.size ?? bounds.width;
          laneOverrides[customLaneId] = { size: Math.max(currentOverride, neededWidth) };
        }
      }
      const neededHeight = offsetY + nodeHeight + 8;
      if (neededHeight > bounds.height) {
        const participantId = layout.participantLanes[pos.participantLaneIndex]?.participantId;
        if (participantId) {
          const currentOverride = laneOverrides[participantId]?.size ?? bounds.height;
          laneOverrides[participantId] = { size: Math.max(currentOverride, neededHeight) };
        }
      }

      const nodePositions = { ...layout.nodePositions };
      nodePositions[node.id] = {
        ...pos,
        offsetX,
        offsetY,
      };

      await updateLayout({ nodePositions, laneOverrides });
      markDirty();

      // 拖拽结束后动态适配相关边的 Handle
      handleEdgeHandleAdaptation(node.id);
      // 拖拽后路径变化，重新检测交叉点
      triggerCrossingDetection();
    },
    500,
  );

  // 确认跨泳道变更：更新 holder + 清空 actionRef/decisionRef + 更新布局
  const handleConfirmHolderChange = useCallback(async () => {
    if (!layout) return;
    const {
      nodeId,
      targetLane,
      targetParticipantLaneIndex,
      targetCustomLaneIndex,
      newOffsetX,
      newOffsetY,
    } = holderChangeDialog;

    try {
      // 更新节点 holder，清空 actionRef/decisionRef
      await updateNode(nodeId, {
        holderType: targetLane.participantType as 'role' | 'service' | 'external_entity',
        holderId: targetLane.participantId,
        actionRef: null,
        decisionRef: null,
      });

      // 更新布局位置
      const nodePositions = { ...layout.nodePositions };
      nodePositions[nodeId] = {
        participantLaneIndex: targetParticipantLaneIndex,
        customLaneIndex: targetCustomLaneIndex,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      };
      await updateLayout({ nodePositions });
      markDirty();
      toast.success('参与者已变更，请在属性面板重新选择 Action/Decision');
      setHolderChangeDialog((prev) => ({ ...prev, open: false }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '变更参与者失败');
    }
  }, [holderChangeDialog, layout, updateNode, updateLayout, markDirty]);

  // 取消跨泳道变更：弹回原泳道边界内
  const handleCancelHolderChange = useCallback(async () => {
    if (!layout) return;
    const { nodeId } = holderChangeDialog;
    const pos = layout.nodePositions[nodeId];
    if (!pos) return;

    const bounds = getLaneBounds(pos.participantLaneIndex, pos.customLaneIndex, layout);
    const node = rfNodes.find((n) => n.id === nodeId);
    const nodeWidth = node?.width ?? 160;
    const nodeHeight = node?.height ?? 56;

    const nodePositions = { ...layout.nodePositions };
    nodePositions[nodeId] = {
      ...pos,
      offsetX: Math.max(8, Math.min(pos.offsetX, bounds.width - nodeWidth - 8)),
      offsetY: Math.max(8, Math.min(pos.offsetY, bounds.height - nodeHeight - 8)),
    };

    await updateLayout({ nodePositions });
    markDirty();
    setHolderChangeDialog((prev) => ({ ...prev, open: false }));
  }, [holderChangeDialog, layout, rfNodes, updateLayout, markDirty]);

  // 连线交互
  const handleConnect: OnConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // 前端预检：同方向边已存在则直接提示，避免发请求
      const alreadyExists = processEdges.some(
        (e) => e.sourceNodeId === connection.source && e.targetNodeId === connection.target,
      );
      if (alreadyExists) {
        toast.error('两节点之间同方向已存在连线，不允许重复创建');
        return;
      }

      // 检查 source 是否是 decision 节点
      const sourceNode = processNodes.find((n) => n.id === connection.source);
      if (sourceNode?.nodeType === 'decision' && sourceNode.decisionRef) {
        try {
          const basePath =
            sourceNode.holderType === 'role'
              ? `/projects/${projectId}/roles/${sourceNode.holderId}`
              : sourceNode.holderType === 'service'
                ? `/projects/${projectId}/applications/${sourceNode.holderId}`
                : `/projects/${projectId}/external-entities/${sourceNode.holderId}`;

          const res = await apiClient.get<{
            data: {
              items: Array<{
                name: string;
                displayName: string;
                branches?: Array<{ name: string; condition?: string }>;
              }>;
            };
          }>(`${basePath}/decisions`);
          const decisions = res.data.data?.items ?? [];
          const decision = decisions.find((d) => d.name === sourceNode.decisionRef);

          if (decision?.branches && decision.branches.length > 0) {
            setBranchDialog({
              open: true,
              branches: decision.branches,
              decisionDisplayName: decision.displayName || sourceNode.displayName,
              pendingConnection: connection,
            });
            return;
          }
        } catch {
          // 查询失败则继续创建边（不绑定分支）
        }
      }

      // 普通节点或没有分支的 decision，直接创建边
      try {
        const edge = await createEdge({
          sourceNodeId: connection.source,
          targetNodeId: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
        });
        markDirty();
        toast.success('连线创建成功');
        // 连线后自动选中边并打开 Edge Inspector
        selectEdge(edge.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '创建连线失败');
      }
    },
    [createEdge, markDirty, processEdges, processNodes, projectId, selectEdge],
  );

  // 确认分支选择后创建边
  const handleBranchSelect = useCallback(
    async (branchName: string) => {
      const connection = branchDialog.pendingConnection;
      if (!connection?.source || !connection?.target) return;

      try {
        const edge = await createEdge({
          sourceNodeId: connection.source,
          targetNodeId: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
          label: branchName,
        });
        markDirty();
        toast.success('连线创建成功');
        // 连线后自动选中边并打开 Edge Inspector
        selectEdge(edge.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '创建连线失败');
      } finally {
        setBranchDialog((prev) => ({ ...prev, open: false, pendingConnection: null }));
      }
    },
    [branchDialog.pendingConnection, createEdge, markDirty, selectEdge],
  );

  const handleBranchCancel = useCallback(() => {
    setBranchDialog((prev) => ({ ...prev, open: false, pendingConnection: null }));
  }, []);

  // 画布空白点击：取消选中
  const handlePaneClick = useCallback(() => {
    selectNode(null);
    selectEdge(null);
  }, [selectNode, selectEdge]);

  // 节点点击：选中节点
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      selectNode(node.id);
    },
    [selectNode],
  );

  // 边点击：选中边
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      selectEdge(edge.id);
    },
    [selectEdge],
  );

  const isEmpty = processNodes.length === 0 && processEdges.length === 0;

  // ---- DnD: onDragOver 必须阻止默认行为才能允许 drop ----
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // ---- DnD: onDrop 计算落点泳道位置 ----
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData('application/reactflow-type') as 'action' | 'decision' | '';
      if (!nodeType || !layout) return;

      // 将屏幕坐标转为 ReactFlow 画布坐标
      const flowPos = rfInstanceRef.current?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }) ?? { x: event.clientX, y: event.clientY };

      // 计算落点在哪个泳道（使用 effective size，与渲染一致）
      const overrides = layout.laneOverrides ?? {};
      let cumX = HEADER;
      let cumY = HEADER;
      let customLaneIndex = 0;
      let participantLaneIndex = 0;

      // 计算 customLaneIndex
      for (let i = 0; i < layout.customLanes.length; i++) {
        const laneEnd = cumX + getEffectiveSize(layout.customLanes[i], overrides);
        if (flowPos.x < laneEnd) {
          customLaneIndex = i;
          break;
        }
        cumX = laneEnd;
        if (i === layout.customLanes.length - 1) customLaneIndex = i;
      }

      // 计算 participantLaneIndex
      for (let i = 0; i < layout.participantLanes.length; i++) {
        const laneEnd = cumY + getEffectiveSize(layout.participantLanes[i], overrides);
        if (flowPos.y < laneEnd) {
          participantLaneIndex = i;
          break;
        }
        cumY = laneEnd;
        if (i === layout.participantLanes.length - 1) participantLaneIndex = i;
      }

      const targetLane = layout.participantLanes[participantLaneIndex];
      if (!targetLane) {
        toast.error('请先添加 Participant 泳道');
        return;
      }

      // 弹出行为选择 Dialog
      setDndState({
        nodeType,
        participantLane: targetLane,
        participantLaneIndex,
        customLaneIndex,
      });
    },
    [layout],
  );

  // ---- 画布移动时实时 clamp viewport 到内容边界 ----
  // 节点拖拽时只同步 viewport 状态（用于 sticky header 更新），不做 clamp
  const handleMove = useCallback(
    (_event: MouseEvent | TouchEvent | null, v: { x: number; y: number; zoom: number }) => {
      if (isDraggingNodeRef.current) {
        setViewport(v);
        return;
      }
      const bounds = computeContentBounds(layout);
      const clamped = clampViewport(v, bounds, containerSize);
      if (clamped.x !== v.x || clamped.y !== v.y) {
        rfInstanceRef.current?.setViewport(clamped);
      } else {
        setViewport(v);
      }
    },
    [layout, containerSize],
  );

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      {/* 泳道背景层（z-index 低于 ReactFlow，同步 viewport transform） */}
      <div
        className="absolute"
        style={{
          zIndex: 0,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          width: containerSize.width / Math.max(viewport.zoom, 0.01),
          height: containerSize.height / Math.max(viewport.zoom, 0.01),
        }}
      >
        <SwimlaneBackground
          width={containerSize.width / Math.max(viewport.zoom, 0.01)}
          height={containerSize.height / Math.max(viewport.zoom, 0.01)}
        />
      </div>

      {/* 泳道 resize 手柄层（z-index 高于 ReactFlow，同步 viewport transform） */}
      <div
        className="absolute"
        style={{
          zIndex: 10,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          width: containerSize.width / Math.max(viewport.zoom, 0.01),
          height: containerSize.height / Math.max(viewport.zoom, 0.01),
          pointerEvents: 'none',
        }}
      >
        <SwimlaneResizeHandles
          width={containerSize.width / Math.max(viewport.zoom, 0.01)}
          height={containerSize.height / Math.max(viewport.zoom, 0.01)}
          zoom={viewport.zoom}
        />
      </div>

      {/* ReactFlow 画布 */}
      <div className="absolute inset-0" style={{ zIndex: 1 }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={() => { isDraggingNodeRef.current = true; }}
          onNodeDragStop={((event: React.MouseEvent, node: Node) => {
            isDraggingNodeRef.current = false;
            handleNodeDragStop(event, node);
          }) as never}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          onConnect={handleConnect}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionLineStyle={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
          onInit={(instance) => {
            rfInstanceRef.current = instance;
            const initial = { x: 0, y: 0, zoom: 1 };
            instance.setViewport(initial);
            setViewport(initial);
          }}
          onMove={handleMove}
          onMoveEnd={(_, v) => {
            const bounds = computeContentBounds(layout);
            const clamped = clampViewport(v, bounds, containerSize);
            if (clamped.x !== v.x || clamped.y !== v.y) {
              rfInstanceRef.current?.setViewport(clamped);
            } else {
              setViewport(v);
            }
          }}
          minZoom={0.2}
          maxZoom={2}
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} color="transparent" />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            position="bottom-right"
            style={{ width: 140, height: 90 }}
          />
        </ReactFlow>
      </div>

      {/* Sticky 自定义泳道列标题层（冻结首行效果）
       * - 垂直方向：始终固定在容器顶部，不随 viewport.y 移动
       * - 水平方向：跟随 viewport.x + viewport.zoom 同步，与下方列内容对齐
       * - zIndex: 5（高于 ReactFlow 节点层 ~4，低于 Radix Dialog ~50）
       */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 5 }}
      >
        {/* 左上角固定展位空白区（Participant 列头与自定义泳道列头的交叉处） */}
        <div
          className="absolute bg-gray-50 border-b border-r border-gray-200"
          style={{
            left: 0,
            top: 0,
            width: HEADER * viewport.zoom,
            height: HEADER * viewport.zoom,
          }}
        />
        {/* 各列标题：左侧跟随水平平移，上方固定在 top:0 */}
        {layout?.customLanes.reduce<{ acc: React.ReactNode[]; offset: number }>(
          ({ acc, offset }, lane, idx) => {
            const color = getLaneColor(idx);
            const overrides = layout.laneOverrides ?? {};
            const laneW = getEffectiveSize(lane, overrides) * viewport.zoom;
            const laneLeft = HEADER * viewport.zoom + offset + viewport.x;
            const laneHeight = HEADER * viewport.zoom;

            // 小于左侧 sticky 列头宽度时不渲染
            const visibleLeft = Math.max(laneLeft, HEADER * viewport.zoom);
            const visibleRight = laneLeft + laneW;
            if (visibleRight <= HEADER * viewport.zoom) {
              return { acc, offset: offset + laneW };
            }

            acc.push(
              <div
                key={`sticky-col-${lane.id}`}
                className={cn(
                  'absolute flex items-center justify-center text-xs font-bold border-b border-r border-gray-200 overflow-hidden',
                  color.headerBg,
                  color.headerText,
                )}
                style={{
                  left: visibleLeft,
                  top: 0,
                  width: visibleRight - visibleLeft,
                  height: laneHeight,
                  fontSize: `${12 * viewport.zoom}px`,
                }}
              >
                {lane.label}
              </div>
            );
            return { acc, offset: offset + laneW };
          },
          { acc: [], offset: 0 },
        ).acc}
      </div>

      {/* Sticky Participant 行标题层（z-index 高于 ReactFlow 节点，低于 Radix Dialog） */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 4 }}
      >
        {layout?.participantLanes.map((lane, i) => {
          const color = getLaneColor(i);
          const overrides = layout.laneOverrides ?? {};
          const rowH = getEffectiveSize(lane, overrides);
          // 累加前面行高得到当前行 Y
          let rowCanvasY = HEADER;
          for (let j = 0; j < i; j++) rowCanvasY += getEffectiveSize(layout.participantLanes[j], overrides);
          const rowTop = rowCanvasY * viewport.zoom + viewport.y;
          const rowBottom = (rowCanvasY + rowH) * viewport.zoom + viewport.y;

          // 完全不可见时跳过
          if (rowBottom < 0 || rowTop > containerSize.height) return null;

          const minTop = HEADER * viewport.zoom;
          const top = Math.max(minTop, rowTop);
          const bottom = Math.min(rowBottom, containerSize.height);
          const height = Math.max(0, bottom - top);
          if (height <= 2) return null;

          return (
            <div
              key={`sticky-${lane.participantId}`}
              className={cn(
                'absolute flex items-center justify-center border-r border-gray-200 font-extrabold',
                color.headerBg,
                color.headerText,
              )}
              style={{
                left: 0,
                top,
                width: HEADER * viewport.zoom,
                height,
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                fontSize: `${12 * viewport.zoom}px`,
              }}
            >
              {lane.label}
            </div>
          );
        })}
      </div>

      {/* 空状态提示 */}
      {isEmpty && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 2 }}
        >
          <div className="text-center">
            <p className="text-base font-medium text-muted-foreground">还没有流程节点</p>
            <p className="mt-1 text-sm text-muted-foreground/60">
              从左侧节点池拖拽节点到画布开始设计流程
            </p>
          </div>
        </div>
      )}

      {/* 节点创建行为选择 Dialog */}
      {dndState && (
        <SelectBehaviorDialog
          open={!!dndState}
          onOpenChange={(open) => { if (!open) setDndState(null); }}
          nodeType={dndState.nodeType}
          participantLane={dndState.participantLane}
          participantLaneIndex={dndState.participantLaneIndex}
          customLaneIndex={dndState.customLaneIndex}
        />
      )}

      {/* 跨泳道 holder 变更确认 Dialog */}
      <AlertDialog open={holderChangeDialog.open} onOpenChange={(open) => { if (!open) setHolderChangeDialog((prev) => ({ ...prev, open: false })); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>变更参与者</AlertDialogTitle>
            <AlertDialogDescription>
              是否将节点从「{holderChangeDialog.currentLaneLabel}」变更为「{holderChangeDialog.targetLane.label}」？
              <br />
              <span className="text-destructive text-xs mt-1 inline-block">
                变更后需要重新选择 Action/Decision
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelHolderChange}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmHolderChange}>确认变更</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decision 分支选择 Dialog */}
      <BranchSelectDialog
        open={branchDialog.open}
        branches={branchDialog.branches}
        decisionDisplayName={branchDialog.decisionDisplayName}
        onSelect={handleBranchSelect}
        onCancel={handleBranchCancel}
      />
    </div>
  );
}
