/**
 * @module useProjectList
 * @description 项目列表数据获取 Hook：封装 API 调用、分页参数管理、自动重置页码。
 */
import { useState, useCallback, useEffect } from 'react';
import type { ProjectListItem } from '@apm/shared';
import { apiClient } from '@/lib/api-client';

interface UseProjectListReturn {
  data: ProjectListItem[];
  meta: { total: number; page: number; pageSize: number } | null;
  loading: boolean;
  error: string | null;
  params: {
    search: string;
    status: string;
    page: number;
    pageSize: number;
    sort: string;
    order: 'asc' | 'desc';
  };
  setParams: (updater: (prev: UseProjectListReturn['params']) => UseProjectListReturn['params']) => void;
  refetch: () => void;
}

/**
 * 项目列表数据获取 Hook。
 *
 * - "All" 状态映射为空字符串（不传 status 参数给后端）
 * - search/status 变化时自动重置 page=1
 * - mount 时自动发起首次请求
 */
export function useProjectList(initialPageSize = 20): UseProjectListReturn {
  const [data, setData] = useState<ProjectListItem[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParamsRaw] = useState<UseProjectListReturn['params']>({
    search: '',
    status: '',
    page: 1,
    pageSize: initialPageSize,
    sort: 'updatedAt',
    order: 'desc',
  });

  // 包装 setParams：当 search/status 变化时重置 page=1
  const setParams = useCallback(
    (updater: (prev: UseProjectListReturn['params']) => UseProjectListReturn['params']) => {
      setParamsRaw((prev) => {
        const next = updater(prev);
        // 如果 search 或 status 变化了，重置到第 1 页
        if (next.search !== prev.search || next.status !== prev.status) {
          return { ...next, page: 1 };
        }
        return next;
      });
    },
    [],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 构建查询参数：空值字段不传（后端使用默认值）
      const query: Record<string, string | number> = {};
      if (params.search) query.search = params.search;
      if (params.status) query.status = params.status; // "All" → 不传
      query.page = params.page;
      query.pageSize = params.pageSize;
      if (params.sort) query.sort = params.sort;
      if (params.order) query.order = params.order;

      const res = await apiClient.get<{ data: ProjectListItem[]; meta: { total: number; page: number; pageSize: number } }>('/projects', { params: query });
      setData(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, meta, loading, error, params, setParams, refetch: fetchData };
}
