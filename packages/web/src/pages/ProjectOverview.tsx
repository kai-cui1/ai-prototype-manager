/**
 * @module ProjectOverview
 * @description 项目概览页（项目上下文下的默认页）。
 *
 * 展示项目基本信息（只读/行内编辑）+ 摘要统计卡片。
 * 原 ProjectDetail 的 overview tab 提取为独立页面。
 *
 * PRD Reference: F-M1-03 (查看详情) + F-M1-04 (编辑基本信息) + F-M1-05 (归档/恢复)
 */

import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SectionHeading } from '@/components/common/SectionHeading';
import { ProjectInfoCard } from '@/components/project/ProjectInfoCard';
import { SummaryCards } from '@/components/project/SummaryCards';
import { DetailSkeleton } from '@/components/project/DetailSkeleton';
import { ArchiveConfirmDialog } from '@/components/project/ArchiveConfirmDialog';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useProjectContext } from '@/contexts/ProjectContext';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

/**
 * 项目概览页：组装顶栏、基本信息（含行内编辑）、摘要统计。
 */
export default function ProjectOverview() {
  const { projectId } = useParams<{ projectId: string }>();
  const { clearActiveProject, refreshProject } = useProjectContext();
  const { project, summary, loading, updating, error, refetch, updateProject } = useProjectDetail(projectId);

  // F-M1-04: 行内编辑状态
  const [isEditing, setIsEditing] = useState(false);

  // F-M1-05: 归档/恢复状态
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // 进入/退出编辑模式
  const handleEditToggle = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  // 编辑保存回调
  const handleSave = useCallback(async (data: { name: string; displayName: string; description?: string | null }) => {
    await updateProject(data);
    setIsEditing(false);
    toast.success('项目信息已更新');
  }, [updateProject]);

  // 归档/恢复确认
  const handleArchiveConfirm = useCallback(async () => {
    if (!project) return;
    setArchiving(true);
    try {
      const targetStatus = project.status === 'active' ? 'archived' : 'active';
      await apiClient.patch(`/projects/${project.id}/status`, {
        status: targetStatus,
        version: project.version,
      });
      toast.success(targetStatus === 'archived' ? '项目已归档' : '项目已恢复');
      setArchiveDialogOpen(false);
      setIsEditing(false);
      await refetch();
      await refreshProject();
    } catch {
      // 错误由 api-client 拦截器全局 toast 处理
    } finally {
      setArchiving(false);
    }
  }, [project, refetch, refreshProject]);

  // ===== 加载态：骨架屏 =====
  if (loading) {
    return <DetailSkeleton />;
  }

  // ===== 错误态（含 404） =====
  if (error || !project) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={clearActiveProject} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回 Dashboard
        </Button>
        <div className="rounded-card border border-danger bg-[var(--danger-bg)] p-8 text-center">
          <p className="text-lg font-medium text-danger">{error || '项目不存在'}</p>
          <p className="mt-1 text-sm text-text-tertiary">
            请返回 Dashboard 重新选择项目
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===== Zone 1: Detail Header ===== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={clearActiveProject} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-[20px] font-semibold text-text-primary leading-snug">{project.displayName}</h1>
            <p className="text-xs text-text-tertiary mt-0.5">
              <span className="font-mono">({project.name})</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} />
          {project.status !== 'archived' && !isEditing && (
            <Button variant="outline" size="sm" onClick={handleEditToggle}>
              编辑
            </Button>
          )}
          {/* F-M1-05: 归档/恢复按钮 */}
          {project.status === 'active' ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setArchiveDialogOpen(true)}
            >
              归档项目
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setArchiveDialogOpen(true)}
            >
              恢复项目
            </Button>
          )}
        </div>
      </div>

      {/* Zone 2: 基本信息 */}
      <ProjectInfoCard
        project={project}
        isEditing={isEditing}
        updating={updating}
        onEditToggle={handleEditToggle}
        onSave={handleSave}
      />

      {/* Zone 3: 摘要统计 */}
      {summary && (
        <>
          <SectionHeading title="模块统计" />
          <SummaryCards summary={summary} />
        </>
      )}

      {/* F-M1-05: 归档/恢复确认对话框 */}
      <ArchiveConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        displayName={project.displayName}
        currentStatus={project.status}
        targetStatus={project.status === 'active' ? 'archived' : 'active'}
        loading={archiving}
        onConfirm={handleArchiveConfirm}
      />
    </div>
  );
}
