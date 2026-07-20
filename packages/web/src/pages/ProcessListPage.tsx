/**
 * @module ProcessListPage
 * @description 业务流程列表页（F-M3）。
 *
 * 页面功能：
 * - 卡片视图展示流程列表（名称、状态 Badge、版本、节点/边数量、描述）
 * - 搜索（300ms 防抖）+ 状态筛选
 * - 创建流程弹窗（标识名 + 显示名称 + 描述）
 * - 删除流程确认弹窗
 * - 点击卡片 → 导航到编辑器
 *
 * 交互设计 Reference: business-process-interaction.md §2 流程列表页
 * PRD Reference: F-M3
 */

import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  GitBranch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PaginationComponent } from '@/components/common/PaginationComponent';
import { EmptyState } from '@/components/common/EmptyState';
import { useProcessList, useProcessCrud } from '@/hooks/useProcess';
import type { ProcessListItem, BusinessProcess, ProcessStatus } from '@apm/shared';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================
// 常量
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:      { label: '草稿',   className: 'bg-gray-100 text-gray-700' },
  active:     { label: '启用',   className: 'bg-green-100 text-green-700' },
  deprecated: { label: '已弃用', className: 'bg-red-100 text-red-700' },
};

// ============================================================
// 子组件：StatusBadge
// ============================================================

function StatusBadge({ status }: { status: ProcessStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        cfg ? cfg.className : 'bg-gray-100 text-gray-700',
      )}
    >
      {cfg ? cfg.label : status}
    </span>
  );
}

// ============================================================
// 子组件：ProcessCardGrid
// ============================================================

interface ProcessCardGridProps {
  processes: ProcessListItem[];
  onEdit: (process: ProcessListItem) => void;
  onDelete: (process: ProcessListItem) => void;
  onNavigate: (processId: string) => void;
}

function ProcessCardGrid({ processes, onEdit, onDelete, onNavigate }: ProcessCardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {processes.map((proc) => (
        <Card
          key={proc.id}
          className="group relative hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onNavigate(proc.id)}
        >
          <CardContent className="p-5">
            {/* 状态 Badge */}
            <div className="mb-3 flex items-center gap-2">
              <StatusBadge status={proc.status} />
              <span className="text-[10px] text-text-tertiary">v{proc.version}</span>
            </div>
            {/* 流程名称 */}
            <h3 className="text-[15px] font-semibold text-primary leading-snug truncate hover:underline">
              {proc.displayName}
            </h3>
            <p className="mt-0.5 text-xs text-text-tertiary font-mono truncate">
              {proc.name}
            </p>
            {/* 描述 */}
            {proc.description && (
              <p className="mt-2 text-xs text-text-secondary line-clamp-2">
                {proc.description}
              </p>
            )}
            {/* 节点/边计数 */}
            <p className="mt-2 text-xs text-text-tertiary">
              {proc.nodeCount} 节点 · {proc.edgeCount} 连线
            </p>
            {/* 操作按钮（hover 显示） */}
            <div className="mt-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => { e.stopPropagation(); onEdit(proc); }}
              >
                <Pencil className="h-3 w-3 mr-1" />
                编辑
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(proc); }}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                删除
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// 子组件：CreateProcessDialog
// ============================================================

interface CreateProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; displayName: string; description?: string }) => Promise<BusinessProcess>;
}

