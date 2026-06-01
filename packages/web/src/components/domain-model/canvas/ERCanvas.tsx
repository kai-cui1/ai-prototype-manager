/**
 * @module ERCanvas
 * @description ReactFlow 画布容器：渲染 ER 图、处理节点拖拽位置持久化。
 *
 * 数据流：erGraph（来自 Context）→ ReactFlow nodes/edges
 * 节点拖拽结束：防抖 500ms 后调用 PUT /entities/:id { canvasPosition }
 * showRelationLabel：来自 canvasSettings，注入到每条 edge 的 data 中供 RelationEdge 读取
 * Handle 动态选择：根据 source/target 节点相对位置自动选择最优连接点（上/下/左/右）
 */

import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
} from '@xyflow/react';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import '@xyflow/react/dist/style.css';

import { useDomainModelContext } from '@/contexts/DomainModelContext';
import EntityNode from './EntityNode';
import RelationEdge from './RelationEdge';

// 注册自定义节点/边类型（R3 Why: 在组件外定义以避免每次渲染重新创建引用）
const nodeTypes = { entity: EntityNode };
const edgeTypes = { relation: RelationEdge };

// 自动布局：当节点无保存位置时生成网格坐标
function getAutoPosition(index: number): { x: number; y: number } {
  const cols = 4;
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { x: col * 220 + 40, y: row * 160 + 40 };
}

// ============================================================
// 动态 Handle 选择：根据节点相对位置自动计算最优连接方向
// ============================================================

// 节点尺寸常量（与 EntityNode 实际渲染尺寸一致）
const NODE_WIDTH = 180;
const NODE_HEADER_HEIGHT = 30;
const NODE_FIELD_ROW_HEIGHT = 24;
const NODE_FOOTER_HEIGHT = 20;

function estimateNodeHeight(fieldCount: number): number {
  const visibleCount = Math.min(fieldCount, 6);
  const bodyHeight = visibleCount > 0
    ? visibleCount * NODE_FIELD_ROW_HEIGHT + (fieldCount > 6 ? NODE_FOOTER_HEIGHT : 0)
    : NODE_FIELD_ROW_HEIGHT;
  return NODE_HEADER_HEIGHT + bodyHeight;
}

/**
 * 根据 source/target 节点相对位置，选择最优 Handle 方向。
 * 策略：取两节点中心连线在 source 节点上的出射方向和 target 节点上的入射方向。
 */
function computeOptimalHandles(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number },
  sourceFieldCount: number,
  targetFieldCount: number,
): { sourceHandle: string; targetHandle: string } {
  const sourceHeight = estimateNodeHeight(sourceFieldCount);
  const targetHeight = estimateNodeHeight(targetFieldCount);

  // 两节点中心坐标
  const sourceCenter = {
    x: sourcePos.x + NODE_WIDTH / 2,
    y: sourcePos.y + sourceHeight / 2,
  };
  const targetCenter = {
    x: targetPos.x + NODE_WIDTH / 2,
    y: targetPos.y + targetHeight / 2,
  };

  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  // source 的出射方向：dx > 0 → 右出，dx < 0 → 左出，dy > 0 → 下出，dy < 0 → 上出
  // 优先考虑水平方向（大多数 ER 图节点横向排列）
  if (Math.abs(dx) >= Math.abs(dy)) {
    // 水平方向为主
    const sourceHandle = dx > 0 ? 'right' : 'left';
    // target 的入射方向与 source 出射方向对称
    const targetHandle = dx > 0 ? 'left' : 'right';
    return { sourceHandle, targetHandle };
  } else {
    // 垂直方向为主
    const sourceHandle = dy > 0 ? 'bottom' : 'top';
    const targetHandle = dy > 0 ? 'top' : 'bottom';
    return { sourceHandle, targetHandle };
  }
}

