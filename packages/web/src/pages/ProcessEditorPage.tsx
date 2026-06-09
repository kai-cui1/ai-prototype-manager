/**
 * @module ProcessEditorPage
 * @description 业务流程编辑器页面 — 挂载 ProcessEditorProvider + ProcessEditor。
 *
 * 路由: /p/:projectId/processes/:processId
 */

import { useParams } from 'react-router-dom';
import { ProcessEditorProvider } from '@/contexts/ProcessEditorContext';
import ProcessEditor from '@/components/process-editor/ProcessEditor';

export default function ProcessEditorPage() {
  const { projectId, processId } = useParams<{
    projectId: string;
    processId: string;
  }>();

  if (!projectId || !processId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        缺少 projectId 或 processId
      </div>
    );
  }

  return (
    <ProcessEditorProvider projectId={projectId} processId={processId}>
      <ProcessEditor />
    </ProcessEditorProvider>
  );
}
