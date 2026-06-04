/**
 * @module RolesPage
 * @description 角色管理页面（项目上下文）。
 *
 * 路由：/p/:projectId/roles
 * 功能：角色卡片列表 + 搜索 + 部门筛选 + 新建/编辑/删除。
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useOrganization } from '@/hooks/useOrganization';
import { DetailSkeleton } from '@/components/project/DetailSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Pencil, Trash2, Users } from 'lucide-react';
import type { Role, Department } from '@apm/shared';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

// ============================================================
// 工具函数：构建部门完整路径
// ============================================================

/** 返回 "祖先1 / 祖先2 / 当前部门" 格式的路径字符串 */
function buildDeptPath(deptId: string, departments: Department[]): string {
  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const parts: string[] = [];
  let current = deptMap.get(deptId);
  while (current) {
    parts.unshift(current.displayName);
    current = current.parentId ? deptMap.get(current.parentId) : undefined;
  }
  return parts.join(' / ');
}

// ============================================================
// RoleFormDialog
// ============================================================

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialValues?: {
    name: string;
    displayName: string;
    departmentId: string;
    description: string;
  };
  departments: Department[];
  companies: { id: string; displayName: string }[];
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
}

function RoleFormDialog({
  open, onOpenChange, mode, initialValues, departments, companies, onSubmit,
}: RoleFormDialogProps) {
  const blank = { name: '', displayName: '', departmentId: '', description: '' };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(mode === 'edit' && initialValues ? { ...initialValues } : blank);
      setErrors({});
      setSubmitError(undefined);
    }
  }, [open, mode, initialValues]);

  const validateName = (val: string) => {
    if (!val) return '请输入角色标识符';
    if (!/^[a-zA-Z0-9_-]{2,50}$/.test(val)) return '仅允许字母、数字、下划线、连字符，2~50 字符';
    return undefined;
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string | undefined> = {};
    const nameErr = validateName(form.name);
    if (nameErr) newErrors.name = nameErr;
    if (!form.displayName) newErrors.displayName = '请输入显示名称';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        displayName: form.displayName,
        description: form.description || undefined,
        departmentId: form.departmentId || null,
      };
      await onSubmit(payload);
      onOpenChange(false);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e.statusCode === 400 || e.statusCode === 409) {
        setSubmitError(e.message ?? '操作失败');
      } else {
        toast.error(e.message ?? '网络错误，请重试');
      }
    } finally {
      setSubmitting(false);
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
          <DialogTitle>{mode === 'create' ? '新建角色' : '编辑角色'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? '填写以下信息创建新角色' : '修改角色信息'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-[18px] px-6 py-5 overflow-y-auto">
          {/* 角色标识符 */}
          <div className="space-y-1.5">
            <Label>角色标识符 <span className="text-danger">*</span></Label>
            <Input
              placeholder="如 product-manager"
              value={form.name}
              onChange={(e) => {
                const val = (e.target as HTMLInputElement).value;
                setForm((prev) => ({ ...prev, name: val }));
                if (val) {
                  const err = validateName(val);
                  setErrors((prev) => ({ ...prev, name: err }));
                } else {
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              disabled={submitting}
            />
            {errors.name && <p className="text-sm text-danger">{errors.name}</p>}
          </div>

          {/* 显示名称 */}
          <div className="space-y-1.5">
            <Label>显示名称 <span className="text-danger">*</span></Label>
            <Input
              placeholder="如 产品经理"
              value={form.displayName}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, displayName: (e.target as HTMLInputElement).value }));
                if (errors.displayName) setErrors((prev) => ({ ...prev, displayName: undefined }));
              }}
              disabled={submitting}
            />
            {errors.displayName && <p className="text-sm text-danger">{errors.displayName}</p>}
          </div>

          {/* 挂载部门 */}
          <div className="space-y-1.5">
            <Label>挂载部门（可选）</Label>
            <Select
              value={form.departmentId || '__none__'}
              onValueChange={(val) => setForm((prev) => ({ ...prev, departmentId: (val === '__none__' || !val) ? '' : val }))}
              disabled={submitting}
            >
              <SelectTrigger className="w-full">
                <span className="truncate text-sm">
                  {form.departmentId
                    ? buildDeptPath(form.departmentId, departments)
                    : <span className="text-muted-foreground">不挂载（独立角色）</span>}
                </span>
              </SelectTrigger>
              <SelectContent className="max-h-[260px]">
                <SelectItem value="__none__">不挂载（独立角色）</SelectItem>
                {companies.map((company) => {
                  const companyDepts = departments.filter((d) => d.companyId === company.id);
                  if (companyDepts.length === 0) return null;
                  return (
                    <SelectGroup key={company.id}>
                      <SelectLabel>{company.displayName}</SelectLabel>
                      {companyDepts.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {buildDeptPath(d.id, departments)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* 描述 */}
          <div className="space-y-1.5">
            <Label>描述</Label>
            <Textarea
              placeholder="角色的职责描述..."
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: (e.target as HTMLTextAreaElement).value }))}
              rows={3}
              disabled={submitting}
            />
          </div>

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
// RolesPage
// ============================================================

export default function RolesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, loading: projectLoading, error: projectError } = useProjectDetail(projectId);
  const org = useOrganization(projectId ?? '');

  // 筛选状态
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [departmentFilter, setDepartmentFilter] = useState('__all__');

  // Dialog 状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 加载公司 + 部门列表（用于 Dialog 中的下拉选择）
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [allCompanies, setAllCompanies] = useState<{ id: string; displayName: string }[]>([]);

  const fetchAllDepartments = useCallback(async () => {
    if (!projectId) return;
    try {
      const companiesRes = await apiClient.get<{ data: { id: string; displayName: string }[] }>(
        `/projects/${projectId}/companies`,
      );
      const companies = companiesRes.data.data;
      setAllCompanies(companies);
      const deptArrays = await Promise.all(
        companies.map((c) =>
          apiClient
            .get<{ data: Department[] }>(`/projects/${projectId}/companies/${c.id}/departments`)
            .then((r) => r.data.data)
            .catch(() => [] as Department[]),
        ),
      );
      setAllDepartments(deptArrays.flat());
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      org.refetchRoles();
      fetchAllDepartments();
    }
  }, [projectId]);

  const isArchived = project?.status === 'archived';

  // 本地过滤（防抖搜索 + 部门筛选）
  const filteredRoles = org.roles.filter((r) => {
    const matchesSearch =
      !debouncedSearch ||
      r.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      r.displayName.toLowerCase().includes(debouncedSearch.toLowerCase());

    const matchesDept =
      departmentFilter === '__all__' ||
      (departmentFilter === '__none__' ? !r.departmentId : r.departmentId === departmentFilter);

    return matchesSearch && matchesDept;
  });

  // 查找部门完整标签：公司名 · 路径
  const getDeptLabel = (deptId: string | null | undefined) => {
    if (!deptId) return null;
    const dept = allDepartments.find((d) => d.id === deptId);
    if (!dept) return null;
    const company = allCompanies.find((c) => c.id === dept.companyId);
    const path = buildDeptPath(deptId, allDepartments);
    return company ? `${company.displayName} · ${path}` : path;
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await org.deleteRole(deleteTarget.id);
      toast.success(`角色「${deleteTarget.displayName}」已删除`);
      setDeleteTarget(null);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      toast.error(e.message ?? '删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  if (projectLoading) {
    return <DetailSkeleton />;
  }

  if (projectError || !project) {
    return (
      <div className="rounded-card border border-danger bg-danger-bg p-8 text-center">
        <p className="text-lg font-medium text-danger">{projectError || '项目不存在'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===== 页头 ===== */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            角色管理
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            此处定义参与业务流程的角色，可选挂载到组织架构中的部门
          </p>
        </div>
        {!isArchived && (
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> 新建角色
          </Button>
        )}
      </div>

      {/* ===== 筛选栏 ===== */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary pointer-events-none" />
          <Input
            placeholder="搜索角色..."
            value={searchInput}
            onChange={(e) => setSearchInput((e.target as HTMLInputElement).value)}
            className="pl-8"
          />
        </div>
        <Select value={departmentFilter} onValueChange={(val) => setDepartmentFilter(val ?? '__all__')}>
          <SelectTrigger className="w-[200px]">
            <span className="truncate text-sm">
              {departmentFilter === '__all__'
                ? '全部'
                : departmentFilter === '__none__'
                  ? '独立角色'
                  : buildDeptPath(departmentFilter, allDepartments)}
            </span>
          </SelectTrigger>
          <SelectContent className="max-h-[260px]">
            <SelectItem value="__all__">全部</SelectItem>
            <SelectItem value="__none__">独立角色</SelectItem>
            {allCompanies.map((company) => {
              const companyDepts = allDepartments.filter((d) => d.companyId === company.id);
              if (companyDepts.length === 0) return null;
              return (
                <SelectGroup key={company.id}>
                  <SelectLabel>{company.displayName}</SelectLabel>
                  {companyDepts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {buildDeptPath(d.id, allDepartments)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* ===== 角色列表 ===== */}
      {org.rolesLoading ? (
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
      ) : filteredRoles.length === 0 ? (
        <div className="py-16 text-center">
          <Users className="mx-auto h-10 w-10 text-text-tertiary mb-3" />
          <p className="text-sm text-text-tertiary">
            {org.roles.length === 0 ? '还没有角色，点击「新建角色」创建' : '没有匹配的角色'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRoles.map((role) => {
            const deptLabel = getDeptLabel(role.departmentId);
            return (
              <div
                key={role.id}
                className="group relative rounded-card border border-card-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => navigate(`/p/${projectId}/roles/${role.id}`)}
              >
                {/* 操作按钮（hover 显示） */}
                {!isArchived && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1 rounded text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"
                      onClick={(e) => { e.stopPropagation(); setEditTarget(role); }}
                      title="编辑"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(role); }}
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* 卡片内容 */}
                <h3 className="font-semibold text-text-primary pr-14 truncate">{role.displayName}</h3>
                <div className="mt-1.5">
                  {deptLabel ? (
                    <Badge variant="info" className="text-xs max-w-full truncate block">{deptLabel}</Badge>
                  ) : (
                    <Badge variant="draft" className="text-xs">独立</Badge>
                  )}
                </div>
                {role.description && (
                  <p className="mt-2 text-sm text-text-secondary line-clamp-2">{role.description}</p>
                )}
                <div className="mt-2 text-xs text-text-tertiary">
                  {(role.actions?.length ?? 0) > 0 && <span>{role.actions.length} 行为</span>}
                  {(role.actions?.length ?? 0) > 0 && (role.decisions?.length ?? 0) > 0 && <span> · </span>}
                  {(role.decisions?.length ?? 0) > 0 && <span>{role.decisions.length} 决策</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== Create Dialog ===== */}
      <RoleFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        departments={allDepartments}
        companies={allCompanies}
        onSubmit={async (data) => {
          const r = await org.createRole(data);
          toast.success(`角色「${r.displayName}」创建成功`);
        }}
      />

      {/* ===== Edit Dialog ===== */}
      <RoleFormDialog
        open={!!editTarget}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
        mode="edit"
        initialValues={editTarget ? {
          name: editTarget.name,
          displayName: editTarget.displayName,
          departmentId: editTarget.departmentId ?? '',
          description: editTarget.description ?? '',
        } : undefined}
        departments={allDepartments}
        companies={allCompanies}
        onSubmit={async (data) => {
          if (!editTarget) return;
          const r = await org.updateRole(editTarget.id, data);
          toast.success(`角色「${r.displayName}」已更新`);
          setEditTarget(null);
        }}
      />

      {/* ===== Delete AlertDialog ===== */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除角色「{deleteTarget?.displayName}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
