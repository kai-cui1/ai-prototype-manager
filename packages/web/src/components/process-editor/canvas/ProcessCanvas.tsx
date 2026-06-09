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
  type Node,
  type Edge,
  type OnConnect,
  type Connection,
} from '@xyflow/react';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import '@xyflow/react/dist/style.css';

import { useProcessEditorContext } from '@/contexts/ProcessEditorContext';
import type { ActionNodeData } from './ActionNode';
import type { DecisionNodeData } from './DecisionNode';
import type { ProcessEdgeData } from './ProcessEdge';
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
        return {
          id: pn.id,
          type: 'action',
          position: pos,
          style: { width: 160, height: 80 },
          data: {
            nodeId: pn.id,
            name: pn.name,
            displayName: pn.displayName,
            holderType: pn.holderType,
            holderLabel: pn.holderId,
            actionRef: pn.actionRef,
            isSelected: selectedNodeId === pn.id,
            hasError: errorNodeIds.has(pn.id),
          } satisfies ActionNodeData,
        };
      } else {
        // 计算分支数（出边数量）
        const branchCount = processEdges.filter((e) => e.sourceNodeId === pn.id).length;
        return {
          id: pn.id,
          type: 'decision',
          position: pos,
          style: { width: 120, height: 120 },
          data: {
            nodeId: pn.id,
            name: pn.name,
            displayName: pn.displayName,
            holderType: pn.holderType,
            holderLabel: pn.holderId,
            decisionRef: pn.decisionRef,
            branchCount,
            isSelected: selectedNodeId === pn.id,
            hasError: errorNodeIds.has(pn.id),
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

    const newEdges: Edge[] = processEdges.map((pe) => ({
      id: pe.id,
      source: pe.sourceNodeId,
      target: pe.targetNodeId,
      type: 'process',
      data: {
        label: pe.label,
        condition: pe.condition,
        isSelected: selectedEdgeId === pe.id,
        hasError: errorEdgeIds.has(pe.id),
        crowdingIndex: Math.max(edgeSourceIndex[pe.id] ?? 0, edgeTargetIndex[pe.id] ?? 0),
      } satisfies ProcessEdgeData,
    }));

    setRfEdges(newEdges);
  }, [processEdges, selectedEdgeId, errorEdgeIds, setRfEdges]);

  // 节点拖拽结束：坐标转换 + 越界检查 + 跨泳道检测
  const handleNodeDragStop = useDebouncedCallback(
    async (_event: React.MouseEvent, node: Node) => {
      if (!layout) return;

      const pos = layout.nodePositions[node.id];
      if (!pos) return;

      const nodeWidth = node.width ?? 160;
      const nodeHeight = node.height ?? 80;

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
          // 取已有 override 和当前 bounds.width 的较大值，再与 neededWidth 比较
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
    const nodeHeight = node?.height ?? 80;

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
        await createEdge({
          sourceNodeId: connection.source,
          targetNodeId: connection.target,
        });
        markDirty();
        toast.success('连线创建成功');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '创建连线失败');
      }
    },
    [createEdge, markDirty, processEdges, processNodes, projectId],
  );

  // 确认分支选择后创建边
  const handleBranchSelect = useCallback(
    async (branchName: string) => {
      const connection = branchDialog.pendingConnection;
      if (!connection?.source || !connection?.target) return;

      try {
        await createEdge({
          sourceNodeId: connection.source,
          targetNodeId: connection.target,
          config: { sourceBranch: branchName },
        });
        markDirty();
        toast.success('连线创建成功');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '创建连线失败');
      } finally {
        setBranchDialog((prev) => ({ ...prev, open: false, pendingConnection: null }));
      }
    },
    [branchDialog.pendingConnection, createEdge, markDirty],
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

      {/* Sticky Participant 行标题层（z-index 高于 ReactFlow 节点） */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 50 }}
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
