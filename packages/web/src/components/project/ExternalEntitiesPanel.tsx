/**
 * @module ExternalEntitiesPanel
 * @description 外部实体管理面板：独立管理外部实体 CRUD。
 *
 * 从 OrganizationPanel 拆分出来，作为 ExternalEntitiesPage 的内容组件。
 *
 * 归档保护：project.status === 'archived' 时隐藏所有新建/编辑/删除按钮。
 */

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Plus, UserPlus } from 'lucide-react';
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
import { SectionHeading } from '@/components/common/SectionHeading';
import type { Project, ExternalEntity } from '@apm/shared';
import { useOrganization } from '@/hooks/useOrganization';
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
 */
export function ExternalEntitiesPanel({ project }: ExternalEntitiesPanelProps) {
  const org = useOrganization(project?.id ?? '');

  // Dialog states
  const [eeDialogOpen, setEeDialogOpen] = useState(false);
  const [editEeTarget, setEditEeTarget] = useState<ExternalEntity | null>(null);
  const [deleteEeTarget, setDeleteEeTarget] = useState<ExternalEntity | null>(null);

  // Data loading
  useEffect(() => { if (project) org.refetchExternalEntities(); }, [project]);

  // Archive protection
  const isArchived = project?.status === 'archived';

  return (
    <div className="space-y-6">
      {/* ===== 外部实体表格 ===== */}
      <SectionHeading
        title="外部实体"
        icon={<UserPlus className="h-4 w-4" />}
        count={org.externalEntities.length}
        action={
          !isArchived ? (
            <Button size="sm" onClick={() => setEeDialogOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> 添加外部实体
            </Button>
          ) : undefined
        }
      />

      {org.externalEntitiesLoading ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>描述</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2].map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : org.externalEntities.length === 0 ? (
        <p className="text-sm text-text-tertiary py-8 text-center">暂无外部实体，点击「添加外部实体」创建</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>描述</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {org.externalEntities.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.displayName}</TableCell>
                <TableCell>
                  {e.entityType && (
                    <Badge variant={ENTITY_TYPE_BADGE_VARIANT[e.entityType] ?? 'draft'} className="text-xs">
                      {ENTITY_TYPE_LABELS[e.entityType] ?? e.entityType}
                    </Badge>
                  )}
                </TableCell>
                <TableCell title={e.description ?? ''}>{e.description ?? '-'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    {!isArchived && (
                      <>
                        <button
                          className="text-[13px] text-primary hover:text-primary-hover hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit"
                          onClick={() => setEditEeTarget(e)}
                        >
                          编辑
                        </button>
                        <button
                          className="text-[13px] text-danger hover:text-danger-hover hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit"
                          onClick={() => setDeleteEeTarget(e)}
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