function CreateProcessDialog({ open, onOpenChange, onSubmit }: CreateProcessDialogProps) {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; displayName?: string }>({});

  useEffect(() => {
    if (!open) {
      setName('');
      setDisplayName('');
      setDescription('');
      setErrors({});
    }
  }, [open]);

  const validate = () => {
    const errs: { name?: string; displayName?: string } = {};
    if (!name.trim()) errs.name = '标识名不能为空';
    else if (!/^[a-z][a-z0-9-]*$/.test(name.trim())) errs.name = '只允许小写字母、数字和连字符，且以字母开头';
    if (!displayName.trim()) errs.displayName = '显示名称不能为空';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      const proc = await onSubmit({
        name: name.trim(),
        displayName: displayName.trim(),
        description: description.trim() || undefined,
      });
      onOpenChange(false);
      // 创建成功后导航到编辑器
      navigate(`/p/${projectId}/processes/${proc.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建流程</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-6 overflow-y-auto">
          <div className="space-y-1">
            <Label htmlFor="proc-name">标识名 <span className="text-destructive">*</span></Label>
            <Input
              id="proc-name"
              value={name}
              onChange={(e) => { setName((e.target as HTMLInputElement).value); setErrors((p) => ({ ...p, name: undefined })); }}
              placeholder="如：order-fulfillment"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="proc-display-name">显示名称 <span className="text-destructive">*</span></Label>
            <Input
              id="proc-display-name"
              value={displayName}
              onChange={(e) => { setDisplayName((e.target as HTMLInputElement).value); setErrors((p) => ({ ...p, displayName: undefined })); }}
              placeholder="如：订单履约流程"
            />
            {errors.displayName && <p className="text-xs text-destructive">{errors.displayName}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="proc-description">描述（可选）</Label>
            <Textarea
              id="proc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述该流程的用途..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// 子组件：DeleteProcessDialog
// ============================================================

interface DeleteProcessDialogProps {
  proc: ProcessListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => Promise<void>;
}

function DeleteProcessDialog({ proc, open, onOpenChange, onConfirm }: DeleteProcessDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    if (!proc) return;
    setDeleting(true);
    try {
      await onConfirm(proc.id);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  if (!proc) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除流程</AlertDialogTitle>
          <AlertDialogDescription>
            即将删除流程 <strong>{proc.displayName}</strong>（{proc.name}），此操作不可撤销。
            该流程下的所有节点、边和布局数据将被一并删除。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? '删除中...' : '确认删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================
// 子组件：EditProcessDialog
// ============================================================

interface EditProcessDialogProps {
  proc: ProcessListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, data: { displayName: string; description?: string | null }) => Promise<void>;
}

function EditProcessDialog({ proc, open, onOpenChange, onSubmit }: EditProcessDialogProps) {
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (open && proc) {
      setDisplayName(proc.displayName);
      setDescription(proc.description ?? '');
      setError(undefined);
    }
  }, [open, proc]);

  const handleSubmit = async () => {
    if (!proc) return;
    if (!displayName.trim()) { setError('显示名称不能为空'); return; }
    setSubmitting(true);
    try {
      await onSubmit(proc.id, {
        displayName: displayName.trim(),
        description: description.trim() || null,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!proc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑流程</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-6 overflow-y-auto">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-tertiary">标识名：</span>
            <span className="font-mono text-sm">{proc.name}</span>
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-display-name">显示名称 <span className="text-destructive">*</span></Label>
            <Input
              id="edit-display-name"
              value={displayName}
              onChange={(e) => { setDisplayName((e.target as HTMLInputElement).value); setError(undefined); }}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-description">描述（可选）</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// 主页面组件
// ============================================================

export default function ProcessListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProcessListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProcessListItem | null>(null);

  const {
    processes,
    meta,
    loading,
    params,
    setParams,
    refresh,
  } = useProcessList(projectId);

  const { createProcess, updateProcess, deleteProcess } = useProcessCrud(projectId);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setParams({ search: value });
  };

  const handleStatusFilter = (status: string) => {
    setParams({ status: params.status === status ? undefined : status });
  };

  const handleCreate = useCallback(
    async (data: { name: string; displayName: string; description?: string }) => {
      return createProcess(data);
    },
    [createProcess],
  );

  const handleUpdate = useCallback(
    async (id: string, data: { displayName: string; description?: string | null }) => {
      await updateProcess(id, data);
      refresh();
    },
    [updateProcess, refresh],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteProcess(id);
      refresh();
    },
    [deleteProcess, refresh],
  );

  // ===== 加载骨架屏 =====
  if (loading && processes.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ===== 页头 ===== */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-primary" />
            业务流程
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            管理项目的业务流程，使用泳道图可视化流程节点与连线
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          新建流程
        </Button>
      </div>

      {/* ===== 筛选栏 ===== */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearchChange((e.target as HTMLInputElement).value)}
            placeholder="搜索流程名称..."
            className="pl-8"
          />
        </div>

        {/* 状态筛选 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const isActive = params.status === key;
            return (
              <button
                key={key}
                onClick={() => handleStatusFilter(key)}
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer border',
                  isActive
                    ? cn(cfg.className, 'border-current')
                    : 'border-transparent bg-muted text-text-secondary hover:bg-muted/80',
                )}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== 流程列表 ===== */}
      {processes.length === 0 ? (
        <EmptyState
          title={params.search || params.status ? '没有匹配的流程' : '暂无流程'}
          description={params.search || params.status ? '尝试调整筛选条件' : '点击「新建流程」开始创建'}
          actionLabel="新建流程"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <ProcessCardGrid
          processes={processes}
          onEdit={(proc) => setEditTarget(proc)}
          onDelete={(proc) => setDeleteTarget(proc)}
          onNavigate={(processId) => navigate(`/p/${projectId}/processes/${processId}`)}
        />
      )}

      {/* ===== 分页 ===== */}
      {meta && meta.total > 0 && (
        <PaginationComponent
          total={meta.total}
          page={params.page ?? 1}
          pageSize={params.pageSize ?? 20}
          onPageChange={(page) => setParams({ page })}
          onPageSizeChange={(pageSize) => setParams({ pageSize, page: 1 })}
        />
      )}

      {/* ===== 弹窗 ===== */}
      <CreateProcessDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />

      <EditProcessDialog
        proc={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        onSubmit={handleUpdate}
      />

      <DeleteProcessDialog
        proc={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
