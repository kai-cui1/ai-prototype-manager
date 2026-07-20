/**
 * @module DecisionFormDialog
 * @description 决策（Decision）新建/编辑/查看 Dialog — F-M1-12 / F-M1-13 共享组件。
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
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import {
  NodeIOEditor,
  toNodeIOItems,
  fromNodeIOItems,
  validateNodeIOItems,
} from '@/components/role-behavior/NodeIOEditor';
import type { NodeIOItem } from '@/components/role-behavior/NodeIOEditor';
import type { DecisionDef } from '@apm/shared';
import {
  detectBehaviorImpact,
  enrichImpactWithEdgeCounts,
  formatImpactItem,
  type ImpactItem,
} from '@/lib/behavior-impact';

export interface DecisionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit' | 'view';
  holderLabel: string;              // "角色" 或 "外部实体"，用于 Dialog 标题
  initialValues?: DecisionDef;
  version?: number;
  onSubmit?: (data: Record<string, unknown>) => Promise<unknown>;
  /** 当前流程图的连线，用于影响判断 */
  processEdges?: Array<{ mappings?: Array<{ sourceField: string; targetField: string }>; label?: string | null; sourceNodeId: string; targetNodeId: string }>;
  /** 当前节点 id */
  nodeId?: string;
}

export function DecisionFormDialog({
  open, onOpenChange, mode, holderLabel, initialValues, version, onSubmit, processEdges, nodeId,
}: DecisionFormDialogProps) {
  const isView = mode === 'view';
  interface BranchForm { name: string; condition: string; outputs: NodeIOItem[]; }
  const blankBranches: BranchForm[] = [
    { name: '', condition: '', outputs: [] },
    { name: '', condition: '', outputs: [] },
  ];
  const blank = { name: '', displayName: '', description: '', inputs: [] as NodeIOItem[], branches: blankBranches };

  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [inputIoErrors, setInputIoErrors] = useState<Record<string, string>>({});
  const [branchIoErrors, setBranchIoErrors] = useState<Record<string, Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  // 二次确认 Dialog 状态
  const [impactItems, setImpactItems] = useState<ImpactItem[]>([]);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) {
      if ((mode === 'edit' || mode === 'view') && initialValues) {
        setForm({
          name: initialValues.name,
          displayName: initialValues.displayName,
          description: initialValues.description ?? '',
          inputs: toNodeIOItems(initialValues.inputs),
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
      setInputIoErrors({});
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
    if (isView || !onSubmit) return;
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

    // 校验 inputs
    const inputErrs = validateNodeIOItems(form.inputs);
    setInputIoErrors(inputErrs);

    // 校验各分支的 outputs
    const allBranchIoErrors: Record<string, Record<string, string>> = {};
    let hasIoErrors = Object.keys(inputErrs).length > 0;
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

    const payload: Record<string, unknown> = {
      name: form.name,
      displayName: form.displayName,
      description: form.description || undefined,
      inputs: fromNodeIOItems(form.inputs),
      branches: form.branches.map((b) => ({
        name: b.name,
        condition: b.condition || undefined,
        outputs: fromNodeIOItems(b.outputs),
        edgeIds: [],
      })),
    };
    if (mode === 'edit') {
      payload.version = version;
    }

    // 编辑模式：影响判断
    if (mode === 'edit' && initialValues && processEdges !== undefined && nodeId !== undefined) {
      const rawImpact = detectBehaviorImpact(
        {
          inputs: initialValues.inputs,
          branches: initialValues.branches,
        },
        {
          inputs: payload.inputs as { name: string }[],
          branches: payload.branches as { name: string }[],
        },
      );
      const enriched = enrichImpactWithEdgeCounts(rawImpact, processEdges, nodeId);
      const affectingItems = enriched.filter((it) => (it.affectedEdgeCount ?? 0) > 0);
      if (affectingItems.length > 0) {
        setImpactItems(enriched);
        setPendingPayload(payload);
        setConfirmOpen(true);
        return;
      }
    }

    await doSubmit(payload);
  };

  const doSubmit = async (payload: Record<string, unknown>) => {
    if (!onSubmit) return;
    setSubmitting(true);
    try {
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

  const handleConfirm = async () => {
    if (!pendingPayload) return;
    setConfirming(true);
    setConfirmOpen(false);
    await doSubmit(pendingPayload);
    setConfirming(false);
    setPendingPayload(null);
  };

  return (<>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" onKeyDown={(e) => {
        if (isView) return;
        if (e.key === 'Enter' && !e.shiftKey && e.nativeEvent.target instanceof HTMLInputElement) {
          e.preventDefault();
          handleSubmit();
        }
      }}>
        <DialogHeader>
          <DialogTitle>{isView ? '查看决策' : mode === 'create' ? '新建决策' : '编辑决策'}</DialogTitle>
          <DialogDescription>
            {isView ? `${holderLabel}的决策（Decision）详情` : mode === 'create' ? `定义${holderLabel}的一个决策点（至少 2 个分支）` : '修改决策信息'}
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
              disabled={isView || submitting}
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
              disabled={isView || submitting}
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
              disabled={isView || submitting}
            />
          </div>

          {/* 输入参数 */}
          <NodeIOEditor
            label="输入参数"
            items={form.inputs}
            onChange={(items) => setForm((prev) => ({ ...prev, inputs: items }))}
            showRequired={true}
            showDefaultValue={true}
            errors={inputIoErrors}
            disabled={isView || submitting}
          />

          {/* Branches editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>分支定义 <span className="text-danger">*</span>（至少 2 个）</Label>
              {!isView && (
                <Button
                  variant="outline" size="sm"
                  onClick={() => setForm((prev) => ({ ...prev, branches: [...prev.branches, { name: '', condition: '', outputs: [] }] }))}
                  disabled={submitting || form.branches.length >= 10}
                >
                  <Plus className="h-3 w-3 mr-1" /> 添加分支
                </Button>
              )}
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
                      disabled={isView || submitting}
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
                      disabled={isView || submitting}
                      className="h-8 text-sm"
                    />
                  </div>
                  {!isView && form.branches.length > 2 && (
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
                    disabled={isView || submitting}
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
          {isView ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting || confirming}>取消</Button>
              <Button onClick={handleSubmit} disabled={submitting || confirming}>
                {submitting ? '提交中...' : mode === 'create' ? '确认创建' : '保存修改'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* 二次确认 Dialog */}
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            此修改将影响引用该行为的流程图
          </DialogTitle>
          <DialogDescription>
            以下变更将导致相关流程图的参数映射或分支绑定被清空，需要重新配置：
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 py-2 space-y-2">
          {impactItems.map((item, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
              <span className="text-amber-600 text-xs mt-0.5">●</span>
              <span>{formatImpactItem(item)}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingPayload(null); }}>
            取消
          </Button>
          <Button variant="default" onClick={handleConfirm} disabled={confirming}>
            {confirming ? '提交中...' : '确认修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>);
}
