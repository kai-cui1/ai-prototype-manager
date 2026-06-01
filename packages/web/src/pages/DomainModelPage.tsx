/**
 * @module DomainModelPage
 * @description 领域模型管理页面路由入口（/p/:projectId/domain-model）。
 * 挂载 DomainModelProvider，渲染 DomainModelEditor。
 */

import { useParams } from 'react-router-dom';
import { DomainModelProvider } from '@/contexts/DomainModelContext';
import DomainModelEditor from '@/components/domain-model/DomainModelEditor';

export default function DomainModelPage() {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) return null;

  return (
    <DomainModelProvider projectId={projectId}>
      <DomainModelEditor />
    </DomainModelProvider>
  );
}
