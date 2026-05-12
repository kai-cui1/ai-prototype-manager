/**
 * @module ProjectDetail
 * @description 项目详情页面（F-M1-03 + F-M1-04）— §7.2 详情页模板
 *
 * 布局结构：
 *   ┌─────────────────────────────────────────────┐
 *   │ Detail Header: 返回 + 名称(ID) + 状态 + 操作 │
 *   ├─────────────────────────────────────────────┤
 *   │ InfoCard: 基本信息（只读 / 行内编辑）         │
 *   ├─────────────────────────────────────────────┤
 *   │ SectionHeading: 模块统计 → SummaryCards       │
 *   ├─────────────────────────────────────────────┤
 *   │ OrganizationPanel: Tab 切换组织管理           │
 *   └─────────────────────────────────────────────┘
 *
 * B-rule coverage: B-M1-14(完整字段) / B-M1-15(零计数显示) /
 *                  B-M1-16(并行请求) / B-M1-17(本地化时间戳) /
 *                  B-M1-18~B-M1-22(编辑校验) / G-M1-07(乐观锁)
 */
import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, Archive, RotateCcw } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SectionHeading } from '@/components/common/SectionHeading';
import { CodeCell } from '@/components/ui/table';
import { ProjectInfoCard } from '@/components/project/ProjectInfoCard';
import { SummaryCards } from '@/components/project/SummaryCards';
import { DetailSkeleton } from '@/components/project/DetailSkeleton';
import { OrganizationPanel } from '@/components/project/OrganizationPanel';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

/**
 * 项目详情页：组装顶栏、基本信息（含行内编辑）、摘要统计、组织区域。
 *
 * 布局区域：4 个（见 JSX 段落注释）
 */
export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, summary, loading, updating, error, refetch, updateProject } = useProjectDetail(projectId);

  // F-M1-04: 行内编辑状态
  const [isEditing, setIsEditing] = useState(false);

  // 进入编辑模式
  const handleEditToggle = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  // 编辑保存回调：调用 API → 成功则退出编辑态 + Toast
  const handleSave = useCallback(async (data: { name: string; displayName: string; description?: string | null }) => {
    await updateProject(data);
    setIsEditing(false);
    toast.success('项目信息已更新');
  }, [updateProject]);

  // 归档/恢复操作
  const handleArchiveToggle = useCallback(async () => {
    if (!project) return;
    const targetStatus = project.status === 'active' ? 'archived' : 'active';
    try {
      await apiClient.patch(`/projects/${project.id}/status`, {
        status: targetStatus,
        version: project.version,
      });
      toast.success(`项目已${targetStatus === 'archived' ? '归档' : '恢复'}`);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  }, [project, refetch]);

  // ===== 加载态：骨架屏 =====
  if (loading) {
    return <DetailSkeleton />;
  }

  // ===== 错误态（含 404） =====
  if (error || !project) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
        <div className="rounded-card border border-danger bg-[var(--danger-bg)] p-8 text-center">
          <p className="text-lg font-medium text-danger">{error || '项目不存在'}</p>
          <p className="mt-1 text-sm text-text-tertiary">
            请检查 URL 是否正确，或返回列表重新选择
          </p>
        </div>
      </div>
    );
  }

  // ===== 正常内容：§7.2 详情页布局 =====
  return (
    <div className="space-y-6">
      {/* ===== Zone 1: Detail Header — 返回 + 标题 + ID + 状态 + 操作按钮 ===== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-[20px] font-semibold text-text-primary leading-snug">{project.displayName}</h1>
            <p className="text-xs text-text-tertiary mt-0.5 flex items-center gap-2">
              <span className="font-mono">{project.name}</span>
              <CodeCell value={project.id} />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} />
          {/* 编辑按钮 */}
          {project.status !== 'archived' && !isEditing && (
            <Button variant="outline" size="sm" onClick={handleEditToggle}>
              <Pencil className="mr-2 h-4 w-4" />
              编辑
            </Button>
          )}
          {/* 归档/恢复按钮 */}
          <Button
            variant={project.status === 'archived' ? 'soft' : 'dangerGhost'}
            size="sm"
            onClick={handleArchiveToggle}
          >
            {project.status === 'archived' ? (
              <><RotateCcw className="mr-2 h-4 w-4" /> 恢复</>
            ) : (
              <><Archive className="mr-2 h-4 w-4" /> 归档</>
            )}
          </Button>
        </div>
      </div>

      {/* ===== Zone 2: 基本信息（只读 / 行内编辑） ===== */}
      <ProjectInfoCard
        project={project}
        isEditing={isEditing}
        updating={updating}
        onEditToggle={handleEditToggle}
        onSave={handleSave}
      />

      {/* ===== Zone 3: 摘要统计（6 个模块计数卡片） ===== */}
      {summary && (
        <>
          <SectionHeading title="模块统计" />
          <SummaryCards summary={summary} />
        </>
      )}

      {/* ===== Zone 4: 组织管理区域（F-M1-06~09） ===== */}
      <OrganizationPanel project={project} summary={summary} />
    </div>
  );
}
