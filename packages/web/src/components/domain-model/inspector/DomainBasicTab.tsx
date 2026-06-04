/**
 * @module DomainBasicTab
 * @description 领域 Inspector Tab-1：基本信息展示与编辑（失焦 auto-save）。
 * 字段：name（只读）+ description（可编辑）
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useDomainModelContext } from '@/contexts/DomainModelContext';
import type { BoundarySummary } from '@/hooks/useDomainModel';

interface Props {
  boundary: BoundarySummary;
  onDeleteRequest: () => void;
}

export default function DomainBasicTab({ boundary, onDeleteRequest }: Props) {
  const { updateBoundary } = useDomainModelContext();
  const [description, setDescription] = useState(boundary.description ?? '');
  const [saving, setSaving] = useState(false);

  // 同步外部 boundary 数据变化
  if (boundary.description !== null && boundary.description !== description &&
      document.activeElement?.tagName !== 'TEXTAREA') {
    setDescription(boundary.description ?? '');
  }

  const handleBlur = useCallback(async () => {
    const newDesc = description.trim() || null;
    const oldDesc = boundary.description ?? null;
    if (newDesc === oldDesc) return; // 无变化不提交
    setSaving(true);
    try {
      await updateBoundary(boundary.id, { description: newDesc });
      toast.success('已保存');
    } catch (err) {
      toast.error((err as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [description, boundary, updateBoundary]);

  return (
    <div className="space-y-4">
      {/* 领域名（只读） */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">领域名称</Label>
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground">
          {boundary.name}
        </div>
      </div>

      {/* 实体数量（只读） */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">归属实体数</Label>
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
          {boundary.entityCount} 个
        </div>
      </div>

      {/* 描述 */}
      <div className="space-y-1">
        <Label className="text-xs">描述</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
          onBlur={handleBlur}
          rows={3}
          placeholder="领域职责说明..."
          className="text-sm resize-none"
        />
      </div>

      {saving && <p className="text-xs text-muted-foreground">保存中...</p>}

      {/* 危险区：删除领域 */}
      <div className="mt-6 border-t border-border pt-4">
        <Button
          variant="destructive"
          size="sm"
          className="w-full gap-2"
          onClick={onDeleteRequest}
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除领域
        </Button>
      </div>
    </div>
  );
}
