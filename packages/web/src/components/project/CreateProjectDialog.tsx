/**
 * @module CreateProjectDialog
 * @description 创建项目对话框：name + displayName + description 表单。
 *              对应 F-M1-02，含前端即时校验 + 后端提交 + 409 冲突处理。
 */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';
import type { Project } from '@apm/shared';

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (project: Project) => void;
}

interface FormState {
  name: string;
  displayName: string;
  description: string;
}

interface FieldErrors {
  name?: string;
  displayName?: string;
}

/** 校验表单数据，返回字段级错误（无错误返回 null） */
function validateForm(form: FormState): FieldErrors | null {
  const errors: FieldErrors = {};

  // name: 必填 + 格式校验（B-M1-10）
  if (!form.name) {
    errors.name = '请输入项目标识符';
  } else if (!NAME_PATTERN.test(form.name)) {
    errors.name = '格式不正确：必须以小写字母开头，仅允许小写字母、数字、连字符';
  }

  // displayName: 必填校验
  if (!form.displayName) {
    errors.displayName = '请输入显示名称';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * 创建项目对话框组件。
 *
 * Props:
 * - open: 是否可见（受控模式）
 * - onOpenChange: 关闭回调
 * - onSuccess: 创建成功回调，传入完整 Project 对象（父组件负责 toast + 导航）
 *
 * 表单字段：name(必填, regex校验) / displayName(必填) / description(可选)
 *
 * 交互行为：
 * - 每次打开重置表单和错误状态
 * - 提交前前端全量校验，不通过则聚焦首个错误字段
 * - 409 名称冲突 → 字段级错误，对话框保持打开
 * - 其他错误 → api-client interceptor 全局 toast
 * - Enter 键提交（Textarea 内 Cmd+Enter 不触发）
 */
export function CreateProjectDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateProjectDialogProps) {
  // 表单状态
  const [form, setForm] = useState<FormState>({
    name: '',
    displayName: '',
    description: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // 每次打开时重置表单
  useEffect(() => {
    if (open) {
      setForm({ name: '', displayName: '', description: '' });
      setErrors({});
      setSubmitting(false);
    }
  }, [open]);

  // 字段变更
  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // 清除该字段的错误（用户修正时）
    if (errors[field as keyof FieldErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // 提交
  const handleSubmit = async () => {
    // 前端全量校验
    const validationErrors = validateForm(form);
    if (validationErrors) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/projects', {
        name: form.name,
        displayName: form.displayName,
        description: form.description || undefined,
      });

      onSuccess(res.data as Project);
    } catch (err: unknown) {
      // B-M1-10: 409 名称冲突 → 字段级错误，对话框保持打开
      const axiosErr = err as { response?: { status: number }; message?: string };
      if (axiosErr.response?.status === 409) {
        setErrors({ name: axiosErr.message || '该名称已被使用，请更换' });
      }
      // 其他错误由全局 toast 处理（api-client interceptor 已转换）
    } finally {
      setSubmitting(false);
    }
  };

  // 键盘 Enter 提交（Cmd+Enter 在 Textarea 中换行）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && e.nativeEvent.target instanceof HTMLInputElement) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>新建项目</DialogTitle>
          <DialogDescription>
            填写项目基本信息。标识符用于 URL 和 API 引用，创建后不可修改。
          </DialogDescription>
        </DialogHeader>

        {/* ===== 表单区域 ===== */}
        <div className="space-y-4 py-2">
          {/* name */}
          <div className="space-y-1.5">
            <Label htmlFor="create-name">
              项目标识符 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="create-name"
              placeholder="如 my-project"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              autoComplete="off"
              pattern="^[a-z][a-z0-9-]*$"
              disabled={submitting}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* displayName */}
          <div className="space-y-1.5">
            <Label htmlFor="create-display-name">
              显示名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="create-display-name"
              placeholder="如 换电站管理系统"
              value={form.displayName}
              onChange={(e) => updateField('displayName', e.target.value)}
              disabled={submitting}
            />
            {errors.displayName && (
              <p className="text-sm text-destructive">{errors.displayName}</p>
            )}
          </div>

          {/* description */}
          <div className="space-y-1.5">
            <Label htmlFor="create-desc">项目描述（可选）</Label>
            <Textarea
              id="create-desc"
              placeholder="简要描述这个项目..."
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              maxLength={500}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '创建中...' : '确认创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
