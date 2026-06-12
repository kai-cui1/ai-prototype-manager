/**
 * @module useProcess
 * @description 业务流程数据获取 Hook：Process/Node/Edge/Layout/Validate 的 CRUD 操作（F-M3）。
 *
 * PRD Reference: F-M3 (业务流程管理)
 * Interaction: business-process-interaction.md
 *
 * 子 Hook：
 * - useProcessList — 流程列表（分页 + 搜索防抖）
 * - useProcessCrud — 流程 CRUD
 * - useProcessNodes — 节点 CRUD
 * - useProcessEdges — 边 CRUD
 * - useProcessLayout — 布局读写
 * - useProcessValidate — 验证
 */

import { useState, useCallback, useEffect } from 'react';
import type {
  BusinessProcess,
  ProcessNode,
  ProcessEdge,
  ProcessLayout,
  EdgeMapping,
} from '@apm/shared';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useDebouncedValue } from './useDebouncedValue';

// ============================================================
// Types
// ============================================================

interface ListMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UseProcessListParams {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateProcessInput {
  name: string;
  displayName: string;
  description?: string;
}

export interface UpdateProcessInput {
  displayName?: string;
  description?: string | null;
  status?: string;
}

export interface CreateNodeInput {
  nodeType: 'action' | 'decision';
  name: string;
  displayName: string;
  description?: string;
  holderType: 'role' | 'external_entity' | 'service';
  holderId: string;
  actionRef?: string;
  decisionRef?: string;
  condition?: string;
}

export interface UpdateNodeInput {
  displayName?: string;
  description?: string | null;
  holderType?: 'role' | 'external_entity' | 'service';
  holderId?: string;
  actionRef?: string | null;
  decisionRef?: string | null;
  condition?: string | null;
}

export interface CreateEdgeInput {
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  condition?: string;
  mappings?: EdgeMapping[];
  config?: Record<string, unknown>;
}

export interface UpdateEdgeInput {
  label?: string | null;
  condition?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  mappings?: EdgeMapping[];
}

export interface UpdateLayoutInput {
  orientation?: 'participant-horizontal' | 'participant-vertical';
  participantLanes?: ProcessLayout['participantLanes'];
  customLanes?: ProcessLayout['customLanes'];
  nodePositions?: ProcessLayout['nodePositions'];
  laneOverrides?: ProcessLayout['laneOverrides'];
}

export interface ValidationError {
  type: 'cycle' | 'orphan' | 'dangling_ref' | 'dangling' | 'missing_entry' | 'missing_exit';
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================
// useProcessList — 流程列表
// ============================================================

export function useProcessList(projectId: string | undefined) {
  const [processes, setProcesses] = useState<BusinessProcess[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [params, setParamsState] = useState<UseProcessListParams>({
    page: 1,
    pageSize: 20,
  });

  const debouncedSearch = useDebouncedValue(params.search ?? '', 300);

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const query: Record<string, string> = {
        page: String(params.page ?? 1),
        pageSize: String(params.pageSize ?? 20),
      };
      if (debouncedSearch) query.search = debouncedSearch;
      if (params.status) query.status = params.status;

      const res = await apiClient.get<{ data: BusinessProcess[]; meta: ListMeta }>(
        `/projects/${projectId}/processes`,
        { params: query },
      );
      setProcesses(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载流程列表失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, debouncedSearch, params.status, params.page, params.pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setParams = useCallback((updates: Partial<UseProcessListParams>) => {
    setParamsState((prev) => {
      const resetPage = 'search' in updates || 'status' in updates;
      return { ...prev, ...updates, ...(resetPage ? { page: 1 } : {}) };
    });
  }, []);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { processes, meta, loading, params, setParams, refresh };
}

// ============================================================
// useProcessCrud — 流程 CRUD
// ============================================================

export function useProcessCrud(projectId: string | undefined) {
  const createProcess = useCallback(
    async (data: CreateProcessInput): Promise<BusinessProcess> => {
      const res = await apiClient.post<{ data: BusinessProcess }>(
        `/projects/${projectId}/processes`,
        data,
      );
      toast.success('流程已创建');
      return res.data.data;
    },
    [projectId],
  );

  const getProcess = useCallback(
    async (processId: string): Promise<BusinessProcess> => {
      const res = await apiClient.get<{ data: BusinessProcess }>(
        `/projects/${projectId}/processes/${processId}`,
      );
      return res.data.data;
    },
    [projectId],
  );

  const updateProcess = useCallback(
    async (processId: string, data: UpdateProcessInput): Promise<BusinessProcess> => {
      const res = await apiClient.put<{ data: BusinessProcess }>(
        `/projects/${projectId}/processes/${processId}`,
        data,
      );
      toast.success('流程已更新');
      return res.data.data;
    },
    [projectId],
  );

  const deleteProcess = useCallback(
    async (processId: string): Promise<void> => {
      await apiClient.delete(`/projects/${projectId}/processes/${processId}`);
      toast.success('流程已删除');
    },
    [projectId],
  );

  return { createProcess, getProcess, updateProcess, deleteProcess };
}

// ============================================================
// useProcessNodes — 节点 CRUD
// ============================================================

export function useProcessNodes(projectId: string | undefined, processId: string | undefined) {
  const [nodes, setNodes] = useState<ProcessNode[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNodes = useCallback(async () => {
    if (!projectId || !processId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: ProcessNode[] }>(
        `/projects/${projectId}/processes/${processId}/nodes`,
      );
      setNodes(res.data.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载节点失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, processId]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const getNode = useCallback(
    async (nodeId: string): Promise<ProcessNode> => {
      const res = await apiClient.get<{ data: ProcessNode }>(
        `/projects/${projectId}/processes/${processId}/nodes/${nodeId}`,
      );
      return res.data.data;
    },
    [projectId, processId],
  );

  const createNode = useCallback(
    async (data: CreateNodeInput): Promise<ProcessNode> => {
      const res = await apiClient.post<{ data: ProcessNode }>(
        `/projects/${projectId}/processes/${processId}/nodes`,
        data,
      );
      toast.success('节点已创建');
      fetchNodes();
      return res.data.data;
    },
    [projectId, processId, fetchNodes],
  );

  const updateNode = useCallback(
    async (nodeId: string, data: UpdateNodeInput): Promise<ProcessNode> => {
      const res = await apiClient.put<{ data: ProcessNode }>(
        `/projects/${projectId}/processes/${processId}/nodes/${nodeId}`,
        data,
      );
      toast.success('节点已更新');
      fetchNodes();
      return res.data.data;
    },
    [projectId, processId, fetchNodes],
  );

  const deleteNode = useCallback(
    async (nodeId: string): Promise<void> => {
      await apiClient.delete(
        `/projects/${projectId}/processes/${processId}/nodes/${nodeId}`,
      );
      toast.success('节点已删除');
      fetchNodes();
    },
    [projectId, processId, fetchNodes],
  );

  return { nodes, loading, fetchNodes, getNode, createNode, updateNode, deleteNode };
}

// ============================================================
// useProcessEdges — 边 CRUD
// ============================================================

export function useProcessEdges(projectId: string | undefined, processId: string | undefined) {
  const [edges, setEdges] = useState<ProcessEdge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEdges = useCallback(async () => {
    if (!projectId || !processId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: ProcessEdge[] }>(
        `/projects/${projectId}/processes/${processId}/edges`,
      );
      setEdges(res.data.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载边失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, processId]);

  useEffect(() => {
    fetchEdges();
  }, [fetchEdges]);

  const getEdge = useCallback(
    async (edgeId: string): Promise<ProcessEdge> => {
      const res = await apiClient.get<{ data: ProcessEdge }>(
        `/projects/${projectId}/processes/${processId}/edges/${edgeId}`,
      );
      return res.data.data;
    },
    [projectId, processId],
  );

  const createEdge = useCallback(
    async (data: CreateEdgeInput): Promise<ProcessEdge> => {
      const res = await apiClient.post<{ data: ProcessEdge }>(
        `/projects/${projectId}/processes/${processId}/edges`,
        data,
      );
      toast.success('连线已创建');
      fetchEdges();
      return res.data.data;
    },
    [projectId, processId, fetchEdges],
  );

  const updateEdge = useCallback(
    async (edgeId: string, data: UpdateEdgeInput): Promise<ProcessEdge> => {
      const res = await apiClient.put<{ data: ProcessEdge }>(
        `/projects/${projectId}/processes/${processId}/edges/${edgeId}`,
        data,
      );
      toast.success('连线已更新');
      fetchEdges();
      return res.data.data;
    },
    [projectId, processId, fetchEdges],
  );

  const deleteEdge = useCallback(
    async (edgeId: string): Promise<void> => {
      await apiClient.delete(
        `/projects/${projectId}/processes/${processId}/edges/${edgeId}`,
      );
      toast.success('连线已删除');
      fetchEdges();
    },
    [projectId, processId, fetchEdges],
  );

  return { edges, loading, fetchEdges, getEdge, createEdge, updateEdge, deleteEdge };
}

// ============================================================
// useProcessLayout — 布局读写
// ============================================================

export function useProcessLayout(projectId: string | undefined, processId: string | undefined) {
  const [layout, setLayout] = useState<ProcessLayout | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLayout = useCallback(async () => {
    if (!projectId || !processId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: ProcessLayout }>(
        `/projects/${projectId}/processes/${processId}/layout`,
      );
      setLayout(res.data.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载布局失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, processId]);

  useEffect(() => {
    fetchLayout();
  }, [fetchLayout]);

  const updateLayout = useCallback(
    async (data: UpdateLayoutInput): Promise<ProcessLayout> => {
      const res = await apiClient.put<{ data: ProcessLayout }>(
        `/projects/${projectId}/processes/${processId}/layout`,
        data,
      );
      setLayout(res.data.data);
      return res.data.data;
    },
    [projectId, processId],
  );

  return { layout, loading, fetchLayout, updateLayout };
}

// ============================================================
// useProcessValidate — 验证
// ============================================================

export function useProcessValidate(projectId: string | undefined, processId: string | undefined) {
  const [validating, setValidating] = useState(false);

  const validate = useCallback(async (): Promise<ValidationResult> => {
    setValidating(true);
    try {
      const res = await apiClient.post<ValidationResult>(
        `/projects/${projectId}/processes/${processId}/validate`,
      );
      return res.data;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '验证失败');
      return { valid: false, errors: [{ type: 'cycle', message: '验证请求失败' }] };
    } finally {
      setValidating(false);
    }
  }, [projectId, processId]);

  return { validate, validating };
}

// ============================================================
// useHolderBehaviors — 获取参与者行为定义列表
// ============================================================

/**
 * Decision 分支选项。
 */
export interface DecisionBranchOption {
  name: string;
  condition?: string;
  outputs: Array<{ name: string; type: string; description?: string }>;
}

/** 行为选项（含 I/O 参数定义，用于映射配置） */
export interface BehaviorOption {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  inputs?: Array<{ name: string; type: string; description?: string; required?: boolean; defaultValue?: unknown }>;
  outputs?: Array<{ name: string; type: string; description?: string; required?: boolean; defaultValue?: unknown }>;
  logic?: { userDesc: string; data?: string };
  branches?: DecisionBranchOption[];
}

/**
 * 根据 holderType + holderId 获取参与者的 actions / decisions 列表。
 *
 * 用于 PropertyPanel 的 actionRef/decisionRef 下拉选择器，
 * 以及节点池拖拽创建时的行为选择。
 */
export function useHolderBehaviors(projectId: string | undefined) {
  const [actions, setActions] = useState<BehaviorOption[]>([]);
  const [decisions, setDecisions] = useState<BehaviorOption[]>([]);
  const [holderVersion, setHolderVersion] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  /** 获取指定参与者的行为列表 */
  const fetchBehaviors = useCallback(
    async (holderType: string, holderId: string) => {
      if (!projectId || !holderId) return;
      setLoading(true);
      try {
        const basePath =
          holderType === 'role'
            ? `/projects/${projectId}/roles/${holderId}`
            : holderType === 'service'
              ? `/projects/${projectId}/applications/${holderId}`
              : `/projects/${projectId}/external-entities/${holderId}`;

        // 使用 allSettled：任一请求失败不影响另一请求的结果
        const [actionsResult, decisionsResult] = await Promise.allSettled([
          apiClient.get<{ data: { items: BehaviorOption[]; version: number } }>(`${basePath}/actions`),
          apiClient.get<{ data: { items: BehaviorOption[]; version: number } }>(`${basePath}/decisions`),
        ]);
        setActions(actionsResult.status === 'fulfilled' ? (actionsResult.value.data.data?.items ?? []) : []);
        // decisions 保留完整的 branches 信息
        setDecisions(decisionsResult.status === 'fulfilled' ? (decisionsResult.value.data.data?.items ?? []) : []);
        // 行级 version（actions 与 decisions 共享同一行，取任意一个都行）
        const ver =
          (actionsResult.status === 'fulfilled' ? actionsResult.value.data.data?.version : undefined) ??
          (decisionsResult.status === 'fulfilled' ? decisionsResult.value.data.data?.version : undefined) ??
          1;
        setHolderVersion(ver);
      } catch {
        setActions([]);
        setDecisions([]);
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  return { actions, decisions, holderVersion, loading, fetchBehaviors };
}
