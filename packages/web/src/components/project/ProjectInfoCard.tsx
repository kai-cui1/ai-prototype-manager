/**
 * @module ProjectInfoCard
 * @description 项目基本信息卡片：支持只读展示 + 行内编辑（F-M1-04）两种模式。
 *              对应 F-M1-03 详情页 Zone 2（基本信息区域）。
 *
 * 样式对齐 §6.4 Card 规格：rounded-card + shadow-card
 * 使用 SectionHeading 统一区块标题（§7）
 */
import { useState, useEffect } from 'react';
import type { Project } from '@apm/shared';
import { formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SectionHeading } from '@/components/common/SectionHeading';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

/** B-M1-18: 编辑模式正则比创建（B-M1-10）宽松——允许大写字母和下划线，无首字符限制 */
const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

interface EditFormState {
  name: string;
  displayName: string;
  description: string;
}

interface FieldErrors {
  name?: string;
  displayName?: string;
}

interface ProjectInfoCardProps {
  project: Project;
  isEditing: boolean;
  updating: boolean;
  onEditToggle: () => void;
  onSave: (data: { name: string; displayName: string; description?: string | null }) => Promise<void>;
}

/** 校验编辑表单，返回字段级错误（无错误返回 null） */
function validateEditForm(form: EditFormState): FieldErrors | null {
  const errors: FieldErrors = {};

  // B-M1-18/B-M1-19: name 格式 + 长度校验（前端即时反馈）
  if (!form.name) {
    errors.name = '请输入项目标识符';
  } else if (!NAME_PATTERN.test(form.name)) {
    errors.name = '格式不正确：仅允许英文字母、数字、下划线、连字符';
  } else if (form.name.length < 2 || form.name.length > 50) {
    errors.name = '长度必须在 2~50 个字符之间';
  }

  // B-M1-21: displayName 必填
  if (!form.displayName) {
    errors.displayName = '请输入显示名称';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * 项目基本信息卡片。
 *
 * isEditing=false → 2 列网格只读展示（含 version 字段）
 * isEditing=true  → name/displayName/description 变为输入框 + 保存/取消按钮
 */
export function ProjectInfoCard({
  project,
  isEditing,
  updating,
  onEditToggle,
  onSave,
}: ProjectInfoCardProps) {
  // 编辑表单状态（进入编辑时从 project 初始化）
  const [form, setForm] = useState<EditFormState>(() => ({
    name: project.name,
    displayName: project.displayName,
    description: project.description || '',
  }));
  const [errors, setErrors] = useState<FieldErrors>({});

  // refetch 后 project 数据更新时，同步表单快照
  useEffect(() => {
    if (!isEditing) {
      setForm({
        name: project.name,
        displayName: project.displayName,
        description: project.description || '',
      });
    }
  }, [project, isEditing]);

  // 字段变更 + 清除对应错误
  const updateField = <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FieldErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // 保存
  const handleSave = async () => {
    const validationErrors = validateEditForm(form);
    if (validationErrors) {
      setErrors(validationErrors);
      return;
    }

    try {
      await onSave({
        name: form.name,
        displayName: form.displayName,
        description: form.description || undefined,
      });
    } catch (err) {
      const axiosErr = err as { response?: { status: number }; message?: string };
      if (axiosErr.response?.status === 409) {
        setErrors({ name: axiosErr.message || '该名称已被使用，请更换' });
      }
    }
  };

  // 取消：恢复快照
  const handleCancel = () => {
    setForm({
      name: project.name,
      displayName: project.displayName,
      description: project.description || '',
    });
    setErrors({});
    onEditToggle();
  };

  // 键盘事件：Enter 保存 / Esc 取消
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && e.nativeEvent.target instanceof HTMLInputElement) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // ===== 只读模式 =====
  if (!isEditing) {
    return (
      <Card>
        <CardContent className="p-6">
          <SectionHeading
            title="基本信息"
            action={
              project.status !== 'archived' && (
                <Button variant="outline" size="sm" onClick={onEditToggle}>
                  编辑
                </Button>
              )
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
            <div>
              <p className="text-sm text-text-secondary">项目标识符</p>
              <p className="mt-1 text-sm font-medium font-mono text-text-primary">{project.name}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">显示名称</p>
              <p className="mt-1 text-sm font-medium text-text-primary">{project.displayName}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">项目描述</p>
              <p className="mt-1 text-sm text-text-primary">{project.description || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">当前状态</p>
              <div className="mt-1"><StatusBadge status={project.status} /></div>
            </div>
            <div>
              <p className="text-sm text-text-secondary">版本号</p>
              <p className="mt-1 text-sm font-mono text-text-primary">v{project.version}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">创建时间</p>
              <p className="mt-1 text-sm text-text-primary">{formatDateTime(project.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">更新时间</p>
              <p className="mt-1 text-sm text-text-primary">{formatDateTime(project.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ===== 编辑模式 =====
  return (
    <Card>
      <CardContent className="p-6">
        <SectionHeading
          title="基本信息（编辑中）"
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={updating}>
                取消
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updating}>
                {updating ? '保存中...' : '保存'}
              </Button>
            </div>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8" onKeyDown={handleKeyDown}>
          {/* name — 可编辑 */}
          <div className="space-y-1">
            <label className="text-sm text-text-secondary">
              项目标识符 <span className="text-danger">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => updateField('name', (e.target as HTMLInputElement).value)}
              placeholder="如 ev-charging-station"
              autoComplete="off"
              pattern="[a-zA-Z0-9_-]{2,50}"
              disabled={updating}
            />
            {errors.name && <p className="text-sm text-danger">{errors.name}</p>}
          </div>

          {/* displayName — 可编辑 */}
          <div className="space-y-1">
            <label className="text-sm text-text-secondary">
              显示名称 <span className="text-danger">*</span>
            </label>
            <Input
              value={form.displayName}
              onChange={(e) => updateField('displayName', (e.target as HTMLInputElement).value)}
              placeholder="如 换电站管理系统"
              disabled={updating}
            />
            {errors.displayName && <p className="text-sm text-danger">{errors.displayName}</p>}
          </div>

          {/* description — 可编辑（跨两列） */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm text-text-secondary">项目描述（可选）</label>
            <Textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="简要描述这个项目..."
              rows={3}
              maxLength={2000}
              disabled={updating}
            />
          </div>

          {/* 状态 — 只读 */}
          <div>
            <p className="text-sm text-text-secondary">当前状态</p>
            <div className="mt-1"><StatusBadge status={project.status} /></div>
          </div>

          {/* version — 只读（乐观锁依据） */}
          <div>
            <p className="text-sm text-text-secondary">版本号</p>
            <p className="mt-1 text-sm font-mono text-text-primary">v{project.version}</p>
          </div>

          {/* 创建时间 — 只读 */}
          <div>
            <p className="text-sm text-text-secondary">创建时间</p>
            <p className="mt-1 text-sm text-text-primary">{formatDateTime(project.createdAt)}</p>
          </div>

          {/* 更新时间 — 只读 */}
          <div>
            <p className="text-sm text-text-secondary">更新时间</p>
            <p className="mt-1 text-sm text-text-primary">{formatDateTime(project.updatedAt)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
