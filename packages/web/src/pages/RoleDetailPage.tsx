/**
 * @module RoleDetailPage
 * @description 角色详情页 — Actions / Decisions 双 Tab 管理（F-M1-12）。
 *
 * 路由：/p/:projectId/roles/:roleId
 * 功能：查看/创建/编辑/删除 角色的 actions 和 decisions JSONB 子资源。
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useRoleBehavior } from '@/hooks/useRoleBehavior';
import { apiClient } from '@/lib/api-client';
import { DetailSkeleton } from '@/components/project/DetailSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { ArrowLeft, Plus, Pencil, Trash2, Zap, GitBranch } from 'lucide-react';
import type { Role, RoleAction, DecisionDef } from '@apm/shared';
import { toast } from 'sonner';
import {
  NodeIOEditor,
  toNodeIOItems,
  fromNodeIOItems,
  validateNodeIOItems,
} from '@/components/role-behavior/NodeIOEditor';
import type { NodeIOItem } from '@/components/role-behavior/NodeIOEditor';

// ============================================================
// Action Form Dialog
// ============================================================

interface ActionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialValues?: RoleAction;
  version: number;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
}

function ActionFormDialog({ open, onOpenChange, mode, initialValues, version, onSubmit }: ActionFormDialogProps) {
  const blank = { name: '', displayName: '', description: '', logicUserDesc: '', logicData: '' };
  const [form, setForm] = useState(blank);
  const [inputItems, setInputItems] = useState<NodeIOItem[]>([]);
  const [outputItems, setOutputItems] = useState<NodeIOItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [ioErrors, setIoErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialValues) {
        setForm({
          name: initialValues.name,
          displayName: initialValues.displayName,
          description: initialValues.description ?? '',
          logicUserDesc: initialValues.logic?.userDesc ?? '',
          logicData: initialValues.logic?.data ?? '',
        });
        setInputItems(toNodeIOItems(initialValues.inputs));
        setOutputItems(toNodeIOItems(initialValues.outputs));
      } else {
        setForm(blank);
        setInputItems([]);
        setOutputItems([]);
      }
      setErrors({});
      setIoErrors({});
      setSubmitError(undefined);
    }
  }, [open, mode, initialValues]);

  const validateName = (val: string) => {
    if (!val) return '请输入行为标识符';
    if (!/^[a-zA-Z0-9_-]{2,50}$/.test(val)) return '仅允许字母、数字、下划线、连字符，2~50 字符';
    return undefined;
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string | undefined> = {};
    const nameErr = validateName(form.name);
    if (nameErr) newErrors.name = nameErr;
    if (!form.displayName) newErrors.displayName = '请输入显示名称';
    if (!form.logicUserDesc) newErrors.logicUserDesc = '请输入行为逻辑描述';

    // 校验 inputs/outputs
    const inputErrs = validateNodeIOItems(inputItems);
    const outputErrs = validateNodeIOItems(outputItems);
    // 给 output errors 的 key 加前缀避免与 input 冲突
    const outputErrsPrefixed: Record<string, string> = {};
    for (const [k, v] of Object.entries(outputErrs)) {
      outputErrsPrefixed[`out-${k}`] = v;
    }
    const allIoErrors = { ...inputErrs, ...outputErrsPrefixed };
    setIoErrors(allIoErrors);

    if (Object.keys(newErrors).length > 0 || Object.keys(allIoErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        displayName: form.displayName,
        description: form.description || undefined,
        inputs: fromNodeIOItems(inputItems),
        outputs: fromNodeIOItems(outputItems),
        logic: { userDesc: form.logicUserDesc, data: form.logicData || undefined },
        tool: null,
        version,
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && e.nativeEvent.target instanceof HTMLInputElement) {
          e.preventDefault();
          handleSubmit();
        }
      }}>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建行为' : '编辑行为'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? '定义角色的一个行为（Action）' : '修改行为信息'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-[18px] px-6 py-5 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <Label>行为标识符 <span className="text-danger">*</span></Label>
            <Input
              placeholder="如 submit-order"
              value={form.name}
              onChange={(e) => {
                const val = (e.target as HTMLInputElement).value;
                setForm((prev) => ({ ...prev, name: val }));
                if (val) setErrors((prev) => ({ ...prev, name: validateName(val) }));
                else setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              disabled={submitting}
            />
            {errors.name && <p className="text-sm text-danger">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>显示名称 <span className="text-danger">*</span></Label>
            <Input
              placeholder="如 提交订单"
              value={form.displayName}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, displayName: (e.target as HTMLInputElement).value }));
                if (errors.displayName) setErrors((prev) => ({ ...prev, displayName: undefined }));
              }}
              disabled={submitting}
            />
            {errors.displayName && <p className="text-sm text-danger">{errors.displayName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>描述</Label>
            <Textarea
              placeholder="行为的简要描述..."
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: (e.target as HTMLTextAreaElement).value }))}
              rows={2}
              disabled={submitting}
            />
          </div>

          {/* 输入参数 */}
          <NodeIOEditor
            label="输入参数"
            items={inputItems}
            onChange={setInputItems}
            showRequired={true}
            errors={Object.fromEntries(
              Object.entries(ioErrors).filter(([k]) => !k.startsWith('out-'))
            )}
            disabled={submitting}
          />

          {/* 输出参数 */}
          <NodeIOEditor
            label="输出参数"
            items={outputItems}
            onChange={setOutputItems}
            showRequired={false}
            errors={Object.fromEntries(
              Object.entries(ioErrors)
                .filter(([k]) => k.startsWith('out-'))
                .map(([k, v]) => [k.replace('out-', ''), v])
            )}
            disabled={submitting}
          />

          <div className="space-y-1.5">
            <Label>行为逻辑描述 <span className="text-danger">*</span></Label>
            <Textarea
              placeholder="用自然语言描述此行为的具体逻辑..."
              value={form.logicUserDesc}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, logicUserDesc: (e.target as HTMLTextAreaElement).value }));
                if (errors.logicUserDesc) setErrors((prev) => ({ ...prev, logicUserDesc: undefined }));
              }}
              rows={3}
              disabled={submitting}
            />
            {errors.logicUserDesc && <p className="text-sm text-danger">{errors.logicUserDesc}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>逻辑代码（可选）</Label>
            <Textarea
              placeholder="JS 代码片段（可选）..."
              value={form.logicData}
              onChange={(e) => setForm((prev) => ({ ...prev, logicData: (e.target as HTMLTextAreaElement).value }))}
              rows={3}
              className="font-mono text-sm"
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
// Decision Form Dialog
// ============================================================

interface DecisionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialValues?: DecisionDef;
  version: number;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
}

