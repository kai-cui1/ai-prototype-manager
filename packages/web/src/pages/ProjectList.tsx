/**
 * @module ProjectList
 * @description 项目列表页面（F-M1-01）— §7.1 列表页模板
 *
 * 布局结构：
 *   ┌─────────────────────────────────────────────┐
 *   │ PageHeader: 标题 + 新建按钮                  │  ← §7.1 第一行
 *   ├─────────────────────────────────────────────┤
 *   │ FilterBar: 搜索 + 状态筛选 Badge + 操作      │  ← §7.1 第二行（Card 包裹）
 *   ├─────────────────────────────────────────────┤
 *   │ DataTableContainer: Table + Pagination       │  ← §7.1 数据区域（Card 包裹）
 *   └─────────────────────────────────────────────┘
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { DataTableContainer } from '@/components/common/DataTableContainer';
import { ProjectTable } from '@/components/project/ProjectTable';
import { PaginationComponent } from '@/components/common/PaginationComponent';
import { EmptyState } from '@/components/common/EmptyState';
import { ArchiveConfirmDialog } from '@/components/project/ArchiveConfirmDialog';
import { CreateProjectDialog } from '@/components/project/CreateProjectDialog';
import { useProjectList } from '@/hooks/useProjectList';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { ProjectListItem, Project } from '@apm/shared';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

/** 筛选选项 — 对应 FilterBar FilterOption 接口 */
const STATUS_FILTERS = [
  { key: '', label: '全部', value: '' },
  { key: 'active', label: '活跃', value: 'active' },
  { key: 'archived', label: '已归档', value: 'archived' },
];

/**
 * 项目列表页面：组装 PageHeader + FilterBar + DataTableContainer + 分页器 +
 *              创建/归档对话框。
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
    <div className="space-y-4">
      {/* ===== §7.1 第一行：PageHeader ===== */}
      <PageHeader
        title="项目管理"
        action={
          <Button size="lg" onClick={handleCreate}>
            <Plus className="mr-2 h-[var(--icon-button-inline)] w-[var(--icon-button-inline)]" />
            新建项目
          </Button>
        }
      />

      {/* ===== §7.1 第二行：FilterBar（Card 包裹） ===== */}
      <FilterBar
        searchPlaceholder="搜索项目名称..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        filters={STATUS_FILTERS}
        activeFilter={params.status}
        onFilterChange={(key) => setParams((p) => ({ ...p, status: key }))}

      />

      {/* ===== 错误提示 ===== */}
      {error && (
        <div className="rounded-card border border-danger bg-[var(--danger-bg)] p-3 text-sm text-danger">
          {error}
          <Button variant="link" className="ml-2 h-auto p-0 text-sm text-danger" onClick={refetch}>
            重试
          </Button>
        </div>
      )}

      {/* ===== §7.1 数据区域：DataTableContainer ===== */}
      <DataTableContainer
        loading={loading && data.length === 0}
        empty={!loading && data.length === 0 && !error ? (
          <EmptyState onAction={handleCreate} />
        ) : undefined}
      >
        {!loading && data.length > 0 && !error && (
          <>
            <ProjectTable data={data} onArchive={handleArchiveClick} />
            {/* 分页在 DataTableContainer 内部底部 */}
            {meta && meta.total > 0 && (
              <div className="p-3">
                <PaginationComponent
                  total={meta.total}
                  page={meta.page}
                  pageSize={meta.pageSize}
                  onPageChange={(page) => setParams((p) => ({ ...p, page }))}
                  onPageSizeChange={(size) => setParams((p) => ({ ...p, pageSize: size, page: 1 }))}
                />
              </div>
            )}
          </>
        )}
      </DataTableContainer>

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
