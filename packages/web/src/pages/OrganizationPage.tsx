/**
 * @module OrganizationPage
 * @description 组织管理页面（项目上下文）。
 *
 * 原 ProjectDetail → OrganizationPanel 的 Tab 内容提取为独立页面。
 * 包含公司管理、部门树、角色管理。
 */

import { useParams } from 'react-router-dom';
import { OrganizationPanel } from '@/components/project/OrganizationPanel';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { DetailSkeleton } from '@/components/project/DetailSkeleton';

export default function OrganizationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, summary, loading, error } = useProjectDetail(projectId);

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error || !project) {
    return (
      <div className="rounded-card border border-danger bg-danger-bg p-8 text-center">
        <p className="text-lg font-medium text-danger">{error || '项目不存在'}</p>
      </div>
    );
  }

  return <div className="h-full flex flex-col"><OrganizationPanel project={project} summary={summary} /></div>;
}
