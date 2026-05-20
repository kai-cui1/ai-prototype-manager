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
import {
  AlertDialog,
  AlertDialogContent,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Boxes, FileText, X } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SectionHeading } from '@/components/common/SectionHeading';
import { cn } from '@/lib/utils';
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

  // F-M1-05: 归档确认弹窗状态
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  // F-M1-03: Tab 导航状态（原型：概要 / 领域模型 / 业务流程 / 组织架构）
  const [activeTab, setActiveTab] = useState<'overview' | 'domain' | 'flow' | 'org'>('overview');

  const TABS = [
    { key: 'overview' as const, label: '概要' },
    { key: 'domain' as const, label: '领域模型' },
    { key: 'flow' as const, label: '业务流程' },
    { key: 'org' as const, label: '组织架构' },
  ];

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

  // F-M1-05: 打开归档确认弹窗
  const handleArchiveToggle = useCallback(() => {
    setShowArchiveDialog(true);
  }, []);

  // F-M1-05: 确认归档/恢复
  const handleArchiveConfirm = useCallback(async () => {
    if (!project) return;
    const targetStatus = project.status === 'active' ? 'archived' : 'active';
    try {
      await apiClient.patch(`/projects/${project.id}/status`, {
        status: targetStatus,
        version: project.version,
      });
      toast.success(`项目已${targetStatus === 'archived' ? '归档' : '恢复'}`);
      setShowArchiveDialog(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  }, [project, refetch]);

  // F-M1-05: 取消归档弹窗
  const handleArchiveCancel = useCallback(() => {
    setShowArchiveDialog(false);
  }, []);

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
            <p className="text-xs text-text-tertiary mt-0.5">
              <span className="font-mono">({project.name})</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} />
          {/* 编辑按钮（原型：纯文字，无图标） */}
          {project.status !== 'archived' && !isEditing && (
            <Button variant="outline" size="sm" onClick={handleEditToggle}>
              编辑
            </Button>
          )}
          {/* 归档/恢复按钮（原型：纯文字，无图标） */}
          <Button
            variant={project.status === 'archived' ? 'soft' : 'dangerGhost'}
            size="sm"
            onClick={handleArchiveToggle}
          >
            {project.status === 'archived' ? '恢复' : '归档'}
          </Button>
        </div>
      </div>

      {/* ===== Tab 导航栏（原型规格：底部 border + 激活态下划线） ===== */}
      <nav className="flex border-b border-divider mb-5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-5 py-2.5 text-sm transition-colors border-b-2 -mb-[1px]',
              activeTab === tab.key
                ? 'text-primary border-primary font-medium'
                : 'text-text-secondary border-transparent hover:text-text-primary'
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ===== Tab: 概要（基本信息 + 摘要统计） ===== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Zone 2: 基本信息（只读 / 行内编辑） */}
          <ProjectInfoCard
            project={project}
            isEditing={isEditing}
            updating={updating}
            onEditToggle={handleEditToggle}
            onSave={handleSave}
          />

          {/* Zone 3: 摘要统计（6 个模块计数卡片） */}
          {summary && (
            <>
              <SectionHeading title="模块统计" />
              <SummaryCards summary={summary} />
            </>
          )}
        </div>
      )}

      {/* ===== Tab: 领域模型（占位，M2 模块实现后填充） ===== */}
      {activeTab === 'domain' && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Boxes className="h-12 w-12 text-border-strong mb-3" />
          <p className="text-sm text-text-secondary">暂无领域模型</p>
          <p className="text-xs text-text-tertiary mt-1">请在「领域模型」模块中创建实体和关系</p>
        </div>
      )}

      {/* ===== Tab: 业务流程（占位，M3 模块实现后填充） ===== */}
      {activeTab === 'flow' && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="h-12 w-12 text-border-strong mb-3" />
          <p className="text-sm text-text-secondary">暂无业务流程</p>
          <p className="text-xs text-text-tertiary mt-1">请在「业务流程」模块中创建流程定义</p>
        </div>
      )}

      {/* ===== Tab: 组织架构（Zone 4: F-M1-06~09） ===== */}
      {activeTab === 'org' && (
        <OrganizationPanel project={project} summary={summary} />
      )}

      {/* ===== F-M1-05: 归档/恢复确认弹窗（AlertDialog） ===== */}
      {/* 原型规格: docs/03-prd-ux/prototypes/m1-project-detail.html §Archive Confirm Dialog
          布局结构：手写 header/body/footer，仅用 AlertDialog + Content 作为容器（遮罩+定位+圆角+无障碍），
          避免 base-ui AlertDialogHeader/Description/Footer 的内置 grid/text-center/muted 样式冲突。 */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent className="max-w-[400px] gap-0 p-0 overflow-hidden">
          {/* Header: flex space-between + 底部分割线（原型 .dialog-header） */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-base font-semibold text-foreground">
              {project?.status === 'archived' ? '确认恢复' : '确认归档'}
            </h2>
            <button
              onClick={handleArchiveCancel}
              className="size-7 inline-flex items-center justify-center rounded hover:bg-muted text-text-tertiary transition-colors"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body: 居中布局，宽松 padding（原型 .dialog-body: text-align:center; padding:32px 24px） */}
          <div className="text-center px-6 py-8">
            {/* 问句（原型 14px） */}
            <p className="text-sm text-foreground mb-2">
              {project?.status === 'archived' ? '确定要恢复以下项目吗？' : '确定要归档以下项目吗？'}
            </p>
            {/* 项目名独立突出显示（原型 16px 加粗） */}
            <p className="text-base font-semibold text-foreground mb-3">
              {project?.displayName}
            </p>
            {project?.status === 'archived' ? (
              <>
                {/* 恢复：普通提示色 */}
                <p className="text-sm text-foreground mt-2">恢复后项目将重新可编辑。</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  恢复后将重新出现在项目列表中，「编辑」按钮也将恢复可用。
                </p>
              </>
            ) : (
              <>
                {/* 归档：红色警告文字（原型 #ff4d4f, 13px, font-weight:500） */}
                <p className="text-[13px] font-medium text-destructive mt-3">
                  归档后该项目不可编辑，数据保留。
                </p>
                {/* 灰色辅助说明（原型 12px, text-muted） */}
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-[280px] mx-auto">
                  归档后该项目将不再出现在默认列表中，可在筛选「已归档」中查看。
                </p>
              </>
            )}
          </div>

          {/* Footer: 居中按钮，干净无背景无边框（原型 .dialog-footer: justify-content:center） */}
          <div className="flex items-center justify-center gap-3 px-6 py-4">
            <Button variant="outline" size="sm" onClick={handleArchiveCancel}>
              取消
            </Button>
            <Button
              variant={project?.status === 'archived' ? 'default' : 'destructive'}
              size="sm"
              onClick={handleArchiveConfirm}
            >
              {project?.status === 'archived' ? '确认恢复' : '确认归档'}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
