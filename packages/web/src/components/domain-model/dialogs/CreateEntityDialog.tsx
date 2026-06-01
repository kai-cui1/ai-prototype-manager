/**
 * @module CreateEntityDialog
 * @description 新建实体 Dialog。
 * 字段：name（标识符，格式校验）+ displayName + description + category
 */

import { useState } from 'react';
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
import { useDomainModelContext } from '@/contexts/DomainModelContext';

const NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

const CATEGORY_OPTIONS = [
  { value: '__none__', label: '（无分类）' },
  { value: 'core', label: '核心实体' },
  { value: 'supporting', label: '支撑实体' },
  { value: 'event', label: '事件实体' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateEntityDialog({ open, onOpenChange }: Props) {
  const { createEntity } = useDomainModelContext();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('__none__');
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');

  const validateName = (val: string): string => {
    if (!val) return '实体名不能为空';
    if (val.length > 64) return '实体名不能超过 64 个字符';
    if (!NAME_PATTERN.test(val)) return '实体名必须以字母开头，只能包含字母、数字、下划线';
    return '';
  };

  const handleSubmit = async () => {
    const err = validateName(name);
    if (err) { setNameError(err); return; }
    if (!displayName.trim()) { toast.error('显示名不能为空'); return; }

    setSubmitting(true);
    try {
      await createEntity({
        name: name.trim(),
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        category: category === '__none__' ? undefined : category,
      });
      toast.success('实体创建成功');
      handleClose();
    } catch (err) {
      toast.error((err as Error).message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDisplayName('');
    setDescription('');
    setCategory('__none__');
    setNameError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建领域实体</DialogTitle>
        </DialogHeader>

        <div className="p-6 overflow-y-auto [&>div]:mb-[18px] [&>div:last-child]:mb-0">
          {/* 实体名 */}
          <div className="space-y-1">
            <Label className="text-sm">
              实体名 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => {
                const v = (e.target as HTMLInputElement).value;
                setName(v);
                setNameError(validateName(v));
              }}
              placeholder="如 UserAccount（字母开头，允许字母/数字/下划线）"
              className="h-9 text-sm font-mono"
            />
            {nameError && <p className="text-xs text-red-500">{nameError}</p>}
            <p className="text-[11px] text-muted-foreground">作为实体的唯一标识符，创建后不可修改</p>
          </div>

          {/* 显示名 */}
          <div className="space-y-1">
            <Label className="text-sm">
              显示名 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName((e.target as HTMLInputElement).value)}
              placeholder="如 用户账号"
              className="h-9 text-sm"
            />
          </div>

          {/* 分类 */}
          <div className="space-y-1">
            <Label className="text-sm">实体分类</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? '__none__')}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 描述 */}
          <div className="space-y-1">
            <Label className="text-sm">描述（可选）</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              rows={2}
              placeholder="实体用途说明..."
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose}>取消</Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
