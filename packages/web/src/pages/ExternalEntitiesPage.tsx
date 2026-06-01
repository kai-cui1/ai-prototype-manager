/**
 * @module ExternalEntitiesPage
 * @description 外部实体管理页面（项目上下文）。
 *
 * 从 OrganizationPanel 拆分出的独立页面，使用 ExternalEntitiesPanel 组件。
 */

import { useParams } from 'react-router-dom';
import { ExternalEntitiesPanel } from '@/components/project/ExternalEntitiesPanel';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { DetailSkeleton } from '@/components/project/DetailSkeleton';

export default function ExternalEntitiesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, loading, error } = useProjectDetail(projectId);

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

  return <ExternalEntitiesPanel project={project} />;
}
