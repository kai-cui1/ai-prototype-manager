/**
 * @module ActionFormDialog
 * @description 行为（Action）新建/编辑/查看 Dialog — F-M1-12 / F-M1-13 共享组件。
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
import {
  NodeIOEditor,
  toNodeIOItems,
  fromNodeIOItems,
  validateNodeIOItems,
} from '@/components/role-behavior/NodeIOEditor';
import type { NodeIOItem } from '@/components/role-behavior/NodeIOEditor';
import type { RoleAction } from '@apm/shared';
import { AlertTriangle } from 'lucide-react';
import {
  detectBehaviorImpact,
  enrichImpactWithEdgeCounts,
  formatImpactItem,
  type ImpactItem,
} from '@/lib/behavior-impact';

export interface ActionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit' | 'view';
  holderLabel: string;              // "角色" 或 "外部实体"，用于 Dialog 标题
  initialValues?: RoleAction;
  version?: number;
  onSubmit?: (data: Record<string, unknown>) => Promise<unknown>;
  /** 当前流程图的连线，用于影响判断（编辑模式下必填） */
  processEdges?: Array<{ mappings?: Array<{ sourceField: string; targetField: string }>; label?: string | null; sourceNodeId: string; targetNodeId: string }>;
  /** 当前节点 id，用于影响判断 */
  nodeId?: string;
}

export function ActionFormDialog({
  open, onOpenChange, mode, holderLabel, initialValues, version, onSubmit, processEdges, nodeId,
}: ActionFormDialogProps) {
  const isView = mode === 'view';
  const blank = { name: '', displayName: '', description: '', logicUserDesc: '', logicData: '' };
  const [form, setForm] = useState(blank);
  const [inputItems, setInputItems] = useState<NodeIOItem[]>([]);
  const [outputItems, setOutputItems] = useState<NodeIOItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [ioErrors, setIoErrors] = useState<Record<string, string>>({});
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
    if (isView || !onSubmit) return;
    const newErrors: Record<string, string | undefined> = {};
    const nameErr = validateName(form.name);
    if (nameErr) newErrors.name = nameErr;
    if (!form.displayName) newErrors.displayName = '请输入显示名称';
    if (!form.logicUserDesc) newErrors.logicUserDesc = '请输入行为逻辑描述';

    // 校验 inputs/outputs
    const inputErrs = validateNodeIOItems(inputItems);
    const outputErrs = validateNodeIOItems(outputItems);
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

    const payload: Record<string, unknown> = {
      name: form.name,
      displayName: form.displayName,
      description: form.description || undefined,
      inputs: fromNodeIOItems(inputItems),
      outputs: fromNodeIOItems(outputItems),
      logic: { userDesc: form.logicUserDesc, data: form.logicData || undefined },
      tool: null,
    };
    if (mode === 'edit') {
      payload.version = version;
    }

    // 编辑模式：影响判断
    if (mode === 'edit' && initialValues && processEdges !== undefined && nodeId !== undefined) {
      const rawImpact = detectBehaviorImpact(
        { inputs: initialValues.inputs, outputs: initialValues.outputs },
        { inputs: payload.inputs as { name: string }[], outputs: payload.outputs as { name: string }[] },
      );
      const enriched = enrichImpactWithEdgeCounts(rawImpact, processEdges, nodeId);
      // 将所有影响项展示（包括影响 0 条的）
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
          <DialogTitle>{isView ? '查看行为' : mode === 'create' ? '新建行为' : '编辑行为'}</DialogTitle>
          <DialogDescription>
            {isView ? `${holderLabel}的行为（Action）详情` : mode === 'create' ? `定义${holderLabel}的一个行为（Action）` : '修改行为信息'}
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
              disabled={isView || submitting}
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
              disabled={isView || submitting}
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
              disabled={isView || submitting}
            />
          </div>

          {/* 输入参数 */}
          <NodeIOEditor
            label="输入参数"
            items={inputItems}
            onChange={setInputItems}
            showRequired={true}
            showDefaultValue={true}
            errors={Object.fromEntries(
              Object.entries(ioErrors).filter(([k]) => !k.startsWith('out-'))
            )}
            disabled={isView || submitting}
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
            disabled={isView || submitting}
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
              disabled={isView || submitting}
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
              disabled={isView || submitting}
            />
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
            以下变更将导致相关流程图的参数映射被清空，需要重新配置：
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
