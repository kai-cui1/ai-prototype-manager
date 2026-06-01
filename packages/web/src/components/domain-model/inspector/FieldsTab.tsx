/**
 * @module FieldsTab
 * @description Inspector Tab-2：字段管理（dnd-kit 拖拽排序 + 新建/编辑/删除）。
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EntityDetail, Field } from '@/hooks/useDomainModel';
import DraggableFieldList from './DraggableFieldList';
import FieldDialog from '../dialogs/FieldDialog';
import DeleteFieldDialog from '../dialogs/DeleteFieldDialog';

interface Props {
  entity: EntityDetail;
}

export default function FieldsTab({ entity }: Props) {
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [deleteField, setDeleteField] = useState<Field | null>(null);

  const handleEditField = (field: Field) => {
    setEditingField(field);
    setFieldDialogOpen(true);
  };

  const handleAddField = () => {
    setEditingField(null);
    setFieldDialogOpen(true);
  };

  return (
    <>
      <div className="space-y-3">
        <DraggableFieldList
          entityId={entity.id}
          fields={entity.fields}
          onEdit={handleEditField}
          onDelete={(field) => setDeleteField(field)}
        />

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 border-dashed"
          onClick={handleAddField}
        >
          <Plus className="h-3.5 w-3.5" />
          添加字段
        </Button>
      </div>

      <FieldDialog
        open={fieldDialogOpen}
        onOpenChange={(open) => {
          setFieldDialogOpen(open);
          if (!open) setEditingField(null);
        }}
        entityId={entity.id}
        field={editingField}
      />

      {deleteField && (
        <DeleteFieldDialog
          open={!!deleteField}
          onOpenChange={(open) => { if (!open) setDeleteField(null); }}
          entityId={entity.id}
          field={deleteField}
        />
      )}
    </>
  );
}