function DecisionFormDialog({ open, onOpenChange, mode, initialValues, version, onSubmit }: DecisionFormDialogProps) {
  interface BranchForm { name: string; condition: string; outputs: NodeIOItem[]; }
  const blankBranches: BranchForm[] = [
    { name: '', condition: '', outputs: [] },
    { name: '', condition: '', outputs: [] },
  ];
  const blank = { name: '', displayName: '', description: '', branches: blankBranches };

  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [branchIoErrors, setBranchIoErrors] = useState<Record<string, Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialValues) {
        setForm({
          name: initialValues.name,
          displayName: initialValues.displayName,
          description: initialValues.description ?? '',
          branches: initialValues.branches.map((b) => ({
            name: b.name,
            condition: b.condition ?? '',
            outputs: toNodeIOItems(b.outputs),
          })),
        });
      } else {
        setForm(blank);
      }
      setErrors({});
      setBranchIoErrors({});
      setSubmitError(undefined);
    }
  }, [open, mode, initialValues]);

  const validateName = (val: string) => {
    if (!val) return '请输入决策标识符';
    if (!/^[a-zA-Z0-9_-]{2,50}$/.test(val)) return '仅允许字母、数字、下划线、连字符，2~50 字符';
    return undefined;
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string | undefined> = {};
    const nameErr = validateName(form.name);
    if (nameErr) newErrors.name = nameErr;
    if (!form.displayName) newErrors.displayName = '请输入显示名称';
    // Check branches
    const branchNames = new Set<string>();
    form.branches.forEach((b, i) => {
      if (!b.name) newErrors[`branch_${i}_name`] = `分支 ${i + 1} 名称不能为空`;
      if (b.name && branchNames.has(b.name)) newErrors[`branch_${i}_name`] = `分支名 "${b.name}" 重复`;
      if (b.name) branchNames.add(b.name);
    });

    // 校验各分支的 outputs
    const allBranchIoErrors: Record<string, Record<string, string>> = {};
    let hasIoErrors = false;
    form.branches.forEach((b, i) => {
      const errs = validateNodeIOItems(b.outputs);
      if (Object.keys(errs).length > 0) {
        allBranchIoErrors[String(i)] = errs;
        hasIoErrors = true;
      }
    });
    setBranchIoErrors(allBranchIoErrors);

    if (Object.keys(newErrors).length > 0 || hasIoErrors) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        displayName: form.displayName,
        description: form.description || undefined,
        branches: form.branches.map((b) => ({
          name: b.name,
          condition: b.condition || undefined,
          outputs: fromNodeIOItems(b.outputs),
          edgeIds: [],
        })),
        version,
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && e.nativeEvent.target instanceof HTMLInputElement) {
          e.preventDefault();
          handleSubmit();
        }
      }}>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建决策' : '编辑决策'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? '定义角色的一个决策点（至少 2 个分支）' : '修改决策信息'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-[18px] px-6 py-5 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <Label>决策标识符 <span className="text-danger">*</span></Label>
            <Input
              placeholder="如 approve-or-reject"
              value={form.name}
              onChange={(e) => {
                const val = (e.target as HTMLInputElement).value;
                setForm((prev) => ({ ...prev, name: val }));
                if (val) setErrors((prev) => ({ ...prev, name: validateName(val) }));
                else setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              disabled={submitting}
            />
            {errors.name && <p className="text-sm text-danger">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>显示名称 <span className="text-danger">*</span></Label>
            <Input
              placeholder="如 审批决策"
              value={form.displayName}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, displayName: (e.target as HTMLInputElement).value }));
                if (errors.displayName) setErrors((prev) => ({ ...prev, displayName: undefined }));
              }}
              disabled={submitting}
            />
            {errors.displayName && <p className="text-sm text-danger">{errors.displayName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>描述</Label>
            <Textarea
              placeholder="决策的简要描述..."
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: (e.target as HTMLTextAreaElement).value }))}
              rows={2}
              disabled={submitting}
            />
          </div>

          {/* Branches editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>分支定义 <span className="text-danger">*</span>（至少 2 个）</Label>
              <Button
                variant="outline" size="sm"
                onClick={() => setForm((prev) => ({ ...prev, branches: [...prev.branches, { name: '', condition: '', outputs: [] }] }))}
                disabled={submitting || form.branches.length >= 10}
              >
                <Plus className="h-3 w-3 mr-1" /> 添加分支
              </Button>
            </div>
            {form.branches.map((branch, i) => (
              <div key={i} className="p-3 rounded border border-card-border bg-muted/30 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-text-tertiary mt-2 min-w-[20px]">{i + 1}.</span>
                  <div className="flex-1 space-y-1.5">
                    <Input
                      placeholder="分支名称"
                      value={branch.name}
                      onChange={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        setForm((prev) => ({
                          ...prev,
                          branches: prev.branches.map((b, idx) => idx === i ? { ...b, name: val } : b),
                        }));
                        if (errors[`branch_${i}_name`]) setErrors((prev) => {
                          const next = { ...prev };
                          delete next[`branch_${i}_name`];
                          return next;
                        });
                      }}
                      disabled={submitting}
                      className="h-8 text-sm"
                    />
                    {errors[`branch_${i}_name`] && <p className="text-xs text-danger">{errors[`branch_${i}_name`]}</p>}
                    <Input
                      placeholder="条件表达式（可选）"
                      value={branch.condition}
                      onChange={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        setForm((prev) => ({
                          ...prev,
                          branches: prev.branches.map((b, idx) => idx === i ? { ...b, condition: val } : b),
                        }));
                      }}
                      disabled={submitting}
                      className="h-8 text-sm"
                    />
                  </div>
                  {form.branches.length > 2 && (
                    <button
                      className="p-1 mt-1 text-text-tertiary hover:text-danger transition-colors"
                      onClick={() => setForm((prev) => ({ ...prev, branches: prev.branches.filter((_, idx) => idx !== i) }))}
                      disabled={submitting}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {/* 分支输出参数 */}
                <div className="pl-7">
                  <NodeIOEditor
                    label="输出参数"
                    items={branch.outputs}
                    onChange={(items) => {
                      setForm((prev) => ({
                        ...prev,
                        branches: prev.branches.map((b, idx) => idx === i ? { ...b, outputs: items } : b),
                      }));
                    }}
                    showRequired={false}
                    errors={branchIoErrors[String(i)] ?? {}}
                    disabled={submitting}
                  />
                </div>
              </div>
            ))}
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
// RoleDetailPage
// ============================================================

