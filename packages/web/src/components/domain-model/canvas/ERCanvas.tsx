/**
 * @module ERCanvas
 * @description ReactFlow 画布容器：渲染 ER 图、处理节点拖拽位置持久化。
 *
 * 数据流：erGraph（来自 Context）→ ReactFlow nodes/edges
 * 节点拖拽结束：防抖 500ms 后调用 PUT /entities/:id { canvasPosition }
 * showRelationLabel：来自 canvasSettings，注入到每条 edge 的 data 中供 RelationEdge 读取
 * Handle 动态选择：根据 source/target 节点相对位置自动选择最优连接点（上/下/左/右）
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
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
  type OnNodeDrag,
  type NodeChange,
} from '@xyflow/react';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import '@xyflow/react/dist/style.css';

import { useDomainModelContext } from '@/contexts/DomainModelContext';
import EntityNode from './EntityNode';
import DomainNode from './DomainNode';
import RelationEdge from './RelationEdge';

// 注册自定义节点/边类型（R3 Why: 在组件外定义以避免每次渲染重新创建引用）
const nodeTypes = { entity: EntityNode, domain: DomainNode };
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
    selectEntity,
    selectRelation,
    selectedRelationId,
    selectDomain,
    selectedDomainId,
    rfInstanceRef,
    lastCanvasClickRef,
    updateEntity,
    updateEntityDomain,
    updateBoundary,
    searchQuery,
    canvasSettings,
  } = useDomainModelContext();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 用 ref 持有最新 nodes/erGraph，避免 debounced 回调中 stale closure
  const nodesRef = useRef<Node[]>([]);
  const erGraphRef = useRef(erGraph);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { erGraphRef.current = erGraph; }, [erGraph]);

  // 防抖保存 domain 框尺寸（resize 结束后 500ms 触发）
  const saveDomainSize = useDebouncedCallback(
    (nodeId: string, width: number, height: number) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;
      updateBoundary(nodeId, {
        canvasPosition: {
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
          width: Math.round(width),
          height: Math.round(height),
        },
      }).catch(() => toast.error('保存领域框尺寸失败'));
    },
    500,
  );

  // 包装 onNodesChange：拦截 domain 节点的 dimensions 变更，触发保存
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      for (const change of changes) {
        if (
          change.type === 'dimensions' &&
          change.resizing === false // resize 结束（松手）
        ) {
          const node = nodesRef.current.find((n) => n.id === change.id);
          if (node?.type === 'domain' && change.dimensions) {
            saveDomainSize(change.id, change.dimensions.width, change.dimensions.height);
          }
        }
      }
    },
    [onNodesChange, saveDomainSize],
  );

  // domain 框拖拽联动：记录拖拽开始时 domain 位置 + 归属实体初始位置
  const domainDragStartRef = useRef<{
    domainId: string;
    startPos: { x: number; y: number };
    entityStartPositions: Map<string, { x: number; y: number }>;
  } | null>(null);

  // erGraph 或 showRelationLabel 变化时同步 nodes/edges
  useEffect(() => {
    if (!erGraph || !erGraph.entities) return;

    // 构建 domainId → entityCount 映射（用于 DomainNode 显示实体计数）
    const domainEntityCount = new Map<string, number>();
    for (const entity of erGraph.entities) {
      if (entity.data.domainId) {
        domainEntityCount.set(entity.data.domainId, (domainEntityCount.get(entity.data.domainId) ?? 0) + 1);
      }
    }

    // 领域框节点（z-index 低于实体，放在数组前面）
    const domainNodes: Node[] = (erGraph.domains ?? []).map((domain) => ({
      id: domain.id,
      type: 'domain',
      position: domain.position
        ? { x: domain.position.x, y: domain.position.y }
        : { x: 100, y: 100 },
      data: {
        name: domain.data.name,
        description: domain.data.description,
        entityCount: domainEntityCount.get(domain.id) ?? 0,
      },
      style: {
        width: domain.position?.width ?? 400,
        height: domain.position?.height ?? 300,
        zIndex: -1,
      },
      draggable: true,
      selectable: true,
    }));

    const entityNodes: Node[] = erGraph.entities.map((entity, idx) => ({
      id: entity.id,
      type: 'entity',
      position: entity.position ?? getAutoPosition(idx),
      data: entity.data,
    }));

    const newNodes: Node[] = [...domainNodes, ...entityNodes];

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

  // selectedDomainId 变化时，同步 domain 节点的 selected 状态
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type !== 'domain') return n;
        return { ...n, selected: n.id === selectedDomainId };
      })
    );
  }, [selectedDomainId, setNodes]);

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
        const data = n.data as { name: string; displayName?: string };
        const match =
          data.name.toLowerCase().includes(q) ||
          (data.displayName?.toLowerCase().includes(q) ?? false);
        return { ...n, style: { ...n.style, opacity: match ? 1 : 0.25 } };
      })
    );
  }, [searchQuery, setNodes]);

  // domain 框拖拽开始：记录初始位置 + 归属实体初始位置
  const handleNodeDragStart: OnNodeDrag = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      if (node.type !== 'domain') return;
      const entityStartPositions = new Map<string, { x: number; y: number }>();
      for (const n of nodesRef.current) {
        if (n.type !== 'entity') continue;
        const entityData = n.data as { domainId?: string };
        if (entityData.domainId === node.id) {
          entityStartPositions.set(n.id, { x: n.position.x, y: n.position.y });
        }
      }
      domainDragStartRef.current = {
        domainId: node.id,
        startPos: { x: node.position.x, y: node.position.y },
        entityStartPositions,
      };
    },
    []
  );

  // domain 框拖拽中：联动更新归属实体的位置（视觉层）
  const handleNodeDrag: OnNodeDrag = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      if (node.type === 'entity') {
        // 实体拖拽：检测悬停在哪个 domain 框内，更新 dragHover 状态
        const entityCenterX = node.position.x + NODE_WIDTH / 2;
        const entityCenterY = node.position.y + estimateNodeHeight(
          (node.data as { fields?: unknown[] }).fields?.length ?? 0
        ) / 2;

        setNodes((nds) =>
          nds.map((n) => {
            if (n.type !== 'domain') return n;
            const dx = n.position.x;
            const dy = n.position.y;
            const dw = (n.style?.width as number) ?? 400;
            const dh = (n.style?.height as number) ?? 300;
            const isHit =
              entityCenterX >= dx &&
              entityCenterX <= dx + dw &&
              entityCenterY >= dy &&
              entityCenterY <= dy + dh;
            if ((n.data as { dragHover?: boolean }).dragHover === isHit) return n;
            return { ...n, data: { ...n.data, dragHover: isHit } };
          })
        );
        return;
      }

      if (node.type !== 'domain' || !domainDragStartRef.current) return;
      if (domainDragStartRef.current.domainId !== node.id) return;

      const dx = node.position.x - domainDragStartRef.current.startPos.x;
      const dy = node.position.y - domainDragStartRef.current.startPos.y;

      // 联动实体 + 检测与其他 domain 框的重叠
      setNodes((nds) => {
        // 先算当前 domain 拖拽后的矩形
        const dw = (nds.find((n) => n.id === node.id)?.style?.width as number) ?? 400;
        const dh = (nds.find((n) => n.id === node.id)?.style?.height as number) ?? 300;
        const ax1 = node.position.x, ay1 = node.position.y;
        const ax2 = ax1 + dw, ay2 = ay1 + dh;

        return nds.map((n) => {
          if (n.type === 'entity') {
            const startPos = domainDragStartRef.current?.entityStartPositions.get(n.id);
            if (!startPos) return n;
            return { ...n, position: { x: startPos.x + dx, y: startPos.y + dy } };
          }
          if (n.type === 'domain' && n.id !== node.id) {
            const bw = (n.style?.width as number) ?? 400;
            const bh = (n.style?.height as number) ?? 300;
            const bx1 = n.position.x, by1 = n.position.y;
            const bx2 = bx1 + bw, by2 = by1 + bh;
            // AABB 重叠检测
            const overlapping = ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
            if ((n.data as { overlapping?: boolean }).overlapping === overlapping) return n;
            return { ...n, data: { ...n.data, overlapping } };
          }
          return n;
        });
      });
    },
    [setNodes]
  );

  // 节点拖拽结束：entity 节点保存位置 + 检测域归属；domain 节点保存位置 + 批量保存归属实体位置
  const handleNodeDragStop = useDebouncedCallback(
    async (_event: MouseEvent | TouchEvent, node: Node) => {
      // 清除所有 domain 框的 dragHover / overlapping 视觉反馈
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type !== 'domain') return n;
          const d = n.data as { dragHover?: boolean; overlapping?: boolean };
          if (!d.dragHover && !d.overlapping) return n;
          return { ...n, data: { ...n.data, dragHover: false, overlapping: false } };
        })
      );

      if (node.type === 'domain') {
        // 保存 domain 新的画布位置（宽高从 style 中取）
        const domainNode = nodesRef.current.find((n) => n.id === node.id);
        const width = (domainNode?.style?.width as number) ?? 400;
        const height = (domainNode?.style?.height as number) ?? 300;
        const saves: Promise<unknown>[] = [
          updateBoundary(node.id, {
            canvasPosition: { x: node.position.x, y: node.position.y, width, height },
          }),
        ];
        // 批量保存所有归属实体的新位置
        if (domainDragStartRef.current?.domainId === node.id) {
          const dx = node.position.x - domainDragStartRef.current.startPos.x;
          const dy = node.position.y - domainDragStartRef.current.startPos.y;
          for (const [entityId, startPos] of domainDragStartRef.current.entityStartPositions) {
            saves.push(
              updateEntity(entityId, {
                canvasPosition: { x: startPos.x + dx, y: startPos.y + dy },
              })
            );
          }
          domainDragStartRef.current = null;
        }
        try {
          await Promise.all(saves);
        } catch {
          toast.error('位置保存失败');
        }
        return;
      }

      // entity 节点：AABB 命中检测，保存位置 + 更新域归属
      const entityCenterX = node.position.x + NODE_WIDTH / 2;
      const entityCenterY = node.position.y + estimateNodeHeight(
        (node.data as { fields?: unknown[] }).fields?.length ?? 0
      ) / 2;

      let hitDomainId: string | null = null;
      for (const domainNode of nodesRef.current) {
        if (domainNode.type !== 'domain') continue;
        const dx = domainNode.position.x;
        const dy = domainNode.position.y;
        const dw = (domainNode.style?.width as number) ?? 400;
        const dh = (domainNode.style?.height as number) ?? 300;
        if (
          entityCenterX >= dx &&
          entityCenterX <= dx + dw &&
          entityCenterY >= dy &&
          entityCenterY <= dy + dh
        ) {
          hitDomainId = domainNode.id;
          break;
        }
      }

      // 获取当前实体在 erGraph 中的旧 domainId
      const oldDomainId = erGraphRef.current?.entities?.find((e) => e.id === node.id)?.data?.domainId ?? null;

      try {
        // 并行保存位置 + 若 domain 归属有变化则更新
        const saves: Promise<unknown>[] = [
          updateEntity(node.id, {
            canvasPosition: { x: node.position.x, y: node.position.y },
          }),
        ];
        if (hitDomainId !== oldDomainId) {
          saves.push(updateEntityDomain(node.id, hitDomainId));
        }
        await Promise.all(saves);
      } catch {
        toast.error('位置保存失败');
      }
    },
    500
  );

  // 点击节点：domain 节点选中领域，entity 节点选中实体
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === 'domain') {
        selectDomain(node.id);
      } else {
        selectEntity(node.id);
      }
    },
    [selectDomain, selectEntity]
  );

  // 点击画布空白：取消所有选中，并记录点击位置（用于新建对象放置定位）
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    selectEntity(null);
    selectRelation(null);
    selectDomain(null);
    // 将屏幕坐标转换为画布坐标并记录
    const rf = rfInstanceRef.current;
    if (rf) {
      const pos = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      lastCanvasClickRef.current = pos;
    }
  }, [selectEntity, selectRelation, selectDomain, rfInstanceRef, lastCanvasClickRef]);

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
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop as unknown as OnNodeDrag}
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
          pannable
          zoomable
          position="bottom-right"
          style={{ width: 160, height: 100 }}
          nodeColor={(node) => {
            // 领域框节点在 MiniMap 中使用领域色
            if (node.type === 'domain') return '#91caff';
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