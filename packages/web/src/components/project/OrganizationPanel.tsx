/**
 * @module OrganizationPanel
 * @description 组织管理面板：Tab 切换的 4 个子区域 — 公司列表(F-M1-06) +
 *              部门树(F-M1-07) + 角色列表(F-M1-08) + 外部实体列表(F-M1-09)。
 *
 * 样式对齐：
 * - SectionHeading 统一区块标题（§7）
 * - Card 使用 §6.4 规格（rounded-card shadow-card）
 * - 外部实体 Badge 使用 §2.3 语义色 token
 */
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { Plus, Search, Building2, Users, Shield, UserPlus, Trash2, ChevronRight, Pencil } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeading } from '@/components/common/SectionHeading';
import { SummaryCards } from './SummaryCards';
import type { Project, ProjectSummary, Company, Department, Role, ExternalEntity } from '@apm/shared';
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
 * Edit 模式预填当前值，提交时携带乐观锁 version。
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

  // name 格式前端校验
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
    // name 格式二次校验
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
                    // name 实时格式校验
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
// Sub-components: List Views
// ============================================================

/** 公司类型中文映射 */
const COMPANY_TYPE_LABELS: Record<string, string> = {
  internal: '内部',
  external: '外部',
  partner: '合作伙伴',
  client: '客户',
};

/** 外部实体类型中文映射 */
const ENTITY_TYPE_LABELS: Record<string, string> = {
  system: '系统',
  organization: '组织',
  person: '人员',
  api: 'API',
};

/** 外部实体类型 → §2.3 语义色 Badge 变体映射 */
const ENTITY_TYPE_BADGE_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
  system: 'info',
  organization: 'success',
  person: 'warning',
  api: 'error',
};

interface OrganizationPanelProps {
  project: Project | null;
  summary: ProjectSummary | null;
}

/**
 * 组织管理面板组件。
 *
 * Tab 结构：
 * - 概要：复用 SummaryCards 展示 6 模块计数
 * - 组织架构：公司卡片网格 + 选中公司的部门列表（点击公司加载部门）
 * - 角色：角色列表（支持 departmentId 筛选）
 * - 外部实体：外部实体列表（含类型 Badge 着色）
 *
 * 归档保护：project.status === 'archived' 时隐藏所有新建/删除按钮。
 */
