/**
 * @module DeleteEntityDialog
 * @description 删除实体二次确认 Dialog。
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityDisplayName: string;
}

export default function DeleteEntityDialog({ open, onOpenChange, entityId, entityDisplayName }: Props) {
  const { deleteEntity } = useDomainModelContext();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteEntity(entityId);
      toast.success(`实体「${entityDisplayName}」已删除`);
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
          <AlertDialogTitle>确认删除实体</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除实体「<strong>{entityDisplayName}</strong>」吗？
            此操作将同时删除该实体的所有字段和关系，且无法撤销。
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
