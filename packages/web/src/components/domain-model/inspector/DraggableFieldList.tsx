/**
 * @module DraggableFieldList
 * @description dnd-kit 拖拽排序字段列表。
 *
 * 交互：
 * 1. 拖拽排序：乐观更新本地顺序 → PATCH /fields/reorder
 * 2. 失败时回滚本地状态 + Toast 错误
 */

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDomainModelContext } from '@/contexts/DomainModelContext';
import type { Field } from '@/hooks/useDomainModel';

// ---- Sortable 行 ----

interface SortableFieldRowProps {
  field: Field;
  onEdit: (field: Field) => void;
  onDelete: (field: Field) => void;
}

function SortableFieldRow({ field, onEdit, onDelete }: SortableFieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2 text-sm',
        'hover:border-primary/40 transition-colors',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      {/* 拖拽把手 */}
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none"
        tabIndex={-1}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* 字段类型 */}
      <span className="w-16 shrink-0 text-[11px] font-mono text-muted-foreground truncate">
        {field.fieldType}
      </span>

      {/* 字段显示名 */}
      <span className="flex-1 truncate text-foreground" title={field.displayName}>
        {field.displayName}
      </span>

      {/* 必填标记 */}
      {field.isRequired && (
        <span className="shrink-0 text-[11px] text-red-500 font-medium">必填</span>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(field)}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(field)}
          className="rounded p-0.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---- 主组件 ----

interface DraggableFieldListProps {
  entityId: string;
  fields: Field[];
  onEdit: (field: Field) => void;
  onDelete: (field: Field) => void;
}

export default function DraggableFieldList({
  entityId,
  fields,
  onEdit,
  onDelete,
}: DraggableFieldListProps) {
  const { reorderFields } = useDomainModelContext();
  const [localFields, setLocalFields] = useState<Field[]>(fields);

  // 外部 fields 变化时同步
  if (fields !== localFields && !localFields.some((f) => !fields.find((ff) => ff.id === f.id))) {
    // 只在字段集合不变时同步（避免排序中途被覆盖）
    setLocalFields(fields);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = localFields.findIndex((f) => f.id === active.id);
      const newIndex = localFields.findIndex((f) => f.id === over.id);
      const newOrder = arrayMove(localFields, oldIndex, newIndex);

      // 乐观更新
      setLocalFields(newOrder);

      try {
        await reorderFields(
          entityId,
          newOrder.map((f) => f.id)
        );
      } catch (err) {
        // 回滚
        setLocalFields(fields);
        toast.error((err as Error).message || '排序保存失败');
      }
    },
    [entityId, localFields, fields, reorderFields]
  );

  if (localFields.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
        暂无字段，点击下方「添加字段」
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={localFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {localFields.map((field) => (
            <SortableFieldRow
              key={field.id}
              field={field}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