export default function ERCanvas() {
  const {
    erGraph,
    selectedEntityId,
    selectEntity,
    selectRelation,
    selectedRelationId,
    rfInstanceRef,
    updateEntity,
    searchQuery,
    canvasSettings,
  } = useDomainModelContext();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // erGraph 或 showRelationLabel 变化时同步 nodes/edges
  useEffect(() => {
    if (!erGraph || !erGraph.entities) return;

    const newNodes: Node[] = erGraph.entities.map((entity, idx) => ({
      id: entity.id,
      type: 'entity',
      position: entity.position ?? getAutoPosition(idx),
      data: entity.data,
    }));

    // 构建 nodeId → position 映射和 nodeId → fieldCount 映射，用于计算最优 Handle
    const posMap = new Map<string, { x: number; y: number }>();
    const fieldCountMap = new Map<string, number>();
    for (const entity of erGraph.entities) {
      const pos = entity.position ?? getAutoPosition(erGraph.entities.indexOf(entity));
      posMap.set(entity.id, pos);
      const data = entity.data as { fields?: unknown[] };
      fieldCountMap.set(entity.id, data.fields?.length ?? 0);
    }

    const newEdges: Edge[] = (erGraph.relations ?? []).map((rel) => {
      const sourcePos = posMap.get(rel.source) ?? { x: 0, y: 0 };
      const targetPos = posMap.get(rel.target) ?? { x: 0, y: 0 };
      const sourceFieldCount = fieldCountMap.get(rel.source) ?? 0;
      const targetFieldCount = fieldCountMap.get(rel.target) ?? 0;

      const { sourceHandle, targetHandle } = computeOptimalHandles(
        sourcePos, targetPos, sourceFieldCount, targetFieldCount
      );

      return {
        id: rel.id,
        source: rel.source,
        target: rel.target,
        sourceHandle,
        targetHandle,
        type: 'relation',
        data: { ...rel.data, showLabel: canvasSettings.showRelationLabel, isSelected: selectedRelationId === rel.id },
        animated: false,
      };
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [erGraph, canvasSettings.showRelationLabel, setNodes, setEdges]);

  // showRelationLabel 切换时，直接更新现有 edges 的 data（避免完整重建）
  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        data: { ...e.data, showLabel: canvasSettings.showRelationLabel },
      }))
    );
  }, [canvasSettings.showRelationLabel, setEdges]);

  // selectedRelationId 变化时，更新所有 edges 的 isSelected 属性
  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        data: { ...e.data, isSelected: selectedRelationId === e.id },
      }))
    );
  }, [selectedRelationId, setEdges]);

  // nodes 位置变化时，重新计算所有 edges 的最优 Handle
  useEffect(() => {
    if (nodes.length === 0 || edges.length === 0) return;

    // 构建 position 和 fieldCount 映射
    const posMap = new Map<string, { x: number; y: number }>();
    const fieldCountMap = new Map<string, number>();
    for (const node of nodes) {
      posMap.set(node.id, { x: node.position.x, y: node.position.y });
      const data = node.data as { fields?: unknown[] };
      fieldCountMap.set(node.id, data.fields?.length ?? 0);
    }

    setEdges((eds) =>
      eds.map((e) => {
        const sourcePos = posMap.get(e.source);
        const targetPos = posMap.get(e.target);
        if (!sourcePos || !targetPos) return e;

        const { sourceHandle, targetHandle } = computeOptimalHandles(
          sourcePos, targetPos,
          fieldCountMap.get(e.source) ?? 0,
          fieldCountMap.get(e.target) ?? 0
        );

        // 仅在 handle 变化时更新，减少不必要的渲染
        if (e.sourceHandle === sourceHandle && e.targetHandle === targetHandle) return e;

        return { ...e, sourceHandle, targetHandle };
      })
    );
  }, [nodes, setEdges]);

  // 搜索高亮：降低未匹配节点的透明度
  useEffect(() => {
    if (!searchQuery) {
      setNodes((nds) => nds.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } })));
      return;
    }
    const q = searchQuery.toLowerCase();
    setNodes((nds) =>
      nds.map((n) => {
        const data = n.data as { name: string; displayName: string };
        const match =
          data.name.toLowerCase().includes(q) ||
          data.displayName.toLowerCase().includes(q);
        return { ...n, style: { ...n.style, opacity: match ? 1 : 0.25 } };
      })
    );
  }, [searchQuery, setNodes]);

  // 节点拖拽结束：防抖 500ms 保存位置
  const handleNodeDragStop = useDebouncedCallback(
    async (_event: React.MouseEvent, node: Node) => {
      try {
        await updateEntity(node.id, {
          canvasPosition: { x: node.position.x, y: node.position.y },
        });
      } catch {
        toast.error('位置保存失败');
      }
    },
    500
  );

  // 点击节点：选中实体（Inspector 展开）
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      selectEntity(node.id);
    },
    [selectEntity]
  );

  // 点击画布空白：取消选中（实体 + 关系均取消）
  const handlePaneClick = useCallback(() => {
    selectEntity(null);
    selectRelation(null);
  }, [selectEntity, selectRelation]);

  // 点击关系线：选中关系（Inspector 切换为关系详情模式）
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      selectRelation(edge.id);
    },
    [selectRelation]
  );

  // 禁用连线（关系通过 Inspector Dialog 创建）
  const handleConnect: OnConnect = useCallback(() => {
    // Phase 1 不支持直接拖拽连线
  }, []);

  // 空状态（防御性检查：erGraph 可能为 {} 或 entities 缺失）
  const isEmpty = !erGraph || !erGraph.entities || erGraph.entities.length === 0;

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => {
          rfInstanceRef.current = instance;
        }}
        fitView
        fitViewOptions={{ padding: 0.6 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={null}
      >
        <Background gap={20} color="var(--border)" />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          style={{ width: 160, height: 100 }}
          nodeColor={(node) => {
            const data = node.data as { category?: string };
            const colors: Record<string, string> = {
              core: '#1677ff',
              supporting: '#8c8c8c',
              event: '#fa8c16',
            };
            return colors[data.category ?? ''] ?? '#08979c';
          }}
        />
      </ReactFlow>

      {/* 空状态提示 */}
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-base font-medium text-muted-foreground">还没有领域实体</p>
            <p className="mt-1 text-sm text-muted-foreground/60">
              点击右上角「新建实体」开始建模
            </p>
          </div>
        </div>
      )}
    </div>
  );
}