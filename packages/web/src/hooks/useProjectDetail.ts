/**
 * @module useProjectDetail
 * @description 项目详情数据获取 Hook：并行请求详情 + 摘要统计（B-M1-16）+ 编辑项目（F-M1-04）。
 */
import { useState, useEffect, useCallback } from 'react';
import type { Project, ProjectSummary, UpdateProjectInput } from '@apm/shared';
import { apiClient } from '@/lib/api-client';

interface UseProjectDetailReturn {
  project: Project | null;
  summary: ProjectSummary | null;
  loading: boolean;
  updating: boolean;
  error: string | null;
  refetch: () => void;
  updateProject: (data: UpdateProjectInput) => Promise<Project>;
}

/**
 * 项目详情数据获取 Hook。
 *
 * B-M1-16: 详情和摘要通过 Promise.all 并行请求，减少 RTT。
 * - project 不存在时（404）error 记录错误信息，project 为 null
 * - summary 依赖 project 存在（同一 projectId）
 *
 * F-M1-04: 暴露 updateProject 方法供行内编辑调用，
 *          编辑成功后自动 refetch 刷新数据。
 */
export function useProjectDetail(projectId: string | undefined): UseProjectDetailReturn {
  const [project, setProject] = useState<Project | null>(null);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // B-M1-16: 并行请求详情 + 摘要
        const [detailRes, summaryRes] = await Promise.all([
          apiClient.get<{ data: Project }>(`/projects/${projectId}`),
          apiClient.get<{ data: ProjectSummary }>(`/projects/${projectId}/summary`),
        ]);

        if (!cancelled) {
          setProject(detailRes.data.data);
          setSummary(summaryRes.data.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => { cancelled = true; };
  }, [projectId]);

  // refetch：重新触发 fetchData
  const refetch = useCallback(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [detailRes, summaryRes] = await Promise.all([
          apiClient.get<{ data: Project }>(`/projects/${projectId}`),
          apiClient.get<{ data: ProjectSummary }>(`/projects/${projectId}/summary`),
        ]);
        setProject(detailRes.data.data);
        setSummary(summaryRes.data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  // F-M1-04: 编辑项目（PUT /api/v1/projects/:id?version=N）
  // G-M1-07: version 从当前 project.version 读取，通过 query param 传递
  const updateProject = useCallback(async (data: UpdateProjectInput): Promise<Project> => {
    if (!projectId || !project) throw new Error('项目数据未加载');

    setUpdating(true);
    try {
      const res = await apiClient.put<{ data: Project }>(
        `/projects/${projectId}`,
        data,
        { params: { version: project.version } },
      );
      // 编辑成功后刷新详情 + 摘要
      refetch();
      return res.data.data;
    } finally {
      setUpdating(false);
    }
  }, [projectId, project, refetch]);

  return { project, summary, loading, updating, error, refetch, updateProject };
}
