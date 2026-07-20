/**
 * @module useArchitecture
 * @description 业务架构数据获取 Hook：Architecture CRUD + 流程映射操作（F-M4）。
 *
 * PRD Reference: F-M4 (业务架构管理)
 * Tech Design: docs/04-tech-design/modules/business-architecture/business-architecture-tech-design.md
 *
 * 子 Hook：
 * - useArchitectureTree  — 架构树列表（含关联流程）
 * - useArchitectureCrud  — 节点 CRUD
 * - useProcessSearch     — 流程模糊搜索（用于关联选择）
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useDebouncedValue } from './useDebouncedValue';

// ============================================================
// Types
// ============================================================

export interface ArchProcessRef {
  id: string;
  name: string;
  displayName: string;
  status: 'draft' | 'active' | 'deprecated';
  sortOrder: number;
}

export interface ArchitectureNode {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  displayName: string;
  description: string | null;
  level: string | null;
  sortOrder: number;
  processes: ArchProcessRef[];
  createdAt: string;
  updatedAt: string;
  /** 前端组装的子节点（非服务端返回） */
  children?: ArchitectureNode[];
}

export interface CreateArchitectureInput {
  name: string;
  displayName: string;
  description?: string;
  parentId?: string | null;
  level?: string;
}

export interface UpdateArchitectureInput {
  name?: string;
  displayName?: string;
  description?: string | null;
  level?: string | null;
}

export interface ProcessSearchItem {
  id: string;
  name: string;
  displayName: string;
  status: 'draft' | 'active' | 'deprecated';
}

// ============================================================
// 工具函数：扁平列表 → 树形结构
// ============================================================

/**
 * 将后端返回的扁平节点列表组装为树形结构。
 * 根节点（parentId === null）排在最外层，子节点嵌套于父节点的 children 中。
 */
export function buildArchTree(flat: ArchitectureNode[]): ArchitectureNode[] {
  const map = new Map<string, ArchitectureNode & { children: ArchitectureNode[] }>();
  for (const node of flat) {
    map.set(node.id, { ...node, children: [] });
  }

  const roots: (ArchitectureNode & { children: ArchitectureNode[] })[] = [];
  for (const node of flat) {
    const enriched = map.get(node.id)!;
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(enriched);
    } else {
      roots.push(enriched);
    }
  }

  // 子节点按 sortOrder 排序
  function sortChildren(nodes: (ArchitectureNode & { children: ArchitectureNode[] })[]) {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const n of nodes) sortChildren(n.children as (ArchitectureNode & { children: ArchitectureNode[] })[]);
  }
  sortChildren(roots);

  return roots;
}

// ============================================================
// useArchitectureTree
// ============================================================

