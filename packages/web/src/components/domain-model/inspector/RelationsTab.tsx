/**
 * @module RelationsTab
 * @description Inspector Tab-3：关系管理（列表 + 新建/编辑/删除）。
 */

import { useState } from 'react';
import { Plus, Pencil, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EntityDetail, Relation } from '@/hooks/useDomainModel';
import RelationDialog from '../dialogs/RelationDialog';
import DeleteRelationDialog from '../dialogs/DeleteRelationDialog';

const KIND_LABEL: Record<string, string> = {
  association: '关联',
  dependency: '依赖',
  aggregation: '聚合',
  composition: '组合',
};

interface Props {
  entity: EntityDetail;
}

export default function RelationsTab({ entity }: Props) {
  const [relationDialogOpen, setRelationDialogOpen] = useState(false);
  const [editingRelation, setEditingRelation] = useState<Relation | null>(null);
  const [deleteRelation, setDeleteRelation] = useState<Relation | null>(null);

  const handleEditRelation = (relation: Relation) => {
    setEditingRelation(relation);
    setRelationDialogOpen(true);
  };

  const handleAddRelation = () => {
    setEditingRelation(null);
    setRelationDialogOpen(true);
  };

  return (
    <>
      <div className="space-y-3">
        {entity.relations.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            暂无关系，点击下方「添加关系」
          </div>
        ) : (
          <div className="space-y-2">
            {entity.relations.map((rel) => (
              <div
                key={rel.id}
                className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                {/* 关系方向 */}
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-medium text-foreground truncate">
                      {rel.sourceEntityDisplayName}
                    </span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="font-medium text-foreground truncate">
                      {rel.targetEntityDisplayName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {KIND_LABEL[rel.relationKind]}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{rel.sourceCardinality} : {rel.targetCardinality}</span>
                    {rel.displayName && (
                      <span className="text-[11px] text-muted-foreground truncate">{rel.displayName}</span>
                    )}
                  </div>
                </div>

                {/* 操作 */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleEditRelation(rel)}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteRelation(rel)}
                    className="rounded p-0.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 border-dashed"
          onClick={handleAddRelation}
        >
          <Plus className="h-3.5 w-3.5" />
          添加关系
        </Button>
      </div>

      <RelationDialog
        open={relationDialogOpen}
        onOpenChange={(open) => {
          setRelationDialogOpen(open);
          if (!open) setEditingRelation(null);
        }}
        sourceEntityId={entity.id}
        relation={editingRelation}
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
