/**
 * @module ApplicationsPage
 * @description 应用管理页面（F-M1-11）。
 *
 * 页面功能：
 * - 双视图：卡片（默认）/ 表格，localStorage 持久化（UI-M1-14）
 * - 搜索（300ms 防抖）+ 类型筛选
 * - 创建/编辑/删除应用弹窗
 * - 删除 409 ENTITY_IN_USE 优雅提示
 *
 * 交互设计 Reference: application-management-interaction.md
 * PRD Reference: F-M1-11
 */

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  LayoutGrid,
  List,
  Plus,
  Search,
  Pencil,
  Trash2,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PaginationComponent } from '@/components/common/PaginationComponent';
import { EmptyState } from '@/components/common/EmptyState';
import { useApplications } from '@/hooks/useApplications';
import type { Application } from '@apm/shared';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================
// 常量：类型配置
// ============================================================

/** 应用类型 → 显示名称 + Badge 颜色（交互设计规格） */
const APP_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  web:     { label: 'Web 应用',    className: 'bg-blue-100 text-blue-700' },
  wxapp:   { label: '微信小程序',  className: 'bg-green-100 text-green-700' },
  android: { label: 'Android',    className: 'bg-emerald-100 text-emerald-700' },
  ios:     { label: 'iOS',        className: 'bg-slate-100 text-slate-700' },
  pc:      { label: 'PC 客户端',   className: 'bg-purple-100 text-purple-700' },
  api:     { label: 'API 服务',   className: 'bg-amber-100 text-amber-700' },
  service: { label: '后台服务',   className: 'bg-rose-100 text-rose-700' },
};

const APP_TYPES = Object.keys(APP_TYPE_CONFIG);

/** TypeSelector 7 个类型的卡片描述（创建弹窗用） */
const TYPE_SELECTOR_OPTIONS = [
  { type: 'web',     icon: '🌐', desc: '浏览器端 Web 应用' },
  { type: 'wxapp',   icon: '📱', desc: '微信小程序/H5' },
  { type: 'android', icon: '🤖', desc: 'Android 原生 App' },
  { type: 'ios',     icon: '🍎', desc: 'iOS 原生 App' },
  { type: 'pc',      icon: '🖥️', desc: 'PC 桌面客户端' },
  { type: 'api',     icon: '🔌', desc: 'REST / gRPC API' },
  { type: 'service', icon: '⚙️', desc: '后台服务 / Worker' },
];

/** name placeholder 按类型变化 */
const NAME_PLACEHOLDER: Record<string, string> = {
  web:     '如：user-portal',
  wxapp:   '如：mini-shop',
  android: '如：android-client',
  ios:     '如：ios-client',
  pc:      '如：desktop-app',
  api:     '如：payment-api',
  service: '如：notification-service',
};

const VIEW_MODE_KEY = 'apm-app-view-mode';
type ViewMode = 'card' | 'table';

// ============================================================
// 子组件：TypeBadge
// ============================================================

function TypeBadge({ type, className }: { type: string; className?: string }) {
  const cfg = APP_TYPE_CONFIG[type];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        cfg ? cfg.className : 'bg-gray-100 text-gray-700',
        className,
      )}
    >
      {cfg ? cfg.label : type}
    </span>
  );
}

// ============================================================
// 子组件：AppCardGrid（卡片视图）
// ============================================================

interface AppCardGridProps {
  applications: Application[];
  onEdit: (app: Application) => void;
  onDelete: (app: Application) => void;
}

