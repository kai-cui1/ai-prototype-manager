/**
 * @module OrganizationPanel
 * @description 组织架构面板：公司管理 + 部门管理（F-M1-06~07）
 *
 * 布局结构：左右 Master-Detail 分栏
 *   左侧（w-[280px]）：公司卡片列表 + 搜索框
 *   右侧（flex-1）：选中公司的部门树；未选中时显示空状态
 *
 * 外部实体管理已拆分到 ExternalEntitiesPanel。
 *
 * 归档保护：project.status === 'archived' 时隐藏所有新建/编辑/删除按钮。
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
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
import { Plus, Search, Building2, Pencil, Trash2 } from 'lucide-react';
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
import { DepartmentTree } from '@/components/organization/DepartmentTree';
import type { Project, Company, Department } from '@apm/shared';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================
// Reusable: Entity Dialog (Create / Edit dual mode)
// ============================================================

interface EntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  mode: 'create' | 'edit';
  fields: { key: string; label: string; placeholder?: string; required?: boolean; type?: 'text' | 'textarea' }[];
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
      if (f.required && !form[f.key]) newErrors[f.key] = `请输入${f.label}`;
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

interface OrganizationPanelProps {
  project: Project | null;
  summary: unknown;
}

export function OrganizationPanel({ project }: OrganizationPanelProps) {
  const org = useOrganization(project?.id ?? '');

  // Dialog states
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [editCompanyTarget, setEditCompanyTarget] = useState<Company | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [editDepartmentTarget, setEditDepartmentTarget] = useState<Department | null>(null);
  const [deleteDeptTarget, setDeleteDeptTarget] = useState<Department | null>(null);
  const [addDeptParentId, setAddDeptParentId] = useState<string | null>(null);

  // 初始加载由 useOrganization 内部 effect 处理（监听 debouncedSearch + projectId）

  const isArchived = project?.status === 'archived';

  const handleSelectCompany = useCallback((companyId: string) => {
    org.refetchDepartments(companyId);
  }, [org]);

  const handleDeleteCompanyConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await org.deleteCompany(deleteTarget.id);
    toast.success(`公司「${deleteTarget.displayName}」已删除`);
    // 如果删除的是当前激活的公司，清空右侧
    if (org.activeCompanyId === deleteTarget.id) {
      org.clearActiveCompany();
    }
    setDeleteTarget(null);
  }, [deleteTarget, org]);

  const selectedCompany = org.companies.find((c) => c.id === org.activeCompanyId);

  return (
    <div className="flex h-full gap-0 overflow-hidden" style={{ minHeight: 0 }}>

      {/* ===== 左侧：公司列表（Master） ===== */}
      <div className="flex w-[280px] shrink-0 flex-col border-r border-sidebar-border overflow-hidden">
        {/* 左侧头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
          <span className="text-sm font-semibold text-text-primary">公司列表</span>
          {!isArchived && (
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setCompanyDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* 搜索框 */}
        <div className="px-3 py-2 border-b border-divider">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary pointer-events-none" />
            <Input
              placeholder="搜索公司..."
              value={org.companySearch}
              onChange={(e) => org.setCompanySearch((e.target as HTMLInputElement).value)}
              className="pl-8 h-7 text-xs"
            />
          </div>
        </div>

        {/* 公司卡片列表 */}
        <div className="flex-1 overflow-y-auto py-2">
          {org.companiesLoading ? (
            <div className="space-y-2 px-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-card-border p-3 space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : org.companies.length === 0 ? (
            <div className="py-10 text-center px-4">
              <Building2 className="mx-auto h-8 w-8 text-text-tertiary mb-2" />
              <p className="text-xs text-text-tertiary">暂无公司</p>
            </div>
          ) : (
            <div className="space-y-1 px-2">
              {org.companies.map((c) => {
                const isSelected = org.activeCompanyId === c.id;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      'group relative rounded-lg border p-3 cursor-pointer transition-all',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-card-border hover:border-primary/40 hover:bg-surface-hover',
                    )}
                    onClick={() => handleSelectCompany(c.id)}
                  >
                    {/* 操作按钮（hover 显示） */}
                    {!isArchived && (
                      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-1 rounded text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setEditCompanyTarget(c); }}
                          title="编辑"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                          title="删除"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    {/* 公司名称 */}
                    <div className="flex items-center gap-2 pr-10">
                      <Building2 className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-primary' : 'text-text-tertiary')} />
                      <span className={cn('text-sm font-medium truncate', isSelected ? 'text-primary' : 'text-text-primary')}>
                        {c.displayName}
                      </span>
                    </div>

                    {/* 统计 */}
                    <p className="mt-1.5 text-xs text-text-tertiary">
                      {c.departmentCount ?? 0} 部门 / {c.roleCount ?? 0} 角色
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===== 右侧：部门树（Detail） ===== */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {org.activeCompanyId && selectedCompany ? (
          <DepartmentTree
            departments={org.departments}
            companyName={selectedCompany.displayName}
            expandedIds={org.expandedDeptIds}
            onToggleExpand={org.toggleExpandDept}
            onExpandAll={org.expandAllDepts}
            onCollapseAll={org.collapseAllDepts}
            searchQuery={org.deptSearch}
            onSearchChange={org.setDeptSearch}
            loading={org.departmentsLoading}
            isArchived={isArchived}
            onAddDepartment={() => setDepartmentDialogOpen(true)}
            onEditDepartment={(dept) => setEditDepartmentTarget(dept)}
            onDeleteDepartment={(dept) => setDeleteDeptTarget(dept)}
            onAddChildDepartment={(parentId) => { setAddDeptParentId(parentId); setDepartmentDialogOpen(true); }}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
            <Building2 className="h-12 w-12 text-text-tertiary mb-3" />
            <p className="text-sm font-medium text-text-secondary">请从左侧选择一家公司</p>
            <p className="mt-1 text-xs text-text-tertiary">选中后显示该公司的部门结构</p>
          </div>
        )}
      </div>

      {/* ===== Dialogs ===== */}

      {/* Company Create */}
      <EntityDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        title="新建公司"
        mode="create"
        fields={[
          { key: 'name', label: '名称标识', placeholder: '如 acme-corp', required: true },
          { key: 'displayName', label: '显示名称', placeholder: '如 ACME 公司', required: true },
          { key: 'description', label: '描述', placeholder: '简要描述...', type: 'textarea' },
        ]}
        onSubmit={async (data) => { const c = await org.createCompany(data); toast.success(`公司「${c.displayName}」创建成功`); }}
      />

      {/* Company Edit */}
      <EntityDialog
        open={!!editCompanyTarget}
        onOpenChange={(o) => { if (!o) setEditCompanyTarget(null); }}
        title="编辑公司"
        mode="edit"
        initialValues={editCompanyTarget ? {
          name: editCompanyTarget.name,
          displayName: editCompanyTarget.displayName,
          description: editCompanyTarget.description ?? '',
        } : undefined}
        entityVersion={editCompanyTarget?.version}
        fields={[
          { key: 'name', label: '名称标识', placeholder: '如 acme-corp', required: true },
          { key: 'displayName', label: '显示名称', placeholder: '如 ACME 公司', required: true },
          { key: 'description', label: '描述', placeholder: '简要描述...', type: 'textarea' },
        ]}
        onSubmit={async (data) => {
          if (!editCompanyTarget) return;
          const c = await org.updateCompany(editCompanyTarget.id, data);
          toast.success(`公司「${c.displayName}」已更新`);
          setEditCompanyTarget(null);
        }}
      />

      {/* Department Create (supports root + child) */}
      <EntityDialog
        open={departmentDialogOpen}
        onOpenChange={(o) => { setDepartmentDialogOpen(o); if (!o) setAddDeptParentId(null); }}
        title={addDeptParentId ? '新建子部门' : '新建部门'}
        mode="create"
        fields={[
          { key: 'name', label: '名称标识', placeholder: '如 engineering', required: true },
          { key: 'displayName', label: '显示名称', placeholder: '如 工程部', required: true },
          { key: 'description', label: '描述', placeholder: '...', type: 'textarea' },
        ]}
        onSubmit={async (data) => {
          const payload = { ...data };
          if (addDeptParentId) payload.parentId = addDeptParentId;
          const d = await org.createDepartment(org.activeCompanyId!, payload);
          toast.success(`部门「${d.displayName}」创建成功`);
          setAddDeptParentId(null);
        }}
      />

      {/* Department Edit */}
      <EntityDialog
        open={!!editDepartmentTarget}
        onOpenChange={(o) => { if (!o) setEditDepartmentTarget(null); }}
        title="编辑部门"
        mode="edit"
        initialValues={editDepartmentTarget ? {
          name: editDepartmentTarget.name,
          displayName: editDepartmentTarget.displayName,
          description: editDepartmentTarget.description ?? '',
        } : undefined}
        fields={[
          { key: 'name', label: '名称标识', required: true },
          { key: 'displayName', label: '显示名称', required: true },
          { key: 'description', label: '描述', type: 'textarea' },
        ]}
        onSubmit={async (data) => {
          if (!editDepartmentTarget) return;
          const d = await org.updateDepartment(editDepartmentTarget.id, data);
          toast.success(`部门「${d.displayName}」已更新`);
          setEditDepartmentTarget(null);
        }}
      />

      {/* Delete Company AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{deleteTarget?.displayName}」吗？将同时删除该公司下所有部门，关联角色将变为独立角色。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteCompanyConfirm}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Department AlertDialog */}
      <AlertDialog open={!!deleteDeptTarget} onOpenChange={(o) => { if (!o) setDeleteDeptTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{deleteDeptTarget?.displayName}」吗？该部门下的子部门将一并删除。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteDeptTarget) return;
                await org.deleteDepartment(deleteDeptTarget.id);
                toast.success(`部门「${deleteDeptTarget.displayName}」已删除`);
                setDeleteDeptTarget(null);
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
