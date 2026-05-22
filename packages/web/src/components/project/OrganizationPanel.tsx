/**
 * @module OrganizationPanel
 * @description 组织架构面板：Master-Detail 单页布局（F-M1-06~09）
 *
 * 布局结构（对齐高保真原型 m1-project-detail.html §组织架构 Tab）：
 *   Section 1 公司列表（Master）：Table 格式，6 列，行操作「查看部门|编辑|删除」
 *   Section 2 部门结构（Detail）：选中公司后展示，含面包屑+工具栏+树形列表
 *   Section 3 外部实体：Table 格式，与公司/部门平级
 *
 * 样式对齐：
 * - SectionHeading 统一区块标题（§7）
 * - Table 使用 §6.3 规格（table.tsx 原语）
 * - 外部实体 Badge 使用 §2.3 语义色 token
 * - 操作按钮使用 link-action 样式（文字链接风格）
 *
 * 归档保护：project.status === 'archived' 时隐藏所有新建/编辑/删除按钮。
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  CodeCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { DepartmentTree } from '@/components/organization/DepartmentTree';
import type { Project, Company, Department, ExternalEntity } from '@apm/shared';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

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

/**
 * 通用实体对话框：支持新建(create)和编辑(edit)双模式。
 */
function EntityDialog({
  open, onOpenChange, title, mode, fields,
  initialValues, entityVersion, onSubmit, submitting,
}: EntityDialogProps) {
  const initial = initialValues ?? {};
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
        <div className="space-y-4 py-2">
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
// Constants
// ============================================================

/** 外部实体类型中文映射 */
const ENTITY_TYPE_LABELS: Record<string, string> = {
  system: '系统',
  organization: '组织',
  person: '人员',
  api: 'API',
};

/** 外部实体类型 → 语义色 Badge 变体映射 */
const ENTITY_TYPE_BADGE_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
  system: 'info',
  organization: 'success',
  person: 'warning',
  api: 'error',
};

// ============================================================
// Main Component
// ============================================================

interface OrganizationPanelProps {
  project: Project | null;
  summary: unknown; // reserved for future use, not rendered in current layout
}

/**
 * 组织架构面板组件 — Master-Detail 单页布局。
 *
 * 三段式连续页面（无内层 Tabs）：
 *   1. 公司列表 Table（Master）— 点击「查看部门」选中并展开 Detail
 *   2. 部门树形列表（Detail）— 选中公司后展示
 *   3. 外部实体 Table — 页面底部子区域
 */