interface UseArchitectureTreeResult {
  flatNodes: ArchitectureNode[];
  treeNodes: ArchitectureNode[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useArchitectureTree(projectId: string): UseArchitectureTreeResult {
  const [flatNodes, setFlatNodes] = useState<ArchitectureNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ data: ArchitectureNode[] }>(
        `/projects/${projectId}/architectures`,
      );
      setFlatNodes(res.data.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载业务架构失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const treeNodes = buildArchTree(flatNodes);

  return { flatNodes, treeNodes, loading, error, reload: load };
}

// ============================================================
// useArchitectureCrud
// ============================================================

interface UseArchitectureCrudResult {
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  addingProcess: boolean;
  removingProcess: boolean;
  reordering: boolean;
  createNode: (data: CreateArchitectureInput) => Promise<ArchitectureNode | null>;
  updateNode: (archId: string, data: UpdateArchitectureInput) => Promise<ArchitectureNode | null>;
  deleteNode: (archId: string) => Promise<boolean>;
  addProcess: (archId: string, processId: string) => Promise<ArchitectureNode | null>;
  removeProcess: (archId: string, processId: string) => Promise<boolean>;
  reorderProcesses: (archId: string, processIds: string[]) => Promise<ArchitectureNode | null>;
}

export function useArchitectureCrud(
  projectId: string,
  onSuccess?: () => void,
): UseArchitectureCrudResult {
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingProcess, setAddingProcess] = useState(false);
  const [removingProcess, setRemovingProcess] = useState(false);
  const [reordering, setReordering] = useState(false);

  const createNode = useCallback(async (data: CreateArchitectureInput): Promise<ArchitectureNode | null> => {
    setCreating(true);
    try {
      const res = await apiClient.post<{ data: ArchitectureNode }>(
        `/projects/${projectId}/architectures`,
        data,
      );
      toast.success(`架构节点 "${data.displayName}" 创建成功`);
      onSuccess?.();
      return res.data.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建失败';
      toast.error(msg);
      return null;
    } finally {
      setCreating(false);
    }
  }, [projectId, onSuccess]);

  const updateNode = useCallback(async (archId: string, data: UpdateArchitectureInput): Promise<ArchitectureNode | null> => {
    setUpdating(true);
    try {
      const res = await apiClient.patch<{ data: ArchitectureNode }>(
        `/projects/${projectId}/architectures/${archId}`,
        data,
      );
      toast.success('架构节点已更新');
      onSuccess?.();
      return res.data.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '更新失败';
      toast.error(msg);
      return null;
    } finally {
      setUpdating(false);
    }
  }, [projectId, onSuccess]);

  const deleteNode = useCallback(async (archId: string): Promise<boolean> => {
    setDeleting(true);
    try {
      await apiClient.delete(`/projects/${projectId}/architectures/${archId}`);
      toast.success('架构节点已删除');
      onSuccess?.();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除失败';
      toast.error(msg);
      return false;
    } finally {
      setDeleting(false);
    }
  }, [projectId, onSuccess]);

  const addProcess = useCallback(async (archId: string, processId: string): Promise<ArchitectureNode | null> => {
    setAddingProcess(true);
    try {
      const res = await apiClient.post<{ data: ArchitectureNode }>(
        `/projects/${projectId}/architectures/${archId}/processes`,
        { processId },
      );
      toast.success('流程关联成功');
      onSuccess?.();
      return res.data.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '关联失败';
      toast.error(msg);
      return null;
    } finally {
      setAddingProcess(false);
    }
  }, [projectId, onSuccess]);

  const removeProcess = useCallback(async (archId: string, processId: string): Promise<boolean> => {
    setRemovingProcess(true);
    try {
      await apiClient.delete(`/projects/${projectId}/architectures/${archId}/processes/${processId}`);
      toast.success('流程关联已解除');
      onSuccess?.();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '解除关联失败';
      toast.error(msg);
      return false;
    } finally {
      setRemovingProcess(false);
    }
  }, [projectId, onSuccess]);

  const reorderProcesses = useCallback(async (archId: string, processIds: string[]): Promise<ArchitectureNode | null> => {
    setReordering(true);
    try {
      const res = await apiClient.patch<{ data: ArchitectureNode }>(
        `/projects/${projectId}/architectures/${archId}/processes/order`,
        { processIds },
      );
      onSuccess?.();
      return res.data.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '排序失败';
      toast.error(msg);
      return null;
    } finally {
      setReordering(false);
    }
  }, [projectId, onSuccess]);

  return {
    creating, updating, deleting, addingProcess, removingProcess, reordering,
    createNode, updateNode, deleteNode, addProcess, removeProcess, reorderProcesses,
  };
}

// ============================================================
// useProcessSearch（F-M4-08）
// ============================================================

interface UseProcessSearchResult {
  query: string;
  setQuery: (q: string) => void;
  results: ProcessSearchItem[];
  searching: boolean;
}

/**
 * 流程模糊搜索 Hook（供架构节点关联面板使用）。
 * 300ms 防抖后发起请求，q 为空时不发请求并返回空数组。
 */
export function useProcessSearch(projectId: string): UseProcessSearchResult {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProcessSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const debouncedQ = useDebouncedValue(query, 300);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!debouncedQ.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setSearching(true);
    apiClient
      .get<{ data: ProcessSearchItem[] }>(`/projects/${projectId}/processes/search`, {
        params: { q: debouncedQ.trim() },
      })
      .then((res) => {
        if (!controller.signal.aborted) {
          setResults(res.data.data);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setResults([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });

    return () => controller.abort();
  }, [debouncedQ, projectId]);

  return { query, setQuery, results, searching };
}
