/**
 * @module RelationDialog
 * @description 新建/编辑实体关系 Dialog。
 * 字段：targetEntityId + relationKind + sourceCardinality + targetCardinality + displayName + description
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
import { useDomainModelContext } from '@/contexts/DomainModelContext';
import type { Relation } from '@/hooks/useDomainModel';

type RelationKind = 'association' | 'dependency' | 'aggregation' | 'composition';

const KIND_OPTIONS: Array<{ value: RelationKind; label: string; desc: string }> = [
  { value: 'association', label: '关联（association）', desc: '源实体持久引用目标实体，无从属关系' },
  { value: 'dependency', label: '依赖（dependency）', desc: '源实体临时使用目标实体，无持久引用' },
  { value: 'aggregation', label: '聚合（aggregation）', desc: '源实体聚合目标实体（弱拥有）' },
  { value: 'composition', label: '组合（composition）', desc: '源实体组合目标实体（强拥有）' },
];

const CARDINALITY_PRESETS = ['1', '*', '[0,1]', '[1,*]'];

/** 基数格式正则：* | 正整数 | [n,m] | [n,*] | [n,] */
const CARDINALITY_REGEX = /^(\*|\d+|\[\d+,\d+\]|\[\d+,\*\]|\[\d+,\])$/;

/** 校验基数格式（含 n≤m 逻辑检查） */
function isValidCardinality(value: string): boolean {
  if (!CARDINALITY_REGEX.test(value)) return false;
  const intervalMatch = value.match(/^\[(\d+),(\d+)\]$/);
  if (intervalMatch) {
    return parseInt(intervalMatch[1], 10) <= parseInt(intervalMatch[2], 10);
  }
  return true;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceEntityId: string;
  relation: Relation | null; // null = 新建
}

