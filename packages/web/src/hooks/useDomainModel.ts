/**
 * @module hooks/useDomainModel
 * @description 领域模型数据获取 Hook —— 封装实体列表、ER 图、字段、关系的 CRUD 操作
 */

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

// ============================================================
// Types（与后端 Service 返回对齐）
// ============================================================

export interface EntitySummary {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string | null;
  sortOrder: number;
  fieldCount: number;
  relationCount: number;
  canvasPosition?: { x: number; y: number };
  createdAt: string;
  updatedAt: string;
}

export interface EntityDetail extends EntitySummary {
  fields: Field[];
  relations: Relation[];
}

export interface Field {
  id: string;
  entityId: string;
  name: string;
  displayName: string;
  description: string | null;
  fieldType: FieldType;
  isRequired: boolean;
  defaultValue: unknown;
  constraints: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type FieldType =
  | 'string' | 'number' | 'boolean' | 'datetime'
  | 'text' | 'enum' | 'email' | 'url' | 'phone';

export interface Relation {
  id: string;
  projectId: string;
  sourceEntityId: string;
  sourceEntityName: string;
  sourceEntityDisplayName: string;
  targetEntityId: string;
  targetEntityName: string;
  targetEntityDisplayName: string;
  relationKind: 'association' | 'dependency' | 'aggregation' | 'composition' | 'generalization';
  sourceCardinality: string;
  targetCardinality: string;
  displayName: string | null;
  description: string | null;
  dimension: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoundarySummary {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  canvasPosition: { x: number; y: number; width: number; height: number } | null;
  entityCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ERGraphData {
  entities: ERNode[];
  relations: EREdge[];
  domains: ERDomain[];
}

export interface ERNode {
  id: string;
  type: 'entity';
  position?: { x: number; y: number };
  data: {
    name: string;
    displayName: string;
    category?: string;
    domainId?: string;
    fields: Array<{
      id: string;
      name: string;
      displayName: string;
      fieldType: FieldType;
      isRequired: boolean;
    }>;
  };
}

export interface ERDomain {
  id: string;
  type: 'domain';
  position?: { x: number; y: number; width: number; height: number };
  data: {
    name: string;
    description?: string;
  };
}

export interface EREdge {
  id: string;
  source: string;
  target: string;
  data: {
    relationKind: 'association' | 'dependency' | 'aggregation' | 'composition' | 'generalization';
    sourceCardinality: string;
    targetCardinality: string;
    displayName?: string;
    description?: string;
    dimension?: string;
  };
}

// ============================================================
// Hook
// ============================================================

export function useDomainModel(projectId: string) {
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [entitiesTotal, setEntitiesTotal] = useState(0);
  const [boundaries, setBoundaries] = useState<BoundarySummary[]>([]);
  const [boundariesTotal, setBoundariesTotal] = useState(0);
  const [erGraph, setErGraph] = useState<ERGraphData | null>(null);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [loadingBoundaries, setLoadingBoundaries] = useState(false);
  const [loadingGraph, setLoadingGraph] = useState(false);

  // ---- 实体列表 ----

  const fetchEntities = useCallback(
    async (params?: { search?: string; category?: string; page?: number; pageSize?: number }) => {
      setLoadingEntities(true);
      try {
        const query = new URLSearchParams();
        if (params?.search) query.set('search', params.search);
        if (params?.category) query.set('category', params.category);
        if (params?.page) query.set('page', String(params.page));
        if (params?.pageSize) query.set('pageSize', String(params.pageSize));
        const res = await apiClient.get<{ data: EntitySummary[]; meta: { total: number } }>(
          `/projects/${projectId}/domain/entities?${query}`
        );
        setEntities(res.data.data);
        setEntitiesTotal(res.data.meta.total);
      } catch (err) {
        toast.error((err as Error).message || '加载实体列表失败');
      } finally {
        setLoadingEntities(false);
      }
    },
    [projectId]
  );

  // ---- ER 图 ----

  const fetchERGraph = useCallback(async () => {
    setLoadingGraph(true);
    try {
      const res = await apiClient.get<{ data: ERGraphData }>(
        `/projects/${projectId}/domain/er-graph`
      );
      setErGraph(res.data.data);
    } catch (err) {
      toast.error((err as Error).message || '加载 ER 图失败');
    } finally {
      setLoadingGraph(false);
    }
  }, [projectId]);

  // ---- 实体 CRUD ----

  const createEntity = useCallback(
    async (input: {
      name: string;
      displayName: string;
      description?: string;
      category?: string;
    }) => {
      const res = await apiClient.post<{ data: EntitySummary }>(
        `/projects/${projectId}/domain/entities`,
        input
      );
      return res.data.data;
    },
    [projectId]
  );

  const updateEntity = useCallback(
    async (
      entityId: string,
      input: {
        displayName?: string;
        description?: string;
        category?: string;
        canvasPosition?: { x: number; y: number } | null;
      }
    ) => {
      const res = await apiClient.put<{ data: EntitySummary }>(
        `/projects/${projectId}/domain/entities/${entityId}`,
        input
      );
      return res.data.data;
    },
    [projectId]
  );

  const deleteEntity = useCallback(
    async (entityId: string) => {
      await apiClient.delete(`/projects/${projectId}/domain/entities/${entityId}`);
    },
    [projectId]
  );

  const getEntityDetail = useCallback(
    async (entityId: string): Promise<EntityDetail> => {
      const res = await apiClient.get<{ data: EntityDetail }>(
        `/projects/${projectId}/domain/entities/${entityId}`
      );
      return res.data.data;
    },
    [projectId]
  );

  // ---- 字段 CRUD ----

  const createField = useCallback(
    async (
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
    ) => {
      const res = await apiClient.post<{ data: Field }>(
        `/projects/${projectId}/domain/entities/${entityId}/fields`,
        input
      );
      return res.data.data;
    },
    [projectId]
  );

  const updateField = useCallback(
    async (
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
    ) => {
      const res = await apiClient.put<{ data: Field }>(
        `/projects/${projectId}/domain/entities/${entityId}/fields/${fieldId}`,
        input
      );
      return res.data.data;
    },
    [projectId]
  );

  const deleteField = useCallback(
    async (entityId: string, fieldId: string) => {
      await apiClient.delete(
        `/projects/${projectId}/domain/entities/${entityId}/fields/${fieldId}`
      );
    },
    [projectId]
  );

  const reorderFields = useCallback(
    async (entityId: string, orderedIds: string[]) => {
      const res = await apiClient.patch<{ data: Field[] }>(
        `/projects/${projectId}/domain/entities/${entityId}/fields/reorder`,
        { orderedIds }
      );
      return res.data.data;
    },
    [projectId]
  );

  // ---- 关系 CRUD ----

  const createRelation = useCallback(
    async (input: {
      sourceEntityId: string;
      targetEntityId: string;
      relationKind: 'association' | 'dependency' | 'aggregation' | 'composition' | 'generalization';
      sourceCardinality?: string;
      targetCardinality?: string;
      displayName?: string;
      description?: string;
      dimension?: string;
    }) => {
      const res = await apiClient.post<{ data: Relation }>(
        `/projects/${projectId}/domain/relations`,
        input
      );
      return res.data.data;
    },
    [projectId]
  );

  const updateRelation = useCallback(
    async (
      relationId: string,
      input: {
        relationKind?: 'association' | 'dependency' | 'aggregation' | 'composition' | 'generalization';
        sourceCardinality?: string;
        targetCardinality?: string;
        displayName?: string | null;
        description?: string | null;
        dimension?: string | null;
      }
    ) => {
      const res = await apiClient.put<{ data: Relation }>(
        `/projects/${projectId}/domain/relations/${relationId}`,
        input
      );
      return res.data.data;
    },
    [projectId]
  );

  const deleteRelation = useCallback(
    async (relationId: string) => {
      await apiClient.delete(`/projects/${projectId}/domain/relations/${relationId}`);
    },
    [projectId]
  );

  // ---- 领域边界 CRUD ----

  const fetchBoundaries = useCallback(
    async (params?: { search?: string; page?: number; pageSize?: number }) => {
      setLoadingBoundaries(true);
      try {
        const query = new URLSearchParams();
        if (params?.search) query.set('search', params.search);
        if (params?.page) query.set('page', String(params.page));
        if (params?.pageSize) query.set('pageSize', String(params.pageSize));
        const res = await apiClient.get<{ data: BoundarySummary[]; meta: { total: number } }>(
          `/projects/${projectId}/domain/boundaries?${query}`
        );
        setBoundaries(res.data.data);
        setBoundariesTotal(res.data.meta.total);
      } catch (err) {
        toast.error((err as Error).message || '加载领域列表失败');
      } finally {
        setLoadingBoundaries(false);
      }
    },
    [projectId]
  );

  const createBoundary = useCallback(
    async (input: {
      name: string;
      description?: string;
      canvasPosition?: { x: number; y: number; width: number; height: number };
    }) => {
      const res = await apiClient.post<{ data: BoundarySummary }>(
        `/projects/${projectId}/domain/boundaries`,
        input
      );
      return res.data.data;
    },
    [projectId]
  );

  const updateBoundary = useCallback(
    async (
      boundaryId: string,
      input: {
        name?: string;
        description?: string | null;
        canvasPosition?: { x: number; y: number; width: number; height: number } | null;
      }
    ) => {
      const res = await apiClient.put<{ data: BoundarySummary }>(
        `/projects/${projectId}/domain/boundaries/${boundaryId}`,
        input
      );
      return res.data.data;
    },
    [projectId]
  );

  const deleteBoundary = useCallback(
    async (boundaryId: string) => {
      await apiClient.delete(`/projects/${projectId}/domain/boundaries/${boundaryId}`);
    },
    [projectId]
  );

  // ---- 实体领域归属 ----

  const updateEntityDomain = useCallback(
    async (entityId: string, domainId: string | null) => {
      const res = await apiClient.put<{ data: { entityId: string; domainId: string | null } }>(
        `/projects/${projectId}/domain/entities/${entityId}/domain`,
        { domainId }
      );
      return res.data.data;
    },
    [projectId]
  );

  return {
    // 数据
    entities,
    entitiesTotal,
    boundaries,
    boundariesTotal,
    erGraph,
    // 加载状态
    loadingEntities,
    loadingBoundaries,
    loadingGraph,
    // 操作
    fetchEntities,
    fetchBoundaries,
    fetchERGraph,
    createEntity,
    updateEntity,
    deleteEntity,
    getEntityDetail,
    createField,
    updateField,
    deleteField,
    reorderFields,
    createRelation,
    updateRelation,
    deleteRelation,
    createBoundary,
    updateBoundary,
    deleteBoundary,
    updateEntityDomain,
  };
}
