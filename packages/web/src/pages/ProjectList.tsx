/**
 * @module ProjectList
 * @description 项目列表页面（F-M1-01）：顶栏(搜索+筛选+新建) + 数据表格 +
 *              分页 + 空状态 + 归档确认对话框 + 骨架屏加载态。
 *
 * 布局区域：6 个（见 JSX 段落注释）
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search } from 'lucide-react';
import { ProjectTable } from '@/components/project/ProjectTable';
import { PaginationComponent } from '@/components/common/PaginationComponent';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ArchiveConfirmDialog } from '@/components/project/ArchiveConfirmDialog';
import { CreateProjectDialog } from '@/components/project/CreateProjectDialog';
import { useProjectList } from '@/hooks/useProjectList';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { ProjectListItem, Project } from '@apm/shared';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'active', label: '活跃' },
  { value: 'archived', label: '已归档' },
] as const;

/**
 * 项目列表页面：组装搜索栏、状态筛选、数据表格、分页器、
 *              创建项目对话框、归档确认对话框 + 骨架屏加载态。
 *
 * 布局区域：7 个（见 JSX 段落注释）
 */
export default function ProjectList() {
  const navigate = useNavigate();
  const {
    data,
    meta,
    loading,
    error,
    params,
    setParams,
    refetch,
  } = useProjectList();

  const [searchInput, setSearchInput] = useState(params.search);
  const debouncedSearch = useDebouncedValue(searchInput);

  // 同步防抖后的搜索值到 params
  useEffect(() => {
    if (debouncedSearch !== params.search) {
      setParams((p) => ({ ...p, search: debouncedSearch }));
    }
  }, [debouncedSearch, params.search, setParams]);

  // 归档对话框状态
  const [archiveTarget, setArchiveTarget] = useState<ProjectListItem | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // 搜索输入变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  // 状态筛选
  const handleStatusChange = (status: string) => {
    setParams((p) => ({ ...p, status }));
  };

  // 打开归档确认
  const handleArchiveClick = useCallback((project: ProjectListItem) => {
    setArchiveTarget(project);
  }, []);

  // 执行归档/恢复
  const handleArchiveConfirm = useCallback(async () => {
    if (!archiveTarget) return;
    setArchiveLoading(true);
    try {
      const targetStatus = archiveTarget.status === 'active' ? 'archived' : 'active';
      await apiClient.patch(`/projects/${archiveTarget.id}/status`, {
        status: targetStatus,
        version: archiveTarget.version,
      });
      toast.success(`项目「${archiveTarget.displayName}」已${targetStatus === 'archived' ? '归档' : '恢复'}`);
      setArchiveTarget(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setArchiveLoading(false);
    }
  }, [archiveTarget, refetch]);

  // 创建对话框状态
  const [createOpen, setCreateOpen] = useState(false);

  // 打开创建对话框
  const handleCreate = () => {
    setCreateOpen(true);
  };

  // 创建成功回调：Toast + 关闭对话框 + 刷新列表 + 跳转详情页
  const handleCreateSuccess = useCallback((project: Project) => {
    toast.success(`项目「${project.displayName}」创建成功`);
    setCreateOpen(false);
    refetch();
    // B-M1-12: 导航到项目详情页
    navigate(`/projects/${project.id}`);
  }, [refetch, navigate]);

  return (
    <div className="space-y-4 p-6">
      {/* ===== 顶栏：搜索 + 状态筛选 + 新建按钮 ===== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索项目名称..."
            value={searchInput}
            onChange={handleSearchChange}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <Badge
                key={opt.value}
                variant={params.status === opt.value ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => handleStatusChange(opt.value)}
              >
                {opt.label}
              </Badge>
            ))}
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新建
          </Button>
        </div>
      </div>

      {/* ===== 错误提示 ===== */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
          <Button variant="link" className="ml-2 h-auto p-0 text-sm" onClick={refetch}>
            重试
          </Button>
        </div>
      )}

      {/* ===== 加载中：骨架屏 ===== */}
      {loading && !data.length ? <LoadingSkeleton /> : null}

      {/* ===== 数据表格（含空状态） ===== */}
      {!loading && data.length === 0 && !error ? (
        <EmptyState onAction={handleCreate} />
      ) : (
        !loading && <ProjectTable data={data} onArchive={handleArchiveClick} />
      )}

      {/* ===== 分页 ===== */}
      {meta && meta.total > 0 && (
        <PaginationComponent
          total={meta.total}
          page={meta.page}
          pageSize={meta.pageSize}
          onPageChange={(page) => setParams((p) => ({ ...p, page }))}
        />
      )}

      {/* ===== 归档确认对话框 ===== */}
      <ArchiveConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        displayName={archiveTarget?.displayName ?? ''}
        currentStatus={archiveTarget?.status ?? ''}
        targetStatus={archiveTarget?.status === 'active' ? 'archived' : 'active'}
        onConfirm={handleArchiveConfirm}
        loading={archiveLoading}
      />

      {/* ===== 创建项目对话框 ===== */}
      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
