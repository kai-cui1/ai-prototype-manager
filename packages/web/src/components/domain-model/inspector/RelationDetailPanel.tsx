/**
 * @module RelationDetailPanel
 * @description Inspector 关系详情模式面板：仅显示选中关系的详细信息 + 编辑/删除按钮。
 *
 * 点击关系线时 Inspector 切换为此模式，不显示"基本信息"/"字段"选项卡和"添加关系"按钮。
 */

import { useState } from 'react';
import { Pencil, Trash2, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Relation } from '@/hooks/useDomainModel';
import RelationDialog from '../dialogs/RelationDialog';
import DeleteRelationDialog from '../dialogs/DeleteRelationDialog';

const KIND_LABEL: Record<string, string> = {
  association: '关联',
  dependency: '依赖',
  aggregation: '聚合',
  composition: '组合',
};

interface Props {
  relation: Relation;
}

export default function RelationDetailPanel({ relation }: Props) {
  const [relationDialogOpen, setRelationDialogOpen] = useState(false);
  const [deleteRelation, setDeleteRelation] = useState<Relation | null>(null);

  return (
    <>
      <div className="space-y-3">
        {/* 关系详情卡片 */}
        <div className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
          {/* 关系方向 + 属性 */}
          <div className="flex flex-1 flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-foreground truncate">
                {relation.sourceEntityDisplayName}
              </span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="font-medium text-foreground truncate">
                {relation.targetEntityDisplayName}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {KIND_LABEL[relation.relationKind]}
              </Badge>
              <span className="text-[11px] text-muted-foreground">{relation.sourceCardinality} : {relation.targetCardinality}</span>
              {relation.displayName && (
                <span className="text-[11px] text-muted-foreground truncate">{relation.displayName}</span>
              )}
            </div>
            {relation.description && (
              <div className="text-[11px] text-muted-foreground mt-1">{relation.description}</div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setRelationDialogOpen(true)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeleteRelation(relation)}
              className="rounded p-0.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <RelationDialog
        open={relationDialogOpen}
        onOpenChange={(open) => setRelationDialogOpen(open)}
        sourceEntityId={relation.sourceEntityId}
        relation={relation}
      />

      {deleteRelation && (
        <DeleteRelationDialog
          open={!!deleteRelation}
          onOpenChange={(open) => { if (!open) setDeleteRelation(null); }}
          relation={deleteRelation}
        />
      )}
    </>
  );
}