export default function RelationDialog({ open, onOpenChange, sourceEntityId, relation }: Props) {
  const { entities, createRelation, updateRelation } = useDomainModelContext();
  const isEdit = relation !== null;

  const [targetEntityId, setTargetEntityId] = useState('');
  const [relationKind, setRelationKind] = useState<RelationKind>('dependency');
  const [sourceCardinality, setSourceCardinality] = useState('1');
  const [targetCardinality, setTargetCardinality] = useState('*');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sourceCardinalityError, setSourceCardinalityError] = useState('');
  const [targetCardinalityError, setTargetCardinalityError] = useState('');

  // 初始化
  useEffect(() => {
    if (relation) {
      setTargetEntityId(relation.targetEntityId);
      setRelationKind(relation.relationKind);
      setSourceCardinality(relation.sourceCardinality);
      setTargetCardinality(relation.targetCardinality);
      setDisplayName(relation.displayName ?? '');
      setDescription(relation.description ?? '');
    } else {
      setTargetEntityId('');
      setRelationKind('dependency');
      setSourceCardinality('1');
      setTargetCardinality('*');
      setDisplayName('');
      setDescription('');
    }
    setSourceCardinalityError('');
    setTargetCardinalityError('');
  }, [relation, open]);

  // 目标实体列表（排除自身）
  const targetOptions = entities.filter((e) => e.id !== sourceEntityId);

  // 源端实体名称
  const sourceEntity = entities.find((e) => e.id === sourceEntityId);
  const sourceEntityDisplayName = sourceEntity?.displayName ?? '';

  // 目标端实体名称（编辑模式取 relation，新建模式取当前选中）
  const targetEntityDisplayName = isEdit
    ? (relation?.targetEntityDisplayName ?? '')
    : (targetOptions.find((e) => e.id === targetEntityId)?.displayName ?? '');

  const handleSubmit = async () => {
    if (!isEdit && !targetEntityId) {
      toast.error('请选择目标实体');
      return;
    }

    // 基数格式校验
    const srcError = isValidCardinality(sourceCardinality) ? '' : '基数格式无效';
    const tgtError = isValidCardinality(targetCardinality) ? '' : '基数格式无效';
    setSourceCardinalityError(srcError);
    setTargetCardinalityError(tgtError);
    if (srcError || tgtError) return;

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateRelation(relation!.id, {
          relationKind,
          sourceCardinality,
          targetCardinality,
          displayName: displayName.trim() || null,
          description: description.trim() || null,
        });
        toast.success('关系已更新');
      } else {
        await createRelation({
          sourceEntityId,
          targetEntityId,
          relationKind,
          sourceCardinality,
          targetCardinality,
          displayName: displayName.trim() || undefined,
          description: description.trim() || undefined,
        });
        toast.success('关系创建成功');
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑关系' : '添加关系'}</DialogTitle>
        </DialogHeader>

        <div className="p-6 overflow-y-auto [&>div]:mb-[18px] [&>div:last-child]:mb-0">
          {/* 目标实体（新建时选择，编辑时只读） */}
          <div className="space-y-1">
            <Label className="text-sm">
              目标实体 {!isEdit && <span className="text-red-500">*</span>}
            </Label>
            {isEdit ? (
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                {relation?.targetEntityDisplayName}（{relation?.targetEntityName}）
              </div>
            ) : (
              <Select value={targetEntityId} onValueChange={(v) => setTargetEntityId(v ?? "")}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="选择目标实体">
                    {targetEntityId && (() => {
                      const target = targetOptions.find((e) => e.id === targetEntityId);
                      return target ? `${target.displayName}（${target.name}）` : null;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {targetOptions.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-sm">
                      {e.displayName}（{e.name}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 关系类型 */}
          <div className="space-y-1">
            <Label className="text-sm">
              关系类型 <span className="text-red-500">*</span>
            </Label>
            <Select value={relationKind} onValueChange={(v) => setRelationKind((v ?? "dependency") as RelationKind)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">
                    <div>
                      <div>{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.desc}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 源端基数 */}
          <div className="space-y-1">
            <Label className="text-sm">源端基数 — {sourceEntityDisplayName}</Label>
            <Input
              value={sourceCardinality}
              onChange={(e) => { setSourceCardinality((e.target as HTMLInputElement).value); setSourceCardinalityError(''); }}
              onBlur={() => {
                if (sourceCardinality && !isValidCardinality(sourceCardinality)) setSourceCardinalityError('基数格式无效');
              }}
              placeholder="如 1、*、[0,1]、[1,*]"
              className={`h-9 text-sm ${sourceCardinalityError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />
            <div className="flex items-center gap-1">
              {CARDINALITY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => { setSourceCardinality(preset); setSourceCardinalityError(''); }}
                  className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                    sourceCardinality === preset
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-accent'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            {sourceCardinalityError && (
              <p className="text-xs text-red-500">{sourceCardinalityError}</p>
            )}
          </div>

          {/* 目标端基数 */}
          <div className="space-y-1">
            <Label className="text-sm">目标端基数 — {targetEntityDisplayName}</Label>
            <Input
              value={targetCardinality}
              onChange={(e) => { setTargetCardinality((e.target as HTMLInputElement).value); setTargetCardinalityError(''); }}
              onBlur={() => {
                if (targetCardinality && !isValidCardinality(targetCardinality)) setTargetCardinalityError('基数格式无效');
              }}
              placeholder="如 1、*、[0,1]、[1,*]"
              className={`h-9 text-sm ${targetCardinalityError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />
            <div className="flex items-center gap-1">
              {CARDINALITY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => { setTargetCardinality(preset); setTargetCardinalityError(''); }}
                  className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                    targetCardinality === preset
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-accent'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            {targetCardinalityError && (
              <p className="text-xs text-red-500">{targetCardinalityError}</p>
            )}
          </div>

          {/* 显示名 */}
          <div className="space-y-1">
            <Label className="text-sm">关系名称（可选）</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName((e.target as HTMLInputElement).value)}
              placeholder="如 拥有、所属"
              className="h-9 text-sm"
            />
          </div>

          {/* 描述 */}
          <div className="space-y-1">
            <Label className="text-sm">描述（可选）</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              rows={2}
              placeholder="关系说明..."
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