export function OrganizationPanel({ project, summary }: OrganizationPanelProps) {
  const org = useOrganization(project?.id ?? '');

  // ---- Dialog states ----
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [eeDialogOpen, setEeDialogOpen] = useState(false);
  const [editCompanyTarget, setEditCompanyTarget] = useState<Company | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  // ---- 首次加载公司列表 ----
  useEffect(() => { if (project) org.refetchCompanies(); }, [project]);

  // ---- 归档保护 ----
  const isArchived = project?.status === 'archived';

  return (
    <div className="space-y-4">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="org">组织架构</TabsTrigger>
          <TabsTrigger value="roles">角色</TabsTrigger>
          <TabsTrigger value="external">外部实体</TabsTrigger>
        </TabsList>

        {/* ===== Tab 1: 概要（复用 SummaryCards） ===== */}
        <TabsContent value="overview" className="mt-4">
          {summary ? (
            <>
              <SectionHeading title="模块统计总览" />
              <SummaryCards summary={summary} />
            </>
          ) : (
            <p className="text-sm text-text-tertiary py-8 text-center">加载中...</p>
          )}
        </TabsContent>

        {/* ===== Tab 2: 组织架构（公司 + 部门） ===== */}
        <TabsContent value="org" className="mt-4 space-y-6">
          {/* --- 公司列表 --- */}
          <div>
            <SectionHeading
              title="公司/组织"
              icon={<Building2 className="h-4 w-4" />}
              count={org.companies.length}
              action={
                !isArchived ? (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-tertiary" />
                      <Input
                        placeholder="搜索公司..."
                        value={org.companySearch}
                        onChange={(e) => org.setCompanySearch((e.target as HTMLInputElement).value)}
                        className="pl-8 h-8 w-48 text-xs"
                      />
                    </div>
                    <Button size="sm" onClick={() => setCompanyDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" /> 新建
                    </Button>
                  </div>
                ) : undefined
              }
            />

            {org.companiesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-2.5">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : org.companies.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-text-tertiary">暂无公司，点击「新建」添加</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {org.companies.map((c) => (
                  <Card key={c.id} className="cursor-pointer hover:border-primary/50 transition-colors group"
                        onClick={() => org.refetchDepartments(c.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-medium text-text-primary">{c.displayName}</p>
                          <p className="text-xs text-text-tertiary font-mono mt-0.5">{c.name}</p>
                        </div>
                        {!isArchived && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => { setEditCompanyTarget(c); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-danger"
                              onClick={() => { setDeleteTarget(c); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {c.companyType && (
                        <Badge variant="outline" className="text-xs mt-2">
                          {COMPANY_TYPE_LABELS[c.companyType] ?? c.companyType}
                        </Badge>
                      )}
                      {c.description && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{c.description}</p>}
                      {/* 统计 Badge 行 */}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs font-normal">
                          {c.departmentCount ?? 0} 个部门
                        </Badge>
                        <Badge variant="secondary" className="text-xs font-normal">
                          {c.roleCount ?? 0} 个角色
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* --- 部门列表（选中公司后显示） --- */}
          {org.activeCompanyId && (
            <div>
              <SectionHeading
                title="部门"
                icon={<ChevronRight className="h-4 w-4" />}
                count={org.departments.length}
                action={
                  !isArchived && (
                    <Button size="sm" onClick={() => setDepartmentDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" /> 新建部门
                    </Button>
                  )
                }
              />

              {org.departmentsLoading ? (
                <p className="text-sm text-text-tertiary py-4">加载中...</p>
              ) : org.departments.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-sm text-text-tertiary">该公司下暂无部门</CardContent></Card>
              ) : (
                <Card>
                  <div className="divide-y divide-divider">
                    {org.departments.map((d) => (
                      <div key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-fill transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate text-text-primary">{d.displayName}</p>
                          <p className="text-xs text-text-tertiary font-mono">{d.name}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {d.parentId ? <Badge variant="outline" className="text-xs">子部门</Badge> : <Badge variant="secondary" className="text-xs">顶级</Badge>}
                          {!isArchived && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-danger"
                              onClick={async () => { await org.deleteDepartment(d.id); toast.success('部门已删除'); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ===== Tab 3: 角色列表 ===== */}
        <TabsContent value="roles" className="mt-4">
          <SectionHeading
            title="角色"
            icon={<Shield className="h-4 w-4" />}
            count={org.roles.length}
            action={
              !isArchived && (
                <Button size="sm" onClick={() => setRoleDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> 新建
                </Button>
              )
            }
          />

          {org.rolesLoading ? (
            <p className="text-sm text-text-tertiary py-4">加载中...</p>
          ) : org.roles.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-text-tertiary">暂无角色，点击「新建」添加</CardContent></Card>
          ) : (
            <Card>
              <div className="divide-y divide-divider">
                {org.roles.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-fill transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate text-text-primary">{r.displayName}</p>
                      <p className="text-xs text-text-tertiary font-mono">{r.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.departmentId ? <Badge variant="outline" className="text-xs">已归属</Badge> : <Badge variant="secondary" className="text-xs">独立</Badge>}
                      {!isArchived && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-danger"
                          onClick={async () => { await org.deleteRole(r.id); toast.success('角色已删除'); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ===== Tab 4: 外部实体列表 ===== */}
        <TabsContent value="external" className="mt-4">
          <SectionHeading
            title="外部实体"
            icon={<UserPlus className="h-4 w-4" />}
            count={org.externalEntities.length}
            action={
              !isArchived && (
                <Button size="sm" onClick={() => setEeDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> 新建
                </Button>
              )
            }
          />

          {org.externalEntitiesLoading ? (
            <p className="text-sm text-text-tertiary py-4">加载中...</p>
          ) : org.externalEntities.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-text-tertiary">暂无外部实体，点击「新建」添加</CardContent></Card>
          ) : (
            <Card>
              <div className="divide-y divide-divider">
                {org.externalEntities.map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-3 hover:bg-fill transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate text-text-primary">{e.displayName}</p>
                      <p className="text-xs text-text-tertiary font-mono">{e.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {e.entityType && (
                        <Badge variant={ENTITY_TYPE_BADGE_VARIANT[e.entityType] ?? 'draft'} className="text-xs">
                          {ENTITY_TYPE_LABELS[e.entityType] ?? e.entityType}
                        </Badge>
                      )}
                      {!isArchived && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-danger"
                          onClick={async () => { await org.deleteExternalEntity(e.id); toast.success('外部实体已删除'); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== Entity Dialogs (Create mode) ===== */}
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

      <EntityDialog
        open={departmentDialogOpen}
        onOpenChange={setDepartmentDialogOpen}
        title="新建部门"
        mode="create"
        fields={[
          { key: 'name', label: '名称标识', placeholder: '如 engineering', required: true },
          { key: 'display_name', label: '显示名称', placeholder: '如 工程部', required: true },
          { key: 'description', label: '描述', placeholder: '...', type: 'textarea' },
        ]}
        onSubmit={async (data) => { const d = await org.createDepartment(org.activeCompanyId!, data); toast.success(`部门「${d.displayName}」创建成功`); }}
      />

      <EntityDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        title="新建角色"
        mode="create"
        fields={[
          { key: 'name', label: '名称标识', placeholder: '如 admin', required: true },
          { key: 'display_name', label: '显示名称', placeholder: '如 管理员', required: true },
          { key: 'description', label: '描述', placeholder: '...', type: 'textarea' },
        ]}
        onSubmit={async (data) => { const r = await org.createRole(data); toast.success(`角色「${r.displayName}」创建成功`); }}
      />

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

      {/* ===== Edit Company Dialog ===== */}
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

      {/* ===== Delete Company AlertDialog ===== */}
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
                setDeleteTarget(null);
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
