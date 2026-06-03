/**
 * @module useApplications
 * @description 应用管理数据获取 Hook：列表查询 + 创建/编辑/删除操作（F-M1-11）。
 *
 * PRD Reference: F-M1-11 (应用管理 CRUD)
 * 交互设计 Reference: application-management-interaction.md
 *
 * 功能点：
 * - 列表（分页 + 搜索防抖 + 类型筛选）
 * - 创建应用（POST /projects/:projectId/applications）
 * - 编辑应用（PUT /projects/:projectId/applications/:id）
 * - 删除应用（DELETE /projects/:projectId/applications/:id，处理 409 引用冲突）
 */
import { useState, useCallback, useEffect } from 'react';
import type { Application } from '@apm/shared';
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
}

export interface UseApplicationsParams {
  search?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateApplicationInput {
  name: string;
  displayName: string;
  description?: string;
  type: string;
}

export interface UpdateApplicationInput {
  displayName: string;
  description?: string | null;
}

interface UseApplicationsReturn {
  applications: Application[];
  meta: ListMeta | null;
  loading: boolean;
  params: UseApplicationsParams;
  setParams: (updates: Partial<UseApplicationsParams>) => void;
  refresh: () => void;
  createApplication: (data: CreateApplicationInput) => Promise<Application>;
  updateApplication: (id: string, data: UpdateApplicationInput) => Promise<Application>;
  deleteApplication: (id: string) => Promise<void>;
}

// ============================================================
// Hook 实现
// ============================================================

/**
 * 应用管理列表 Hook。
 *
 * UI-M1-11: 搜索防抖 300ms；类型筛选即时生效。
 * UI-M1-14: 视图模式持久化由 ApplicationsPage 负责（Hook 只管数据）。
 */
export function useApplications(projectId: string | undefined): UseApplicationsReturn {
  const [applications, setApplications] = useState<Application[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [params, setParamsState] = useState<UseApplicationsParams>({
    page: 1,
    pageSize: 20,
  });

  // 搜索防抖 300ms（交互设计规格 UI-M1-11）
  const debouncedSearch = useDebouncedValue(params.search ?? '', 300);

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const query: Record<string, string | number> = {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      };
      if (debouncedSearch) query.search = debouncedSearch;
      if (params.type) query.type = params.type;

      const res = await apiClient.get<{ data: Application[]; meta: ListMeta }>(
        `/projects/${projectId}/applications`,
        { params: query },
      );
      setApplications(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, debouncedSearch, params.type, params.page, params.pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** 更新查询参数；搜索/类型变更时重置到第 1 页 */
  const setParams = useCallback((updates: Partial<UseApplicationsParams>) => {
    setParamsState((prev) => {
      const resetPage = 'search' in updates || 'type' in updates;
      return { ...prev, ...updates, ...(resetPage ? { page: 1 } : {}) };
    });
  }, []);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  /** 创建应用（F-M1-11 AC-M1-51~AC-M1-55） */
  const createApplication = useCallback(
    async (data: CreateApplicationInput): Promise<Application> => {
      const res = await apiClient.post<{ data: Application }>(
        `/projects/${projectId}/applications`,
        data,
      );
      toast.success('应用已创建');
      fetchData();
      return res.data.data;
    },
    [projectId, fetchData],
  );

  /** 编辑应用（F-M1-11 AC-M1-56~AC-M1-59） */
  const updateApplication = useCallback(
    async (id: string, data: UpdateApplicationInput): Promise<Application> => {
      const res = await apiClient.put<{ data: Application }>(
        `/projects/${projectId}/applications/${id}`,
        data,
      );
      toast.success('应用已更新');
      fetchData();
      return res.data.data;
    },
    [projectId, fetchData],
  );

  /**
   * 删除应用（F-M1-11 AC-M1-60~AC-M1-62）。
   *
   * 409 ENTITY_IN_USE：应用被流程节点引用，禁止删除 → 抛出错误让调用方展示弹窗提示。
   */
  const deleteApplication = useCallback(
    async (id: string): Promise<void> => {
      await apiClient.delete(`/projects/${projectId}/applications/${id}`);
      toast.success('应用已删除');
      fetchData();
    },
    [projectId, fetchData],
  );

  return {
    applications,
    meta,
    loading,
    params,
    setParams,
    refresh,
    createApplication,
    updateApplication,
    deleteApplication,
  };
}