function AppCardGrid({ applications, onEdit, onDelete }: AppCardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {applications.map((app) => (
        <Card key={app.id} className="group relative hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            {/* 类型 Badge */}
            <div className="mb-3">
              <TypeBadge type={app.type} />
            </div>
            {/* 应用名称 */}
            <h3 className="text-[15px] font-semibold text-text-primary leading-snug truncate">
              {app.displayName}
            </h3>
            <p className="mt-0.5 text-xs text-text-tertiary font-mono truncate">
              {app.name}
            </p>
            {/* 描述 */}
            {app.description && (
              <p className="mt-2 text-xs text-text-secondary line-clamp-2">
                {app.description}
              </p>
            )}
            {/* 操作按钮（hover 显示） */}
            <div className="mt-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onEdit(app)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                编辑
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => onDelete(app)}
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
// 子组件：AppTable（表格视图）
// ============================================================

interface AppTableProps {
  applications: Application[];
  onEdit: (app: Application) => void;
  onDelete: (app: Application) => void;
}

function AppTable({ applications, onEdit, onDelete }: AppTableProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>显示名称</TableHead>
            <TableHead>标识名</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>描述</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((app) => (
            <TableRow key={app.id}>
              <TableCell className="font-medium">{app.displayName}</TableCell>
              <TableCell className="font-mono text-xs text-text-tertiary">{app.name}</TableCell>
              <TableCell>
                <TypeBadge type={app.type} />
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-xs text-text-secondary">
                {app.description ?? '—'}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onEdit(app)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => onDelete(app)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    删除
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================
// 子组件：CreateApplicationDialog
// ============================================================

interface CreateApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; displayName: string; description?: string; type: string }) => Promise<void>;
}

function CreateApplicationDialog({ open, onOpenChange, onSubmit }: CreateApplicationDialogProps) {
  const [selectedType, setSelectedType] = useState('web');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; displayName?: string }>({});

  // 关闭时重置表单
  useEffect(() => {
    if (!open) {
      setSelectedType('web');
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
      await onSubmit({
        name: name.trim(),
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        type: selectedType,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>新建应用</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 p-6 overflow-y-auto">
          {/* TypeSelector：7 个类型卡片 */}
          <div>
            <Label className="mb-2 block text-sm font-medium">应用类型</Label>
            <div className="grid grid-cols-4 gap-2">
              {TYPE_SELECTOR_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setSelectedType(opt.type)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all cursor-pointer',
                    selectedType === opt.type
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50',
                  )}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="text-xs font-medium leading-tight">
                    {APP_TYPE_CONFIG[opt.type].label}
                  </span>
                  <span className="text-[10px] text-text-tertiary leading-tight">{opt.desc}</span>
                </button>
              ))}
              {/* 7 个选项：第 8 格占位（4 列布局） */}
              <div />
            </div>
          </div>

          {/* 标识名 */}
          <div className="space-y-1">
            <Label htmlFor="app-name">标识名 <span className="text-destructive">*</span></Label>
            <Input
              id="app-name"
              value={name}
              onChange={(e) => { setName((e.target as HTMLInputElement).value); setErrors((p) => ({ ...p, name: undefined })); }}
              placeholder={NAME_PLACEHOLDER[selectedType] ?? '如：my-app'}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* 显示名称 */}
          <div className="space-y-1">
            <Label htmlFor="app-display-name">显示名称 <span className="text-destructive">*</span></Label>
            <Input
              id="app-display-name"
              value={displayName}
              onChange={(e) => { setDisplayName((e.target as HTMLInputElement).value); setErrors((p) => ({ ...p, displayName: undefined })); }}
              placeholder="如：用户管理门户"
            />
            {errors.displayName && <p className="text-xs text-destructive">{errors.displayName}</p>}
          </div>

          {/* 描述 */}
          <div className="space-y-1">
            <Label htmlFor="app-description">描述（可选）</Label>
            <Textarea
              id="app-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述该应用的用途..."
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
// 子组件：EditApplicationDialog
// ============================================================

interface EditApplicationDialogProps {
  app: Application | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, data: { displayName: string; description?: string | null }) => Promise<void>;
}

function EditApplicationDialog({ app, open, onOpenChange, onSubmit }: EditApplicationDialogProps) {
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // 打开时同步表单数据
  useEffect(() => {
    if (open && app) {
      setDisplayName(app.displayName);
      setDescription(app.description ?? '');
      setError(undefined);
    }
  }, [open, app]);

  const handleSubmit = async () => {
    if (!app) return;
    if (!displayName.trim()) { setError('显示名称不能为空'); return; }
    setSubmitting(true);
    try {
      await onSubmit(app.id, {
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

  if (!app) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑应用</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-6 overflow-y-auto">
          {/* 类型只读显示（UI-M1-12） */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-tertiary">类型：</span>
            <TypeBadge type={app.type} />
          </div>

          {/* 显示名称 */}
          <div className="space-y-1">
            <Label htmlFor="edit-display-name">显示名称 <span className="text-destructive">*</span></Label>
            <Input
              id="edit-display-name"
              value={displayName}
              onChange={(e) => { setDisplayName((e.target as HTMLInputElement).value); setError(undefined); }}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          {/* 描述 */}
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
// 子组件：DeleteApplicationDialog
// ============================================================

interface DeleteApplicationDialogProps {
  app: Application | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 删除操作；若 409 则抛出错误 */
  onConfirm: (id: string) => Promise<void>;
}

function DeleteApplicationDialog({ app, open, onOpenChange, onConfirm }: DeleteApplicationDialogProps) {
  const [deleting, setDeleting] = useState(false);
  /** 409 引用冲突时的提示信息 */
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  useEffect(() => {
    // 每次打开时重置冲突提示（而非关闭时），避免退出动画期间文字闪烁
    if (open) setConflictMessage(null);
  }, [open]);

  const handleConfirm = async () => {
    if (!app) return;
    setDeleting(true);
    try {
      await onConfirm(app.id);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '删除失败';
      // 409 引用冲突：展示友好提示而非关闭弹窗
      setConflictMessage(msg);
    } finally {
      setDeleting(false);
    }
  };

  if (!app) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除应用</AlertDialogTitle>
          <AlertDialogDescription>
            {conflictMessage ? (
              <span className="text-destructive font-medium">{conflictMessage}</span>
            ) : (
              <>
                即将删除应用 <strong>{app.displayName}</strong>（{app.name}），此操作不可撤销。
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          {!conflictMessage && (
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleConfirm}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================
// 主页面组件
// ============================================================

/**
 * 应用管理页面。
 *
 * UI-M1-14: 视图模式（card / table）持久化到 localStorage。
 */
export default function ApplicationsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  // 视图模式持久化（UI-M1-14）
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_MODE_KEY) === 'table' ? 'table' : 'card';
    } catch {
      return 'card';
    }
  });

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* 存储失败静默忽略 */ }
  };

  // 搜索输入（即时值）
  const [searchInput, setSearchInput] = useState('');

  // 弹窗状态
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Application | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);

  const {
    applications,
    meta,
    loading,
    params,
    setParams,
    createApplication,
    updateApplication,
    deleteApplication,
  } = useApplications(projectId);

  // 搜索输入同步到 Hook params（防抖在 Hook 内处理）
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setParams({ search: value });
  };

  const handleTypeFilter = (type: string) => {
    setParams({ type: type === params.type ? undefined : type });
  };

  const handleCreate = useCallback(
    async (data: { name: string; displayName: string; description?: string; type: string }) => {
      await createApplication(data);
    },
    [createApplication],
  );

  const handleUpdate = useCallback(
    async (id: string, data: { displayName: string; description?: string | null }) => {
      await updateApplication(id, data);
    },
    [updateApplication],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteApplication(id);
    },
    [deleteApplication],
  );

  // ===== 加载骨架屏 =====
  if (loading && applications.length === 0) {
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
      {/* ===== 顶部操作栏 ===== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h1 className="text-[18px] font-semibold text-text-primary">应用管理</h1>
          {meta && (
            <span className="text-sm text-text-tertiary">（共 {meta.total} 个）</span>
          )}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          新建应用
        </Button>
      </div>

      {/* ===== 筛选栏 ===== */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* 搜索框 */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearchChange((e.target as HTMLInputElement).value)}
            placeholder="搜索应用名称..."
            className="pl-8"
          />
        </div>

        {/* 类型筛选（即时生效） */}
        <div className="flex flex-wrap items-center gap-1.5">
          {APP_TYPES.map((type) => {
            const cfg = APP_TYPE_CONFIG[type];
            const isActive = params.type === type;
            return (
              <button
                key={type}
                onClick={() => handleTypeFilter(type)}
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

        {/* 视图切换 */}
        <div className="flex items-center gap-0.5 ml-auto">
          <button
            onClick={() => switchView('card')}
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded border transition-colors cursor-pointer',
              viewMode === 'card'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-text-tertiary hover:border-primary/50',
            )}
            title="卡片视图"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => switchView('table')}
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded border transition-colors cursor-pointer',
              viewMode === 'table'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-text-tertiary hover:border-primary/50',
            )}
            title="表格视图"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ===== 应用列表 ===== */}
      {applications.length === 0 ? (
        <EmptyState
          title={params.search || params.type ? '没有匹配的应用' : '暂无应用'}
          description={params.search || params.type ? '尝试调整筛选条件' : '点击「新建应用」开始创建'}
        />
      ) : viewMode === 'card' ? (
        <AppCardGrid
          applications={applications}
          onEdit={(app) => setEditTarget(app)}
          onDelete={(app) => setDeleteTarget(app)}
        />
      ) : (
        <AppTable
          applications={applications}
          onEdit={(app) => setEditTarget(app)}
          onDelete={(app) => setDeleteTarget(app)}
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
      <CreateApplicationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />

      <EditApplicationDialog
        app={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        onSubmit={handleUpdate}
      />

      <DeleteApplicationDialog
        app={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
