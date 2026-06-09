/**
 * @module ExternalEntitiesPanel
 * @description 外部实体管理面板：独立管理外部实体 CRUD。
 *
 * 从 OrganizationPanel 拆分出来，作为 ExternalEntitiesPage 的内容组件。
 * 样式与 RolesPage 统一：页面级抬头 + 搜索筛选 + 卡片网格。
 *
 * 归档保护：project.status === 'archived' 时隐藏所有新建/编辑/删除按钮。
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Globe, Search, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
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
import type { Project, ExternalEntity } from '@apm/shared';
import { useOrganization } from '@/hooks/useOrganization';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { toast } from 'sonner';

// ============================================================
// Constants
// ============================================================

/** 外部实体类型中文映射 */
const ENTITY_TYPE_LABELS: Record<string, string> = {
  system: '系统',
  organization: '组织机构',
  person: '个人角色',
  api: '接口',
};

/** 外部实体类型选项 */
const ENTITY_TYPE_OPTIONS = [
  { value: 'system', label: '系统' },
  { value: 'organization', label: '组织机构' },
  { value: 'person', label: '个人角色' },
  { value: 'api', label: '接口' },
];

/** 外部实体类型 → 语义色 Badge 变体映射 */
const ENTITY_TYPE_BADGE_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
  system: 'info',
  organization: 'success',
  person: 'warning',
  api: 'error',
};

// ============================================================
// Reusable: Entity Dialog (Create / Edit dual mode)
// ============================================================

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'textarea' | 'select';
  options?: { value: string; label: string }[];
}

interface EntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  mode: 'create' | 'edit';
  fields: FieldDef[];
  initialValues?: Record<string, string>;
  entityVersion?: number;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
  submitting?: boolean;
}

