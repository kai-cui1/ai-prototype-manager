/**
 * @module contexts/ProjectContext
 * @description 项目上下文管理：存储当前激活的项目 ID，
 *              持久化到 localStorage，刷新页面自动恢复。
 *
 * 核心语义：
 * - 全局层（无项目上下文）：Dashboard 页面，左侧菜单精简
 * - 项目层（有项目上下文）：路由 /p/:projectId/... 下的所有页面
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type { Project } from '@apm/shared';
import { apiClient } from '@/lib/api-client';

// ============================================================
// Types
// ============================================================

interface ProjectContextState {
  /** 当前激活的项目 ID（null 表示未激活） */
  activeProjectId: string | null;
  /** 当前激活的项目完整信息 */
  activeProject: Project | null;
  /** 正在加载项目信息 */
  isLoading: boolean;
}

interface ProjectContextActions {
  /** 激活指定项目（持久化到 localStorage） */
  setActiveProject: (projectId: string) => Promise<void>;
  /** 退出当前项目上下文（清除 localStorage） */
  clearActiveProject: () => void;
  /** 刷新当前项目信息 */
  refreshProject: () => Promise<void>;
}

type ProjectContextValue = ProjectContextState & ProjectContextActions;

// ============================================================
// Context
// ============================================================

const ProjectContext = createContext<ProjectContextValue | null>(null);

const STORAGE_KEY = 'activeProjectId';

// ============================================================
// Provider
// ============================================================

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 初始化：从 localStorage 恢复项目上下文
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setActiveProjectId(stored);
      fetchProject(stored);
    }
  }, []);

  // 拉取项目详情
  const fetchProject = useCallback(async (projectId: string) => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get<{ data: Project }>(`/projects/${projectId}`);
      setActiveProject(res.data.data);
    } catch (err) {
      // 项目不存在或已删除，清除上下文
      setActiveProjectId(null);
      setActiveProject(null);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 激活项目
  const setActiveProjectFn = useCallback(
    async (projectId: string) => {
      setActiveProjectId(projectId);
      localStorage.setItem(STORAGE_KEY, projectId);
      await fetchProject(projectId);
    },
    [fetchProject]
  );

  // 清除项目上下文
  const clearActiveProject = useCallback(() => {
    setActiveProjectId(null);
    setActiveProject(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // 刷新当前项目
  const refreshProject = useCallback(async () => {
    if (activeProjectId) {
      await fetchProject(activeProjectId);
    }
  }, [activeProjectId, fetchProject]);

  // activeProjectId 变化时同步更新 activeProject
  useEffect(() => {
    if (activeProjectId && !activeProject) {
      fetchProject(activeProjectId);
    }
  }, [activeProjectId, activeProject, fetchProject]);

  const value: ProjectContextValue = {
    activeProjectId,
    activeProject,
    isLoading,
    setActiveProject: setActiveProjectFn,
    clearActiveProject,
    refreshProject,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

// ============================================================
// Hook
// ============================================================

export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}