export function OrganizationPanel({ project }: OrganizationPanelProps) {
  const org = useOrganization(project?.id ?? '');

  // ---- Dialog states ----
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [eeDialogOpen, setEeDialogOpen] = useState(false);
  const [editCompanyTarget, setEditCompanyTarget] = useState<Company | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  // ---- Selection & edit/delete targets ----
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [editDepartmentTarget, setEditDepartmentTarget] = useState<Department | null>(null);
  const [editEeTarget, setEditEeTarget] = useState<ExternalEntity | null>(null);
  const [deleteDeptTarget, setDeleteDeptTarget] = useState<Department | null>(null);
  const [deleteEeTarget, setDeleteEeTarget] = useState<ExternalEntity | null>(null);
  const [addDeptParentId, setAddDeptParentId] = useState<string | null>(null);

  // ---- Data loading ----
  useEffect(() => { if (project) org.refetchCompanies(); }, [project]);
  useEffect(() => { if (project) org.refetchExternalEntities(); }, [project]);

  // ---- Archive protection ----
  const isArchived = project?.status === 'archived';

  // ---- Handlers ----
  const handleSelectCompany = useCallback((companyId: string) => {
    setSelectedCompanyId(companyId);
    org.refetchDepartments(companyId);
  }, [org]);

  return (
    <div className="space-y-6">
      {/* ===== Section 1: 公司列表（Master） ===== */}
      <div>
        <SectionHeading
          title="公司列表"
          action={
            !isArchived ? (
              <Button size="sm" onClick={() => setCompanyDialogOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> 添加公司
              </Button>
            ) : undefined
          }
        />

        {org.companiesLoading ? (
          /* Table skeleton */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 220 }}>公司名称</TableHead>
                <TableHead style={{ width: 160 }}>标识符</TableHead>
                <TableHead>描述</TableHead>
                <TableHead style={{ width: 70 }}>部门数</TableHead>
                <TableHead style={{ width: 70 }}>角色数</TableHead>
                <TableHead style={{ width: 140 }} className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-3 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : org.companies.length === 0 ? (
          <p className="text-sm text-text-tertiary py-8 text-center">暂无公司，点击「添加公司」创建</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 220 }}>公司名称</TableHead>
                <TableHead style={{ width: 160 }}>标识符</TableHead>
                <TableHead>描述</TableHead>
                <TableHead style={{ width: 70 }}>部门数</TableHead>
                <TableHead style={{ width: 70 }}>角色数</TableHead>
                <TableHead style={{ width: 140 }} className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {org.companies.map((c) => (
                <TableRow
                  key={c.id}
                  data-state={selectedCompanyId === c.id ? 'selected' : undefined}
                >
                  <TableCell className="font-medium">{c.displayName}</TableCell>
                  <CodeCell value={c.name} />
                  <TableCell title={c.description ?? ''}>{c.description ?? '-'}</TableCell>
                  <TableCell>{c.departmentCount ?? 0}</TableCell>
                  <TableCell>
                    <button
                      className="text-[13px] text-primary hover:text-primary-hover hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit"
                      onClick={() => toast.info(`角色管理功能开发中（${c.displayName}）`)}
                    >
                      {c.roleCount ?? 0}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        className="text-[13px] text-primary hover:text-primary-hover hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit"
                        onClick={() => handleSelectCompany(c.id)}
                      >
                        查看部门
                      </button>
                      {!isArchived && (
                        <>
                          <button
                            className="text-[13px] text-primary hover:text-primary-hover hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit"
                            onClick={() => setEditCompanyTarget(c)}
                          >
                            编辑
                          </button>
                          <button
                            className="text-[13px] text-danger hover:text-danger-hover hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit"
                            onClick={() => setDeleteTarget(c)}
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
      </div>

      {/* ===== Section 2: 部门结构（Detail） ===== */}
      {org.activeCompanyId && (
        <div className="border-t border-divider pt-5 mt-6">
          <DepartmentTree
            departments={org.departments}
            companyName={org.companies.find((c) => c.id === org.activeCompanyId)?.displayName ?? ''}
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
            onAddChildDepartment={(parentId) => setAddDeptParentId(parentId)}
          />
        </div>
      )}

      {/* ===== Section 3: 外部实体 ===== */}
      <div className="border-t border-divider pt-5 mt-6">
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
          { key: 'display_name', label: '显示名称', placeholder: '如 ACME 公司', required: true },
          { key: 'description', label: '描述', placeholder: '简要描述...', type: 'textarea' },
        ]}
        onSubmit={async (data) => { const c = await org.createCompany(data); toast.success(`公司「${c.displayName}」创建成功`); }}
      />

      {/* Department Create (supports root + child) */}
      <EntityDialog
        open={departmentDialogOpen}
        onOpenChange={setDepartmentDialogOpen}
        title={addDeptParentId ? '新建子部门' : '新建部门'}
        mode="create"
        fields={[
          { key: 'name', label: '名称标识', placeholder: '如 engineering', required: true },
          { key: 'display_name', label: '显示名称', placeholder: '如 工程部', required: true },
          { key: 'description', label: '描述', placeholder: '...', type: 'textarea' },
        ]}
        onSubmit={async (data) => {
          const payload = { ...data };
          if (addDeptParentId) payload.parent_id = addDeptParentId;
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
          display_name: editDepartmentTarget.displayName,
          description: editDepartmentTarget.description ?? '',
        } : undefined}
        fields={[
          { key: 'name', label: '名称标识', required: true },
          { key: 'display_name', label: '显示名称', required: true },
          { key: 'description', label: '描述', type: 'textarea' },
        ]}
        onSubmit={async (data) => {
          if (!editDepartmentTarget) return;
          const d = await org.updateDepartment(editDepartmentTarget.id, data);
          toast.success(`部门「${d.displayName}」已更新`);
          setEditDepartmentTarget(null);
        }}
      />

      {/* EE Create */}
      <EntityDialog
        open={eeDialogOpen}
        onOpenChange={setEeDialogOpen}
        title="新建外部实体"
        mode="create"
        fields={[
          { key: 'name', label: '名称标识', placeholder: '如 payment-gateway', required: true },
          { key: 'display_name', label: '显示名称', placeholder: '如 支付网关', required: true },
          { key: 'type', label: '类型', placeholder: 'system / organization / person / api', required: true },
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
          display_name: editEeTarget.displayName,
          type: editEeTarget.entityType ?? '',
          description: editEeTarget.description ?? '',
        } : undefined}
        fields={[
          { key: 'name', label: '名称标识', required: true },
          { key: 'display_name', label: '显示名称', required: true },
          { key: 'type', label: '类型', required: true },
          { key: 'description', label: '描述', type: 'textarea' },
        ]}
        onSubmit={async (data) => {
          if (!editEeTarget) return;
          const e = await org.updateExternalEntity(editEeTarget.id, data);
          toast.success(`外部实体「${e.displayName}」已更新`);
          setEditEeTarget(null);
        }}
      />

      {/* Company Edit */}
      <EntityDialog
        open={!!editCompanyTarget}
        onOpenChange={(o) => { if (!o) setEditCompanyTarget(null); }}
        title="编辑公司"
        mode="edit"
        initialValues={editCompanyTarget ? {
          name: editCompanyTarget.name,
          display_name: editCompanyTarget.displayName,
          description: editCompanyTarget.description ?? '',
        } : undefined}
        entityVersion={editCompanyTarget?.version}
        fields={[
          { key: 'name', label: '名称标识', placeholder: '如 acme-corp', required: true },
          { key: 'display_name', label: '显示名称', placeholder: '如 ACME 公司', required: true },
          { key: 'description', label: '描述', placeholder: '简要描述...', type: 'textarea' },
        ]}
        onSubmit={async (data) => {
          if (!editCompanyTarget) return;
          const c = await org.updateCompany(editCompanyTarget.id, data);
          toast.success(`公司「${c.displayName}」已更新`);
          setEditCompanyTarget(null);
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
              onClick={async () => {
                if (!deleteTarget) return;
                await org.deleteCompany(deleteTarget.id);
                toast.success(`公司「${deleteTarget.displayName}」已删除`);
                setSelectedCompanyId(null);
                setDeleteTarget(null);
              }}
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
