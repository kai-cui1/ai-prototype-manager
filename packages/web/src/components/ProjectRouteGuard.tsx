/**
 * @module ProjectRouteGuard
 * @description 项目路由守卫：未激活项目时访问 /p/:projectId/* 自动重定向到 Dashboard。
 */

import { Navigate, useParams } from 'react-router-dom';
import { useProjectContext } from '@/contexts/ProjectContext';
import type { ReactNode } from 'react';

interface ProjectRouteGuardProps {
  children: ReactNode;
}

/**
 * 项目路由守卫。
 *
 * - 如果已激活项目且 URL 中的 projectId 匹配 activeProjectId，则正常渲染
 * - 如果未激活项目或 projectId 不匹配，则重定向到 Dashboard
 */
export default function ProjectRouteGuard({ children }: ProjectRouteGuardProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeProjectId } = useProjectContext();

  if (!activeProjectId || activeProjectId !== projectId) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