function EntityDialog({
  open, onOpenChange, title, mode, fields,
  initialValues, entityVersion, onSubmit, submitting,
}: EntityDialogProps) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    if (mode === 'edit' && initialValues) return { ...initialValues };
    const init: Record<string, string> = {};
    for (const f of fields) init[f.key] = '';
    return init;
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialValues) {
        setForm({ ...initialValues });
      } else {
        const init: Record<string, string> = {};
        for (const f of fields) init[f.key] = '';
        setForm(init);
      }
      setErrors({});
      setSubmitError(undefined);
    }
  }, [open, mode, initialValues]);

  const validateName = (val: string): string | undefined => {
    if (!val) return undefined;
    if (!/^[a-zA-Z0-9_-]{2,50}$/.test(val)) {
      return '仅允许字母、数字、下划线、连字符，2~50 字符';
    }
    return undefined;
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string | undefined> = {};
    for (const f of fields) {
      if (f.required && !form[f.key]) newErrors[f.key] = `请选择${f.type === 'select' ? '' : '输入'}${f.label}`;
    }
    const nameField = fields.find((f) => f.key === 'name');
    if (nameField && form[nameField.key]) {
      const nameErr = validateName(form[nameField.key]);
      if (nameErr) newErrors[nameField.key] = nameErr;
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    try {
      const payload: Record<string, unknown> = { ...form };
      if (mode === 'edit' && entityVersion !== undefined) {
        payload.version = entityVersion;
      }
      await onSubmit(payload);
      onOpenChange(false);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e.statusCode === 400 || e.statusCode === 409) {
        setSubmitError(e.message ?? '操作失败');
      } else {
        toast.error(e.message ?? '网络错误，请重试');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && e.nativeEvent.target instanceof HTMLInputElement) {
          e.preventDefault();
          handleSubmit();
        }
      }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{mode === 'create' ? '填写以下信息创建新记录' : '修改以下信息'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-[18px] px-6 py-5 overflow-y-auto">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>
                {f.label} {f.required && <span className="text-danger">*</span>}
              </Label>
              {f.type === 'textarea' ? (
                <Textarea
                  placeholder={f.placeholder}
                  value={form[f.key] ?? ''}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, [f.key]: (e.target as HTMLTextAreaElement).value }));
                    if (errors[f.key]) setErrors((prev) => ({ ...prev, [f.key]: undefined }));
                  }}
                  rows={3}
                  disabled={submitting}
                />
              ) : f.type === 'select' ? (
                <Select
                  value={form[f.key] ?? ''}
                  onValueChange={(val) => {
                    setForm((prev) => ({ ...prev, [f.key]: val ?? '' }));
                    if (errors[f.key]) setErrors((prev) => ({ ...prev, [f.key]: undefined }));
                  }}
                  disabled={submitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={f.placeholder ?? `请选择${f.label}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options ?? []).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={f.placeholder}
                  value={form[f.key] ?? ''}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, [f.key]: (e.target as HTMLInputElement).value }));
                    if (errors[f.key]) setErrors((prev) => ({ ...prev, [f.key]: undefined }));
                    if (f.key === 'name' && (e.target as HTMLInputElement).value) {
                      const err = validateName((e.target as HTMLInputElement).value);
                      if (err) setErrors((prev) => ({ ...prev, [f.key]: err }));
                    }
                  }}
                  disabled={submitting}
                />
              )}
              {errors[f.key] && <p className="text-sm text-danger">{errors[f.key]}</p>}
            </div>
          ))}
          {submitError && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{submitError}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : mode === 'create' ? '确认创建' : '保存修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Main Component
// ============================================================

interface ExternalEntitiesPanelProps {
  project: Project | null;
}

/**
 * 外部实体管理面板 — 独立页面组件。
 * 样式与 RolesPage 统一：页面级抬头 + 搜索筛选 + 卡片网格。
 */
export function ExternalEntitiesPanel({ project }: ExternalEntitiesPanelProps) {
  const org = useOrganization(project?.id ?? '');
  const navigate = useNavigate();

  // Filter states
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [typeFilter, setTypeFilter] = useState('__all__');

  // Dialog states
  const [eeDialogOpen, setEeDialogOpen] = useState(false);
  const [editEeTarget, setEditEeTarget] = useState<ExternalEntity | null>(null);
  const [deleteEeTarget, setDeleteEeTarget] = useState<ExternalEntity | null>(null);

  // Data loading
  useEffect(() => { if (project) org.refetchExternalEntities(); }, [project]);

  // Archive protection
  const isArchived = project?.status === 'archived';

  // Local filtering (debounced search + type filter)
  const filteredEntities = org.externalEntities.filter((e) => {
    const matchesSearch =
      !debouncedSearch ||
      e.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      e.displayName.toLowerCase().includes(debouncedSearch.toLowerCase());

    const matchesType =
      typeFilter === '__all__' || e.entityType === typeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* ===== 页头 ===== */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            外部实体管理
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            管理与本项目交互的外部系统、组织、接口或角色
          </p>
        </div>
        {!isArchived && (
          <Button size="sm" onClick={() => setEeDialogOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> 新建外部实体
          </Button>
        )}
      </div>

      {/* ===== 筛选栏 ===== */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary pointer-events-none" />
          <Input
            placeholder="搜索外部实体..."
            value={searchInput}
            onChange={(e) => setSearchInput((e.target as HTMLInputElement).value)}
            className="pl-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val ?? '__all__')}>
          <SelectTrigger className="w-[160px]">
            <span className="truncate text-sm">
              {typeFilter === '__all__'
                ? '全部类型'
                : ENTITY_TYPE_LABELS[typeFilter] ?? typeFilter}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部类型</SelectItem>
            {ENTITY_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ===== 外部实体卡片列表 ===== */}
      {org.externalEntitiesLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-card border border-card-border p-4 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : filteredEntities.length === 0 ? (
        <div className="py-16 text-center">
          <Globe className="mx-auto h-10 w-10 text-text-tertiary mb-3" />
          <p className="text-sm text-text-tertiary">
            {org.externalEntities.length === 0 ? '还没有外部实体，点击「新建外部实体」创建' : '没有匹配的外部实体'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEntities.map((e) => (
            <div
              key={e.id}
              className="group relative rounded-card border border-card-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => navigate(`/p/${project?.id}/external-entities/${e.id}`)}
            >
              {/* 操作按钮（hover 显示） */}
              {!isArchived && (
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-1 rounded text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"
                    onClick={(ev) => { ev.stopPropagation(); setEditEeTarget(e); }}
                    title="编辑"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                    onClick={(ev) => { ev.stopPropagation(); setDeleteEeTarget(e); }}
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* 卡片内容 */}
              <h3 className="font-semibold text-text-primary pr-14 truncate">{e.displayName}</h3>
              <div className="mt-1.5">
                {e.entityType && (
                  <Badge variant={ENTITY_TYPE_BADGE_VARIANT[e.entityType] ?? 'draft'} className="text-xs">
                    {ENTITY_TYPE_LABELS[e.entityType] ?? e.entityType}
                  </Badge>
                )}
              </div>
              {e.description && (
                <p className="mt-2 text-sm text-text-secondary line-clamp-2">{e.description}</p>
              )}
              <div className="mt-2 text-xs text-text-tertiary">
                {(e.actions?.length ?? 0) > 0 && <span>{e.actions!.length} 行为</span>}
                {(e.actions?.length ?? 0) > 0 && (e.decisions?.length ?? 0) > 0 && <span> · </span>}
                {(e.decisions?.length ?? 0) > 0 && <span>{e.decisions!.length} 决策</span>}
                {(e.actions?.length ?? 0) === 0 && (e.decisions?.length ?? 0) === 0 && <span>暂无行为定义</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Dialogs ===== */}

      {/* EE Create */}
      <EntityDialog
        open={eeDialogOpen}
        onOpenChange={setEeDialogOpen}
        title="新建外部实体"
        mode="create"
        fields={[
          { key: 'name', label: '名称标识', placeholder: '如 payment-gateway', required: true },
          { key: 'displayName', label: '显示名称', placeholder: '如 支付网关', required: true },
          { key: 'type', label: '类型', type: 'select', options: ENTITY_TYPE_OPTIONS, required: true },
          { key: 'description', label: '描述', placeholder: '...', type: 'textarea' },
        ]}
        onSubmit={async (data) => { const e = await org.createExternalEntity(data); toast.success(`外部实体「${e.displayName}」创建成功`); }}
      />

      {/* EE Edit */}
      <EntityDialog
        open={!!editEeTarget}
        onOpenChange={(o) => { if (!o) setEditEeTarget(null); }}
        title="编辑外部实体"
        mode="edit"
        initialValues={editEeTarget ? {
          name: editEeTarget.name,
          displayName: editEeTarget.displayName,
          type: editEeTarget.entityType ?? '',
          description: editEeTarget.description ?? '',
        } : undefined}
        entityVersion={editEeTarget?.version}
        fields={[
          { key: 'name', label: '名称标识', required: true },
          { key: 'displayName', label: '显示名称', required: true },
          { key: 'type', label: '类型', type: 'select', options: ENTITY_TYPE_OPTIONS, required: true },
          { key: 'description', label: '描述', type: 'textarea' },
        ]}
        onSubmit={async (data) => {
          if (!editEeTarget) return;
          const e = await org.updateExternalEntity(editEeTarget.id, data);
          toast.success(`外部实体「${e.displayName}」已更新`);
          setEditEeTarget(null);
        }}
      />

      {/* Delete EE AlertDialog */}
      <AlertDialog open={!!deleteEeTarget} onOpenChange={(o) => { if (!o) setDeleteEeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{deleteEeTarget?.displayName}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteEeTarget) return;
                await org.deleteExternalEntity(deleteEeTarget.id);
                toast.success(`外部实体「${deleteEeTarget.displayName}」已删除`);
                setDeleteEeTarget(null);
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
