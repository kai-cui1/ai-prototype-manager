/**
 * @module EntityBasicTab
 * @description Inspector Tab-1：实体基本信息展示与编辑（失焦 auto-save）。
 * 字段：displayName, description, category
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useDomainModelContext } from '@/contexts/DomainModelContext';
import type { EntityDetail } from '@/hooks/useDomainModel';
import DeleteEntityDialog from '../dialogs/DeleteEntityDialog';

const CATEGORY_OPTIONS = [
  { value: '__none__', label: '（无分类）' },
  { value: 'core', label: '核心实体' },
  { value: 'supporting', label: '支撑实体' },
  { value: 'event', label: '事件实体' },
];

interface Props {
  entity: EntityDetail;
}

export default function EntityBasicTab({ entity }: Props) {
  const { updateEntity } = useDomainModelContext();
  const [displayName, setDisplayName] = useState(entity.displayName);
  const [description, setDescription] = useState(entity.description ?? '');
  const [category, setCategory] = useState(entity.category ?? '__none__');
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // 同步外部 entity 变化
  if (entity.displayName !== displayName && document.activeElement?.tagName !== 'INPUT') {
    setDisplayName(entity.displayName);
  }

  const handleBlur = useCallback(async () => {
    if (
      displayName === entity.displayName &&
      description === (entity.description ?? '') &&
      category === (entity.category ?? '__none__')
    ) {
      return; // 无变化不提交
    }
    setSaving(true);
    try {
      await updateEntity(entity.id, {
        displayName,
        description: description || undefined,
        category: category === '__none__' ? undefined : category,
      });
      toast.success('已保存');
    } catch (err) {
      toast.error((err as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [displayName, description, category, entity, updateEntity]);

  const handleCategoryChange = useCallback(
    async (val: string) => {
      setCategory(val);
      setSaving(true);
      try {
        await updateEntity(entity.id, {
          displayName,
          description: description || undefined,
          category: val === '__none__' ? undefined : val,
        });
        toast.success('已保存');
      } catch (err) {
        toast.error((err as Error).message || '保存失败');
      } finally {
        setSaving(false);
      }
    },
    [displayName, description, entity, updateEntity]
  );

  return (
    <>
      <div className="space-y-4">
        {/* 实体名（只读） */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">实体名（标识符，不可修改）</Label>
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm font-mono text-foreground">
            {entity.name}
          </div>
        </div>

        {/* 显示名 */}
        <div className="space-y-1">
          <Label className="text-xs">显示名</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName((e.target as HTMLInputElement).value)}
            onBlur={handleBlur}
            className="h-8 text-sm"
          />
        </div>

        {/* 分类 */}
        <div className="space-y-1">
          <Label className="text-xs">实体分类</Label>
          <Select value={category} onValueChange={(v) => handleCategoryChange(v ?? "__none__")}>
            <SelectTrigger className="h-8 text-sm">
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
          <Label className="text-xs">描述</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
            onBlur={handleBlur}
            rows={3}
            placeholder="实体用途说明..."
            className="text-sm resize-none"
          />
        </div>

        {saving && (
          <p className="text-xs text-muted-foreground">保存中...</p>
        )}

        {/* 危险区：删除实体 */}
        <div className="mt-6 border-t border-border pt-4">
          <Button
            variant="destructive"
            size="sm"
            className="w-full gap-2"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除实体
          </Button>
        </div>
      </div>

      <DeleteEntityDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entityId={entity.id}
        entityDisplayName={entity.displayName}
      />
    </>
  );
}
