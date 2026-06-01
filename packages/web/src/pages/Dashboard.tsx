/**
 * @module Dashboard
 * @description 系统首页 Dashboard：展示项目卡片网格，支持搜索/筛选/激活项目。
 *
 * 这是系统的入口页面。用户在此选择并激活一个项目上下文，
 * 激活后系统进入项目层，左侧菜单切换为项目驱动菜单。
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, FolderKanban, MoreHorizontal } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { CreateProjectDialog } from '@/components/project/CreateProjectDialog';
import { ArchiveConfirmDialog } from '@/components/project/ArchiveConfirmDialog';
import { useProjectList } from '@/hooks/useProjectList';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ProjectListItem, Project } from '@apm/shared';

/** 状态筛选选项 */
const STATUS_FILTERS = [
  { key: '', label: '全部', value: '' },
  { key: 'active', label: '活跃', value: 'active' },
  { key: 'archived', label: '已归档', value: 'archived' },
];

/**
 * 项目卡片组件
 */
function ProjectCard({
  project,
  onActivate,
  onArchive,
  onRestore,
  onEdit,
}: {
  project: ProjectListItem;
  onActivate: (project: ProjectListItem) => void;
  onArchive: (project: ProjectListItem) => void;
  onRestore: (project: ProjectListItem) => void;
  onEdit: (project: ProjectListItem) => void;
}) {
  return (
    <div
      className={cn(
        'relative group rounded-card border bg-card p-5 transition-all duration-200',
        'hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 cursor-pointer'
      )}
      onClick={() => onActivate(project)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate(project);
        }
      }}
    >
      {/* 头部：名称 + 状态 + 操作菜单 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FolderKanban className="h-5 w-5 text-primary shrink-0" />
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {project.displayName}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge status={project.status} />
          {/* hover 时出现的操作菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  className={cn(
                    'h-6 w-6 flex items-center justify-center rounded',
                    'text-text-tertiary hover:text-text-primary hover:bg-muted',
                    'opacity-0 group-hover:opacity-100 transition-opacity',
                    'focus:opacity-100 focus:outline-none'
                  )}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="项目操作"
                />
              }
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={4}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {project.status === 'active' ? (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onActivate(project); }}>
                  进入项目
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onActivate(project); }}>
                  查看详情
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(project); }}>
                编辑基本信息
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {project.status === 'active' ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onArchive(project); }}
                >
                  归档
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRestore(project); }}>
                  恢复
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 标识符 */}
      <p className="text-xs text-text-tertiary font-mono mb-3 truncate">
        {project.name}
      </p>

      {/* 统计摘要 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <SummaryStat label="实体" count={project.summary.domainEntityCount} />
        <SummaryStat label="流程" count={project.summary.processCount} />
        <SummaryStat label="组织" count={project.summary.companyCount} />
      </div>

      {/* 版本 + 更新时间 */}
      <div className="flex items-center justify-between text-xs text-text-tertiary">
        <span>v{project.version}</span>
        <span>{formatDate(project.updatedAt)}</span>
      </div>
    </div>
  );
}

/** 统计数字组件 */
function SummaryStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-text-primary">{count}</div>
      <div className="text-[10px] text-text-tertiary">{label}</div>
    </div>
  );
}

/** 格式化日期 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Dashboard 页面：项目卡片网格 + 搜索/筛选
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { setActiveProject } = useProjectContext();
  const {
    data: projects,
    loading,
    error,
    params,
    setParams,
    refetch,
  } = useProjectList();

  // 创建项目对话框
  const [createOpen, setCreateOpen] = useState(false);

  // 搜索防抖（UI-M1-05：300ms）
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  useEffect(() => {
    setParams((p) => ({ ...p, search: debouncedSearch }));
  }, [debouncedSearch, setParams]);

  // 归档/恢复 dialog 状态
  const [archiveTarget, setArchiveTarget] = useState<ProjectListItem | null>(null);
  const [archiving, setArchiving] = useState(false);

  // 创建成功：激活项目 → 导航到项目概览
  const handleCreateSuccess = useCallback(
    async (project: Project) => {
      setCreateOpen(false);
      await setActiveProject(project.id);
      navigate(`/p/${project.id}`);
    },
    [setActiveProject, navigate]
  );

  // 激活项目：写入上下文 → 导航到项目概览
  const handleActivate = useCallback(
    async (project: ProjectListItem) => {
      await setActiveProject(project.id);
      navigate(`/p/${project.id}`);
    },
    [setActiveProject, navigate]
  );

  // 编辑基本信息：跳转到项目概览页
  const handleEdit = useCallback(
    async (project: ProjectListItem) => {
      await setActiveProject(project.id);
      navigate(`/p/${project.id}`);
    },
    [setActiveProject, navigate]
  );

  // 执行归档/恢复
  const handleArchiveConfirm = useCallback(async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const targetStatus = archiveTarget.status === 'active' ? 'archived' : 'active';
      await apiClient.patch(`/projects/${archiveTarget.id}/status`, {
        status: targetStatus,
        version: archiveTarget.version,
      });
      toast.success(
        targetStatus === 'archived'
          ? `「${archiveTarget.displayName}」已归档`
          : `「${archiveTarget.displayName}」已恢复`
      );
      refetch();
      setArchiveTarget(null);
    } catch {
      // 错误由 api-client 拦截器全局 toast 处理
    } finally {
      setArchiving(false);
    }
  }, [archiveTarget, refetch]);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-tertiary mt-1">
            选择一个项目以激活项目上下文
          </p>
        </div>
        <Button size="lg" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新建项目
        </Button>
      </div>

      {/* 搜索 + 筛选 */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="搜索项目名称..."
          className="flex-1 max-w-md h-9 px-3 text-sm rounded-md border border-border bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                params.status === filter.value
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:bg-muted'
              )}
              onClick={() => setParams((p) => ({ ...p, status: filter.value }))}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-card border border-danger bg-danger-bg p-3 text-sm text-danger">
          {error}
          <Button variant="link" className="ml-2 h-auto p-0 text-sm text-danger" onClick={refetch}>
            重试
          </Button>
        </div>
      )}

      {/* 项目卡片网格 */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[200px] rounded-card border bg-card animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-card border border-dashed border-border">
          <FolderKanban className="h-12 w-12 text-text-tertiary mb-3" />
          <p className="text-sm text-text-secondary">暂无项目</p>
          <p className="text-xs text-text-tertiary mt-1">点击上方「新建项目」创建第一个项目</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onActivate={handleActivate}
              onArchive={(p) => setArchiveTarget(p)}
              onRestore={(p) => setArchiveTarget(p)}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* 创建项目对话框 */}
      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* 归档/恢复确认对话框 */}
      {archiveTarget && (
        <ArchiveConfirmDialog
          open={!!archiveTarget}
          onOpenChange={(o) => { if (!o) setArchiveTarget(null); }}
          displayName={archiveTarget.displayName}
          currentStatus={archiveTarget.status}
          targetStatus={archiveTarget.status === 'active' ? 'archived' : 'active'}
          loading={archiving}
          onConfirm={handleArchiveConfirm}
        />
      )}
    </div>
  );
}
