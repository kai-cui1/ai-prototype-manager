/**
 * @module DeleteFieldDialog
 * @description 删除字段二次确认 Dialog。
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useDomainModelContext } from '@/contexts/DomainModelContext';
import type { Field } from '@/hooks/useDomainModel';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  field: Field;
}

export default function DeleteFieldDialog({ open, onOpenChange, entityId, field }: Props) {
  const { deleteField } = useDomainModelContext();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteField(entityId, field.id);
      toast.success(`字段「${field.displayName}」已删除`);
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除字段</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除字段「<strong>{field.displayName}</strong>」（{field.name}）吗？此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? '删除中...' : '确认删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
