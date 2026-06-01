/**
 * @module FieldDialog
 * @description 新建/编辑字段 Dialog。支持 9 种字段类型，动态渲染约束表单。
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useDomainModelContext } from '@/contexts/DomainModelContext';
import type { Field, FieldType } from '@/hooks/useDomainModel';
import FieldConstraintsForm from '../forms/FieldConstraintsForm';

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
  { value: 'string', label: 'string — 短文本' },
  { value: 'text', label: 'text — 长文本' },
  { value: 'number', label: 'number — 数字' },
  { value: 'boolean', label: 'boolean — 布尔' },
  { value: 'datetime', label: 'datetime — 日期时间' },
  { value: 'enum', label: 'enum — 枚举' },
  { value: 'email', label: 'email — 邮箱' },
  { value: 'url', label: 'url — 链接' },
  { value: 'phone', label: 'phone — 电话' },
];

const NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  field: Field | null; // null = 新建
}

export default function FieldDialog({ open, onOpenChange, entityId, field }: Props) {
  const { createField, updateField } = useDomainModelContext();
  const isEdit = field !== null;

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('string');
  const [description, setDescription] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [constraints, setConstraints] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');

  // 编辑模式时初始化表单
  useEffect(() => {
    if (field) {
      setName(field.name);
      setDisplayName(field.displayName);
      setFieldType(field.fieldType);
      setDescription(field.description ?? '');
      setIsRequired(field.isRequired);
      setConstraints((field.constraints as Record<string, unknown>) ?? {});
    } else {
      setName('');
      setDisplayName('');
      setFieldType('string');
      setDescription('');
      setIsRequired(false);
      setConstraints({});
    }
    setNameError('');
  }, [field, open]);

  // 切换字段类型时清空约束
  const handleFieldTypeChange = (val: FieldType) => {
    setFieldType(val);
    setConstraints({});
  };

  const handleSubmit = async () => {
    if (!isEdit) {
      const err = !name ? '字段名不能为空' :
        name.length > 64 ? '字段名不能超过 64 个字符' :
        !NAME_PATTERN.test(name) ? '字段名必须以字母开头，只能包含字母、数字、下划线' : '';
      if (err) { setNameError(err); return; }
    }
    if (!displayName.trim()) { toast.error('显示名不能为空'); return; }

    // enum 类型校验
    if (fieldType === 'enum') {
      const options = constraints.options as Array<{ value: string; label: string }> | undefined;
      if (!options || options.length === 0) {
        toast.error('枚举类型至少需要一个选项');
        return;
      }
      const invalid = options.some((o) => !o.value.trim());
      if (invalid) { toast.error('枚举选项的值不能为空'); return; }
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateField(entityId, field!.id, {
          displayName: displayName.trim(),
          description: description.trim() || undefined,
          fieldType,
          isRequired,
          constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
        });
        toast.success('字段已更新');
      } else {
        await createField(entityId, {
          name: name.trim(),
          displayName: displayName.trim(),
          fieldType,
          description: description.trim() || undefined,
          isRequired,
          constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
        });
        toast.success('字段创建成功');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑字段' : '添加字段'}</DialogTitle>
        </DialogHeader>

        <div className="p-6 overflow-y-auto [&>div]:mb-[18px] [&>div:last-child]:mb-0">
          {/* 字段名（新建时可编辑） */}
          <div className="space-y-1">
            <Label className="text-sm">
              字段名 {!isEdit && <span className="text-red-500">*</span>}
            </Label>
            {isEdit ? (
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm font-mono text-foreground">
                {field?.name}
              </div>
            ) : (
              <>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName((e.target as HTMLInputElement).value);
                    setNameError(
                      !(e.target as HTMLInputElement).value ? '字段名不能为空' :
                      !NAME_PATTERN.test((e.target as HTMLInputElement).value) ? '字段名必须以字母开头，只能包含字母、数字、下划线' : ''
                    );
                  }}
                  placeholder="如 userName"
                  className="h-9 text-sm font-mono"
                />
                {nameError && <p className="text-xs text-red-500">{nameError}</p>}
              </>
            )}
          </div>

          {/* 显示名 */}
          <div className="space-y-1">
            <Label className="text-sm">
              显示名 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName((e.target as HTMLInputElement).value)}
              placeholder="如 用户名"
              className="h-9 text-sm"
            />
          </div>

          {/* 字段类型 */}
          <div className="space-y-1">
            <Label className="text-sm">
              字段类型 <span className="text-red-500">*</span>
            </Label>
            <Select value={fieldType} onValueChange={(v) => handleFieldTypeChange((v ?? "string") as FieldType)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((ft) => (
                  <SelectItem key={ft.value} value={ft.value} className="text-sm">
                    {ft.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 必填 */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">必填</Label>
            <Switch checked={isRequired} onCheckedChange={setIsRequired} />
          </div>

          {/* 约束配置 */}
          <div className="space-y-1">
            <Label className="text-sm">约束配置</Label>
            <div className="rounded-md border border-border p-3">
              <FieldConstraintsForm
                fieldType={fieldType}
                constraints={constraints}
                onChange={setConstraints}
              />
            </div>
          </div>

          {/* 描述 */}
          <div className="space-y-1">
            <Label className="text-sm">描述（可选）</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              rows={2}
              placeholder="字段说明..."
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : isEdit ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
