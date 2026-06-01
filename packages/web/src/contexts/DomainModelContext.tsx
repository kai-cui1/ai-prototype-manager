/**
 * @module contexts/DomainModelContext
 * @description 领域模型页面级上下文：管理实体选中、视图模式、搜索词等跨组件状态。
 *
 * Phase 1 不引入全局状态库，使用 useState + useCallback + Context 组合。
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import { useDomainModel } from '@/hooks/useDomainModel';
import type {
  EntitySummary,
  EntityDetail,
  ERGraphData,
  Field,
  Relation,
  FieldType,
} from '@/hooks/useDomainModel';

// ============================================================
// Types
// ============================================================

export type ViewMode = 'graph' | 'list';

export interface CanvasSettings {
  showRelationLabel: boolean;
}

const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  showRelationLabel: false,
};

function loadCanvasSettings(projectId: string): CanvasSettings {
  try {
    const raw = localStorage.getItem(`canvas-settings-${projectId}`);
    if (!raw) return DEFAULT_CANVAS_SETTINGS;
    return { ...DEFAULT_CANVAS_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CANVAS_SETTINGS;
  }
}

function saveCanvasSettings(projectId: string, settings: CanvasSettings) {
  localStorage.setItem(`canvas-settings-${projectId}`, JSON.stringify(settings));
}

interface DomainModelContextValue {
  // ---- 数据 ----
  entities: EntitySummary[];
  entitiesTotal: number;
  erGraph: ERGraphData | null;
  selectedEntity: EntityDetail | null;

  // ---- 加载状态 ----
  loadingEntities: boolean;
  loadingGraph: boolean;
  loadingDetail: boolean;

  // ---- 视图状态 ----
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // ---- 画布配置（F-M2-05）----
  canvasSettings: CanvasSettings;
  updateCanvasSettings: (patch: Partial<CanvasSettings>) => void;

  // ---- 选中状态 ----
  selectedEntityId: string | null;
  selectEntity: (id: string | null) => void;

  // ---- 关系选中状态（B-M2-F03-01：与实体选中互斥）----
  selectedRelationId: string | null;
  selectedRelation: Relation | null;
  selectRelation: (id: string | null) => void;

  // ---- 数据刷新 ----
  refetchEntities: () => void;
  refetchGraph: () => void;

  // ---- ReactFlow 实例引用（用于 fitView 等操作）----
  rfInstanceRef: React.MutableRefObject<ReactFlowInstance | null>;

  // ---- 数据操作（透传给子组件）----
  createEntity: (input: {
    name: string;
    displayName: string;
    description?: string;
    category?: string;
  }) => Promise<EntitySummary>;
  updateEntity: (
    entityId: string,
    input: {
      displayName?: string;
      description?: string;
      category?: string;
      canvasPosition?: { x: number; y: number } | null;
    }
  ) => Promise<EntitySummary>;
  deleteEntity: (entityId: string) => Promise<void>;
  createField: (
    entityId: string,
    input: {
      name: string;
      displayName: string;
      fieldType: FieldType;
      description?: string;
      isRequired?: boolean;
      defaultValue?: unknown;
      constraints?: Record<string, unknown>;
    }
  ) => Promise<Field>;
  updateField: (
    entityId: string,
    fieldId: string,
    input: {
      displayName?: string;
      description?: string;
      fieldType?: FieldType;
      isRequired?: boolean;
      defaultValue?: unknown;
      constraints?: Record<string, unknown>;
    }
  ) => Promise<Field>;
  deleteField: (entityId: string, fieldId: string) => Promise<void>;
  reorderFields: (entityId: string, orderedIds: string[]) => Promise<Field[]>;
  createRelation: (input: {
    sourceEntityId: string;
    targetEntityId: string;
    relationKind: 'association' | 'dependency' | 'aggregation' | 'composition';
    sourceCardinality?: string;
    targetCardinality?: string;
    displayName?: string;
    description?: string;
  }) => Promise<Relation>;
  updateRelation: (
    relationId: string,
    input: {
      relationKind?: 'association' | 'dependency' | 'aggregation' | 'composition';
      sourceCardinality?: string;
      targetCardinality?: string;
      displayName?: string | null;
      description?: string | null;
    }
  ) => Promise<Relation>;
  deleteRelation: (relationId: string) => Promise<void>;
}

// ============================================================
// Context
// ============================================================

const DomainModelContext = createContext<DomainModelContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface DomainModelProviderProps {
  projectId: string;
  children: ReactNode;
}

export function DomainModelProvider({ projectId, children }: DomainModelProviderProps) {
  const hook = useDomainModel(projectId);

  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<EntityDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  // 画布配置（从 localStorage 初始化，按项目隔离）
  const [canvasSettings, setCanvasSettings] = useState<CanvasSettings>(() =>
    loadCanvasSettings(projectId)
  );

  const updateCanvasSettings = useCallback(
    (patch: Partial<CanvasSettings>) => {
      setCanvasSettings((prev) => {
        const next = { ...prev, ...patch };
        saveCanvasSettings(projectId, next);
        return next;
      });
    },
    [projectId]
  );

  // 初始加载
  useEffect(() => {
    hook.fetchEntities();
    hook.fetchERGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // 搜索词变化重新拉取实体列表
  useEffect(() => {
    hook.fetchEntities({ search: searchQuery || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // 选中实体变化时拉取详情
  useEffect(() => {
    if (!selectedEntityId) {
      setSelectedEntity(null);
      return;
    }
    setLoadingDetail(true);
    hook
      .getEntityDetail(selectedEntityId)
      .then((detail) => setSelectedEntity(detail))
      .catch(() => setSelectedEntity(null))
      .finally(() => setLoadingDetail(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId]);

  const selectEntity = useCallback((id: string | null) => {
    setSelectedEntityId(id);
    // B-M2-F03-01：实体选中与关系选中互斥
    if (id !== null) setSelectedRelationId(null);
  }, []);

  const selectRelation = useCallback((id: string | null) => {
    setSelectedRelationId(id);
    // B-M2-F03-01：关系选中与实体选中互斥
    if (id !== null) setSelectedEntityId(null);
  }, []);

  // 从 erGraph + entities 构造 selectedRelation（避免额外 API 请求）
  const selectedRelation = useMemo<Relation | null>(() => {
    if (!selectedRelationId || !hook.erGraph) return null;
    const edge = hook.erGraph.relations?.find((r) => r.id === selectedRelationId);
    if (!edge) return null;
    const sourceEntity = hook.entities.find((e) => e.id === edge.source);
    const targetEntity = hook.entities.find((e) => e.id === edge.target);
    if (!sourceEntity || !targetEntity) return null;
    const data = edge.data as {
      relationKind: 'association' | 'dependency' | 'aggregation' | 'composition';
      sourceCardinality: string;
      targetCardinality: string;
      displayName?: string;
      description?: string;
    };
    return {
      id: edge.id,
      projectId,
      sourceEntityId: edge.source,
      sourceEntityName: sourceEntity.name,
      sourceEntityDisplayName: sourceEntity.displayName,
      targetEntityId: edge.target,
      targetEntityName: targetEntity.name,
      targetEntityDisplayName: targetEntity.displayName,
      relationKind: data.relationKind,
      sourceCardinality: data.sourceCardinality ?? '1',
      targetCardinality: data.targetCardinality,
      displayName: data.displayName ?? null,
      description: data.description ?? null,
      createdAt: '',
      updatedAt: '',
    };
  }, [selectedRelationId, hook.erGraph, hook.entities, projectId]);

  const refetchEntities = useCallback(() => {
    hook.fetchEntities({ search: searchQuery || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const refetchGraph = useCallback(() => {
    hook.fetchERGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 刷新 detail（字段/关系变更后调用）
  const refetchDetail = useCallback(() => {
    if (selectedEntityId) {
      hook.getEntityDetail(selectedEntityId).then(setSelectedEntity).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId]);

  // ---- 包装数据操作，成功后自动刷新 ----

  const createEntity = useCallback(
    async (input: Parameters<typeof hook.createEntity>[0]) => {
      const result = await hook.createEntity(input);
      hook.fetchEntities({ search: searchQuery || undefined });
      hook.fetchERGraph();
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchQuery]
  );

  const updateEntity = useCallback(
    async (entityId: string, input: Parameters<typeof hook.updateEntity>[1]) => {
      const result = await hook.updateEntity(entityId, input);
      hook.fetchEntities({ search: searchQuery || undefined });
      hook.fetchERGraph();
      if (selectedEntityId === entityId) {
        setSelectedEntity((prev) => (prev ? { ...prev, ...result } : prev));
      }
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchQuery, selectedEntityId]
  );

  const deleteEntity = useCallback(
    async (entityId: string) => {
      await hook.deleteEntity(entityId);
      if (selectedEntityId === entityId) {
        setSelectedEntityId(null);
        setSelectedEntity(null);
      }
      hook.fetchEntities({ search: searchQuery || undefined });
      hook.fetchERGraph();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchQuery, selectedEntityId]
  );

  const createField = useCallback(
    async (entityId: string, input: Parameters<typeof hook.createField>[1]) => {
      const result = await hook.createField(entityId, input);
      refetchDetail();
      hook.fetchERGraph();
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refetchDetail]
  );

  const updateField = useCallback(
    async (entityId: string, fieldId: string, input: Parameters<typeof hook.updateField>[2]) => {
      const result = await hook.updateField(entityId, fieldId, input);
      refetchDetail();
      hook.fetchERGraph();
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refetchDetail]
  );

  const deleteField = useCallback(
    async (entityId: string, fieldId: string) => {
      await hook.deleteField(entityId, fieldId);
      refetchDetail();
      hook.fetchERGraph();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refetchDetail]
  );

  const reorderFields = useCallback(
    async (entityId: string, orderedIds: string[]) => {
      const result = await hook.reorderFields(entityId, orderedIds);
      refetchDetail();
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refetchDetail]
  );

  const createRelation = useCallback(
    async (input: Parameters<typeof hook.createRelation>[0]) => {
      const result = await hook.createRelation(input);
      refetchDetail();
      hook.fetchERGraph();
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refetchDetail]
  );

  const updateRelation = useCallback(
    async (relationId: string, input: Parameters<typeof hook.updateRelation>[1]) => {
      const result = await hook.updateRelation(relationId, input);
      refetchDetail();
      hook.fetchERGraph();
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refetchDetail]
  );

  const deleteRelation = useCallback(
    async (relationId: string) => {
      await hook.deleteRelation(relationId);
      // 删除的是当前选中的关系时，清除选中态
      if (selectedRelationId === relationId) {
        setSelectedRelationId(null);
      }
      refetchDetail();
      hook.fetchERGraph();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refetchDetail, selectedRelationId]
  );

  const value: DomainModelContextValue = {
    entities: hook.entities,
    entitiesTotal: hook.entitiesTotal,
    erGraph: hook.erGraph,
    selectedEntity,
    loadingEntities: hook.loadingEntities,
    loadingGraph: hook.loadingGraph,
    loadingDetail,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    canvasSettings,
    updateCanvasSettings,
    selectedEntityId,
    selectEntity,
    selectedRelationId,
    selectedRelation,
    selectRelation,
    refetchEntities,
    refetchGraph,
    rfInstanceRef,
    createEntity,
    updateEntity,
    deleteEntity,
    createField,
    updateField,
    deleteField,
    reorderFields,
    createRelation,
    updateRelation,
    deleteRelation,
  };

  return <DomainModelContext.Provider value={value}>{children}</DomainModelContext.Provider>;
}

// ============================================================
// Hook
// ============================================================

export function useDomainModelContext(): DomainModelContextValue {
  const ctx = useContext(DomainModelContext);
  if (!ctx) throw new Error('useDomainModelContext must be used within DomainModelProvider');
  return ctx;
}
