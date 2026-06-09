/**
 * @module DecisionFormDialog
 * @description 决策（Decision）新建/编辑 Dialog — F-M1-12 / F-M1-13 共享组件。
 *              由 RoleDetailPage 和 ExternalEntityDetailPage 共同引用。
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import {
  NodeIOEditor,
  toNodeIOItems,
  fromNodeIOItems,
  validateNodeIOItems,
} from '@/components/role-behavior/NodeIOEditor';
import type { NodeIOItem } from '@/components/role-behavior/NodeIOEditor';
import type { DecisionDef } from '@apm/shared';

export interface DecisionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  holderLabel: string;              // "角色" 或 "外部实体"，用于 Dialog 标题
  initialValues?: DecisionDef;
  version: number;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
}

export function DecisionFormDialog({
  open, onOpenChange, mode, holderLabel, initialValues, version, onSubmit,
}: DecisionFormDialogProps) {
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
            {mode === 'create' ? `定义${holderLabel}的一个决策点（至少 2 个分支）` : '修改决策信息'}
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