type TabKey = 'actions' | 'decisions';

export default function RoleDetailPage() {
  const { projectId, roleId } = useParams<{ projectId: string; roleId: string }>();
  const navigate = useNavigate();
  const { project, loading: projectLoading } = useProjectDetail(projectId);
  const behavior = useRoleBehavior(projectId ?? '');

  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('actions');

  // Dialog states
  const [createActionOpen, setCreateActionOpen] = useState(false);
  const [editActionTarget, setEditActionTarget] = useState<RoleAction | null>(null);
  const [deleteActionTarget, setDeleteActionTarget] = useState<RoleAction | null>(null);
  const [createDecisionOpen, setCreateDecisionOpen] = useState(false);
  const [editDecisionTarget, setEditDecisionTarget] = useState<DecisionDef | null>(null);
  const [deleteDecisionTarget, setDeleteDecisionTarget] = useState<DecisionDef | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch role detail
  useEffect(() => {
    if (!projectId || !roleId) return;
    setRoleLoading(true);
    apiClient.get<{ data: Role[] }>(`/projects/${projectId}/roles`)
      .then((res) => {
        const found = res.data.data.find((r: Role) => r.id === roleId);
        setRole(found ?? null);
        // 同步 version 到 behavior hook（乐观锁）
        if (found) {
          behavior.setVersion(found.version);
        }
      })
      .catch(() => setRole(null))
      .finally(() => setRoleLoading(false));
  }, [projectId, roleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch behaviors when role is loaded
  useEffect(() => {
    if (roleId) {
      behavior.refetchActions(roleId);
      behavior.refetchDecisions(roleId);
    }
  }, [roleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isArchived = project?.status === 'archived';

  const handleDeleteAction = async () => {
    if (!deleteActionTarget || !roleId) return;
    setDeleting(true);
    try {
      await behavior.deleteAction(roleId, deleteActionTarget.id);
      toast.success(`行为「${deleteActionTarget.displayName}」已删除`);
      setDeleteActionTarget(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteDecision = async () => {
    if (!deleteDecisionTarget || !roleId) return;
    setDeleting(true);
    try {
      await behavior.deleteDecision(roleId, deleteDecisionTarget.id);
      toast.success(`决策「${deleteDecisionTarget.displayName}」已删除`);
      setDeleteDecisionTarget(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  if (projectLoading || roleLoading) {
    return <DetailSkeleton />;
  }

  if (!role) {
    return (
      <div className="rounded-card border border-danger bg-danger-bg p-8 text-center">
        <p className="text-lg font-medium text-danger">角色不存在</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(`/p/${projectId}/roles`)}>返回角色列表</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===== 页头 ===== */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/p/${projectId}/roles`)}
          className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-text-primary">{role.displayName}</h2>
          <p className="text-sm text-text-secondary">{role.name}</p>
        </div>
      </div>

      {/* ===== Tab 切换 ===== */}
      <div className="flex items-center gap-1 border-b border-card-border">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'actions'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('actions')}
        >
          <Zap className="h-4 w-4 inline mr-1.5" />
          行为 ({behavior.actions.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'decisions'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('decisions')}
        >
          <GitBranch className="h-4 w-4 inline mr-1.5" />
          决策 ({behavior.decisions.length})
        </button>
      </div>

      {/* ===== Actions Tab ===== */}
      {activeTab === 'actions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">定义角色的行为（Action），描述角色可以执行的操作</p>
            {!isArchived && (
              <Button size="sm" onClick={() => setCreateActionOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> 新建行为
              </Button>
            )}
          </div>

          {behavior.actionsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-card border border-card-border p-4 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : behavior.actions.length === 0 ? (
            <div className="py-16 text-center">
              <Zap className="mx-auto h-10 w-10 text-text-tertiary mb-3" />
              <p className="text-sm text-text-tertiary">还没有行为，点击「新建行为」创建</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {behavior.actions.map((action) => (
                <div
                  key={action.id}
                  className="group relative rounded-card border border-card-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  {/* 操作按钮 */}
                  {!isArchived && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"
                        onClick={() => setEditActionTarget(action)}
                        title="编辑"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                        onClick={() => setDeleteActionTarget(action)}
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <h3 className="font-semibold text-text-primary pr-14 truncate">{action.displayName}</h3>
                  <p className="text-xs text-text-tertiary mt-0.5">{action.name}</p>
                  {action.description && (
                    <p className="mt-2 text-sm text-text-secondary line-clamp-2">{action.description}</p>
                  )}
                  {action.logic?.userDesc && (
                    <p className="mt-1.5 text-xs text-text-tertiary line-clamp-2">
                      <span className="font-medium">逻辑：</span>{action.logic.userDesc}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5">
                    {action.tool && <Badge variant="info" className="text-[10px]">工具</Badge>}
                    <Badge variant="draft" className="text-[10px]">{action.inputs?.length ?? 0} 入参</Badge>
                    <Badge variant="draft" className="text-[10px]">{action.outputs?.length ?? 0} 出参</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Decisions Tab ===== */}
      {activeTab === 'decisions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">定义角色的决策点（Decision），描述角色的条件判断分支</p>
            {!isArchived && (
              <Button size="sm" onClick={() => setCreateDecisionOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> 新建决策
              </Button>
            )}
          </div>

          {behavior.decisionsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-card border border-card-border p-4 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : behavior.decisions.length === 0 ? (
            <div className="py-16 text-center">
              <GitBranch className="mx-auto h-10 w-10 text-text-tertiary mb-3" />
              <p className="text-sm text-text-tertiary">还没有决策，点击「新建决策」创建</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {behavior.decisions.map((decision) => (
                <div
                  key={decision.id}
                  className="group relative rounded-card border border-card-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  {!isArchived && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"
                        onClick={() => setEditDecisionTarget(decision)}
                        title="编辑"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                        onClick={() => setDeleteDecisionTarget(decision)}
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <h3 className="font-semibold text-text-primary pr-14 truncate">{decision.displayName}</h3>
                  <p className="text-xs text-text-tertiary mt-0.5">{decision.name}</p>
                  {decision.description && (
                    <p className="mt-2 text-sm text-text-secondary line-clamp-2">{decision.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {decision.branches.map((branch, i) => (
                      <Badge key={i} variant="info" className="text-[10px]">
                        {branch.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Action Dialogs ===== */}
      <ActionFormDialog
        open={createActionOpen}
        onOpenChange={setCreateActionOpen}
        mode="create"
        version={behavior.currentVersion}
        onSubmit={async (data) => {
          if (!roleId) return;
          const result = await behavior.createAction(roleId, data);
          toast.success(`行为「${result.action.displayName}」创建成功`);
        }}
      />
      <ActionFormDialog
        open={!!editActionTarget}
        onOpenChange={(o) => { if (!o) setEditActionTarget(null); }}
        mode="edit"
        initialValues={editActionTarget ?? undefined}
        version={behavior.currentVersion}
        onSubmit={async (data) => {
          if (!roleId || !editActionTarget) return;
          const result = await behavior.updateAction(roleId, editActionTarget.id, data);
          toast.success(`行为「${result.action.displayName}」已更新`);
          setEditActionTarget(null);
        }}
      />
      <AlertDialog open={!!deleteActionTarget} onOpenChange={(o) => { if (!o) setDeleteActionTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除行为「{deleteActionTarget?.displayName}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteAction}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Decision Dialogs ===== */}
      <DecisionFormDialog
        open={createDecisionOpen}
        onOpenChange={setCreateDecisionOpen}
        mode="create"
        version={behavior.currentVersion}
        onSubmit={async (data) => {
          if (!roleId) return;
          const result = await behavior.createDecision(roleId, data);
          toast.success(`决策「${result.decision.displayName}」创建成功`);
        }}
      />
      <DecisionFormDialog
        open={!!editDecisionTarget}
        onOpenChange={(o) => { if (!o) setEditDecisionTarget(null); }}
        mode="edit"
        initialValues={editDecisionTarget ?? undefined}
        version={behavior.currentVersion}
        onSubmit={async (data) => {
          if (!roleId || !editDecisionTarget) return;
          const result = await behavior.updateDecision(roleId, editDecisionTarget.id, data);
          toast.success(`决策「${result.decision.displayName}」已更新`);
          setEditDecisionTarget(null);
        }}
      />
      <AlertDialog open={!!deleteDecisionTarget} onOpenChange={(o) => { if (!o) setDeleteDecisionTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除决策「{deleteDecisionTarget?.displayName}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteDecision}
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
